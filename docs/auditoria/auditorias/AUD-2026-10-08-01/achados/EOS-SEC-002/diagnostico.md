# EOS-SEC-002 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-SEC-002 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | `test-connection` retorna CONNECTED com latência fixa sem ping real |
| **Origem** | Auditoria de origem (plano Codex §2) + re-verificação de baseline |
| **Criticidade** | Média/Alta — falso positivo operacional: credencial revogada/provedor inacessível ainda reportam “conectado” |
| **Prioridade** | P1 |
| **Status** | Pendente |
| **Executor / Auditor** | — / — |
| **Baseline** | `508581c` + working tree |
| **Arquivos afetados** | `EOS/core/server/local-application-api-server.ts:193-219` (`latencyMs: 84`, `status: 'CONNECTED'`, `success: true`) |

## Causa raiz

O handler apenas verifica a presença da credencial no `secretStore` e devolve sucesso sintético com latência constante; nenhuma chamada de rede (sem `fetch`/`http`) é feita ao provedor.

## Impacto

- Operador/agente conclui que a integração está ativa quando apenas a credencial existe.
- Falso verde de integração (linha de defesa do próprio EOS Local API).

## Evidência

- EVD-A1-EOS-SEC-002-001 — inspeção estática: presença de `latencyMs: 84` e ausência de qualquer chamada de rede no handler.

## Limitações
- Reprodução operacional (subir o servidor e chamar o endpoint) NÃO executada nesta baseline — a comprovação estática é conclusiva quanto à causa (retorno constante independe de rede), porém o critério de aceite da correção deverá incluir teste de integração real (provedor inacessível → falha).
