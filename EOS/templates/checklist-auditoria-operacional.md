# EOS — Checklist Operacional de Auditoria Arquitetural

## Versão Target: v1.0 (Evolutiva)

Este documento contém os critérios objetivos e mensuráveis aplicados durante as auditorias arquiteturais. Ele é acoplado ao Protocolo Permanente de Auditoria Arquitetural (EPAA), servindo como a ferramenta prática de checagem.

---

## 1. Módulo / Escopo da Auditoria
* **Projeto**: 
* **Módulo/Camada**: 
* **Data da Inspeção**: 
* **Executor**: 

---

## 2. Critérios de Avaliação e Verificação

| ID | Item de Verificação | Método de Medição | Status (C/NC/NA) | Evidência Física / Arquivo |
| :--- | :--- | :--- | :---: | :--- |
| **DEP-01** | Zero imports de bibliotecas de infraestrutura/banco nas stores/UI | Busca textual (grep) por `firebase`, `firestore`, `sqlite`, `mysql`, `pg` em `src/estados/` ou `src/componentes/` | | |
| **DEP-02** | Zero dependências circulares entre arquivos | Execução de ferramenta de análise estática ou mapeamento de imports | | |
| **DEP-03** | Direção unidirecional de fluxo de dependências | Validar que Camada Superior nunca importa Camada Inferior diretamente (ex: Serviços importando UI) | | |
| **INT-01** | Interfaces públicas representam o domínio do negócio | Checagem de tipos em `src/types/` — não expor objetos nativos de SDKs externos (ex: `QueryDocumentSnapshot`) | | |
| **RES-01** | Coesão de responsabilidade nas Zustand stores | Validar se as stores em `src/estados/*` gerenciam apenas estado em memória e delegam chamadas externas para serviços | | |
| **RES-02** | Coesão de responsabilidade nos componentes de UI | Validar se arquivos de tela em `src/modulos/*` não contêm regras de negócio ou de escrita/leitura direta de banco | | |
| **GOV-01** | Sincronismo entre código e ADRs | Checagem se as decisões aprovadas em `.eos/decisoes/ADR-*.md` estão fisicamente implementadas no código | | |
| **GOV-02** | Registros de Auditoria atualizados | Checar se a pasta `.eos/auditorias/` possui o log da última execução e revisões correlatas | | |
| **TST-01** | Isolamento de testes de stores globais | Validar se arquivos `*.test.ts` de stores realizam mocks apenas da camada de serviço/abstração e não de infraestrutura real | | |
| **TST-02** | Suíte de testes local operacional | Execução do comando de testes unitários com 100% de sucesso (GREEN) | | |
| **TST-03** | Testes focam em comportamento, não em detalhes | Validar se os asserts testam entradas/saídas de dados e fluxos, e não chamadas internas de métodos privados | | |
| **CMP-01** | Ausência de código morto ou duplicado | Varredura de funções exportadas não consumidas na camada de serviços ou stores | | |
| **CMP-02** | Abstrações justificadas | Checar se novas classes/interfaces não são generalizações precoces sem uso real demonstrado | | |

*Legenda: C = Conforme | NC = Não Conforme | NA = Não Aplicável*

---

## 3. Sumário Operacional
* **Total de Itens Auditados**: 
* **Conformes (C)**: 
* **Não Conformes (NC)**: 
* **Não Aplicáveis (NA)**: 
* **Taxa de Conformidade**: %

---

## 4. Notas do Auditor e Ações Corretivas
*(Detalhar os itens marcados como NC e o plano de ação imediato para correção)*
