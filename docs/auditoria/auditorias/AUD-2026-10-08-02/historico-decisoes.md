# AUD-2026-10-08-02 — Histórico de Decisões (append-only)

## D-A02-001 — Autorização e escopo da implementação
- **Data:** 2026-10-08 · **Responsável:** responsável pela decisão
- **Decisão:** autorizar a implementação planejada da proposta §14 **dentro do escopo F1+F2**; F3 bloqueada (EOS-SEC-005); storage externo e L4 fora do escopo.
- **Evidência:** mensagem de autorização; `escopo.md`.
- **Estado anterior → novo:** “implementação não autorizada” (análise de coerência) → “Em implementação (AUD-02)”.

## D-A02-002 — Critérios de aceite congelados antes da implementação
- **Data:** 2026-10-08 · **Responsável:** opencode (executor)
- **Decisão:** congelar CA-012-01..04, CA-013-01..05, CA-014-01..02 nos dossiês antes de qualquer alteração de código; mapeamento explícito para CA-14-01..09 da proposta.
- **Evidência:** `achados/*/criterios-aceite.md` (referenciados por hash no manifest).
- **Regra:** nenhum critério será alterado após a implementação; mudanças futuras = novo registro com aprovação do auditor.

## D-A02-003 — Plano de implementação (aprovado para execução)
- **Data:** 2026-10-08 · **Responsável:** opencode
- **Decisão:** implementar: (1) `outputDir` default ancorado a `target.root_path/.eos`; (2) `AuditRegistryService` (novo) para `identificacao.json`, `indice-auditorias.json` derivado, listagem e fingerprints; (3) injeção de interface (CLI/MCP) no contexto da auditoria; (4) `run_id` com componente de unicidade monotônica (`hrtime`) para eliminar colisão teórica; (5) testes de regressão/contrato/concorrência.
- **Alternativas descartadas:** índice como arquivo autoritativo com lock (complexidade desnecessária; derivado por scan elimina corrida na escrita); renomear artefatos para os nomes da proposta §14 (L4 fora do escopo — mantém compatibilidade CI).

## D-A02-004 — Veredito independente: APROVADO (3 achados), com ressalva documental
- **Data:** 2026-10-08 · **Responsável:** subagente auditor independente (transcrição por opencode)
- **Decisão:** aceitar CA-012-01..04, CA-013-01..05 e CA-014-01..02 como demonstrados por reprodução própria (alvos A–D, N=2 e N=5 simultâneas, falha `ENOTDIR`, reauditoria com fingerprint estável).
- **Ressalva:** encerramento bloqueado até existirem MANIFEST.md nas 3 rodadas (item 8 inconclusivo por ausência documental).
- **Evidência:** EVD-A2-EOS-GOV-012-005.

## D-A02-005 — Regularização documental e encerramento dos achados
- **Data:** 2026-10-08 · **Responsável:** opencode
- **Decisão:** criar os 3 MANIFEST.md (append-only, SHA-256) com o reuso da campanha declarado; conferir todos os hashes contra a lista independente `aud2-evidence-sha256.txt` — **0 divergências**; corrigir a contagem de arquivos no relatório de implementação do GOV-012 e esclarecer a ambiguidade de caminho.
- **Efeito:** ressalva atendida; EOS-GOV-012/013/014 → **Concluído** na revisão auditada (working tree `508581c`).
- **Item 14 permanece ABERTO:** F3 (EOS-SEC-005), L2 completa, concorrência multi-processo, L4 e storage externo — campanha futura de aceitação completa exigida para encerrar.
