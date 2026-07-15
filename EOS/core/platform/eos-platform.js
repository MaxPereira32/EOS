#!/usr/bin/env node

/**
 * EOS Platform — v0.4.0
 * 
 * Orquestrador central da plataforma de Continuous Architecture.
 * Conecta os 7 módulos via Event Bus tipado com ExecutionContext.
 * 
 * Fluxo:
 *   Collectors ──> Normalizer ──> Metrics Engine ──> Rule Engine
 *        ──> Quality Gate Engine ──> Reporters
 */

const fs = require('fs');
const path = require('path');

// Platform
const EventBus = require('./event-bus');
const ExecutionContext = require('./execution-context');

// Engines
const Normalizer = require('../engines/normalizer');
const MetricsEngine = require('../engines/metrics-engine');
const RuleEngine = require('../engines/rule-engine');
const QualityGateEngine = require('../engines/quality-gate-engine');
const DependencyEngine = require('../engines/dependency-engine');
const SecurityEngine = require('../engines/security-engine');
const ArchitectureDiffEngine = require('../engines/architecture-diff-engine');
const ArchitectureIdentityEngine = require('../engines/architecture-identity-engine');

// Reporters
const JSONReporter = require('../reporters/json-reporter');
const MarkdownReporter = require('../reporters/markdown-reporter');

// ACF
const ACFPlatform = require('../acf/acf-core');
const ReactAdapter = require('../acf/adapters/react-adapter');
const CSSAdapter = require('../acf/adapters/css-adapter');

const acfPlatform = new ACFPlatform();
acfPlatform.registry.register(new ReactAdapter());
acfPlatform.registry.register(new CSSAdapter());

// Semantic Graph
const SemanticGraph = require('./semantic-graph');
const semanticGraph = new SemanticGraph();

// ── Bootstrap ────────────────────────────────────────────────────

const jsonPath = path.join(process.cwd(), '.eos', 'auditorias', 'auditoria.json');
const outputDir = path.join(process.cwd(), '.eos', 'auditorias');

if (!fs.existsSync(jsonPath)) {
  console.error('[-] Erro: .eos/auditorias/auditoria.json não encontrado.');
  process.exit(1);
}

