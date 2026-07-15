/**
 * EOS ACF Domain — Reference Value Object
 * 
 * Objeto de valor imutável que representa uma referência encontrada de um
 * artefato/arquivo para outro componente de destino.
 */

class Reference {
  /**
   * @param {string} from - ID do artefato de origem
   * @param {string} to - Nome ou ID do artefato/elemento referenciado
   * @param {string} type - Tipo de referência (ex: style_sheet_import, css_class_usage)
   * @param {object} [location] - Localização física no arquivo
   * @param {string} [location.file] - Caminho do arquivo contendo a referência
   * @param {number} [location.line] - Linha onde a referência foi identificada
   * @param {number} [location.column] - Coluna da referência no arquivo
   */
  constructor(from, to, type, location = {}) {
    if (!from || typeof from !== 'string') {
      throw new TypeError('[ACF Domain] Reference exige "from" como string não-vazia.');
    }
    if (!to || typeof to !== 'string') {
      throw new TypeError('[ACF Domain] Reference exige "to" como string não-vazia.');
    }
    if (!type || typeof type !== 'string') {
      throw new TypeError('[ACF Domain] Reference exige "type" como string não-vazia.');
    }

    this.from = from;
    this.to = to;
    this.type = type;
    
    const loc = location || {};
    this.location = {
      file: loc.file || from,
      line: typeof loc.line === 'number' ? loc.line : 0,
      column: typeof loc.column === 'number' ? loc.column : 0
    };

    Object.freeze(this);
  }
}

module.exports = Reference;
