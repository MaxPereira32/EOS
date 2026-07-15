const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ArchitectureReviewMode {
  constructor() {
    this.decisoesDir = path.join(process.cwd(), '.eos', 'decisoes');
    this.historicoPath = path.join(this.decisoesDir, 'decisoes-historico.json');
    this.exceptionsPath = path.join(this.decisoesDir, 'exceptions.json');
    
    // Garantir que as pastas existam
    if (!fs.existsSync(this.decisoesDir)) {
      fs.mkdirSync(this.decisoesDir, { recursive: true });
    }
  }

  /**
   * Lê o histórico de decisões do Decision Repository.
   */
  readHistorico() {
    if (!fs.existsSync(this.historicoPath)) {
      return [];
    }
    try {
      return JSON.parse(fs.readFileSync(this.historicoPath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  /**
   * Grava no histórico de decisões do Decision Repository.
   */
  writeHistorico(historico) {
    fs.writeFileSync(this.historicoPath, JSON.stringify(historico, null, 2), 'utf8');
  }

  /**
   * Lê as exceções ativas.
   */
  readExceptions() {
    if (!fs.existsSync(this.exceptionsPath)) {
      return { components: {}, rules: {} };
    }
    try {
      return JSON.parse(fs.readFileSync(this.exceptionsPath, 'utf8'));
    } catch (e) {
      return { components: {}, rules: {} };
    }
  }

  /**
   * Grava as exceções ativas.
   */
  writeExceptions(exceptions) {
    fs.writeFileSync(this.exceptionsPath, JSON.stringify(exceptions, null, 2), 'utf8');
  }

  /**
   * Determina o próximo número sequencial para um ADR.
   */
  getNextAdrNumber() {
    try {
      const files = fs.readdirSync(this.decisoesDir);
      const adrFiles = files.filter(f => f.startsWith('ADR-') && f.endsWith('.md'));
      let maxNum = 1;
      adrFiles.forEach(file => {
        const match = file.match(/^ADR-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= maxNum) {
            maxNum = num + 1;
          }
        }
      });
      return maxNum.toString().padStart(3, '0');
    } catch (e) {
      return '002';
    }
  }

  /**
   * Filtra e processa as inconsistências sob o Architecture Review Mode.
   */
  async process(inconsistencyFacts, plans, context, options = {}) {
    const criticalTypes = ['broken_reference', 'circular_dependency', 'critical_vulnerability', 'structural_corruption', 'integrity_violation'];
    
    // 1. Filtrar candidatos do ARM (qualquer desvio que não seja um erro funcional/crítico)
    const armCandidates = [];
    const criticalFacts = [];

    const exceptions = this.readExceptions();
    const historico = this.readHistorico();

    inconsistencyFacts.forEach(fact => {
      const type = fact.metadata.type;
      const target = fact.metadata.target || (fact.metadata.details && fact.metadata.details.path) || 'unknown';
      
      // Se houver uma exceção ativa para a regra em todo o projeto, ignorar
      if (exceptions.rules[type]) {
        console.log(`[ARM] Ignorando inconsistência do tipo "${type}" devido a Exceção Geral do Projeto.`);
        return;
      }

      // Se houver uma exceção ativa para o componente/artefato específico, ignorar
      if (exceptions.components[target] && exceptions.components[target].includes(type)) {
        console.log(`[ARM] Ignorando inconsistência do tipo "${type}" para o componente "${target}" devido a Exceção Local.`);
        return;
      }

      if (criticalTypes.includes(type)) {
        criticalFacts.push(fact);
      } else {
        armCandidates.push(fact);
      }
    });

    if (armCandidates.length === 0) {
      return {
        facts: [...criticalFacts],
        plans: plans
      };
    }

    console.log(`\n[🔍] [ARM] O EOS detectou ${armCandidates.length} oportunidades de melhoria arquitetural (ARM).`);
    console.log(`[🔍] Entrando em Architecture Review Mode (ARM-001) para análise e parecer.\n`);

    const finalFacts = [...criticalFacts];
    const finalPlans = [];

    // Mapear planos existentes por ID de inconsistência para decisões
    const planMap = {};
    plans.forEach(plan => {
      if (plan.metadata && plan.metadata.inconsistenciesResolved) {
        plan.metadata.inconsistenciesResolved.forEach(incId => {
          planMap[incId] = plan;
        });
      }
    });

    const isInteractive = (process.stdout.isTTY || process.argv.includes('--interactive') || process.argv.includes('-i')) && !process.env.CI && !options.nonInteractive;

    let armReportMd = `# Pareceres Técnicos de Arquitetura (ARM-001) — EOS\n\n`;
    armReportMd += `| Artefato | Tipo | Recomendação | Confiança |\n|---|---|---|---|\n`;

    for (const candidate of armCandidates) {
      const incId = candidate.metadata.inconsistencyId;
      const type = candidate.metadata.type;
      const target = candidate.metadata.target || (candidate.metadata.details && candidate.metadata.details.path) || 'unknown';
      const plan = planMap[incId];

      // Verificar memória de decisões passadas
      const anterior = historico.find(h => h.tipoInconsistencia === type && h.target === target);
      let memoryMsg = '';
      if (anterior) {
        memoryMsg = `[Memória Arquitetural] Em ${anterior.data.split('T')[0]}, a equipe avaliou uma situação equivalente e decidiu "${anterior.decisao}" com a justificativa: "${anterior.justificativa}".`;
      }

      // Gerar Parecer Técnico estruturado
      const parecer = this.generateParecer(candidate, memoryMsg);
      
      armReportMd += `| \`${target}\` | \`${type}\` | ${parecer.grauRecomendacao} | ${parecer.grauConfianca} |\n`;

      if (isInteractive) {
        console.log(`================================================================`);
        console.log(`PARECER TÉCNICO DE REVISÃO ARQUITETURAL (ARM-001)`);
        console.log(`================================================================`);
        console.log(`1. IDENTIFICAÇÃO:\n   - Artefato: ${parecer.identificacao.artefato}\n   - Localização: ${parecer.identificacao.localizacao}\n   - Contexto: ${parecer.identificacao.contexto}\n   - Tipo: ${parecer.identificacao.tipo}`);
        console.log(`\n2. EVIDÊNCIAS:\n   - ${parecer.evidencias.join('\n   - ')}`);
        console.log(`\n3. DIAGNÓSTICO:\n   - ${parecer.diagnostico}`);
        console.log(`\n4. IMPACTO:\n   - ${parecer.impacto}`);
        console.log(`\n5. BENEFÍCIOS:\n   - ${parecer.beneficios.join('\n   - ')}`);
        console.log(`\n6. TRADE-OFFS:\n   * Manter Atual:\n     - Vantagens: ${parecer.tradeoffs.manter.vantagens.join(', ')}\n     - Desvantagens: ${parecer.tradeoffs.manter.desvantagens.join(', ')}`);
        console.log(`   * Aplicar Refatoração:\n     - Vantagens: ${parecer.tradeoffs.refatorar.vantagens.join(', ')}\n     - Desvantagens: ${parecer.tradeoffs.refatorar.desvantagens.join(', ')}`);
        console.log(`\n7. GRAU DE CONFIANÇA: ${parecer.grauConfianca}`);
        console.log(`8. GRAU DE RECOMENDAÇÃO: ${parecer.grauRecomendacao}`);
        console.log(`9. COMPATIBILIDADE: ${parecer.compatibilidade}`);
        console.log(`10. ALTERNATIVAS:\n    - ${parecer.alternativas.join('\n    - ')}`);
        if (memoryMsg) {
          console.log(`\n💡 ${memoryMsg}`);
        }
        console.log(`================================================================\n`);

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

        console.log(`Escolha uma decisão para o desvio arquitetural em "${target}":`);
        console.log(`1. Aceitar recomendação (Aplicar plano de refatoração)`);
        console.log(`2. Adiar (Registrar para análise futura)`);
        console.log(`3. Ignorar nesta ocorrência (Nenhuma alteração realizada)`);
        console.log(`4. Criar exceção para este componente (Ignorar no futuro)`);
        console.log(`5. Criar exceção para este projeto (Desativar regra no projeto)`);
        console.log(`6. Solicitar nova análise`);
        console.log(`7. Escalar para revisão humana`);

        let opcao = '';
        while (!['1','2','3','4','5','6','7'].includes(opcao)) {
          opcao = await askQuestion('\nDigite o número da opção desejada (1-7): ');
        }

        const justificativa = await askQuestion('Digite uma justificativa/motivo para esta decisão: ');
        rl.close();

        const opcoesMapeadas = {
          '1': 'Aceitar recomendação',
          '2': 'Adiar',
          '3': 'Ignorar nesta ocorrência',
          '4': 'Criar exceção para este componente',
          '5': 'Criar exceção para este projeto',
          '6': 'Solicitar nova análise',
          '7': 'Escalar para revisão humana'
        };

        const decisaoSelecionada = opcoesMapeadas[opcao];

        // 2. Gravar ADR
        const adrNum = this.getNextAdrNumber();
        const slug = target.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 30);
        const adrFilename = `ADR-${adrNum}-${slug}.md`;
        const adrPath = path.join(this.decisoesDir, adrFilename);
        
        const adrContent = this.generateAdrContent(adrNum, decisaoSelecionada, justificativa, parecer, context);
        fs.writeFileSync(adrPath, adrContent, 'utf8');
        console.log(`[✓] ADR arquivado em: .eos/decisoes/${adrFilename}`);

        // 3. Registrar no histórico de decisões do Decision Repository
        const novaDecisao = {
          data: new Date().toISOString(),
          responsavel: "Engenheiro de Software & EOS",
          contexto: `Decisão sobre ${type} no artefato ${target}`,
          inconsistencyId: incId,
          target: target,
          tipoInconsistencia: type,
          decisao: decisaoSelecionada,
          justificativa: justificativa,
          impactoEsperado: decisaoSelecionada === 'Aceitar recomendação' ? 'Melhoria na manutenibilidade' : parecer.impacto,
          politicasEnvolvidas: [type]
        };
        historico.push(novaDecisao);
        this.writeHistorico(historico);

        // 4. Aplicar ações baseadas na decisão
        if (decisaoSelecionada === 'Aceitar recomendação') {
          finalFacts.push(candidate);
          if (plan) {
            finalPlans.push(plan);
          }
        } else if (decisaoSelecionada === 'Criar exceção para este componente') {
          if (!exceptions.components[target]) {
            exceptions.components[target] = [];
          }
          if (!exceptions.components[target].includes(type)) {
            exceptions.components[target].push(type);
          }
          this.writeExceptions(exceptions);
          console.log(`[✓] Exceção registrada localmente para o componente "${target}".`);
        } else if (decisaoSelecionada === 'Criar exceção para este projeto') {
          exceptions.rules[type] = true;
          this.writeExceptions(exceptions);
          console.log(`[✓] Exceção registrada globalmente para a regra "${type}".`);
        } else {
          // Adiar, Ignorar, etc. Mantém o fato no relatório mas descarta o plano de execução automática
          finalFacts.push(candidate);
        }

      } else {
        // Modo Não Interativo (CI/Dry-run) - gera relatório markdown geral
        armReportMd += `\n### Parecer para \`${target}\` (${type})\n\n`;
        armReportMd += `* **Diagnóstico**: ${parecer.diagnostico}\n`;
        armReportMd += `* **Impacto**: ${parecer.impacto}\n`;
        armReportMd += `* **Recomendação**: ${parecer.grauRecomendacao} (Confiança: ${parecer.grauConfianca})\n`;
        if (memoryMsg) {
          armReportMd += `* **Memória**: ${memoryMsg}\n`;
        }
        
        finalFacts.push(candidate);
        if (plan) {
          finalPlans.push(plan);
        }
      }
    }

    if (!isInteractive) {
      const armReportPath = path.join(process.cwd(), '.eos', 'auditorias', 'arm-pareceres.md');
      fs.writeFileSync(armReportPath, armReportMd, 'utf8');
      console.log(`[ARM] Modo Não Interativo detectado. Pareceres Técnicos salvos em: .eos/auditorias/arm-pareceres.md`);
      console.log(`[ARM] Execute a auditoria no terminal interativo para responder ou registre a decisão manualmente.`);
    }

    return {
      facts: finalFacts,
      plans: finalPlans
    };
  }

  /**
   * Constrói os dados estruturados do Parecer Técnico de acordo com o tipo de inconsistência.
   */
  generateParecer(candidate, memoryMsg = '') {
    const type = candidate.metadata.type;
    const target = candidate.metadata.target || (candidate.metadata.details && candidate.metadata.details.path) || 'unknown';
    
    const parecer = {
      identificacao: {
        artefato: target,
        localizacao: target,
        contexto: `Fase 5 - Diagnóstico de Consistência de Artefato`,
        tipo: type === 'naming_inconsistency' ? 'Padronização de Nomenclatura' : 'Arquitetura de Estilos e Dependências'
      },
      evidencias: [],
      diagnostico: '',
      impacto: '',
      beneficios: [],
      tradeoffs: {
        manter: { vantagens: [], desvantagens: [] },
        refatorar: { vantagens: [], desvantagens: [] }
      },
      grauConfianca: 'Alta',
      grauRecomendacao: 'Recomendada',
      compatibilidade: 'Conforme com as regras de governança e políticas do projeto.',
      alternativas: []
    };

    if (type === 'naming_inconsistency') {
      const pattern = candidate.metadata.details.pattern || '';
      parecer.evidencias.push(`O nome do arquivo/artefato "${path.basename(target)}" diverge do padrão configurado no projeto.`);
      parecer.evidencias.push(`Padrão regex exigido pelo validador: "${pattern}".`);
      
      parecer.diagnostico = `A inconsistência de nomenclatura reduz o alinhamento com a arquitetura limpa de diretórios do projeto, prejudicando a governança de código a longo prazo.`;
      parecer.impacto = `Aumento gradual da complexidade, menor legibilidade física e risco de duplicação por desenvolvedores que não localizarem o arquivo de forma imediata.`;
      parecer.beneficios.push('Padronização e clareza física da estrutura do projeto.');
      parecer.beneficios.push('Busca e substituição automatizada mais previsível.');
      
      parecer.tradeoffs.manter = {
        vantagens: ['Zero esforço imediato', 'Evita alterar múltiplos imports em outros arquivos'],
        desvantagens: ['Quebra de consistência física', 'Dificulta a integração de novos engenheiros']
      };
      parecer.tradeoffs.refatorar = {
        vantagens: ['Consistência de nomenclatura perfeita', 'Facilidade de legibilidade'],
        desvantagens: ['Risco baixo de refatoração de imports', 'Esforço de compilação/teste imediato']
      };
      
      parecer.grauConfianca = 'Muito Alta';
      parecer.grauRecomendacao = 'Fortemente Recomendada';
      parecer.alternativas.push('Manter a nomenclatura atual criando uma exceção específica no arquivo exceptions.json.');
      parecer.alternativas.push('Renomear o arquivo para atender ao padrão regex do projeto.');
      
    } else if (type === 'orphan_artifact') {
      parecer.evidencias.push(`O artefato "${path.basename(target)}" não possui dependências/referências direcionadas a si no Grafo Semântico.`);
      parecer.evidencias.push(`Ele foi classificado como código morto ou folha de estilo inativa.`);
      
      parecer.diagnostico = `Arquivos de estilos ou componentes órfãos representam débito técnico de "Dead Code", poluindo a base de código do projeto.`;
      parecer.impacto = `Aumento gradual do tamanho do bundle final de compilação e confusão sobre a real árvore de dependências ativas no sistema.`;
      parecer.beneficios.push('Redução do tamanho do pacote web.');
      parecer.beneficios.push('Base de código limpa, reduzindo o custo de manutenção.');
      
      parecer.tradeoffs.manter = {
        vantagens: ['Segurança contra remoção acidental de arquivos carregados dinamicamente'],
        desvantagens: ['Acúmulo de código morto', 'Aumento desnecessário do tamanho de bundle']
      };
      parecer.tradeoffs.refatorar = {
        vantagens: ['Eliminação de dependências inativas', 'Manutenibilidade aprimorada'],
        desvantagens: ['Necessidade de validação manual sobre uso em bundlers/reflexão']
      };
      
      parecer.grauConfianca = 'Alta';
      parecer.grauRecomendacao = 'Recomendada';
      parecer.alternativas.push('Excluir fisicamente o arquivo órfão do repositório.');
      parecer.alternativas.push('Integrar e importar o arquivo em algum módulo ativo do projeto.');
      
    } else {
      parecer.evidencias.push(`Detectado desvio geral de consistência no artefato "${target}".`);
      parecer.diagnostico = `Desvio semântico classificado como melhoria de oportunidade arquitetural.`;
      parecer.impacto = `Deterioração lenta do padrão arquitetural planejado.`;
      parecer.beneficios.push('Aprimoramento contínuo da arquitetura do projeto.');
      
      parecer.tradeoffs.manter = {
        vantagens: ['Rapidez operacional de curto prazo'],
        desvantagens: ['Aumento gradual do débito técnico estrutural']
      };
      parecer.tradeoffs.refatorar = {
        vantagens: ['Arquitetura mais limpa'],
        desvantagens: ['Risco de refatorações de regressão']
      };
      
      parecer.grauConfianca = 'Média';
      parecer.grauRecomendacao = 'Opcional';
      parecer.alternativas.push('Manter a implementação atual.');
      parecer.alternativas.push('Planejar refatoração manual.');
    }

    return parecer;
  }

  /**
   * Gera o conteúdo Markdown de um ADR.
   */
  generateAdrContent(adrNum, decisao, justificativa, parecer, context) {
    return `# ADR-${adrNum} — Decisão Arquitetural sobre ${parecer.identificacao.artefato}

* **Status**: ${decisao === 'Aceitar recomendação' ? 'Aprovada e Implementada' : 'Rejeitada / Exceção Criada'}
* **Autor(es)**: Engenheiro de Software & EOS (Architecture Review Mode)
* **Data**: ${new Date().toISOString().split('T')[0]}
* **Decisão Relacionada**: Nenhuma

---

## 1. Contexto Técnico
O EOS identificou uma oportunidade de melhoria arquitetural no artefato \`${parecer.identificacao.artefato}\`:
* **Tipo de Desvio**: ${parecer.identificacao.tipo}
* **Diagnóstico**: ${parecer.diagnostico}

---

## 2. Evidências Coletadas
* ${parecer.evidencias.join('\n* ')}

---

## 3. Decisão Tomada
**${decisao.toUpperCase()}**

* **Justificativa**: ${justificativa}
* **Impacto Esperado**: ${parecer.impacto}

---

## 4. Consequências e Trade-offs

### Ganhos
* ${parecer.beneficios.join('\n* ')}

### Custos / Perdas
* Esforço inicial de adaptação e refatoração.
* Risco associado: ${parecer.tradeoffs.refatorar.desvantagens.join(', ')}

---

## 5. Alternativas Consideradas
* ${parecer.alternativas.join('\n* ')}
`;
  }
}

module.exports = ArchitectureReviewMode;
