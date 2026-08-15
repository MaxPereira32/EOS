# EOS — ARCHITECTURE

This document describes the *actually implemented* architecture of the Engineering Operating System (EOS) as of Phase 3.2.0.
> **Note:** For the strict normative rules governing this architecture, refer to the canonical `architecture/EOS_FINAL_ARCHITECTURAL_CONTRACT.md`.

## Visão Arquitetural
**Status**: `IMPLEMENTED`

O EOS segue um modelo inspirado na **Hexagonal Architecture (Ports and Adapters)** fortemente focado em **Causalidade de Evidências**. O sistema não é uma aplicação web tradicional, mas sim uma suíte de execução em CLI e testes automatizados (`npm run governance`, `npm test`) que avalia o próprio repositório no qual é executado.

O princípio central: *"Observation → Evidence → Fact → Finding → Resolution"*.

## Componentes e Responsabilidades

### Core / Domain (`EOS/core/domain`)
**Status**: `IMPLEMENTED`
* **Responsabilidade**: Modelar as regras de negócio puras (Facts, Findings, Artifacts).
* **Características**:
  * Imutabilidade absoluta do domínio.
  * Agnosticismo completo em relação ao sistema operacional.
  * Não possui conhecimento sobre como a evidência foi persistida.

### Core / Engines (`EOS/core/engines`)
**Status**: `IMPLEMENTED`
* **Responsabilidade**: Avaliar fatos com base em evidências seguindo políticas estritas de segurança (ex: `NistAssessmentEngine`, `SemanticPolicyEngine`).
* **Características**:
  * Implementam as regras algorítmicas de transição causal.
  * Executam lógica de avaliação de conformidade (Compliance).

### Core / Storage (`EOS/core/storage`)
**Status**: `IMPLEMENTED`
* **Responsabilidade**: Definir interfaces puras de persistência e orquestrar a lógica abstrata de leitura/escrita.
* **Componentes Chaves**: `AuditArtifactMigrator`, repositórios em memória.

### Core / Adapters (`EOS/core/adapters`)
**Status**: `IMPLEMENTED`
* **Responsabilidade**: Lidar com as impurezas do mundo físico e do SO.
* **Componentes Chaves**: `file-execution-journal-adapter.ts`, `file-operation-adapter.ts`.
* **Características**:
  * São a camada externa do hexágono. Envelopam interações com I/O (`fs`, `child_process`).

### Serviços Orquestradores (`EOS/core/services`)
**Status**: `IMPLEMENTED`
* **Responsabilidade**: Integrar as Engines aos Adapters. Atuam como o `Application Service` que não contém regra de negócio, mas dita a ordem de execução.

## Boundaries e Regras de Acoplamento
**Status**: `IMPLEMENTED`

As fronteiras arquiteturais do sistema delimitam quem pode depender de quem:

* `core/domain` não importa **NADA** externo a ele mesmo. Dependência direcional inward.
* `core/engines` importam `core/domain`.
* `core/storage` e `core/adapters` podem importar infraestrutura do NodeJS (`fs`, `path`).
* O fluxo de execução não pode transitar de volta para as camadas internas trazendo artefatos de infraestrutura (Dependency Inversion).

## Fluxo de Dados (Causal Flow)
**Status**: `IMPLEMENTED`

1. **Observação (Adapters/Scripts)**: O estado do mundo físico (git, fs) é capturado.
2. **Evidência**: Uma string ou dado estático concreto é extraído.
3. **Fato (Domain)**: A evidência é empacotada imutavelmente num `Fact`.
4. **Avaliação (Engines)**: Fatos são avaliados gerando `Findings` (Compliance/Non-Compliance).
5. **Quality Gate (Services/CLI)**: O pipeline reage ao Finding, travando (`BLOCKED`) ou aceitando (`VERIFIED`).

## Mecanismos de Enforcement
**Status**: `IMPLEMENTED`

A arquitetura não confia em convenção, ela é imposta através de:
* **Drift Detection** (`scripts/check-architectural-drift.ts`): Parseia a AST (Abstract Syntax Tree) do Typescript para bloquear fisicamente qualquer injeção de dependência ilegal dentro da pasta `core/domain`.
* **Change Control** (`scripts/check-change-control.ts`): Verifica modificações do git e barra aprovações sem as elevações corretas de classificação de arquivos críticos.
* **Self-Governance** (`npm run self-governance`): Garante que a Engine não pode ser burlada testando ataques simulados em runtime.
* **Contract Integrity**: `tests/phase-3-2-0-architectural-contract.test.ts` garante a presença contínua das regras normativas.

## Pontos de Extensão
**Status**: `PLANNED` / `IMPLEMENTED`

* O EOS é estensível via novas Engines (Ex: Security Engine, Privacy Engine - em fase analítica/experimental).
* Adaptadores para APIs externas (Ex: Integração GitHub/GitLab). Atualmente, apenas o filesystem adapter está `IMPLEMENTED`.

## Limitações Conhecidas
**Status**: `IMPLEMENTED` / DOCUMENTED

A arquitetura depende estritamente do **Trust Boundary** local do Node.js.
* O sistema operacional, a integridade da memória e o binário do Node.js são implicitamente confiáveis.
* **Remote Attestation** e proteção de **Kernel/Root** encontram-se `OUT_OF_SCOPE` e não são cobertas por esta arquitetura.
* Não existe mitigação algorítmica caso o administrador apague ou modifique hard-links que simulam evidências se o Drift Checker não rodar.
