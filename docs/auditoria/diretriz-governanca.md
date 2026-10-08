# Diretriz de Engenharia — Plano de Correções Executável, Rastreável e Auditado
## Governança Baseada em Evidências Reais

**Objetivo:** transformar os achados de uma auditoria técnica em um processo de remediação executável, controlado, reproduzível e verificável, assegurando que nenhuma correção seja considerada concluída sem demonstração objetiva de sua eficácia.

**Princípio fundamental:** Toda afirmação técnica deverá estar sustentada por evidência material, identificável, verificável e vinculada à versão exata do código analisado. Declarações de agentes, checklists preenchidos, relatórios de sucesso, compilação sem erros e testes isolados não constituem, por si só, comprovação de correção.

---

## 1. OBJETIVO E ESCOPO

O plano deverá funcionar como instrumento permanente de governança técnica, orientando: confirmar tecnicamente cada problema; identificar causa raiz e impactos; definir a correção adequada; estabelecer critérios objetivos de aceite antes da implementação; implementar sem introduzir regressões; executar testes diretamente relacionados; realizar auditoria independente; comprovar eficácia mediante evidências reais; aprovar, reprovar ou declarar inconclusiva a validação; preservar integralmente a rastreabilidade.

O plano não é uma lista de tarefas marcadas como concluídas. É um registro auditável de problemas, intervenções, testes, evidências e decisões técnicas.

## 2. REGRAS INEGOCIÁVEIS DE CONFIABILIDADE

São obrigatórias durante todo o processo:

- Proibição de evidências fictícias: não inventar comandos, logs, resultados, métricas, testes, arquivos, hashes, commits ou comportamentos.
- Proibição de aprovação declaratória: não aceitar sucesso informado pelo agente executor sem verificação independente.
- Proibição de evidência exclusivamente simulada: mocks, stubs e fixtures podem apoiar testes, mas não podem comprovar integração ou execução real quando isso fizer parte do critério de aceite.
- Proibição de falso positivo: ausência de mensagens de erro não é comprovação de funcionamento correto.
- Proibição de aprovação sem execução: testes planejados, descritos ou gerados, mas não executados, permanecem como NÃO EXECUTADOS.
- Proibição de omissão: falhas, exceções, limitações ambientais, testes ignorados e riscos residuais devem ser registrados.
- Proibição de critérios retroativos: critérios de aceite não podem ser alterados para justificar implementação que falhou. Mudanças legítimas devem ser justificadas e versionadas.
- Proibição de conclusão por checklist: marcar uma caixa não constitui evidência da etapa correspondente.
- Proibição de reutilização indevida de evidências: resultados de uma versão do código não podem ser atribuídos a outra sem comprovação de equivalência e revalidação pertinente.
- Proibição de aprovação autorreferente: o próprio mecanismo investigado não pode ser usado como única autoridade para declarar sua correção.

**Regra de segurança:** na ausência de evidência suficiente, o resultado é INCONCLUSIVO. Diante de evidência de falha em critério obrigatório, o resultado é REPROVADO.

## 3. BASELINE OBRIGATÓRIA ANTES DAS CORREÇÕES

Registrar: caminho absoluto do repositório; nome e finalidade do projeto; branch atual; commit SHA completo; data/hora/fuso; estado do Git (modificados e não rastreados); versões de linguagens, dependências e ferramentas; SO e ambiente; testes existentes e condições iniciais; achados corrigidos/parciais/presentes; restrições conhecidas.

Comandos de referência (a executar e registrar as saídas reais): `git status --short --branch`, `git rev-parse HEAD`, `git log -5 --oneline`, `git diff --stat`, `git diff --check`.

Critério de governança: nunca iniciar correção presumindo estado inalterado. Implementação parcial pré-existente deve ter finalidade, integridade e compatibilidade verificadas antes de modificar o código.

## 4. ESTRUTURA OBRIGATÓRIA DE CADA ACHADO

Cada achado possui ficha individual e identificador único e estável.

### 4.1 Identificação e diagnóstico
ID; Título; Origem; Criticidade (justificada por impacto, probabilidade, exploração e exposição); Prioridade (P0–P3); Status; Executor; Auditor; Baseline (commit/estado exato); Arquivos afetados (caminhos e símbolos); Causa raiz (sustentada por evidência); Impacto; Dependências; Evidência original (IDs).

