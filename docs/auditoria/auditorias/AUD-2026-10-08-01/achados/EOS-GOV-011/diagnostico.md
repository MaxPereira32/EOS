# EOS-GOV-011 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-GOV-011 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Execuções sucessivas de auditoria sobrescrevem os artefatos anteriores (histórico não preservado) |
| **Origem** | Inspeção solicitada pelo responsável pela decisão (regra geral de registro de auditorias) |
| **Criticidade** | Média — não invalida a auditoria corrente, mas destrói o histórico: a evidência da execução N−1 deixa de existir a cada nova execução; impede comparação, tendência e reauditoria forense |
| **Prioridade** | P1 |
| **Status atual** | Em validação (R01 implementada; aguardando auditoria independente) |
| **Executor** | opencode |
| **Auditor** | subagente opencode |
| **Baseline** | commit `508581c` + working tree (EVD-A1-EOS-GOV-003-001) |
| **Arquivos afetados** | `EOS/core/reporters/json-reporter.ts` (escrita fixa `auditoria.json`), `EOS/core/reporters/markdown-reporter.ts` (`acf-auditoria.md`), chamada em `EOS/core/services/audit-application-service.ts:1248-1249` |

## Causa raiz

`JsonReporter.writeReport` e `MarkdownReporter.writeReport` escrevem nomes fixos dentro do diretório de saída; `executeAudit` os invoca com o mesmo `outputDir` a cada execução, sem qualquer namespace por execução (`audit_run_id` existe no relatório, mas não no caminho).

## Impacto

- Em **qualquer projeto** auditado pelo EOS: `.eos/auditoria.json` e `.eos/acf-auditoria.md` representam apenas a última execução; execuções anteriores são perdidas.
- Mistura de histórico: impossível provar o que uma auditoria anterior afirmava (anti-requisito direto da Diretriz §14/§17).
- Agrava a exposição do EOS-CI-008 (o CI publica apenas o snapshot mais recente).

## Reprodução (executada)

1. Alvo-sonda `eos-gov011-target` com `package.json` sem scripts.
2. `npx tsx EOS/bin/eos.ts audit .` duas vezes (intervalo >1s), cwd = alvo.
3. Resultado real (EVD-…-001): mesmo caminho `.eos/auditoria.json`; `RUN-24ee91d4c89a` → `RUN-af5943f81102`; SHA-256 `3286F83C…` → `61544FDD…`; pasta `.eos/auditorias` inexistente.

## Limitações
- Reprodução executada no Windows local (mesma plataforma do alvo de uso).
- A pasta `.eos/` do repositório-alvo está no `.gitignore`; a preservação de histórico é local ao projeto auditado (não versionada) — declarado como risco residual aceito na correção (arquivamento em disco, não em Git).
