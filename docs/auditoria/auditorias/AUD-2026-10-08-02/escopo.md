# AUD-2026-10-08-02 — Escopo e Identificação

| Campo | Valor |
|---|---|
| **Audit ID** | AUD-2026-10-08-02 |
| **Sequência de evidência** | A2 |
| **Data** | 2026-10-08 (TZ America/Sao_Paulo, UTC−3) |
| **Objetivo** | Implementação **planejada** da proposta §14 (auto-organização de auditorias), fases F1+F2, com critérios congelados antes do código e auditoria independente (§5/§9 da Diretriz). |
| **Autorização** | Concedida pelo responsável pela decisão em 2026-10-08 (“autorizo a implementação de forma planejada dentro do escopo”). |
| **Base** | `508581c` + working tree — **inclui as alterações não commitadas da AUD-01** (EOS-GOV-003 R01/R02, EOS-GOV-011, teste `audit-archive`); dependência declarada. |
| **Achados no escopo** | EOS-GOV-012 (ancoragem ao alvo + falha informada), EOS-GOV-013 (identificação por execução + histórico consultável + índice + concorrência), EOS-GOV-014 (recorrência por fingerprint) |
| **Dentro do planejado (F1)** | L1 ancoragem; `identificacao.json`; origem da execução (D2); índice derivado sem corrida (L3) |
| **Dentro do planejado (F2)** | Fingerprint estável de gate/finding + vínculo de reocorrência (14.4/CA-14-04) |
| **Fora do escopo** | **F3 (assinatura/14.8)** — bloqueada por EOS-SEC-005 (não autorizado nesta auditoria); storage externo (14.6); migração histórica (nada a migrar — defeito de sobrescrita era o próprio objeto do GOV-011); L4 nomenclatura (mantidos nomes canônicos atuais conforme autorização “dentro do escopo”) |
| **Executor** | opencode |
| **Auditor** | subagente opencode independente (a executar) |
| **Limitações declaradas** | (a) aprovações vinculadas a working tree não commitado (inclui AUD-01); (b) o índice é derivado/regenerável — a verdade está em `auditorias/<run_id>/identificacao.json`; (c) concorrência coberta no nível de processo único (Promise.all); multi-processo não testado nesta fase; (d) `project_id` é estável por caminho, distinto do `target_id` existente (que incorpora commit). |

## Documentos

- `plano-de-correcoes.md`, `historico-decisoes.md`, `matriz-rastreabilidade.md`, `achados/<ID>/{diagnostico.md, criterios-aceite.md, rodadas/R01…/}`.