let auditData;
try {
  auditData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (e) {
  console.error(`[-] Falha de Sintaxe: ${e.message}`);
  process.exit(1);
}

// ── Instanciar Módulos ───────────────────────────────────────────

const context = new ExecutionContext(auditData);
const bus = new EventBus(context);
const normalizer = new Normalizer();
const metricsEngine = new MetricsEngine();
const ruleEngine = new RuleEngine();
const gateEngine = new QualityGateEngine();
const dependencyEngine = new DependencyEngine();
const securityEngine = new SecurityEngine();
const diffEngine = new ArchitectureDiffEngine();
const identityEngine = new ArchitectureIdentityEngine();
const jsonReporter = new JSONReporter();
const mdReporter = new MarkdownReporter();

// Objeto de execução (Execution) que acumula resultados e expõe o grafo semântico
const execution = { context, rawFacts: [], metrics: [], indicators: {}, ruleResults: [], gateResults: {}, semanticGraph, archDiff: null };

// ── Wiring: registrar handlers no Event Bus ──────────────────────

bus.on('facts:collected', (facts) => {
  execution.rawFacts = facts;
  
  // 1. Alimentar o grafo semântico compartilhado com os fatos coletados na rodada
  semanticGraph.loadFacts(facts);
  // Carrega o metamodelo de conhecimento (Knowledge Graph)
  semanticGraph.loadKnowledgeModel(auditData.acf || auditData.pcf);
  
  // 2. Executar Dependency Engine
  const depViolations = dependencyEngine.evaluate(semanticGraph, auditData);
  if (depViolations.length > 0) {
    facts = facts.concat(depViolations);
    semanticGraph.loadFacts(depViolations);
  }

  // 3. Executar Security Engine
  const secViolations = securityEngine.evaluate(semanticGraph, auditData);
  if (secViolations.length > 0) {
    facts = facts.concat(secViolations);
    semanticGraph.loadFacts(secViolations);
  }

  // 4. Executar Architecture Diff Engine
  const { facts: diffFacts, diff } = diffEngine.compare(semanticGraph, auditData);
  execution.archDiff = diff;
  if (diffFacts.length > 0) {
    facts = facts.concat(diffFacts);
    semanticGraph.loadFacts(diffFacts);
  }

  // 5. Executar Architecture Identity Engine (AIE)
  const aieViolations = identityEngine.evaluate(semanticGraph, auditData);
  if (aieViolations.length > 0) {
    facts = facts.concat(aieViolations);
    semanticGraph.loadFacts(aieViolations);
  }

  execution.rawFacts = facts;
  
  const canonical = normalizer.normalize(facts);
  bus.emit('facts:normalized', canonical);
});

bus.on('facts:normalized', (canonicalFacts) => {
  const metrics = metricsEngine.calculate(canonicalFacts);
  execution.metrics = metrics;
  bus.emit('metrics:calculated', metrics);
});

bus.on('metrics:calculated', (metrics) => {
  const { indicators, ruleResults } = ruleEngine.evaluate(metrics);
  execution.indicators = indicators;
  execution.ruleResults = ruleResults;
  bus.emit('indicators:calculated', indicators);
});

bus.on('indicators:calculated', (indicators) => {
  const gateResults = gateEngine.evaluate(indicators);
  execution.gateResults = gateResults;

  if (gateResults.passed) {
    bus.emit('gate:passed', gateResults);
  } else {
    bus.emit('gate:failed', gateResults);
  }
});

bus.on('gate:passed', () => {
  execution.eventLog = bus.getLog();
  jsonReporter.generate(execution, outputDir);
  mdReporter.generate(execution, outputDir);
  console.log('\n[🟢] APROVADO: Todos os portões de qualidade foram atendidos.');
  process.exit(0);
});

bus.on('gate:failed', (gateResults) => {
  execution.eventLog = bus.getLog();
  jsonReporter.generate(execution, outputDir);
  mdReporter.generate(execution, outputDir);
  const violationList = gateResults.violations.map(v => `${v.indicator}=${v.score} (min: ${v.min})`).join(', ');
  console.error(`\n[🔴] REPROVADO: Violações bloqueantes: ${violationList}`);
  process.exit(1);
});

// ── Fase de Coleta ───────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║         EOS Platform v0.4.0 — Pipeline Start               ║');
console.log(`║  Projeto: ${context.project.padEnd(20)} Branch: ${context.branch.padEnd(15)} ║`);
console.log(`║  Commit:  ${context.commit.padEnd(20)} Ambiente: ${context.environment.padEnd(13)} ║`);
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const collectorsDir = path.join(__dirname, '../collectors');
const evidencias = auditData.evidencias || {};
let allFacts = [];

const mapeamento = {
  linter_dependencias: 'depcruise',
  linter_codigo: 'eslint',
  testes_automatizados: (config) => config.config_file.endsWith('.xml') ? 'phpunit' : 'vitest'
};

// Carregar plugins
const plugins = {};
if (fs.existsSync(collectorsDir)) {
  fs.readdirSync(collectorsDir).forEach(file => {
    if (file.endsWith('.js')) {
      const plugin = require(path.join(collectorsDir, file));
      plugins[plugin.name] = plugin;
    }
  });
}

// Executar coletores e acumular Fact[] de forma assíncrona
(async () => {
  Object.keys(evidencias).forEach(key => {
    const config = evidencias[key];
    if (config && config.executado) {
      let pluginName = mapeamento[key];
      if (typeof pluginName === 'function') pluginName = pluginName(config);

      const plugin = plugins[pluginName];
      if (plugin) {
        try {
          const facts = plugin.collect(config);
          allFacts = allFacts.concat(facts);
          console.log(`[✓] Plugin [${pluginName}] coletou ${facts.length} fatos.`);
        } catch (err) {
          console.error(`[-] Plugin [${pluginName}] falhou: ${err.message}`);
        }
      }
    }
  });

  // Executar ACF se configurado no auditoria.json
  if (auditData.acf || auditData.pcf) {
    try {
      const acfResult = await acfPlatform.run(auditData, context, {
        outputDir: outputDir,
        historicalReport: auditData,
        semanticGraph: semanticGraph
      });
      allFacts = allFacts.concat(acfResult.facts);
      
      // Carregar também no grafo semântico os fatos deduzidos pelo diagnóstico/planejamento do ACF
      semanticGraph.loadFacts(acfResult.facts);
      
      console.log(`[✓] ACF coletou ${acfResult.facts.length} fatos estruturados.`);
    } catch (err) {
      console.error(`[-] Falha na execução do ACF: ${err.message}`);
    }
  }

  // Disparar o pipeline via Event Bus
  bus.emit('facts:collected', allFacts);
})();
