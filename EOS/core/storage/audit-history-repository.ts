/**
 * EOS CORE STORAGE — AUDIT HISTORY REPOSITORY
 * Materializes and retrieves real AuditArtifact objects from disk
 * (.eos/projects/{projectId}/audits/{auditRunId}.json).
 * Computes deterministic artifactHash (SHA-256) for audit integrity.
 * ZERO MOCK POLICY: Pure disk persistence.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CausalRemediationAuditProjection } from '../domain/causal-pipeline-contracts';
import { AgentRuntimeSnapshot } from '../domain/agent-runtime-snapshot';

export interface AuditArtifact {
  readonly artifactId: string;
  readonly schemaVersion: number;
  readonly auditRunId: string;
  readonly projectId: string;
  readonly createdAt: string;
  readonly sourceSnapshotHash: string;
  readonly artifactHash: string;
  readonly parentArtifactId?: string;
  readonly projection: CausalRemediationAuditProjection;
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
    projection: CausalRemediationAuditProjection,
    runtimeSnapshot?: AgentRuntimeSnapshot,
    parentArtifactId?: string
  ): AuditArtifact {
    if (!auditRunId || !projectId) {
      throw new Error('AUDIT_REPOSITORY_ERROR: auditRunId e projectId são obrigatórios.');
    }

    const artifactId = `art-${auditRunId}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const sourceSnapshotHash = projection.sourceSnapshot?.snapshotId || 'unknown-snapshot';

    // Content payload without hash to derive artifactHash
    const contentPayload = {
      artifactId,
      schemaVersion: 1,
      auditRunId,
      projectId,
      createdAt,
      sourceSnapshotHash,
      parentArtifactId,
      projection,
      runtimeSnapshot
    };

    const artifactHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(contentPayload))
      .digest('hex');

    const artifact: AuditArtifact = {
      ...contentPayload,
      artifactHash
    };

    const dir = this.getProjectAuditDir(projectId);
    const filePath = path.join(dir, `${auditRunId}.json`);

    const payload = JSON.stringify(artifact, null, 2);
    fs.writeFileSync(filePath, payload, 'utf8');

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
      
      // Verify artifactHash integrity
      if (artifact && artifact.artifactHash) {
        const { artifactHash, ...payload } = artifact as any;
        const recomputed = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
        if (recomputed !== artifactHash) {
          throw new Error(`AUDIT_STORAGE_INTEGRITY_VIOLATION: O artefato de auditoria '${auditRunId}' teve o hash corrompido ou adulterado no disco!`);
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
