/**
 * EOS Event Bus — v0.3.0
 * 
 * Barramento de eventos síncrono em memória.
 * Desacopla a comunicação entre os módulos do EOS.
 * Cada módulo publica e consome eventos sem conhecer os demais.
 */

class EventBus {
  constructor() {
    this._listeners = {};
    this._log = [];
  }

  /**
   * Registra um listener para um tipo de evento.
   * @param {string} event - Nome do evento (ex: "facts:collected").
   * @param {Function} handler - Função executada ao receber o evento.
   */
  on(event, handler) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);
  }

  /**
   * Publica um evento para todos os listeners registrados.
   * @param {string} event - Nome do evento.
   * @param {*} payload - Dados anexados ao evento.
   */
  emit(event, payload) {
    const timestamp = new Date().toISOString();
    this._log.push({ event, timestamp });
    console.log(`[EventBus] ${event} @ ${timestamp}`);

    const handlers = this._listeners[event] || [];
    handlers.forEach(handler => handler(payload));
  }

  /** Retorna o log completo de eventos emitidos na sessão. */
  getLog() {
    return this._log;
  }
}

module.exports = EventBus;
