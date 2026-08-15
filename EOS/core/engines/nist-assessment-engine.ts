import { 
  NistRequirement, 
  NistApplicability, 
  ControlMapping, 
  NistAssessmentResult,
  CriterionEvaluationResult,
  validateNistApplicability,
  validateControlMapping
} from '../domain/nist-contracts';

export interface EvidenceProvenance {
  readonly tool_or_command: string;
  readonly exit_code: number;
  readonly execution_id: string;
  readonly git_commit?: string;
  readonly stdout_summary?: string;
  readonly is_synthetic?: boolean;
}

export interface EvidencePayload {
  readonly evidence_id: string;
  readonly target_id: string;
  readonly timestamp: string;
  readonly status: 'PASS' | 'FAIL';
  readonly criterion_id?: string;
  readonly provenance: EvidenceProvenance;
  readonly is_stale?: boolean;
}

export class NistAssessmentEngine {
  
  public assessRequirement(data: {
    requirement: NistRequirement;
    applicability: NistApplicability;
    mapping: ControlMapping;
    facts: readonly string[];
    evidence: readonly EvidencePayload[];
    target_id: string;
  }): NistAssessmentResult {
    
    // 1. Validar Invariantes de Entrada (Applicability & Mapping)
    validateNistApplicability(data.applicability);
    validateControlMapping(data.mapping);

    const assessment_id = `NST-ASSESS-${Date.now()}`;
    const evaluated_at = new Date().toISOString();

    const emptyCriterionEvaluations: CriterionEvaluationResult[] = data.requirement.criteria.map(c => ({
      criterion_id: c.criterion_id,
      status: 'UNKNOWN',
      evidence_ids: [],
      fact_ids: [],
      rationale: 'Assessment aborted prior to criterion evaluation.'
    }));

    // 2. Applicability Guard: UNKNOWN applicability can NEVER result in VERIFIED
    if (data.applicability.status === 'UNKNOWN') {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: emptyCriterionEvaluations,
        fact_ids: data.facts,
        evidence_ids: data.evidence.map(e => e.evidence_id),
        finding_materialization_status: 'NO_FINDING',
        status: 'UNKNOWN',
        rationale: 'Applicability is UNKNOWN; assessment cannot determine compliance or verification.',
        limitations: ['Applicability UNKNOWN'],
        evaluated_at
      };
    }

