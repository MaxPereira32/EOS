# Plano de Evolução Estratégica — EOS v0.1.7

Este documento apresenta a análise de maturidade técnica do **Engineering Operating System (EOS)** e define a direção estratégica para a próxima versão (`v0.1.7`), focando em automação física de governança com baixa complexidade.

---

## FASE 0 — Diagnóstico do Próprio EOS (Auditoria de Core)

Realizamos uma auditoria minuciosa na estrutura física do repositório `/EOS`:

* **Arquitetura & Organização de Diretórios**: Alta separação de conceitos entre princípios (`core/`), modelos matemáticos (`modelos/`), templates táticos (`templates/`) e instruções de agentes (`prompts/`).
* **Acoplamento & Coesão**: Os módulos são altamente coesos e fracamente acoplados. A comunicação ocorre por referências markdown.
* **Redundâncias Identificadas (Evidências Físicas)**:
  1. **Checklist vs. Auditoria**: [checklist-auditoria-operacional.md](file:///c:/Users/USER/Desktop/DevJornay/Projeto/Cebus_Github/Engineering-Operating-System/EOS/templates/checklist-auditoria-operacional.md) possui duplicação de itens estruturais com as etapas de 1 a 12 descritas em [auditoria-arquitetural.md](file:///c:/Users/USER/Desktop/DevJornay/Projeto/Cebus_Github/Engineering-Operating-System/EOS/prompts/auditoria-arquitetural.md).
  2. **Validação de Limiares Manual**: O cálculo matemático e a validação de limiares mínimos descritos em [metricas.md](file:///c:/Users/USER/Desktop/DevJornay/Projeto/Cebus_Github/Engineering-Operating-System/EOS/modelos/metricas.md) dependem da disciplina intelectual do auditor. Não existe validação física programática no pipeline para checar se o arquivo Markdown de auditoria foi preenchido corretamente ou se os scores violam os limiares mínimos de merge.

---

## FASE 1 — Inventário de Capacidades

### Capacidades Existentes
* **APE (Profile Engine)**: Classificação condicional de stacks. *Limitação*: Puramente cognitivo/documental.
* **Métricas com Limiares**: Classificação numérica multidimensional. *Risco*: Erro de cálculo manual.
* **Quality Gates (Portões)**: Fases formais de ciclo. *Estado*: Consolidado.
* **Linter Arquitetural**: Integração com `dependency-cruiser` (físico). *Maturidade*: Automatizado.

### Capacidades Ausentes
* **Linter de Conformidade do EOS (EOS Metadata Linter)**: Script para verificar a formatação de ADRs e relatórios de auditoria no CI.
* **Validador de Limiares Matemáticos**: Script automatizado de pipeline que consome os relatórios técnicos e impede o merge se o score reportado pelo auditor violar algum limiar mínimo.

---

## FASE 2 — Benchmark Arquitetural

| Prática Externa (ThoughtWorks/SonarQube) | O que o EOS já possui | O que não possui | O que não faz sentido incorporar |
| :--- | :--- | :--- | :--- |
| **Fitness Functions (TW)** | Portões físicos locais (`pre-push`) e remotos (CI) bloqueando código. | Testes automáticos de regras de nomenclatura ou assinaturas customizadas. | Testar integridade de infraestrutura de nuvem (fora do escopo de design de software do EOS). |
| **Static Code Analysis (SonarQube)** | Verificações delegadas ao ESLint e TypeScript Compiler nativos. | Regras semânticas proprietárias. | Desenvolver um analisador estático proprietário de AST (ESLint e Dependency-Cruiser cobrem isso). |
| **Metadata Verification** | Templates estáticos de ADR e checklists estruturados. | Validação programática dos templates em tempo de build/CI. | N/A |

---

## FASE 3 — Mapa de Maturidade dos Componentes

1. **Princípios e Filosofia (`core/`)**: 🟢 **Nível 3 (Consolidado)** — Estável, validado em múltiplos projetos.
2. **Prompts e Templates (`prompts/`, `templates/`)**: 🟡 **Nível 2 (Funcional)** — Dependem de execução cognitiva humana/agente.
3. **Mapeamento e Cálculo de Métricas (`modelos/metricas.md`)**: 🟡 **Nível 2 (Funcional)** — Sujeito a falha de cálculo ou burla de limiar.
4. **Validações de Pipeline (Quality Gates)**: 🟢 **Nível 4 (Automatizado)** — Executados via Husky e GitHub Actions.

---

## FASE 4 — Identificação das Próximas Evoluções

* **Iniciativa A: Automatizador de Classificação de Diretórios do APE**
  * *Problema*: Classificação manual de perfis.
  * *Complexidade*: Alta.
  * *Riscos*: Falsos positivos por divergência de estrutura do framework.
* **Iniciativa B: EOS Schema & Metrics Validator Script (Linter de Metadados do CI)**
  * *Problema*: Relatórios de auditoria preenchidos fora do padrão ou que omitem violações de limiares mínimos passando desapercebidos no merge.
  * *Valor*: Transforma o relatório humano/agente em barreira física de build verificada por máquina.
  * *Complexidade*: Baixa.
  * *Retrocompatibilidade*: 100%.

---

## FASE 5 — Matriz de Priorização

| Iniciativa | Impacto (1-5) | Risco (1-5) | Custo (1-5) | Automação | Total (Prioridade) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Iniciativa B (Validator Script)** | 5 | 1 (Baixo) | 1 (Baixo) | 5 (Alto) | **10.0 (Prioridade Máxima)** |
| **Iniciativa A (APE Automatic)** | 3 | 4 (Alto) | 4 (Alto) | 3 | **4.5** |

---

## FASE 6 — Arquitetura da Versão `v0.1.7` (Proposta Selecionada)

### O Validador de Metadados e Limiares do EOS (`eos-validator.js`)
Criaremos um script utilitário leve e puramente agnóstico em Javascript executado no pipeline de CI e localmente via Husky (`pre-push`).

```
[Desenvolvedor] ──> Preenche .eos/auditorias/auditoria-arquitetural-v1.md
                           │
                           ▼
                  [git push / CI Build]
                           │
                           ▼
            [npm run lint:eos] (executa eos-validator.js)
                           │
                           ├──> Se formato inválido ──> Exit 1 (Bloqueia)
                           ├──> Se algum limiar < mínimo ──> Exit 1 (Bloqueia)
                           └──> Se tudo correto ──> Exit 0 (Aprova Merge)
```

### Trade-offs & Alternativas Descartadas
* *Descartado*: Desenvolver um CLI executável nativo em Rust/Go. *Justificativa*: Aumenta o acoplamento de infraestrutura de build e a complexidade de distribuição. Um script Node nativo é executado instantaneamente sem dependências extras.

---

## FASE 7 — Quality Review
* **Reduz complexidade?** Sim. Remove a necessidade de revisão manual visual para atestar o preenchimento correto dos dados de auditoria e cálculo de limiares.
* **Cria burocracia?** Não. O programador já escreve o relatório; o script apenas valida a integridade matemática dele.
* **Pode ser automatizado?** Sim, roda com `exit 0 / 1`.

---

## FASE 8 — Roadmap de Evolução do EOS

* **Curto Prazo (`v0.1.7`)**: Implementação do script de validação de metadados e limiares (`eos-validator.js`) e integração aos Quality Gates.
* **Médio Prazo (`v0.1.8`)**: Automatização do mapeamento de dependências com linting de regras dinâmicas do APE.
* **Longo Prazo (`v0.2.0`)**: CLI integrada para geração e validação interativa de ADRs e checklists.

---

## FASE 9 — Critério Supremo
A implementação do `eos-validator.js` resolve um problema crítico real: **a possibilidade de um desenvolvedor aprovar um merge com notas abaixo do limiar de qualidade estabelecido**. O script garante a conformidade física e inviolabilidade das métricas de engenharia com custo quase zero de infraestrutura.
