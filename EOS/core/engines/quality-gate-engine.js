/**
 * EOS Engine — Quality Gate Engine v0.4.0
 * 
 * Avalia Indicator[] contra limiares e decide aprovação ou reprovação.
 * Separado do Rule Engine: regras calculam notas, gates decidem se passam.
 */

class QualityGateEngine {
  constructor() {
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
   * @param {Object.<string, import('../domain/indicator')>} indicators
   * @returns {{ passed: boolean, results: object[], violations: object[] }}
   */
  evaluate(indicators) {
    const results = [];
    const violations = [];

    Object.keys(this.gates).forEach(key => {
      const gate = this.gates[key];
      const indicator = indicators[key];
      const score = indicator ? indicator.finalScore : 0;
      const passed = score >= gate.min;

      const result = { indicator: key, score, min: gate.min, blocking: gate.blocking, passed };
      results.push(result);

      if (passed) {
        console.log(`[Gate ✓] ${key} = ${score}/100 (mínimo: ${gate.min})`);
      } else {
        console.error(`[Gate ❌] ${key} = ${score}/100 (mínimo exigido: ${gate.min})`);
        if (gate.blocking) violations.push(result);
      }
    });

    return { passed: violations.length === 0, results, violations };
  }
}

module.exports = QualityGateEngine;
