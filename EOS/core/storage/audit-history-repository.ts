/**
 * EOS CORE STORAGE — AUDIT HISTORY REPOSITORY (v3.1.1 SOVEREIGN)
 * Materializes and retrieves real AuditArtifact objects from disk
 * (.eos/projects/{projectId}/audits/{auditRunId}.json).
 * 
 * OS KERNEL ATOMIC IMMUTABILITY POLICY: Uses fs.openSync(finalFilePath, 'wx') for atomic OS lock.
 * CANONICAL HASH: Uses CanonicalHashService (JCS RFC 8785 SHA-256).
 * STRICT LINEAGE: Enforces parentArtifactHash matching parent artifact on disk.
 * STRICT IMMUTABILITY: Rejects overwriting existing artifacts AND excludes deletion methods (No deleteAuditRun).
 * STRICT SCHEMA: Demands plural findings: readonly Finding[]. Legacy migration isolated in AuditArtifactMigrator.
 * TRANSPARENT INTEGRITY: Querying artifacts exposes corrupted files explicitly (listAuditArtifacts).
 */

import * as fs from 'fs';
import * as path from 'path';
import { SourceSnapshot, ExecutionJournal } from '../domain/causal-pipeline-contracts';
import { Finding, Evidence, Fact } from '../domain/types';
import { ActionPlan } from '../domain/action-plan';
import { ApprovalRecord } from '../domain/approval-record';
import { AgentRuntimeSnapshot } from '../domain/agent-runtime-snapshot';
import { CanonicalHashService } from '../services/canonical-hash-service';
import { AuditArtifactMigrator } from './audit-artifact-migrator';

export interface AuditArtifact {
  readonly artifactId: string;
  readonly schemaVersion: number;
  readonly auditRunId: string;
  readonly projectId: string;
  readonly createdAt: string;
  readonly sourceSnapshotHash: string;
  readonly artifactHash: string; // JCS RFC 8785 SHA-256 Digest
  readonly parentArtifactId?: string;
  readonly parentArtifactHash?: string;
  
  // Entidades Primárias do Domínio (Fonte Soberana de Verdade com Findings Plurais)
  readonly sourceSnapshot: SourceSnapshot;
  readonly evidences: readonly Evidence[];
  readonly facts: readonly Fact[];
  readonly findings: readonly Finding[]; // Array Plural Estrito (Zero Mocks Sintéticos e Sem Fallbacks Implícitos)
  readonly proposedActionPlan?: ActionPlan;
  readonly approvalRecord?: ApprovalRecord;
  readonly executionJournal?: ExecutionJournal; // Distinção Causal entre Aprovação e Execução
  readonly afterSourceSnapshot?: SourceSnapshot;
  readonly revalidationProof?: {
    readonly proofId: string;
    readonly auditRunId: string;
    readonly isResolved: boolean;
    readonly remainingFindingIds: readonly string[];
    readonly verifiedAt: string;
  };
  readonly runtimeSnapshot?: AgentRuntimeSnapshot;
}

export interface AuditArtifactQueryResult {
  readonly artifacts: readonly AuditArtifact[];
  readonly corruptedCount: number;
  readonly corruptedArtifacts: readonly string[];
  readonly integrityStatus: 'VALID' | 'DEGRADED_HAS_CORRUPTED';
}

