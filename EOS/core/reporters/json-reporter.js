/**
 * EOS Reporter — JSON Reporter v0.4.0
 */

const fs = require('fs');
const path = require('path');

class JSONReporter {
  generate(execution, outputDir) {
    const jsonPath = path.join(outputDir, 'auditoria.json');

    const indicatorsMap = {};
    Object.values(execution.indicators).forEach(ind => {
      indicatorsMap[ind.name] = ind.toJSON();
    });

    const metricsMap = {};
    execution.metrics.forEach(m => { metricsMap[m.name] = m.value; });

    let original = {};
    if (fs.existsSync(jsonPath)) {
      try {
        original = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (e) {}
    }

    const output = Object.assign({}, original, {
      $schema: 'http://json-schema.org/draft-07/schema#',
      versao_eos: '0.4.0',
      context: execution.context.toJSON(),
      indicadores: indicatorsMap,
      metricas: metricsMap,
      fatos_brutos: execution.rawFacts.map(f => ({ metric: f.metric, value: f.value, source: f.source, timestamp: f.timestamp, metadata: f.metadata })),
      regras_aplicadas: execution.ruleResults.map(r => ({ ruleId: r.ruleId, description: r.description, impacts: r.impacts })),
      quality_gates: execution.gateResults,
      eventos: execution.eventLog
    });

    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`[Reporter] JSON gerado em ${jsonPath}`);
  }
}

module.exports = JSONReporter;
