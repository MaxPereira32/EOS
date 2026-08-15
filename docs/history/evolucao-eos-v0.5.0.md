# Relatório de Evolução Arquitetural — EOS v0.5.0 (Artifact Consistency Framework - ACF)

Este relatório detalha a introdução e implementação do **Artifact Consistency Framework (ACF)** (evolução do proposto Presentation Consistency Framework - PCF) no **Engineering Operating System (EOS)**, viabilizando a governança contínua de consistência cruzada entre artefatos de múltiplas tecnologias.

---

## 1. Do PCF para o ACF: Uma Evolução Metodológica

A proposta inicial visava o monitoramento de consistência de apresentação (Presentation Consistency Framework). No entanto, seguindo os princípios de *Continuous Architecture*, o escopo foi expandido para **Artifact Consistency Framework (ACF)**. 

Essa generalização permite que as mesmas engines analíticas e estruturas de fatos validem não só a apresentação (ex: React, CSS), mas também outros tipos de componentes, tais como contratos de APIs (OpenAPI/Swagger), modelos de banco de dados, documentação, infraestrutura e pipelines.

---

## 2. Arquitetura do Módulo ACF (`core/acf/`)

A implementação do ACF foi estruturada sob o paradigma de baixo acoplamento e alta coesão:

```
core/acf/
├── acf-core.js           # Orquestrador do pipeline de consistência (ACFPlatform)
├── adapter-registry.js   # Registro desacoplado de plugins adaptadores
├── domain/
│   └── facts.js          # Definições formais de Fatos Estruturados (ACFFacts)
├── adapters/
│   ├── base-adapter.js   # Interface abstrata para adaptadores de tecnologia
│   ├── react-adapter.js  # Coletor/Refatorador de componentes React (JSX/TSX)
│   └── css-adapter.js    # Coletor/Refatorador de folhas de estilo CSS
└── engines/
    ├── inventory-engine.js   # Modelo 1: Coleta artefatos e referências
    ├── correlation-engine.js # Modelo 2: Constrói grafo de dependências cruzadas
    ├── diagnostic-engine.js  # Modelo 3: Identifica inconsistências e severidades
    ├── planning-engine.js    # Modelo 4: Elabora planos de refatoração sugeridos
    ├── execution-engine.js   # Modelo 5: Executa refatorações físicas no disco
    ├── validation-engine.js  # Modelo 6: Valida integridade no estado pós-execução
    ├── regression-engine.js  # Modelo 7: Avalia tendências históricas
    └── reporting-engine.js   # Modelo 8: Consolida métricas e gera relatório markdown
```

---

## 2.1 Fortalecimento do Modelo de Dados Interno (DDD)

Para garantir segurança estrutural e alinhar o ACF à arquitetura Domain-Driven desenvolvida no EOS v0.4.0 (RFC-002), fortalecemos o modelo interno de dados introduzindo entidades de domínio formais e imutáveis na pasta `core/acf/domain/`:

* **`Artifact`**: Entidade que representa e valida tipos e caminhos físicos de arquivos e componentes de forma unificada.
* **`Reference`**: Objeto de valor que encapsula referências a componentes ou arquivos externos (linhas, colunas, caminhos).
* **`Dependency`**: Entidade representando as relações direcionadas de dependência calculadas pelas engines.
* **`Inconsistency`**: Entidade que encapsula o diagnóstico arquitetônico e garante a consistência do nível de severidade e do impacto.
* **`ChangePlan`**: Entidade de domínio que valida rigorosamente ações de refatoração, riscos e impactos operacionais.

Qualquer fato estruturado do ACF passa obrigatoriamente pela validação destas classes de domínio antes de ser registrado no barramento, blindando a plataforma contra formatos de dados inválidos gerados por adaptadores externos.

---

## 2.2 A Camada Intermediária: Semantic Graph Compartilhado

