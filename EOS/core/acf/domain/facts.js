const Fact = require('../../domain/fact');
const Artifact = require('./artifact');
const Reference = require('./reference');
const Dependency = require('./dependency');
const Inconsistency = require('./inconsistency');
const RefactoringPlan = require('./refactoring-plan');

class ACFFacts {
  /**
   * Fato 1: Artefato identificado no inventário.
   * @param {string} source - O nome do adaptador (ex: "react-adapter")
   * @param {object} metadata - Metadados do artefato (id, name, type, path)
   * @returns {Fact}
   */
  static artifactIdentified(source, metadata) {
    const art = new Artifact(metadata.id, metadata.name, metadata.type, metadata.path, metadata.details);
    return new Fact({
      metric: 'acf.artifact.identified',
      value: 1,
      source: source,
      metadata: {
        id: art.id,
        name: art.name,
        type: art.type,
        path: art.path,
        details: art.details
      }
    });
  }

  /**
   * Fato 2: Referência encontrada para outro elemento.
   * @param {string} source - O nome do adaptador
   * @param {object} metadata - Metadados da referência (from, to, type, location)
   * @returns {Fact}
   */
  static referenceFound(source, metadata) {
    const ref = new Reference(metadata.from, metadata.to, metadata.type, metadata.location);
    return new Fact({
      metric: 'acf.reference.found',
      value: 1,
      source: source,
      metadata: {
        from: ref.from,
        to: ref.to,
        type: ref.type,
        location: ref.location
      }
    });
  }

  /**
   * Fato 3: Definição localizada no código.
   * @param {string} source - O nome do adaptador
   * @param {object} metadata - Metadados da definição (artifactId, location)
   * @returns {Fact}
   */
  static definitionLocated(source, metadata) {
    if (!metadata.artifactId || !metadata.location) {
      throw new Error('[ACF Facts] Fato DefinitionLocated exige artifactId e location no metadata.');
    }
    return new Fact({
      metric: 'acf.definition.located',
      value: 1,
      source: source,
      metadata: {
        artifactId: metadata.artifactId,
        location: {
          file: metadata.location.file || 'unknown',
          line: typeof metadata.location.line === 'number' ? metadata.location.line : 0,
          column: typeof metadata.location.column === 'number' ? metadata.location.column : 0
        }
      }
    });
  }

  /**
   * Fato 4: Dependência estabelecida (relação bidirecional ou estrutural).
   * @param {string} source - O nome da engine ou adaptador
   * @param {object} metadata - Metadados da dependência (from, to, type)
   * @returns {Fact}
   */
  static dependencyEstablished(source, metadata) {
    const dep = new Dependency(metadata.from, metadata.to, metadata.type);
    return new Fact({
      metric: 'acf.dependency.established',
      value: 1,
      source: source,
      metadata: {
        from: dep.from,
        to: dep.to,
        type: dep.type
      }
    });
  }

  /**
   * Fato 5: Inconsistência detectada no diagnóstico.
   * @param {string} source - O nome do adaptador ou engine
   * @param {object} metadata - Metadados (inconsistencyId, type, description, severity, artifactsAffected)
   * @returns {Fact}
   */
  static inconsistencyDetected(source, metadata) {
    const inc = new Inconsistency(
      metadata.inconsistencyId,
      metadata.type,
      metadata.description,
      metadata.severity,
      metadata.artifactsAffected || [],
      metadata.confidenceScore,
      metadata.details
    );
    const severities = { low: 1, medium: 2, high: 3, critical: 4 };
    const numericValue = severities[inc.severity] || 1;

    return new Fact({
      metric: 'acf.inconsistency.detected',
      value: numericValue,
      source: source,
      metadata: {
        inconsistencyId: inc.inconsistencyId,
        type: inc.type,
        description: inc.description,
        severity: inc.severity,
        artifactsAffected: inc.artifactsAffected,
        confidenceScore: inc.confidenceScore,
        details: inc.details
      }
    });
  }

