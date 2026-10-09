# Plano de Correções — Fase 2 (pendências abertas em `3df369d`)

> Referencia dossiês por ID; não duplica evidências. Estado-base: `RUN-0597d2da24e8` (RED: 5 findings GENAI; GOVERNANCE insuficiente) + revisão independente R01 (R1–R4).
> Convenção: cada correção só inicia com critérios abaixo inalterados; mudança de critério exige motivo registrado.

## Fase A — Mecânicas e destravamento de gates (executar primeiro)

### COR-04 — Coerência CLI/scripts (P1)

- **Causa raiz:** `printUsage()` (`EOS/bin/eos.ts:17-24`) e `case`s (`:32-230`) divergiram; scripts `graph`/`report` (`package.json:12-13`) sem `case` caem no help.
- **Solução:** completar o help (`mcp`, `audit`, `orchestrate`, `nist-assess`) + decidir `graph`/`report`: implementar (há `semantic-graph.ts` reaproveitável) ou remover scripts + ajustar README. Proibir terceira via (documentar como funcional sem ser).
- **Alternativa descartada:** só corrigir o help — deixaria scripts quebrados anunciados.
- **Arquivos:** `EOS/bin/eos.ts`, `package.json`, `README.md` (se remover).
- **Aceite:** CA-04-01 `--help` lista tudo que existe; CA-04-02 cada `npm run <x>` documentado executa exit 0 ou foi removido; CA-04-03 smoke de cada comando. **Reprovação:** comando documentado caindo no help.
- **Testes/evidências:** smoke scriptado por comando (stdout + exit code), `tsc` limpo.
- **Riscos:** baixo; **reversão:** revert do commit. **Esforço estimado:** S.

### COR-08 — `eos-version.md` obsoleto (P3, mesma branch da COR-04)

- **Causa:** manifesto parado em v0.9.0/2026-07-14; pacote v2.2.0, CLI v4.0.0.
- **Solução:** sincronizar versão/data/status + linha no histórico. Sem reescrever história.
- **Aceite:** CA-08-01 versões coincidem (`package.json`, `eos.ts`, manifesto). **Esforço:** XS.

### COR-05 — Cobertura ACF (P2)

- **Causa:** `EOS-GOVERNANCE-001` exige `.eos/arquitetura-atual.md` + `decisores.md` ou declaração em `eos.risk.yml`; `.eos/` é gitignored (solução local não versiona).
- **Solução recomendada:** criar `eos.risk.yml` versionado declarando **apenas** o perfil arquitetural real (a apurar na implementação: hoje inferido `CLI_OR_SCRIPT`; declarar outro sem prova = falso verde). **Não** declarar `security_claims` sem evidência (viraria BLOCKED).
- **Alternativa:** `.eos/*.md` locais — descartada como solução oficial (não acompanha clone); aceitável como complemento.
- **Aceite:** CA-05-01 `EOS-GOVERNANCE-001` PASS em clone limpo; CA-05-02 perfil declarado == inferido pela engine (sem contradição). **Esforço:** S.

## Fase B — Segurança real (após A; aprovação humana como na R01 + revisão independente)

### COR-10 — Store corrompido falha fechado (P2, achado R1)

- **Causa:** `readContainerInternal` (:211-231) converte qualquer erro em container vazio → `loadSigningKey` interpreta como "primeira execução" e rotaciona silenciosamente.
- **Solução:** distinguir "arquivo ausente" (gerar) de "presente porém ilegível" (lançar erro explícito, sem assinar). Preservar migração legada sem versão (teste phase-1-1 nº 4).
- **Aceite:** CA-10-01 store ausente → gera e assina; CA-10-02 store corrompido → erro explícito, nenhuma assinatura; CA-10-03 suíte phase-1-1 intacta. **Esforço:** S.

### COR-11 — Gate Firestore exato (P3, achado R2, mesma branch da COR-10)

- **Causa:** `id.includes('FIRESTORE')` super-inclusivo (`audit-application-service.ts:982`).
- **Solução:** allowlist exata (`SEC-CLAIM-FIRESTORE-001` + prefixo delimitado, ex. `SEC-CLAIM-FIRESTORE-*`).
- **Aceite:** CA-11-01 id exato ativa; CA-11-02 id contendo substring incidental (`NOT-FIRESTORE-RELATED`) não ativa. **Esforço:** XS.

### COR-03 — Boundary da API local (P1)

- **Causa (hipótese):** `local-application-api-server.ts:148` lê `URLSearchParams` sem validador visível; auth por header existe (`:133-138`). Auditoria completa do arquivo (270 linhas) pendente.
- **Solução:** validar tipo/tamanho/formato de `projectId`/`id` no boundary; inválidos → 4xx sem execução. Auditar demais rotas no mesmo arquivo.
- **Aceite:** CA-03-01 entradas inválidas → 4xx sem tocar serviço; CA-03-02 testes adversariais (injeção, tamanho, tipo); CA-03-03 sem regressão nas rotas legítimas. **Esforço:** M. **Risco:** quebrar clientes locais — mapear chamadores antes.

### COR-06 — RLS Supabase (P2)

- **Causa:** integração observada em `architecture-applicability-engine.ts:256`, política fora do repo; scanner declara inconclusividade (não prova nem ausência nem vulnerabilidade).
- **Solução:** ou (a) declarar claim RLS + validar permissões reais em runtime, ou (b) não-aplicabilidade justificada (ex.: backend fora de escopo do repo). Decisão na implementação, com prova.
- **Aceite:** CA-06-01 claim `VERIFIED` em runtime ou justificativa datada; CA-06-02 sem `RLS-001` pendente após decisão. **Esforço:** M. **Risco/bloqueio possível:** exigir ambiente runtime real.

### COR-07 — Ruído SECRET-001 (P3)

- **Causa:** heurística sinaliza `.example.json` e union-type (`secret-store.ts:6`).
- **Solução:** confirmar que o example não contém segredo real; allowlist documentada para `*.example.*` + contextos type-only. Sem allowlist cega (reais continuam detectados — há teste parcial nessa linha).
- **Aceite:** CA-07-01 zero sinais em placeholders; CA-07-02 segredo real ainda detectado (caso positivo). **Esforço:** S.

## Fase C — Mecanismo de governança (após B)

### COR-09 — Trava parecer↔SHA (P1)

- **Causa:** aprovação é normativa (§11), não executável; merge posterior não reabre rodada.
- **Solução:** verificação reutilizando `artifact-binding-engine.ts` (SHA-256 + realpath): comparar blobs do `MANIFEST.md` com HEAD; divergência em arquivo coberto → exigir nova rodada. Ponto de encaixe a definir na implementação (novo comando `eos verify-audit` ou gate de CI) — sem criar segundo sistema de storage.
- **Aceite:** CA-09-01/02/03 (conforme plano-mestre). **Esforço:** M. **Nota:** aprovações da Fase B seguem o rito atual (humana + revisor); COR-09 trava o trabalho *posterior*.

## Sequenciamento e dependências

Fase A (COR-04+08, depois COR-05) → Fase B (COR-10+11, COR-03, COR-06, COR-07) → Fase C (COR-09). Sem dependências cruzadas além dessa ordem; COR-06 pode bloquear em ambiente (tratar (b) se runtime inviável). Nada aqui exige mudança tecnológica.

## Rastreabilidade

Achado → causa (acima) → correção → critério (CA-xx, pré-registrados) → teste → evidência (EVD-A4-…) → auditoria/revisão → parecer → commit. Próxima auditoria sugerida: `AUD-2026-10-09-04`, escopo Fase A.
