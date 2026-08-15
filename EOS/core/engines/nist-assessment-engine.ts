import { 
  NistRequirement, 
  NistApplicability, 
  ControlMapping, 
  NistAssessmentResult,
  validateNistApplicability,
  validateControlMapping
} from '../domain/nist-contracts';

export interface EvidencePayload {
  readonly evidence_id: string;
  readonly target_id: string;
  readonly timestamp: string;
  readonly status: 'PASS' | 'FAIL';
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

    // 2. Applicability Guard: UNKNOWN applicability can NEVER result in VERIFIED
    if (data.applicability.status === 'UNKNOWN') {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        evaluated_criteria: data.requirement.operational_criteria,
        fact_ids: data.facts,
        evidence_ids: data.evidence.map(e => e.evidence_id),
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
        evaluated_criteria: data.requirement.operational_criteria,
        fact_ids: data.facts,
        evidence_ids: [],
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
        evaluated_criteria: data.requirement.operational_criteria,
        fact_ids: data.facts,
        evidence_ids: data.evidence.map(e => e.evidence_id),
        status: 'NOT_VERIFIED',
        rationale: 'Mapping lacks explicit authority provenance; evaluation rejected.',
        limitations: ['UNAUTHORIZED_MAPPING'],
        evaluated_at
      };
    }

    // 5. Evidence Check & Target Mismatch Guard
    const validTargetEvidences = data.evidence.filter(e => e.target_id === data.target_id);
    if (validTargetEvidences.length === 0 && data.evidence.length > 0) {
      // All evidences belonged to other targets -> Target Mismatch
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        evaluated_criteria: data.requirement.operational_criteria,
        fact_ids: data.facts,
        evidence_ids: [],
        status: 'NOT_VERIFIED',
        rationale: 'Target Mismatch: Provided evidences do not correspond to target_id.',
        limitations: ['TARGET_MISMATCH'],
        evaluated_at
      };
    }

    // 6. Stale Evidence Guard
    const hasStaleEvidence = validTargetEvidences.some(e => e.is_stale === true);
    if (hasStaleEvidence) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        evaluated_criteria: data.requirement.operational_criteria,
        fact_ids: data.facts,
        evidence_ids: validTargetEvidences.map(e => e.evidence_id),
        status: 'NOT_VERIFIED',
        rationale: 'Stale Evidence Detected: Reused or expired evidence payload rejected.',
        limitations: ['STALE_EVIDENCE'],
        evaluated_at
      };
    }

    // 7. Contradictory Evidence Guard
    const hasFailingEvidence = validTargetEvidences.some(e => e.status === 'FAIL');
    if (hasFailingEvidence) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        evaluated_criteria: data.requirement.operational_criteria,
        fact_ids: data.facts,
        evidence_ids: validTargetEvidences.map(e => e.evidence_id),
        status: 'NON_COMPLIANT',
        finding_reference: `FND-NST-${data.requirement.requirement_id}`,
        rationale: 'Contradictory/Failing Evidence: Test execution reported vulnerability or invariant failure.',
        limitations: [],
        evaluated_at
      };
    }

    // 8. NO_FINDING != VERIFIED (Missing Evidence Guard)
    // Absence of findings without supporting positive evidence yields NOT_VERIFIED
    if (validTargetEvidences.length === 0) {
      return {
        assessment_id,
        requirement_id: data.requirement.requirement_id,
        framework: data.requirement.source.framework,
        version: data.requirement.source.version,
        applicability: data.applicability,
        mapping: data.mapping,
        evaluated_criteria: data.requirement.operational_criteria,
        fact_ids: data.facts,
        evidence_ids: [],
        status: 'NOT_VERIFIED',
        rationale: 'NO_FINDING != VERIFIED: Absence of findings without supporting positive evidence is insufficient for verification.',
        limitations: ['MISSING_EVIDENCE'],
        evaluated_at
      };
    }

    // 9. All Positive Criteria Satisfied -> VERIFIED
    return {
      assessment_id,
      requirement_id: data.requirement.requirement_id,
      framework: data.requirement.source.framework,
      version: data.requirement.source.version,
      applicability: data.applicability,
      mapping: data.mapping,
      evaluated_criteria: data.requirement.operational_criteria,
      fact_ids: data.facts,
      evidence_ids: validTargetEvidences.map(e => e.evidence_id),
      status: 'VERIFIED',
      rationale: `Operational criteria [${data.requirement.operational_criteria.join(', ')}] verified by valid evidence.`,
      limitations: [],
      evaluated_at
    };
  }
}
