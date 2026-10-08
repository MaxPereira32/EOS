# EOS-CI-008 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-CI-008 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Pipeline com lacunas de confiabilidade (instalação não-determinística e gate sem verificação de assinatura) |
| **Origem** | Auditoria de origem (plano Codex §2) + re-verificação de baseline |
| **Criticidade** | Alta — o gate de CI pode ser enganado por relatório editado manualmente (não valida assinatura) e a instalação pode variar entre execuções |
| **Prioridade** | P1 |
| **Status** | Pendente (bloqueado por D1/SEC-005 para a parte de assinatura) |
| **Executor / Auditor** | — / — |
| **Baseline** | `508581c` + working tree |
| **Arquivos afetados** | `.github/workflows/eos-audit.yml:25` (`npm ci \|\| npm install`), `:31-47` (validação do relatório sem `signReport`/`verifyReport`) |

## Causa raiz

1. Fallback para `npm install` mascara lockfile inconsistente (build não reprodutível).
2. O passo “Verify Report Integrity” lê `overall_phase_status` do JSON **sem validar a assinatura** — apesar do nome, não verifica integridade; um relatório forjado passa.

## Impacto

- CI “verde” com relatório adulterado (o atacante nem precisa quebrar o HMAC — o CI não o confere).
- Repro não determinística corrói a comparabilidade entre execuções (relevante para a proposta §14/14.7).

## Evidência

- EVD-A1-EOS-CI-008-001 — inspeção estática do workflow (linhas 25, 31-47, 49-53) + ausência de `verifyReport`/`signReport`.

## Limitações
- Correção da validação de assinatura depende de D1 (EOS-SEC-005 — assinatura hoje falsificável não serve de gate). Ordem de implementação obrigatória: SEC-005 → CI-008.
