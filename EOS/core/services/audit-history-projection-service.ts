/**
 * EOS CORE SERVICES — AUDIT HISTORY PROJECTION SERVICE
 * Pure Read Model projection deriving CausalRemediationAuditProjection DTOs
 * dynamically from primary AuditArtifact domain entities on disk.
 * ZERO MOCK POLICY: Projects ONLY persistent artifacts saved on disk (.eos/projects/{projectId}/audits/).
 * MULTI-PROJECT ISOLATION: All projections are strictly bound to a target projectId.
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
  public persistAuditRun(projection: CausalRemediationAuditProjection, projectId = 'project-alpha'): string {
    const auditRunId = projection.revalidationProof?.auditRunId || `AUD-${Date.now()}`;
    this.repository.saveAuditArtifact(
      auditRunId,
      projectId,
      projection.sourceSnapshot,
      projection.evidences,
      projection.facts,
      projection.finding,
      projection.proposedActionPlan,
      projection.approvalRecord,
      projection.afterSourceSnapshot,
      projection.revalidationProof
    );
    return auditRunId;
  }

  /**
   * Converte um AuditArtifact em uma projeção Read Model (CausalRemediationAuditProjection).
   */
  public projectArtifactToCausalView(artifact: AuditArtifact): CausalRemediationAuditProjection {
    return {
      remediationId: artifact.proposedActionPlan?.planId || artifact.artifactId,
      sourceSnapshot: artifact.sourceSnapshot,
      evidences: artifact.evidences,
      facts: artifact.facts,
      finding: artifact.finding,
      proposedActionPlan: artifact.proposedActionPlan,
      approvalRecord: artifact.approvalRecord,
      afterSourceSnapshot: artifact.afterSourceSnapshot,
      revalidationProof: artifact.revalidationProof
    };
  }

  /**
   * Projeta a lista de resumos de histórico de auditoria LENDO EXCLUSIVAMENTE ARQUIVOS REAIS DO DISCO.
   */
  public getAuditHistorySummaries(projectId = 'project-alpha'): AuditHistorySummaryDTO[] {
    const artifacts = this.repository.listAuditArtifacts(projectId);
    const summaries: AuditHistorySummaryDTO[] = [];

    for (const artifact of artifacts) {
      const isResolved = artifact.revalidationProof?.isResolved ?? false;
      const totalFindings = artifact.finding ? 1 : 0;
      const totalActionsProposed = artifact.proposedActionPlan ? 1 : 0;
      const totalActionsExecuted = artifact.approvalRecord?.decision === 'APPROVED' ? 1 : 0;
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
  public getAuditTimelineDetail(auditRunId: string, projectId = 'project-alpha'): CausalRemediationAuditProjection | null {
    let artifact = this.repository.getAuditArtifact(projectId, auditRunId);

    if (!artifact) {
      // Scan all project folders to detect cross-project unauthorized access (IDOR Defense)
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