### 4.2 Evidência original obrigatória
Arquivo e símbolo/linhas; versão exata do código; comportamento incorreto observado; comportamento esperado; procedimento de reprodução; resultado real da reprodução; registro material; limitações da verificação. Reproduzir o defeito antes da correção sempre que tecnicamente possível; se não, registrar motivo e evidências alternativas. Não confundir hipótese com defeito confirmado.

## 5. CONTRATO DE ACEITE DEFINIDO ANTES DA IMPLEMENTAÇÃO

Antes de modificar o código, definir contrato objetivo de aceite por achado, com critérios identificados (ex.: CA-01…CA-06): comportamento incorreto deixa de ocorrer; causa raiz eliminada; tratamento de erro falha de forma segura; fluxo legítimo continua funcionando; sem regressões nos módulos impactados; integração real corresponde ao contrato esperado.

Para cada critério: condição de entrada; resultado esperado; teste responsável; evidência a coletar; condição explícita de reprovação. Proibidos critérios vagos ("funcionar corretamente", "melhorar segurança", "passar nos testes") sem verificação definida. Critérios registrados antes da implementação e preservados no histórico.

## 6. PLANEJAMENTO E IMPLEMENTAÇÃO CONTROLADA

Cada correção: solução técnica proposta e justificativa; alternativas avaliadas; dependências; riscos de implementação (efeitos colaterais, contratos, concorrência, segurança, desempenho, compatibilidade); arquivos previstos; plano de reversão.

Antes de implementar: consultar código atual; verificar tentativa de correção prévia; conferir Git e alterações não registradas; evitar sobrescrever trabalho de outros agentes; identificar testes a alterar/adicionar; definir como será demonstrada a eliminação da causa raiz.

Após implementar: registrar arquivos efetivamente alterados; inspecionar diff completo; justificar mudanças fora do escopo; registrar novos testes e alterações de contrato; identificar a revisão exata a ser auditada; encaminhar à validação sem declarar aprovação.

## 7. PROTOCOLO OBRIGATÓRIO DE EVIDÊNCIAS

### 7.1 Registro individual de evidência
Campos: ID da evidência; ID do achado; critério associado; tipo; agente/processo produtor; data/hora/fuso; ambiente; branch e commit SHA; estado do working tree; comando/procedimento exato; parâmetros; resultado esperado; resultado observado; exit code; caminho do registro original; hash do artefato; limitações; parecer do verificador.

Formulário de exemplo (a preencher; nenhum valor entre colchetes é resultado):
```
EVIDÊNCIA: EVD-<ID>
ACHADO: <ID>
CRITÉRIO: CA-<nn>
TIPO: <categoria>
EXECUTOR: <identificação>
DATA/HORA/FUSO: <preencher>
AMBIENTE: <preencher>
COMMIT SHA: <preencher>
WORKING TREE: <limpo/modificado>
COMANDO: <comando real>
RESULTADO ESPERADO: <preenchido antes>
RESULTADO OBSERVADO: <saída real>
EXIT CODE: <real>
ARTEFATO: <caminho do log>
SHA-256: <hash calculado>
AUDITOR: <identificação>
VEREDITO: Aprovado/Reprovado/Inconclusivo
OBSERVAÇÕES: <limitações e riscos>
```

### 7.2 Evidências insuficientes isoladamente
Não são prova definitiva: captura de tela sem versão; log manual sem vínculo com execução; teste unitário só com dados fictícios para integração real; resumo do agente; compilação bem-sucedida; teste antigo pré-alteração; relatório do próprio componente sob investigação; commit sem testes; checklist sem referência; assinatura/hash de origem não validável. Podem complementar, nunca substituir a verificação material.

### 7.3 Integridade e preservação
Evidências: armazenadas em local identificado; vinculadas ao achado e ao commit; registros originais preservados; reproduzíveis; alterações posteriores registradas; sem exposição de credenciais; preferencialmente com hashes verificáveis. Hash isolado não comprova autenticidade; quando necessário, usar assinatura/cadeia de confiança com chave protegida e verificação independente. Não modificar retroativamente registros originais.

## 8. MATRIZ DE TESTES OBRIGATÓRIOS

Categorias: Unitário; Integração; Regressão; Segurança; Adversarial; Concorrência; Contrato; Ponta a ponta; Ambiente real/representativo. Seleção e dispensas justificadas antes da implementação.

### 8.1 Teste antes e depois
Quando viável: ANTES — defeito reproduzido, condições registradas, resultado incorreto documentado; DEPOIS — mesmo cenário reexecutado, resultado corrigido observado, evidência comparativa preservada. O teste deve demonstrar mudança de comportamento, não apenas alteração de código. Preferir teste de regressão que falhe na versão defeituosa e passe na corrigida.

