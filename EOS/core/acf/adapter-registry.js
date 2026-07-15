/**
 * EOS ACF Core — Adapter Registry
 * 
 * Registro centralizado de adaptadores de artefatos. Permite que adaptadores
 * específicos de tecnologias sejam integrados sem modificar o core do framework.
 */

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  /**
   * Registra um adaptador concreto que estende BaseAdapter.
   * @param {import('./adapters/base-adapter')} adapter
   */
  register(adapter) {
    if (!adapter || typeof adapter.getName !== 'function') {
      throw new Error('[AdapterRegistry] Tentativa de registrar adaptador inválido.');
    }
    this.adapters.set(adapter.getName(), adapter);
    console.log(`[ACF Platform] Adaptador [${adapter.getName()}] registrado com sucesso.`);
  }

  /**
   * Retorna um adaptador pelo nome.
   * @param {string} name
   * @returns {import('./adapters/base-adapter')|undefined}
   */
  get(name) {
    return this.adapters.get(name);
  }

  /**
   * Retorna todos os adaptadores registrados.
   * @returns {import('./adapters/base-adapter')[]}
   */
  getAll() {
    return Array.from(this.adapters.values());
  }

  /**
   * Limpa o registro.
   */
  clear() {
    this.adapters.clear();
  }
}

module.exports = AdapterRegistry;
