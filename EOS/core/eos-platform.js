#!/usr/bin/env node

/**
 * EOS Platform — v0.3.0
 * 
 * Orquestrador principal da plataforma de Continuous Architecture.
 * Conecta os 7 módulos via Event Bus em um pipeline unidirecional:
 * 
 *   Collectors ──> Normalizer ──> Metrics Engine ──> Rule Engine
 *        ──> Quality Gate Engine ──> Reporter
 * 
 * Ponto de entrada único que substitui a cadeia
 * "eos-collector.js && eos-validator.js" do v0.2.0.
 */

const fs = require('fs');
const path = require('path');

const EventBus = require('./event-bus');
const Normalizer = require('./normalizer');
const MetricsEngine = require('./metrics-engine');
const RuleEngine = require('./rule-engine');
const QualityGateEngine = require('./quality-gate-engine');
const Reporter = require('./reporter');

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

const bus = new EventBus();
const normalizer = new Normalizer();
const metricsEngine = new MetricsEngine();
const ruleEngine = new RuleEngine();
const gateEngine = new QualityGateEngine();
const reporter = new Reporter();

// Contexto compartilhado via eventos (não via arquivo)
const context = {
  projeto: auditData.projeto,
  perfil_arquitetural: auditData.perfil_arquitetural
};

// ── Wiring: registrar handlers no Event Bus ──────────────────────

bus.on('facts:collected', (rawFacts) => {
  context.rawFacts = rawFacts;
  const canonical = normalizer.normalize(rawFacts);
  bus.emit('facts:normalized', canonical);
});

bus.on('facts:normalized', (canonicalFacts) => {
  context.canonicalFacts = canonicalFacts;
  const metrics = metricsEngine.calculate(canonicalFacts);
  bus.emit('metrics:calculated', metrics);
});

bus.on('metrics:calculated', (metrics) => {
  context.metrics = metrics;
  const { indicators, appliedRules } = ruleEngine.evaluate(metrics);
  context.indicators = indicators;
  context.appliedRules = appliedRules;
  bus.emit('indicators:calculated', indicators);
});

bus.on('indicators:calculated', (indicators) => {
  const gateResults = gateEngine.evaluate(indicators);
  context.gateResults = gateResults;

  if (gateResults.passed) {
    bus.emit('gate:passed', gateResults);
  } else {
    bus.emit('gate:failed', gateResults);
  }
});

bus.on('gate:passed', () => {
  context.eventLog = bus.getLog();
  reporter.generate(context, outputDir);
  console.log('\n[🟢] APROVADO: Todos os portões de qualidade foram atendidos.');
  process.exit(0);
});

bus.on('gate:failed', (gateResults) => {
  context.eventLog = bus.getLog();
  reporter.generate(context, outputDir);
  const violationList = gateResults.violations.map(v => `${v.indicator}=${v.score} (min: ${v.min})`).join(', ');
  console.error(`\n[🔴] REPROVADO: Violações bloqueantes: ${violationList}`);
  process.exit(1);
});

// ── Fase de Coleta (carregar plugins) ────────────────────────────

console.log('╔══════════════════════════════════════════════════╗');
console.log('║       EOS Platform v0.3.0 — Pipeline Start      ║');
console.log('╚══════════════════════════════════════════════════╝\n');

const collectorsDir = path.join(__dirname, 'collectors');
const evidencias = auditData.evidencias || {};
const rawFacts = {};

const mapeamento = {
  linter_dependencias: 'depcruise',
  linter_codigo: 'eslint',
  testes_automatizados: (config) => {
    if (config.config_file.endsWith('.xml')) return 'phpunit';
    return 'vitest';
  }
};

// Carregar plugins disponíveis
const plugins = {};
if (fs.existsSync(collectorsDir)) {
  fs.readdirSync(collectorsDir).forEach(file => {
    if (file.endsWith('.js')) {
      const plugin = require(path.join(collectorsDir, file));
      plugins[plugin.name] = plugin;
    }
  });
}

// Executar coletores
Object.keys(evidencias).forEach(key => {
  const config = evidencias[key];
  if (config && config.executado) {
    let pluginName = mapeamento[key];
    if (typeof pluginName === 'function') pluginName = pluginName(config);

    const plugin = plugins[pluginName];
    if (plugin) {
      try {
        const facts = plugin.collect(config);
        rawFacts[pluginName] = facts;
        console.log(`[✓] Plugin [${pluginName}] coletou fatos.`);
      } catch (err) {
        console.error(`[-] Plugin [${pluginName}] falhou: ${err.message}`);
      }
    }
  }
});

// Disparar o pipeline via Event Bus
bus.emit('facts:collected', rawFacts);
