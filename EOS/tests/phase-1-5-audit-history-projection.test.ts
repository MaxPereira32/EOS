import { test, describe } from 'node:test';
import * as assert from 'assert';
import { AuditHistoryProjectionService } from '../core/services/audit-history-projection-service';

describe('EOS Phase 1.5 — Audit History Projection & Zero-Knowledge Isolation Suite', () => {

  test('1. PROJEÇÃO DE HISTÓRICO — Retorna DTOs de Resumo Válidos sem Mutar Estado', () => {
    const service = new AuditHistoryProjectionService();
    const summaries = service.getAuditHistorySummaries('project-alpha');

    assert.ok(Array.isArray(summaries));
    assert.ok(summaries.length > 0);

    const first = summaries[0];
    assert.strictEqual(first.projectId, 'project-alpha');
    assert.strictEqual(typeof first.auditRunId, 'string');
    assert.strictEqual(typeof first.totalFindings, 'number');
    assert.strictEqual(typeof first.repositoryTreeHash, 'string');
  });

  test('2. RASTREABILIDADE CAUSAL DA TIMELINE — Evidência -> Finding -> ActionPlan -> Approval -> Revalidation', () => {
    const service = new AuditHistoryProjectionService();
    const detail = service.getAuditTimelineDetail('AUD-2026-00142', 'project-alpha');

    assert.ok(detail);
    assert.ok(detail.evidences.length > 0);
    assert.strictEqual(detail.finding.evidence_ids.includes('EV-101'), true);
    assert.strictEqual(detail.proposedActionPlan?.findingId, detail.finding.finding_id);
    assert.strictEqual(detail.approvalRecord?.approvedPlanHash, detail.proposedActionPlan?.planHash);
    assert.strictEqual(detail.revalidationProof?.isResolved, true);
  });

  test('3. ISOLAMENTO DE SEGURANÇA — DTOs da Timeline NUNCA Exigem ou Vazem API Keys', () => {
    const service = new AuditHistoryProjectionService();
    const detail = service.getAuditTimelineDetail('AUD-2026-00142', 'project-alpha');

    const jsonString = JSON.stringify(detail);
    assert.strictEqual(jsonString.includes('sk-'), false);
    assert.strictEqual((detail as any).apiKey, undefined);
    assert.strictEqual((detail as any).secret, undefined);
  });

  test('4. VÍNCULO DE APERFEIÇOAMENTO — approvedPlanHash === planHash é Preservado na Projeção', () => {
    const service = new AuditHistoryProjectionService();
    const detail = service.getAuditTimelineDetail('AUD-2026-00142', 'project-alpha');

    assert.ok(detail?.proposedActionPlan);
    assert.ok(detail?.approvalRecord);
    assert.strictEqual(detail.approvalRecord.approvedPlanHash, detail.proposedActionPlan.planHash);
  });

  test('5. ISOLAMENTO ESTRUTURAL DE PROJETO (DEFESA IDOR) — Rejeita Consulta de AuditRun de Outro Projeto', () => {
    const service = new AuditHistoryProjectionService();

    // AUD-2026-00142 pertence ao 'project-alpha'. Tentar consultar como 'web-app' deve disparar erro de segurança.
    assert.throws(
      () => service.getAuditTimelineDetail('AUD-2026-00142', 'web-app'),
      (err: any) => err.message.includes('SECURITY_VIOLATION_PROJECT_ISOLATION')
    );
  });

});
