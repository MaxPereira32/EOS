/**
 * EOS CORE SERVICES — AUDIT HISTORY PROJECTION SERVICE (v3.1.0 SOVEREIGN)
 * Pure Read Model projection deriving CausalRemediationAuditProjection DTOs
 * dynamically from primary AuditArtifact domain entities on disk.
 * ZERO MOCK POLICY: Projects ONLY persistent artifacts saved on disk (.eos/projects/{projectId}/audits/).
 * MULTI-PROJECT ISOLATION: All projections are strictly bound to an explicit target projectId.
 * EXECUTION SEPARATION: totalActionsExecuted ONLY increments when a valid ExecutionJournal is present.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CausalRemediationAuditProjection } from '../domain/causal-pipeline-contracts';
import { AuditHistoryRepository, AuditArtifact } from '../storage/audit-history-repository';

export interface AuditHistorySummaryDTO {
  readonly auditRunId: string;
  readonly projectId: string;
  readonly targetPath: string;
  readonly executedAt: string;
  readonly status: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'FAILED' | 'BLOCKED' | 'PENDING_APPROVAL' | 'OBSERVED';
  readonly totalFindings: number;
  readonly totalActionsProposed: number;
  readonly totalActionsExecuted: number;
  readonly totalRevalidated: number;
  readonly remainingFindingsCount: number;
  readonly repositoryTreeHash: string;
  readonly artifactHash: string;
}

export class AuditHistoryProjectionService {
  private readonly repository: AuditHistoryRepository;

  constructor(customEosDir?: string) {
    this.repository = new AuditHistoryRepository(customEosDir);
  }

  /**
   * Persiste uma projeção de auditoria real criando um AuditArtifact soberano no disco.
   */
  public persistAuditRun(projection: CausalRemediationAuditProjection, projectId: string): string {
    if (!projectId) {
      throw new Error('AUDIT_SERVICE_ERROR: projectId é obrigatório.');
    }
    const auditRunId = projection.revalidationProof?.auditRunId || `AUD-${Date.now()}`;
    const findingsArray = projection.findings || (projection.finding ? [projection.finding] : []);
    this.repository.saveAuditArtifact(
      auditRunId,
      projectId,
      projection.sourceSnapshot,
      projection.evidences,
      projection.facts,
      findingsArray,
      projection.proposedActionPlan,
      projection.approvalRecord,
      projection.afterSourceSnapshot,
      projection.revalidationProof,
      undefined,
      undefined,
      undefined,
      projection.executionJournal
    );
    return auditRunId;
  }

  /**
   * Converte um AuditArtifact em uma projeção Read Model (CausalRemediationAuditProjection).
   */
  public projectArtifactToCausalView(artifact: AuditArtifact): CausalRemediationAuditProjection {
    const findingsArray = artifact.findings || ((artifact as any).finding ? [(artifact as any).finding] : []);
    return {
      remediationId: artifact.proposedActionPlan?.planId || artifact.artifactId,
      sourceSnapshot: artifact.sourceSnapshot,
      evidences: artifact.evidences,
      facts: artifact.facts,
      findings: findingsArray,
      proposedActionPlan: artifact.proposedActionPlan,
      approvalRecord: artifact.approvalRecord,
      executionJournal: artifact.executionJournal,
      afterSourceSnapshot: artifact.afterSourceSnapshot,
      revalidationProof: artifact.revalidationProof
    };
  }

  /**
   * Projeta a lista de resumos de histórico de auditoria LENDO EXCLUSIVAMENTE ARQUIVOS REAIS DO DISCO.
   */
  public getAuditHistorySummaries(projectId: string): AuditHistorySummaryDTO[] {
    if (!projectId) {
      throw new Error('AUDIT_SERVICE_ERROR: projectId é obrigatório e deve ser especificado explicitamente.');
    }

    const queryResult = this.repository.listAuditArtifacts(projectId);
    const summaries: AuditHistorySummaryDTO[] = [];

    for (const artifact of queryResult.artifacts) {
      const isResolved = artifact.revalidationProof?.isResolved ?? false;
      const findingsList = artifact.findings || ((artifact as any).finding ? [(artifact as any).finding] : []);
      const totalFindings = findingsList.length;
      const totalActionsProposed = artifact.proposedActionPlan ? 1 : 0;
      
      // SEPARAÇÃO RIGOROSA: totalActionsExecuted SÓ INCREMENTA COM EXECUTION JOURNAL (Aprovação NÃO É Execução!)
      const totalActionsExecuted = artifact.executionJournal?.status === 'SUCCESS' ? 1 : 0;
      
      const totalRevalidated = artifact.revalidationProof ? 1 : 0;
      const remaining = isResolved ? 0 : totalFindings;

      summaries.push({
        auditRunId: artifact.auditRunId,
        projectId: artifact.projectId,
        targetPath: artifact.projectId,
        executedAt: artifact.createdAt,
        status: isResolved ? 'RESOLVED' : 'BLOCKED',
        totalFindings,
        totalActionsProposed,
        totalActionsExecuted,
        totalRevalidated,
        remainingFindingsCount: remaining,
        repositoryTreeHash: artifact.sourceSnapshot?.treeHash || 'tree-hash-unknown',
        artifactHash: artifact.artifactHash
      });
    }

    return summaries.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
  }

  /**
   * Projeta o detalhe completo da timeline causal LENDO DIRETO DO DISCO,
   * aplicando validação estrita de isolamento por projectId (Defesa IDOR).
   */
  public getAuditTimelineDetail(auditRunId: string, projectId: string): CausalRemediationAuditProjection | null {
    if (!auditRunId || !projectId) {
      throw new Error('AUDIT_SERVICE_ERROR: auditRunId e projectId são obrigatórios.');
    }

    let artifact = this.repository.getAuditArtifact(projectId, auditRunId);

    if (!artifact) {
      // Scan todos os diretórios de projetos para detectar acesso não autorizado cross-project (Defesa IDOR)
      const projectsDir = path.join((this.repository as any).baseDir || path.join(process.cwd(), '.eos'), 'projects');
      if (fs.existsSync(projectsDir)) {
        const projectFolders = fs.readdirSync(projectsDir);
        for (const folder of projectFolders) {
          if (folder === projectId) continue;
          const otherArtifact = this.repository.getAuditArtifact(folder, auditRunId);
          if (otherArtifact) {
            throw new Error(`SECURITY_VIOLATION_PROJECT_ISOLATION: O AuditRun '${auditRunId}' pertence ao projeto '${otherArtifact.projectId}', acesso negado para '${projectId}'.`);
          }
        }
      }
      return null;
    }

    if (projectId && projectId !== 'ALL' && artifact.projectId !== projectId) {
      throw new Error(`SECURITY_VIOLATION_PROJECT_ISOLATION: O AuditRun '${auditRunId}' pertence ao projeto '${artifact.projectId}', acesso negado para '${projectId}'.`);
    }

    return this.projectArtifactToCausalView(artifact);
  }
}
