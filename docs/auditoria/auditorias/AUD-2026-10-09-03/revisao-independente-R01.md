# Revisão técnica independente — R01 (COR-01/COR-02, commit `cf3e200`)

> Veredito transcrito do revisor independente (subagente, contexto separado do executor), sem alteração de conteúdo. Dossiês R01 permanecem intactos; divergências entre este parecer e os dossiês estão marcadas abaixo.

- **Alvo:** `cf3e200` em worktree isolado e destacado (leitura + execução; nenhum arquivo modificado).
- **Escopo executado:** diff-review COR-01/COR-02, `tsc --noEmit` (exit 0), 8 testes R01 re-executados (8/8 PASS), grep de alegações sobre cofre do SO. Suíte completa NÃO re-executada.

## Vereditos por critério (revisor)

| Critério | Veredito | Base |
|---|---|---|
| CA-01-01 | APROVADO | ambos os emissores zerados sem declaração |
| CA-01-02 | APROVADO | nenhum outro veredito zerado pelo gate |
| CA-01-03 | APROVADO | aceite existe no diff |
| CA-01-04 | APROVADO com ressalva | legado executa; trilha declarada é desviada (`continue` :1039) — ver R3 |
| CA-02-01 | APROVADO | inspeção + teste |
| CA-02-02 | APROVADO | roundtrip via SecretStore |
| CA-02-03 | APROVADO | testes + código (arrays preservados, null correto) |
| CA-02-04 | INCONCLUSIVO (revisor) | sem re-execução da auditoria no escopo dele |
| CA-02-05 | APROVADO com ressalva | fail-closed p/ store inacessível; rotação silenciosa em store corrompido — ver R1 |

## Veredito global (revisor): APROVADO com ressalvas. Nenhum defeito bloqueante.

## Divergência reconciliada pelo executor

- CA-02-04: o revisor marcou INCONCLUSIVO por escopo; evidência do executor supre a lacuna — `RUN-3129f4c46ae5` e `RUN-0597d2da24e8` (auditorias reais pós-fix) não listam `SECRET-001` em `report-integrity-signer.ts`. Status final executor: **APROVADO com evidência de auditoria** (não com re-execução do revisor — distinção registrada).

## Achados residuais (revisor) → disposição

- **R1 (Média):** rotação silenciosa em store corrompido-legível (`secret-store-service.ts:228` catch-all × signer `:22-27`). → **COR-10 (P2, PLANEJADO):** distinguir "store ausente" (gerar) de "store ilegível" (falhar fechado).
- **R2 (Baixa):** gate `id.includes('FIRESTORE')` super-inclusivo (`:982`). → **COR-11 (P3, PLANEJADO):** allowlist exata de ids.
- **R3 (Informativa):** com declaração, claim avaliado pelo legado, fora da trilha causal declarada. → decisão consciente registrada; sem ação.
- **R4 (Informativa):** CA-02-05 cobre só construtor inacessível. → cobertura parcial aceita; sem ação (R1 cobre o caso restante).
