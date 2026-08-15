/**
 * EOS CORE DOMAIN - AGENT DEFINITION CONTRACTS
 * Static operational definition of AI Providers and Models.
 */

export interface AgentDefinition {
  readonly agentDefinitionId: string;
  readonly providerId: 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'CUSTOM_PROXY';
  readonly model: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly timeoutMs: number;
}
