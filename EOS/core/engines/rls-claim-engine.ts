import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ExecutionEvidence, RlsExecutionRecord, ThreatModelVector } from '../domain/types';

export interface RlsClaimAssessment {
  readonly complete: boolean;
  readonly blockingReasons: readonly string[];
  readonly threatVectors: readonly ThreatModelVector[];
}

interface RlsClaimInput {
  readonly rootPath: string;
  readonly claimId: string;
  readonly targetArtifact: string;
  readonly resource: string | null;
  readonly isolationAssertionId: string | null;
  readonly causalSpecPath: string | null;
  readonly executionEvidence?: ExecutionEvidence;
}

const SHA256 = /^[a-f0-9]{64}$/;
const OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function hasEveryOperation(record: RlsExecutionRecord): boolean {
  return Array.isArray(record.operations)
    && OPERATIONS.every(operation => record.operations!.includes(operation as 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'));
}

function safeHash(value: unknown): value is string {
  return typeof value === 'string' && SHA256.test(value);
}

/**
 * Valida o contrato mínimo de uma prova de isolamento PostgreSQL. O executor
 * só pode chamar este motor depois de vincular os registros a um nonce novo.
 */
export class RlsClaimEngine {
  public evaluate(input: RlsClaimInput): RlsClaimAssessment {
    const blockingReasons: string[] = [];
    const targetPath = path.resolve(input.rootPath, input.targetArtifact);
    const targetHash = fs.existsSync(targetPath)
      ? crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex')
      : null;

    if (!input.resource || !/^[A-Za-z0-9_.-]{1,160}$/.test(input.resource)) {
      blockingReasons.push(`Claim RLS ${input.claimId} exige evidence.rls_resource seguro e aplicável.`);
    }
    if (!input.isolationAssertionId || !/^[A-Za-z0-9:_-]{3,160}$/.test(input.isolationAssertionId)) {
      blockingReasons.push(`Claim RLS ${input.claimId} exige evidence.rls_isolation_assertion_id.`);
    }
    if (!targetHash) {
      blockingReasons.push(`Artefato de política RLS indisponível: ${input.targetArtifact}.`);
    }

    this.validateCausalSpec(input, blockingReasons);

    const evidence = input.executionEvidence;
    if (!evidence || evidence.state !== 'PASS' || evidence.exit_code !== 0 ||
      evidence.rls_claim_id !== input.claimId || !evidence.rls_nonce) {
      blockingReasons.push(`A validação RLS ${input.claimId} não produziu execução aprovada, vinculada ao claim e ao nonce da auditoria.`);
      return { complete: false, blockingReasons, threatVectors: this.threatVectors(false, false, false) };
    }

    const records = evidence.rls_records || [];
    const matching = records.filter(record => record.claim_id === input.claimId && record.nonce === evidence.rls_nonce);
    const expected = ['PRETEST_RLS_CONFIGURATION', 'ALLOW_SAME_TENANT', 'DENY_CROSS_TENANT'] as const;
    for (const scenario of expected) {
      if (matching.filter(record => record.scenario === scenario).length !== 1) {
        blockingReasons.push(`Registro RLS ${scenario} ausente, duplicado ou não vinculado ao nonce desta execução.`);
      }
    }
    if (matching.length !== expected.length) {
      blockingReasons.push('A execução RLS contém registros inesperados ou estruturalmente incompletos.');
    }

    const preflight = matching.find(record => record.scenario === 'PRETEST_RLS_CONFIGURATION');
    const allow = matching.find(record => record.scenario === 'ALLOW_SAME_TENANT');
    const deny = matching.find(record => record.scenario === 'DENY_CROSS_TENANT');
    const preflightOk = !!preflight && preflight.status === 'PASS' && preflight.runtime === 'POSTGRES'
      && preflight.resource === input.resource && preflight.target_sha256 === targetHash
      && preflight.rls_enabled === true && preflight.rls_forced === true
      && Number.isSafeInteger(preflight.policy_count) && (preflight.policy_count || 0) > 0
      && preflight.role_is_owner === false && preflight.role_has_bypassrls === false
      && preflight.security_definer_bypass === false;
    if (!preflightOk) {
      blockingReasons.push('Pré-teste RLS não comprovou política aplicável, RLS habilitado/forçado, artefato vinculado e role sem owner/BYPASSRLS/SECURITY DEFINER.');
    }

    const allowOk = !!allow && allow.status === 'PASS' && allow.runtime === 'POSTGRES'
      && allow.resource === input.resource && allow.target_sha256 === targetHash
      && safeHash(allow.actor_identity_sha256) && safeHash(allow.actor_tenant_sha256)
      && allow.actor_tenant_sha256 === allow.resource_tenant_sha256 && hasEveryOperation(allow);
    if (!allowOk) {
      blockingReasons.push('Cenário permitido não comprovou as quatro operações para identidade autenticada no mesmo tenant.');
    }

    const denyOk = !!deny && deny.status === 'PASS' && deny.runtime === 'POSTGRES'
      && deny.resource === input.resource && deny.target_sha256 === targetHash
      && safeHash(deny.actor_identity_sha256) && safeHash(deny.actor_tenant_sha256)
      && safeHash(deny.resource_tenant_sha256) && deny.actor_tenant_sha256 !== deny.resource_tenant_sha256
      && hasEveryOperation(deny);
    if (!denyOk) {
      blockingReasons.push('Cenário negado não comprovou bloqueio cross-tenant para SELECT/INSERT/UPDATE/DELETE.');
    }

    return { complete: blockingReasons.length === 0, blockingReasons, threatVectors: this.threatVectors(preflightOk, allowOk, denyOk) };
  }

  private validateCausalSpec(input: RlsClaimInput, blockingReasons: string[]): void {
    if (!input.causalSpecPath || !input.isolationAssertionId) {
      blockingReasons.push(`Claim RLS ${input.claimId} exige causal_spec e assertion de isolamento.`);
      return;
    }
    const specPath = path.resolve(input.rootPath, input.causalSpecPath);
    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as { claims?: Record<string, any> };
      const mutation = spec?.claims?.[input.claimId];
      if (!mutation || mutation.kind !== 'TEXT_REPLACE' || mutation.control !== 'RLS_POLICY'
        || mutation.target !== input.targetArtifact || mutation.assertion_id !== input.isolationAssertionId) {
        blockingReasons.push('causal_spec RLS deve declarar mutação TEXT_REPLACE de controle RLS_POLICY no alvo e na assertion de isolamento informados.');
      }
    } catch {
      blockingReasons.push('causal_spec RLS ausente ou inválido; a prova adversarial não é aplicável.');
    }
  }

  private threatVectors(preflight: boolean, allowed: boolean, denied: boolean): readonly ThreatModelVector[] {
    return [
      { vector_id: 'LEGITIMATE_OPERATION', description: 'Operações permitidas no mesmo tenant', required: true, verified: allowed },
      { vector_id: 'UNAUTHORIZED_MUTATION', description: 'Operações cross-tenant negadas', required: true, verified: denied },
      { vector_id: 'PRIVILEGE_ESCALATION', description: 'Role sem owner, BYPASSRLS ou bypass SECURITY DEFINER', required: true, verified: preflight },
    ];
  }
}
