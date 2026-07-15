# Engineering Operating System (EOS) — v0.9.0

Bem-vindo ao **Engineering Operating System (EOS)**, uma plataforma de **Continuous Architecture** orientada por evidências, projetada para guiar tomadas de decisões técnicas, governança arquitetural e evolução de sistemas de forma verificável, automatizada, extensível e pautada em um Modelo de Domínio formal (Domain-Driven).

O EOS não é um projeto de aplicação; ele é um **método de operação, governança e verificação contínua** para equipes de tecnologia, aplicável a qualquer stack tecnológica ou domínio de negócio.

---

## 1. Estrutura de Diretórios (v0.9.0)

A versão `v0.9.0` introduz o **Semantic Graph Compartilhado**, o **Knowledge Graph**, a **Dependency Engine (v0.8)**, a **Security Engine (v0.8)** e a **Architecture Diff Engine (v0.9)** integrados ao **Artifact Consistency Framework (ACF)** e ao **Modelo de Domínio formal (RFC-002)**.

```
Engineering-Operating-System/
├── EOS/
│   ├── README.md                     # Visão geral da plataforma
│   ├── core/
│   │   ├── platform/                 # Infraestrutura de execução
│   │   │   ├── eos-platform.js       # Orquestrador central da plataforma (v0.9.0)
│   │   │   ├── event-bus.js          # Barramento tipado com ExecutionContext (v0.4.0)
│   │   │   ├── execution-context.js  # Identidade imutável (branch, commit, env) (v0.4.0)
│   │   │   └── semantic-graph.js     # Grafo Semântico e de Conhecimento Compartilhado (v0.9.0)
│   │   ├── domain/                   # Contratos formais e validações (Domain Model)
│   │   │   ├── fact.js               # Entidade Fact (imutável) (v0.4.0)
│   │   │   ├── metric.js             # Entidade Metric (v0.4.0)
│   │   │   ├── indicator.js          # Entidade Indicator (v0.4.0)
│   │   │   └── rule-result.js        # Entidade RuleResult (v0.4.0)
│   │   ├── engines/                  # Processadores e analisadores
│   │   │   ├── normalizer.js         # Normalizador de fatos canônicos (v0.5.0)
│   │   │   ├── metrics-engine.js     # Motor de cálculo de métricas derivadas (v0.5.0)
│   │   │   ├── rule-engine.js        # Motor de regras declarativas sem eval (v0.4.0)
│   │   │   ├── quality-gate-engine.js# Motor de portões de qualidade (v0.4.0)
│   │   │   ├── dependency-engine.js  # Motor de acoplamentos e restrições de domínio (v0.8.0)
│   │   │   ├── security-engine.js    # Motor de segurança e rotas expostas (v0.8.0)
│   │   │   └── architecture-diff-engine.js # Motor de diff de versões arquiteturais (v0.9.0)
│   │   ├── acf/                      # Módulo Artifact Consistency Framework (ACF) (v0.6.0)
│   │   │   ├── acf-core.js           # Orquestrador do pipeline de consistência
│   │   │   ├── adapter-registry.js   # Registro dinâmico de adaptadores
│   │   │   ├── domain/               # Entidades de domínio tipadas e validadas (DDD)
│   │   │   │   ├── facts.js          # Construtores de fatos estruturados
│   │   │   │   ├── artifact.js       # Entidade Artifact
│   │   │   │   ├── reference.js      # Objeto de Valor Reference
│   │   │   │   ├── dependency.js     # Entidade Dependency
│   │   │   │   ├── inconsistency.js  # Entidade Inconsistency
│   │   │   │   └── refactoring-plan.js # Entidade RefactoringPlan (v0.6.0)
│   │   │   ├── engines/              # Engines dos 8 Modelos Analíticos
│   │   │   └── adapters/             # Adaptadores de tecnologia (react, css e bases)
│   │   ├── reporters/                # Emissão de relatórios desacoplados
│   │   │   ├── json-reporter.js      # Gerador de auditoria.json (preserva config) (v0.5.0)
│   │   │   └── markdown-reporter.js  # Gerador de auditoria-automatica.md (v0.4.0)
│   │   ├── eos-collector.js          # Legado: Collector Engine (v0.2.0)
│   │   ├── eos-validator.js          # Legado: Evidence Engine (v0.1.8)
│   │   ├── principios.md             # Princípios fundamentais de design
│   │   ├── pensamento-senior.md      # Filosofia de engenharia sênior
│   │   ├── modelo-instancia.md       # Fronteira Framework/Instância
│   │   ├── quality-gates.md          # Portões de qualidade (documentação)
│   │   ├── ape-detector.md           # Detector de perfil arquitetural
│   │   ├── collectors/               # Plugins de coleta (Adapter Pattern)
│   │   │   ├── eslint.js             # Adaptador ESLint
│   │   │   ├── depcruise.js          # Adaptador Dependency-Cruiser
│   │   │   ├── vitest.js             # Adaptador Vitest
│   │   │   └── phpunit.js            # Adaptador PHPUnit
│   │   └── rules/                    # Regras declarativas
│   │       └── default-rules.json    # Políticas de pontuação em JSON (v0.5.0)
│   ├── perfis/                       # Catálogo de Perfis Arquiteturais
│   ├── modelos/                      # Modelos analíticos
│   ├── antipadroes/                  # Catálogo de antipadrões
│   ├── knowledge-base/               # Memória técnica
│   ├── query-base/                   # Base de conhecimento de frameworks
│   ├── protocolos/                   # Protocolos de engenharia
│   ├── prompts/                      # Prompts operacionais
│   └── templates/                    # Templates reutilizáveis
└── documentação/
    ├── genesis-prompt.md              # Prompt de fundação (histórico)
    ├── EOS-v0.1.2-implementacao.md
    ├── evolucao-eos-v0.1.4.md
    ├── evolucao-eos-v0.1.5.md
    ├── evolucao-eos-v0.1.6.md
    ├── evolucao-eos-v0.1.8.md
    ├── evolucao-eos-v0.1.9.md
    ├── evolucao-eos-v0.2.0.md
    ├── evolucao-eos-v0.3.0.md
    ├── evolucao-eos-v0.4.0.md         # Relatório de entrega v0.4.0
    └── evolucao-eos-v0.5.0.md         # Relatório de entrega v0.5.0 (ACF)
```

