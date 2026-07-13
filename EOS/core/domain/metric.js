/**
 * EOS Domain — Metric
 * 
 * Medida derivada calculada a partir de fatos canônicos.
 * Métricas ficam entre fatos (dados) e indicadores (avaliações).
 */

class Metric {
  /**
   * @param {string} name    - Ex: "errorDensity", "testFailureRate"
   * @param {number} value   - Valor numérico calculado
   * @param {string} formula - Descrição humana da fórmula aplicada
   */
  constructor(name, value, formula) {
    if (!name || typeof name !== 'string') {
      throw new Error(`[Metric] Campo "name" é obrigatório. Recebido: ${name}`);
    }
    if (typeof value !== 'number') {
      throw new Error(`[Metric] Campo "value" deve ser numérico. Recebido: ${typeof value}`);
    }

    this.name = name;
    this.value = value;
    this.formula = formula || '';

    Object.freeze(this);
  }
}

module.exports = Metric;
