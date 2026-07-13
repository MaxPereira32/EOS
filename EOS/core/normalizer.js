/**
 * EOS Normalizer — v0.3.0
 * 
 * Converte os fatos brutos heterogêneos dos coletores para um modelo
 * canônico padronizado do EOS. Os coletores ficam livres para retornar
 * qualquer formato; o Normalizer traduz tudo para o esquema interno.
 */

class Normalizer {
  /**
   * Transforma fatos brutos em CanonicalFacts.
   * @param {{ [collector: string]: object }} rawFacts
   * @returns {object} CanonicalFacts
   */
  normalize(rawFacts) {
    const canonical = {
      errors: [],
      warnings: [],
      tests: { passed: 0, failed: 0, sources: [] },
      violations: []
    };

    // ESLint
    if (rawFacts.eslint) {
      canonical.errors.push({
        source: 'eslint',
        count: rawFacts.eslint.errors || 0
      });
      canonical.warnings.push({
        source: 'eslint',
        count: rawFacts.eslint.warnings || 0
      });
    }

    // Dependency-Cruiser
    if (rawFacts.depcruise) {
      canonical.violations.push({
        source: 'depcruise',
        count: rawFacts.depcruise.violations || 0
      });
    }

    // Vitest
    if (rawFacts.vitest) {
      canonical.tests.passed += rawFacts.vitest.passed || 0;
      canonical.tests.failed += rawFacts.vitest.failed || 0;
      canonical.tests.sources.push('vitest');
    }

    // PHPUnit
    if (rawFacts.phpunit) {
      canonical.tests.failed += rawFacts.phpunit.failed || 0;
      canonical.tests.sources.push('phpunit');
    }

    return canonical;
  }
}

module.exports = Normalizer;
