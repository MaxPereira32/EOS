import * as test from 'node:test';
import * as assert from 'node:assert';
import { AssessmentSnapshot } from '../core/domain/assessment-snapshot';

test.describe('EOS Phase 2 — Assessment Snapshot Integrity Suite', () => {
  test.it('Deve criar Snapshot válido com hash determinístico e IDs imutáveis', () => {
    const snap = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION',
      target_id: 'TGT-123',
      evidence_ids: ['EVI-001', 'EVI-002'],
      fact_ids: ['FAC-001'],
      finding_ids: ['FIN-001'],
      risk_level: 'HIGH',
      verification_status: 'NON_COMPLIANT',
      provenance: {
        execution_id: 'EXEC-111',
        executed_at: '2026-08-14T21:00:00Z',
        eos_version: 'v2.2.0',
        tool_or_collector: 'typescript-ast-collector'
      }
    });

    assert.strictEqual(snap.snapshot_type, 'BEFORE_REMEDIATION');
    assert.strictEqual(snap.evidence_ids.length, 2);
    assert.ok(snap.snapshot_id.startsWith('SNP-'));
    
    // Imutabilidade
    assert.throws(() => {
      (snap.evidence_ids as any).push('EVI-HACK');
    }, TypeError);
  });

  test.it('Falha ao instanciar snapshot sem provenance (Proteção contra geração anônima de evidência)', () => {
    assert.throws(() => {
      new AssessmentSnapshot({
        snapshot_type: 'BASELINE',
        target_id: 'TGT-123',
        evidence_ids: [],
        fact_ids: [],
        finding_ids: [],
        risk_level: 'LOW',
        verification_status: 'VERIFIED',
        provenance: null as any
      });
    }, /Proveniência estrita é obrigatória/);
  });

  test.it('Compare: Rejeita Remediação se a Evidência do AFTER for idêntica ao BEFORE (Stale Evidence)', () => {
    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION',
      target_id: 'TGT-123',
      evidence_ids: ['EVI-001'], // Evidência original do problema
      fact_ids: ['FAC-001'],
      finding_ids: ['FIN-001'],
      risk_level: 'HIGH',
      verification_status: 'NON_COMPLIANT',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-14T10:00:00Z', eos_version: 'v2.2.0', tool_or_collector: 'test' }
    });

    const after = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION',
      target_id: 'TGT-123',
      evidence_ids: ['EVI-001'], // ERRO: Reutilizando EVI-001 para tentar provar que foi consertado
      fact_ids: ['FAC-002'],
      finding_ids: [], // Zero findings (tentando mascarar)
      risk_level: 'LOW',
      verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-2', executed_at: '2026-08-14T11:00:00Z', eos_version: 'v2.2.0', tool_or_collector: 'test' }
    });

    const result = AssessmentSnapshot.compare(before, after);
    assert.strictEqual(result.stale_evidence_reused, true, 'Deve identificar que evidência expirada foi reutilizada');
    assert.strictEqual(result.resolved, false, 'Não pode considerar resolvido se a evidência é stale');
  });

  test.it('Compare: Acusa regressão se o AFTER possuir um Finding que não existia no BEFORE', () => {
    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION',
      target_id: 'TGT-123',
      evidence_ids: ['EVI-001'],
      fact_ids: [],
      finding_ids: ['FIN-001'], // Problema A
      risk_level: 'HIGH',
      verification_status: 'NON_COMPLIANT',
      provenance: { execution_id: 'EXEC-1', executed_at: '10:00', eos_version: '2', tool_or_collector: 't' }
    });

    const after = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION',
      target_id: 'TGT-123',
      evidence_ids: ['EVI-002'], // Nova evidência ok
      fact_ids: [],
      finding_ids: ['FIN-002'], // O problema A sumiu, mas surgiu o Problema B! Regressão.
      risk_level: 'HIGH',
      verification_status: 'NON_COMPLIANT',
      provenance: { execution_id: 'EXEC-2', executed_at: '11:00', eos_version: '2', tool_or_collector: 't' }
    });

    const result = AssessmentSnapshot.compare(before, after);
    assert.strictEqual(result.regression, true, 'Deve identificar a regressão (novo Finding FIN-002)');
    assert.strictEqual(result.resolved, false, 'Não está resolvido com regressão aberta');
  });

  test.it('Compare: Declara RESOLVED quando Nova Evidência é fornecida e Zero Findings são relatados', () => {
    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION',
      target_id: 'TGT-123',
      evidence_ids: ['EVI-001'],
      fact_ids: [],
      finding_ids: ['FIN-001'],
      risk_level: 'HIGH',
      verification_status: 'NON_COMPLIANT',
      provenance: { execution_id: 'EXEC-1', executed_at: '10:00', eos_version: '2', tool_or_collector: 't' }
    });

    const after = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION',
      target_id: 'TGT-123',
      evidence_ids: ['EVI-009'], // Nova evidência coletada após patch
      fact_ids: ['FAC-009'], // Fato comprovando presença da mitigação
      finding_ids: [], // Problema extinto
      risk_level: 'LOW',
      verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-2', executed_at: '11:00', eos_version: '2', tool_or_collector: 't' }
    });

    const result = AssessmentSnapshot.compare(before, after);
    assert.strictEqual(result.stale_evidence_reused, false);
    assert.strictEqual(result.regression, false);
    assert.strictEqual(result.resolved, true, 'Correção confirmada por nova coleta de evidências');
  });
});
