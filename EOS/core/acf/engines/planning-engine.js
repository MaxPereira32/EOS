/**
 * EOS ACF Engine — Planning Engine
 * 
 * Executa o Modelo 4: Planejamento.
 * Analisa as inconsistências diagnosticadas e elabora uma entidade RefactoringPlan completa,
 * mapeando ações de correção, análise de riscos, dependências e planos de rollback.
 */

const ACFFacts = require('../domain/facts');

class PlanningEngine {
  /**
   * Constrói planos de mudança baseados nas inconsistências.
   * 
   * @param {import('../../domain/fact')[]} inconsistencyFacts
   * @param {import('../../platform/execution-context')} context
   * @returns {import('../../domain/fact')[]} Lista de Fatos ChangePlanned encapsulando RefactoringPlan
   */
  execute(inconsistencyFacts, context) {
    console.log('[ACF Engine] Iniciando Modelo 4: Planejamento Arquitetural...');
    const changePlans = [];

    inconsistencyFacts.forEach((inc, idx) => {
      const metadata = inc.metadata;
      const changeId = `PLN-REF-${idx.toString().padStart(3, '0')}`;
      
      let target = 'desconhecido';
      let description = '';
      let actions = [];
      let risks = { level: 'low', description: 'Baixo risco operacional' };
      let dependencies = [];
      let rollback = 'Nenhum rollback necessário';
      let estimatedImpact = 'low';
      const confidenceScore = metadata.confidenceScore || 1.0;

      if (metadata.type === 'broken_reference') {
        target = metadata.details.refFrom;
        description = `Substituir ou remover a referência inexistente para "${metadata.details.refTo}" no arquivo "${metadata.details.refFrom}".`;
        actions = [
          `Localizar a referência na linha ${metadata.details.location ? metadata.details.location.line : 'desconhecida'} do arquivo.`,
          `Verificar se o arquivo de destino existe em outro caminho ou foi excluído.`,
          `Corrigir o import/className ou remover a declaração órfã.`
        ];
        risks = {
          level: 'low',
          description: 'A referência já está quebrada em tempo de execução, logo o risco de correção é mínimo.'
        };
        rollback = `git checkout -- ${metadata.details.refFrom}`;
        estimatedImpact = 'medium';

      } else if (metadata.type === 'orphan_artifact') {
        target = metadata.details.path;
        description = `Remover o artefato órfão desnecessário em "${metadata.details.path}".`;
        actions = [
          `Fazer busca global no projeto para certificar-se que o componente não é referenciado dinamicamente.`,
          `Excluir o arquivo/pasta do artefato.`,
          `Remover imports inativos em arquivos de índice, se houver.`
        ];
        risks = {
          level: 'medium',
          description: 'Risco de remover arquivos que possam ser pontos de entrada dinâmicos de bundlers ou frameworks.'
        };
        rollback = `git checkout HEAD -- ${metadata.details.path}`;
        estimatedImpact = 'low';

      } else if (metadata.type === 'naming_inconsistency') {
        target = metadata.details.path;
        description = `Renomear o artefato em "${metadata.details.path}" para atender à política regex "${metadata.details.pattern}".`;
        actions = [
          `Renomear fisicamente o arquivo em conformidade com o padrão estipulado.`,
          `Fazer busca e substituição global por referências ao antigo nome do arquivo.`,
          `Atualizar todas as declarações de imports e usages vinculados.`
        ];
        risks = {
          level: 'high',
          description: 'Risco alto de quebrar referências em tempo de compilação/execução caso alguma importação dinâmica ou estática passe despercebida.'
        };
        rollback = `Desfazer rename de arquivos usando git reset e restaurar imports antigos.`;
        estimatedImpact = 'high';

      } else if (metadata.type === 'circular_dependency') {
        target = metadata.artifactsAffected[0] || 'projeto';
        description = `Quebrar ciclo de dependência circular no caminho: ${metadata.details.cycle.join(' ──> ')}.`;
        actions = [
          `Identificar o ponto de acoplamento do ciclo.`,
          `Extrair código comum / compartilhado para um componente isolado.`,
          `Atualizar imports no ciclo para apontarem para a nova base compartilhada.`
        ];
        risks = {
          level: 'high',
          description: 'Risco alto devido à necessidade de refatoração arquitetural simultânea em múltiplos componentes do ciclo.'
        };
        rollback = `git checkout -- ${metadata.artifactsAffected.join(' ')}`;
        estimatedImpact = 'high';

      } else {
        target = metadata.artifactsAffected[0] || 'projeto';
        description = `Tratar inconsistência genérica do tipo "${metadata.type}" em "${target}".`;
        actions = [`Analisar e corrigir inconsistência manualmente.`];
        rollback = `Restaurar arquivos modificados via git checkout.`;
      }

      changePlans.push(ACFFacts.changePlanned('planning-engine', {
        changeId,
        target,
        description,
        actions,
        risks,
        dependencies,
        rollback,
        estimatedImpact,
        confidenceScore,
        inconsistenciesResolved: [metadata.inconsistencyId]
      }));
    });

    console.log(`[ACF Engine] [Planejamento] Elaborados ${changePlans.length} planos de refatoração estruturados.`);
    return changePlans;
  }
}

module.exports = PlanningEngine;
