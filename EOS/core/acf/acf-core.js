/**
 * EOS ACF Core — Orquestrador do Artifact Consistency Framework (ACF)
 * 
 * Coordena a execução do pipeline completo composto pelos 8 modelos analíticos
 * em sequência lógica e integrada ao ecossistema do EOS.
 */

const AdapterRegistry = require('./adapter-registry');
const DiscoveryEngine = require('./engines/discovery-engine'); // Fase 0
const InventoryEngine = require('./engines/inventory-engine'); // Fase 3
const CorrelationEngine = require('./engines/correlation-engine'); // Fase 4
const DiagnosticEngine = require('./engines/diagnostic-engine'); // Fase 5
const ComplexityEngine = require('./engines/complexity-engine'); // Fase 6
const PlanningEngine = require('./engines/planning-engine'); // Fase 7
const ExecutionEngine = require('./engines/execution-engine'); // Fase 8
const ValidationEngine = require('./engines/validation-engine'); // Fase 9
const RegressionEngine = require('./engines/regression-engine'); // Fase 10
const ACFMetricsEngine = require('./engines/metrics-engine'); // Fase 11
const ReportingEngine = require('./engines/reporting-engine'); // Fase 12

class ACFPlatform {
  /**
   * Instancia a plataforma do ACF com todas as engines e registros.
   */
  constructor() {
    this.registry = new AdapterRegistry();
    this.discoveryEngine = new DiscoveryEngine();
    this.inventoryEngine = new InventoryEngine(this.registry);
    this.correlationEngine = new CorrelationEngine(this.registry);
    this.diagnosticEngine = new DiagnosticEngine();
    this.complexityEngine = new ComplexityEngine();
    this.planningEngine = new PlanningEngine();
    this.executionEngine = new ExecutionEngine(this.registry);
    
    // O ValidationEngine requer referências às engines de auditoria para reexecutá-las
    this.validationEngine = new ValidationEngine({
      inventoryEngine: this.inventoryEngine,
      correlationEngine: this.correlationEngine,
      diagnosticEngine: this.diagnosticEngine
    });

    this.regressionEngine = new RegressionEngine();
    this.metricsEngine = new ACFMetricsEngine();
    this.reportingEngine = new ReportingEngine();
  }

