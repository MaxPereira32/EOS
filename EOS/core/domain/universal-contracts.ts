/**
 * EOS PHASE 4.1 CANONICAL GOVERNANCE CONTRACTS
 * Domain-Agnostic, Strict & Immutably Verifiable Architecture Contracts
 */

export type EvidenceCategory =
  | 'STATIC'
  | 'UNIT'
  | 'SIMULATION'
  | 'EXECUTED'
  | 'CAUSALLY_VALIDATED'
  | 'SECURITY_PROVEN';

export type EvidenceState =
  | 'OBSERVED'
  | 'COLLECTED'
  | 'STATIC_CLASSIFIED'
  | 'SIMULATION_ONLY'
  | 'EXECUTED'
  | 'CAUSALLY_VALIDATED'
  | 'SECURITY_PROVEN'
  | 'BLOCKED'
  | 'INVALID'
  | 'UNVERIFIED'
  | 'TOOLING_FAILURE'
  | 'CAUSALITY_FAILED'
  | 'ARTIFACT_MISMATCH'
  | 'PROVENANCE_INVALID';

export type GateStatus = 'GREEN' | 'YELLOW' | 'RED' | 'BLOCKED';

export interface ArtifactFingerprint {
  readonly production_sha256: string;
  readonly execution_sha256: string;
  readonly ast_sha256: string;
  readonly is_bound: boolean;
  readonly resolved_realpath: string;
}

export interface ExecutionManifest {
  readonly execution_id: string;
  readonly process_id: number;
  readonly command_line: string;
  readonly working_directory: string;
  readonly exit_code: number;
  readonly stdout_bytes: number;
  readonly stderr_bytes: number;
  readonly start_timestamp_iso: string;
  readonly end_timestamp_iso: string;
  readonly duration_ms: number;
  readonly sanitized_environment: Record<string, string>;
  readonly bytes_transferred?: number;
}

export interface CausalityRequirement {
  readonly required: boolean;
  readonly strategy: string;
  readonly minimumKillRatio: number;
}

export interface ProvenanceRequirement {
  readonly required: boolean;
  readonly strictBindingRequired: boolean;
}

export interface GovernanceClaim {
  readonly claimId: string;
  readonly requirementId: string;
  readonly domain: string;
  readonly description: string;
  readonly targetArtifact: string;
  readonly requiredCategory: EvidenceCategory;
  readonly causalityRequirement: CausalityRequirement;
  readonly provenanceRequirement: ProvenanceRequirement;
}

export interface EvidenceEnvelope {
  readonly envelopeId: string;
  readonly claimId: string;
  readonly targetArtifact: string;
  readonly category: EvidenceCategory;
  readonly state: EvidenceState;
  readonly fingerprint: ArtifactFingerprint;
  readonly executionManifest?: ExecutionManifest;
  readonly is_simulation_only: boolean;
  readonly kill_ratio?: number;
  readonly hmac_signature: string;
  readonly blocking_reasons: readonly string[];
}

export interface CausalityResult {
  readonly claimId: string;
  readonly targetArtifact: string;
  readonly totalMutations: number;
  readonly killedMutations: number;
  readonly killRatio: number;
  readonly isCausallyValidated: boolean;
  readonly rationale: string;
}

export interface GateResult {
  readonly overall_phase_status: GateStatus;
  readonly can_grant_green: boolean;
  readonly can_grant_proven: boolean;
  readonly hard_violations: readonly string[];
}