### 8.2 Testes adversariais
Para segurança, governança, autenticação, integridade e execução automatizada: tentar ativamente violar critérios (evidência inexistente; sucesso sem execução; adulteração de relatório assinado; identificadores inválidos; execução interrompida; erro no componente dependente). Um teste que sempre passa independentemente da falha não comprova sua eliminação.

## 9. AUDITORIA INDEPENDENTE APÓS CADA IMPLEMENTAÇÃO

Ciclo: Diagnóstico → Contrato de Aceite → Implementação → Testes → Auditoria Independente → Decisão Técnica.

A auditoria não pode limitar-se a ler o relatório do executor. O auditor deve, quando possível: reler achado e evidências originais; verificar código atual e commit; inspecionar diff; conferir causa raiz; revisar critérios prévios; reproduzir independentemente os testes críticos; inspecionar logs; confrontar esperado×observado; executar testes adversariais; verificar regressões; analisar riscos residuais; emitir parecer fundamentado.

Vereditos: **APROVADO** (todos os critérios obrigatórios demonstrados com evidência suficiente); **REPROVADO** (um ou mais critérios obrigatórios falharam); **INCONCLUSIVO** (evidência insuficiente, execução não ocorreu, impedimento relevante, ou versão examinada ≠ implementação submetida).

Sem agente independente disponível: registrar a limitação. Autodeclaração do executor não supre a auditoria.

### 9.1 Política de reprovação
Registrar exatamente o critério que falhou; apresentar evidência da falha; identificar causa/hipótese; reabrir a correção; preservar resultados anteriores; gerar nova tentativa de validação; não substituir/apagar pareceres anteriores. Reprovação não vira aprovação por edição de texto ou alteração de status.

## 10. CHECKLIST AUDITÁVEL POR ACHADO

Cada achado possui checklist completo próprio. Proibido substituir etapas por "demais itens concluídos". Itens: achado confirmado com evidência original; baseline e commit registrados; causa raiz demonstrada ou hipótese classificada; impactos/dependências analisados; solução justificada; critérios de aceite definidos antes da implementação; testes obrigatórios vinculados a critérios; plano de reversão quando necessário; implementação realizada e identificada; diff revisado; mudanças fora do escopo justificadas; testes (unitário, integração, regressão, adversariais/segurança) pertinentes executados; resultados reais e exit codes registrados; evidências vinculadas à versão exata; auditor independente revisou as alterações; critérios confrontados com evidências; ausência de regressões comprovada no escopo testado; riscos residuais analisados e tratados formalmente; parecer técnico emitido; rastreabilidade/documentação atualizadas; correção aprovada tecnicamente.

**Regra para marcar caixas:** cada item marcado deve ter referência a evidência/decisão verificável. Item não aplicável = NÃO APLICÁVEL com justificativa aprovada pelo auditor. Quantidade de caixas não determina status. Não são permitidos estados de conclusão sem evidências.

## 11. GESTÃO DE STATUS E TRANSIÇÕES

Estados: **Pendente** (não iniciada); **Em análise** (diagnóstico/planejamento); **Bloqueado** (impedimento documentado); **Em implementação**; **Em validação** (testes/auditoria); **Reprovado** (critério obrigatório não atendido); **Concluído** (aprovado com comprovação integral).

Toda transição registra: estado anterior; novo estado; data/hora; responsável; justificativa; evidência/parecer que autoriza; commit/versão. Proibida transição direta "Em implementação" → "Concluído" sem testes e auditoria. Código alterado após aprovação exige verificação de impacto sobre a validade das evidências; havendo impacto, reabrir a validação antes de manter "Concluído".

## 12. REGRAS DE BLOQUEIO DA APROVAÇÃO

Bloqueiam a conclusão: evidência obrigatória inexistente; teste obrigatório não executado; teste obrigatório reprovado; critério sem comprovação; código alterado após a última validação sem revalidação; resultado exclusivamente simulado para requisito de execução real; auditoria baseada só na declaração do executor; arquivo analisado ≠ versão implementada; registro de testes sem origem/versão; vulnerabilidade crítica ainda explorável no cenário testado; regressão relevante sem tratamento formal; parecer inconclusivo; divergência material entre relatório, código e logs; falha no mecanismo de integridade das evidências; critérios modificados retroativamente sem controle.

Ausência de prova bloqueia a aprovação; não é aprovação tácita.

