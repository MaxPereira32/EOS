/**
 * EOS Metrics Engine — v0.3.0
 * 
 * Calcula métricas derivadas a partir dos fatos canônicos.
 * Métricas são medidas calculadas (densidades, taxas, proporções).
 * Elas ficam entre os fatos brutos e os indicadores de qualidade.
 * 
 * Fatos ──> Métricas ──> Indicadores
 *  (dados)   (medidas)    (avaliações)
 */

class MetricsEngine {
  /**
   * Calcula métricas derivadas a partir do modelo canônico.
   * @param {object} canonicalFacts - Saída do Normalizer.
   * @returns {object} Metrics
   */
  calculate(canonicalFacts) {
    const totalErrors = canonicalFacts.errors.reduce((sum, e) => sum + e.count, 0);
    const totalWarnings = canonicalFacts.warnings.reduce((sum, w) => sum + w.count, 0);
    const totalViolations = canonicalFacts.violations.reduce((sum, v) => sum + v.count, 0);

    const testsPassed = canonicalFacts.tests.passed || 0;
    const testsFailed = canonicalFacts.tests.failed || 0;
    const totalTests = testsPassed + testsFailed;

    const testFailureRate = totalTests > 0
      ? parseFloat(((testsFailed / totalTests) * 100).toFixed(2))
      : 0;

    return {
      totalErrors,
      totalWarnings,
      totalViolations,
      totalTests,
      testsPassed,
      testsFailed,
      testFailureRate,
      errorDensity: totalErrors,     // Pode ser normalizado por KLOC no futuro
      warningDensity: totalWarnings,
      violationDensity: totalViolations
    };
  }
}

module.exports = MetricsEngine;