Com o objetivo de aumentar a inteligência do EOS como plataforma e evitar que múltiplos módulos downstream implementem lógicas redundantes de correlação, introduzimos o **Semantic Graph** (`core/platform/semantic-graph.js`) como um recurso compartilhado global.

A nova arquitetura segue o fluxo lógico:
`Inventory (Coletores) ──> Fatos Estruturados ──> Semantic Graph ──> Rule Engine ──> Quality Gates`

### Benefícios e Efeito Multiplicador:
* **Base de Conhecimento Centralizada**: Os fatos gerados por coletores e adaptadores são lidos e mapeados em uma estrutura matemática unificada de Nós e Arestas.
* **Consultas Simplificadas e Precisas**: A detecção de referências quebradas, órfãos e anomalias de nomenclatura do ACF foi reescrita utilizando APIs de busca flexíveis no grafo semântico.
* **Análise Complexa de Grafos**: Implementamos o algoritmo de busca em profundidade (DFS) para detecção de **dependências circulares** (`findCycles`), enriquecendo o diagnóstico arquitetural.
* **Reutilização Global**: Futuros módulos de segurança, documentação ou dependências de pacotes do EOS podem consultar diretamente o grafo estruturado sem reimplementar lógicas de mapeamento.

---

## 3. Modelo de Fatos e Métricas no EventBus do EOS

Para manter total compatibilidade com o ecossistema existente, todo fato gerado pelo ACF (como `ArtifactIdentified` ou `InconsistencyDetected`) estende a classe canônica `Fact` do EOS. 

O `ACFMetricsEngine` gera métricas agregadas da execução (ex: `acf.consistencyScore`, `acf.brokenReferences`, `acf.orphans`), que são emitidas como Fatos no EventBus global. Isso viabiliza o monitoramento declarativo por meio de regras no `default-rules.json`:

* **`RULE-CON-003`**: Penaliza consistência (`CON`) e arquitetura (`ARQ`) de forma linear para cada referência quebrada encontrada.
* **`RULE-CON-004`**: Penaliza o indicador `CON` se o score geral de consistência cair abaixo de 90/100.
* **`RULE-CON-005`**: Penaliza o indicador `CON` se houver mais de 5 artefatos órfãos na base de código.

---

## 4. Homologação e Validação de Campo (Dogfooding)

A homologação foi conduzida em um projeto-alvo simulado (`demo-project`) configurado com os adaptadores React e CSS contendo as seguintes condições induzidas de teste:
1. **Referência Quebrada**: O componente React `Button.jsx` usa a classe `btn-primary`, mas o arquivo `Button.css` não a define.
2. **Artefato Órfão**: O arquivo `Button.css` define `.btn-secondary`, porém ela não é utilizada em nenhum JSX.
3. **Inconsistência de Nomenclatura**: O arquivo React `invalid-component.jsx` viola a política regex PascalCase.

### Resultado do Pipeline Global:
* **Execução**: `node ../core/platform/eos-platform.js`
* **Score de Consistência ACF**: **52/100**
* **Inconsistências Detectadas**: 8 ocorrências
* **Disparo de Regras Declarativas**:
  * `RULE-CON-003` aplicada: `-30` nos indicadores `CON` e `ARQ`
  * `RULE-CON-004` aplicada: `-20` no indicador `CON`
* **Resultado dos Quality Gates**:
  * `[Gate ❌] ARQ = 70/100` (Mínimo exigido: 80)
  * `[Gate ❌] CON = 50/100` (Mínimo exigido: 90)
  * **Pipeline Bloqueado com sucesso (Exit Code 1)**.
* **Artefatos Gerados**:
  * Relatório Markdown detalhado gerado em `.eos/auditorias/acf-auditoria.md` contendo diagrama Mermaid de dependências.
  * Relatório JSON estruturado gerado em `.eos/auditorias/auditoria.json` preservando a chave `acf` de configuração.
