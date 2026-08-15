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
    criteria: [
      { criterion_id: 'C1', description: 'Executable code tests defined', required: true },
      { criterion_id: 'C2', description: 'Tests executed and documented', required: true },
      { criterion_id: 'C3', description: 'Issues recorded and triaged', required: true },
      { criterion_id: 'C4', description: 'Remediation verified', required: true }
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
    authority_type: 'AUTHORITY_PROVEN',
    rationale: 'Maps directly to domain invariant testing and security compliance rule.'
  };

  const validProvenance = {
    tool_or_command: 'npx tsx EOS/tests/phase-nist-1-system-context.test.ts',
    exit_code: 0,
    execution_id: 'EXEC-TEST-01',
    git_commit: '95925f8d52ed9f616e973b3ba7f0d5b23a6a70e6',
    is_synthetic: false
  };

  const fullPassEvidences: EvidencePayload[] = [
    { evidence_id: 'EVI-C1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C1', provenance: validProvenance },
    { evidence_id: 'EVI-C2', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C2', provenance: validProvenance },
    { evidence_id: 'EVI-C3', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C3', provenance: validProvenance },
    { evidence_id: 'EVI-C4', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C4', provenance: validProvenance }
  ];

  const engine = new NistAssessmentEngine();
  const service = new AssessmentRemediationService();

  test.it('1. UNKNOWN applicability -> never VERIFIED', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: { requirement_id: 'PW.8.2', status: 'UNKNOWN' },
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: fullPassEvidences,
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
      facts: [],
      evidence: [],
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
      evidence: fullPassEvidences,
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'VERIFIED');
    assert.strictEqual(result.criterion_evaluations.every(c => c.status === 'SATISFIED'), true);
  });

  test.it('6. Contradictory evidence -> NON_COMPLIANT', () => {
    const failEvidences: EvidencePayload[] = [
      { evidence_id: 'EVI-FAIL', target_id: 'T1', timestamp: new Date().toISOString(), status: 'FAIL', criterion_id: 'C1', provenance: { ...validProvenance, exit_code: 1 } }
    ];

    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: failEvidences,
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
      has_authority: false,
      authority_type: 'AUTHORITY_ASSERTED',
      rationale: 'Unverified mapping'
    };

    assert.throws(() => {
      engine.assessRequirement({
        requirement: pw82Req,
        applicability: validApplicability,
        mapping: unauthMapping,
        facts: [],
        evidence: fullPassEvidences,
        target_id: 'T1'
      });
    }, /EQUIVALENT mapping requires explicit authority provenance/);
  });

  test.it('8. Authorized mapping != VERIFIED (Mapping with no evidence still yields NOT_VERIFIED)', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: [],
      evidence: [],
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.notStrictEqual(result.status, 'VERIFIED');
  });

  test.it('9. BEFORE state -> NON_COMPLIANT when failing evidence present', () => {
    const failingBeforeEvidences: EvidencePayload[] = [
      { evidence_id: 'EVI-BEFORE-FAIL', target_id: 'TGT-SYS', timestamp: new Date().toISOString(), status: 'FAIL', criterion_id: 'C1', provenance: { ...validProvenance, exit_code: 1 } }
    ];

    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-SYSCTX-01'],
      evidence: failingBeforeEvidences,
      target_id: 'TGT-SYS'
    });

    assert.strictEqual(result.status, 'NON_COMPLIANT');
  });

  test.it('10 & 11. End-to-End Remediation Pipeline: False Remediation BLOCKED & True Remediation VERIFIED with Real Execution', async () => {
    const failingBeforeEvidences: EvidencePayload[] = [
      { evidence_id: 'EVI-BEFORE-FAIL', target_id: 'TGT-SYS', timestamp: new Date().toISOString(), status: 'FAIL', criterion_id: 'C1', provenance: { ...validProvenance, exit_code: 1 } }
    ];

    const pipelineResult = await service.runFullRemediationPipeline({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      target_id: 'TGT-SYS',
      initial_evidence: failingBeforeEvidences,
      git_commit_before: '168aac69403a5ca47f6ad0d96ae6b598ea1c0263',
      git_commit_after: '95925f8d52ed9f616e973b3ba7f0d5b23a6a70e6'
    });

    assert.strictEqual(pipelineResult.initial_assessment.status, 'NON_COMPLIANT');
    assert.ok(pipelineResult.before_snapshot);
    assert.strictEqual(pipelineResult.before_snapshot.snapshot_type, 'BEFORE_REMEDIATION');

    assert.strictEqual(pipelineResult.false_fix_blocked, true);

    assert.ok(pipelineResult.after_snapshot);
    assert.strictEqual(pipelineResult.after_snapshot.snapshot_type, 'AFTER_REMEDIATION');
    assert.strictEqual(pipelineResult.final_reassessment.status, 'VERIFIED');
    assert.strictEqual(pipelineResult.after_snapshot.verification_status, 'VERIFIED');
  });

  test.it('12. Stale evidence -> reject (NOT_VERIFIED)', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: [{ evidence_id: 'EVI-STALE', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C1', provenance: validProvenance, is_stale: true }],
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
      evidence: [{ evidence_id: 'EVI-OTHER', target_id: 'OTHER_TARGET', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C1', provenance: validProvenance }],
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
        executed_at: '2026-08-15T09:00:00.000Z',
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

  test.it('15. One PASS Evidence does not satisfy all criteria', () => {
    const singlePassEvidence: EvidencePayload[] = [
      { evidence_id: 'EVI-C1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C1', provenance: validProvenance }
    ];

    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: singlePassEvidence,
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.strictEqual(result.criterion_evaluations.find(c => c.criterion_id === 'C1')?.status, 'SATISFIED');
    assert.strictEqual(result.criterion_evaluations.find(c => c.criterion_id === 'C2')?.status, 'NOT_VERIFIED');
  });

  test.it('16. Required criterion without evidence -> NOT_VERIFIED', () => {
    const partialEvidences: EvidencePayload[] = [
      { evidence_id: 'EVI-C1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C1', provenance: validProvenance },
      { evidence_id: 'EVI-C2', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C2', provenance: validProvenance }
      // Missing C3 and C4!
    ];

    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: partialEvidences,
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.match(result.rationale, /Incomplete Criterion Evaluation/);
  });

  test.it('17. Criterion-specific Evidence -> VERIFIED when all satisfied', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: fullPassEvidences,
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'VERIFIED');
  });

  test.it('18. Contradictory criterion Evidence -> NON_COMPLIANT', () => {
    const mixedEvidences: EvidencePayload[] = [
      { evidence_id: 'EVI-C1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C1', provenance: validProvenance },
      { evidence_id: 'EVI-C2-FAIL', target_id: 'T1', timestamp: new Date().toISOString(), status: 'FAIL', criterion_id: 'C2', provenance: { ...validProvenance, exit_code: 1 } }
    ];

    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: mixedEvidences,
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NON_COMPLIANT');
    assert.strictEqual(result.criterion_evaluations.find(c => c.criterion_id === 'C2')?.status, 'FAILED');
  });

  test.it('19. Synthetic Evidence cannot establish VERIFIED', () => {
    const syntheticEvidences: EvidencePayload[] = [
      { evidence_id: 'EVI-C1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C1', provenance: { ...validProvenance, is_synthetic: true } },
      { evidence_id: 'EVI-C2', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C2', provenance: { ...validProvenance, is_synthetic: true } },
      { evidence_id: 'EVI-C3', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C3', provenance: { ...validProvenance, is_synthetic: true } },
      { evidence_id: 'EVI-C4', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C4', provenance: { ...validProvenance, is_synthetic: true } }
    ];

    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: syntheticEvidences,
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.match(result.rationale, /Synthetic Evidence Guard/);
  });

  test.it('20. Missing provenance -> NOT_VERIFIED', () => {
    const noProvenanceEvidences: any[] = [
      { evidence_id: 'EVI-C1', target_id: 'T1', timestamp: new Date().toISOString(), status: 'PASS', criterion_id: 'C1' } // Missing provenance!
    ];

    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: noProvenanceEvidences,
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.match(result.rationale, /Missing Provenance/);
  });

  test.it('21. Fact without supporting Evidence -> NOT_VERIFIED', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-ORPHAN-01'], // Fact registered, but ZERO evidence payloads!
      evidence: [],
      target_id: 'T1'
    });

    assert.strictEqual(result.status, 'NOT_VERIFIED');
    assert.match(result.rationale, /Fact Without Supporting Evidence/);
  });

  test.it('22. AFTER status is derived exclusively by NistAssessmentEngine', async () => {
    const realEvidences = service.executeRealValidation('TGT-SYS', '95925f8d52ed9f616e973b3ba7f0d5b23a6a70e6');
    const assessment = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-SYSCTX-01'],
      evidence: realEvidences,
      target_id: 'TGT-SYS'
    });

    assert.strictEqual(assessment.status, 'VERIFIED');
  });

  test.it('23. AssessmentRemediationService cannot force VERIFIED on failing evidence', async () => {
    const failingEvidences: EvidencePayload[] = [
      { evidence_id: 'EVI-FAIL', target_id: 'TGT-SYS', timestamp: new Date().toISOString(), status: 'FAIL', criterion_id: 'C1', provenance: { ...validProvenance, exit_code: 1 } }
    ];

    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-SYSCTX-01'],
      evidence: failingEvidences,
      target_id: 'TGT-SYS'
    });

    assert.strictEqual(result.status, 'NON_COMPLIANT');
  });

  test.it('24. Invalid Finding reference cannot be treated as materialized Finding', () => {
    const result = engine.assessRequirement({
      requirement: pw82Req,
      applicability: validApplicability,
      mapping: authorizedMapping,
      facts: ['FACT-1'],
      evidence: [{ evidence_id: 'EVI-FAIL', target_id: 'T1', timestamp: new Date().toISOString(), status: 'FAIL', criterion_id: 'C1', provenance: { ...validProvenance, exit_code: 1 } }],
      target_id: 'T1'
    });

    assert.strictEqual(result.finding_materialization_status, 'FINDING_REFERENCE_ONLY');
    assert.strictEqual(result.finding_reference, 'FND-NST-PW.8.2');
  });

});
