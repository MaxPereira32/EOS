/**
 * EOS ACF Engine — Validation Engine
 * 
 * Executa o Modelo 6: Validação.
 * Roda novamente as engines de auditoria (Inventário, Correlação, Diagnóstico) no estado
 * atual pós-execução e valida se todas as inconsistências planejadas foram resolvidas.
 * Produz fatos ValidationExecuted.
 */

const ACFFacts = require('../domain/facts');

class ValidationEngine {
  /**
   * @param {object} engines - Referência para as engines principais: { inventoryEngine, correlationEngine, diagnosticEngine }
   */
  constructor(engines) {
    this.inventoryEngine = engines.inventoryEngine;
    this.correlationEngine = engines.correlationEngine;
    this.diagnosticEngine = engines.diagnosticEngine;
  }

  /**
   * Executa a auditoria pós-refatoração e valida o resultado.
   * 
   * @param {import('../../domain/fact')[]} changePlans - O plano de mudanças
   * @param {import('../../domain/fact')[]} appliedChanges - As mudanças aplicadas
   * @param {object} config - Configurações do auditoria.json
   * @param {import('../../platform/execution-context')} context
   * @returns {import('../../domain/fact')} Fato de resultado de validação
   */
  execute(changePlans, appliedChanges, config, context) {
    console.log('[ACF Engine] Iniciando Modelo 6: Validação de Estado Pós-Execução...');

    // 1. Reexecutar a auditoria reconstruindo o grafo semântico temporário
    const SemanticGraph = require('../../platform/semantic-graph');
    const tempGraph = new SemanticGraph();
    
    const freshInventory = this.inventoryEngine.execute(config, context);
    tempGraph.loadFacts(freshInventory);
    
    const freshCorrelation = this.correlationEngine.execute(tempGraph, context);
    tempGraph.loadFacts(freshCorrelation);

    // Obter o profile para tratar classes do Tailwind
    const DiscoveryEngine = require('./discovery-engine');
    const discovery = new DiscoveryEngine();
    const profileFact = discovery.execute(context);
    const profile = profileFact.metadata;

    const freshDiagnostics = this.diagnosticEngine.execute(tempGraph, config.politicas, profile);

    // Mapear os ids das inconsistências planejadas para resolução
    const resolvedInconsistencyIds = new Set();
    changePlans.forEach(plan => {
      if (plan.metadata.inconsistenciesResolved) {
        plan.metadata.inconsistenciesResolved.forEach(id => resolvedInconsistencyIds.add(id));
      }
    });

    // 2. Verificar se alguma das inconsistências planejadas ainda persiste
    const unresolved = [];
    freshDiagnostics.forEach(inc => {
      // Se a inconsistência identificada bate com alguma das que deveriam ser resolvidas
      if (resolvedInconsistencyIds.has(inc.metadata.inconsistencyId)) {
        unresolved.push(inc.metadata);
      }
    });

    const status = unresolved.length === 0 ? 'passed' : 'failed';
    console.log(`[ACF Engine] [Validação] Status: ${status === 'passed' ? '🟢 APROVADO' : '🔴 REPROVADO'} (${unresolved.length} não resolvidas)`);

    return ACFFacts.validationExecuted('validation-engine', {
      status,
      checksRun: resolvedInconsistencyIds.size,
      failures: unresolved
    });
  }
}

module.exports = ValidationEngine;
