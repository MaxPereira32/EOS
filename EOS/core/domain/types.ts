/**
 * EOS CONTINUOUS ARCHITECTURE - CANONICAL DOMAIN CONTRACTS (v4.8.0)
 * Strict, Immutable & Verifiable Architecture Contracts
 */

export interface AuditTarget {
  readonly target_id: string;
  readonly root_path: string;
  readonly repository: string | null;
  readonly commit_hash: string | null;
  readonly branch: string | null;
  readonly metadata: Record<string, string>;
}

export type ArtifactStatus = 'ACCESSIBLE' | 'IGNORED' | 'ERROR';

export interface FileArtifact {
  readonly relative_path: string;
  readonly absolute_path: string;
  readonly file_extension: string;
  readonly size_bytes: number;
  readonly sha256_hash: string;
  readonly status: ArtifactStatus;
  readonly error_message?: string;
}

export interface Observation {
  readonly observation_id: string;
  readonly observation_type: 'FILE_METADATA' | 'DIRECTORY_LISTING';
  readonly source: string;
  readonly source_hash: string;
  readonly captured_at: string;
  readonly collector_id: string;
  readonly metadata: Record<string, string>;
}

export type AstEvidenceMetadata = {
  readonly kind: 'MODULE_IMPORT';
  readonly specifier: string;
  readonly import_type: 'STATIC' | 'DYNAMIC';
};

export interface Evidence {
  readonly evidence_id: string;
  readonly observation_id: string;
  readonly collector_id: string;
  readonly source_reference: string;
  readonly locator: {
    readonly relative_path: string;
    readonly line?: number;
  };
  readonly source_hash: string;
  readonly content_hash: string;
  readonly snippet: string;
  readonly confidence: number;
  readonly provenance: {
    readonly target_id: string;
    readonly collector_version: string;
  };
  readonly ast_metadata?: AstEvidenceMetadata;
}

export type ResolutionKind = 'INTERNAL' | 'EXTERNAL' | 'UNRESOLVED' | 'AMBIGUOUS';
export type ResolutionStrategy = 'RELATIVE' | 'PATH_ALIAS' | 'PACKAGE' | 'SYMLINK' | 'UNRESOLVED' | 'AMBIGUOUS';
export type ResolutionType = 'RELATIVE' | 'PATH_ALIAS' | 'EXTERNAL_PACKAGE' | 'PACKAGE' | 'SYMLINK' | 'UNRESOLVED' | 'AMBIGUOUS';

export interface ModuleResolution {
  readonly kind: ResolutionKind;
  readonly strategy: ResolutionStrategy;
  readonly specifier: string;
  readonly canonical_module: string | null;
  readonly candidates: readonly string[];
  readonly resolution_type: ResolutionType;
  readonly is_external: boolean;
}

export type FactPayload =
  | {
      readonly fact_type: 'FILE_STRUCTURE';
      readonly directory: string;
      readonly naming_convention: string;
      readonly status: 'PRESENT' | 'ABSENCE_VERIFIED' | 'INSUFFICIENT_EVIDENCE';
    }
  | {
      readonly fact_type: 'MODULE_DEPENDENCY';
      readonly source_module: string;
      readonly target_module: string;
      readonly import_type: 'STATIC' | 'DYNAMIC';
      readonly resolution_kind?: ResolutionKind;
      readonly resolution_strategy?: ResolutionStrategy;
    };

export type FactLifecycleStatus = 'VALID' | 'SUPERSEDED';

export const FACT_SCHEMA_VERSION_1_0 = '1.0';

export interface Fact {
  readonly fact_id: string;
  readonly schema_version: string; // Centralized version constant "1.0"
  readonly fact_type: FactPayload['fact_type'];
  readonly provider_id: string;
  readonly provider_version: string;
  readonly evidence_ids: readonly string[]; // Non-empty
  readonly input_hash: string; // Deterministic SHA-256 of sorted evidence inputs / physical provenance
  readonly semantic_hash: string; // Deterministic SHA-256 of pure semantic assertion
  readonly lifecycle_status: FactLifecycleStatus; // 'VALID' | 'SUPERSEDED'
  readonly payload: FactPayload;
  readonly composite_confidence: number;
  readonly created_at: string;
}

export type RuleStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT_EVIDENCE' | 'ERROR';

export interface RuleEvaluationResult {
  readonly rule_id: string;
  readonly rule_version: string;
  readonly status: RuleStatus;
  readonly rationale: string;
  readonly facts_used: readonly string[];
}

export interface Finding {
  readonly finding_id: string;
  readonly rule_id: string;
  readonly rule_version: string;
  readonly fact_ids: readonly string[];
  readonly evidence_ids: readonly string[];
  readonly target_id: string;
  readonly location: string;
  readonly title: string;
  readonly description: string;
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  readonly confidence: number;
  readonly status: 'OPEN' | 'MITIGATED' | 'FALSE_POSITIVE';
  readonly timestamp: string;
}

