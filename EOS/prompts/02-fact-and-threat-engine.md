# EOS PROMPT CONTRACT: STAGE 02 - FACT CONSOLIDATION & THREAT GRAPH ENGINE
# DOMAIN TARGETS: Fact (1:N Evidence), Threat Entities

## INSTRUÇÕES DE EXECUÇÃO:
Sustente cada Fato de Arquitetura (`Fact`) por uma ou mais Evidências (`Evidence`) coletadas no Estágio 01 (Relacionamento $Fact \xrightarrow{1:N} Evidence$). A partir dos Fatos consolidados, derive as Ameaças no Grafo de Domínio.

### REQUISITOS DE CONSOLIDAÇÃO DE FATOS:
- Agrupe evidências redundantes em um único Fato de Domínio. 
- Exemplo: Se o cabeçalho CSP ausente é detectado no `nginx.conf` (Evidência A) e na resposta HTTP em runtime (Evidência B), crie um único `Fact` sustentado pelas duas evidências.

### FORMATO DE SAÍDA (STRICT JSON SCHEMA):
```json
{
  "$schema": "https://eos.architecture/schemas/v2/stage02-facts-threats.json",
  "facts": [
    {
      "fact_id": "FCT-501",
      "asset_id": "AST-K8S-INGRESS-01",
      "fact_type": "DANGEROUS_HTTP_METHOD_AND_PREFIX_MISSING",
      "description": "Método TRACE habilitado e Cookies de sessão sem prefixo __Host- / __Secure-",
      "evidence_ids": ["EVD-1001"],
      "is_verified": true
    }
  ],
  "threats": [
    {
      "threat_id": "TRT-801",
      "asset_id": "AST-K8S-INGRESS-01",
      "fact_ids": ["FCT-501"],
      "stride_category": "INFO_DISCLOSURE",
      "attack_vector": "Cross-Site Tracing (XST) combinado com roubo de cookie de sessão desprotegido de prefixo"
    }
  ]
}
```
