# EOS-GOV-006 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-GOV-006 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Verificador de integridade do governador confere existência, não conteúdo |
| **Origem** | Auditoria de origem (plano Codex §2) + re-verificação de baseline |
| **Criticidade** | Alta — bypass do INVARIANT-11: módulos adulterados passam como íntegros |
| **Prioridade** | P1 |
| **Status** | Pendente |
| **Executor / Auditor** | — / — |
| **Baseline** | `508581c` + working tree |
| **Arquivos afetados** | `EOS/core/utils/governor-integrity-verifier.ts:28-33` (apenas `fs.existsSync`) |

## Causa raiz

`verifyGovernorIntegrity` conta arquivos ausentes; não lê nem hasheia conteúdo. Qualquer arquivo presente (mesmo vazio/adulterado) é aceito.

## Impacto

- HardQualityGate recebe `isValid: true` com governador corrompido → toda a cadeia de gates herda a falsa premissa.
- O teste existente (“Deve detectar adulteração se um módulo … for removido ou corrompido”) cobre apenas remoção — o nome promete mais do que o teste prova (falso positivo autorreferente; ver §9 “auditoria autorreferente”).

## Evidência (reprodução real)

- EVD-A1-EOS-GOV-006-001 — inspeção estática (sem `createHash`/`createHmac` no arquivo).
- EVD-A1-EOS-GOV-006-002 — repro operacional: diretório com os 6 módulos preenchidos com `// CONTEUDO ADULTERADO …` → veredito `isValid: true`, rationale “INTEGRIDADE … VERIFICADA”.

## Limitações
- A correção (manifesto de hashes) precisa decidir o mecanismo de confiança do manifesto — correlato à D1 (EOS-SEC-005); critérios de aceite a definir antes de implementar.
