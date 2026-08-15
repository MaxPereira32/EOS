import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
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

test('EOS Phase 3.1 — Sovereign Causal Truth & Strict Enforcement Suite (v3.1.0)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp_causal_v31_'));
  const repository = new AuditHistoryRepository(tmpDir);
  const projectionService = new AuditHistoryProjectionService(tmpDir);

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    McpPluginRegistry.reset();
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
    provenance: { target_id: 'proj-omega', collector_version: '3.1.0' }
  });

  const createCanonicalFinding = (id: string, severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'): Finding => ({
    finding_id: id,
    rule_id: 'RULE-01',
    rule_version: '3.1.0',
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
        agentVersion: '3.1.0',
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

  await t.test('2. JCS_RFC_8785_COMPLIANCE_SUITE — Verify UTF-16 Sorting & Deterministic Canonical Hashing', () => {
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

    assert.strictEqual(canonicalStr1, canonicalStr2, 'JCS_RFC_8785_VIOLATION: Serializações canônicas de objetos com chaves trocadas diferem!');
    assert.strictEqual(canonicalStr1.indexOf('"a_field"'), 1, 'JCS_RFC_8785_VIOLATION: A primeira chave deve ser a_field!');
  });

  await t.test('3. REPOSITORY_IMMUTABILITY_STRICTNESS — Verify deleteAuditRun is Removed From Repository Domain', () => {
    assert.strictEqual(
      (repository as any).deleteAuditRun,
      undefined,
      'IMMUTABILITY_VIOLATION: O método deleteAuditRun ainda existe em AuditHistoryRepository!'
    );
  });

  await t.test('4. EXECUTION_JOURNAL_ACCOUNTING_TEST — Approval Record Alone Does NOT Count as Execution', () => {
    const sourceSnapshot = {
      snapshotId: 'snap-exec-1',
      repositoryRoot: process.cwd(),
      commitHash: 'head',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-exec'
    };

    // 4a. Persiste com ApprovalRecord mas SEM ExecutionJournal
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

    // 4b. Persiste com ExecutionJournal assinado
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

  await t.test('5. REPOSITORY_IDENTITY_BOUNDARY_TEST — Validates ProjectId Mapping Against Registered Root', () => {
    RepositoryIdentityRegistry.registerProject({
      projectId: 'project-strict',
      repositoryRoot: process.cwd(),
      canonicalName: 'Strict Repository'
    });

    assert.doesNotThrow(() => {
      RepositoryIdentityRegistry.validateProjectRepository('project-strict', process.cwd());
    });

    assert.throws(
      () => RepositoryIdentityRegistry.validateProjectRepository('project-strict', path.join(process.cwd(), 'unauthorized-path')),
      /SECURITY_VIOLATION_REPOSITORY_IDENTITY_MISMATCH/
    );
  });

  await t.test('6. LIST_AUDIT_ARTIFACTS_INTEGRITY_REPORTING — Reports Corrupted Files Explicitly Without Hiding Errors', () => {
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

    // Tamper with AUD-CORRUPT-LIST.json
    const filePath = path.join(tmpDir, 'projects', 'proj-list-test', 'audits', 'AUD-CORRUPT-LIST.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.sourceSnapshotHash = 'TAMPERED_HASH';
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');

    const result = repository.listAuditArtifacts('proj-list-test');
    assert.strictEqual(result.integrityStatus, 'DEGRADED_HAS_CORRUPTED');
    assert.strictEqual(result.corruptedCount, 1);
    assert.strictEqual(result.corruptedArtifacts.includes('AUD-CORRUPT-LIST.json'), true);
  });

  await t.test('7. EXPORT_DETERMINISM_TEST — Repeat Exports Over Same AuditArtifact Produce Byte-for-Byte Identical JSON', () => {
    const sourceSnapshot = {
      snapshotId: 'snap-exp-1',
      repositoryRoot: process.cwd(),
      commitHash: 'head',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-exp'
    };

    const artifact = repository.saveAuditArtifact(
      'AUD-EXP-01',
      'proj-export',
      sourceSnapshot,
      [createCanonicalEvidence('ev-exp')],
      [],
      [createCanonicalFinding('find-exp', 'MEDIUM')]
    );

    const export1 = JsonAuditExporter.exportAuditReport(artifact, path.join(tmpDir, 'export1'));
    const export2 = JsonAuditExporter.exportAuditReport(artifact, path.join(tmpDir, 'export2'));

    assert.strictEqual(export1.payloadJson, export2.payloadJson, 'EXPORT_DETERMINISM_VIOLATION: JSONs de exportação diferem!');
  });
});