export class AuditHistoryRepository {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(process.cwd(), '.eos');
  }

  private getProjectAuditDir(projectId: string): string {
    if (!projectId) {
      throw new Error('AUDIT_REPOSITORY_ERROR: projectId é obrigatório.');
    }
    const safeProjectId = path.basename(projectId);
    const dir = path.join(this.baseDir, 'projects', safeProjectId, 'audits');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public saveAuditArtifact(
    auditRunId: string,
    projectId: string,
    sourceSnapshot: SourceSnapshot,
    evidences: readonly Evidence[],
    facts: readonly Fact[],
    findings: readonly Finding[], // Array Plural Estrito
    proposedActionPlan?: ActionPlan,
    approvalRecord?: ApprovalRecord,
    afterSourceSnapshot?: SourceSnapshot,
    revalidationProof?: { proofId: string; auditRunId: string; isResolved: boolean; remainingFindingIds: readonly string[]; verifiedAt: string },
    runtimeSnapshot?: AgentRuntimeSnapshot,
    parentArtifactId?: string,
    parentArtifactHash?: string,
    executionJournal?: ExecutionJournal
  ): AuditArtifact {
    if (!auditRunId || !projectId) {
      throw new Error('AUDIT_REPOSITORY_ERROR: auditRunId e projectId são obrigatórios.');
    }

    if (!Array.isArray(findings)) {
      throw new Error('AUDIT_REPOSITORY_ERROR: findings deve ser um array plural de Finding (findings: readonly Finding[]).');
    }

    // Validação estrita de linhagem causal: parentArtifactHash é OBRIGATÓRIO se parentArtifactId estiver presente
    if (parentArtifactId && !parentArtifactHash) {
      throw new Error('AUDIT_LINEAGE_VIOLATION: parentArtifactHash é obrigatório quando parentArtifactId é fornecido.');
    }

    if (parentArtifactId && parentArtifactHash) {
      const parentArtifact = this.getAuditArtifact(projectId, parentArtifactId);
      if (!parentArtifact) {
        throw new Error(`AUDIT_LINEAGE_VIOLATION: Artefato pai '${parentArtifactId}' não foi encontrado no projeto '${projectId}'.`);
      }
      if (parentArtifact.artifactHash !== parentArtifactHash) {
        throw new Error(`AUDIT_LINEAGE_VIOLATION: Hash do artefato pai retornado (${parentArtifact.artifactHash}) difere do parentArtifactHash esperado (${parentArtifactHash}).`);
      }
    }

    const artifactId = `art-${auditRunId}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const sourceSnapshotHash = sourceSnapshot?.snapshotId || 'unknown-snapshot';

    // Payload sem artifactHash para canonicalização determinística JCS RFC 8785
    const payloadToCanonicalize = {
      artifactId,
      schemaVersion: 2,
      auditRunId,
      projectId,
      createdAt,
      sourceSnapshotHash,
      parentArtifactId: parentArtifactId || null,
      parentArtifactHash: parentArtifactHash || null,
      sourceSnapshot,
      evidences,
      facts,
      findings,
      proposedActionPlan: proposedActionPlan || null,
      approvalRecord: approvalRecord || null,
      executionJournal: executionJournal || null,
      afterSourceSnapshot: afterSourceSnapshot || null,
      revalidationProof: revalidationProof || null,
      runtimeSnapshot: runtimeSnapshot || null
    };

    const artifactHash = CanonicalHashService.hash(payloadToCanonicalize);

    const artifact: AuditArtifact = {
      ...payloadToCanonicalize,
      parentArtifactId: parentArtifactId || undefined,
      parentArtifactHash: parentArtifactHash || undefined,
      proposedActionPlan: proposedActionPlan || undefined,
      approvalRecord: approvalRecord || undefined,
      executionJournal: executionJournal || undefined,
      afterSourceSnapshot: afterSourceSnapshot || undefined,
      revalidationProof: revalidationProof || undefined,
      runtimeSnapshot: runtimeSnapshot || undefined,
      artifactHash
    };

    const dir = this.getProjectAuditDir(projectId);
    const finalFilePath = path.join(dir, `${auditRunId}.json`);

    // TRAVAMENTO ATÔMICO NO KERNEL DO SO (O_CREAT | O_EXCL / 'wx'):
    // Impede TOCTOU e garante concorrência segura entre múltiplos processos Node independentes.
    let fd: number;
    try {
      fd = fs.openSync(finalFilePath, 'wx');
    } catch (err: any) {
      if (err.code === 'EEXIST' || fs.existsSync(finalFilePath)) {
        throw new Error(`AUDIT_IMMUTABILITY_VIOLATION: O AuditArtifact '${auditRunId}' já existe no disco e é imutável! Crie um novo AuditArtifact encadeado por parentArtifactId.`);
      }
      throw err;
    }

    try {
      const content = JSON.stringify(artifact, null, 2);
      fs.writeFileSync(fd, content, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    return artifact;
  }

  public getAuditArtifact(projectId: string, auditRunOrArtifactId: string): AuditArtifact | null {
    if (!projectId || !auditRunOrArtifactId) {
      throw new Error('AUDIT_REPOSITORY_ERROR: projectId e auditRunOrArtifactId são obrigatórios.');
    }
    const safeProjectId = path.basename(projectId);
    const safeId = path.basename(auditRunOrArtifactId);
    let filePath = path.join(this.baseDir, 'projects', safeProjectId, 'audits', `${safeId}.json`);

    if (!fs.existsSync(filePath)) {
      // Fallback: busca por artifactId varrendo a pasta do projeto se safeId for um artifactId
      const dir = path.join(this.baseDir, 'projects', safeProjectId, 'audits');
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
            if (raw.artifactId === auditRunOrArtifactId || raw.auditRunId === auditRunOrArtifactId) {
              filePath = path.join(dir, file);
              break;
            }
          } catch {}
        }
      }
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const raw = JSON.parse(content);
      
      // Aplicar Migração de Schema de forma isolada
      const artifact = AuditArtifactMigrator.migrate(raw);

      // Validação de Integridade do Hash Canônico JCS RFC 8785 (estritamente sobre findings)
      if (artifact && artifact.artifactHash) {
        const payloadToVerify = {
          artifactId: artifact.artifactId,
          schemaVersion: artifact.schemaVersion,
          auditRunId: artifact.auditRunId,
          projectId: artifact.projectId,
          createdAt: artifact.createdAt,
          sourceSnapshotHash: artifact.sourceSnapshotHash,
          parentArtifactId: artifact.parentArtifactId || null,
          parentArtifactHash: artifact.parentArtifactHash || null,
          sourceSnapshot: artifact.sourceSnapshot,
          evidences: artifact.evidences,
          facts: artifact.facts,
          findings: artifact.findings,
          proposedActionPlan: artifact.proposedActionPlan || null,
          approvalRecord: artifact.approvalRecord || null,
          executionJournal: artifact.executionJournal || null,
          afterSourceSnapshot: artifact.afterSourceSnapshot || null,
          revalidationProof: artifact.revalidationProof || null,
          runtimeSnapshot: artifact.runtimeSnapshot || null
        };

        const recomputed = CanonicalHashService.hash(payloadToVerify);
        if (recomputed !== artifact.artifactHash) {
          throw new Error(`AUDIT_STORAGE_INTEGRITY_VIOLATION: O hash canônico JCS do artefato '${auditRunOrArtifactId}' teve seu conteúdo adulterado no disco! (Esperado ${artifact.artifactHash}, calculado ${recomputed})`);
        }
      }

      return artifact;
    } catch (err: any) {
      if (err.message?.includes('AUDIT_STORAGE_INTEGRITY_VIOLATION')) {
        throw err;
      }
      return null;
    }
  }

  public listAuditArtifacts(projectId: string): AuditArtifactQueryResult {
    if (!projectId) {
      throw new Error('AUDIT_REPOSITORY_ERROR: projectId é obrigatório.');
    }
    const safeProjectId = path.basename(projectId);
    const dir = path.join(this.baseDir, 'projects', safeProjectId, 'audits');

    if (!fs.existsSync(dir)) {
      return {
        artifacts: [],
        corruptedCount: 0,
        corruptedArtifacts: [],
        integrityStatus: 'VALID'
      };
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const artifacts: AuditArtifact[] = [];
    const corruptedArtifacts: string[] = [];

    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const raw = JSON.parse(content);
        const artifact = AuditArtifactMigrator.migrate(raw);

        // Valida hash canônico
        const payloadToVerify = {
          artifactId: artifact.artifactId,
          schemaVersion: artifact.schemaVersion,
          auditRunId: artifact.auditRunId,
          projectId: artifact.projectId,
          createdAt: artifact.createdAt,
          sourceSnapshotHash: artifact.sourceSnapshotHash,
          parentArtifactId: artifact.parentArtifactId || null,
          parentArtifactHash: artifact.parentArtifactHash || null,
          sourceSnapshot: artifact.sourceSnapshot,
          evidences: artifact.evidences,
          facts: artifact.facts,
          findings: artifact.findings,
          proposedActionPlan: artifact.proposedActionPlan || null,
          approvalRecord: artifact.approvalRecord || null,
          executionJournal: artifact.executionJournal || null,
          afterSourceSnapshot: artifact.afterSourceSnapshot || null,
          revalidationProof: artifact.revalidationProof || null,
          runtimeSnapshot: artifact.runtimeSnapshot || null
        };

        const recomputed = CanonicalHashService.hash(payloadToVerify);
        if (recomputed !== artifact.artifactHash) {
          corruptedArtifacts.push(file);
          continue;
        }

        artifacts.push(artifact);
      } catch {
        corruptedArtifacts.push(file);
      }
    }

    const sorted = artifacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      artifacts: sorted,
      corruptedCount: corruptedArtifacts.length,
      corruptedArtifacts,
      integrityStatus: corruptedArtifacts.length > 0 ? 'DEGRADED_HAS_CORRUPTED' : 'VALID'
    };
  }
}
