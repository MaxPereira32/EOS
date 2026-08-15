/**
 * EOS CORE DOMAIN - CONTEXT SNAPSHOT CONTRACTS
 * Immutable snapshot contract for context sent to LLM providers.
 */

export interface ContextSnapshot {
  readonly snapshotId: string;
  readonly findingId: string;
  readonly evidenceIds: readonly string[];
  readonly resolvedCanonicalPaths: readonly string[];
  readonly snippetHashes: readonly string[]; // SHA-256 of sent snippets
  readonly policyHash: string;
  readonly snapshotHash: string; // SHA-256 of canonical snapshot
  readonly createdAt: string;
}
