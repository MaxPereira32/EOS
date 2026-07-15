/**
 * EOS Engine — Normalizer v0.4.0
 * 
 * Converte Fact[] brutos dos coletores em CanonicalFact[].
 * O Normalizer conhece o modelo canônico, mas não conhece os coletores.
 */

class Normalizer {
  /**
   * @param {import('../domain/fact')[]} facts
   * @returns {object} CanonicalFacts
   */
  normalize(facts) {
    const canonical = {
      errors: [],
      warnings: [],
      tests: { passed: 0, failed: 0, sources: [] },
      violations: []
    };

    facts.forEach(fact => {
      if (fact.metric.endsWith('.errors')) {
        canonical.errors.push({ source: fact.source, count: fact.value });
      } else if (fact.metric.endsWith('.warnings')) {
        canonical.warnings.push({ source: fact.source, count: fact.value });
      } else if (fact.metric.endsWith('.violations')) {
        canonical.violations.push({ source: fact.source, count: fact.value });
      } else if (fact.metric.endsWith('.passed')) {
        canonical.tests.passed += fact.value;
        if (!canonical.tests.sources.includes(fact.source)) {
          canonical.tests.sources.push(fact.source);
        }
      } else if (fact.metric.endsWith('.failed')) {
        canonical.tests.failed += fact.value;
        if (!canonical.tests.sources.includes(fact.source)) {
          canonical.tests.sources.push(fact.source);
        }
      } else if (fact.metric.startsWith('acf.')) {
        if (!canonical.acf) canonical.acf = {};
        // Para acf.inconsistency.detected e outros, acumulamos o valor numérico (ex: somamos inconsistências)
        canonical.acf[fact.metric] = (canonical.acf[fact.metric] || 0) + fact.value;
      }
    });

    return canonical;
  }
}

module.exports = Normalizer;
