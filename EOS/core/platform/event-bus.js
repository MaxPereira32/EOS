/**
 * EOS Platform — Event Bus Tipado v0.4.0
 * 
 * Barramento de eventos síncrono em memória com contratos rígidos.
 * Todo evento carrega um ExecutionContext obrigatório.
 * 
 * Tipos de evento válidos:
 *   "facts:collected" | "facts:normalized" | "metrics:calculated"
 *   "indicators:calculated" | "gate:passed" | "gate:failed"
 *   "report:generated"
 */

const VALID_EVENTS = [
  'facts:collected',
  'facts:normalized',
  'metrics:calculated',
  'indicators:calculated',
  'gate:passed',
  'gate:failed',
  'report:generated'
];

class EventBus {
  /**
   * @param {import('./execution-context')} executionContext
   */
  constructor(executionContext) {
    if (!executionContext) {
      throw new Error('[EventBus] ExecutionContext é obrigatório. Eventos sem contexto são rejeitados.');
    }
    this._context = executionContext;
    this._listeners = {};
    this._log = [];
  }

  /**
   * Registra um listener para um tipo de evento.
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (!VALID_EVENTS.includes(event)) {
      throw new Error(`[EventBus] Evento desconhecido: "${event}". Válidos: ${VALID_EVENTS.join(', ')}`);
    }
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  /**
   * Publica um evento tipado com contexto obrigatório.
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    if (!VALID_EVENTS.includes(event)) {
      throw new Error(`[EventBus] Evento desconhecido: "${event}".`);
    }

    const message = {
      type: event,
      context: this._context.toJSON(),
      payload,
      timestamp: new Date().toISOString()
    };

    this._log.push(message);
    console.log(`[EventBus] ${event} @ ${message.timestamp} [${this._context.project}/${this._context.branch}@${this._context.commit}]`);

    const handlers = this._listeners[event] || [];
    handlers.forEach(handler => handler(payload, message));
  }

  /** Retorna o log completo de eventos da sessão. */
  getLog() { return this._log; }
}

module.exports = EventBus;
