import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { AuditHistoryRepository } from '../core/storage/audit-history-repository';
import { AuditHistoryProjectionService } from '../core/services/audit-history-projection-service';
import { AgentRuntimeSnapshot } from '../core/domain/agent-runtime-snapshot';
import { McpPluginRegistry } from '../core/domain/mcp-plugin-registry';
import { EosPlatformV2, AuditExecutionContext } from '../core/eos-platform';
import { canonicalHash } from '../core/utils/canonical-json';

test('EOS Phase 2.3 — Sovereign Runtime Provenance & Anti-Mock Verification Suite (v2.5.0)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp_anti_mock_v25_'));
  const repository = new AuditHistoryRepository(tmpDir);
  const projectionService = new AuditHistoryProjectionService(tmpDir);

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    McpPluginRegistry.reset();
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
      agentVersion: '2.5.0',
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
          version: '2.5.0',
          toolsProvided: ['eos_run_audit', 'eos_query_graph'],
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

    const finding = {
      finding_id: 'find-1',
      rule_id: 'RULE-01',
      severity: 'HIGH' as const,
      status: 'OPEN' as const,
      evidence_ids: ['ev-1']
    };

    // Save parent artifact
    const parentArtifact = repository.saveAuditArtifact(
      'AUD-PARENT-01',
      'proj-omega',
      sourceSnapshot,
      [],
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
      [],
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

  await t.test('4. PERSISTENCE_RESTART_INTEGRITY_TEST — Write to Disk, Process Reset & Dynamic Read Model Projection', () => {
    const sourceSnapshot = {
      snapshotId: 'snap-restart-1',
      repositoryRoot: process.cwd(),
      commitHash: '5b86cf57d2204571453ee44264688a4135c79420',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-hash-restart'
    };

    const finding = {
      finding_id: 'find-restart',
      rule_id: 'R-RESTART',
      severity: 'CRITICAL' as const,
      status: 'OPEN' as const,
      evidence_ids: ['ev-restart']
    };

    repository.saveAuditArtifact(
      'AUD-RESTART-01',
      'proj-restart',
      sourceSnapshot,
      [],
      [],
      finding
    );

    // PROCESS RESTART SIMULATION: Instantiate completely new Repository and Projection instances
    const freshRepository = new AuditHistoryRepository(tmpDir);
    const freshProjectionService = new AuditHistoryProjectionService(tmpDir);

    const retrievedArtifact = freshRepository.getAuditArtifact('proj-restart', 'AUD-RESTART-01');
    assert.ok(retrievedArtifact);
    assert.strictEqual(retrievedArtifact?.auditRunId, 'AUD-RESTART-01');

    // Dynamic Read Model projection from fresh disk read
    const projectedView = freshProjectionService.getAuditTimelineDetail('AUD-RESTART-01', 'proj-restart');
    assert.ok(projectedView);
    assert.strictEqual(projectedView?.finding.finding_id, 'find-restart');
  });

  await t.test('5. AUDIT_ARTIFACT_REPLAY_ATTACK — Detects Tampering and Rejects Corrupted Artifacts', () => {
    const sourceSnapshot = {
      snapshotId: 'snap-replay',
      repositoryRoot: process.cwd(),
      commitHash: 'head',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-replay'
    };

    const artifact = repository.saveAuditArtifact(
      'AUD-REPLAY-01',
      'proj-omega',
      sourceSnapshot,
      [],
      [],
      {
        finding_id: 'find-replay',
        rule_id: 'R-REPLAY',
        severity: 'LOW',
        status: 'OPEN',
        evidence_ids: ['ev-replay']
      }
    );

    // Tamper with the raw JSON on disk to alter finding severity without updating artifactHash
    const filePath = path.join(tmpDir, 'projects', 'proj-omega', 'audits', 'AUD-REPLAY-01.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.finding.severity = 'TAMPERED_CRITICAL';
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');

    // Re-instantiate repository and attempt to read tampered file
    const freshRepository = new AuditHistoryRepository(tmpDir);
    assert.throws(
      () => freshRepository.getAuditArtifact('proj-omega', 'AUD-REPLAY-01'),
      /AUDIT_STORAGE_INTEGRITY_VIOLATION/
    );
  });

  await t.test('6. McpPluginRegistry — Verifies ConfigHash, PermissionSetHash & ActualToolsUsed', () => {
    McpPluginRegistry.registerPlugin({
      pluginId: 'chrome-devtools-plugin',
      name: 'Chrome DevTools Plugin',
      version: '1.0.0',
      contentHash: 'hash-correct-123',
      configHash: 'hash-cfg-456',
      permissionSetHash: 'hash-perm-789',
      permissions: ['DOM_READ', 'NETWORK_INSPECT'],
      toolsProvided: ['inspect_element'],
      actualToolsUsed: ['inspect_element']
    });

    McpPluginRegistry.registerMcpServer({
      serverId: 'firebase-mcp-server',
      version: '2.0.0',
      toolsProvided: ['firebase_deploy', 'firebase_get_project'],
      actualToolsUsed: ['firebase_deploy'],
      resourcesProvided: ['firebase://config'],
      authenticated: true
    });

    assert.doesNotThrow(() => {
      McpPluginRegistry.verifyPluginIntegrity('chrome-devtools-plugin', 'hash-correct-123', 'hash-cfg-456', 'hash-perm-789');
      McpPluginRegistry.verifyMcpServerIntegrity('firebase-mcp-server', ['firebase_deploy']);
    });
  });

  await t.test('7. EosPlatformV2 — Enforces Mandatory AuditExecutionContext (No Unauthenticated Fallback)', async () => {
    const platform = new EosPlatformV2(tmpDir);

    // Unauthenticated call without AuditExecutionContext must reject
    await assert.rejects(
      async () => (platform as any).runPipeline(null),
      /AUDIT_PIPELINE_ERROR/
    );

    // Valid AuditExecutionContext call succeeds
    const validContext: AuditExecutionContext = {
      projectId: 'proj-omega',
      repositoryRoot: process.cwd(),
      assets: [],
      sourceSnapshot: {
        snapshotId: 'snap-ctx-1',
        repositoryRoot: process.cwd(),
        commitHash: 'head',
        branchName: 'main',
        observedAt: new Date().toISOString(),
        treeHash: 'tree-ctx-1'
      },
      runtimeSnapshot: {
        runtimeSnapshotId: 'snap-rt-1',
        timestamp: new Date().toISOString(),
        agentDefinitionId: 'agent-orch-01',
        agentRole: 'Orchestrator',
        agentVersion: '2.5.0',
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

    const artifact = await platform.runPipeline(validContext);
    assert.ok(artifact.artifactId);
    assert.ok(artifact.artifactHash);
  });
});
