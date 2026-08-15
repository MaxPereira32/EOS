import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fork } from 'child_process';
import { AuditHistoryRepository } from '../core/storage/audit-history-repository';
import { AuditHistoryProjectionService } from '../core/services/audit-history-projection-service';
import { AgentRuntimeSnapshot } from '../core/domain/agent-runtime-snapshot';
import { McpPluginRegistry } from '../core/domain/mcp-plugin-registry';
import { EosPlatformV2, AuditExecutionContext } from '../core/eos-platform';
import { CanonicalHashService } from '../core/services/canonical-hash-service';
import { JsonAuditExporter } from '../core/reporters/json-audit-exporter';
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

  await t.test('1. PURE_REAL_EVIDENCE_TEST — Verify Clean Audit Runs Store Empty Findings Array Without Fabricating Mocks', async () => {
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
    assert.strictEqual(artifact.findings.length, 0, 'VIOLATION: Clean run deve conter array de findings vazio (findings: [])!');
    assert.strictEqual(artifact.revalidationProof?.isResolved, true);

    const jsonString = JSON.stringify(artifact);
    assert.strictEqual(jsonString.includes('ev-pass'), false, 'VIOLATION: Evidência sintética ev-pass detectada!');
    assert.strictEqual(jsonString.includes('RULE-PASS'), false, 'VIOLATION: Finding sintético RULE-PASS detectado!');
  });

  await t.test('2. JCS_RFC_8785_COMPLIANCE_SUITE — Verify UTF-16 Sorting, Number Canonicalization & NaN Rejection', () => {
    assert.strictEqual(CanonicalHashService.CANONICALIZATION_VERSION, 'JCS-RFC-8785');

    const uncanonicalObject = {
      z_field: 'last',
      a_field: 'first',
      num_field: 100,
      nested: {
        beta: 2,
        alpha: 1
      }
    };

    const canonicalStr1 = CanonicalHashService.stringify(uncanonicalObject);
    const canonicalStr2 = CanonicalHashService.stringify({
      num_field: 100,
      nested: { alpha: 1, beta: 2 },
      a_field: 'first',
      z_field: 'last'
    });

    assert.strictEqual(canonicalStr1, canonicalStr2, 'JCS_RFC_8785_VIOLATION: Serializações canônicas de objetos diferem!');
    assert.strictEqual(canonicalStr1.indexOf('"a_field"'), 1, 'JCS_RFC_8785_VIOLATION: A primeira chave deve ser a_field (ordenação lexicográfica UTF-16)!');

    // NaN e Infinity devem ser rejeitados estritamente conforme RFC 8785
    assert.throws(
      () => CanonicalHashService.stringify({ invalid: NaN }),
      /JCS_RFC_8785_ERROR/
    );
    assert.throws(
      () => CanonicalHashService.stringify({ invalid: Infinity }),
      /JCS_RFC_8785_ERROR/
    );
  });

  await t.test('3. REPOSITORY_IDENTITY_DENY_BY_DEFAULT_TEST — Reject Unregistered Projects and Root Mismatches', () => {
    RepositoryIdentityRegistry.reset();

    // 3a. Projeto não registrado -> DENY (SECURITY_VIOLATION_UNREGISTERED_PROJECT)
    assert.throws(
      () => RepositoryIdentityRegistry.validateProjectRepository('attacker-project', process.cwd()),
      /SECURITY_VIOLATION_UNREGISTERED_PROJECT/
    );

    // 3b. Registra projeto legítimo
    RepositoryIdentityRegistry.registerProject({
      projectId: 'strict-proj',
      repositoryRoot: process.cwd(),
      canonicalName: 'Strict Proj'
    });

    // Root correto -> ALLOW
    assert.doesNotThrow(() => {
      RepositoryIdentityRegistry.validateProjectRepository('strict-proj', process.cwd());
    });

    // Root incorreto -> DENY (SECURITY_VIOLATION_REPOSITORY_IDENTITY_MISMATCH)
    assert.throws(
      () => RepositoryIdentityRegistry.validateProjectRepository('strict-proj', path.join(process.cwd(), 'unauthorized')),
      /SECURITY_VIOLATION_REPOSITORY_IDENTITY_MISMATCH/
    );
  });

  await t.test('4. LEGACY_FINDING_MIGRATION_ISOLATION_TEST — Migrate Legacy Singular Finding Exclusively in AuditArtifactMigrator', () => {
    const legacyRaw = {
      artifactId: 'art-legacy-v1',
      schemaVersion: 1,
      auditRunId: 'AUD-LEGACY-01',
      projectId: 'proj-omega',
      createdAt: new Date().toISOString(),
      sourceSnapshotHash: 'snap-legacy',
      artifactHash: 'hash-legacy-123',
      finding: createCanonicalFinding('find-legacy-singular')
    };

    const migrated = AuditArtifactMigrator.migrate(legacyRaw);
    assert.strictEqual(migrated.schemaVersion, 2);
    assert.strictEqual(Array.isArray(migrated.findings), true);
    assert.strictEqual(migrated.findings.length, 1);
    assert.strictEqual(migrated.findings[0].finding_id, 'find-legacy-singular');
    assert.strictEqual((migrated as any).finding, undefined);
  });

  await t.test('5. REPOSITORY_IMMUTABILITY_STRICTNESS — Verify deleteAuditRun is Removed From Repository Domain', () => {
    assert.strictEqual(
      (repository as any).deleteAuditRun,
      undefined,
      'IMMUTABILITY_VIOLATION: O método deleteAuditRun ainda existe em AuditHistoryRepository!'
    );
  });

  await t.test('6. EXECUTION_JOURNAL_ACCOUNTING_TEST — Approval Record Alone Does NOT Count as Execution', () => {
    RepositoryIdentityRegistry.registerProject({
      projectId: 'proj-omega',
      repositoryRoot: process.cwd(),
      canonicalName: 'Project Omega'
    });

    const sourceSnapshot = {
      snapshotId: 'snap-exec-1',
      repositoryRoot: process.cwd(),
      commitHash: 'head',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-exec'
    };

    // 6a. Persiste com ApprovalRecord mas SEM ExecutionJournal
    repository.saveAuditArtifact(
      'AUD-APP-ONLY',
      'proj-omega',
      sourceSnapshot,
      [createCanonicalEvidence('ev-app')],
      [],
      [createCanonicalFinding('find-app')],
      undefined,
      {
        approvalId: 'app-01',
        planId: 'plan-01',
        approvedPlanHash: 'hash-01',
        approvedBy: 'admin',
        approvedAt: new Date().toISOString(),
        decision: 'APPROVED',
        signature: 'sig-01'
      }
    );

    const summaryAppOnly = projectionService.getAuditHistorySummaries('proj-omega').find(s => s.auditRunId === 'AUD-APP-ONLY');
    assert.strictEqual(summaryAppOnly?.totalActionsExecuted, 0, 'VIOLATION: Aprovação isolada foi contada erroneamente como execução!');

    // 6b. Persiste com ExecutionJournal assinado
    const executionJournal: ExecutionJournal = {
      executionId: 'exec-01',
      planId: 'plan-01',
      executedAt: new Date().toISOString(),
      executedBy: 'runner-01',
      status: 'SUCCESS',
      executionHash: 'exec-hash-01'
    };

    repository.saveAuditArtifact(
      'AUD-EXEC-REAL',
      'proj-omega',
      sourceSnapshot,
      [createCanonicalEvidence('ev-exec')],
      [],
      [createCanonicalFinding('find-exec')],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      executionJournal
    );

    const summaryExecReal = projectionService.getAuditHistorySummaries('proj-omega').find(s => s.auditRunId === 'AUD-EXEC-REAL');
    assert.strictEqual(summaryExecReal?.totalActionsExecuted, 1, 'VIOLATION: ExecutionJournal autêntico não foi contado na projeção!');
  });

  await t.test('7. CONCURRENT_MULTI_PROCESS_WRITE_TEST — OS Process Isolation Enforces Immutability Across Forked Node Processes', async () => {
    RepositoryIdentityRegistry.registerProject({
      projectId: 'proj-fork',
      repositoryRoot: process.cwd(),
      canonicalName: 'Fork Project'
    });

    const workerScript = path.join(process.cwd(), 'EOS/tests/workers/multi-process-write-worker.ts');
    const auditRunId = 'AUD-CONC-FORK-01';

    const spawnWorker = () => new Promise<{ success: boolean; error?: string; pid?: number }>((resolve) => {
      const child = fork(workerScript, [tmpDir, 'proj-fork', auditRunId], {
        execArgv: ['--import', 'tsx']
      });
      child.on('message', (msg: any) => resolve(msg));
      child.on('error', (err) => resolve({ success: false, error: err.message }));
    });

    // Executa dois processos Node completamente independentes via child_process.fork
    const [res1, res2] = await Promise.all([spawnWorker(), spawnWorker()]);

    const successes = [res1, res2].filter(r => r.success);
    const failures = [res1, res2].filter(r => !r.success);

    // Exatamente um processo Node deve vencer e gravar o artefato soberano imutável!
    assert.strictEqual(successes.length, 1, 'CONCURRENCY_VIOLATION: Exatamente 1 processo deve ter sucesso na escrita inicial!');
    assert.strictEqual(failures.length, 1, 'CONCURRENCY_VIOLATION: O segundo processo concorrente deve ser bloqueado por AUDIT_IMMUTABILITY_VIOLATION!');
    assert.ok(failures[0].error?.includes('AUDIT_IMMUTABILITY_VIOLATION'));
  });

  await t.test('8. LIST_AUDIT_ARTIFACTS_INTEGRITY_REPORTING — Reports Corrupted Files Explicitly Without Hiding Errors', () => {
    RepositoryIdentityRegistry.registerProject({
      projectId: 'proj-list-test',
      repositoryRoot: process.cwd(),
      canonicalName: 'List Project'
    });

    const sourceSnapshot = {
      snapshotId: 'snap-list-corrupt',
      repositoryRoot: process.cwd(),
      commitHash: 'head',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-list-corrupt'
    };

    repository.saveAuditArtifact(
      'AUD-VALID-LIST',
      'proj-list-test',
      sourceSnapshot,
      [],
      [],
      []
    );

    repository.saveAuditArtifact(
      'AUD-CORRUPT-LIST',
      'proj-list-test',
      sourceSnapshot,
      [],
      [],
      []
    );

    // Adultera AUD-CORRUPT-LIST.json
    const filePath = path.join(tmpDir, 'projects', 'proj-list-test', 'audits', 'AUD-CORRUPT-LIST.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.sourceSnapshotHash = 'TAMPERED_HASH';
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');

    const result = repository.listAuditArtifacts('proj-list-test');
    assert.strictEqual(result.integrityStatus, 'DEGRADED_HAS_CORRUPTED');
    assert.strictEqual(result.corruptedCount, 1);
    assert.strictEqual(result.corruptedArtifacts.includes('AUD-CORRUPT-LIST.json'), true);
  });
});
