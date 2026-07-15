/**
 * EOS ACF Domain — RefactoringPlan Entity
 * 
 * Entidade de domínio rica e estruturada que descreve um plano de refatoração técnico.
 * Substitui o modelo simplório de ChangePlan, organizando ações, riscos, dependências,
 * planos de rollback e grau de confiança.
 */

class RefactoringPlan {
  /**
   * @param {string} changeId - ID exclusivo do plano (ex: PLN-REF-001)
   * @param {string} target - Alvo físico da alteração (arquivo ou componente)
   * @param {string} description - Descrição concisa da refatoração
   * @param {string[]} actions - Passos concretos a serem executados (ações)
   * @param {object} risks - Análise de riscos
   * @param {'low'|'medium'|'high'} risks.level - Severidade do risco
   * @param {string} risks.description - Descrição técnica do risco
   * @param {string[]} dependencies - Dependências de execução (ex: outros planos a rodar antes)
   * @param {string} rollback - Instruções claras de rollback
   * @param {'low'|'medium'|'high'} estimatedImpact - Impacto estimado
   * @param {number} confidenceScore - Grau de confiança na refatoração (0.0 a 1.0)
   * @param {string[]} inconsistenciesResolved - Lista de IDs de inconsistências resolvidas
   */
  constructor(
    changeId,
    target,
    description,
    actions = [],
    risks = { level: 'low', description: '' },
    dependencies = [],
    rollback = '',
    estimatedImpact = 'low',
    confidenceScore = 1.0,
    inconsistenciesResolved = []
  ) {
    if (!changeId || typeof changeId !== 'string') {
      throw new TypeError('[ACF Domain] RefactoringPlan exige "changeId" como string não-vazia.');
    }
    if (!target || typeof target !== 'string') {
      throw new TypeError('[ACF Domain] RefactoringPlan exige "target" como string não-vazia.');
    }
    if (!description || typeof description !== 'string') {
      throw new TypeError('[ACF Domain] RefactoringPlan exige "description" como string não-vazia.');
    }
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new TypeError('[ACF Domain] RefactoringPlan exige "actions" como um array não-vazio de passos.');
    }
    if (!risks || !risks.level || typeof risks.description !== 'string') {
      throw new TypeError('[ACF Domain] RefactoringPlan exige objeto "risks" com "level" e "description".');
    }
    if (typeof rollback !== 'string' || rollback.trim() === '') {
      throw new TypeError('[ACF Domain] RefactoringPlan exige plano de "rollback" definido.');
    }

    const validLevels = ['low', 'medium', 'high'];
    if (!validLevels.includes(risks.level)) {
      throw new RangeError(`[ACF Domain] Nível de risco inválido: "${risks.level}".`);
    }
    if (!validLevels.includes(estimatedImpact)) {
      throw new RangeError(`[ACF Domain] Impacto estimado inválido: "${estimatedImpact}".`);
    }
    if (typeof confidenceScore !== 'number' || confidenceScore < 0 || confidenceScore > 1) {
      throw new RangeError('[ACF Domain] O "confidenceScore" deve ser um número entre 0.0 e 1.0.');
    }

    this.changeId = changeId;
    this.target = target;
    this.description = description;
    this.actions = Object.freeze([...actions]);
    this.risks = Object.freeze({ level: risks.level, description: risks.description });
    this.dependencies = Object.freeze([...(dependencies || [])]);
    this.rollback = rollback;
    this.estimatedImpact = estimatedImpact;
    this.confidenceScore = confidenceScore;
    this.inconsistenciesResolved = Object.freeze([...(inconsistenciesResolved || [])]);

    Object.freeze(this);
  }
}

module.exports = RefactoringPlan;
