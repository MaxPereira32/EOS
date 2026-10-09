import * as crypto from 'crypto';
import * as path from 'path';
import { SecretStoreService } from '../services/secret-store-service';

/**
 * COR-02 (AUD-2026-10-09-03): nenhuma chave embutida no fonte. A chave HMAC
 * vive como credencial `EOS_REPORT_SIGNING` no SecretStore (cifrada em
 * repouso, raiz na instalação do EOS — nunca no alvo auditado). Fail-closed:
 * sem segredo válido, nenhuma assinatura é emitida.
 */
const SIGNING_PROVIDER_ID = 'EOS_REPORT_SIGNING';

function resolveEosHome(): string {
  // EOS/core/utils -> EOS (raiz da instalação)
  return path.resolve(__dirname, '..', '..');
}

function loadSigningKey(): string {
  const store = new SecretStoreService(undefined, resolveEosHome());
  try {
    return store.retrieveCredential(SIGNING_PROVIDER_ID);
  } catch (err: any) {
    if (!String(err?.message || err).startsWith('NOT_FOUND_ERROR')) throw err;
    const fresh = crypto.randomBytes(32).toString('hex');
    store.storeCredential(SIGNING_PROVIDER_ID, fresh);
    return store.retrieveCredential(SIGNING_PROVIDER_ID);
  }
}

/**
 * Canonicalização recursiva: ordena chaves em TODOS os níveis (a versão
 * anterior usava replacer de 1º nível — EOS-SEC-005 — e mutações aninhadas
 * preservavam a assinatura).
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export class ReportIntegritySigner {
  public static signReportContent(reportJson: object): string {
    const key = loadSigningKey();
    if (!key || key.trim().length < 32) {
      throw new Error('SIGNING_KEY_UNAVAILABLE: segredo HMAC ausente ou inválido; relatório não assinado.');
    }
    const canonicalString = JSON.stringify(canonicalize(reportJson));
    return crypto
      .createHmac('sha256', key)
      .update(canonicalString)
      .digest('hex');
  }

  /**
   * Verifica a integridade e autenticidade do relatório em relação à assinatura HMAC
   */
  public static verifyReportContent(reportJson: object, signature: string): boolean {
    if (!signature) return false;
    let computed: string;
    try {
      computed = this.signReportContent(reportJson);
    } catch {
      return false;
    }
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(signature, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
