# Protocolo de Refatoração Segura — EOS

Este protocolo orienta o processo sistemático para efetuar refatorações de código sem alterar o comportamento funcional externo do sistema. Ele visa mitigar riscos e evitar a introdução de regressões no ambiente de produção.

---

## 1. Antes da Refatoração (Planejamento e Preparação)

Nenhuma refatoração deve ser iniciada de forma ad-hoc ou sem salvaguardas.

1. **Análise Inicial**:
   * Entenda o código a ser refatorado. Se não souber por que ele funciona daquela forma, siga o primeiro princípio do EOS: *Entender Antes de Modificar*.
2. **Avaliação de Impacto e Dependências**:
   * Utilize o template de **[Análise de Impacto](../templates/analise-impacto.md)** para listar todos os arquivos e módulos que dependem direta ou indiretamente do trecho a ser alterado.
3. **Escrita do Plano de Refatoração**:
   * Preencha o template de **[Plano de Refatoração](../templates/plano-refatoracao.md)** dividindo o trabalho em etapas curtas e fáceis de validar.
4. **Verificação de Cobertura de Testes**:
   * Certifique-se de que existem testes automatizados cobrindo a lógica que será alterada. Se não houver, crie testes de unidade ou de integração *antes* de iniciar as mudanças. Eles serão a sua rede de segurança.
5. **Plano de Rollback**:
   * Mantenha a branch Git limpa e defina exatamente como reverter o código caso ocorram falhas insolúveis durante a refatoração.

---

## 2. Durante a Refatoração (Execução Incremental)

A refatoração deve ser feita em passos pequenos e cirúrgicos. Evite "refatorações em cascata" (tentar mudar tudo ao mesmo tempo).

1. **Passos Pequenos (Baby Steps)**:
   * Faça uma alteração simples (ex: mudar um nome de variável, extrair uma função).
2. **Validação Incremental**:
   * A cada pequeno passo de código alterado, execute os testes automáticos locais (`npm run test` ou equivalente).
   * Rode o linter e o formator de código para garantir conformidade estática.
   * Se o passo quebrar os testes, desfaça a alteração imediatamente e entenda a falha antes de prosseguir.
3. **Preservação estrita de Comportamento**:
   * Não adicione novas regras de negócio, novos parâmetros não mapeados ou otimizações precoces durante a refatoração. O objetivo exclusivo desta etapa é melhorar a estrutura interna do software.

---

## 3. Depois da Refatoração (Validação e Registro)

Após concluir as alterações propostas no plano de refatoração, realize a homologação final:

1. **Bateria Completa de Testes**:
   * Execute toda a suite de testes do projeto. Garanta 100% de estabilidade nas baterias unitárias e de integração.
2. **Build de Produção**:
   * Execute o comando de compilação final do bundle (`npm run build` ou similar) para assegurar que não há falhas latentes de tipagem (ex: TypeScript compiler errors).
3. **Atualização da Documentação**:
   * Se a refatoração afetar a arquitetura lógica, atualize o `arquitetura-atual.md` e o `mapa-modulos.md` da pasta `.eos/` do projeto.
4. **Atualização de ADRs**:
   * Caso a refatoração consolide uma decisão arquitetural formal, atualize o status da ADR correspondente para `Aprovada` ou `Substituída`.
