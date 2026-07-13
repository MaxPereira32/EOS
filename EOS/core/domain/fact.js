/**
 * EOS Domain — Fact
 * 
 * Dado bruto, atômico e imutável extraído de um Collector.
 * Após criação, nenhum módulo downstream pode alterá-lo.
 */

class Fact {
  /**
   * @param {object} data
   * @param {string} data.metric   - Ex: "eslint.errors", "vitest.passed"
   * @param {number} data.value    - Valor numérico (obrigatório)
   * @param {string} data.source   - Nome do collector
   * @param {object} [data.metadata] - Dados auxiliares opcionais
   */
  constructor(data) {
    if (!data.metric || typeof data.metric !== 'string') {
      throw new Error(`[Fact] Campo "metric" é obrigatório e deve ser string. Recebido: ${data.metric}`);
    }
    if (typeof data.value !== 'number') {
      throw new Error(`[Fact] Campo "value" deve ser numérico. Recebido: ${typeof data.value} (${data.value})`);
    }
    if (!data.source || typeof data.source !== 'string') {
      throw new Error(`[Fact] Campo "source" é obrigatório e deve ser string. Recebido: ${data.source}`);
    }

    this.metric = data.metric;
    this.value = data.value;
    this.source = data.source;
    this.timestamp = new Date().toISOString();
    this.metadata = data.metadata || {};

    // Imutável após criação
    Object.freeze(this);
  }
}

module.exports = Fact;
