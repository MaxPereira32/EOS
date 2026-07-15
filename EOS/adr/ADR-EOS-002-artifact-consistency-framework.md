# ADR-EOS-002 — Introdução do Módulo Artifact Consistency Framework (ACF)

* **Status**: Aprovada
* **Autor(es)**: Arquiteto-Chefe EOS
* **Data**: 2026-07-14
* **Decisões Relacionadas**: ADR-EOS-001 (Governança)

---

## 1. Contexto Técnico e Metodológico

Em sistemas de software modernos, a inconsistência entre artefatos de diferentes camadas (por exemplo, uso de classes CSS inexistentes em arquivos JSX, templates órfãos, nomenclaturas fora do padrão do Design System ou contratos de API em desacordo com as entidades de domínio) gera débito técnico silencioso e quebras em tempo de execução.

Para tratar essa dor de forma contínua e automatizada, foi proposta a criação de uma capacidade de auditoria arquitetural integrada ao EOS. O escopo original visava uma solução voltada especificamente para apresentação (Presentation Consistency Framework - PCF). Contudo, durante o processo de design, identificou-se que os modelos de auditoria, diagnóstico e refatoração poderiam ser generalizados para monitorar a consistência de outros artefatos (como APIs, domínios, banco de dados, documentação, etc.).

---

## 2. Decisões Arquiteturais e de Design

Decidimos introduzir o **Artifact Consistency Framework (ACF)** na base do EOS, estendendo a arquitetura original com as seguintes especificações:

### 2.1 Generalização para "Artifact" em vez de "Presentation"
* O framework foi nomeado como **ACF** (Artifact Consistency Framework) para ser de propósito geral.
* A camada de apresentação (HTML, CSS, React, etc.) é tratada como um conjunto de adaptadores específicos do ACF, tornando a plataforma extensível.

### 2.2 Desacoplamento através de Adaptadores (Adapter Pattern)
* O núcleo do ACF (`core/acf/`) permanece 100% agnóstico a linguagens, frameworks ou tecnologias.
* Todo o conhecimento técnico específico pertence aos adaptadores (ex: `ReactAdapter`, `CSSAdapter`), registrados dinamicamente via `AdapterRegistry`.

### 2.3 Pipeline Baseado em 8 Modelos Analíticos
O ACF executa a auditoria em um fluxo sequencial:
1. **Inventário**: Coleta e registra artefatos e referências brutas.
2. **Correlação**: Estabelece um grafo universal de dependências cruzando referências com definições.
3. **Diagnóstico**: Detecta inconsistências estruturais (referências quebradas, órfãos, nomenclatura fora do padrão) com severidades configuráveis.
4. **Planejamento**: Elabora um plano de alteração sem aplicar mudanças (Dry-Run).
5. **Execução**: Aplica as refatorações sugeridas de forma física (se autorizado pelo operador).
6. **Validação**: Auditoria pós-execução para validar se as inconsistências planejadas foram eliminadas.
7. **Regressão**: Compara resultados atuais com a linha de base histórica para monitorar tendências.
8. **Relatório**: Consolida score de consistência, métricas e o grafo de correlação no relatório.

### 2.4 Camada Intermediária: Semantic Graph Compartilhado
* Introduzimos uma camada intermediária de representação de dados entre a fase de Fatos e as Regras: o **Semantic Graph** (`core/platform/semantic-graph.js`).
* Em vez de engines e coletores cruzarem arrays de fatos de forma independente, todos populam e consultam um Grafo Semântico compartilhado.
* Os artefatos tornam-se Nós (com ID, tipo e atributos) e as referências tornam-se Arestas Direcionadas (com origem, destino e propriedades).
* As engines do ACF (e potencialmente outros módulos futuros como Security e Dependency Engines) reutilizam essa base comum de conhecimento, permitindo análises complexas baseadas em grafos (como busca de ciclos direcionados para dependências circulares).

### 2.5 Modelo de Fatos Estruturados Imutáveis e Compatibilidade com o EOS
* Todos os resultados do pipeline ACF são expressos em Fatos Estruturados (ex: `acf.artifact.identified`, `acf.inconsistency.detected`) encapsulados como instâncias da classe `Fact` do EOS.
* As métricas de alto nível do ACF (como `acf.consistencyScore`) são injetadas no EventBus global do EOS, permitindo que o `RuleEngine` aplique penalidades nos indicadores globais de consistência (`CON`) e qualidade arquitetônica (`ARQ`).

---

## 3. Consequências e Trade-offs

### Ganhos
* **Extensibilidade Sem Acoplamento**: Adição de novos adaptadores (ex: Angular, Vue, OpenAPI) sem tocar no núcleo do EOS.
* **Governança Unificada**: Regras declarativas globais do EOS agora avaliam e penalizam inconsistências de artefatos.
* **Refatoração Segura**: O ciclo planejamento-execução-validação garante que correções aplicadas não quebrem a integridade do projeto.

### Custos / Perdas
* **Processamento Adicional**: A varredura estática de arquivos exige maior consumo de CPU na esteira de Continuous Architecture, mitigada pelo suporte à paralelização e execução incremental.
