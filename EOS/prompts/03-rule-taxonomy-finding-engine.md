# EOS PROMPT CONTRACT: STAGE 03 - RULE, TAXONOMY & FINDING ENGINE
# DOMAIN TARGETS: Rule, Finding Entities

## INSTRUÇÕES DE EXECUÇÃO:
Mapeie as violações das Ameaças e Fatos contra o catálogo de Regras e emita Achados concretos (`Finding`) enriquecidos com a cadeia taxonômica completa (`OWASP` → `CWE` → `CVE` → `NIST` → `MITRE ATT&CK`).

### FORMATO DE SAÍDA (STRICT JSON SCHEMA):
```json
{
  "$schema": "https://eos.architecture/schemas/v2/stage03-findings.json",
  "findings": [
    {
      "finding_id": "FND-2026-8801",
      "asset_id": "AST-K8S-INGRESS-01",
      "fact_ids": ["FCT-501"],
      "rule_id": "SEC-RULE-309-HTTP-TRACE-PREFIX",
      "title": "HTTP TRACE Method Enabled & Session Cookie Missing Security Prefix",
      "severity": "HIGH",
      "cvss_v4_score": 7.5,
      "cvss_v4_vector": "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N",
      "taxonomy": {
        "owasp_category": "A05:2021-Security Misconfiguration",
        "cwe_id": "CWE-693: Protection Mechanism Failure",
        "cve_ids": [],
        "nist_sp_800_53": "SC-8 PUBLIC ACCESS PROTECTIONS",
        "mitre_attack_id": "T1539 - Steal Web Session Cookie"
      }
    }
  ]
}
```
