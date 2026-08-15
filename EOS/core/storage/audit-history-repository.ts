/**
 * EOS CORE STORAGE — AUDIT HISTORY REPOSITORY
 * Materializes and retrieves real AuditRun, CausalRemediationAuditProjection and AgentRuntimeSnapshot
 * files from disk (.eos/projects/{projectId}/audits/{auditRunId}.json).
 * Zero Mocks, Zero Synthetic Data.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CausalRemediationAuditProjection } from '../domain/causal-pipeline-contracts';
import { AgentRuntimeSnapshot } from '../domain/agent-runtime-snapshot';

export interface PersistedAuditEntry {
  readonly auditRunId: string;
  readonly projectId: string;
  readonly timestamp: string;
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

  public saveAuditRun(entry: PersistedAuditEntry): void {
    if (!entry.auditRunId || !entry.projectId) {
      throw new Error('AUDIT_REPOSITORY_ERROR: auditRunId e projectId são obrigatórios.');
    }

    const dir = this.getProjectAuditDir(entry.projectId);
    const filePath = path.join(dir, `${entry.auditRunId}.json`);

    const payload = JSON.stringify(entry, null, 2);
    fs.writeFileSync(filePath, payload, 'utf8');

    // Ensure fsync for storage durability
    const fd = fs.openSync(filePath, 'r+');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  public getAuditRun(projectId: string, auditRunId: string): PersistedAuditEntry | null {
    const safeProjectId = path.basename(projectId);
    const safeAuditRunId = path.basename(auditRunId);
    const filePath = path.join(this.baseDir, 'projects', safeProjectId, 'audits', `${safeAuditRunId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as PersistedAuditEntry;
    } catch {
      return null;
    }
  }

  public listAuditRuns(projectId: string): readonly PersistedAuditEntry[] {
    const safeProjectId = path.basename(projectId);
    const dir = path.join(this.baseDir, 'projects', safeProjectId, 'audits');

    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const entries: PersistedAuditEntry[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const parsed = JSON.parse(content) as PersistedAuditEntry;
        if (parsed && parsed.auditRunId) {
          entries.push(parsed);
        }
      } catch {
        // Skip corrupted entries
      }
    }

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
