# EOS-GOV-011 / R01 — Testes

Ambiente e baseline: EVD-A1-EOS-GOV-003-001. Critérios: `../../criterios-aceite.md`.

| Teste | Critério | Procedimento | Esperado | Observado | Exit | Evidência |
|---|---|---|---|---|---|---|
| TST-G11-01 | CA-G11-01/03 | execução única (CLI, cwd=alvo); inspeção de caminhos | pasta `<run_id>` com JSON+MD; canônico presente | pasta criada com ambos os artefatos; canônico `.eos/auditoria.json` e `.eos/acf-auditoria.md` presentes | 1 (veredito do alvo) | EVD-…-002 |
| TST-G11-02 | CA-G11-02 | duas execuções sequenciais; hash do arquivo da execução 1 antes/depois | run_ids distintos; hash da run 1 inalterado | `RUN-3f799785436e` e `RUN-96ade1853e65`; hash da run 1 **inalterado**; 2 pastas coexistem | 1 / 1 | EVD-…-001 (defeito, pré-fix) / 002 (corrigido) |
| TST-G11-03 | CA-G11-05 | `npx tsx --test EOS/tests/audit-archive.test.ts` — rodado contra o código **sem** a correção (stash controlado, hash de restauração verificado) e com a correção | falha no antigo; passa no corrigido | **antigo: exit 1**; corrigido: exit 0; arquivo restaurado com hash idêntico (`B7026AC6…`) | 1 → 0 | EVD-…-003a / 003b |
| TST-G11-04 | CA-G11-04 | `npm test` (suíte completa, com o novo teste) | `fail = 0` | 174 testes, 173 pass, 0 fail, 1 skip | 0 | EVD-…-004 |
| TST-G11-05 | CA-G11-04 | `npx tsc --noEmit` | exit 0 | sem erros | 0 | EVD-…-005 |

## Comparação antes/depois (TST-G11-02)

| Observação | Antes (EVD-…-001) | Depois (EVD-…-002) |
|---|---|---|
| Caminho do artefato | sempre `.eos/auditoria.json` | `.eos/audit…` canônico + `.eos/auditorias/<run_id>/` |
| Run anterior | destruída (hash trocou) | preservada (hash estável) |
| Pastas de histórico | 0 | 2 (ambas as execuções) |

## Pendência
- **Auditoria independente** (transcrição em EVD-A1-EOS-GOV-003-018, compartilhada) — parecer final desta rodada condicionado a ela.
