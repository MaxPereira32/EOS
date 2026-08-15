# EOS-EXPERIMENT-0001

**Experiment ID**: EOS-EXPERIMENT-0001
**Timestamp**: 2026-08-15T01:40:00Z
**EOS Version**: 2.2.0
**Node Version**: v24.17.0
**Target**: `EOS/core/domain/system-context.ts`
**Fault Class**: DOMAIN_INVARIANT (Classe B)
**Fault Rationale**: Remoção intencional da regra que assegura que o campo `system_id` seja obrigatoriamente preenchido e não contenha apenas espaços em branco (`data.system_id.trim() === ''`).
**Expected Detector**: Falha arquitetural detectada pelos mecanismos de teste/audit integrados ao EOS (`phase-nist-1-system-context.test.ts`).
**Expected Finding**: Violação de invariante de identidade no construtor de contexto sistêmico.
**Expected Remediation**: Restauração da cláusula de tipo `string` e da validação não nula/não vazia com `.trim()`.
**Rollback Method**: `git checkout -- EOS/core/domain/system-context.ts` (ou restauração manual das linhas `55-57`).

---

## Baseline
- **BASELINE_COMMIT**: `257cb8c874fe9b34177ff75fdbb23f8b2c397692`
- **BASELINE_STATUS**: GREEN
- **BASELINE_TESTS**: 44 PASS
- **BASELINE_FINDINGS**: 1 (preexistente irrelevante ao alvo)
- **BASELINE_EVIDENCE**: RUN-233b9f5b3ad4 (Arquivos analisados: 107/107)
