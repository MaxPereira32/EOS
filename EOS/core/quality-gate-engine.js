/**
 * EOS Quality Gate Engine — v0.3.0
 * 
 * Decide aprovação ou reprovação com base em políticas de limiares.
 * Separado do Rule Engine: as regras calculam notas,
 * os gates decidem se as notas são aceitáveis.
 */

class QualityGateEngine {
  constructor() {
    // Políticas de Quality Gate: limiares mínimos por indicador
    this.gates = {
      ARQ: { min: 80, blocking: true },
      GOV: { min: 90, blocking: true },
      TST: { min: 90, blocking: true },
      EVO: { min: 80, blocking: true },
      ADQ: { min: 90, blocking: true },
      CON: { min: 90, blocking: true },
      CXA: { min: 80, blocking: true },
      PRP: { min: 90, blocking: true }
    };
  }

  /**
   * Avalia os indicadores contra os portões de qualidade.
   * @param {object} indicators - Saída do Rule Engine.
   * @returns {{ passed: boolean, results: object[], violations: object[] }}
   */
  evaluate(indicators) {
    const results = [];
    const violations = [];

    Object.keys(this.gates).forEach(key => {
      const gate = this.gates[key];
      const score = indicators[key];
      const passed = score !== undefined && score >= gate.min;

      const result = {
        indicator: key,
        score: score !== undefined ? score : 'N/A',
        min: gate.min,
        blocking: gate.blocking,
        passed
      };

      results.push(result);

      if (passed) {
        console.log(`[Gate ✓] ${key} = ${score}/100 (mínimo: ${gate.min})`);
      } else {
        console.error(`[Gate ❌] ${key} = ${score !== undefined ? score : 'N/A'}/100 (mínimo exigido: ${gate.min})`);
        if (gate.blocking) {
          violations.push(result);
        }
      }
    });

    const passed = violations.length === 0;
    return { passed, results, violations };
  }
}

module.exports = QualityGateEngine;
