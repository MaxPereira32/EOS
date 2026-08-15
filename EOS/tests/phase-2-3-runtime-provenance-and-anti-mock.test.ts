import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fork } from 'child_process';
import { AuditHistoryRepository } from '../core/storage/audit-history-repository';
import { AuditHistoryProjectionService } from '../core/services/audit-history-projection-service';
import { McpPluginRegistry } from '../core/domain/mcp-plugin-registry';
import { EosPlatformV2, AuditExecutionContext } from '../core/eos-platform';
import { CanonicalHashService } from '../core/services/canonical-hash-service';
import { AuditArtifactMigrator } from '../core/storage/audit-artifact-migrator';
import { RepositoryIdentityRegistry } from '../core/services/repository-identity-registry';
import { Evidence, Finding } from '../core/domain/types';
import { ExecutionJournal } from '../core/domain/causal-pipeline-contracts';

test('EOS Phase 3.1.1 — Sovereign Causal Truth & Strict Closure Suite (v3.1.1)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp_causal_v311_'));
  const repository = new AuditHistoryRepository(tmpDir);
  const projectionService = new AuditHistoryProjectionService(tmpDir);

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    McpPluginRegistry.reset();
    RepositoryIdentityRegistry.reset();
  });

  const createCanonicalEvidence = (id: string): Evidence => ({
    evidence_id: id,
    observation_id: `obs-${id}`,
    collector_id: 'NIST Engine',
    source_reference: 'src/main.ts',
    locator: { relative_path: 'src/main.ts', line: 10 },
    source_hash: 'hash-src-123',
    content_hash: 'hash-content-456',
    snippet: 'const pass = true;',
    confidence: 1.0,
    provenance: { target_id: 'proj-omega', collector_version: '3.1.1' }
  });

  const createCanonicalFinding = (id: string, severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'): Finding => ({
    finding_id: id,
    rule_id: 'RULE-01',
    rule_version: '3.1.1',
    fact_ids: ['fct-01'],
    evidence_ids: ['ev-1'],
    target_id: 'proj-omega',
    location: 'src/main.ts:10',
    title: 'Security Finding',
    description: 'Security Finding Description',
    severity,
    confidence: 1.0,
    status: 'OPEN',
    timestamp: new Date().toISOString()
  });

  await t.test('1. ZERO SYNTHETIC EVIDENCE (NO_FABRICATED_FINDINGS & NO_SYNTHETIC_EVIDENCE) — Clean run strictly returns []', async () => {
    RepositoryIdentityRegistry.registerProject({
      projectId: 'proj-omega',
      repositoryRoot: process.cwd(),
      canonicalName: 'Project Omega Repository'
    });

    const platform = new EosPlatformV2(tmpDir);
    const context: AuditExecutionContext = {
      contextId: 'ctx-clean-1',
      projectId: 'proj-omega',
      repositoryRoot: process.cwd(),
      assets: [],
      sourceSnapshot: {
        snapshotId: 'snap-clean-1',
        repositoryRoot: process.cwd(),
        commitHash: 'head',
        branchName: 'main',
        observedAt: new Date().toISOString(),
        treeHash: 'tree-clean-1'
      },
      runtimeSnapshot: {
        runtimeSnapshotId: 'snap-rt-clean',
        timestamp: new Date().toISOString(),
        agentDefinitionId: 'agent-orch-01',
        agentRole: 'Orchestrator',
        agentVersion: '3.1.1',
        promptVersion: '1.0.0',
        promptHash: 'p-hash',
        contextPolicyHash: 'c-hash',
        modelConfigurationHash: 'm-hash',
        skills: [],
        plugins: [],
        mcpServers: [],
        modelProvider: 'OPENAI',
        modelName: 'gpt-4o'
      }
    };

    const artifact = await platform.runPipeline(context);
    assert.strictEqual(artifact.findings.length, 0, 'VIOLATION: NO_FABRICATED_FINDINGS falhou.');
    
    const artifactPath = path.join(tmpDir, 'projects', 'proj-omega', 'audits', `${artifact.auditRunId}.json`);
    const rawDiskContent = fs.readFileSync(artifactPath, 'utf8');

    assert.strictEqual(rawDiskContent.includes('ev-pass'), false, 'VIOLATION: NO_SYNTHETIC_EVIDENCE falhou.');
    assert.strictEqual(rawDiskContent.includes('RULE-PASS'), false, 'VIOLATION: NO_SYNTHETIC_EVIDENCE falhou.');
  });

  await t.test('2. JCS RFC 8785 EDGE CASES (JCS_EDGE_CASES, JCS_INVALID_VALUES, JCS_DETERMINISM, JCS_UNICODE_AND_ESCAPING, JCS_NUMBER_SERIALIZATION)', () => {
    // JCS_DETERMINISM & JCS_UNICODE_AND_ESCAPING
    const canonicalStr1 = CanonicalHashService.stringify({ z_field: 'last', a_field: 'first' });
    const canonicalStr2 = CanonicalHashService.stringify({ a_field: 'first', z_field: 'last' });
    assert.strictEqual(canonicalStr1, canonicalStr2, 'JCS_DETERMINISM failed.');
    assert.strictEqual(canonicalStr1.indexOf('"a_field"'), 1, 'JCS_UNICODE_AND_ESCAPING failed.');

    // JCS_NUMBER_SERIALIZATION & JCS_EDGE_CASES
    const vector1 = CanonicalHashService.stringify({ n: 1e5, s: "hello\nworld", u: "🚀" });
    const vector2 = CanonicalHashService.stringify({ n: 100000, s: "hello\nworld", u: "🚀" });
    assert.strictEqual(vector1, vector2, 'JCS_NUMBER_SERIALIZATION failed.');

    // JCS_INVALID_VALUES
    assert.throws(() => CanonicalHashService.stringify({ invalid: NaN }), /JCS_RFC_8785_ERROR/);
    assert.throws(() => CanonicalHashService.stringify({ invalid: Infinity }), /JCS_RFC_8785_ERROR/);
  });

  await t.test('3. REPOSITORY IDENTITY REGISTRY (IDENTITY_REGISTRY_PROTECTION, UNREGISTERED_DENY, ROOT_MISMATCH_DENY, MISSING_PROJECT_ID_MUST_FAIL)', () => {
    RepositoryIdentityRegistry.reset();

    // MISSING_PROJECT_ID_MUST_FAIL
    assert.throws(() => RepositoryIdentityRegistry.validateProjectRepository('', process.cwd()), /SECURITY_VIOLATION_INVALID_PROJECT_ID/);
    
    // MISSING_PROJECT_ID_MUST_FAIL (Repository Level Storage)
    const repo = new AuditHistoryRepository(tmpDir);
    assert.throws(() => repo.getAuditArtifact('', 'some-run-id'), /AUDIT_REPOSITORY_ERROR/);
    assert.throws(() => repo.saveAuditArtifact('run-1', '', {} as any, [], [], []), /AUDIT_REPOSITORY_ERROR/);

    // UNREGISTERED_DENY
    assert.throws(() => RepositoryIdentityRegistry.validateProjectRepository('unregistered-proj', process.cwd()), /SECURITY_VIOLATION_UNREGISTERED_PROJECT/);

    // IDENTITY_REGISTRY_PROTECTION
    RepositoryIdentityRegistry.registerProject({
      projectId: 'strict-proj',
      repositoryRoot: process.cwd(),
      canonicalName: 'Strict Proj'
    });

    assert.throws(() => RepositoryIdentityRegistry.registerProject({
      projectId: 'strict-proj',
      repositoryRoot: process.cwd(),
      canonicalName: 'Override'
    }), /SECURITY_VIOLATION_PROJECT_OVERWRITE/);

    assert.throws(() => RepositoryIdentityRegistry.registerProject({
      projectId: 'invalid-proj',
      repositoryRoot: path.join(process.cwd(), 'does-not-exist'),
      canonicalName: 'Invalid'
    }), /SECURITY_VIOLATION_INVALID_ROOT/);

    // ROOT_MISMATCH_DENY
    assert.throws(() => RepositoryIdentityRegistry.validateProjectRepository('strict-proj', path.join(process.cwd(), 'unauthorized')), /SECURITY_VIOLATION_REPOSITORY_IDENTITY_MISMATCH/);
    assert.doesNotThrow(() => RepositoryIdentityRegistry.validateProjectRepository('strict-proj', process.cwd()));
  });

  await t.test('4. MIGRATOR SEMANTICS (MIGRATOR_EXPLICIT_EMPTY, MIGRATOR_SINGLE_FINDING, MIGRATOR_UNKNOWN_SEMANTICS, MIGRATOR_CAUSAL_PRESERVATION)', () => {
    // V3_SINGLE_FINDING_REJECTED (if passed as v2)
    assert.throws(() => AuditArtifactMigrator.migrate({ schemaVersion: 2, finding: {} }), /AUDIT_MIGRATOR_ERROR/);

    // MIGRATOR_SINGLE_FINDING
    const migratedSingle = AuditArtifactMigrator.migrate({ schemaVersion: 1, finding: { id: 'f-1' } });
    assert.deepStrictEqual(migratedSingle.findings, [{ id: 'f-1' }]);

    // MIGRATOR_EXPLICIT_EMPTY
    const migratedEmpty = AuditArtifactMigrator.migrate({ schemaVersion: 1, finding: null });
    assert.deepStrictEqual(migratedEmpty.findings, []);

    // MIGRATOR_UNKNOWN_SEMANTICS
    assert.throws(() => AuditArtifactMigrator.migrate({ schemaVersion: 1 }), /AUDIT_MIGRATOR_CAUSAL_ERROR/);
    assert.throws(() => AuditArtifactMigrator.migrate({ schemaVersion: 1, findings: [] }), /AUDIT_MIGRATOR_ERROR: Artefato V1 não deve possuir/);
  });

  await t.test('5. IMMUTABILITY DOMAIN (NO_DELETE_DOMAIN, IMMUTABLE_SAME_ID, ARTIFACT_TAMPERING, CORRUPTED_ARTIFACT_VISIBLE)', () => {
    // NO_DELETE_DOMAIN
    assert.strictEqual((repository as any).deleteAuditRun, undefined);

    RepositoryIdentityRegistry.registerProject({
      projectId: 'proj-immut',
      repositoryRoot: process.cwd(),
      canonicalName: 'Immut Proj'
    });

    const snap = { snapshotId: 'snap-1', repositoryRoot: process.cwd(), commitHash: 'head', branchName: 'main', observedAt: new Date().toISOString(), treeHash: 'tree' };
    repository.saveAuditArtifact('AUD-IMMUT-1', 'proj-immut', snap, [], [], []);

    // IMMUTABLE_SAME_ID (EEXIST domain mapping)
    assert.throws(() => repository.saveAuditArtifact('AUD-IMMUT-1', 'proj-immut', snap, [], [], []), /AUDIT_IMMUTABILITY_VIOLATION/);

    // ARTIFACT_TAMPERING & CORRUPTED_ARTIFACT_VISIBLE
    const filePath = path.join(tmpDir, 'projects', 'proj-immut', 'audits', 'AUD-IMMUT-1.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.sourceSnapshotHash = 'TAMPERED_HASH';
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');

    const result = repository.listAuditArtifacts('proj-immut');
    assert.strictEqual(result.integrityStatus, 'DEGRADED_HAS_CORRUPTED');
    assert.strictEqual(result.corruptedCount, 1);
  });

  await t.test('6. EXECUTION ACCOUNTING (EXECUTION_ACCOUNTING)', () => {
    RepositoryIdentityRegistry.registerProject({ projectId: 'proj-exec', repositoryRoot: process.cwd(), canonicalName: 'Exec' });
    const snap = { snapshotId: 'snap-1', repositoryRoot: process.cwd(), commitHash: 'head', branchName: 'main', observedAt: new Date().toISOString(), treeHash: 'tree' };

    repository.saveAuditArtifact('AUD-APP-ONLY', 'proj-exec', snap, [], [], [], undefined, {
      approvalId: 'app-01', planId: 'plan-01', approvedPlanHash: 'hash-01', approvedBy: 'admin', approvedAt: new Date().toISOString(), decision: 'APPROVED', signature: 'sig'
    });

    const summaryAppOnly = projectionService.getAuditHistorySummaries('proj-exec').find(s => s.auditRunId === 'AUD-APP-ONLY');
    assert.strictEqual(summaryAppOnly?.totalActionsExecuted, 0);

    const execJournal: ExecutionJournal = { executionId: 'exec-01', planId: 'plan-01', executedAt: new Date().toISOString(), executedBy: 'runner', status: 'SUCCESS', executionHash: 'hash' };
    repository.saveAuditArtifact('AUD-EXEC-REAL', 'proj-exec', snap, [], [], [], undefined, undefined, undefined, undefined, undefined, undefined, undefined, execJournal);

    const summaryExecReal = projectionService.getAuditHistorySummaries('proj-exec').find(s => s.auditRunId === 'AUD-EXEC-REAL');
    assert.strictEqual(summaryExecReal?.totalActionsExecuted, 1);
  });

  await t.test('7. CONCURRENCY (STRESS_CONCURRENCY_CAUSALITY)', async () => {
    RepositoryIdentityRegistry.registerProject({ projectId: 'proj-fork', repositoryRoot: process.cwd(), canonicalName: 'Fork' });
    const workerScript = path.join(process.cwd(), 'EOS/tests/workers/multi-process-write-worker.ts');

    const spawnWorker = (auditRunId: string) => new Promise<{ success: boolean; error?: string; pid?: number }>((resolve) => {
      const child = fork(workerScript, [tmpDir, 'proj-fork', auditRunId], { execArgv: ['--import', 'tsx'] });
      child.on('message', (msg: any) => resolve(msg));
      child.on('error', (err) => resolve({ success: false, error: err.message }));
    });

    for (let i = 0; i < 10; i++) {
      const auditRunId = `AUD-CONC-FORK-STRESS-${i}`;
      const [res1, res2] = await Promise.all([spawnWorker(auditRunId), spawnWorker(auditRunId)]);
      
      const successes = [res1, res2].filter(r => r.success);
      const failures = [res1, res2].filter(r => !r.success);

      assert.strictEqual(successes.length, 1, `CONCURRENCY_VIOLATION: Exactly 1 process should succeed! Loop ${i}`);
      assert.strictEqual(failures.length, 1, `CONCURRENCY_VIOLATION: Exactly 1 process should fail with Immutability error! Loop ${i}`);
      assert.ok(failures[0].error?.includes('AUDIT_IMMUTABILITY_VIOLATION'));
    }
  });
});
