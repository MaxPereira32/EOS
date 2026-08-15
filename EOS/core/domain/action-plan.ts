/**
 * EOS CORE DOMAIN - ACTION PLAN CONTRACTS
 * Immutable action plan contract with JCS RFC 8785 canonical hash.
 */

export interface ActionPlan {
  readonly planId: string;
  readonly findingId: string;
  readonly snapshotId: string;
  readonly agentDefinitionId: string;
  readonly userIntentDescription: string;
  readonly proposedChanges: readonly {
    readonly targetFilePath: string;
    readonly patchDiff: string;
    readonly riskRationale: string;
  }[];
  readonly canonicalizationVersion: 'JCS-RFC-8785-V1';
  readonly hashAlgorithm: 'SHA-256';
  readonly planHash: string; // SHA-256 of canonicalized ActionPlan
}
