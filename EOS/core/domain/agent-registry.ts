/**
 * EOS CORE DOMAIN - AGENT REGISTRY CONTRACTS
 * Defines sanitized provider registry metadata for the Web UI.
 */

export interface AgentRegistryEntry {
  readonly agentDefinitionId: string;
  readonly providerId: 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'CUSTOM_PROXY';
  readonly modelName: string;
  readonly status: 'CONFIGURED' | 'UNCONFIGURED' | 'DISABLED';
  readonly keyFingerprint?: string;
  readonly configuredAt?: string;
}
