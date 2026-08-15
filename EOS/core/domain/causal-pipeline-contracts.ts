/**
 * EOS CORE DOMAIN — CAUSAL PIPELINE & LINEAGE CONTRACTS
 * Strict transition validators and lineage provenance models for Fases 1.2–1.5.
 */

import { Finding, Evidence, Fact } from './types';
import { ActionPlan } from './action-plan';
import { ApprovalRecord } from './approval-record';

/**
 * Snapshot estrito do estado do repositório no momento da observação.
 */
export interface SourceSnapshot {
  readonly snapshotId: string; // SHA-256 da árvore de arquivos
  readonly repositoryRoot: string;
  readonly commitHash: string | null;
  readonly branchName: string | null;
  readonly observedAt: string; // ISO-8601
  readonly treeHash: string; // Hash determinístico da lista de arquivos e hashes
}

/**
 * Projeção de Leitura (Read Model / Audit Projection) da Remédiação Causal.
 * NÃO É UM GOD AGGREGATE. É uma visão pura de auditoria gerada por projeção.
 */
export interface CausalRemediationAuditProjection {
  readonly remediationId: string;
  readonly sourceSnapshot: SourceSnapshot;
  readonly evidences: readonly Evidence[];
  readonly facts: readonly Fact[];
  readonly finding: Finding;
  readonly userIntentContext?: string; // Intenção humana (apenas contexto, sem autoridade)
  readonly proposedActionPlan?: ActionPlan;
  readonly approvalRecord?: ApprovalRecord;
  readonly afterSourceSnapshot?: SourceSnapshot;
  readonly revalidationProof?: {
    readonly proofId: string;
    readonly auditRunId: string; // DEVE SER UM NOVO AuditRun!
    readonly isResolved: boolean;
    readonly remainingFindingIds: readonly string[];
    readonly verifiedAt: string;
  };
}

/**
 * VALIDADORES DETERMINÍSTICOS DE TRANSIÇÃO (INVARIANTES INVIOLÁVEIS)
 */
export class CausalTransitionValidators {

  /**
   * INVARIANTE 1: Não existe Finding sem Evidência concreta.
   */
  public static validateFindingHasEvidence(finding: Finding): void {
    if (!finding.evidence_ids || finding.evidence_ids.length === 0) {
      throw new Error('CAUSAL_INVARIANT_VIOLATION_1: Nenhum Finding pode existir sem evidence_ids vinculados.');
    }
  }

  /**
   * INVARIANTE 2: Não existe ActionPlan sem Finding de origem.
   */
  public static validateActionPlanHasFinding(plan: ActionPlan, finding: Finding): void {
    if (!plan.findingId || plan.findingId !== finding.finding_id) {
      throw new Error('CAUSAL_INVARIANT_VIOLATION_2: ActionPlan deve ter findingId correspondente ao Finding.');
    }
  }

  /**
   * INVARIANTE 3 & 4: Não existe Execução sem ApprovalRecord assinado com planHash correspondente.
   */
  public static validateExecutionApproval(plan: ActionPlan, approval: ApprovalRecord): void {
    if (!approval || !approval.approvalId) {
      throw new Error('CAUSAL_INVARIANT_VIOLATION_3: Execução bloqueada. Requer ApprovalRecord assinado.');
    }
    if (approval.approvedPlanHash !== plan.planHash) {
      throw new Error(`CAUSAL_INVARIANT_VIOLATION_4: Divergência de Hash! O plano aprovado (${approval.approvedPlanHash}) difere do plano atual (${plan.planHash}).`);
    }
    if (approval.decision !== 'APPROVED') {
      throw new Error('CAUSAL_INVARIANT_VIOLATION_3_DECISION: ApprovalRecord existe, mas a decisão foi REJECTED ou PENDING.');
    }
  }

  /**
   * INVARIANTE 5: Alteração do estado do repositório após aprovação invalida execução direta sem revalidação.
   */
  public static validateStateFreshness(snapshotAtProposal: SourceSnapshot, currentSnapshot: SourceSnapshot): void {
    if (snapshotAtProposal.treeHash !== currentSnapshot.treeHash) {
      throw new Error('CAUSAL_INVARIANT_VIOLATION_5: O estado do repositório foi alterado após a geração da proposta. Revalidação obrigatória.');
    }
  }

  /**
   * INVARIANTE 6: Revalidação não pode reutilizar o mesmo AuditRun anterior (Stale AuditRun).
   */
  public static validateRevalidationFreshness(previousAuditRunId: string, revalidationAuditRunId: string): void {
    if (!revalidationAuditRunId || previousAuditRunId === revalidationAuditRunId) {
      throw new Error('CAUSAL_INVARIANT_VIOLATION_6: Stale AuditRun! A revalidação não pode reutilizar o AuditRun da observação inicial.');
    }
  }
}
