/**
 * EOS CORE STORAGE — AUDIT HISTORY REPOSITORY
 * Materializes and retrieves real AuditArtifact objects from disk
 * (.eos/projects/{projectId}/audits/{auditRunId}.json).
 * Computes deterministic artifactHash using JCS RFC 8785 canonical hash.
 * ZERO MOCK POLICY: Sovereign disk persistence of primary domain entities.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SourceSnapshot } from '../domain/causal-pipeline-contracts';
import { Finding, Evidence, Fact } from '../domain/types';
import { ActionPlan } from '../domain/action-plan';
import { ApprovalRecord } from '../domain/approval-record';
import { AgentRuntimeSnapshot } from '../domain/agent-runtime-snapshot';
import { canonicalHash } from '../utils/canonical-json';

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
  
  // Entidades Primárias do Domínio (Fonte Soberana de Verdade)
  readonly sourceSnapshot: SourceSnapshot;
  readonly evidences: readonly Evidence[];
  readonly facts: readonly Fact[];
  readonly finding: Finding;
  readonly proposedActionPlan?: ActionPlan;
  readonly approvalRecord?: ApprovalRecord;
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

export class AuditHistoryRepository {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(process.cwd(), '.eos');
  }

  private getProjectAuditDir(projectId: string): string {
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
    finding: Finding,
    proposedActionPlan?: ActionPlan,
    approvalRecord?: ApprovalRecord,
    afterSourceSnapshot?: SourceSnapshot,
    revalidationProof?: { proofId: string; auditRunId: string; isResolved: boolean; remainingFindingIds: readonly string[]; verifiedAt: string },
    runtimeSnapshot?: AgentRuntimeSnapshot,
    parentArtifactId?: string,
    parentArtifactHash?: string
  ): AuditArtifact {
    if (!auditRunId || !projectId) {
      throw new Error('AUDIT_REPOSITORY_ERROR: auditRunId e projectId são obrigatórios.');
    }

    const artifactId = `art-${auditRunId}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const sourceSnapshotHash = sourceSnapshot.snapshotId || 'unknown-snapshot';

    // Content payload without artifactHash for deterministic JCS canonicalization
    const payloadToCanonicalize = {
      artifactId,
      schemaVersion: 1,
      auditRunId,
      projectId,
      createdAt,
      sourceSnapshotHash,
      parentArtifactId: parentArtifactId || null,
      parentArtifactHash: parentArtifactHash || null,
      sourceSnapshot,
      evidences,
      facts,
      finding,
      proposedActionPlan: proposedActionPlan || null,
      approvalRecord: approvalRecord || null,
      afterSourceSnapshot: afterSourceSnapshot || null,
      revalidationProof: revalidationProof || null,
      runtimeSnapshot: runtimeSnapshot || null
    };

    const artifactHash = canonicalHash(payloadToCanonicalize);

    const artifact: AuditArtifact = {
      ...payloadToCanonicalize,
      parentArtifactId: parentArtifactId || undefined,
      parentArtifactHash: parentArtifactHash || undefined,
      proposedActionPlan: proposedActionPlan || undefined,
      approvalRecord: approvalRecord || undefined,
      afterSourceSnapshot: afterSourceSnapshot || undefined,
      revalidationProof: revalidationProof || undefined,
      runtimeSnapshot: runtimeSnapshot || undefined,
      artifactHash
    };

    const dir = this.getProjectAuditDir(projectId);
    const filePath = path.join(dir, `${auditRunId}.json`);

    fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), 'utf8');

    // Ensure fsync for storage durability
    const fd = fs.openSync(filePath, 'r+');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    return artifact;
  }

  public getAuditArtifact(projectId: string, auditRunId: string): AuditArtifact | null {
    const safeProjectId = path.basename(projectId);
    const safeAuditRunId = path.basename(auditRunId);
    const filePath = path.join(this.baseDir, 'projects', safeProjectId, 'audits', `${safeAuditRunId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const artifact = JSON.parse(content) as AuditArtifact;
      
      // Verify JCS RFC 8785 artifactHash integrity
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
          finding: artifact.finding,
          proposedActionPlan: artifact.proposedActionPlan || null,
          approvalRecord: artifact.approvalRecord || null,
          afterSourceSnapshot: artifact.afterSourceSnapshot || null,
          revalidationProof: artifact.revalidationProof || null,
          runtimeSnapshot: artifact.runtimeSnapshot || null
        };

        const recomputed = canonicalHash(payloadToVerify);
        if (recomputed !== artifact.artifactHash) {
          throw new Error(`AUDIT_STORAGE_INTEGRITY_VIOLATION: O hash canônico JCS do artefato '${auditRunId}' teve seu conteúdo adulterado no disco! (Esperado ${artifact.artifactHash}, calculado ${recomputed})`);
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

  public listAuditArtifacts(projectId: string): readonly AuditArtifact[] {
    const safeProjectId = path.basename(projectId);
    const dir = path.join(this.baseDir, 'projects', safeProjectId, 'audits');

    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const artifacts: AuditArtifact[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const parsed = JSON.parse(content) as AuditArtifact;
        if (parsed && parsed.auditRunId) {
          artifacts.push(parsed);
        }
      } catch {
        // Skip corrupted entries
      }
    }

    return artifacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public deleteAuditRun(projectId: string, auditRunId: string): boolean {
    const safeProjectId = path.basename(projectId);
    const safeAuditRunId = path.basename(auditRunId);
    const filePath = path.join(this.baseDir, 'projects', safeProjectId, 'audits', `${safeAuditRunId}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}