## 13. MATRIZ DE RASTREABILIDADE

Achado → Causa raiz → Alteração → Critério de aceite → Teste → Evidência → Parecer → Commit. Cada critério obrigatório aponta para pelo menos uma verificação adequada. Reutilização de evidência entre critérios deve ser explícita e justificada. Nenhuma linha recebe APROVADO por preenchimento manual sem conferência.

## 14. ORGANIZAÇÃO DOS DOCUMENTOS E EVIDÊNCIAS

### 14.1 Identidade de projeto, auditoria e ocorrência

Toda execução de auditoria do EOS, inclusive sobre projetos externos, deve receber automaticamente um **projectId estável** e um **auditRunId globalmente único**, gerado antes da coleta. O identificador do projeto deve provir de identidade real do alvo (por exemplo, configuração persistida e validada), nunca de valor fixo ou presumido. O identificador da auditoria deve resistir a duas execuções simultâneas; data/hora isolada não garante unicidade. Cada registro deve conter origem da execução (CLI, MCP ou outro), alvo, escopo, timestamps com fuso, baseline Git, estado do working tree, ambiente, responsáveis/agentes e versão do EOS. Caso alguma informação não esteja disponível, registrar explicitamente a ausência, sem inventá-la.

Distinguir rigorosamente **ID do achado técnico** (reutilizável para correlacionar o mesmo problema) de **ID da ocorrência**, composta por projectId + auditRunId + identificador local do achado. Uma nova auditoria que encontre problema recorrente cria nova ocorrência e referencia a anterior; não reaproveita o parecer nem as evidências como se tivessem sido produzidos na nova execução.

### 14.2 Organização automática por projeto e execução

Ao iniciar qualquer auditoria, o EOS deve provisionar seu espaço isolado no armazenamento configurado para o projeto auditado, antes de gravar artefatos. Estrutura lógica-alvo (a ser compatibilizada com a persistência existente, sem migração destrutiva):

```text
.eos/
└── audits/
    └── <projectId>/
        ├── indice-auditorias.json
        └── <auditRunId>/
            ├── identificacao.json
            ├── relatorio-auditoria.json
            ├── relatorio-auditoria.md
            ├── plano-de-correcoes.md
            ├── matriz-rastreabilidade.md
            ├── historico-decisoes.md
            └── achados/
                └── <findingId>/
                    ├── diagnostico.md
                    ├── criterios-aceite.md
                    ├── implementacao.md
                    ├── testes.md
                    ├── evidencias/
                    └── parecer-auditoria.md
```

A estrutura é um **contrato de organização a implementar**, não uma declaração de que essas pastas ou arquivos já existem. O diretório de política do próprio EOS (`docs/auditoria/`) não deve ser confundido com o armazenamento das execuções do projeto-alvo. Para projetos somente leitura, permitir armazenamento externo configurado sem alterar os arquivos do alvo; registrar seu caminho e identidade. Não criar arquivos vazios que aparentem testes, pareceres ou evidências realizadas.

### 14.3 Preservação, concorrência e vinculação das evidências

- Criar ou reservar o espaço de cada auditRunId de forma atômica e exclusiva; colisões devem falhar ou gerar novo ID, **nunca sobrescrever** uma execução anterior.
- Cada execução deve ter seus próprios logs, evidências, diagnósticos, critérios, testes, decisões e status. Revalidações e novas tentativas devem ser versionadas ou registradas como eventos adicionais, preservando o histórico anterior.
- Uma auditoria posterior pode referenciar evidência anterior, identificando sua auditoria de origem, mas não atribuí-la à execução atual nem usá-la como prova de teste não executado novamente.
- Cada evidência deve vincular projectId, auditRunId, ID da ocorrência, teste, critério de aceite, commit/estado efetivamente testado, origem, horário e localização verificável.
- Um índice por projeto deve listar os ciclos e permitir localizar/comparar achados novos, recorrentes, corrigidos e pendentes, **sem converter automaticamente** achados em aprovados.
- Execuções paralelas, inclusive de agentes diferentes, não podem compartilhar diretório de escrita mutável nem modificar registros encerrados. Atualizações de índices devem ser transacionais ou protegidas contra perda de atualização.
- Registros volumosos ou sensíveis podem ficar em armazenamento seguro, preservando referências verificáveis, controles de acesso e hashes quando cabíveis. Nunca versionar credenciais, segredos, tokens ou dados sensíveis.

### 14.4 Critérios mínimos de comprovação da auto-organização

