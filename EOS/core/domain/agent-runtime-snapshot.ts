/**
 * EOS CORE DOMAIN — AGENT RUNTIME SNAPSHOT CONTRACT
 * Captures exact immutable provenance of Agents, Prompts, Context Policies,
 * Model Configurations, Skills, Plugins, MCP Servers and LLM models participating in execution.
 */

export interface SkillProvenance {
  readonly skillId: string;
  readonly version: string;
  readonly contentHash: string;
  readonly origin: 'CORE' | 'AGENTS_DIR' | 'AGE_SUBMODULE' | 'PLUGIN';
}

export interface PluginProvenance {
  readonly pluginId: string;
  readonly name: string;
  readonly version: string;
  readonly contentHash: string;
  readonly configHash?: string;
  readonly permissionSetHash?: string;
  readonly permissions: readonly string[];
  readonly toolsProvided: readonly string[];
  readonly actualToolsUsed?: readonly string[];
}

export interface McpServerProvenance {
  readonly serverId: string;
  readonly version: string;
  readonly toolsProvided: readonly string[];
  readonly actualToolsUsed?: readonly string[];
  readonly resourcesProvided: readonly string[];
  readonly authenticated: boolean;
}

export interface AgentRuntimeSnapshot {
  readonly runtimeSnapshotId: string;
  readonly timestamp: string;
  readonly agentDefinitionId: string;
  readonly agentRole: 'Implementation Engineer' | 'Adversarial Reviewer' | 'Evidence Auditor' | 'Orchestrator';
  readonly agentVersion: string;
  readonly agentCommitHash?: string;
  
  // Proveniência Expandida de IA, Modelo e Contexto (Itens 5 & 9)
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly contextPolicyHash: string;
  readonly modelConfigurationHash: string;

  // Parâmetros de Inferência e Raciocínio (Item 9)
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly responseFormat?: string;
  readonly reasoningMode?: string;
  readonly toolConfigurationHash?: string;

  readonly skills: readonly SkillProvenance[];
  readonly plugins: readonly PluginProvenance[];
  readonly mcpServers: readonly McpServerProvenance[];
  readonly modelProvider: string;
  readonly modelName: string;
  readonly modelVersion?: string;
}
