/**
 * EOS CONTINUOUS ARCHITECTURE - NIST DOMAIN CONTRACTS (v3.1.0)
 * 
 * Contratos formais e taxonômicos para avaliação de requisitos normativos NIST
 * (SSDF v1.1 / CSF v2.0) com suporte a avaliação individualizada de critérios
 * e rastreabilidade de prova não-sintética.
 */

export type NistFrameworkType = 'NIST_SSDF_V1.1' | 'NIST_CSF_V2';

export type NistTaxonomyKind = 
  | 'PRACTICE' 
  | 'TASK' 
  | 'FUNCTION' 
  | 'CATEGORY' 
  | 'SUBCATEGORY';

export type NistApplicabilityStatus = 
  | 'APPLICABLE' 
  | 'PARTIALLY_APPLICABLE' 
  | 'NOT_APPLICABLE' 
  | 'UNKNOWN';

export type NistAssessmentStatus = 
  | 'VERIFIED' 
  | 'PARTIALLY_VERIFIED' 
  | 'NOT_VERIFIED' 
  | 'NON_COMPLIANT' 
  | 'NOT_APPLICABLE' 
  | 'UNKNOWN';

export type CriterionStatus = 
  | 'SATISFIED' 
  | 'FAILED' 
  | 'NOT_VERIFIED' 
  | 'UNKNOWN';

export type MappingRelationship = 
  | 'EQUIVALENT' 
  | 'SUPPORTS' 
  | 'PARTIALLY_SUPPORTS' 
  | 'RELATED' 
  | 'NO_DIRECT_MAPPING';

export interface NistSource {
  readonly framework: NistFrameworkType;
  readonly version: string;
  readonly title: string;
  readonly official_url?: string;
  readonly retrieval_date: string;
}

export interface AssessmentCriterion {
  readonly criterion_id: string; // ex: 'C1', 'C2'
  readonly description: string;
  readonly required: boolean;
  readonly rule_reference?: string;
  readonly required_evidence_type?: string;
}

export interface CriterionEvaluationResult {
  readonly criterion_id: string;
  readonly status: CriterionStatus;
  readonly evidence_ids: readonly string[];
  readonly fact_ids: readonly string[];
  readonly rationale: string;
}

export interface NistRequirement {
  readonly requirement_id: string; // ex: 'PW.8.2'
  readonly source: NistSource;
  readonly taxonomy_kind: NistTaxonomyKind;
  readonly title: string;
  readonly description: string;
  readonly criteria: readonly AssessmentCriterion[];
}

export interface ControlMapping {
  readonly requirement_id: string;
  readonly eos_rule_id: string;
  readonly relationship: MappingRelationship;
  readonly has_authority: boolean;
  readonly authority_type: 'AUTHORITY_PROVEN' | 'AUTHORITY_ASSERTED';
  readonly rationale: string;
}

export interface NistApplicability {
  readonly requirement_id: string;
  readonly status: NistApplicabilityStatus;
  readonly rationale?: string;
  readonly provenance?: {
    readonly assessed_by: string;
    readonly timestamp: string;
  };
}

export interface NistAssessmentResult {
  readonly assessment_id: string;
  readonly requirement_id: string;
  readonly framework: NistFrameworkType;
  readonly version: string;
  readonly applicability: NistApplicability;
  readonly mapping: ControlMapping;
  readonly criterion_evaluations: readonly CriterionEvaluationResult[];
  readonly fact_ids: readonly string[];
  readonly evidence_ids: readonly string[];
  readonly finding_reference?: string;
  readonly finding_materialization_status: 'FINDING_MATERIALIZED' | 'FINDING_REFERENCE_ONLY' | 'NO_FINDING';
  readonly status: NistAssessmentStatus;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly evaluated_at: string;
}

/**
 * Guards de Invariante de Domínio NIST
 */
export function validateNistApplicability(app: NistApplicability): void {
  if (app.status === 'NOT_APPLICABLE') {
    if (!app.rationale || app.rationale.trim() === '') {
      throw new Error('NIST Invariant Violation: NOT_APPLICABLE requires an explicit rationale.');
    }
  }
}

export function validateControlMapping(mapping: ControlMapping): void {
  if (mapping.relationship === 'EQUIVALENT' && !mapping.has_authority) {
    throw new Error('NIST Invariant Violation: EQUIVALENT mapping requires explicit authority provenance.');
  }
}
