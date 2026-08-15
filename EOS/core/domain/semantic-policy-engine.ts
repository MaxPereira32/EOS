/**
 * EOS CORE DOMAIN — SEMANTIC POLICY ENGINE & OPERATIONAL RESILIENCE
 * Phase 1.4: Semantic Authorization, Idempotency, TOCTOU Defense, Conflict Detection, and Crash State Machine.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { ActionPlan } from './action-plan';
import { ApprovalRecord } from './approval-record';

export type ExecutionStepState = 'NOT_STARTED' | 'IN_PROGRESS' | 'APPLIED' | 'FAILED' | 'REVALIDATED';

export interface ExecutionJournal {
  readonly planId: string;
  readonly planHash: string;
  readonly stepState: ExecutionStepState;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly appliedPatches: readonly { readonly targetFilePath: string; readonly patchHash: string }[];
  readonly errorDetails?: string;
}

export class SemanticPolicyEngine {
  // Padrões estritamente proibidos para autorização semântica (mesmo se o plano for válido e aprovado)
  private static readonly FORBIDDEN_TARGET_PATTERNS = [
    /^\.git\//,
    /^\.eos\/rules\//,
    /^\.eos\/credentials\.enc\.json/,
    /^\.eos\/governor\.hash/,
    /^node_modules\//,
    /\.pem$/,
    /\.key$/
  ];

  /**
   * AUTORIZAÇÃO SEMÂNTICA: Valida se o plano respeita os limites de segurança política.
   * "Integridade não é Autorização" — Um plano assinado tentando alterar regras ou segredos é BLOQUEADO.
   */
  public static validateSemanticPolicy(plan: ActionPlan): void {
    for (const change of plan.proposedChanges) {
      const normalizedPath = change.targetFilePath.replace(/\\/g, '/');

      for (const pattern of this.FORBIDDEN_TARGET_PATTERNS) {
        if (pattern.test(normalizedPath)) {
          throw new Error(`SEMANTIC_POLICY_VIOLATION: O ActionPlan tenta modificar o caminho proibido '${change.targetFilePath}'. Acesso negado pela política.`);
        }
      }
    }
  }

  /**
   * IDEMPOTÊNCIA DE EXECUÇÃO: Verifica se o patch já foi aplicado no disco (evita dupla mutação).
   */
  public static isPlanAlreadyApplied(plan: ActionPlan, repositoryRoot: string): boolean {
    for (const change of plan.proposedChanges) {
      const fullPath = `${repositoryRoot}/${change.targetFilePath}`.replace(/\\/g, '/');
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Se o conteúdo atual já contiver a alteração proposta exatamente, a execução é idempotente
        if (content.includes(change.patchDiff)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * DEFESA TOCTOU (Time-of-Check to Time-of-Use):
   * Checa o hash do arquivo no EXATO instante anterior à gravação.
   */
  public static validateTOCTOU(filePath: string, expectedSourceHash: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`TOCTOU_VIOLATION_FILE_NOT_FOUND: O arquivo '${filePath}' foi removido entre a verificação e a gravação.`);
    }
    const currentContent = fs.readFileSync(filePath, 'utf8');
    const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

    if (currentHash !== expectedSourceHash) {
      throw new Error(`TOCTOU_VIOLATION_FILE_MODIFIED: O arquivo '${filePath}' sofreu mutação no milissegundo antes da gravação.`);
    }
  }

  /**
   * DETECÇÃO DE CONFLITO DE REMEDIAÇÃO:
   * Verifica se dois ActionPlans concorrentes derivam do mesmo estado e tentam modificar os mesmos caminhos.
   */
  public static detectRemediationConflict(planA: ActionPlan, planB: ActionPlan): void {
    if (planA.planId === planB.planId) return;

    const pathsA = new Set(planA.proposedChanges.map(c => c.targetFilePath));
    for (const changeB of planB.proposedChanges) {
      if (pathsA.has(changeB.targetFilePath)) {
        throw new Error(`REMEDIATION_CONFLICT_OVERLAPPING_PATCH: Conflito detectado! Planos '${planA.planId}' e '${planB.planId}' tentam alterar o mesmo arquivo '${changeB.targetFilePath}'.`);
      }
    }
  }
}
