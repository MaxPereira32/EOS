# Registro de Auditorias (índice global — append-only)

> Regra: cada auditoria possui ID único e pasta própria. Novas auditorias **adicionam** linha e pasta; nunca editam linhas anteriores. Corrigenda de uma auditoria encerrada usa errata na própria pasta (novo arquivo), nunca reescrita.

| AUD ID | Data | Escopo | Base (commit/tree) | Executor | Auditor(es) | Pasta | Status |
|---|---|---|---|---|---|---|---|
| AUD-2026-10-08-01 | 2026-10-08 | Reauditoria do plano de correções do EOS: EOS-GOV-003 (R01 e R02), EOS-GOV-011 (novo), verificação de baseline dos demais achados | `508581c` + working tree modificado | opencode (deepseek-v4.1-flash) | R01: opencode (independente do implementador original); R02/GOV-011: subagente opencode (auditoria independente) | `auditorias/AUD-2026-10-08-01/` | **Concluída (escopo parcial)** — EOS-GOV-003 e EOS-GOV-011 aprovados com auditoria independente; demais achados com baseline material e status registrados |
| AUD-2026-10-08-02 | 2026-10-08 | Implementação planejada §14 (F1+F2): EOS-GOV-012 (ancoragem ao alvo), EOS-GOV-013 (identificação/índice), EOS-GOV-014 (recorrência); F3 bloqueada (EOS-SEC-005); storage externo fora de escopo | `508581c` + working tree (inclui AUD-01 não commitada) | opencode (deepseek-v4.1-flash) | subagente opencode (independente, a executar) | `auditorias/AUD-2026-10-08-02/` | **Concluída** — EOS-GOV-012/013/014 aprovados com auditoria independente (ressalva documental atendida); item 14 permanece ABERTO (F3/L2-completo/multi-processo/L4/storage) |

## Mapa de sequências

| Sequência | Auditoria |
|---|---|
| A1 | AUD-2026-10-08-01 |
| A2 | AUD-2026-10-08-02 |

> Sequências de evidência (`EVD-A<seq>-…`) são imutáveis e únicas globalmente via este mapa.