A implementação desse requisito deve demonstrar por testes executados e evidências materiais que: (1) duas auditorias sucessivas do mesmo projeto ficam separadas e consultáveis; (2) auditorias de projetos distintos não se misturam; (3) duas auditorias simultâneas não colidem nem sobrescrevem dados; (4) uma reauditoria preserva o histórico e referencia ocorrências anteriores; (5) ausência de metadados ou falha de gravação é informada, não convertida em sucesso; e (6) a leitura do índice retorna apenas registros realmente persistidos. O aceite depende de logs/resultados vinculados à versão testada e de revisão independente, conforme as demais seções desta diretriz.

## 15. RELATÓRIO OBRIGATÓRIO AO FINAL DE CADA CICLO

Identificação (ID, versão de referência, commit, executor, auditor, data/ambiente); Diagnóstico (problema, causa raiz, evidências iniciais, impacto); Implementação (alterações, arquivos, justificativa, riscos/dependências); Validação (critérios, testes, comandos reais, exit codes, resultados, referências a logs, testes não realizados e justificativas, comparação antes/depois); Auditoria (inspeções, reprodução independente, divergências, regressões, riscos residuais, lacunas de evidência); Parecer final (APROVADO/REPROVADO/INCONCLUSIVO com justificativa e referências; pendências; próxima ação). O relatório declara expressamente o que foi observado diretamente, reproduzido, inferido e o que permanece não verificado.

## 16. GOVERNANÇA MULTIAGENTE

Papéis: **Executor** (analisa e implementa; coleta registros iniciais); **Revisor** (inspeciona alterações, contratos, arquitetura, qualidade, riscos); **Auditor** (verifica independentemente critérios e autenticidade técnica); **Responsável pela decisão** (autoriza encerramento com base no parecer e na matriz). Separação de nomes/identidades não comprova independência: o auditor deve realizar verificações próprias. O auditor pode rejeitar evidências, reprovar implementações e solicitar novos testes. Nenhum agente transforma implementação em "Concluída" apenas por declarar sua própria execução bem-sucedida.

## 17. CRITÉRIOS DE ENCERRAMENTO DO PLANO

O plano só encerra quando: todos os achados tratados ou com decisão formal de risco residual; cada correção aprovada tem implementação identificável; critérios obrigatórios comprovados; testes com resultados registrados; auditorias independentes documentadas; sem falhas críticas abertas incompatíveis; matriz de rastreabilidade completa; documentos correspondem ao código entregue; evidências localizáveis/verificáveis; pendências e limitações declaradas. Aceitação formal de risco não é correção concluída.

## 18. REGRA FINAL — VERIFICAÇÃO ACIMA DE DECLARAÇÕES

A implementação não prova a correção. A compilação não prova o comportamento correto. O teste isolado não prova a ausência de regressões. O relatório do agente não prova que os testes foram executados. O checklist não prova que as etapas foram realizadas. O commit não prova que a solução é eficaz. Assinatura sem validação independente não prova autenticidade.

A conclusão exige a cadeia: **Problema comprovado → Causa identificada → Alteração rastreada → Teste executado → Resultado materializado → Auditoria independente → Critérios atendidos → Aprovação fundamentada.**

Na ausência de qualquer comprovação obrigatória, a decisão é INCONCLUSIVA ou REPROVADA.

---

## INSTRUÇÃO FINAL AO AGENTE EXECUTOR

Implementar esta diretriz como política de governança do plano de correções. Para cada achado: apresentar primeiro as evidências reais do problema; estabelecer critérios de aceite antes de modificar o código; implementar somente após verificar o estado atual do repositório; executar os testes pertinentes; apresentar resultados concretos com origem e versão verificáveis; submeter a auditoria independente; atualizar status somente mediante parecer sustentado por evidências; preservar o histórico de tentativas, reprovações e correções; não substituir verificações técnicas por afirmações; não finalizar enquanto houver critérios obrigatórios sem comprovação.

**Objetivo definitivo:** um processo no qual qualquer auditor técnico independente consiga verificar não apenas o que o agente afirma ter feito, mas o que realmente foi executado, quais resultados foram produzidos e por que a implementação merece ou não aprovação.

> Sem evidência concreta, não existe aprovação técnica.
> Sem rastreabilidade, não existe comprovação auditável.
> Sem validação da causa raiz, não existe garantia suficiente de correção.
> Sem auditoria independente, uma declaração de sucesso permanece apenas uma declaração.