    // 3. Applicability Guard: NOT_APPLICABLE
    if (data.applicability.status === 'NOT_APPLICABLE') {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: data.requirement.criteria.map(c => ({
          criterion_id: c.criterion_id,
          status: 'NOT_VERIFIED',
          evidence_ids: [],
          fact_ids: [],
          rationale: 'Requirement is NOT_APPLICABLE.'
        })),
        fact_ids: data.facts,
        evidence_ids: [],
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_APPLICABLE',
        rationale: `Requirement is NOT_APPLICABLE: ${data.applicability.rationale}`,
        limitations: [],
        evaluated_at
      };
    }

    // 4. Mapping Authority Guard: Mapping without authority fails evaluation
    if (!data.mapping.has_authority) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: emptyCriterionEvaluations,
        fact_ids: data.facts,
        evidence_ids: data.evidence.map(e => e.evidence_id),
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_VERIFIED',
        rationale: 'Mapping lacks explicit authority provenance; evaluation rejected.',
        limitations: ['UNAUTHORIZED_MAPPING'],
        evaluated_at
      };
    }

    // 5. Provenance Presence Guard (Missing Provenance)
    const missingProvenance = data.evidence.some(e => !e.provenance || !e.provenance.tool_or_command);
    if (missingProvenance) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: emptyCriterionEvaluations,
        fact_ids: data.facts,
        evidence_ids: data.evidence.map(e => e.evidence_id),
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_VERIFIED',
        rationale: 'Missing Provenance: Evidence payload lacks valid provenance metadata.',
        limitations: ['MISSING_PROVENANCE'],
        evaluated_at
      };
    }

    // 6. Synthetic Evidence Guard (Synthetic Evidence cannot establish VERIFIED)
    const hasSyntheticEvidence = data.evidence.some(e => e.provenance.is_synthetic === true);
    if (hasSyntheticEvidence) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: emptyCriterionEvaluations,
        fact_ids: data.facts,
        evidence_ids: data.evidence.map(e => e.evidence_id),
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_VERIFIED',
        rationale: 'Synthetic Evidence Guard: Evidence manufactured directly by service (is_synthetic=true) is rejected.',
        limitations: ['SYNTHETIC_EVIDENCE_REJECTED'],
        evaluated_at
      };
    }

    // 7. Target Mismatch Guard
    const validTargetEvidences = data.evidence.filter(e => e.target_id === data.target_id);
    if (validTargetEvidences.length === 0 && data.evidence.length > 0) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: emptyCriterionEvaluations,
        fact_ids: data.facts,
        evidence_ids: [],
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_VERIFIED',
        rationale: 'Target Mismatch: Provided evidences do not correspond to target_id.',
        limitations: ['TARGET_MISMATCH'],
        evaluated_at
      };
    }

    // 8. Stale Evidence Guard
    const hasStaleEvidence = validTargetEvidences.some(e => e.is_stale === true);
    if (hasStaleEvidence) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: emptyCriterionEvaluations,
        fact_ids: data.facts,
        evidence_ids: validTargetEvidences.map(e => e.evidence_id),
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_VERIFIED',
        rationale: 'Stale Evidence Detected: Reused or expired evidence payload rejected.',
        limitations: ['STALE_EVIDENCE'],
        evaluated_at
      };
    }

    // 9. Fact without Evidence Guard
    if (data.facts.length > 0 && validTargetEvidences.length === 0) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: emptyCriterionEvaluations,
        fact_ids: data.facts,
        evidence_ids: [],
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_VERIFIED',
        rationale: 'Fact Without Supporting Evidence: Registered facts lack corresponding evidence payloads.',
        limitations: ['FACT_WITHOUT_EVIDENCE'],
        evaluated_at
      };
    }

    // 10. NO_FINDING != VERIFIED (Absence of evidence)
    if (validTargetEvidences.length === 0) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations: emptyCriterionEvaluations,
        fact_ids: data.facts,
        evidence_ids: [],
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_VERIFIED',
        rationale: 'NO_FINDING != VERIFIED: Absence of findings without supporting positive evidence is insufficient for verification.',
        limitations: ['MISSING_EVIDENCE'],
        evaluated_at
      };
    }

    // 11. INDIVIDUAL CRITERION EVALUATION
    const criterion_evaluations: CriterionEvaluationResult[] = data.requirement.criteria.map(crit => {
      // Find evidence matching this criterion (or general matching PASS evidence if no criterion_id specified on evidence)
      const matchingEvidences = validTargetEvidences.filter(e => !e.criterion_id || e.criterion_id === crit.criterion_id);
      
      const hasFail = matchingEvidences.some(e => e.status === 'FAIL');
      const hasPass = matchingEvidences.some(e => e.status === 'PASS');

      if (hasFail) {
        return {
          criterion_id: crit.criterion_id,
          status: 'FAILED',
          evidence_ids: matchingEvidences.filter(e => e.status === 'FAIL').map(e => e.evidence_id),
          fact_ids: data.facts,
          rationale: `Criterion ${crit.criterion_id} failed due to failing test execution.`
        };
      }

      if (hasPass) {
        return {
          criterion_id: crit.criterion_id,
          status: 'SATISFIED',
          evidence_ids: matchingEvidences.filter(e => e.status === 'PASS').map(e => e.evidence_id),
          fact_ids: data.facts,
          rationale: `Criterion ${crit.criterion_id} satisfied by valid evidence.`
        };
      }

      return {
        criterion_id: crit.criterion_id,
        status: 'NOT_VERIFIED',
        evidence_ids: [],
        fact_ids: [],
        rationale: `Criterion ${crit.criterion_id} has no matching evidence.`
      };
    });

    const anyFailed = criterion_evaluations.some(c => c.status === 'FAILED');
    const anyNotVerified = criterion_evaluations.some(c => c.status === 'NOT_VERIFIED' || c.status === 'UNKNOWN');

    if (anyFailed) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations,
        fact_ids: data.facts,
        evidence_ids: validTargetEvidences.map(e => e.evidence_id),
        finding_reference: `FND-NST-${data.requirement.requirement_id}`,
        finding_materialization_status: 'FINDING_REFERENCE_ONLY',
        status: 'NON_COMPLIANT',
        rationale: 'Contradictory/Failing Evidence: One or more required criteria failed evaluation.',
        limitations: [],
        evaluated_at
      };
    }

    if (anyNotVerified) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        criterion_evaluations,
        fact_ids: data.facts,
        evidence_ids: validTargetEvidences.map(e => e.evidence_id),
        finding_materialization_status: 'NO_FINDING',
        status: 'NOT_VERIFIED',
        rationale: 'Incomplete Criterion Evaluation: One or more operational criteria lack valid supporting evidence.',
        limitations: ['INCOMPLETE_CRITERIA_COVERAGE'],
        evaluated_at
      };
    }

    // 12. All Required Criteria Satisfied -> VERIFIED
    return {
      assessment_id,
      requirement_id: data.requirement.requirement_id,
      framework: data.requirement.source.framework,
      version: data.requirement.source.version,
      applicability: data.applicability,
      mapping: data.mapping,
      criterion_evaluations,
      fact_ids: data.facts,
      evidence_ids: validTargetEvidences.map(e => e.evidence_id),
      finding_materialization_status: 'NO_FINDING',
      status: 'VERIFIED',
      rationale: `All required criteria [${data.requirement.criteria.map(c => c.criterion_id).join(', ')}] evaluated as SATISFIED by valid evidence.`,
      limitations: [],
      evaluated_at
    };
  }
}
