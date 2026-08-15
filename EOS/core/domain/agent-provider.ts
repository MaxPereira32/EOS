export type AgentProviderType = 
  | 'OPENAI' 
  | 'ANTHROPIC' 
  | 'GEMINI' 
  | 'ANTIGRAVITY' 
  | 'LOCAL_MODEL' 
  | 'ENTERPRISE_AGENT' 
  | 'CUSTOM';

export type AgentProviderStatus = 'UNCONFIGURED' | 'CONFIGURED' | 'READY' | 'DISABLED';

export interface AgentProvider {
  readonly id: string;
  readonly name: string;
  readonly type: AgentProviderType;
  readonly status: AgentProviderStatus;
  readonly isDefault?: boolean;
  readonly description?: string;
}
