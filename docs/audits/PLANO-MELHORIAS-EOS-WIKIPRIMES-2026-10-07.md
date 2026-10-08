# Plano de Melhorias do EOS — derivado da auditoria do WikiPRIMATES

**Data:** 2026-10-07
**Fonte da evidência:** auditoria de segurança e governança do projeto `WikiPrimes`
(`C:\Users\lindo\OneDrive\Desktop\Dev\Projeto\WikiPrimes`), runs EOS
`RUN-da6ac524fc3e` e `RUN-0badd7d3ea15`, relatórios em `WikiPrimes/docs/auditoria/`.
**Status:** Fases A, B, C, D e E implementadas e verificadas em 2026-10-07 (plano concluído).

---

## 0. Status de implementação (com evidências)

| Item | Status | Evidência verificável |
|---|---|---|
| A1 — formatos de configuração + segredos | CONCLUÍDO | testes em `EOS/tests/generated-app-security-engine.test.ts` (TOML/INI/YAML/JSON/.env, placeholders ignorados); achados reais em `config/config.toml:6,28,29` |
| A2 — detector Flask/Python | CONCLUÍDO | mass-assignment `backend/gncitizen/core/sites/routes.py:319` e upload sem autorização `:469` |
| A3 — localização da integração real | CONCLUÍDO | Supabase apontado em `backend/gncitizen/utils/storage.py:18` (não mais no componente frontend); sinal rebaixado para MEDIUM/INSUFFICIENT_EVIDENCE por não provar política remota |
| B1 — causa de falha de execução | CONCLUÍDO | `failure_cause` em `ExecutionEvidence`; run `RUN-4d552b816fb1`: `npm --prefix frontend run test` → `NOT_AVAILABLE [TOOLING_MISSING]`; gate `EOS-EXECUTION-001` → `INSUFFICIENT_EVIDENCE` (sem FAIL falso) |
| B2 — checks externos / container | CONCLUÍDO | `execution.external_checks` (argv sem shell implícito); probe real `docker exec citizen-front sh -c "…tsc --noEmit"` → PASS, exit 0, 13,6 s, SHA-256 stdout registrado |
| C1 — inferência com manifests aninhados + Python | CONCLUÍDO | run `RUN-1a415e6676df`: perfil `MODULAR_MONOLITH` (era `UNKNOWN`), confiança 0.86, sinais de manifesto aninhado e persistência Python |
| C2 — gate de governança | CONCLUÍDO | run `RUN-1a415e6676df`: `EOS-GOVERNANCE-001` → `INSUFFICIENT_EVIDENCE` com rationale dos artefatos ausentes; projetos com `.eos/*.md` ou `eos.risk.yml` declarado passam |
| D1 — taxonomia nos findings | CONCLUÍDO | run `RUN-223ec8df5abb`: **11/11** findings com OWASP/CWE/CVSS v4; `Finding.taxonomy` populado via `RuleCatalog` |
| D2 — catálogo + MCP | CONCLUÍDO | 10 regras GENAI/Python registradas; `eos_check_rules` agora usa `RuleCatalog.getAllRules()`; teste `EOS/tests/rule-catalog.test.ts` |
| E1 — claim IDOR causal | CONCLUÍDO | `type: "IDOR"` classificado como `IDOR`; teste `EOS/tests/idor-claim.test.ts`: só `PROVEN` quando a mutação quebra a autorização, nunca `SIMULATION_ONLY` |
| E2 — self-governança ampliada | CONCLUÍDO | `npm run self-governance`: **7/7** (casos I/J cobrem taxonomia e catálogo das Fases A/D) |
| Regressão do EOS | VERDE | 173 testes, 0 falhas (1 skip de symlink), `npx tsc --noEmit` limpo |

**Nota de cobertura:** a auditoria do WikiPRIMATES segue **parcial** — 3 erros de coleta são
links quebrados de `.venv/bin/python*`, a suíte Angular real (Karma/Chrome) permanece não
executada pelo EOS e o alvo não possui `eos.risk.yml` (perfil inferido `MODULAR_MONOLITH`,
porém sem governança declarada). Nenhum status verde foi atribuído ao WikiPRIMATES: o
resultado final (`RUN-223ec8df5abb`) permanece **RED** por achados reais.

---

## 1. Objetivo

A auditoria do WikiPRIMATES (fork AGPL-3.0 do GeoNature-citizen; backend Flask/SQLAlchemy/
PostGIS, frontend Angular 8) tinha dois propósitos:

