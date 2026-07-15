/**
 * EOS ACF Engine — Inventory Engine
 * 
 * Executa o Modelo 1: Inventário.
 * Orquestra a coleta de artefatos estruturados a partir dos adaptadores ativos,
 * consolidando uma lista única de fatos brutos de inventário.
 */

class InventoryEngine {
  /**
   * @param {import('../adapter-registry')} adapterRegistry
   */
  constructor(adapterRegistry) {
    this.registry = adapterRegistry;
  }

  /**
   * Executa a varredura e monta o inventário do projeto.
   * 
   * @param {object} config - Configurações extraídas do auditoria.json, ex: { adaptadores: { react: { path: "src/" }, css: { path: "styles/" } } }
   * @param {import('../../platform/execution-context')} context
   * @returns {import('../../domain/fact')[]} Lista de Fatos (ArtifactIdentified, ReferenceFound, DefinitionLocated)
   */
  execute(config, context) {
    console.log('[ACF Engine] Iniciando Modelo 1: Inventário...');
    let inventoryFacts = [];

    const adaptersConfig = config.adaptadores || {};
    const activeAdapterNames = Object.keys(adaptersConfig);

    const targetAdapters = activeAdapterNames.length > 0 
      ? activeAdapterNames.map(name => ({ name, adapter: this.registry.get(name) })).filter(x => x.adapter)
      : this.registry.getAll().map(adapter => ({ name: adapter.getName(), adapter }));

    if (targetAdapters.length === 0) {
      console.warn('[ACF Engine] Nenhum adaptador ativo ou registrado encontrado para o Inventário.');
      return [];
    }

    targetAdapters.forEach(({ name, adapter }) => {
      try {
        const adapterConfig = adaptersConfig[name] || {};
        console.log(`[ACF Engine] [Inventário] Executando adaptador: ${name}...`);
        const facts = adapter.collect(adapterConfig, context);
        inventoryFacts = inventoryFacts.concat(facts);
        console.log(`[ACF Engine] [Inventário] Adaptador [${name}] coletou ${facts.length} fatos de inventário.`);
      } catch (err) {
        console.error(`[-] Falha no Inventário do adaptador [${name}]: ${err.message}`);
      }
    });

    return inventoryFacts;
  }
}

module.exports = InventoryEngine;
