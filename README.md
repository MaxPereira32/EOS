# Engineering Operating System (EOS) 🚀

[![EOS Version](https://img.shields.io/badge/EOS-v0.9.0-blue.svg)](https://github.com/MaxPereira32/EOS)
[![Architecture](https://img.shields.io/badge/Architecture-Continuous-green.svg)](https://github.com/MaxPereira32/EOS)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

O **Engineering Operating System (EOS)** é uma plataforma de **Continuous Architecture** orientada por evidências, desenvolvida para guiar tomadas de decisões técnicas, governança arquitetural e evolução de sistemas de software de forma verificável, automatizada, extensível e pautada em um Modelo de Domínio formal (Domain-Driven Design).

Diferente de frameworks tradicionais, o EOS não é um projeto de aplicação final, mas sim um **método de operação, governança e verificação contínua** para equipes de engenharia de software, aplicável a qualquer stack tecnológica ou domínio de negócio.

---

## 📋 Sumário

- [Visão Geral](#-visão-geral)
- [Arquitetura do Sistema](#-arquitetura-do-sistema)
- [Principais Módulos e Engines](#-principais-módulos-e-engines)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Como Utilizar em seu Projeto](#-como-utilizar-em-seu-projeto)
- [Documentação e Evolução](#-documentação-e-evolução)
- [Licença](#-licença)

---

## 💡 Visão Geral

O EOS atua como a espinha dorsal de governança arquitetural para projetos modernos, garantindo que:

- **Decisões Arquiteturais (ADRs)** sejam rastreáveis e verificadas continuadamente contra o código-fonte real.
- **Portões de Qualidade (Quality Gates)** impeçam a introdução de dívidas técnicas e antipadrões.
- **Modelos Analíticos e Métricas** forneçam visibilidade sobre o acoplamento, coesão, segurança e saúde dos artefatos.
- **Grafo Semântico e de Conhecimento** permita entender a evolução de dependências e a relação entre componentes do sistema.

---

## 🏗️ Arquitetura do Sistema

```
Engineering-Operating-System (EOS)
│
├── 🧠 Core Platform (Event Bus, Execution Context, Semantic Graph)
├── 🏛️ Domain Model (Fact, Metric, Indicator, RuleResult)
├── ⚙️ Engines Analíticas (Metrics, Dependency, Security, Arch Diff, Rule Engine)
├── 🧩 Artifact Consistency Framework (ACF)
└── 📊 Reporters & Collectors (JSON, Markdown, Adaptadores ESLint/Vitest/Cruiser)
```

---

## ⚙️ Principais Módulos e Engines

### 1. **Core & Platform**
- **`eos-platform.js`**: Orquestrador central que inicializa os subsistemas e executa os pipelines analíticos.
- **`event-bus.js`**: Barramento de eventos tipado para comunicação desacoplada entre motores e adaptadores.
- **`semantic-graph.js`**: Grafo semântico e de conhecimento compartilhado para navegação entre fatos e artefatos.

### 2. **Modelo de Domínio (DDD)**
- Entidades imutáveis: **Fact**, **Metric**, **Indicator** e **RuleResult**.
- Garantia de auditoria auditável e determinística sem efeito colateral.

### 3. **Engines Especializadas**
- **Dependency Engine (`v0.8.0`)**: Analisa acoplamentos e violações de fronteiras de domínio.
- **Security Engine (`v0.8.0`)**: Identifica rotas expostas e pontos de vulnerabilidade arquitetural.
- **Architecture Diff Engine (`v0.9.0`)**: Compara versões da arquitetura para detectar derivações não autorizadas (*architecture drift*).
- **Rule Engine**: Executa regras declarativas sem uso de expressões inseguras (`eval`).

### 4. **Artifact Consistency Framework (ACF)**
- Garante a coerência entre documentação, código-fonte e especificações técnicas por meio de adaptadores configuráveis.

---

## 📂 Estrutura do Repositório

```
EOS/
├── EOS/                            # Núcleo da plataforma e especificações
│   ├── README.md                   # Documentação interna detalhada do núcleo
│   ├── core/                       # Plataforma, engines, domínio e ACF
│   ├── perfis/                     # Catálogo de perfis arquiteturais
│   ├── modelos/                    # Modelos analíticos e métricas
│   ├── antipadroes/                # Catálogo de antipadrões detectáveis
│   ├── knowledge-base/             # Memória técnica e padrões
│   ├── query-base/                 # Consultas e bases de conhecimento
│   ├── protocolos/                 # Protocolos operacionais de engenharia
│   ├── prompts/                    # Prompts operacionais e assistentes
│   └── templates/                  # Templates reutilizáveis (ADRs, RFCs)
│
├── documentação/                   # Histórico de evolução e relatórios de entrega
│   ├── genesis-prompt.md           # Prompt de fundação
│   └── evolucao-eos-v0.x.x.md      # Histórico de lançamentos da v0.1.2 à v0.5.0+
│
├── .eos/                           # Configurações globais do framework
├── package.json                    # Definição do pacote Node.js
└── README.md                       # Documentação principal do repositório
```

---

## 🛠️ Como Utilizar em seu Projeto

Para adotar o **EOS** em seu projeto de software:

1. **Adicione a pasta `.eos/` no diretório raiz do seu repositório:**
   ```
   Meu-Projeto/
   ├── src/
   ├── package.json
   └── .eos/
       ├── contexto.md                # Visão do negócio e restrições
       ├── arquitetura-atual.md       # Diagrama e estrutura arquitetural
       └── decisores.md               # Registro de ADRs
   ```

2. **Execute as análises de governança:**
   - Integre o EOS no seu pipeline de CI/CD para rodar os coletores (`collectors`) e gerar os relatórios `auditoria.json` e `auditoria-automatica.md`.

---

## 📚 Documentação e Evolução

Acesse a pasta [`documentação/`](file:///c:/Users/Max/Desktop/Projeto/EOS/documentação) para visualizar o histórico completo de evolução da plataforma, incluindo especificações detalhadas de cada versão lançada.

---

## 📄 Licença

Este projeto é disponibilizado sob a licença [MIT](LICENSE).
