# EOS-DET-009 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-DET-009 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Falsos positivos no analisador heurístico de segredos (ex.: declaração de tipo acusada como vazamento) |
| **Origem** | Auditoria de origem (plano Codex §2) — autoauditoria anterior |
| **Criticidade** | Média — ruído de detecção corrói a confiança nos gates |
| **Prioridade** | P2 |
| **Status** | **Em análise — reprodução pendente** (exigência §4.2 antes de qualquer implementação) |
| **Executor / Auditor** | — / — |
| **Baseline** | `508581c` + working tree |
| **Arquivos afetados** | A identificar após reprodução (módulos de detecção de segredos do EOS) |

## Diagnóstico atual

O achado permanece como **hipótese de auditoria anterior** — não confirmado nem refutado nesta baseline. Reproduzir exige executar o detector de segredos sobre o código do próprio EOS (`EOS/core`), o que produz artefatos `.eos` e consome varredura; deliberadamente não executado nesta auditoria.

## Regra aplicada

A Diretriz proíbe confundir hipótese com defeito confirmado (§4.2). Até reprodução com evidência material, este achado não pode entrar em implementação nem ser usado em parecer.

## Evidência

- EVD-A1-EOS-DET-009-001-limite.txt — registro explícito da não-reprodução e do motivo.

## Próxima ação
Agendar execução controlada do detector sobre `EOS/core` (com `outputDir` isolado) e capturar: arquivo acusado, linha, classificação, e o julgamento de falso positivo com o trecho de código.
