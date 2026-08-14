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

export interface AuditReport {
  readonly audit_run_id: string;
  readonly timestamp: string;
  readonly target: AuditTarget;
  readonly coverage: CoverageMetrics;
  readonly findings: readonly Finding[];
  readonly rule_results: readonly RuleEvaluationResult[];
  readonly facts?: readonly Fact[];
  readonly evidences?: readonly Evidence[];
}

export * from './fact-repository';

