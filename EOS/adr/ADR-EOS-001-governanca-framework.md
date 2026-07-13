# ADR-EOS-001 — Governança e Evolução do Framework EOS

* **Status**: Aprovada
* **Autor(es)**: Auditor-Chefe & Principal Architect EOS
* **Data**: 2026-07-13
* **Decisões Relacionadas**: Nenhuma

---

## 1. Contexto Técnico e Metodológico

Como um Engineering Operating System (EOS), o framework atua como a infraestrutura lógica e o conjunto de regras fundamentais que regem o desenvolvimento de projetos da organização. Sem regras estritas de governança sobre si mesmo, o EOS corre o risco de sofrer acúmulo de duplicações, inconsistências documentais, obsolescência de prompts operacionais e acoplamentos específicos de projetos reais (vazamento de domínio).

---

## 2. Decisões de Governança do Framework

Decidimos estabelecer regras explícitas para a governança e evolução contínua da base documental do EOS:

### 2.1 Critério de Modificação de Protocolos
* **Protocolos (`EOS/protocolos/`)** são metodologias de alto nível (estáveis). Só podem ser alterados quando houver uma mudança no fluxo de engenharia da organização aprovada pela governança corporativa.
* Qualquer proposta de alteração de protocolo exige a atualização prévia da versão semântica menor (minor) do EOS e a emissão de um relatório de evolução correspondente.

### 2.2 Critério de Evolução de Prompts Operacionais
* **Prompts (`EOS/prompts/`)** traduzem protocolos para execução prática por agentes/desenvolvedores. Eles podem ser atualizados frequentemente para melhorar a clareza das instruções e reduzir alucinações.
* **Proibição de Duplicação**: Não é permitido criar prompts paralelos com o mesmo propósito (ex: múltiplos prompts de auditoria). Se um prompt for otimizado, o arquivo original deve ser sobrescrito ou reestruturado de forma unificada.

### 2.3 Proibição de Vazamento de Domínio (Desacoplamento)
* Nenhum arquivo sob o core do framework (`EOS/`) deve conter caminhos absolutos, nomes de coleções ou referências de domínio específicas de um único projeto consumidor (como `cebus` ou `Cebus ERP`).
* Exemplos e estruturas devem utilizar strings parametrizadas como `[nome-do-projeto]/` para garantir a universalidade de aplicação.

### 2.4 Processo de Validação de Mudanças (Dogfooding)
* Toda modificação relevante no EOS deve ser testada imediatamente via simulação de aplicação (dogfooding) em pelo menos um projeto real ativo, validando a integridade dos artefatos de saída e ausência de regressões metodológicas.

---

## 3. Consequências e Trade-offs

### Ganhos
* **Estabilidade e Confiabilidade**: O framework permanece universal, testável e agnóstico de tecnologia.
* **Consistência Documental**: Evita que o time de engenharia receba prompts desalinhados dos protocolos oficiais.
* **Profissionalismo**: O framework se comporta como um produto de software maduro.

### Custos / Perdas
* **Esforço de Versionamento**: Exige rigor no acompanhamento de changelogs e incrementos de tags de release.