  /**
   * Fato 6: Alteração planejada.
   * @param {string} source - O nome da engine de planejamento
   * @param {object} metadata - Metadados (changeId, target, description, impact, risk)
   * @returns {Fact}
   */
  static changePlanned(source, metadata) {
    const plan = new RefactoringPlan(
      metadata.changeId,
      metadata.target,
      metadata.description,
      metadata.actions || ['Refatoração geral de consistência estrutural'],
      metadata.risks || { level: 'low', description: 'Baixo risco operacional' },
      metadata.dependencies || [],
      metadata.rollback || 'Nenhum rollback necessário',
      metadata.estimatedImpact || 'low',
      metadata.confidenceScore || 1.0,
      metadata.inconsistenciesResolved || []
    );
    return new Fact({
      metric: 'acf.change.planned',
      value: 1,
      source: source,
      metadata: {
        changeId: plan.changeId,
        target: plan.target,
        description: plan.description,
        actions: plan.actions,
        risks: plan.risks,
        dependencies: plan.dependencies,
        rollback: plan.rollback,
        estimatedImpact: plan.estimatedImpact,
        confidenceScore: plan.confidenceScore,
        inconsistenciesResolved: plan.inconsistenciesResolved
      }
    });
  }

  /**
   * Fato 7: Alteração aplicada.
   * @param {string} source - O nome da engine de execução
   * @param {object} metadata - Metadados (changeId, status, details)
   * @returns {Fact}
   */
  static changeApplied(source, metadata) {
    if (!metadata.changeId || !metadata.status) {
      throw new Error('[ACF Facts] Fato ChangeApplied exige changeId e status.');
    }
    return new Fact({
      metric: 'acf.change.applied',
      value: metadata.status === 'success' ? 1 : 0,
      source: source,
      metadata: {
        changeId: metadata.changeId,
        status: metadata.status, // success, failed, skipped
        details: metadata.details || {}
      }
    });
  }

  /**
   * Fato 8: Validação executada.
   * @param {string} source - A engine de validação
   * @param {object} metadata - Metadados (status, checksRun, failures)
   * @returns {Fact}
   */
  static validationExecuted(source, metadata) {
    if (!metadata.status || metadata.checksRun === undefined) {
      throw new Error('[ACF Facts] Fato ValidationExecuted exige status e checksRun.');
    }
    return new Fact({
      metric: 'acf.validation.executed',
      value: metadata.status === 'passed' ? 1 : 0,
      source: source,
      metadata: {
        status: metadata.status, // passed, failed
        checksRun: metadata.checksRun,
        failures: metadata.failures || []
      }
    });
  }

  /**
   * Fato 9: Perfil arquitetural descoberto (Fase 0).
   * @param {string} source - A engine de descoberta
   * @param {object} metadata - Perfil arquitetural descoberto
   * @returns {Fact}
   */
  static profileDiscovered(source, metadata) {
    return new Fact({
      metric: 'acf.profile.discovered',
      value: 1,
      source: source,
      metadata: {
        languages: metadata.languages || [],
        frameworks: metadata.frameworks || [],
        structure: metadata.structure || {},
        styling: metadata.styling || [],
        namingConventions: metadata.namingConventions || [],
        designSystem: metadata.designSystem || {},
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Fato 10: Análise de complexidade estrutural (Fase 6).
   * @param {string} source - A engine de complexidade
   * @param {object} metadata - Métricas de complexidade do artefato
   * @returns {Fact}
   */
  static complexityAnalyzed(source, metadata) {
    if (!metadata.artifactId) {
      throw new Error('[ACF Facts] Fato ComplexityAnalyzed exige artifactId.');
    }
    return new Fact({
      metric: 'acf.complexity.analyzed',
      value: typeof metadata.complexityIndex === 'number' ? metadata.complexityIndex : 0,
      source: source,
      metadata: {
        artifactId: metadata.artifactId,
        complexityIndex: metadata.complexityIndex || 0,
        couplingIndex: metadata.couplingIndex || 0,
        cohesionIndex: metadata.cohesionIndex || 0,
        reusedTimes: metadata.reusedTimes || 0,
        factors: metadata.factors || []
      }
    });
  }
}

module.exports = ACFFacts;
