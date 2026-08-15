import test from 'node:test';
import assert from 'node:assert';
import { AssessmentSnapshot } from '../core/domain/assessment-snapshot';
import { parseTargetId, parseExecutionId, parseFindingId, parseEvidenceId } from '../core/domain/canonical-ids';

test('EOS Phase 2 — Assessment Snapshot Hardening Suite', async (t) => {

  await t.test('Identity: Aceita IDs canônicos válidos e rejeita strings vazias/malformadas', () => {
    assert.throws(() => parseTargetId('   '), /Invalid TargetId: cannot be empty/);
    assert.throws(() => parseExecutionId(123), /Invalid ExecutionId: must be a string/);
    assert.ok(parseFindingId('FIN-001') === 'FIN-001');
  });

  await t.test('Target Provenance Policy: Rejeita proveniência inválida', () => {
    // SOURCE_CODE sem git_commit -> reject
    assert.throws(() => new AssessmentSnapshot({
      snapshot_type: 'BASELINE', target_id: 'T-1', evidence_ids: [], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'E-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '1', tool_or_collector: 'T', target_type: 'SOURCE_CODE' } 
    }), /git_commit is REQUIRED for SOURCE_CODE targets/);

    // ARTIFACT sem artifact_hash -> reject
    assert.throws(() => new AssessmentSnapshot({
      snapshot_type: 'BASELINE', target_id: 'T-1', evidence_ids: [], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'E-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '1', tool_or_collector: 'T', target_type: 'ARTIFACT' } 
    }), /artifact_hash is REQUIRED for ARTIFACT targets/);

    // UNKNOWN target type + Any status other than NOT_VERIFIED -> reject
    const invalidStatuses: ('VERIFIED' | 'PARTIALLY_VERIFIED' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'UNKNOWN')[] = [
      'VERIFIED', 'PARTIALLY_VERIFIED', 'NON_COMPLIANT', 'NOT_APPLICABLE', 'UNKNOWN'
    ];

    for (const status of invalidStatuses) {
      assert.throws(() => new AssessmentSnapshot({
        snapshot_type: 'BASELINE', target_id: 'T-1', evidence_ids: [], fact_ids: [], finding_ids: [],
        risk_level: 'LOW', verification_status: status as any,
        provenance: { execution_id: 'E-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '1', tool_or_collector: 'T', target_type: 'UNKNOWN' }
      }), /UNKNOWN target_type can only have NOT_VERIFIED status/);
    }

    // UNKNOWN + NOT_VERIFIED -> accept
    assert.doesNotThrow(() => new AssessmentSnapshot({
      snapshot_type: 'BASELINE', target_id: 'T-1', evidence_ids: [], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'NOT_VERIFIED',
      provenance: { execution_id: 'E-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '1', tool_or_collector: 'T', target_type: 'UNKNOWN' }
    }));
  });

  await t.test('Target Invariant: Rejeita target_id distinto na comparação', () => {
    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION',
      target_id: 'TARGET-A',
      evidence_ids: ['EVI-1'], fact_ids: [], finding_ids: ['FIN-1'],
      risk_level: 'HIGH', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    });
    const after = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION',
      target_id: 'TARGET-B', // DIVERGENTE
      evidence_ids: ['EVI-2'], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-2', executed_at: '2026-08-01T11:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    });

    assert.throws(() => AssessmentSnapshot.compare(before, after, [parseFindingId('FIN-1')]), /TARGET_MISMATCH/);
  });

  await t.test('Temporal Invariant: Rejeita ISO inválido e Time Travel (AFTER < BEFORE)', () => {
    assert.throws(() => new AssessmentSnapshot({
      snapshot_type: 'BASELINE', target_id: 'T-1', evidence_ids: [], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'E-1', executed_at: 'DATA_INVALIDA', eos_version: '1', tool_or_collector: 'T', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    }), /ISO-8601/);

    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION', target_id: 'TARGET-A', evidence_ids: [], fact_ids: [], finding_ids: ['FIN-1'],
      risk_level: 'HIGH', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    });
    const afterTimeTravel = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION', target_id: 'TARGET-A', evidence_ids: [], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-2', executed_at: '2026-08-01T09:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' } // ANTERIOR
    });

    assert.throws(() => AssessmentSnapshot.compare(before, afterTimeTravel, [parseFindingId('FIN-1')]), /INVALID_TEMPORAL_ORDER/);
  });

  await t.test('Execution Invariant: Rejeita execução idêntica em Remediação', () => {
    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION', target_id: 'TARGET-A', evidence_ids: [], fact_ids: [], finding_ids: ['FIN-1'],
      risk_level: 'HIGH', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    });
    const after = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION', target_id: 'TARGET-A', evidence_ids: [], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-01T11:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' } // MESMO EXEC
    });

    assert.throws(() => AssessmentSnapshot.compare(before, after, [parseFindingId('FIN-1')]), /INVALID_EXECUTION_STATE/);
  });

  await t.test('Scope Invariant: Rejeita target finding inexistente no BEFORE e exige target array', () => {
    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION', target_id: 'TARGET-A', evidence_ids: [], fact_ids: [], finding_ids: ['FIN-1'],
      risk_level: 'HIGH', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    });
    const after = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION', target_id: 'TARGET-A', evidence_ids: ['EVI-2'], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-2', executed_at: '2026-08-01T11:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'def' }
    });

    assert.throws(() => AssessmentSnapshot.compare(before, after, []), /Escopo de remediação ausente/);
    assert.throws(() => AssessmentSnapshot.compare(before, after, [parseFindingId('FIN-99')]), /não existe no estado BEFORE/);
  });

  await t.test('Resolution Semantics: Classifica new_findings, resolved e persisting corretamente', () => {
    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION', target_id: 'TARGET-A', evidence_ids: ['EVI-1'], fact_ids: [], finding_ids: ['FIN-1', 'FIN-2', 'FIN-3'],
      risk_level: 'HIGH', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    });
    
    const after = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION', target_id: 'TARGET-A', evidence_ids: ['EVI-2'], fact_ids: [], 
      finding_ids: ['FIN-2', 'FIN-99'],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-2', executed_at: '2026-08-01T11:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'def' }
    });

    const result = AssessmentSnapshot.compare(before, after, [parseFindingId('FIN-1'), parseFindingId('FIN-2')]);
    
    assert.deepStrictEqual(result.resolved_target_finding_ids, ['FIN-1']);
    assert.deepStrictEqual(result.persisting_target_finding_ids, ['FIN-2']);
    assert.deepStrictEqual(result.new_finding_ids, ['FIN-99']);
    assert.strictEqual(result.overall_resolution_status, 'PARTIALLY_RESOLVED');
  });

  await t.test('Stale Evidence: Detecta evidência reutilizada e bloqueia resolução', () => {
    const before = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION', target_id: 'TARGET-A', evidence_ids: ['EVI-SHARED'], fact_ids: [], finding_ids: ['FIN-1'],
      risk_level: 'HIGH', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    });
    const after = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION', target_id: 'TARGET-A', evidence_ids: ['EVI-SHARED'], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-2', executed_at: '2026-08-01T11:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'def' }
    });

    const result = AssessmentSnapshot.compare(before, after, [parseFindingId('FIN-1')]);
    assert.strictEqual(result.stale_evidence_reused, true);
    assert.strictEqual(result.overall_resolution_status, 'INVALID_COMPARISON');
  });

  await t.test('Immutability: Rejeita mutações em arrays e provenance', () => {
    const snap = new AssessmentSnapshot({
      snapshot_type: 'BASELINE', target_id: 'TARGET-A', evidence_ids: ['EVI-1'], fact_ids: [], finding_ids: [],
      risk_level: 'LOW', verification_status: 'VERIFIED',
      provenance: { execution_id: 'EXEC-1', executed_at: '2026-08-01T10:00:00Z', eos_version: '2.0.0', tool_or_collector: 'TEST', target_type: 'SOURCE_CODE', git_commit: 'abc' }
    });

    assert.throws(() => { (snap as any).target_id = 'HACK'; }, TypeError);
    assert.throws(() => { (snap.evidence_ids as any).push('EVI-2'); }, TypeError);
    assert.throws(() => { (snap.provenance as any).execution_id = 'HACK'; }, TypeError);
  });
});
