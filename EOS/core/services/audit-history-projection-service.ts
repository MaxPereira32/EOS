/**
 * EOS CORE SERVICES — AUDIT HISTORY PROJECTION SERVICE
 * Pure Read Model projection converting REAL materialized domain artifacts from disk into immutable DTOs.
 * ZERO MOCK POLICY: Projects ONLY persistent artifacts saved on disk (.eos/audits/).
 * MULTI-PROJECT ISOLATION: All projections are strictly bound to a target projectId.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CausalRemediationAuditProjection, SourceSnapshot } from '../domain/causal-pipeline-contracts';
import { Finding, Evidence, Fact } from '../domain/types';
import { ActionPlan } from '../domain/action-plan';
import { ApprovalRecord } from '../domain/approval-record';

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
}

export class AuditHistoryProjectionService {
  private readonly eosDir: string;
  private readonly auditsDir: string;

  constructor(customEosDir?: string) {
    this.eosDir = customEosDir || path.join(process.cwd(), '.eos');
    this.auditsDir = path.join(this.eosDir, 'audits');

    if (!fs.existsSync(this.auditsDir)) {
      fs.mkdirSync(this.auditsDir, { recursive: true });
    }
  }

  /**
   * Persiste uma projeção real de auditoria no disco (.eos/audits/{auditRunId}.json).
   */
  public persistAuditRun(projection: CausalRemediationAuditProjection, projectId = 'project-alpha'): string {
    const auditRunId = projection.revalidationProof?.auditRunId || `AUD-${Date.now()}`;
    const projectAuditsDir = path.join(this.auditsDir, projectId);

    if (!fs.existsSync(projectAuditsDir)) {
      fs.mkdirSync(projectAuditsDir, { recursive: true });
    }

    const filePath = path.join(projectAuditsDir, `${auditRunId}.json`);
    const envelope = {
      projectId,
      auditRunId,
      executedAt: projection.revalidationProof?.verifiedAt || new Date().toISOString(),
      projection
    };

    const content = JSON.stringify(envelope, null, 2);
    const fd = fs.openSync(filePath, 'w');
    try {
      fs.writeFileSync(fd, content, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    return auditRunId;
  }

  /**
   * Projeta a lista de resumos de histórico de auditoria LENDO EXCLUSIVAMENTE ARQUIVOS REAIS DO DISCO.
   * Se não houver arquivos gravados, retorna []. ZERO DADOS SINTÉTICOS HARDCODED.
   */
  public getAuditHistorySummaries(projectId?: string): AuditHistorySummaryDTO[] {
    const summaries: AuditHistorySummaryDTO[] = [];

    if (!fs.existsSync(this.auditsDir)) {
      return summaries;
    }

    const projectFolders = fs.readdirSync(this.auditsDir);

    for (const folderName of projectFolders) {
      const folderPath = path.join(this.auditsDir, folderName);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      if (projectId && projectId !== 'ALL' && folderName !== projectId) {
        continue;
      }

      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
          const envelope = JSON.parse(content);
          const proj: CausalRemediationAuditProjection = envelope.projection;

          if (!proj) continue;

          const isResolved = proj.revalidationProof?.isResolved ?? false;
          const totalFindings = proj.finding ? 1 : 0;
          const totalActionsProposed = proj.proposedActionPlan ? 1 : 0;
          const totalActionsExecuted = proj.approvalRecord?.decision === 'APPROVED' ? 1 : 0;
          const totalRevalidated = proj.revalidationProof ? 1 : 0;
          const remaining = isResolved ? 0 : totalFindings;

          summaries.push({
            auditRunId: envelope.auditRunId || proj.revalidationProof?.auditRunId || path.basename(file, '.json'),
            projectId: envelope.projectId || folderName,
            targetPath: folderName,
            executedAt: envelope.executedAt || proj.sourceSnapshot.observedAt,
            status: isResolved ? 'RESOLVED' : 'BLOCKED',
            totalFindings,
            totalActionsProposed,
            totalActionsExecuted,
            totalRevalidated,
            remainingFindingsCount: remaining,
            repositoryTreeHash: proj.sourceSnapshot.treeHash
          });
        } catch {
          // Ignora arquivos corrompidos na varredura da projeção
        }
      }
    }

    return summaries.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
  }

  /**
   * Projeta o detalhe completo da timeline causal LENDO DIRETO DO DISCO,
   * aplicando validação estrita de isolamento por projectId (Defesa IDOR).
   */
  public getAuditTimelineDetail(auditRunId: string, projectId?: string): CausalRemediationAuditProjection | null {
    if (!fs.existsSync(this.auditsDir)) {
      return null;
    }

    const projectFolders = fs.readdirSync(this.auditsDir);

    for (const folderName of projectFolders) {
      const folderPath = path.join(this.auditsDir, folderName);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        if (file.includes(auditRunId) || file === `${auditRunId}.json`) {
          try {
            const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
            const envelope = JSON.parse(content);

            const fileProjectId = envelope.projectId || folderName;

            // DEFESA ESTRUTURAL IDOR: Validação no Servidor
            if (projectId && projectId !== 'ALL' && fileProjectId !== projectId) {
              throw new Error(`SECURITY_VIOLATION_PROJECT_ISOLATION: O AuditRun '${auditRunId}' pertence ao projeto '${fileProjectId}', acesso negado para '${projectId}'.`);
            }

            return envelope.projection as CausalRemediationAuditProjection;
          } catch (err: any) {
            if (err.message?.includes('SECURITY_VIOLATION_PROJECT_ISOLATION')) {
              throw err;
            }
          }
        }
      }
    }

    return null;
  }
}
