/**
 * EOS Engine — Metrics Engine v0.4.0
 * 
 * Calcula Metric[] derivadas a partir de CanonicalFacts.
 * Métricas são medidas calculadas. Não são avaliações.
 */

const Metric = require('../domain/metric');

class MetricsEngine {
  /**
   * @param {object} canonicalFacts
   * @returns {Metric[]}
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

    return [
      new Metric('totalErrors', totalErrors, 'soma de errors de todos os coletores'),
      new Metric('totalWarnings', totalWarnings, 'soma de warnings de todos os coletores'),
      new Metric('totalViolations', totalViolations, 'soma de violations de todos os coletores'),
      new Metric('totalTests', totalTests, 'passed + failed'),
      new Metric('testsPassed', testsPassed, 'testes aprovados'),
      new Metric('testsFailed', testsFailed, 'testes com falha'),
      new Metric('testFailureRate', testFailureRate, '(failed / total) * 100'),
      new Metric('errorDensity', totalErrors, 'total de erros (normalizável por KLOC)'),
      new Metric('warningDensity', totalWarnings, 'total de warnings'),
      new Metric('violationDensity', totalViolations, 'total de violações arquiteturais')
    ];
  }
}

module.exports = MetricsEngine;
