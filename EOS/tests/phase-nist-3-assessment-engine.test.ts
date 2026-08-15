import * as test from 'node:test';
import * as assert from 'node:assert';
import { NistAssessmentEngine, EvidencePayload } from '../core/engines/nist-assessment-engine';
import { AssessmentRemediationService } from '../core/services/assessment-remediation-service';
import { NistRequirement, NistApplicability, ControlMapping } from '../core/domain/nist-contracts';
import { AssessmentSnapshot } from '../core/domain/assessment-snapshot';
import { parseFindingId } from '../core/domain/canonical-ids';

test.describe('EOS Phase 3 — NIST Assessment Engine & Invariants Suite (SSDF PW.8.2)', () => {

  const pw82Req: NistRequirement = {
    requirement_id: 'PW.8.2',
    source: {
      framework: 'NIST_SSDF_V1.1',
      version: '1.1',
      title: 'NIST SP 800-218 SSDF v1.1',
      retrieval_date: '2026-08-15'
    },
    taxonomy_kind: 'TASK',
    title: 'Test Executable Code to Identify Vulnerabilities and Verify Compliance',
    description: 'Scope, design, execute, and document tests to identify vulnerabilities and verify compliance with security requirements.',
    operational_criteria: [
      'C1: Executable code tests defined',
      'C2: Tests executed and documented',
      'C3: Issues recorded and triaged',
      'C4: Remediation verified'
    ]
  };

  const validApplicability: NistApplicability = {
    requirement_id: 'PW.8.2',
    status: 'APPLICABLE',
    rationale: 'Required for core software delivery integrity.'
  };

  const authorizedMapping: ControlMapping = {
    requirement_id: 'PW.8.2',
    eos_rule_id: 'SEC-RULE-502-HARDCODED-SECRET',
    relationship: 'EQUIVALENT',
    has_authority: true,
    rationale: 'Maps directly to domain invariant testing and security compliance rule.'
  };

  const engine = new NistAssessmentEngine();
  const service = new AssessmentRemediationService();

  test.it('1. UNKNOWN applicability -> never VERIFIED', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: { requirement_id: 'PW.8.2', status: 'UNKNOWN' },
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: [{ evidence_id: 'E1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS' }],
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'UNKNOWN');
    assert.notStrictEqual(result.status, 'VERIFIED');
  });

  test.it('2. NOT_APPLICABLE without rationale -> throws exception', () => {
    assert.throws(() => {
      engine.assessRequirement({
        requirement: pw82Req,
        applicability: { requirement_id: 'PW.8.2', status: 'NOT_APPLICABLE', rationale: '' },
        mapping: authorizedMapping,
        facts: [],
        evidence: [],
        target_id: 'T1'
      });
    }, /NOT_APPLICABLE requires an explicit rationale/);
  });

  test.it('3. NO_FINDING != VERIFIED (Absence of findings without evidence yields NOT_VERIFIED)', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: [], // Zero findings, but ZERO evidence!
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.match(result.rationale, /NO_FINDING != VERIFIED/);
  });

  test.it('4. Missing evidence -> NOT_VERIFIED', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: [],
      evidence: [],
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
  });

  test.it('5. Sufficient evidence -> VERIFIED', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: [{ evidence_id: 'EVI-PASS-1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS' }],
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'VERIFIED');
  });

  test.it('6. Contradictory evidence -> NON_COMPLIANT', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: [{ evidence_id: 'EVI-FAIL-1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'FAIL' }],
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NON_COMPLIANT');
    assert.match(result.rationale, /Contradictory\/Failing Evidence/);
  });

  test.it('7. Mapping without authority -> reject evaluation', () => {
    const unauthMapping: ControlMapping = {
      requirement_id: 'PW.8.2',
      eos_rule_id: 'RULE-1',
      relationship: 'EQUIVALENT',
      has_authority: false, // Unauthorized!
      rationale: 'Unverified mapping'
    };

    assert.throws(() => {
      engine.assessRequirement({
        requirement: pw82Req,
        applicability: validApplicability,
        mapping: unauthMapping,
        facts: [],
        evidence: [{ evidence_id: 'E1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS' }],
        target_id: 'T1'
      });
    }, /EQUIVALENT mapping requires explicit authority provenance/);
  });

  test.it('8. Authorized mapping != VERIFIED (Mapping with no evidence still yields NOT_VERIFIED)', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping, // Authorized!
      facts: [],
      evidence: [], // But no evidence!
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.notStrictEqual(result.status, 'VERIFIED');
  });

  test.it('9. BEFORE state -> NON_COMPLIANT when failing evidence present', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-SYSCTX-01'],
      evidence: [{ evidence_id: 'EVI-PW82-BEFORE-FAIL', target_id: 'TGT-SYS', timestamp: new Date().toISOString(), status: 'FAIL' }],
      target_id: 'TGT-SYS'
    });

    assert.strictEqual(result.status, 'NON_COMPLIANT');
  });

  test.it('10 & 11. End-to-End Remediation Pipeline: False Remediation BLOCKED & True Remediation VERIFIED', async () => {
    const pipelineResult = await service.runFullRemediationPipeline({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      target_id: 'TGT-SYS',
      initial_evidence: [{ evidence_id: 'EVI-PW82-BEFORE-FAIL', target_id: 'TGT-SYS', timestamp: new Date().toISOString(), status: 'FAIL' }],
      git_commit_before: '168aac69403a5ca47f6ad0d96ae6b598ea1c0263',
      git_commit_after: '95925f8d52ed9f616e973b3ba7f0d5b23a6a70e6'
    });

    // Verify initial
    assert.strictEqual(pipelineResult.initial_assessment.status, 'NON_COMPLIANT');
    assert.ok(pipelineResult.before_snapshot);
    assert.strictEqual(pipelineResult.before_snapshot.snapshot_type, 'BEFORE_REMEDIATION');

    // Verify False Fix was BLOCKED
    assert.strictEqual(pipelineResult.false_fix_blocked, true);

    // Verify True Fix succeeded and Reassessment is VERIFIED
    assert.ok(pipelineResult.after_snapshot);
    assert.strictEqual(pipelineResult.after_snapshot.snapshot_type, 'AFTER_REMEDIATION');
    assert.strictEqual(pipelineResult.final_reassessment.status, 'VERIFIED');
  });

  test.it('12. Stale evidence -> reject (NOT_VERIFIED)', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: [{ evidence_id: 'EVI-STALE', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', is_stale: true }],
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.match(result.rationale, /Stale Evidence Detected/);
  });

  test.it('13. Target mismatch -> reject (NOT_VERIFIED)', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: [{ evidence_id: 'EVI-OTHER', target_id: 'OTHER_TARGET', timestamp: new Date().toISOString(), status: 'PASS' }],
      target_id: 'TARGET_EXPECTED'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.match(result.rationale, /Target Mismatch/);
  });

  test.it('14. Temporal inversion -> reject in AssessmentSnapshot comparison', () => {
    const snapBefore = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION',
      target_id: 'TGT-SYS',
      evidence_ids: ['E1'],
      fact_ids: ['F1'],
      finding_ids: ['FND-1'],
      risk_level: 'HIGH',
      verification_status: 'NON_COMPLIANT',
      provenance: {
        execution_id: 'EXEC-BEFORE',
        executed_at: '2026-08-15T10:00:00.000Z',
        eos_version: '2.2.0',
        tool_or_collector: 'Engine',
        target_type: 'SOURCE_CODE',
        git_commit: '168aac'
      }
    });

    const snapAfterInverted = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION',
      target_id: 'TGT-SYS',
      evidence_ids: ['E2'],
      fact_ids: ['F1'],
      finding_ids: [],
      risk_level: 'LOW',
      verification_status: 'VERIFIED',
      provenance: {
        execution_id: 'EXEC-AFTER',
        executed_at: '2026-08-15T09:00:00.000Z', // Temporal Inversion! (09:00 < 10:00)
        eos_version: '2.2.0',
        tool_or_collector: 'Engine',
        target_type: 'SOURCE_CODE',
        git_commit: '95925f'
      }
    });

    assert.throws(() => {
      AssessmentSnapshot.compare(snapBefore, snapAfterInverted, [parseFindingId('FND-1')]);
    }, /INVALID_TEMPORAL_ORDER/);
  });
});
