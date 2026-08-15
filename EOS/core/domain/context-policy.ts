/**
 * EOS CORE DOMAIN - CONTEXT POLICY CONTRACTS
 * Server-side path resolution and Symlink substitution defense policy.
 */

export interface ContextPolicy {
  readonly policyId: string;
  readonly repositoryRoot: string; // Canonical realpath of workspace
  readonly deniedPatterns: readonly string[]; // [".env", ".git/*", "secrets/*", "**/*.pem"]
  readonly maxSnippetLines: number;
  readonly allowSymlinksOutsideRoot: false; // Fail-Closed Invariant
}
