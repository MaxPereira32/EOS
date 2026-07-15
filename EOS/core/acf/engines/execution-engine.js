/**
 * EOS ACF Engine — Execution Engine
 * 
 * Executa o Modelo 5: Execução.
 * Caso autorizado explicitamente (através de config ou parâmetro de execução),
 * aplica os planos de refatoração no disco chamando os métodos "applyRefactoring"
 * dos adaptadores de tecnologia correspondentes. Produz fatos ChangeApplied.
 */

const path = require('path');
const ACFFacts = require('../domain/facts');

class ExecutionEngine {
  /**
   * @param {import('../adapter-registry')} adapterRegistry
   */
  constructor(adapterRegistry) {
    this.registry = adapterRegistry;
  }

  /**
   * Executa os planos de refatoração aprovados.
   * 
   * @param {import('../../domain/fact')[]} changePlans - Fatos de alteração planejada
   * @param {object} options - Opções de execução, ex: { execute: true }
   * @param {import('../../platform/execution-context')} context
   * @returns {Promise<import('../../domain/fact')[]>} Lista de Fatos ChangeApplied
   */
  async execute(changePlans, options = {}, context) {
    console.log('[ACF Engine] Iniciando Modelo 5: Execução...');
    const appliedFacts = [];

    if (!options.execute) {
      console.log('[ACF Engine] [Execução] Execução em modo Simulação (Dry-Run). Nenhuma alteração aplicada.');
      return changePlans.map(plan => ACFFacts.changeApplied('execution-engine', {
        changeId: plan.metadata.changeId,
        status: 'skipped',
        details: { message: 'Execução não autorizada pelo operador (Dry-Run).' }
      }));
    }

    for (const plan of changePlans) {
      const metadata = plan.metadata;
      console.log(`[ACF Engine] [Execução] Aplicando alteração: ${metadata.changeId} em "${metadata.target}"...`);

      // Validação de segurança contra Path Traversal
      const targetPath = metadata.target;
      const projectRoot = process.cwd();
      const resolvedPath = path.resolve(projectRoot, targetPath);

      if (!resolvedPath.startsWith(projectRoot)) {
        const errMsg = `Violação de segurança: Tentativa de Path Traversal bloqueada para o caminho "${targetPath}"`;
        appliedFacts.push(ACFFacts.changeApplied('execution-engine', {
          changeId: metadata.changeId,
          status: 'failed',
          details: { error: errMsg }
        }));
        console.error(`[-] [SEGURANÇA] ${errMsg}`);
        continue;
      }
      
      // Encontrar o adaptador apropriado. Como o target pode indicar o arquivo, podemos tentar deduzir o adaptador.
      // Em uma execução real, mapeamos o target ou o tipo ao adaptador.
      let resolvedAdapter = null;
      
      // Tentar associar por extensão do target ou tipo
      if (metadata.target.endsWith('.jsx') || metadata.target.endsWith('.js') || metadata.target.endsWith('.tsx')) {
        resolvedAdapter = this.registry.get('react') || this.registry.get('react-adapter');
      } else if (metadata.target.endsWith('.css') || metadata.target.endsWith('.scss')) {
        resolvedAdapter = this.registry.get('css') || this.registry.get('css-adapter');
      }

      // Se não deduzido, usar qualquer adaptador que consiga manipular
      if (!resolvedAdapter) {
        resolvedAdapter = this.registry.getAll()[0]; // fallback para demonstração
      }

      if (resolvedAdapter) {
        try {
          // Os adaptadores realizam a alteração física de refatoração
          const result = await resolvedAdapter.applyRefactoring(metadata, context);
          appliedFacts.push(ACFFacts.changeApplied('execution-engine', {
            changeId: metadata.changeId,
            status: result.status || 'success',
            details: result.details || {}
          }));
          console.log(`[✓] ACF Engine: Alteração [${metadata.changeId}] aplicada com status: ${result.status || 'success'}`);
        } catch (err) {
          appliedFacts.push(ACFFacts.changeApplied('execution-engine', {
            changeId: metadata.changeId,
            status: 'failed',
            details: { error: err.message }
          }));
          console.error(`[-] Falha ao aplicar alteração [${metadata.changeId}]: ${err.message}`);
        }
      } else {
        appliedFacts.push(ACFFacts.changeApplied('execution-engine', {
          changeId: metadata.changeId,
          status: 'failed',
          details: { error: 'Nenhum adaptador registrado foi capaz de processar o target.' }
        }));
        console.warn(`[-] Nenhum adaptador atendeu o target "${metadata.target}" para refatoração.`);
      }
    }

    return appliedFacts;
  }
}

module.exports = ExecutionEngine;
