/**
 * EOS Engine — Rule Engine Declarativo v0.4.0
 * 
 * Interpreta regras declarativas JSON.
 * Não contém lógica de negócio imperativa.
 * Usa apenas operações seguras: "linear", "fixed", "threshold".
 * Uma regra pode impactar múltiplos indicadores via campo "impacts".
 */

const fs = require('fs');
const path = require('path');
const Indicator = require('../domain/indicator');
const RuleResult = require('../domain/rule-result');

const OPERATORS = {
  gt: (a, b) => a > b,
  lt: (a, b) => a < b,
  eq: (a, b) => a === b,
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b
};

class RuleEngine {
  constructor(rulesPath) {
    const resolved = rulesPath || path.join(__dirname, '..', 'rules', 'default-rules.json');
    this.rules = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }

  /**
   * Converte Metric[] em mapa nome->valor para lookup rápido.
   * @param {import('../domain/metric')[]} metrics
   * @returns {{ [name: string]: number }}
   */
  _metricsToMap(metrics) {
    const map = {};
    metrics.forEach(m => { map[m.name] = m.value; });
    return map;
  }

  /**
   * Calcula penalidade com operações seguras (sem eval de strings).
   * @param {object} then  - Bloco "then" da regra declarativa
   * @param {{ [name: string]: number }} metricsMap
   * @returns {number}
   */
  _calculatePenalty(then, metricsMap) {
    if (then.type === 'fixed') {
      return then.points;
    }
    if (then.type === 'linear') {
      const units = metricsMap[then.metric] || 0;
      const raw = units * then.factor;
      return Math.min(raw, then.limit || raw);
    }
    if (then.type === 'threshold') {
      return then.points;
    }
    return 0;
  }

  /**
   * Avalia todas as regras contra as métricas e retorna indicadores e resultados.
   * @param {import('../domain/metric')[]} metrics
   * @returns {{ indicators: Object.<string, Indicator>, ruleResults: RuleResult[] }}
   */
  evaluate(metrics) {
    const metricsMap = this._metricsToMap(metrics);

    // Criar todos os indicadores com score base 100
    const INDICATOR_NAMES = ['ARQ', 'GOV', 'TST', 'EVO', 'ADQ', 'CON', 'CXA', 'PRP'];
    const indicators = {};
    INDICATOR_NAMES.forEach(name => { indicators[name] = new Indicator(name); });

    const ruleResults = [];

    this.rules.forEach(rule => {
      const metricValue = metricsMap[rule.when.metric];
      const comparator = OPERATORS[rule.when.operator];

      if (metricValue !== undefined && comparator && comparator(metricValue, rule.when.value)) {
        const penalty = this._calculatePenalty(rule.then, metricsMap);
        const impacts = (rule.impacts || []).map(indicatorName => {
          if (indicators[indicatorName]) {
            indicators[indicatorName].applyPenalty(rule.id, penalty);
          }
          return { indicator: indicatorName, penalty };
        });

        const result = new RuleResult(rule.id, rule.description, impacts);
        ruleResults.push(result);

        console.log(`[Rule] ${rule.id}: ${rule.description} ──> -${penalty} em [${rule.impacts.join(', ')}]`);
      }
    });

    return { indicators, ruleResults };
  }
}

module.exports = RuleEngine;
