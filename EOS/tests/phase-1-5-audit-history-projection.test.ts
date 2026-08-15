import { test, describe } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AuditHistoryProjectionService } from '../core/services/audit-history-projection-service';
import { CausalRemediationAuditProjection } from '../core/domain/causal-pipeline-contracts';

describe('EOS Phase 1.5 — Audit History Projection & Zero-Knowledge Isolation Suite (Real Disk Persistence)', () => {

  const createDummyProjection = (auditRunId: string, projectId: string): CausalRemediationAuditProjection => ({
    remediationId: `REM-${auditRunId}`,
    sourceSnapshot: {
      snapshotId: `snap-${auditRunId.toLowerCase()}`,
      repositoryRoot: process.cwd(),
      commitHash: 'commit-a1b2c3d4',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'sha256-tree-hash-123456789'
    },
    evidences: [{
      evidence_id: 'EV-101',
      observation_id: 'OBS-01',
      collector_id: 'collector-static-ast',
      source_reference: 'src/auth/token.ts',
      locator: { relative_path: 'src/auth/token.ts', line: 42 },
      source_hash: 'sha256-hash-token-src',
      content_hash: 'sha256-hash-token-content',
      snippet: 'const tokenSecret = SecretStore.get("OPENAI");',
      confidence: 1.0,
      provenance: { target_id: 'tgt-01', collector_version: '2.2.0' }
    }],
    facts: [{
      fact_id: 'FCT-201',
      schema_version: '1.0',
      fact_type: 'FILE_STRUCTURE',
      provider_id: 'provider-ast-collector',
      provider_version: '2.2.0',
      evidence_ids: ['EV-101'],
      input_hash: 'hash-input-201',
      semantic_hash: 'hash-semantic-201',
      lifecycle_status: 'VALID',
      payload: { fact_type: 'FILE_STRUCTURE', directory: 'src/auth', naming_convention: 'camelCase', status: 'PRESENT' },
      composite_confidence: 1.0,
      created_at: new Date().toISOString()
    }],
    findings: [{
      finding_id: 'FND-SEC-019',
      rule_id: 'SEC-RULE-SECRET-LEAK',
      rule_version: '2.1.0',
      fact_ids: ['FCT-201'],
      evidence_ids: ['EV-101'],
      target_id: 'tgt-01',
      location: 'src/auth/token.ts:L42',
      title: 'Segredo exposto em código fonte',
      description: 'Variável com credencial de API detectada em arquivo estático.',
      severity: 'CRITICAL',
      confidence: 1.0,
      status: 'MITIGATED',
      timestamp: new Date().toISOString()
    }],
    userIntentContext: 'Remediar vulnerabilidade de segredo exposto',
    proposedActionPlan: {
      planId: 'PLAN-019',
      findingId: 'FND-SEC-019',
      snapshotId: `snap-${auditRunId.toLowerCase()}`,
      agentDefinitionId: 'def-openai-gpt4o',
      userIntentDescription: 'Mover segredos para cofre AES-256-GCM',
      proposedChanges: [{
        targetFilePath: 'src/auth/token.ts',
        patchDiff: '+ const token = SecretStore.get("OPENAI");',
        riskRationale: 'Zero-knowledge vault'
      }],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: '4e7b8f9a0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f'
    },
    approvalRecord: {
      approvalId: 'APP-019',
      planId: 'PLAN-019',
      approvedPlanHash: '4e7b8f9a0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f',
      approvedBy: 'max@eos.local',
      approvedAt: new Date().toISOString(),
      decision: 'APPROVED',
      signature: 'hmac-sha256-sig-998877665544332211'
    },
    revalidationProof: {
      proofId: `PROOF-${auditRunId}`,
      auditRunId,
      isResolved: true,
      remainingFindingIds: [],
      verifiedAt: new Date().toISOString()
    }
  });

  test('1. PROJEÇÃO DE HISTÓRICO — Retorna DTOs de Resumo Válidos Lidos do Disco Real', () => {
    const tmpEosDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-projection-'));
    try {
      const service = new AuditHistoryProjectionService(tmpEosDir);

      // 1a. Sem auditorias gravadas no disco -> deve retornar [] (ZERO MOCK SINTÉTICO)
      const emptySummaries = service.getAuditHistorySummaries('project-alpha');
      assert.strictEqual(emptySummaries.length, 0, 'Sem auditorias no disco, deve retornar array vazio.');

      // 1b. Persiste uma auditoria real no disco
      const dummyProj = createDummyProjection('AUD-2026-00142', 'project-alpha');
      service.persistAuditRun(dummyProj, 'project-alpha');

      const summaries = service.getAuditHistorySummaries('project-alpha');
      assert.strictEqual(summaries.length, 1);

      const first = summaries[0];
      assert.strictEqual(first.projectId, 'project-alpha');
      assert.strictEqual(first.auditRunId, 'AUD-2026-00142');
      assert.strictEqual(first.totalFindings, 1);
      assert.strictEqual(first.repositoryTreeHash, 'sha256-tree-hash-123456789');
    } finally {
      fs.rmSync(tmpEosDir, { recursive: true, force: true });
    }
  });

  test('2. RASTREABILIDADE CAUSAL DA TIMELINE — Evidência -> Finding -> ActionPlan -> Approval -> Revalidation', () => {
    const tmpEosDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-timeline-'));
    try {
      const service = new AuditHistoryProjectionService(tmpEosDir);
      const dummyProj = createDummyProjection('AUD-2026-00142', 'project-alpha');
      service.persistAuditRun(dummyProj, 'project-alpha');

      const detail = service.getAuditTimelineDetail('AUD-2026-00142', 'project-alpha');

      assert.ok(detail);
      assert.ok(detail.evidences.length > 0);
      assert.strictEqual(detail.findings[0].evidence_ids.includes('EV-101'), true);
      assert.strictEqual(detail.proposedActionPlan?.findingId, detail.findings[0].finding_id);
      assert.strictEqual(detail.approvalRecord?.approvedPlanHash, detail.proposedActionPlan?.planHash);
      assert.strictEqual(detail.revalidationProof?.isResolved, true);
    } finally {
      fs.rmSync(tmpEosDir, { recursive: true, force: true });
    }
  });

  test('3. ISOLAMENTO DE SEGURANÇA — DTOs da Timeline NUNCA Exigem ou Vazem API Keys', () => {
    const tmpEosDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-security-'));
    try {
      const service = new AuditHistoryProjectionService(tmpEosDir);
      const dummyProj = createDummyProjection('AUD-2026-00142', 'project-alpha');
      service.persistAuditRun(dummyProj, 'project-alpha');

      const detail = service.getAuditTimelineDetail('AUD-2026-00142', 'project-alpha');

      const jsonString = JSON.stringify(detail);
      assert.strictEqual(jsonString.includes('sk-'), false);
      assert.strictEqual((detail as any).apiKey, undefined);
      assert.strictEqual((detail as any).secret, undefined);
    } finally {
      fs.rmSync(tmpEosDir, { recursive: true, force: true });
    }
  });

  test('4. VÍNCULO DE APERFEIÇOAMENTO — approvedPlanHash === planHash é Preservado na Projeção Lida do Disco', () => {
    const tmpEosDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-binding-'));
    try {
      const service = new AuditHistoryProjectionService(tmpEosDir);
      const dummyProj = createDummyProjection('AUD-2026-00142', 'project-alpha');
      service.persistAuditRun(dummyProj, 'project-alpha');

      const detail = service.getAuditTimelineDetail('AUD-2026-00142', 'project-alpha');

      assert.ok(detail?.proposedActionPlan);
      assert.ok(detail?.approvalRecord);
      assert.strictEqual(detail.approvalRecord.approvedPlanHash, detail.proposedActionPlan.planHash);
    } finally {
      fs.rmSync(tmpEosDir, { recursive: true, force: true });
    }
  });

  test('5. ISOLAMENTO ESTRUTURAL DE PROJETO (DEFESA IDOR) — Rejeita Consulta de AuditRun de Outro Projeto no Disco', () => {
    const tmpEosDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-idor-'));
    try {
      const service = new AuditHistoryProjectionService(tmpEosDir);
      const dummyProj = createDummyProjection('AUD-2026-00142', 'project-alpha');
      service.persistAuditRun(dummyProj, 'project-alpha');

      // AUD-2026-00142 pertence ao 'project-alpha'. Tentar consultar como 'web-app' deve disparar erro de segurança IDOR.
      assert.throws(
        () => service.getAuditTimelineDetail('AUD-2026-00142', 'web-app'),
        (err: any) => err.message.includes('SECURITY_VIOLATION_PROJECT_ISOLATION')
      );
    } finally {
      fs.rmSync(tmpEosDir, { recursive: true, force: true });
    }
  });

});
