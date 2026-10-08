# EOS-GOV-011 — Contrato de Aceite

> Definido **antes** da implementação (D-007). Não alterado após.

### CA-G11-01 — Arquivamento por execução
- **Entrada:** uma execução de `executeAudit(target, outputDir)` (TST-G11-01).
- **Esperado:** existe `outputDir/auditorias/<audit_run_id>/auditoria.json` **e** `.../acf-auditoria.md`.
- **Evidência:** EVD-A1-EOS-GOV-011-002.
- **Reprovação:** ausência de qualquer um dos artefatos arquivados.

### CA-G11-02 — Imutabilidade entre execuções sucessivas
- **Entrada:** duas execuções sequenciais no mesmo alvo/diretório (TST-G11-02).
- **Esperado:** dois `run_id` distintos; hash do arquivo arquivado da execução 1 **inalterado** após a execução 2.
- **Evidência:** EVD-…-002 e teste automatizado EVD-…-003.
- **Reprovação:** hash alterado ou arquivo ausente.

### CA-G11-03 — Compatibilidade retroativa (canônico preservado)
- **Entrada:** mesma execução de CA-G11-01.
- **Esperado:** `outputDir/auditoria.json` e `outputDir/acf-auditoria.md` continuam sendo escritos (CI e consumidores existentes intactos).
- **Evidência:** EVD-…-002.
- **Reprovação:** sumiço do caminho canônico.

### CA-G11-04 — Sem regressões
- **Entrada:** suíte completa + typecheck (TST-G11-04).
- **Esperado:** `pass ≥ 172`, `fail = 0`, typecheck exit 0.
- **Evidência:** EVD-…-004/005.
- **Reprovação:** novo `fail > 0`.

### CA-G11-05 — Teste de regressão detecta o defeito
- **Entrada:** teste automatizado novo no suite padrão (TST-G11-03).
- **Esperado:** o teste referencia o defeito e **falharia** no código antigo (sem pasta de arquivo) e passa no corrigido.
- **Evidência:** EVD-…-003 (código do teste + execução isolada).
- **Reprovação:** teste que passa independentemente da correção (proibição §8.2).

## Plano de testes

| Teste | Categoria | Critério | Procedimento | Evidência |
|---|---|---|---|---|
| TST-G11-01 | Contrato | CA-G11-01/03 | execução única + inspeção dos caminhos | 002 |
| TST-G11-02 | Integração/Imutabilidade | CA-G11-02 | duas execuções + hash comparativo | 001 (defeito) / 002 (corrigido) |
| TST-G11-03 | Regressão automatizada | CA-G11-05 | `EOS/tests/audit-archive.test.ts` | 003 |
| TST-G11-04 | Regressão | CA-G11-04 | suíte completa | 004 |
| TST-G11-05 | Contrato/Estático | CA-G11-04 | typecheck | 005 |

## Dispensas
- **Adversarial:** cenário de colisão de `run_id` é estruturalmente impossível dentro de uma execução (seed inclui timestamp ISO com ms; auditoria dura ≫1 ms). Registrado como limitação teórica, sem teste dedicado.
- **Concorrência:** execuções concorrentes no mesmo `outputDir` geram pastas distintas por `run_id`; a escrita de cada pasta é independente. Sem estado compartilhado novo.
