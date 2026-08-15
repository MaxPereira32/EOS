/**
 * EOS CORE DOMAIN — SEMANTIC POLICY ENGINE & OPERATIONAL RESILIENCE
 * Phase 1.4: Semantic Authorization, Idempotency, TOCTOU Defense, Conflict Detection, and Persistent Crash State Machine.
 */

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

export interface ExecutionJournalService {
  startJournal(plan: ActionPlan): ExecutionJournal;
  updateJournalState(planId: string, stepState: ExecutionStepState, patch?: { targetFilePath: string; patchHash: string }, errorDetails?: string): ExecutionJournal;
  readJournal(planId: string): ExecutionJournal | null;
  recoverPendingExecution(planId: string): { isInterrupted: boolean; stepState: ExecutionStepState };
}

export interface FileOperationAdapter {
  exists(filePath: string): boolean;
  read(filePath: string): string;
  hash(content: string): string;
  withLock(filePath: string, fn: () => void): void;
}

export class SemanticPolicyEngine {
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
   * IDEMPOTÊNCIA DE EXECUÇÃO: Verifica se o patch já foi aplicado.
   */
  public static isPlanAlreadyApplied(plan: ActionPlan, repositoryRoot: string, fileAdapter: FileOperationAdapter): boolean {
    for (const change of plan.proposedChanges) {
      const fullPath = `${repositoryRoot}/${change.targetFilePath}`.replace(/\\/g, '/').replace(/\/\//g, '/');
      if (fileAdapter.exists(fullPath)) {
        const content = fileAdapter.read(fullPath);
        if (content.includes(change.patchDiff)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * DEFESA TOCTOU ATÔMICA (Time-of-Check to Time-of-Use):
   * Executa a checagem do hash e a gravação através da trava provida pela infraestrutura.
   */
  public static validateTOCTOUAndExecute(filePath: string, expectedSourceHash: string, fileAdapter: FileOperationAdapter, writeFn: () => void): void {
    fileAdapter.withLock(filePath, () => {
      if (!fileAdapter.exists(filePath)) {
        throw new Error(`TOCTOU_VIOLATION_FILE_NOT_FOUND: O arquivo '${filePath}' foi removido entre a verificação e a gravação.`);
      }

      const currentContent = fileAdapter.read(filePath);
      const currentHash = fileAdapter.hash(currentContent);

      if (currentHash !== expectedSourceHash) {
        throw new Error(`TOCTOU_VIOLATION_FILE_MODIFIED: O arquivo '${filePath}' sofreu mutação no milissegundo antes da gravação.`);
      }

      writeFn();
    });
  }

  public static validateTOCTOU(filePath: string, expectedSourceHash: string, fileAdapter: FileOperationAdapter): void {
    if (!fileAdapter.exists(filePath)) {
      throw new Error(`TOCTOU_VIOLATION_FILE_NOT_FOUND: O arquivo '${filePath}' foi removido entre a verificação e a gravação.`);
    }
    const currentContent = fileAdapter.read(filePath);
    const currentHash = fileAdapter.hash(currentContent);

    if (currentHash !== expectedSourceHash) {
      throw new Error(`TOCTOU_VIOLATION_FILE_MODIFIED: O arquivo '${filePath}' sofreu mutação no milissegundo antes da gravação.`);
    }
  }

  /**
   * DETECÇÃO DE CONFLITO DE REMEDIAÇÃO:
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
