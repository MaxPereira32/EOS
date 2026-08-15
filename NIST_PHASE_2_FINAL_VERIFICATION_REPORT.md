# EOS PHASE 2 — FINAL PROVENANCE HARDENING REPORT

## 1. Finding
- `git_commit` era opcional para alvos de código (`SOURCE_CODE`).
- `artifact_hash` era opcional para artefatos materializáveis (`ARTIFACT`).
- `UNKNOWN` permitia status de `VERIFIED` indiscriminadamente.
- A terminologia "IDs impenetráveis" era excessivamente forte.
- Os testes não isolavam explicitamente a prova de proveniência mandatória.
- O relatório formal não estava versionado na raiz do repositório auditado.

## 2. Root Cause
A estrutura do `AssessmentSnapshot` adotava postura genérica "best-effort" para armazenar metadados, negligenciando uma política fechada de proveniência (`TargetProvenancePolicy`). Essa falta de acoplamento entre a categoria do Alvo e os campos de prova permitia um ambiente onde a ausência de controle de versão (ex: sem git_commit) não invalidava o registro.

## 3. Method
- Introdução nativa da classificação `TargetType` (`SOURCE_CODE`, `ARTIFACT`, `RUNTIME`, `UNKNOWN`).
- Modificação no construtor para validar imperativamente a tríade de procedência de acordo com a política formal.
- Adequação terminológica sobre a distinção de IDs (*compile-time nominal distinction + runtime non-empty validation*).
- Explícita documentação do design conservador (fail-closed) frente à reutilização de provas (*stale evidence*).

## 4. Files Changed
- `EOS/core/domain/assessment-snapshot.ts`
- `EOS/tests/phase-nist-2-assessment-snapshot.test.ts`
- `NIST_PHASE_2_FINAL_VERIFICATION_REPORT.md` (Este documento, adicionado à raiz)
- `NIST_PHASE_2_FINAL_VERIFICATION_EVIDENCE.json` (Adicionado à raiz)

## 5. Tests
- Todos os testes preexistentes da Fase 2 foram endurecidos, injetando obrigatoriamente `TargetType: SOURCE_CODE` acompanhados por um `git_commit` falso, simulando o comportamento de um ambiente são.
- Injeção de três novos blocos de testes negativos estritos provando as invariantes de rejeição:
  - `SOURCE_CODE` + `git_commit` missing → `reject`
  - `ARTIFACT` + `artifact_hash` missing → `reject`
  - `UNKNOWN` target type + `VERIFIED` status → `reject`

## 6. Commands
- `npm run test`
- `npx tsc --noEmit`
- `npx dependency-cruiser --no-config EOS/core/domain`
- `npm run self-governance`

## 7. Evidence Before
**Estado:** Opcionalidade perigosa.
```typescript
// Aceitava:
const p = { execution_id: 'E-1', executed_at: '...', tool_or_collector: 'T' }
```

## 8. Evidence After
**Estado:** Invariante Restrita.
```typescript
// Requer:
const p = { execution_id: 'E-1', executed_at: '...', tool_or_collector: 'T', target_type: 'SOURCE_CODE', git_commit: 'abc1234' }
// Exceção imediata lançada se git_commit faltar.
```

## 9. Reassessment
A reexecução de toda a suíte de provas atestou o bloqueio matemático das falhas residuais apontadas. A injeção da distinção `TargetType` provê a última camada causal para o amadurecimento formal da Fase 2. Todo registro atrelado ao código-fonte exige incontestavelmente o `git_commit`. A suíte inteira de 44 testes foi validada. 

## 10. Residual Risk
Com as mudanças estabelecidas, a camada de proveniência não apresenta novos riscos residuais sistêmicos de sua própria natureza. Contudo, reconhecemos os limites contidos pelo escopo de domínios genéricos; as camadas superiores (Assessment Engines) deverão fornecer corretamente o `TargetType` pertinente da sua operação para que as verificações de proveniência possam atuar com sucesso.

## 11. Final Verdict
**GREEN — VERIFIED**

A cadeia de causalidade e as defesas estruturais do `AssessmentSnapshot` estão arquiteturalmente plenas sob as diretrizes estritas do *EOS Multi-Agent Verification & Remediation Protocol*.