1. Encontrar **evidências reais** de segurança e governança do projeto;
2. Usar essas evidências para identificar **lacunas do EOS** e propor melhorias.

Este documento é o entregável #2. A síntese das evidências (#1) está na Seção 2; cada
lacuna é mapeada a uma melhoria concreta do EOS (Seção 4).

---

## 2. Evidências de segurança e governança do WikiPRIMATES (síntese)

### 2.1 Segurança — o que foi CONFIRMADO

| Área | Evidência | Local |
|---|---|---|
| Autorização de observações no servidor | `@jwt_required()` + checagem de dono (`id_role != current_user.id_user`) e papel validador/admin | `backend/gncitizen/core/observations/routes.py:522-541,624,736-747` |
| Rejeição de acesso indevido | PATCH/DELETE de usuário B sobre observação de A retorna **403** (teste E2E real) | `docs/auditoria/revalidacao-...md` |
| Validação de upload | decodificação/re-encode de JPEG/PNG + remoção de EXIF; JPEG falso retorna **400** | `backend/gncitizen/utils/media.py` |
| Segredo server-side | chave Supabase `service_role` lida de env, nunca exposta no frontend | `backend/gncitizen/utils/storage.py:17-32` |
| Anti path-traversal de mídia | `_safe_filename()` usa `os.path.basename` e rejeita `..` | `backend/gncitizen/utils/storage.py:35-41` |

### 2.2 Segurança — o que foi CONFIRMADO como RISCO REAL

| Risco | Evidência | Local |
|---|---|---|
| **Mass-assignment em cadastro de site** | `post_site` copia qualquer campo do corpo para o modelo via `hasattr(SiteModel, field)` (aceita `id_role`, `admin`, `uuid_sinp`, etc.), com `@jwt_required(optional=True)` | `backend/gncitizen/core/sites/routes.py:270-361` |
| **Upload de foto de visita sem checagem de dono/associação** | `post_photo` aceita `@jwt_required(optional=True)`, sem verificar dono do site/visita nem `site_id ↔ visit_id` | `backend/gncitizen/core/sites/routes.py:464-483` |
| **Criação de visita sem associação verificada** | `post_visit` não valida se o `site_id` pertence ao contexto do usuário | `backend/gncitizen/core/sites/routes.py:392-426` |
| **Segredos em `config.toml` (working tree)** | `JWT_SECRET_KEY`, `SECRET_KEY`, `CONFIRM_MAIL_SALT` hardcoded; arquivo é gitignored mas contém valores reais | `config/config.toml:6,28,29` |

### 2.3 Governança — estado observado

| Aspecto | Estado |
|---|---|
| `.eos/contexto.md`, `arquitetura-atual.md`, `decisores.md` | **AUSENTES** (só `auditoria.json` + `acf-auditoria.md`) → cobertura ACF parcial |
| `eos.risk.yml` | **AUSENTE** → sem claims de segurança, sem perfil arquitetural declarado → EOS infere `UNKNOWN` (confiança 0.45) |
| ADRs (`decisoes/`) | inexistentes no projeto |
| Higiene `.eos/` no `.gitignore` | **OK** (linha 279) |
| Licença/atribuição | **OK** — AGPL-3.0, rota `/licencas`, README com atribuição |
| Registro de auditoria versionável | **OK** — `docs/auditoria/` com relatórios + hashes |

---

## 3. Lacunas do EOS reveladas por esta auditoria

Cada lacuna é **causalmente ligada** a um erro/omissão observado no run real.

