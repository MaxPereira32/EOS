/**
 * EOS Domain — Indicator
 * 
 * Avaliação de qualidade final por dimensão.
 * Sempre inicia em 100 (nota máxima). Penalidades são subtrativas.
 */

class Indicator {
  /**
   * @param {string} name - Ex: "CON", "ARQ", "TST"
   */
  constructor(name) {
    this.name = name;
    this.baseScore = 100;
    this.penalties = []; // { ruleId: string, points: number }[]
  }

  /**
   * Aplica uma penalidade ao indicador.
   * @param {string} ruleId - Identificador da regra
   * @param {number} points - Pontos a deduzir
   */
  applyPenalty(ruleId, points) {
    this.penalties.push({ ruleId, points });
  }

  /** Calcula a nota final: base - soma(penalties), mínimo 0. */
  get finalScore() {
    const totalPenalty = this.penalties.reduce((sum, p) => sum + p.points, 0);
    return Math.max(0, this.baseScore - totalPenalty);
  }

  /** Serializa para JSON. */
  toJSON() {
    return {
      name: this.name,
      baseScore: this.baseScore,
      penalties: this.penalties,
      finalScore: this.finalScore
    };
  }
}

module.exports = Indicator;
