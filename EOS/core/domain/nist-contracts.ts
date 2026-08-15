/**
 * EOS CONTINUOUS ARCHITECTURE - NIST DOMAIN CONTRACTS (v3.0.0)
 * 
 * Contratos formais e taxonômicos para avaliação de requisitos normativos NIST
 * (SSDF v1.1 / CSF v2.0) alinhados aos primitivos canônicos de governança do EOS.
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

export interface NistRequirement {
  readonly requirement_id: string; // ex: 'PW.8.2'
  readonly source: NistSource;
  readonly taxonomy_kind: NistTaxonomyKind;
  readonly title: string;
  readonly description: string;
  readonly operational_criteria: readonly string[]; // ex: C1 a C6
}

export interface ControlMapping {
  readonly requirement_id: string;
  readonly eos_rule_id: string;
  readonly relationship: MappingRelationship;
  readonly has_authority: boolean;
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
  readonly evaluated_criteria: readonly string[];
  readonly fact_ids: readonly string[];
  readonly evidence_ids: readonly string[];
  readonly finding_reference?: string;
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
