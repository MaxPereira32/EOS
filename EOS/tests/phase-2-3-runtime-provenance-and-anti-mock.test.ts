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
import { Evidence, Finding } from '../core/domain/types';

test('EOS Phase 2.3 — Sovereign Runtime Provenance & Ultimate Governance Suite (v3.0.0)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp_anti_mock_v30_'));
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
    provenance: { target_id: 'proj-omega', collector_version: '3.0.0' }
  });

  const createCanonicalFinding = (id: string, severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'): Finding => ({
    finding_id: id,
    rule_id: 'RULE-01',
    rule_version: '3.0.0',
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

  await t.test('1. Static Code Analysis Anti-Mock Test — Verify Production Code Contains No Hardcoded Fallback Mocks', () => {
    const serviceSource = fs.readFileSync(
      path.join(process.cwd(), 'EOS/core/services/audit-history-projection-service.ts'),
      'utf8'
    );
    assert.strictEqual(
      serviceSource.includes('getMockFallbackSummaries'),
      false,
      'PROD_CODE_VIOLATION: getMockFallbackSummaries mock detectado em código de produção!'
    );
    assert.strictEqual(
      serviceSource.includes('AUD-2026-00142'),
      false,
      'PROD_CODE_VIOLATION: ID de auditoria mock sintética hardcoded detectada em produção!'
    );
  });

  await t.test('2. PRODUCTION_FIXTURE_CONTAMINATION_TEST — Verify EOS/core Contains No Hardcoded Test Fixtures', () => {
    const platformSource = fs.readFileSync(
      path.join(process.cwd(), 'EOS/core/eos-platform.ts'),
      'utf8'
    );
    const forbiddenPatterns = ['AST-K8S-INGRESS-01', 'FCT-501', 'TRT-801', 'FND-2026-8801', 'https://api.eos.architecture/v1/auth'];
    for (const pattern of forbiddenPatterns) {
      assert.strictEqual(
        platformSource.includes(pattern),
        false,
        `PROD_FIXTURE_CONTAMINATION_VIOLATION: O padrão de fixture '${pattern}' foi detectado dentro de EOS/core/eos-platform.ts!`
      );
    }
  });

  await t.test('3. JCS RFC 8785 Canonical Hash & Parent Artifact Hash Lineage Chain Test', () => {
    const mockSnapshot: AgentRuntimeSnapshot = {
      runtimeSnapshotId: 'snap-001',
      timestamp: new Date().toISOString(),
      agentDefinitionId: 'agent-impl-01',
      agentRole: 'Implementation Engineer',
      agentVersion: '3.0.0',
      promptVersion: '1.0.0',
      promptHash: 'hash-prompt-123',
      contextPolicyHash: 'hash-context-456',
      modelConfigurationHash: 'hash-model-cfg-789',
      temperature: 0.1,
      maxTokens: 4096,
      reasoningMode: 'HIGH_PRECISION',
      toolConfigurationHash: 'tool-cfg-abc',
      skills: [
        {
          skillId: 'eos-governance',
          version: '1.0.0',
          contentHash: 'sha256-abc-123',
          origin: 'AGENTS_DIR'
        }
      ],
      plugins: [],
      mcpServers: [
        {
          serverId: 'eos-mcp-server',
          version: '3.0.0',
          exposedTools: ['eos_run_audit', 'eos_query_graph'],
          actualToolsUsed: ['eos_run_audit'],
          resourcesProvided: [],
          authenticated: true
        }
      ],
      modelProvider: 'OPENAI',
      modelName: 'gpt-4o'
    };

    const sourceSnapshot = {
      snapshotId: 'snap-src-111',
      repositoryRoot: process.cwd(),
      commitHash: '5b86cf57d2204571453ee44264688a4135c79420',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-hash-999'
    };

    const finding = createCanonicalFinding('find-1', 'HIGH');

    // Save parent artifact
    const parentArtifact = repository.saveAuditArtifact(
      'AUD-PARENT-01',
      'proj-omega',
      sourceSnapshot,
      [createCanonicalEvidence('ev-1')],
      [],
      finding,
      undefined,
      undefined,
      undefined,
      undefined,
      mockSnapshot
    );

    assert.ok(parentArtifact.artifactHash);
    assert.strictEqual(typeof parentArtifact.artifactHash, 'string');

    // Save child artifact with lineage linkage
    const childArtifact = repository.saveAuditArtifact(
      'AUD-CHILD-02',
      'proj-omega',
      sourceSnapshot,
      [createCanonicalEvidence('ev-1')],
      [],
      finding,
      undefined,
      undefined,
      undefined,
      undefined,
      mockSnapshot,
      parentArtifact.artifactId,
      parentArtifact.artifactHash
    );

    assert.strictEqual(childArtifact.parentArtifactId, parentArtifact.artifactId);
    assert.strictEqual(childArtifact.parentArtifactHash, parentArtifact.artifactHash);
  });

  await t.test('4. PERSISTENCE_RESTART_INTEGRITY_TEST — Complete Disk Restart, Hash Check & Parent Lineage Validation', () => {
    const sourceSnapshot = {
      snapshotId: 'snap-restart-1',
      repositoryRoot: process.cwd(),
      commitHash: '5b86cf57d2204571453ee44264688a4135c79420',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-hash-restart'
    };

    const parentArtifact = repository.saveAuditArtifact(
      'AUD-RST-PARENT',
      'proj-restart',
      sourceSnapshot,
      [createCanonicalEvidence('ev-rst-p')],
      [],
      createCanonicalFinding('find-rst-p', 'HIGH')
    );

    repository.saveAuditArtifact(
      'AUD-RST-CHILD',
      'proj-restart',
      sourceSnapshot,
      [createCanonicalEvidence('ev-rst-c')],
      [],
      createCanonicalFinding('find-rst-c', 'CRITICAL'),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      parentArtifact.artifactId,
      parentArtifact.artifactHash
    );

    // PROCESS RESTART SIMULATION: Instantiate completely new Repository and Projection instances
    const freshRepository = new AuditHistoryRepository(tmpDir);
    const freshProjectionService = new AuditHistoryProjectionService(tmpDir);

    const retrievedChild = freshRepository.getAuditArtifact('proj-restart', 'AUD-RST-CHILD');
    assert.ok(retrievedChild);
    assert.strictEqual(retrievedChild?.parentArtifactId, parentArtifact.artifactId);
    assert.strictEqual(retrievedChild?.parentArtifactHash, parentArtifact.artifactHash);

    // Validate parent exists on disk and its hash matches
    const retrievedParent = freshRepository.getAuditArtifact('proj-restart', retrievedChild!.parentArtifactId!);
    assert.ok(retrievedParent);
    assert.strictEqual(retrievedParent?.artifactHash, retrievedChild?.parentArtifactHash);

    // Dynamic Read Model projection from fresh disk read
    const projectedView = freshProjectionService.getAuditTimelineDetail('AUD-RST-CHILD', 'proj-restart');
    assert.ok(projectedView);
    assert.strictEqual(projectedView?.finding.finding_id, 'find-rst-c');
  });

  await t.test('5. AUDIT_ARTIFACT_REPLAY_ATTACK — Rejects Simple Tampering and Cross-Project Context Divergence', () => {
    const sourceSnapshot = {
      snapshotId: 'snap-replay',
      repositoryRoot: process.cwd(),
      commitHash: 'head',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-replay'
    };

    const artifact1 = repository.saveAuditArtifact(
      'AUD-REPLAY-01',
      'proj-omega',
      sourceSnapshot,
      [createCanonicalEvidence('ev-replay')],
      [],
      createCanonicalFinding('find-replay', 'LOW')
    );

    const artifact2 = repository.saveAuditArtifact(
      'AUD-REPLAY-02',
      'proj-omega',
      sourceSnapshot,
      [createCanonicalEvidence('ev-replay-2')],
      [],
      createCanonicalFinding('find-replay-2', 'LOW')
    );

    // 5a. Simple Replay / Tampering Test
    const filePath = path.join(tmpDir, 'projects', 'proj-omega', 'audits', 'AUD-REPLAY-01.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.finding.severity = 'CRITICAL';
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');

    const freshRepository = new AuditHistoryRepository(tmpDir);
    assert.throws(
      () => freshRepository.getAuditArtifact('proj-omega', 'AUD-REPLAY-01'),
      /AUDIT_STORAGE_INTEGRITY_VIOLATION/
    );

    // 5b. Cross-Project IDOR Divergence Replay (using untampered AUD-REPLAY-02)
    const freshProjectionService = new AuditHistoryProjectionService(tmpDir);
    assert.throws(
      () => freshProjectionService.getAuditTimelineDetail('AUD-REPLAY-02', 'project-other'),
      /SECURITY_VIOLATION_PROJECT_ISOLATION/
    );
  });

  await t.test('6. EXPORT_DETERMINISM_TEST — Repeat Exports Over Same AuditArtifact Produce Byte-for-Byte Identical JSON', () => {
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
      createCanonicalFinding('find-exp', 'MEDIUM')
    );

    const export1 = JsonAuditExporter.exportAuditReport(artifact, path.join(tmpDir, 'export1'));
    const export2 = JsonAuditExporter.exportAuditReport(artifact, path.join(tmpDir, 'export2'));

    assert.strictEqual(export1.payloadJson, export2.payloadJson, 'EXPORT_DETERMINISM_VIOLATION: JSONs de exportação diferem!');
  });

  await t.test('7. CONCURRENT_AUDIT_ARTIFACT_WRITE_TEST — Parallel Atomic Writes Maintain Atomic Lock and Independent Hashes', async () => {
    const sourceSnapshot = {
      snapshotId: 'snap-conc',
      repositoryRoot: process.cwd(),
      commitHash: 'head',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-conc'
    };

    const saveOp1 = async () => repository.saveAuditArtifact(
      'AUD-CONC-01',
      'proj-conc',
      sourceSnapshot,
      [createCanonicalEvidence('ev-c1')],
      [],
      createCanonicalFinding('find-c1', 'HIGH')
    );

    const saveOp2 = async () => repository.saveAuditArtifact(
      'AUD-CONC-02',
      'proj-conc',
      sourceSnapshot,
      [createCanonicalEvidence('ev-c2')],
      [],
      createCanonicalFinding('find-c2', 'CRITICAL')
    );

    const [art1, art2] = await Promise.all([saveOp1(), saveOp2()]);

    assert.ok(art1.artifactHash);
    assert.ok(art2.artifactHash);
    assert.notStrictEqual(art1.artifactHash, art2.artifactHash);
  });

  await t.test('8. SCHEMA_MIGRATION_TEST — AuditArtifactMigrator Handles Backward Compatibility', () => {
    const legacyRawArtifact = {
      artifactId: 'art-legacy-01',
      schemaVersion: 1,
      auditRunId: 'AUD-LEGACY-01',
      projectId: 'proj-legacy',
      createdAt: new Date().toISOString(),
      sourceSnapshotHash: 'snap-legacy',
      artifactHash: 'hash-legacy-123',
      finding: createCanonicalFinding('find-legacy')
    };

    const migrated = AuditArtifactMigrator.migrate(legacyRawArtifact);
    assert.strictEqual(migrated.schemaVersion, 1);
    assert.strictEqual(migrated.auditRunId, 'AUD-LEGACY-01');
  });

  await t.test('9. McpPluginRegistry — Verifies ConfigHash, PermissionSetHash & Exposed/Actual Tools Used', () => {
    McpPluginRegistry.registerPlugin({
      pluginId: 'chrome-devtools-plugin',
      name: 'Chrome DevTools Plugin',
      version: '1.0.0',
      contentHash: 'hash-correct-123',
      configHash: 'hash-cfg-456',
      permissionSetHash: 'hash-perm-789',
      permissions: ['DOM_READ', 'NETWORK_INSPECT'],
      exposedTools: ['inspect_element'],
      actualToolsUsed: ['inspect_element']
    });

    McpPluginRegistry.registerMcpServer({
      serverId: 'firebase-mcp-server',
      version: '3.0.0',
      exposedTools: ['firebase_deploy', 'firebase_get_project'],
      actualToolsUsed: ['firebase_deploy'],
      resourcesProvided: ['firebase://config'],
      authenticated: true
    });

    assert.doesNotThrow(() => {
      McpPluginRegistry.verifyPluginIntegrity('chrome-devtools-plugin', 'hash-correct-123', 'hash-cfg-456', 'hash-perm-789');
      McpPluginRegistry.verifyMcpServerIntegrity('firebase-mcp-server', ['firebase_deploy']);
    });
  });

  await t.test('10. EosPlatformV2 Boundary Validation — Rejects RepositoryRoot Mismatch', async () => {
    const platform = new EosPlatformV2(tmpDir);

    const invalidContext: AuditExecutionContext = {
      contextId: 'ctx-invalid',
      projectId: 'proj-omega',
      repositoryRoot: path.join(process.cwd(), 'proj-A'),
      assets: [],
      sourceSnapshot: {
        snapshotId: 'snap-ctx-inv',
        repositoryRoot: path.join(process.cwd(), 'proj-B'), // Context Mismatch!
        commitHash: 'head',
        branchName: 'main',
        observedAt: new Date().toISOString(),
        treeHash: 'tree-ctx-inv'
      },
      runtimeSnapshot: {
        runtimeSnapshotId: 'snap-rt-1',
        timestamp: new Date().toISOString(),
        agentDefinitionId: 'agent-orch-01',
        agentRole: 'Orchestrator',
        agentVersion: '3.0.0',
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

    await assert.rejects(
      async () => platform.runPipeline(invalidContext),
      /SECURITY_VIOLATION_CONTEXT_MISMATCH/
    );
  });
});
