# EOS-GOV-012 / R01 — Testes

Critérios: `../../criterios-aceite.md`. Evidência global da campanha: EVD-A2-EOS-GOV-012-003 (executada de cwd externo aos alvos).

| Teste | Critério | Procedimento | Observado | Exit | Evidência |
|---|---|---|---|---|---|
| TST-012-01 | CA-012-01 | 2 projetos distintos, mesmo cwd (EOS); CLI `audit` em cada | canônicos com `root_path` de cada projeto; projX=2 runs, projY=1; **EOS/.eos/auditoria.json inalterado** (hash `B7D0C9DF…` antes=depois) | 1/1 | EVD-…-003 §1/§4 |
| TST-012-01b | CA-012-01 | teste de suíte: alvos A/B sem `outDir`; cwd não recebe | `canonico no alvo A/B` + `sem mistura` + `cwd nao recebe` (asserts) | 0 | EVD-…-001 (suite) |
| TST-012-02 | CA-012-02 | suíte existente com `outDir` explícito (governance/execution/claims/archive) | todos os testes existentes permanecem verdes | 0 | EVD-…-001 |
| TST-012-03 | CA-012-03 | arquivo homônimo `auditorias` no `outDir` | `executeAudit` **rejeita** (`assert.rejects`); sem identificação produzida | 0 | EVD-…-001 |
| TST-012-04 | CA-012-04 | `npm test` + `npx tsc --noEmit` | 180 testes: pass 179, fail 0, skip 1; tsc limpo | 0/0 | EVD-…-001 / 002 |

## Comparação antes/depois
- **Antes** (EVD-A1-EOS-GOV-012-001): execução do cwd `EOS` contra alvo externo gravou em `EOS\.eos\auditoria.json` (mistura entre projetos).
- **Depois** (EVD-A2-…-003): 3 execuções contra 2 projetos externos → cada alvo recebeu seus artefatos; `EOS/.eos` por hash inalterado.

## Pendência
Auditoria independente (parecer condicionado).
