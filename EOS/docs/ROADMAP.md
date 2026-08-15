# EOS — ROADMAP

Este documento registra a evolução planejada para o Engineering Operating System (EOS).

## Fases em Andamento / Planejadas

### PHASE-6.x: Durable Storage Hardening
* **ID**: P-6.1
* **Nome**: Durable Fact Storage and Concurrency
* **Objetivo**: Implementar persistência atômica no Filesystem para garantir imutabilidade real e proteger contra Time of Check to Time of Use (TOCTOU) e Race Conditions em orquestrações de agentes simultâneos.
* **Status**: `IN_PROGRESS` (Sub-fases pendentes de consolidação)
* **Dependências**: Phase 3.2.0 (Architectural Contract)
* **Critérios de Entrada**: Finalização da governança basal; drift detection funcionando.
* **Critérios de Saída**: Testes de concorrência com 100 workers simulados passando com 0 colisões em filesystem local.
* **Riscos**: Performance I/O degradada; limite de file descriptors estourado no OS.
* **Evidências Esperadas**: Logs do Vitest reportando sucesso em rotinas de carga massiva; artefatos JSON hash-linkados no diretório.

### PHASE-4.x: Self-Governance Sandbox Expandida
* **ID**: P-4.2
* **Nome**: Native Orchestration Swarm
* **Objetivo**: Integrar o orquestrador autônomo (Swarm) e as APIs estendidas de validação de PR.
* **Status**: `PLANNED`
* **Dependências**: P-6.1 (Storage durável é requerido para registro distribuído de decisões por swarm agents).
* **Critérios de Entrada**: Phase 6.1 concluída e integrada.
* **Critérios de Saída**: O Swarm consegue aprovar ou reprovar um PR com base nos invariants, rodando 3 agentes diferentes de revisão isolada.
* **Riscos**: Loop infinito de negações do Agent Reviewer; bloqueio excessivo do pipeline.
* **Evidências Esperadas**: Pipeline CI falhando ativamente com logs do agente Auditor refutando as invenções do agente Implementer.

## Fases Concluídas (Recentes)

### PHASE-3.2.0
* **Status**: `COMPLETED`
* **Objetivo**: Estabelecer o Contrato Arquitetural Final de Governança.
* (Consulte o `PHASE-INDEX.md` para detalhes).