export interface CoverageMetrics {
  readonly files_discovered: number;
  readonly files_analyzed: number;
  readonly files_skipped: number;
  readonly files_errored: number;
  readonly files_inaccessible: number;
  readonly directories_discovered: number;
  readonly directories_skipped: number;
  readonly symlinks_discovered: number;
  readonly symlinks_skipped: number;
}

export type EvidenceCategory = 'STATIC' | 'UNIT' | 'SIMULATION' | 'INTEGRATION' | 'RUNTIME' | 'CAUSAL';
export type RuntimeEnvironmentType = 'NONE' | 'JS_MOCK' | 'FIREBASE_RULES_EMULATOR' | 'HTTP_RUNTIME' | 'DB_RUNTIME';
export type CausalityVerificationStatus = 'UNVERIFIED' | 'CORRELATED' | 'PROVEN_CAUSAL' | 'CAUSALITY_FAILED';
export type GatePhaseStatus = 'GREEN' | 'YELLOW' | 'RED' | 'BLOCKED';

export interface ThreatModelVector {
  readonly vector_id: 'UNAUTHENTICATED_ACCESS' | 'UNAUTHORIZED_MUTATION' | 'PRIVILEGE_ESCALATION' | 'FIELD_INJECTION' | 'FIELD_DELETION' | 'IDENTITY_SWAP' | 'LEGITIMATE_OPERATION';
  readonly description: string;
  readonly required: boolean;
  readonly verified: boolean;
}

export interface SecurityDataContract {
  readonly resource_path: string;
  readonly policy_mode: 'DEFAULT_DENY' | 'WHITELIST' | 'BLACK_LIST';
  readonly fields: Record<string, {
    readonly sensitivity: 'SAFE' | 'BUSINESS_SENSITIVE' | 'SECURITY_SENSITIVE' | 'IDENTITY_SENSITIVE';
    readonly allowed_writers: ('ADMIN' | 'USER' | 'SYSTEM')[];
    readonly mutability_policy: 'IMMUTABLE' | 'WHITELIST_ONLY' | 'MUTABLE';
  }>;
}

export interface CausalityMutationResult {
  readonly mutation_id: string;
  readonly target_artifact: string;
  readonly mutation_description: string;
  readonly original_status: 'PASS' | 'FAIL';
  readonly mutated_status: 'PASS' | 'FAIL';
  readonly causality_proven: boolean;
  readonly validation_evidence?: Readonly<Record<string, unknown>>;
  readonly rationale: string;
}

export interface FormalEvidence {
  readonly evidence_id: string;
  readonly category: EvidenceCategory;
  readonly source_artifact: string;
  readonly test_artifact?: string;
  readonly runtime_environment: RuntimeEnvironmentType;
  readonly causality_status: CausalityVerificationStatus;
  readonly confidence_score: number;
  readonly source_reliability: number;
  readonly reproducible: boolean;
  readonly is_simulation_only: boolean;
  readonly payload?: Record<string, any>;
}

export interface SecurityClaimEvaluation {
  readonly claim_id: string;
  readonly claim_type: 'FIRESTORE_RULES' | 'HTTP_ROUTE' | 'AUTHORIZATION' | 'AUTHENTICATION' | 'DATA_MUTABILITY';
  readonly target_artifact: string;
  readonly evidence: FormalEvidence;
  readonly security_contract?: SecurityDataContract;
  readonly threat_vectors: readonly ThreatModelVector[];
  readonly mutation_result?: CausalityMutationResult;
  readonly proven: boolean;
  readonly phase_status: GatePhaseStatus;
  readonly blocking_reasons: readonly string[];
}

/** Evidência de uma validação realmente executada durante a auditoria. */
export interface ExecutionEvidence {
  readonly check_id: string;
  readonly command_line: string;
  readonly working_directory: string;
  readonly exit_code: number;
  readonly state: 'PASS' | 'FAIL' | 'NOT_AVAILABLE';
  readonly duration_ms: number;
  readonly stdout_sha256: string;
  readonly stderr_sha256: string;
  readonly output_excerpt: string;
}

export interface AuditReport {
  readonly audit_run_id: string;
  readonly timestamp: string;
  readonly target: AuditTarget;
  readonly coverage: CoverageMetrics;
  readonly findings: readonly Finding[];
  readonly rule_results: readonly RuleEvaluationResult[];
  readonly facts?: readonly Fact[];
  readonly evidences?: readonly Evidence[];
  readonly formal_evidences?: readonly FormalEvidence[];
  readonly execution_evidences?: readonly ExecutionEvidence[];
  readonly security_claims?: readonly SecurityClaimEvaluation[];
  readonly overall_phase_status?: GatePhaseStatus;
}

export * from './fact-repository';
export * from './universal-contracts';


