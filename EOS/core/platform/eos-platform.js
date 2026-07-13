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

// Reporters
const JSONReporter = require('../reporters/json-reporter');
const MarkdownReporter = require('../reporters/markdown-reporter');

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
const jsonReporter = new JSONReporter();
const mdReporter = new MarkdownReporter();

// Objeto de execução (Execution) que acumula resultados
const execution = { context, rawFacts: [], metrics: [], indicators: {}, ruleResults: [], gateResults: {} };

// ── Wiring: registrar handlers no Event Bus ──────────────────────

bus.on('facts:collected', (facts) => {
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

// Executar coletores e acumular Fact[]
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

// Disparar o pipeline via Event Bus
bus.emit('facts:collected', allFacts);
