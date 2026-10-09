# Plano Mestre de Correções — EOS (vivo)

> Referencia os dossiês por ID; não duplica evidências, rodadas ou pareceres.
> Dossiês: `docs/auditoria/auditorias/<AUD-ID>/achados/<ID>/`. Índice: `docs/auditoria/registro-auditorias.md`.

## Backlog priorizado

| Correção | Achado(s) | Pri | Status | Objetivo |
|---|---|---|---|---|
| COR-01 | ACH-01 (Firestore SIMULATION_ONLY) | P0 | CONCLUIDO (R01 APROVADA humana; merge `cf3e200`) | Claim condicionado à declaração + aceite formal |
| COR-02 | ACH-02 + EOS-SEC-005 (HMAC hardcoded + canonicalização rasa) | P0 | CONCLUIDO (R01 APROVADA humana; merge `cf3e200`) | Segredo via SecretStore + canonicalização recursiva |
| COR-09 | Lacuna §G (parecer não travado a SHA) | P1 | PLANEJADO | Verificação de impacto automática parecer↔HEAD (reutilizar `artifact-binding-engine`) |
| COR-03 | ACH-03 (boundary API local) | P1 | EM_ANALISE | Auditar boundary completo; validar `projectId/id` |
| COR-04 | ACH-06 (CLI help + `graph`/`report`) | P1 | PLANEJADO | Help completo; implementar ou remover `graph`/`report` |
| COR-05 | ACH-08 (ACF parcial) | P2 | PLANEJADO | `.eos/arquitetura-atual.md` + `.eos/decisores.md` mínimos reais |
| COR-06 | ACH-04 (RLS Supabase) | P2 | PLANEJADO | Claim RLS + validação runtime ou não-aplicabilidade justificada |
| COR-08 | ACH-07 (`eos-version.md` v0.9.0) | P3 | PLANEJADO | Sincronizar com v2.2.0 / CLI v4.0.0 |
| COR-07 | ACH-05 (falsos positivos SECRET-001) | P3 | PLANEJADO | Confirmar example sem segredo; allowlist documentada |
| COR-10 | R1 revisão-R01 (rotação silenciosa em store corrompido) | P2 | PLANEJADO | Distinguir "store ausente" (gerar) de "store ilegível" (falhar fechado) |
| COR-11 | R2 revisão-R01 (gate `includes('FIRESTORE')` super-inclusivo) | P3 | PLANEJADO | Allowlist exata de ids de claim |

## Dependências e ordem

1. H1 (Firestore: engine real vs aceite) → COR-01. H2 (origem do segredo) → COR-02. H3 (branch `fix/audit-p0` a partir de `main`) → todas.
2. Fase 1: COR-02 → COR-01 (destrava `BLOCKED`). Fase 2: COR-09 + COR-03 + COR-04. Fase 3: COR-05, COR-06, COR-08, COR-07.

## COR-09 — Especificação (nova)

- **Problema:** parecer APROVADO é normativo (§11), não executável — merge posterior não é bloqueado.
- **Solução:** no CI/merge, comparar SHA dos arquivos do dossiê (do `MANIFEST.md`) com o HEAD; divergência em arquivo coberto → reabrir rodada (novo `R<n>`) antes de manter status.
- **Reutilização:** `EOS/core/engines/artifact-binding-engine.ts` (tripla SHA-256 + realpath); `indice-auditorias.json`.
- **Aceite:** (CA-09-01) merge com arquivo do dossiê alterado após parecer → status reaberto automaticamente; (CA-09-02) merge sem tocar dossiê → status preservado; (CA-09-03) evidência vinculada ao SHA correto.
- **Testes:** unitários do comparador + integração CI simulado + adversarial (toque em arquivo aninhado do dossiê).

## Critérios de aceite (resumo por correção)

- COR-01: claim `proven:true` com 7 vetores verificados + auditoria `GREEN`, ou claim ausente + aceite formal assinado.
- COR-02: nenhum literal de chave no código; assinatura cobre aninhados (repro `EVD-A1-EOS-SEC-005-002` invertida: alteração aninhada invalida); scanner limpo no arquivo.
- COR-03: entradas `projectId/id` validadas; inválidas → 4xx sem execução.
- COR-04: `--help` lista `mcp/audit/orchestrate/nist-assess/(graph|report)`; cada script documentado executa.
- COR-05: gate `EOS-GOVERNANCE-001` PASS. COR-06: claim RLS `VERIFIED` ou não-aplicabilidade justificada.
- COR-08: versões coincidem. COR-07: zero sinais em placeholders, reais ainda detectados.

## Índice global achado → auditorias

| Achado | AUD-01 | AUD-02 | Atual |
|---|---|---|---|
| EOS-GOV-003 | APROVADO (R02) | — | Fechado, sem recorrência |
| EOS-GOV-012 | Pendente | APROVADO | Fechado (citação; revalidar se tocar mecanismo) |
| EOS-GOV-013/014 | — | APROVADO | Fechado (citação) |
| EOS-SEC-005 (+ACH-02) | Pendente, baseline + repro | — | **Concluído AUD-03 R01 (COR-02, aprovação humana, merge `cf3e200`)** |
| ACH-01 (Firestore) | — | — | **Concluído AUD-03 R01 (COR-01, aprovação humana, merge `cf3e200`)** |
| ACH-03/04/05/06/07/08 | — | — | Abertos (RUN-c1f63e327249; revalidados `RUN-0597d2da24e8`: 5 findings + GOVERNANCE insuficiente) |

## Documentos históricos (imutáveis — reconciliados por este índice, nunca editados)

- `plano_de_correcoes_auditoria_codex.md`: auditoria de origem; status ali contidos (ex.: GOV-003 "P0 Pendente") estão **superados** por AUD-01 (GOV-003 APROVADO R02) e não devem gerar retrabalho.
- `proposta-item-14-analise-coerencia.md`: análise de coerência; itens F1/F2 concluídos em AUD-02, F3 aberta.

## Decisões do usuário (registradas 2026-10-09)

- H1: **remover o claim Firestore** + aceite formal de risco (decidido pelo usuário; engine real descartada).
- H2: **segredo HMAC via `SecretStore OS_KEYCHAIN`** (confirmado).
- H3: **branch `fix/audit-p0` criada a partir de `main`** — baseline `93288df65f4f3df8839e399bf5c2152e9be59fd5` (`main` == `origin/main`, verificado via `fetch`).
  Trabalho atual identificado e NÃO misturado: `M README.md` + untracked `CONTRIBUTING.md/COPYRIGHT.md/THIRD_PARTY_NOTICES.md/plano-mestre.md` pertencem à branch `docs/open-source-copyright-governance`.
  Escopo da branch: COR-01 (remoção do claim) + COR-02 (HMAC). Sem merge/push sem revisão independente e autorização.
- H4: abrir `AUD-2026-10-09-03` (escopo COR-02 + COR-01)? **Autorizado e executado** — R01 implementada, aprovada (humana), mergeada em `cf3e200`.
- H5 (2026-10-09): regularização da rastreabilidade (índice versionado, linha AUD-03 encerrada, codex reconciliado por índice)? **Autorizado e executado**.
