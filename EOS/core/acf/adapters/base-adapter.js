/**
 * EOS ACF Adapters — Base Adapter (Abstract Class)
 * 
 * Classe base para todos os adaptadores do Artifact Consistency Framework (ACF).
 * Garante que os adaptadores implementem as interfaces de coleta (Inventário),
 * correlação local e aplicação de refatorações (Execução).
 */

class BaseAdapter {
  constructor(name) {
    if (this.constructor === BaseAdapter) {
      throw new TypeError('Não é possível instanciar a classe abstrata BaseAdapter diretamente.');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('[BaseAdapter] Todo adaptador deve ter um nome de identificação único.');
    }
    this._name = name;
  }

  /**
   * Retorna o nome identificador do adaptador (ex: "react", "css", "api").
   * @returns {string}
   */
  getName() {
    return this._name;
  }

  /**
   * Executa a fase de Inventário.
   * Analisa os arquivos físicos e retorna uma lista de Fatos de Inventário do ACF
   * (ArtifactIdentified, ReferenceFound, DefinitionLocated).
   * 
   * @param {object} config - Configurações específicas passadas no auditoria.json
   * @param {import('../../platform/execution-context')} context - Contexto de execução do EOS
   * @returns {import('../../domain/fact')[]} Lista de Fatos estruturados
   */
  collect(config, context) {
    throw new Error(`Método "collect" não implementado no adaptador [${this.getName()}].`);
  }

  /**
   * Permite que o adaptador aplique correlações específicas que demandam lógica de tecnologia.
   * (Opcional, a engine genérica de correlação também executará correlações cruzadas padrão).
   * 
   * @param {import('../../domain/fact')[]} inventoryFacts - Fatos coletados na fase anterior
   * @param {import('../../platform/execution-context')} context
   * @returns {import('../../domain/fact')[]} Fatos de Dependência Estabelecida
   */
  correlate(inventoryFacts, context) {
    return [];
  }

  /**
   * Executa uma alteração de refatoração para corrigir uma inconsistência estrutural.
   * Chamado durante a etapa de Execução para planos de mudança atribuídos a este adaptador.
   * 
   * @param {object} changePlannedMetadata - Metadados do Fato ChangePlanned
   * @param {import('../../platform/execution-context')} context
   * @returns {Promise<object>|object} Resultado da alteração (contendo { status: 'success'|'failed', details })
   */
  applyRefactoring(changePlannedMetadata, context) {
    return {
      status: 'failed',
      details: { error: `Capacidade de refatoração não implementada no adaptador [${this.getName()}].` }
    };
  }
}

module.exports = BaseAdapter;
