# COR-02 — Diagnóstico

| Campo | Valor |
|---|---|
| **Achado(s)** | ACH-02 + EOS-SEC-005 (HMAC hardcoded + canonicalização rasa) |
| **Origem** | `RUN-c1f63e327249`; `AUD-01/achados/EOS-SEC-005/diagnostico.md` (repro `EVD-A1-EOS-SEC-005-002`: alteração aninhada não invalida) |
| **Arquivos** | `EOS/core/utils/report-integrity-signer.ts:4,10`; `EOS/core/services/secret-store-service.ts` (mecanismo reutilizado) |

## Causa raiz (composta)

(a) Chave HMAC embutida no fonte (`SECRET_SALT` literal) — qualquer portador do repo forja assinaturas. (b) `JSON.stringify(obj, Object.keys(obj).sort())` ordena/filtra só o 1º nível — campos aninhados fora da matéria assinada. Impacto: integridade dos relatórios falsificável; consumidor CI não valida assinatura (EOS-CI-008, segunda linha já falha).
