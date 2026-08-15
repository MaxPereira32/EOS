/**
 * EOS CORE DOMAIN - AGENT INTERACTION CONTRACTS
 * AI assertion audit log contract, decoupled from evidence authority.
 */

export type OutputRetentionPolicy = 'PERSIST_FULL' | 'PERSIST_REDACTED' | 'PERSIST_HASH_ONLY';

export interface AgentInteraction {
  readonly interactionId: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly promptTokensUsed: number;
  readonly completionTokensUsed: number;
  readonly retentionPolicy: OutputRetentionPolicy;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly outputPayload?: string;
  readonly timestamp: string;
}
