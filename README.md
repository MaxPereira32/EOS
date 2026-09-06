# Engineering Operating System (EOS) 🚀

[![EOS Version](https://img.shields.io/badge/EOS-v2.2.0-blue.svg)](https://github.com/MaxPereira32/EOS)
[![CLI Version](https://img.shields.io/badge/CLI-v4.0.0--HardGate-red.svg)](https://github.com/MaxPereira32/EOS)
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
- [CLI e Comandos Operacionais](#-cli-e-comandos-operacionais)
- [Servidor MCP (Model Context Protocol)](#-servidor-mcp-model-context-protocol)
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
- **Auditoria Causal e Anti-Simulação** distinga evidências sintéticas/falsos verdes de evidências comprovadas em execução real.
- **Ecossistema Multi-Agente Nativo** orquestre agentes especializados (Implementer, Reviewer, Evidence Auditor) para verificação e restauração de invariantes com rastreabilidade formal.

---

## 🏗️ Arquitetura do Sistema

```
Engineering-Operating-System (EOS)
│
├── 🧠 Core Platform (Event Bus, Execution Context, Semantic Graph, MCP Server)
├── 🏛️ Domain Model (Fact, Metric, Indicator, RuleResult, SecurityClaim)
├── ⚙️ Engines Analíticas:
│   ├── Audit Engine & Quality Gates (Validação de Causalidade)
│   ├── Dependency Engine (Acoplamento & Fronteiras)
│   ├── Security Engine (Threat Modeling STRIDE / Zero Trust)
│   ├── Compliance Engine (Auditoria LGPD/GDPR & PII)
│   ├── Architecture Diff Engine (Detecção de Drift Arquitetural)
│   ├── NIST Assessment Engine (Conformidade SSDF SP 800-218)
│   └── Multi-Agent Orchestration Protocol
├── 🧩 Artifact Consistency Framework (ACF)
└── 📊 Reporters & Collectors (JSON, Markdown, Adaptadores ESLint/Vitest/Cruiser)
```

---

## ⚙️ Principais Módulos e Engines

### 1. **Core & Platform (TypeScript)**
- **`eos-platform.ts`**: Orquestrador central que inicializa os subsistemas e executa os pipelines analíticos.
- **`event-bus.ts`**: Barramento de eventos tipado para comunicação desacoplada entre motores e adaptadores.
- **`semantic-graph.ts`**: Grafo semântico e de conhecimento compartilhado para navegação entre fatos e artefatos.
- **`eos-mcp-server.ts`**: Servidor MCP nativo em stdio (JSON-RPC 2.0) para conexão direta com agentes de IA.

### 2. **Modelo de Domínio (DDD)**
- Entidades imutáveis: **Fact**, **Metric**, **Indicator**, **RuleResult** e **SecurityClaim**.
- Garantia de auditoria auditável e determinística sem efeito colateral.

### 3. **Engines Especializadas**
- **Audit Application Service (`v4.0.0`)**: Executa a esteira real de governança, checagem de Quality Gates e avaliação de Security Claims contra falsos verdes.
- **Multi-Agent Orchestration Engine**: Protocolo nativo de governança cooperativa entre agentes (`IMPLEMENTER`, `REVIEWER`, `EVIDENCE_AUDITOR`).
- **NIST Assessment Engine**: Avaliação e reavaliação de conformidade com snapshots antes/depois (NIST SP 800-218 SSDF v1.1).
- **Dependency Engine**: Analisa acoplamentos e violações de fronteiras de domínio.
- **Security Engine**: Modelagem de ameaças autônoma delegada a agentes de inteligência (Zero Trust, STRIDE).
- **Compliance Engine**: Orquestra agentes legais (LGPD/GDPR) para auditar privacidade e rastreabilidade de PII.
- **Architecture Diff Engine**: Compara versões da arquitetura para detectar derivações não autorizadas (*architecture drift*).
- **Rule Engine**: Executa regras declarativas sem uso de expressões inseguras (`eval`).

### 4. **Artifact Consistency Framework (ACF)**
- Garante a coerência entre documentação, código-fonte e especificações técnicas por meio de adaptadores configuráveis.

---

## 📂 Estrutura do Repositório

```
EOS/
├── EOS/                            # Núcleo da plataforma e especificações
│   ├── README.md                   # Documentação interna detalhada do núcleo
│   ├── bin/                        # CLI Unificado (eos.ts)
│   ├── core/                       # Plataforma, engines, serviços, domínio e ACF
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
│   └── evolucao-eos-v0.x.x.md      # Histórico de lançamentos da v0.1.2 à v2.2.0+
│
├── Age/                            # Agentes de inteligência e skills para auditorias de segurança
├── .agents/                        # Configurações locais e definições de skills (ex: eos-governance)
├── .eos/                           # Configurações globais do framework e relatórios de auditoria
├── package.json                    # Definição do pacote Node.js (v2.2.0)
└── README.md                       # Documentação principal do repositório
```

---

## 💻 CLI e Comandos Operacionais

O EOS disponibiliza um CLI corporativo unificado (`EOS/bin/eos.ts`) com controles cautelares rígidos (*Self-Governed Hard Gate Edition*):

| Comando | Descrição |
| :--- | :--- |
| `npm run audit` ou `npx tsx EOS/bin/eos.ts audit [caminho]` | Executa a esteira completa de auditoria de governança, validando Quality Gates e causalidade de segurança. |
| `npx tsx EOS/bin/eos.ts orchestrate <finding_id>` | Executa o protocolo multi-agente nativo para validação e restauração de invariantes com rastreamento formal em JSON. |
| `npx tsx EOS/bin/eos.ts nist-assess <req_id>` | Executa a esteira de conformidade normativa NIST SSDF SP 800-218 (ex: `PW.8.2`) com snapshots antes/depois. |
| `npm run graph` | Gera e analisa o Grafo Semântico de domínio e acoplamentos. |
| `npm run self-governance` | Executa a auto-governança do EOS sobre sua própria base de código. |
| `npm run test` | Executa a suíte de testes de integridade e conformidade. |

> 🔒 **Aviso de Salvaguarda:** O comando de remediação direta (`eos fix`) permanece intencionalmente **desabilitado por segurança** para garantir validação atômica de *Unified Diff* e contenção contra *Path Traversal* antes de qualquer escrita no disco.

---

## 🔌 Servidor MCP (Model Context Protocol)

O EOS conta com um servidor **MCP nativo** sobre `stdio` (JSON-RPC 2.0), permitindo integração contínua com agentes de IA (Google Antigravity, Claude Code, Cursor, Codex):

```bash
npm run mcp
```

### Ferramentas expostas pelo MCP Server:
- `eos_run_audit`: Executa a auditoria de governança contínua e retorna resultados de Quality Gates e findings.
- `eos_check_rules`: Avalia e consulta regras de catálogo corporativo (OWASP, CWE, NIST, MITRE).
- `eos_query_graph`: Consulta o grafo de domínio e calcula Blast Radius de ativos arquiteturais.

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
   - Integre o EOS no seu pipeline de CI/CD ou no workflow local para rodar a auditoria:
     ```bash
     npx tsx <caminho-para-eos>/EOS/bin/eos.ts audit .
     ```
   - Os relatórios de conformidade e ACF serão gerados em `.eos/auditoria.json` e `.eos/acf-auditoria.md`.

---

## 📚 Documentação e Evolução

Acesse a pasta [`documentação/`](documentação/) para visualizar o histórico completo de evolução da plataforma, incluindo especificações detalhadas de cada versão lançada.

---

## 📄 Licença

Este projeto é disponibilizado sob a licença [MIT](LICENSE).
