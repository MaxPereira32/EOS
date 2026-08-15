# EOS-EXPERIMENT-0003
# NIST SSDF v1.1 PW.8.2 — NORMATIVE EVIDENCE-DRIVEN ASSESSMENT

## 1. Contexto e Objetivo Normativo
O experimento `EOS-EXPERIMENT-0003` demonstra a integração operacional do **NIST Assessment Engine** e do **AssessmentRemediationService** ao ecossistema EOS. O alvo escolhido é a prática **NIST SP 800-218 SSDF v1.1 — PW.8.2** (*Test Executable Code to Identify Vulnerabilities and Verify Compliance*).

O objetivo é comprovar a cadeia causal completa:
```text
NIST REQUIREMENT (PW.8.2)
       ↓
APPLICABILITY (APPLICABLE)
       ↓
AUTHORIZED MAPPING (EQUIVALENT)
       ↓
EVALUATION CRITERIA (C1-C4)
       ↓
INITIAL EVIDENCE (FAIL)
       ↓
INITIAL ASSESSMENT (NON_COMPLIANT)
       ↓
EOS FINDING (FND-NST-PW.8.2)
       ↓
SNAPSHOT BEFORE (SNP-BEFORE)
       ↓
REMEDIATION SERVICE & ORCHESTRATOR
       ↓
CYCLE 1: FALSE FIX -> BLOCKED (FALSE_GREEN_BLOCKED)
       ↓
CYCLE 2: TRUE FIX -> SUCCESS
       ↓
NEW EVIDENCE (EVI-NEW-PW82-PASS)
       ↓
SNAPSHOT AFTER (SNP-AFTER)
       ↓
REASSESSMENT
       ↓
FINAL VERDICT (VERIFIED)
```

## 2. Escopo e Invariantes Validadas
- **Separação de Responsabilidade**: `NistAssessmentEngine` é puro/derivado (não muta estado nem cria findings diretamente). O `AssessmentRemediationService` rege o fluxo de orquestração e snapshots.
- **Invariante `NO_FINDING != VERIFIED`**: A ausência de falhas sem evidências positivas atestadas resulta em `NOT_VERIFIED`.
- **Invariante `UNKNOWN` Applicability**: Jamais pode resultar em `VERIFIED`.
- **Invariante `AUTHORIZED_MAPPING != VERIFIED`**: Mapeamento apenas habilita avaliação, não é evidência.
- **Respeito à Honestidade Normativa**: O veredito não declara "NIST COMPLIANT" de forma absoluta, mas sim `ASSESSED AGAINST NIST SSDF v1.1 PW.8.2` com status `VERIFIED` para os critérios específicos C1-C4.

## 3. Matriz de Evidências e Snapshot
- **BEFORE Snapshot**: Registra a execução inicial com commit `168aac69403a5ca47f6ad0d96ae6b598ea1c0263` contendo a falha de invariante.
- **AFTER Snapshot**: Registra a nova execução com commit `95925f8d52ed9f616e973b3ba7f0d5b23a6a70e6` contendo a remediação robusta (`typeof` + `trim()`).
- **Snapshot Comparison**: Valida a ordem temporal estrita e o isolamento de execuções.

## 4. Veredito Final
`GREEN — PHASE 3 NORMATIVE ASSESSMENT VERIFIED`
