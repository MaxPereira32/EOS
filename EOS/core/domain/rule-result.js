/**
 * EOS Domain — RuleResult
 * 
 * Resultado da avaliação de uma regra declarativa.
 * Uma regra pode impactar múltiplos indicadores.
 */

class RuleResult {
  /**
   * @param {string} ruleId      - Ex: "RULE-CON-001"
   * @param {string} description - Descrição da política ativada
   * @param {Array<{indicator: string, penalty: number}>} impacts
   */
  constructor(ruleId, description, impacts) {
    this.ruleId = ruleId;
    this.description = description;
    this.impacts = impacts; // [{ indicator, penalty }]

    Object.freeze(this);
  }
}

module.exports = RuleResult;
