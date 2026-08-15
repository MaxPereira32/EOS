# EOS — PROJECT STATE

## Identidade
* **Nome**: Engineering Operating System (EOS)
* **Propósito**: Atuar como plataforma de Continuous Architecture orientada por evidências para guiar decisões técnicas, governança arquitetural e evolução de sistemas de software de forma automatizada e verificável.
* **Escopo**: Governança contínua, detecção de drift arquitetural, execução de testes baseados em invariantes causais, e enforcement de contratos de desenvolvimento (ACF).
* **Não-Escopo**: Auditoria independente contra comprometimento de kernel/root (OS level), atestação criptográfica remota, e aplicações de negócios que não envolvam o domínio de governança de engenharia.
* **Estágio Atual**: Plataforma estabelecida com contrato arquitetural canônico. Transição de arquiteturas fluídas para arquiteturas estritamente baseadas em evidências locais.

## Estado Atual
* **Versão/Fase**: v2.2.0 (Phase 3.2.0)
* **Última Fase Concluída**: Phase 3.2.0 (Final Architectural Contract & Enforcement)
* **Fase em Andamento**: N/A (Consolidação documental em andamento)
* **Próximo Marco**: Phase 4 / Expansão para Storage Durável (Phase 6.x pendente de consolidação no fluxo unificado) ou novas capacidades analíticas.
* **Status Geral**: GREEN — VERIFIED WITH DOCUMENTED LIMITATIONS

## Arquitetura Atual (Implementada)
A arquitetura do EOS é uma variação de Clean/Hexagonal Architecture focada puramente em avaliação de evidências e integridade:
* **Core/Domain**: Contém os *Business Rules* puros (Fatos, Achados, Resoluções). Totalmente isolado de I/O, `fs`, `child_process` ou bibliotecas não-canônicas.
* **Core/Engines**: Unidades de processamento de regras (Ex: `NistAssessmentEngine`, `SemanticPolicyEngine`, `HardQualityGateEngine`) que operam as decisões do domínio baseadas em evidências.
* **Core/Services**: Orquestradores que coordenam fluxos de execução sem conter lógica de decisão em si mesmos.
* **Core/Storage**: Adaptadores e repósitorios de leitura/escrita em arquivo (`audit-history-projection-service.ts`, `audit-artifact-migrator.ts`) limitados pela interface.
* **Core/Adapters**: Executores de I/O que interagem com o mundo externo (`file-execution-journal-adapter.ts`).
* **Governance Scripts**: Validadores de acoplamento e versionamento localizados na raiz (`scripts/check-architectural-drift.ts`, `scripts/check-change-control.ts`).

## Capacidades Existentes
* **Architectural Drift Detection**: Detecção via AST parser de violações de fronteiras do Node (`core/domain` importando bibliotecas proibidas).
* **Change-Control Verification**: Classificador de arquivos modificados via git diff, estabelecendo exigências de revisão (Classes A a D).
* **Self-Governance Sandbox**: Simulação da engine de avaliação contra violações internas provando que ela trava (Fail-Closed) em ataques.
* **Invariant Regression Guard**: Baterias de testes focadas em ataques de causa raiz (Time Travel, Synthetic Evidence, Mutability, Causal Loss).
* **Causal Audit Log**: Geração e migração retroativa segura de artefatos de auditoria JSON e MD.

## Contratos
* **EOS_FINAL_ARCHITECTURAL_CONTRACT.md** (EOS-ARCH-CONTRACT-001): O contrato normativo absoluto sobre limites de software, regras de dependência (AP-001 a AP-006) e limites de verificação de ambiente.
* **Dependencies Contract**: Contrato de limites físicos de dependências intra-módulos (enforced).
* **Change Control Contract**: Contrato de responsabilidade nas revisões de pull request/git diff (enforced).

## Invariantes
* **INV-001**: Zero Synthetic Evidence
* **INV-002**: Repository Identity
* **INV-003**: Deny-by-Default
* **INV-004**: Domain Immutability
* **INV-005**: Evidence Non-Equivalence
* **INV-006**: Write-Once Filesystem
* **INV-007**: Trust Boundary Enforcement
* **INV-008**: Multi-Process Atomicity

## Enforcement

**Regra: Injeção de dependências externas no Domain é proibida**
* **Local**: `EOS_FINAL_ARCHITECTURAL_CONTRACT.md` (AP-002)
* **Mecanismo**: `scripts/check-architectural-drift.ts`
* **Teste/Evidência**: Execução de `npm run drift-check` (Gate 0.1).

**Regra: Geração de evidências sintéticas bloqueia pipeline**
* **Local**: `EOS_FINAL_ARCHITECTURAL_CONTRACT.md` (INV-001)
* **Mecanismo**: `NistAssessmentEngine` / `HardQualityGateEngine`
* **Teste/Evidência**: Execução de `npm test` (Gate 4) e `tests/phase-3-1-3-nist-assessment.test.ts`.

**Regra: Mudança na Engine exige Classificação Severa (Class D)**
* **Local**: `EOS_FINAL_ARCHITECTURAL_CONTRACT.md` (Change Control)
* **Mecanismo**: `scripts/check-change-control.ts`
* **Teste/Evidência**: Execução de `npm run change-control-check` (Gate 0.2).

**Regra: Alteração sintática do Contrato quebra Pipeline**
* **Local**: `EOS_FINAL_ARCHITECTURAL_CONTRACT.md`
* **Mecanismo**: `tests/phase-3-2-0-architectural-contract.test.ts`
* **Teste/Evidência**: Execução de `npm test` avaliando as presenças obrigatórias C-001 a C-010.

## Problemas Conhecidos

* **ID**: PRB-001
  * **Descrição**: Gap na integridade sintática textual. O sistema não percebe alterações do valor textuais de "VERIFIED" para "NOT_VERIFIED" isoladamente em tabelas markdown do contrato, a não ser que uma regra seja apagada.
  * **Impacto**: Baixo (Falha de semântica de tabela, não de execução nativa)
  * **Severidade**: Medium
  * **Status**: OPEN
  * **Origem**: Descoberto na Phase 3.2.0 (Ataque C2 do script `test-the-contract.ts`)
  * **Referência**: `EOS_PHASE_3.2.0_ARCHITECTURAL_CONTRACT_AUDIT.md`
  * **Próximo passo**: Aceitar o risco na Trusted Boundary ou construir AST Parser de Markdown.

## Próximos Passos
* Estabelecer a estruturação oficial da Versioned Project Memory (Em andamento).
* Evoluir a implementação de Storage Durável (ADR-6.1.1) mitigando condições de corrida documentadas na Phase 6.1.
