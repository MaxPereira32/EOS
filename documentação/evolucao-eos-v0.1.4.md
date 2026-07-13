# Evolução Arquitetural — EOS v0.1.4

Este documento descreve as motivações, o escopo, as decisões técnicas e os impactos esperados relativos à evolução do **Engineering Operating System (EOS)** para a versão `v0.1.4`.

---

## 1. Motivo da Evolução

Até a versão `v0.1.3`, o EOS possuía excelentes capacidades analíticas de diagnóstico (Princípios, Modelos de Maturidade, Matrizes de Acoplamento e Risco e Protocolos processuais). Contudo, havia uma lacuna operacional: o framework descrevia *o que* fazer (Processos), mas dependia exclusivamente da interpretação humana ou ad-hoc dos engenheiros e agentes de IA para guiar *como* executar cada etapa prática.

Para mitigar a inconsistência de execução técnica e garantir que a IA e desenvolvedores operem sob regras rígidas de segurança de código, criamos a camada de **Prompts Operacionais de Engenharia**. Essa camada atua como o motor de execução orientada do framework, traduzindo processos abstratos em instruções imperativas executáveis por agentes cognitivos.

---

## 2. Arquivos Adicionados nesta Versão

A evolução `v0.1.4` introduz a seguinte estrutura sob a pasta `EOS/prompts/`:

* **`EOS/prompts/README.md`**: Define a taxonomia conceitual do diretório e mapeia os cenários de uso de cada prompt.
* **`EOS/prompts/onboarding-projeto.md`**: Fornece o roteiro executável para entrada em bases de código desconhecidas, com proibição estrita de alteração de código.
* **`EOS/prompts/auditoria-arquitetural.md`**: Orienta o diagnóstico sistemático de componentes, acoplamentos e riscos técnicos com base na matriz de risco.
* **`EOS/prompts/implementacao-controlada.md`**: Fornece as regras de baby steps, validações contínuas e proibições de refatoração massiva durante a codificação.
* **`EOS/prompts/revisao-pos-implementacao.md`**: Protocolo de checagem final antes de mergear um Pull Request, avaliando coesão, acoplamento e preservação de regras funcionais.

---

## 3. Decisões Técnicas Tomadas

1. **Separação de Responsabilidades (Conceito vs. Execução)**: Decidiu-se separar **Protocolos** de **Prompts**. Protocolos definem as regras e governança (ex: "quem aprova", "quais os critérios"). Prompts fornecem o passo a passo imperativo de execução do agente (ex: "execute o comando X", "preencha a tabela Y").
2. **Agnosticismo Tecnológico Preservado**: Nenhuma instrução operacional nos prompts faz referência a linguagens (JavaScript, Python), bancos (Firebase, MySQL) ou frameworks de UI específicos. O fluxo operacional permanece utilizável em qualquer ecossistema tecnológico.
3. **Restrições de Execução (Modo Somente-Leitura no Onboarding)**: Estabeleceu-se a proibição absoluta de alterar código durante o Onboarding, forçando o agente a priorizar a compreensão do sistema antes de propor melhorias.

---

## 4. Impacto Esperado

* **Consistência de Comportamento dos Agentes de IA**: Redução da variação na qualidade dos diagnósticos e implementações efetuadas por IAs parceiras de desenvolvimento.
* **Redução de Regressões Operacionais**: Com a obrigatoriedade de baby steps e validações intermediárias em `implementacao-controlada.md`, eliminamos grandes refatorações "Big Bang" que quebram fluxos silenciosamente.
* **Agilidade no Acolhimento de Projetos**: Desenvolvedores e agentes realizam o reconhecimento de novos repositórios de forma ordenada, gerando artefatos de documentação estruturados padronizados automaticamente.
