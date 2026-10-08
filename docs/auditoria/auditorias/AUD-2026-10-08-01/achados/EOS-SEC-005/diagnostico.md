# EOS-SEC-005 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-SEC-005 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Assinatura HMAC com segredo hardcoded e serialização rasa (1º nível) |
| **Origem** | Auditoria de origem (plano Codex §2) + re-verificação de baseline |
| **Criticidade** | Alta — integridade documental falsificável: alterar propriedade aninhada preserva a assinatura |
| **Prioridade** | P1 |
| **Status** | Pendente |
| **Executor / Auditor** | — / — |
| **Baseline** | `508581c` + working tree |
| **Arquivos afetados** | `EOS/core/utils/report-integrity-signer.ts:4` (segredo `EOS_PHASE_4_1_CANONICAL_INTEGRITY_SALT_2026`), `:10` (`JSON.stringify` com replacer de chaves de 1º nível) |

## Causa raiz

Duas causas compostas: (a) chave HMAC embutida no fonte; (b) canonicalização incorreta — `JSON.stringify(obj, Object.keys(obj).sort())` ordena/filtra apenas o nível superior; campos aninhados não entram na matéria assinada.

## Impacto

- Assinatura não resiste a adulteração aninhada (propriedades profundas fora do payload assinado).
- Chave no repositório permite forjar assinaturas de relatórios inteiros.
- Consumidor do CI não valida assinatura (ver EOS-CI-008) — a falha é a segunda linha de defesa.

## Evidência (reprodução real)

- EVD-A1-EOS-SEC-005-001 — inspeção estática (linhas 4 e 10).
- EVD-A1-EOS-SEC-005-002 — repro operacional: assinatura válida; alteração **top-level** invalidada (`true`); alteração **aninhada** NÃO invalidada (`aninhado_alterado_invalida: false`) — falsificação comprovada.

## Limitações
- Demonstração usa payload sintético mínimo; o desenho do relatório real (`AuditReport`) contém estrutura aninhada amplamente explorável (coverage, rule_results, security_claims).
