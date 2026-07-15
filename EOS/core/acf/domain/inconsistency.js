/**
 * EOS ACF Domain — Inconsistency Entity
 * 
 * Entidade de domínio imutável que descreve uma inconsistência detectada.
 * Valida se as severidades e formatos de dados atendem às políticas do framework.
 */

class Inconsistency {
  /**
   * @param {string} inconsistencyId - Identificador único de diagnóstico (ex: INC-BRK-001)
   * @param {string} type - Tipo de inconsistência (broken_reference, orphan_artifact, naming_inconsistency)
   * @param {string} description - Descrição humana detalhada do problema
   * @param {string} severity - Severidade (low, medium, high, critical)
   * @param {string[]} artifactsAffected - IDs dos artefatos afetados pela inconsistência
   * @param {number} [confidenceScore] - Grau de confiança na detecção (0.0 a 1.0, default: 1.0)
   * @param {object} [details] - Dados adicionais para contextualização e correção
   */
  constructor(inconsistencyId, type, description, severity, artifactsAffected, confidenceScore = 1.0, details = {}) {
    if (!inconsistencyId || typeof inconsistencyId !== 'string') {
      throw new TypeError('[ACF Domain] Inconsistency exige "inconsistencyId" como string não-vazia.');
    }
    if (!type || typeof type !== 'string') {
      throw new TypeError('[ACF Domain] Inconsistency exige "type" como string não-vazia.');
    }
    if (!description || typeof description !== 'string') {
      throw new TypeError('[ACF Domain] Inconsistency exige "description" como string não-vazia.');
    }
    if (!severity || typeof severity !== 'string') {
      throw new TypeError('[ACF Domain] Inconsistency exige "severity" como string não-vazia.');
    }
    if (!Array.isArray(artifactsAffected)) {
      throw new TypeError('[ACF Domain] Inconsistency exige "artifactsAffected" como array.');
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      throw new RangeError(`[ACF Domain] Severidade inválida: "${severity}". Permitidas: ${validSeverities.join(', ')}`);
    }

    const conf = typeof confidenceScore === 'number' ? confidenceScore : 1.0;
    if (conf < 0 || conf > 1) {
      throw new RangeError('[ACF Domain] Inconsistency "confidenceScore" deve estar entre 0.0 e 1.0.');
    }

    this.inconsistencyId = inconsistencyId;
    this.type = type;
    this.description = description;
    this.severity = severity;
    this.artifactsAffected = Object.freeze([...artifactsAffected]);
    this.confidenceScore = conf;
    this.details = details || {};

    Object.freeze(this);
  }
}

module.exports = Inconsistency;
