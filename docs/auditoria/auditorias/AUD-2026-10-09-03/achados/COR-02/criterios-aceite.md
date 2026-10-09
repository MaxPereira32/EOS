# COR-02 — Critérios de aceite (pré-registrados)

| ID | Condição inicial | Ação | Resultado esperado | Verificação | Reprovação |
|---|---|---|---|---|---|
| CA-02-01 | Código pós-fix | grep | Nenhum literal de chave/salt em `report-integrity-signer.ts` | `grep SECRET_SALT\|EOS_PHASE_4_1` vazio no arquivo | Literal presente ou chave em outro arquivo versionado |
| CA-02-02 | Store íntegro | teste | sign + verify passam com segredo do SecretStore (exit 0) | `report-integrity-signer.test.ts` | Falha ou fallback silencioso para constante |
| CA-02-03 | Payload aninhado | teste | Alteração aninhada invalida a assinatura (repro EOS-SEC-005 invertida) | Caso `nested-tamper` no teste | Assinatura sobrevive à mutação aninhada |
| CA-02-04 | Pós-fix | auditoria | Scanner `SECRET-001` limpo no arquivo; demais sinais reais preservados | `audit` sem `SECRET-001` em `report-integrity-signer.ts` | Allowlist cega ou sinal remanescente |
| CA-02-05 | Store indisponível/corrompido | sign | Fail-closed: erro explícito, nunca relatório "assinado" com fallback | Caso de falha no teste | Assinatura emitida sem segredo válido |
