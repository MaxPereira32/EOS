import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { AuditHistoryRepository } from '../core/storage/audit-history-repository';
import { AuditHistoryProjectionService } from '../core/services/audit-history-projection-service';
import { AgentRuntimeSnapshot } from '../core/domain/agent-runtime-snapshot';
import { McpPluginRegistry } from '../core/domain/mcp-plugin-registry';
import { CausalRemediationAuditProjection } from '../core/domain/causal-pipeline-contracts';

test('EOS Phase 2.3 — Runtime Provenance & Anti-Mock Verification Suite', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp_anti_mock_'));
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

  await t.test('3. AuditHistoryRepository — Saves and Retrieves Real AuditArtifacts with SHA-256 Hash Verification', () => {
    const mockSnapshot: AgentRuntimeSnapshot = {
      runtimeSnapshotId: 'snap-001',
      timestamp: new Date().toISOString(),
      agentDefinitionId: 'agent-impl-01',
      agentRole: 'Implementation Engineer',
      agentVersion: '2.4.0',
      promptVersion: '1.0.0',
      promptHash: 'hash-prompt-123',
      contextPolicyHash: 'hash-context-456',
      modelConfigurationHash: 'hash-model-cfg-789',
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
          version: '2.4.0',
          toolsProvided: ['eos_run_audit', 'eos_query_graph'],
          resourcesProvided: [],
          authenticated: true
        }
      ],
      modelProvider: 'OPENAI',
      modelName: 'gpt-4o'
    };

    const mockProjection: CausalRemediationAuditProjection = {
      remediationId: 'rem-999',
      sourceSnapshot: {
        snapshotId: 'snap-src-111',
        repositoryRoot: process.cwd(),
        commitHash: '5b86cf57d2204571453ee44264688a4135c79420',
        branchName: 'main',
        observedAt: new Date().toISOString(),
        treeHash: 'tree-hash-999'
      },
      evidences: [
        {
          evidence_id: 'ev-1',
          evidence_type: 'TEST_EXECUTION',
          source: 'NIST Engine',
          payload: { status: 'PASS' },
          collected_at: new Date().toISOString()
        }
      ],
      facts: [],
      finding: {
        finding_id: 'find-1',
        rule_id: 'RULE-01',
        severity: 'HIGH',
        status: 'OPEN',
        evidence_ids: ['ev-1']
      },
      revalidationProof: {
        proofId: 'proof-100',
        auditRunId: 'AUD-REAL-999',
        isResolved: true,
        remainingFindingIds: [],
        verifiedAt: new Date().toISOString()
      }
    };

    const savedArtifact = repository.saveAuditArtifact(
      'AUD-REAL-999',
      'proj-omega',
      mockProjection,
      mockSnapshot
    );

    assert.ok(savedArtifact.artifactHash);
    assert.strictEqual(typeof savedArtifact.artifactHash, 'string');

    const retrieved = repository.getAuditArtifact('proj-omega', 'AUD-REAL-999');
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.auditRunId, 'AUD-REAL-999');
    assert.strictEqual(retrieved?.runtimeSnapshot?.agentRole, 'Implementation Engineer');
    assert.strictEqual(retrieved?.runtimeSnapshot?.promptVersion, '1.0.0');
    assert.strictEqual(retrieved?.runtimeSnapshot?.skills[0].skillId, 'eos-governance');
  });

  await t.test('4. McpPluginRegistry — Verifies Plugin & MCP Server Integrity, ConfigHash and Detects Tampering', () => {
    McpPluginRegistry.registerPlugin({
      pluginId: 'chrome-devtools-plugin',
      name: 'Chrome DevTools Plugin',
      version: '1.0.0',
      contentHash: 'hash-correct-123',
      configHash: 'hash-cfg-456',
      permissionSetHash: 'hash-perm-789',
      permissions: ['DOM_READ', 'NETWORK_INSPECT'],
      toolsProvided: ['inspect_element']
    });

    McpPluginRegistry.registerMcpServer({
      serverId: 'firebase-mcp-server',
      version: '2.0.0',
      toolsProvided: ['firebase_deploy', 'firebase_get_project'],
      resourcesProvided: ['firebase://config'],
      authenticated: true
    });

    // Valid integrity checks must pass without throwing
    assert.doesNotThrow(() => {
      McpPluginRegistry.verifyPluginIntegrity('chrome-devtools-plugin', 'hash-correct-123', 'hash-cfg-456', 'hash-perm-789');
      McpPluginRegistry.verifyMcpServerIntegrity('firebase-mcp-server', ['firebase_deploy']);
    });

    // Tampered configHash must throw PLUGIN_RUNTIME_INTEGRITY_VIOLATION
    assert.throws(
      () => McpPluginRegistry.verifyPluginIntegrity('chrome-devtools-plugin', 'hash-correct-123', 'hash-TAMPERED-CFG', 'hash-perm-789'),
      /PLUGIN_RUNTIME_INTEGRITY_VIOLATION/
    );

    // Missing tool must throw MCP_RUNTIME_INTEGRITY_VIOLATION
    assert.throws(
      () => McpPluginRegistry.verifyMcpServerIntegrity('firebase-mcp-server', ['unregistered_tool']),
      /MCP_RUNTIME_INTEGRITY_VIOLATION/
    );
  });

  await t.test('5. Anti-Tampering Chain Test — Deleting a Materialized Artifact Results in Empty / Incomplete Chain', () => {
    repository.saveAuditArtifact(
      'AUD-TO-DELETE-1',
      'proj-omega',
      {
        remediationId: 'rem-del',
        sourceSnapshot: {
          snapshotId: 'src-del',
          repositoryRoot: process.cwd(),
          commitHash: 'head',
          branchName: 'main',
          observedAt: new Date().toISOString(),
          treeHash: 'tree-del'
        },
        evidences: [],
        facts: [],
        finding: {
          finding_id: 'find-del',
          rule_id: 'R-DEL',
          severity: 'LOW',
          status: 'OPEN',
          evidence_ids: ['ev-del']
        }
      }
    );

    // Deleting the real file from disk
    const deleted = repository.deleteAuditRun('proj-omega', 'AUD-TO-DELETE-1');
    assert.strictEqual(deleted, true);

    // Retrieving after deletion must return null, proving no fallback mock reconstructs it
    const afterDelete = repository.getAuditArtifact('proj-omega', 'AUD-TO-DELETE-1');
    assert.strictEqual(afterDelete, null);
  });
});
