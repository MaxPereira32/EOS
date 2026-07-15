/**
 * EOS ACF Adapters — Style Adapter (Base Class)
 * 
 * Classe intermediária na hierarquia de adaptadores.
 * Especializada para folhas de estilo, design systems e utilitários de CSS (CSS, SCSS, Tailwind, Blazor styles, etc.).
 * Herda de BaseAdapter e centraliza lógicas comuns a motores de estilização.
 */

const BaseAdapter = require('./base-adapter');

class StyleAdapter extends BaseAdapter {
  constructor(name) {
    super(name);
    if (this.constructor === StyleAdapter) {
      throw new TypeError('Não é possível instanciar a classe intermediária StyleAdapter diretamente.');
    }
  }

  /**
   * Limpa e padroniza seletores de classes para validação de nomenclatura.
   * @param {string} classSelector - Ex: ".btn-primary:hover"
   * @returns {string} - Ex: "btn-primary"
   */
  normalizeClassName(classSelector) {
    let clean = classSelector.trim();
    if (clean.startsWith('.')) clean = clean.substring(1);
    // Remove pseudo-classes e pseudo-elementos
    const colonIdx = clean.indexOf(':');
    if (colonIdx !== -1) clean = clean.substring(0, colonIdx);
    // Remove seletores combinados
    const spaceIdx = clean.indexOf(' ');
    if (spaceIdx !== -1) clean = clean.substring(0, spaceIdx);
    return clean;
  }
}

module.exports = StyleAdapter;
