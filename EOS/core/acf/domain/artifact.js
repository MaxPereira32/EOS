/**
 * EOS ACF Domain — Artifact Entity
 * 
 * Entidade de domínio imutável que representa um artefato identificado.
 * Valida a consistência de tipos e propriedades obrigatórias do artefato.
 */

class Artifact {
  /**
   * @param {string} id - Identificador exclusivo do artefato (ex: path relativo)
   * @param {string} name - Nome lógico do artefato (ex: "Button")
   * @param {string} type - Tipo (component, style, file, css_class, template, api_contract)
   * @param {string} path - Caminho físico do arquivo
   * @param {object} [details] - Metadados adicionais específicos da tecnologia
   */
  constructor(id, name, type, path, details = {}) {
    if (!id || typeof id !== 'string') {
      throw new TypeError('[ACF Domain] Artifact exige "id" do tipo string não-vazia.');
    }
    if (!name || typeof name !== 'string') {
      throw new TypeError('[ACF Domain] Artifact exige "name" do tipo string não-vazia.');
    }
    if (!type || typeof type !== 'string') {
      throw new TypeError('[ACF Domain] Artifact exige "type" do tipo string não-vazia.');
    }
    if (!path || typeof path !== 'string') {
      throw new TypeError('[ACF Domain] Artifact exige "path" do tipo string não-vazia.');
    }

    const validTypes = ['component', 'style', 'file', 'css_class', 'template', 'widget', 'api_contract', 'route'];
    if (!validTypes.includes(type)) {
      console.warn(`[ACF Domain] Tipo de artefato não usual detectado: "${type}". Esperados: ${validTypes.join(', ')}`);
    }

    this.id = id;
    this.name = name;
    this.type = type;
    this.path = path;
    this.details = details || {};
    
    Object.freeze(this);
  }
}

module.exports = Artifact;
