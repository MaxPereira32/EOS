/**
 * EOS CORE DOMAIN — MCP & PLUGIN GOVERNANCE REGISTRY
 * Enforces explicit classification, permissions, configuration hashes and integrity verification
 * for Plugins and MCP Servers.
 */

import { PluginProvenance, McpServerProvenance } from './agent-runtime-snapshot';

export class McpPluginRegistry {
  private static registeredPlugins: Map<string, PluginProvenance> = new Map();
  private static registeredMcpServers: Map<string, McpServerProvenance> = new Map();

  public static registerPlugin(plugin: PluginProvenance): void {
    if (!plugin.pluginId || !plugin.version || !plugin.contentHash) {
      throw new Error('PLUGIN_REGISTRY_ERROR: Dados de plugin inválidos ou sem hash de conteúdo.');
    }
    this.registeredPlugins.set(plugin.pluginId, plugin);
  }

  public static registerMcpServer(server: McpServerProvenance): void {
    if (!server.serverId || !server.version) {
      throw new Error('MCP_REGISTRY_ERROR: Servidor MCP inválido.');
    }
    this.registeredMcpServers.set(server.serverId, server);
  }

  public static verifyPluginIntegrity(
    pluginId: string,
    expectedContentHash: string,
    expectedConfigHash?: string,
    expectedPermissionHash?: string
  ): void {
    const registered = this.registeredPlugins.get(pluginId);
    if (!registered) {
      throw new Error(`PLUGIN_RUNTIME_INTEGRITY_VIOLATION: Plugin '${pluginId}' não está registrado na governança.`);
    }
    if (registered.contentHash !== expectedContentHash) {
      throw new Error(`PLUGIN_RUNTIME_INTEGRITY_VIOLATION: Adulteração de conteúdo detectada no plugin '${pluginId}'. Hash esperado ${expectedContentHash}, obtido ${registered.contentHash}.`);
    }
    if (expectedConfigHash && registered.configHash !== expectedConfigHash) {
      throw new Error(`PLUGIN_RUNTIME_INTEGRITY_VIOLATION: Configuração alterada no plugin '${pluginId}'. ConfigHash esperado ${expectedConfigHash}, obtido ${registered.configHash}.`);
    }
    if (expectedPermissionHash && registered.permissionSetHash !== expectedPermissionHash) {
      throw new Error(`PLUGIN_RUNTIME_INTEGRITY_VIOLATION: Permissões alteradas no plugin '${pluginId}'. PermissionHash esperado ${expectedPermissionHash}, obtido ${registered.permissionSetHash}.`);
    }
  }

  public static verifyMcpServerIntegrity(serverId: string, expectedTools: readonly string[]): void {
    const registered = this.registeredMcpServers.get(serverId);
    if (!registered) {
      throw new Error(`MCP_RUNTIME_INTEGRITY_VIOLATION: Servidor MCP '${serverId}' não está registrado na governança.`);
    }
    for (const tool of expectedTools) {
      if (!registered.toolsProvided.includes(tool)) {
        throw new Error(`MCP_RUNTIME_INTEGRITY_VIOLATION: Ferramenta MCP '${tool}' ausente no servidor '${serverId}'.`);
      }
    }
  }

  public static getActivePlugins(): readonly PluginProvenance[] {
    return Array.from(this.registeredPlugins.values());
  }

  public static getActiveMcpServers(): readonly McpServerProvenance[] {
    return Array.from(this.registeredMcpServers.values());
  }

  public static reset(): void {
    this.registeredPlugins.clear();
    this.registeredMcpServers.clear();
  }
}
