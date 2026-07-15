/**
 * EOS ACF Domain — Dependency Entity
 * 
 * Entidade de domínio imutável que representa uma relação de dependência resolvida
 * entre dois artefatos identificados.
 */

class Dependency {
  /**
   * @param {string} from - ID do artefato que depende
   * @param {string} to - ID do artefato dependido
   * @param {string} type - Tipo de relação estrutural estabelecida
   */
  constructor(from, to, type) {
    if (!from || typeof from !== 'string') {
      throw new TypeError('[ACF Domain] Dependency exige "from" como string não-vazia.');
    }
    if (!to || typeof to !== 'string') {
      throw new TypeError('[ACF Domain] Dependency exige "to" como string não-vazia.');
    }
    if (!type || typeof type !== 'string') {
      throw new TypeError('[ACF Domain] Dependency exige "type" como string não-vazia.');
    }

    this.from = from;
    this.to = to;
    this.type = type;

    Object.freeze(this);
  }
}

module.exports = Dependency;
