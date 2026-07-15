# EOS Version & Governance Manifest

Este documento é o manifesto oficial de governança e controle de versão do **Engineering Operating System (EOS)**. Ele registra a versão ativa, data de homologação, os componentes integrados e o histórico de evolução do framework.

---

## 1. Identificação do Framework

* **Versão Ativa**: EOS v0.9.0
* **Data de Homologação**: 2026-07-14
* **Status**: Homologado e Pronto para Congelamento Técnico

---

## 2. Componentes Habilitados

### 2.1 Core (Fundamentos)
* [x] **Princípios Fundamentais** (`core/principios.md`)
* [x] **Pensamento Sênior** (`core/pensamento-senior.md`)
* [x] **Modelo de Instância** (`core/modelo-instancia.md`)

### 2.2 Modelos Analíticos
* [x] **Matriz de Acoplamento e Coesão** (`modelos/matriz-acoplamento.md`)
* [x] **Matriz de Risco Arquitetural** (`modelos/matriz-risco.md`)
* [x] **Maturidade Arquitetural** (`modelos/maturidade-arquitetural.md`)

### 2.3 Protocolos Ativos
* [x] **Protocolo de Aplicação de Projeto** (`protocolos/aplicacao-projeto.md`)
* [x] **Protocolo de Análise de Projeto** (`protocolos/analise-projeto.md`)
* [x] **Protocolo de Revisão de Código** (`protocolos/revisao-codigo.md`)
* [x] **Protocolo de Refatoração Segura** (`protocolos/refatoracao-segura.md`)
* [x] **Protocolo de Migração Arquitetural** (`protocolos/migracao-arquitetural.md`)
* [x] **Protocolo de Ciclo de Engenharia** (`protocolos/ciclo-engenharia.md`)

### 2.4 Camada de Prompts Operacionais
* [x] **Prompt de Onboarding** (`prompts/onboarding-projeto.md`)
* [x] **Prompt de Auditoria** (`prompts/auditoria-arquitetural.md`)
* [x] **Prompt de Implementação Controlada** (`prompts/implementacao-controlada.md`)
* [x] **Prompt de Revisão Pós-Implementação** (`prompts/revisao-pos-implementacao.md`)

---

## 3. Histórico de Versões

| Versão | Data | Alterações Relevantes |
| :---: | :--- | :--- |
| **v0.1.1** | 2026-07-10 | Estrutura inicial do framework (README, princípios, revisão e análise simples). |
| **v0.1.2** | 2026-07-13 | Criação dos modelos analíticos, templates de ADR, planos e protocolos de refatoração/migração. |
| **v0.1.4** | 2026-07-13 | Introdução da Camada Operacional de Prompts de Engenharia para orquestração cognitiva. |
| **v0.1.5** | 2026-07-13 | Implementação do Project Lifecycle Controller (Ciclo de Engenharia, snapshots e aprendizados). |
| **v0.2.0** | 2026-07-14 | Introdução do orquestrador Platform e Event Bus síncrono. |
| **v0.3.0** | 2026-07-14 | Estrutura modular de engines e reporters. |
| **v0.4.0** | 2026-07-14 | Transição para Domain-Driven Architecture baseada em Modelo de Domínio formal (RFC-002). |
| **v0.5.0** | 2026-07-14 | Implementação do Artifact Consistency Framework (ACF) baseado em 8 modelos analíticos e adaptadores modulares. |
| **v0.6.0** | 2026-07-14 | Introdução do Semantic Graph compartilhado, hierarquia de adaptadores, confidenceScore de inconsistências e entidade RefactoringPlan rica. |
| **v0.7.0** | 2026-07-14 | Introdução do Knowledge Graph (carregamento de Features e Domínios de negócio no Semantic Graph). |
| **v0.8.0** | 2026-07-14 | Implementação da Dependency Engine (acoplamentos proibidos) e Security Engine (rotas expostas e pacotes vulneráveis). |
| **v0.9.0** | 2026-07-14 | Implementação da Architecture Diff Engine (delta de nós e arestas com histórico no MarkdownReporter). |

---

## 4. Padrão de Versionamento Semântico (SemVer EOS)

O framework EOS obedece a regras de versionamento semântico rígidas para controle de estabilidade:

* **`0.X.Y` (Experimental)**: Fase inicial de testes e pilotos. Alterações estruturais e quebras de protocolos podem ocorrer sem garantias de retrocompatibilidade.
* **`1.0.0` (Estável)**: Framework consolidado, com estrutura de diretórios e contratos de saída congelados e testados em produção.
* **`1.X.y` (Minor - Nova Funcionalidade)**: Adição retrocompatível de novos protocolos, modelos analíticos, prompts ou templates.
* **`1.x.Y` (Patch - Correções)**: Ajustes de digitação, melhorias na clareza de frases de prompts ou correções documentais sem alterar a metodologia.
* **`2.0.0` (Major - Quebra de Compatibilidade)**: Reestruturação profunda que exige migração manual das instâncias `.eos/` existentes (ex: mudança drástica na especificação de ADRs ou nos Gates de qualidade).
