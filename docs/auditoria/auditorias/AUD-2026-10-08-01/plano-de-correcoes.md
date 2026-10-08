# AUD-2026-10-08-01 — Plano de Correções (status final desta auditoria)

> Regido pela Diretriz (`../../../diretriz-governanca.md`). Auditoria encerrada em **escopo parcial**: dois achados validados até a aprovação independente; os demais receberam baseline material e permanecem abertos com status formal.

## Quadro de status (final)

| Achado | Crit. | Prior. | Status | Rodada | Evidência decisiva | Parecer |
|---|---|---|---|---|---|---|
| EOS-GOV-003 | Crítica | P0 | **Concluído** | R01 reprovada → R02 aprovada | EVD-A1-EOS-GOV-003-010/011/015/017b + 018 | `rodadas/R02…/parecer.md` — **APROVADO** |
| EOS-GOV-011 | Média | P1 | **Concluído** | R01 aprovada | EVD-A1-EOS-GOV-011-001/002/003a/003b/004 + 018 | `rodadas/R01…/parecer.md` — **APROVADO** |
| EOS-GOV-012 | Alta | P1 | Pendente | — | EVD-A1-EOS-GOV-012-001 | critérios a definir (F1 da proposta §14) |
| EOS-GOV-004 | Crítica | P0 | Pendente | — | EVD-A1-EOS-GOV-004-002 | critérios a definir |
| EOS-SEC-005 | Alta | P1 | Pendente | — | EVD-A1-EOS-SEC-005-002 | critérios a definir |
| EOS-SEC-001 | Crítica | P0 | Pendente | — | EVD-A1-EOS-SEC-001-001 | critérios a definir |
| EOS-CI-008 | Alta | P1 | Pendente | — | EVD-A1-EOS-CI-008-001 | bloqueado por EOS-SEC-005 (ordem técnica) |
| EOS-GOV-006 | Alta | P1 | Pendente | — | EVD-A1-EOS-GOV-006-002 | critérios a definir |
| EOS-SEC-002 | Média | P1 | Pendente | — | EVD-A1-EOS-SEC-002-001 | critérios a definir |
| EOS-OPS-007 | Média | P1 | Pendente | — | EVD-A1-EOS-OPS-007-001 | decisão de arquitetura pendente |
| EOS-DET-009 | Média | P2 | Em análise | — | EVD-A1-EOS-DET-009-001-limite | reprodução pendente |

## Iniciativa arquitetural (não autorizada)

- **Proposta Codex §14** — análise de coerência: `../../../proposta-item-14-analise-coerencia.md`. Coerente com lacunas bloqueantes L1–L4 e dependências D1/D2; implementação não autorizada; instrumento já aprovado (EOS-GOV-011) sustenta a base estrutural.
- **Regra global** de registro/isolamento de auditorias registrada em `~/.config/opencode/AGENTS.md` e `docs/auditoria/README.md` — aplicável a qualquer projeto.

## Riscos residuais formais

- Working tree **não commitado** (commit não autorizado): as aprovações são vinculadas à revisão `508581c` + arquivos modificados; qualquer edição posterior invalida a auditoria (§11).
- Colisão teórica de `run_id` (não testada; dispensa aprovada no contrato do GOV-011).
- Pureza de stdout verificada nos caminhos exercitados (não exaustiva sobre todos os engines).
- Migração histórica: `.eos` anteriores a esta campanha guardavam apenas a última execução (o próprio defeito do GOV-011); não há histórico anterior a migrar.

## Encerramento

Achados pendentes permanecem registrados — **ausência de prova não é aprovação** (§12). O plano global (todos os achados) só encerra quando cada item tiver correção aprovada ou decisão formal de risco residual (§17).