| # | Lacuna | Consequência observada |
|---|---|---|
| L1 | Motor estático (`generated-app-security-engine.ts`) só lê `.ts/.js/.py/.sql/.rules` — **não lê `.toml`, `.yml`, `.env`** | **Não detectou** os segredos em `config/config.toml` |
| L2 | Heurísticas orientadas a JS/TS (`fetch`, `prisma`, `findUnique`, `zod/joi`); **não entende Flask** (`@jwt_required(optional=True)`, `hasattr(Model, field)`, decoradores) | **Não detectou** o mass-assignment real em `sites/routes.py`; apontou localização errada (frontend) para Supabase/RLS |
| L3 | Localização de achados por "primeira ocorrência no frontend" | Achado RLS apontou `user-dashboard.component.ts:297` em vez de `backend/gncitizen/utils/storage.py` |
| L4 | Gate de execução (`EOS-EXECUTION-001`) não distingue "suíte falhou" de "ferramenta ausente" (`'ng' não é reconhecido`); **não suporta execução em container/headless** | `npm --prefix frontend run test` → FAIL sem diagnóstico real |
| L5 | `inferProfile()` só inspeciona `package.json` **da raiz** e deps de framework JS; **ignora manifests aninhados** (`frontend/package.json`) e `pyproject.toml`/`requirements.txt` | Perfil `UNKNOWN` para um stack Angular+Flask bem definido |
| L6 | **Sem gate de presença de artefatos de governança** (`.eos/contexto.md` etc. ou `eos.risk.yml`) | EOS silenciosamente reporta `UNKNOWN` em vez de sinalizar "governança incompleta" |
| L7 | Findings GENAI sem mapeamento de taxonomia (OWASP/CWE/CVSS) apesar do `RuleCatalog` ter o modelo | Achados genéricos sem CVSS/OWASP, difíceis de triar |
| L8 | Sem engine de **verificação dinâmica** (IDOR/RLS) — só estática | As provas reais (403, 400) vieram de teste E2E manual, fora do EOS |
| L9 | `RuleCatalog` registra só 4 regras; README anuncia engines (STRIDE, LGPD/GDPR, NIST) sem catálogo real | Divergência entre capacidade anunciada e executada |

---

## 4. Plano de melhorias (priorizado)

Legenda de prioridade: **P0** = corrige falso-negativo/falso-positivo crítico; **P1** = melhora
cobertura/precisão; **P2** = robustez/governança interna.

### Fase A — Precisão da análise estática (P0)

- **A1 (L1):** expandir `SOURCE_EXTENSIONS` em `generated-app-security-engine.ts` para incluir
  `.toml`, `.yml`, `.yaml`, `.env*`, `.ini`, `.json` (com heurística própria para segredos) e
  adicionar regra de segredo específica para `key = 'value'` (padrão TOML/INI).
  **Aceite:** rodar `eos audit` sobre o WikiPrimes e o achado `config.toml` (segredos hardcoded)
  aparecer com severidade CRITICAL.

- **A2 (L2):** adicionar um detector de backend Python/Flask no motor estático:
  - `@jwt_required(optional=True)` em rota de escrita (`POST/PATCH/PUT/DELETE`) sem checagem de dono → finding de autorização (HIGH/CRITICAL);
  - `hasattr(<Model>, field)` / `**request.get_json()` mass-assignment → finding (HIGH);
  - `@jwt_required()` ausente em endpoint que muta estado → finding.
  **Aceite:** rodar sobre WikiPrimes e detectar `sites/routes.py:270-361` (mass-assignment) e
  `sites/routes.py:464-483` (upload sem dono).

- **A3 (L3):** localizar achados de framework no **arquivo de integração real** (ex.: buscar
  `createClient`/`supabase`/`service_role` em `.py` primeiro; fallback para frontend só quando o
  uso é client-side). **Aceite:** finding RLS apontar para `backend/.../storage.py`, não para o
  componente Angular.

### Fase B — Execução de gates reproduzível (P0/P1)

- **B1 (L4):** no `executeProjectCheck`, distinguir exit code por causa:
  - `spawn ENOENT` / `'não é reconhecido'` → estado `NOT_AVAILABLE` (não `FAIL`);
  - adicionar campo `cause` (`TOOLING_MISSING` | `TEST_FAILED` | `TIMEOUT`) em `ExecutionEvidence`.
  **Aceite:** `npm --prefix frontend run test` sem `ng` → `NOT_AVAILABLE`, e o gate
  `EOS-EXECUTION-001` vira `INSUFFICIENT_EVIDENCE` em vez de `FAIL` falso.

- **B2 (L4):** suportar checks externos declarados no `eos.risk.yml`, executados **sem shell
  implícito** (argv explícito), o que cobre container e qualquer runtime externo sem interpolação:
  ```yaml
  execution:
    external_checks:
      - name: frontend-tsc-in-container
        argv: ["docker", "exec", "citizen-front", "sh", "-c",
               "cd /app && ./node_modules/.bin/tsc -p src/tsconfig.spec.json --noEmit"]
  ```
  Guardas: nome `[A-Za-z0-9._-]{1,64}`, máx. 8 checks, máx. 32 args / 4096 chars por arg,
  timeout por nome reutilizando `check_timeouts_ms`.
  **Aceite (verificado):** o argv é executado verbatim e a evidência registra exit code +
  SHA-256 do stdout; probe real com o container `citizen-front` retornou PASS (exit 0).

### Fase C — Inferência arquitetural correta (P1) — **CONCLUÍDA**

