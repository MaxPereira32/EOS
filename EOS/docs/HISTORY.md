# EOS — HISTORY

Este arquivo é o histórico cronológico de alto nível do EOS. O registro de cada fase mais aprofundado encontra-se na pasta `PHASES/`.

| Data | Fase | Evento | Decisão/Mudança | Impacto | Referências |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Q1 2026** | **Phase 1** | Gênesis | Fundação do sistema baseado no Prompt de Gênesis e Invariantes Causais (Observation → Resolution). | Criação da base de DDD e Engines. | `PHASES/legacy/genesis-prompt.md` |
| **Q1 2026** | **Phase 2** | Snapshot Hardening | Implementação de avaliação rigorosa do `NistAssessmentEngine`. | Bloqueio de evidência estaleira e falsas resoluções. | `tests/phase-2-3...` |
| **2026-08-15** | **Phase 3.1.4** | Architectural Boundary | Isolamento físico do `core/domain` via AST parsing. | Evita vazamento de I/O na lógica de avaliação. | `EOS_PHASE_3.1.4..._AUDIT.md` |
| **2026-08-15** | **Phase 3.1.5** | Invariant Regression | Criação do Gate de Auto-Governança que barra ataques contra o próprio motor de avaliação. | O sistema trava se a segurança for desativada via código. | `EOS_PHASE_3.1.5..._AUDIT.md` |
| **2026-08-15** | **Phase 3.1.6** | Governance Integrity | Criação do mecanismo de Change Control. | Mudanças em arquivos de engines/domain exigem classificação Class D. | `EOS_PHASE_3.1.6..._AUDIT.md` |
| **2026-08-15** | **Phase 3.2.0** | Contract Consolidation | Final Architectural Contract estabelecido e ligado a Testes Físicos (`npm test`). | Governança e verificação estrutural 100% integradas. Documentação poética removida. | `ADR-XXX`, `PHASE-3.2.0` |
| **2026-08-15** | **Phase 3.2.1** | Versioned Project Memory | Estruturação de memória histórica contínua e rastreável. | Separação do histórico de chat e a fixação do Git como Single Source of Truth. | `PROJECT_STATE.md` |

*(Históricos legados de v0.1.x a v0.9.x foram arquivados nas indexações de Fases antigas para limpeza do log principal).*