---

## 2. A Camada de Aplicação (`.eos/`)

Para aplicar o EOS em um projeto de software, crie um diretório chamado `.eos/` na raiz desse projeto. Este diretório conterá os registros de aplicação do framework adaptados ao contexto específico.

Exemplo de estrutura em um projeto-alvo:
```
Meu-Projeto/
├── src/
├── package.json
└── .eos/
    ├── contexto.md                # Visão geral do negócio e restrições
    ├── arquitetura-atual.md       # Diagrama lógico e físico atual
    ├── mapa-modulos.md            # Mapeamento de módulos e dependências internas
    ├── problemas-identificados.md # Catálogo de riscos e debito técnico detectado
    ├── decisoes/                  # Registros de Decisão Arquitetural (ADRs) baseadas no template
    └── roadmap.md                 # Planejamento estratégico de evolução técnica
```

---

## 3. Filosofia de Evolução do EOS

Como um sistema operacional de engenharia, o EOS evolui como um produto de software:
1. **Histórico e Changelog**: Todas as mudanças devem ser versionadas de forma semântica (evoluindo de `0.1` ──> `0.1.1` ──> `0.1.2` ──> `0.1.4` ──> `0.1.5`).
2. **Desacoplamento de Domínio**: Nenhum documento do EOS sob a pasta `/EOS` deve conter regras de negócio de aplicações específicas.
3. **Foco na Resolução de Causa Raiz**: O framework deve sempre desencorajar soluções temporárias ou ad-hoc que gerem débito técnico não planejado.

---

## 4. Próximos Passos
1. Estude os **[Princípios Fundamentais](core/principios.md)**, a filosofia de **[Pensamento Sênior](core/pensamento-senior.md)** e o **[Modelo de Instância](core/modelo-instancia.md)** do EOS.
2. Ao adotar o framework em um novo projeto, siga as orientações do **[Protocolo de Aplicação de Projeto](protocolos/aplicacao-projeto.md)** e regule o ciclo de vida com o **[Protocolo de Ciclo de Engenharia](protocolos/ciclo-engenharia.md)**.
3. Utilize os modelos analíticos: **[Maturidade Arquitetural](modelos/maturidade-arquitetural.md)**, **[Matriz de Acoplamento](modelos/matriz-acoplamento.md)** e **[Matriz de Risco](modelos/matriz-risco.md)**.
4. Para orientar a execução prática de tarefas, utilize os **[Prompts Operacionais](prompts/README.md)**.
5. Para realizar alterações operacionais e migrações estruturais na base de código do produto, siga rigorosamente os protocolos de **[Refatoração Segura](protocolos/refatoracao-segura.md)** e **[Migração Arquitetural](protocolos/migracao-arquitetural.md)**.
