# EOS — GOVERNANCE

This document outlines how the Engineering Operating System (EOS) governs its own evolution. It answers the fundamental question:
> *"Como sabemos que o EOS continua obedecendo às regras que afirma obedecer?"*

## 1. Princípios de Governança
* **Evidência sobre Confiança**: O sistema não confia no desenvolvedor; ele exige execução provada.
* **Fail-Closed**: Em caso de incerteza ou exceção analítica, o repositório deve travar a execução e recusar-se a prosseguir (Exit Code 1).
* **Rastreabilidade Obrigatória**: Tudo que é declarado deve estar ligado a um teste. Regras sem teste devem ser declaradas como `DOCUMENTED_ONLY` e não podem barrar ou aprovar pipelines falsamente.

## 2. O Quality Gate (`npm run governance`)
A espinha dorsal da governança do EOS é o script unificado `governance-check.ts`, executado na esteira. Ele roda em uma sequência rígida:

1. **Gate 0.1 (Drift Check)**: Analisa o AST do TypeScript buscando injeções não autorizadas de dependências que furam a Clean Architecture.
2. **Gate 0.2 (Change-Control Check)**: Garante que os arquivos modificados sigam as classes de criticidade (ex: modificações em `core/domain` exigem classificação explícita).
3. **Gate 1 (Type Safety)**: Valida `tsc --noEmit`.
4. **Gate 2 (Arch Boundary Test)**: Testa violações em nível de infraestrutura simulada.
5. **Gate 3 (Invariant Regression)**: Garante que os princípios fundamentais (Identity, Time-Travel) não foram degradados.
6. **Gate 4 (Native Tests)**: Valida mais de 150 asserts sistêmicos (`npm test`).
7. **Gate 5 (Self-Governance)**: Testa a engine contra si mesma (Meta-Governança).

## 3. Regras Arquiteturais e Invariantes
O EOS possui contratos formais que descrevem e amarram Invariantes.
* **Local Canônico**: Consulte `architecture/EOS_FINAL_ARCHITECTURAL_CONTRACT.md`.
* **Invariantes Centrais**: Aversão à evidência sintética (INV-001), Imutabilidade do domínio (INV-004) e Restrição do Filesystem (INV-006).

## 4. Políticas e Processo ADR (Decisões Arquiteturais)
Alterações de design do sistema devem passar pelo funil de ADR:
1. **Proposta**: O arquiteto redige o ADR.
2. **Revisão e Mecanismo**: Se o ADR introduz uma nova restrição, deve ser acompanhada de código (um teste ou script AST) que torne essa restrição enforced.
3. **Aceite**: O ADR transita para `ACCEPTED` e é salvo em `EOS/docs/ADR/`.
4. **Histórico**: A decisão e as consequências são salvas para as fases futuras.

## 5. Critérios de Mudança Arquitetural e Conclusão de Fases
Para finalizar uma Fase do EOS (como a 3.1, 3.2.0, etc):
* O Pipeline `npm run governance` deve retornar GREEN integralmente.
* Todas as auditorias e evidências produzidas devem estar alocadas na pasta `AUDITS/`.
* Nenhuma propriedade hipotética pode ser introduzida em relatórios (ex: dizer que resolveu uma mitigação se não houver um teste de *Negative Verification* atestando).

## 6. Rastreabilidade Sistêmica
A governança é mantida porque a matriz de rastreabilidade (Traceability Matrix) faz um de-para:
`Requirement → Architectural Rule → Implementation → Enforcement → Test → Evidence`.

Sempre que a evolução falhar em completar este grafo (seja porque a implementação não foi feita, ou não pode ser testada), a governança acusa `DOCUMENTATION_DRIFT` ou reduz a propriedade a um mero documento passivo (`DOCUMENTED_ONLY`).
