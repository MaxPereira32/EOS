import { AuditHistoryRepository } from '../../core/storage/audit-history-repository';
import { RepositoryIdentityRegistry } from '../../core/services/repository-identity-registry';

const targetDir = process.argv[2];
const projectId = process.argv[3];
const auditRunId = process.argv[4];

RepositoryIdentityRegistry.registerProject({
  projectId,
  repositoryRoot: process.cwd(),
  canonicalName: 'Worker Project'
});

const repository = new AuditHistoryRepository(targetDir);

const sourceSnapshot = {
  snapshotId: `snap-worker-${process.pid}`,
  repositoryRoot: process.cwd(),
  commitHash: 'head',
  branchName: 'main',
  observedAt: new Date().toISOString(),
  treeHash: 'tree-worker'
};

try {
  const artifact = repository.saveAuditArtifact(
    auditRunId,
    projectId,
    sourceSnapshot,
    [],
    [],
    []
  );
  if (process.send) {
    process.send({ success: true, artifactHash: artifact.artifactHash, pid: process.pid });
  }
} catch (err: any) {
  if (process.send) {
    process.send({ success: false, error: err.message, pid: process.pid });
  }
}