- **C1 (L5) — CONCLUÍDO:** `inferProfile()` agora lê manifests aninhados (até profundidade 3,
  excluindo `node_modules`/builds) e detecta persistência Python
  (`SQLAlchemy`/`psycopg2`/`migrations`) e módulos em `backend/<pacote>/core|modules…`.
  **Evidência:** `EOS/tests/architecture-applicability-engine.test.ts`; run `RUN-1a415e6676df`
  com `MODULAR_MONOLITH` (confiança 0.86) em vez de `UNKNOWN`.

- **C2 (L6) — CONCLUÍDO:** gate `EOS-GOVERNANCE-001` em `assessGovernanceArtifacts`:
  `PASS` se os três `/.eos/{contexto,arquitetura-atual,decisores}.md` existirem **ou** se
  `eos.risk.yml` declarar `profile`/`domain_directory`/`security_claims`; caso contrário
  `INSUFFICIENT_EVIDENCE` (nunca GREEN silencioso).
  **Evidência:** `EOS/tests/governance-gate.test.ts`; run `RUN-1a415e6676df` reporta cobertura
  de governança parcial no WikiPRIMATES.

### Fase D — Taxonomia e catálogo (P1) — **CONCLUÍDA**

- **D1 (L7) — CONCLUÍDO:** `Finding.taxonomy` (OWASP/CWE/CVSS v4) preenchido via
  `RuleCatalog.getRule(rule_ref)`; mapeamentos RLS→A01/CWE-284, AUTHZ→A01/CWE-602,
  IDOR→A01/CWE-639, INPUT→A03/CWE-20, SECRET→A07/CWE-798, uploads→CWE-434/862,
  mass-assignment→A08/CWE-915.
  **Evidência:** run `RUN-223ec8df5abb` com 11/11 findings taxonomizados.
- **D2 (L9) — CONCLUÍDO:** 10 regras GENAI/Python registradas no `RuleCatalog`; handler MCP
  `eos_check_rules` passou a consumir `RuleCatalog.getAllRules()` (com legado preservado).
  **Evidência:** `EOS/tests/rule-catalog.test.ts`.

### Fase E — Verificação dinâmica e anti-falso-verde (P2) — **CONCLUÍDA**

- **E1 (L8) — CONCLUÍDO:** claims `type: "IDOR"` são classificados como `IDOR` e reutilizam o
  pipeline `validation_script` + `causal_spec` (nonce/Kill Ratio) já existente; sem mutação que
  quebre a validação, permanecem `YELLOW`/`BLOCKED` — nunca `SIMULATION_ONLY`.
  **Evidência:** `EOS/tests/idor-claim.test.ts` (proven só após mutação quebrar a autorização).

- **E2 — CONCLUÍDO:** self-governança ampliada com os casos I/J (taxonomia e resolução no
  catálogo). **Evidência:** `npm run self-governance` → **7/7 PASSED**.

---

## 5. Ordem de execução

1. ~~A1 + A2 + A3 (precisão estática)~~ — **CONCLUÍDO**
2. ~~B1 (gate de execução honesto)~~ — **CONCLUÍDO**
3. ~~B2 (checks externos/container)~~ — **CONCLUÍDO**
4. ~~C1 (inferência) + C2 (gate de governança)~~ — **CONCLUÍDO**
5. ~~D1 + D2 (taxonomia/catálogo)~~ — **CONCLUÍDO**
6. ~~E1 + E2 (dinâmica opcional, self-governança)~~ — **CONCLUÍDO**

## 6. Critérios de conclusão

- Reexecutar `npx tsx EOS/bin/eos.ts audit <WikiPrimes>` e obter:
  - [x] achado de segredos em `config/config.toml`;
  - [x] achados precisos em `backend/gncitizen/core/sites/routes.py`;
  - [x] perfil arquitetural != `UNKNOWN` (Fase C1);
  - [x] `EOS-EXECUTION-001` sem `FAIL` falso por ausência de `ng`;
  - [x] gate de governança reportando cobertura parcial (Fase C2);
  - [x] findings com taxonomia OWASP/CWE/CVSS (Fase D1);
  - [x] claims IDOR/RLS com prova causal obrigatória (Fase E1).
- Nenhum status GREEN sem evidência causal (anti-falso-verde preservado).
- Estado final do alvo em `RUN-223ec8df5abb`: **RED** (11 riscos reais), cobertura parcial
  declarada, sem GREEN indevido.

## 7. Não-escopo

- Correções de código do WikiPRIMATES (mass-assignment, upload de foto) — pertencem ao projeto,
  não ao EOS.
- Deploy/homologação do WikiPRIMATES.
