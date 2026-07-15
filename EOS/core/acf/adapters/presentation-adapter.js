/**
 * EOS ACF Adapters — Presentation Adapter (Base Class)
 * 
 * Classe intermediária na hierarquia de adaptadores.
 * Especializada para camadas de apresentação de interfaces (React, Angular, Vue, Blazor, etc.).
 * Herda de BaseAdapter e centraliza lógicas comuns a frameworks de renderização.
 */

const BaseAdapter = require('./base-adapter');

class PresentationAdapter extends BaseAdapter {
  constructor(name) {
    super(name);
    if (this.constructor === PresentationAdapter) {
      throw new TypeError('Não é possível instanciar a classe intermediária PresentationAdapter diretamente.');
    }
  }

  /**
   * Método de apoio para validar extensões de arquivos suportados.
   * @param {string} filename
   * @param {string[]} extensions
   * @returns {boolean}
   */
  isValidExtension(filename, extensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.razor']) {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return extensions.includes(ext);
  }
}

module.exports = PresentationAdapter;
