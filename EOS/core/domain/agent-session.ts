/**
 * EOS CORE DOMAIN - AGENT SESSION CONTRACTS
 * Dynamic execution session contract for active agent interactions.
 */

export interface AgentSession {
  readonly sessionId: string;
  readonly agentDefinitionId: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  readonly status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
}