  /**
   * Executa o pipeline completo do ACF de forma integrada.
   * 
   * @param {object} config - Objeto de configuração do auditoria.json
   * @param {import('../platform/execution-context')} context - Contexto de execução atual
   * @param {object} options - Parâmetros extras de runtime (ex: { execute: false, outputDir: "...", historicalReport: null })
   * @returns {Promise<{ facts: import('../domain/fact')[], metrics: import('../domain/metric')[], mdReport: string }>}
   */
  async run(config, context, options = {}) {
    console.log('\n================================================================');
    console.log('       Artifact Consistency Framework (ACF) — Execução v1.0.0  ');
    console.log('================================================================');

    const acfConfig = config.acf || config.pcf || {};
    const outputDir = options.outputDir || process.cwd();

    const SemanticGraph = require('../platform/semantic-graph');
    const semanticGraph = options.semanticGraph || new SemanticGraph();

    let allCycleFacts = [];

    // --- Fase 0: Descoberta Arquitetural ---
    const profileFact = this.discoveryEngine.execute(context);
    allCycleFacts.push(profileFact);

    // --- Fase 1: Resolução de Adaptadores ---
    const profile = profileFact.metadata;
    const resolvedAdapterNames = [];
    if (profile.frameworks.includes('React')) resolvedAdapterNames.push('react');
    if (profile.styling.includes('CSS') || profile.styling.includes('TailwindCSS') || profile.styling.includes('SCSS/SASS')) {
      resolvedAdapterNames.push('css');
    }
    
    // Caso nenhum seja inferido, usar os adaptadores ativos configurados ou todos os registrados
    const configuredAdapterNames = Object.keys(acfConfig.adaptadores || {});
    const targetAdapterNames = configuredAdapterNames.length > 0
      ? configuredAdapterNames
      : (resolvedAdapterNames.length > 0 ? resolvedAdapterNames : this.registry.getAll().map(a => a.getName()));

    const activeAdapters = targetAdapterNames
      .map(name => this.registry.get(name))
      .filter(Boolean);

    console.log(`[ACF Engine] [Fase 1] Adaptadores resolvidos e ativos: ${activeAdapters.map(a => a.getName()).join(', ')}`);

    // --- Fase 2: Resolução de Policies ---
    // Caso nenhuma policy/politica esteja configurada, o motor de diagnóstico usará os padrões universais
    const policies = acfConfig.politicas || {};
    console.log(`[ACF Engine] [Fase 2] Políticas carregadas (Conformidade com ${Object.keys(policies).length} diretrizes).`);

    // --- Fase 3: Inventário Global ---
    const inventoryFacts = [];
    activeAdapters.forEach(adapter => {
      try {
        const adapterConfig = (acfConfig.adaptadores && acfConfig.adaptadores[adapter.getName()]) || {};
        console.log(`[ACF Engine] [Fase 3] Rodando inventário do adaptador: ${adapter.getName()}...`);
        const facts = adapter.collect(adapterConfig, context);
        inventoryFacts.push(...facts);
      } catch (err) {
        console.error(`[-] Falha no Inventário do adaptador [${adapter.getName()}]: ${err.message}`);
      }
    });
    allCycleFacts.push(...inventoryFacts);

    // --- Fase 4: Correlação ---
    semanticGraph.loadFacts(inventoryFacts);
    const dependencyFacts = this.correlationEngine.execute(semanticGraph, context);
    semanticGraph.loadFacts(dependencyFacts);
    allCycleFacts.push(...dependencyFacts);

    // --- Fase 5: Diagnóstico ---
    const rawInconsistencyFacts = this.diagnosticEngine.execute(semanticGraph, policies, profile);

    // --- Fase 7: Planejamento ---
    const rawPlans = this.planningEngine.execute(rawInconsistencyFacts, context);

    // --- Architecture Review Mode (ARM-001) ---
    const ArchitectureReviewMode = require('../platform/architecture-review-mode');
    const arm = new ArchitectureReviewMode();
    const armResult = await arm.process(rawInconsistencyFacts, rawPlans, context, options);

    const inconsistencyFacts = armResult.facts;
    const plans = armResult.plans;

    allCycleFacts.push(...inconsistencyFacts);

    // --- Fase 6: Análise de Complexidade ---
    const complexityFacts = this.complexityEngine.execute(semanticGraph, context);
    allCycleFacts.push(...complexityFacts);

    allCycleFacts.push(...plans);

    // --- Fase 8: Execução ---
    const execOptions = { execute: !!(options.execute || acfConfig.execute) };
    const appliedChanges = await this.executionEngine.execute(plans, execOptions, context);
    allCycleFacts.push(...appliedChanges);

    // --- Fase 9: Validação ---
    let validationFacts = [];
    if (execOptions.execute && plans.length > 0) {
      const validationFact = this.validationEngine.execute(plans, appliedChanges, acfConfig, context);
      validationFacts.push(validationFact);
      allCycleFacts.push(validationFact);
    }

    // --- Fase 10: Regressão ---
    const regressionReport = this.regressionEngine.execute(inconsistencyFacts, options.historicalReport);

    // --- Fase 11: Métricas ---
    const acfMetrics = this.metricsEngine.calculate(allCycleFacts);
    
    // Injetar métricas como fatos estruturados
    const Fact = require('../domain/fact');
    const acfMetricsFacts = acfMetrics.map(m => new Fact({
      metric: m.name,
      value: m.value,
      source: 'acf-metrics-engine',
      metadata: { formula: m.formula }
    }));
    allCycleFacts.push(...acfMetricsFacts);

    // --- Fase 12: Relatório Arquitetural ---
    const mdReport = this.reportingEngine.execute({
      facts: allCycleFacts,
      metrics: acfMetrics,
      regression: regressionReport
    }, outputDir);

    console.log('================================================================\n');

    return {
      facts: allCycleFacts,
      metrics: acfMetrics,
      mdReport
    };
  }
}

module.exports = ACFPlatform;
