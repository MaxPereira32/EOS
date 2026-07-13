/**
 * EOS Rule Engine (Declarativo) — v0.3.0
 * 
 * Interpreta regras declarativas do diretório rules/ e aplica penalizações
 * aos indicadores com base nas métricas calculadas pelo Metrics Engine.
 * 
 * O Rule Engine NÃO contém lógica de negócio.
 * Ele apenas avalia condições ("when") e aplica consequências ("then")
 * definidas externamente em arquivos JSON.
 */

const fs = require('fs');
const path = require('path');

class RuleEngine {
  constructor(rulesPath) {
    const resolvedPath = rulesPath || path.join(__dirname, 'rules', 'default-rules.json');
    this.rules = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  /**
   * Avalia uma condição "when" contra as métricas.
   * @param {object} condition - Bloco "when" da regra.
   * @param {object} metrics - Saída do Metrics Engine.
   * @returns {boolean}
   */
  _evaluateCondition(condition, metrics) {
    const metricValue = metrics[condition.metric];
    if (metricValue === undefined) return false;

    switch (condition.operator) {
      case 'greater_than': return metricValue > condition.value;
      case 'less_than': return metricValue < condition.value;
      case 'equals': return metricValue === condition.value;
      case 'greater_or_equal': return metricValue >= condition.value;
      case 'less_or_equal': return metricValue <= condition.value;
      default: return false;
    }
  }

  /**
   * Calcula a penalidade definida no bloco "then".
   * @param {object} action - Bloco "then" da regra.
   * @param {object} metrics - Saída do Metrics Engine.
   * @returns {number} Pontos a serem deduzidos.
   */
  _calculatePenalty(action, metrics) {
    if (action.action === 'penalty') {
      return action.points;
    }
    if (action.action === 'penalty_per_unit') {
      const units = metrics[action.metric] || 0;
      const raw = units * action.points_per_unit;
      return Math.min(raw, action.max_penalty || raw);
    }
    return 0;
  }

  /**
   * Processa todas as regras declarativas contra as métricas.
   * @param {object} metrics - Saída do Metrics Engine.
   * @returns {{ indicators: object, appliedRules: object[] }}
   */
  evaluate(metrics) {
    // Todos os indicadores começam em 100 (nota máxima)
    const indicators = {
      ARQ: 100, GOV: 100, TST: 100, EVO: 100,
      ADQ: 100, CON: 100, CXA: 100, PRP: 100
    };

    const appliedRules = [];

    this.rules.forEach(rule => {
      if (this._evaluateCondition(rule.when, metrics)) {
        const penalty = this._calculatePenalty(rule.then, metrics);
        indicators[rule.indicator] = Math.max(0, indicators[rule.indicator] - penalty);
        appliedRules.push({
          id: rule.id,
          indicator: rule.indicator,
          description: rule.description,
          penalty
        });
        console.log(`[Rule] ${rule.id}: ${rule.description} ──> -${penalty} em ${rule.indicator} (nova nota: ${indicators[rule.indicator]})`);
      }
    });

    return { indicators, appliedRules };
  }
}

module.exports = RuleEngine;
