# EOS — Mapeamento e Cálculo de Métricas Arquiteturais

## Versão 1.0

Este modelo define as regras de pontuação objetivas para calcular as notas de **Arquitetura**, **Governança**, **Testabilidade**, **Evolução** e o **Índice Geral EOS** ao final das auditorias técnicas.

---

## 1. Métrica de Arquitetura (Nota: 0 a 100)
Mede a integridade dos limites lógicos, separação de camadas e fluxo de imports do sistema, diferenciando limitações do framework de decisões acidentais do projeto.

* **Pontuação Inicial**: 100 pontos
* **Deduções (Penalidades por Ocorrência)**:
  * **-20 pontos**: Acesso complexo de persistência fora da camada de dados/serviços (ex: SQL bruto inline `DB::raw()`, `DB::select()` ou query com joins complexos na camada de visualização/controladores).
  * **-10 pontos**: Query Builder complexo ou encadeado fora da camada de dados.
  * **-10 pontos**: Cada dependência circular detectada entre módulos.
  * **-10 pontos**: Cada dependência na direção inversa (camada inferior dependendo de camada superior).
  * **-5 pontos**: Consultas simples via Active Record nativo do framework em controladores (apenas se o framework sugerir esse acoplamento como padrão, ex: `Produto::find($id)`).
  * **-5 pontos**: Nomenclaturas inconsistentes com o glossário de termos de domínio.

---

## 2. Métrica de Governança (Nota: 0 a 100)
Mede o rigor técnico no cumprimento das decisões formais, preenchimento de checklists e documentação de apoio.

* **Pontuação Inicial**: 100 pontos
* **Deduções (Penalidades por Ocorrência)**:
  * **-30 pontos**: Execução de "Mudança Arquitetural" ou tarefa com risco crítico (Score >= 6) sem a aprovação de uma ADR correspondente.
  * **-20 pontos**: Divergência explícita onde o código apresenta comportamento ou topologia diferente do descrito nos diagramas/ADRs vigentes.
  * **-10 pontos**: Ausência de checklist operacional preenchido em `.eos/auditorias/` para a implementação atual.
  * **-10 pontos**: Desorganização ou ausência das subpastas obrigatórias no diretório `.eos/`.

> [!NOTE]
> **Salvaguarda de Onboarding**: Durante a primeira auditoria documental de onboarding em um projeto existente, a nota de Governança inicia em **100** e não sofre penalidades retroativas pela ausência histórica de ADRs ou checklists anteriores, caso o onboarding tenha sido executado com sucesso.

---

## 3. Métrica de Testabilidade (Nota: 0 a 100)
Mede a confiabilidade contra regressões e a facilidade de mockagem e isolamento lógico.

* **Pontuação Inicial**: 100 pontos
* **Deduções (Penalidades por Ocorrência)**:
  * **-50 pontos**: Existência de testes unitários ou de integração falhando (RED) na ramificação de código.
  * **-25 pontos**: Acoplamento nos testes: testes de store/lógica que dependem de conexão ou mock complexo do driver de banco de dados real em execução (falta de isolamento por contrato/serviço).
  * **-15 pontos**: Ausência completa de testes automatizados para fluxos críticos de negócio.
  * **-10 pontos**: Mocks redundantes que validam apenas detalhes de implementação em vez de comportamento.

---

## 4. Métrica de Evolução (Nota: 0 a 100)
Mede a portabilidade do sistema para novas tecnologias e o nível de complexidade acidental existente.

* **Pontuação Inicial**: 100 pontos
* **Deduções (Penalidades por Ocorrência)**:
  * **-35 pontos**: Portabilidade classificada como **Baixa** (trocar o banco de dados exige reescrever a UI e as stores de estado).
  * **-15 pontos**: Portabilidade classificada como **Média** (a troca exige refatorar lógicas de stores, mas a UI é preservada).
  * **-15 pontos**: Presença de código morto (funções exportadas não consumidas) ou boilerplate excessivo.
  * **-10 pontos**: Abstrações prematuras inseridas sem caso de uso concreto correspondente.

---

## 5. Métrica de Adequação ao Contexto (Nota: 0 a 100)
Mede o alinhamento com as melhores práticas da plataforma sem imposição de dogmas artificiais.

* **Pontuação Inicial**: 100 pontos
* **Deduções (Penalidades por Ocorrência)**:
  * **-20 pontos**: Impor padrões externos incompatíveis com o ecossistema nativo do framework (ex: forçar Repository Pattern no Laravel sem justificativa, ou forçar Casos de Uso em scripts simples).
  * **-20 pontos**: Desrespeito às convenções estruturais oficiais do framework (ex: colocar rotas fora da pasta `routes` no Laravel ou fora de `app/` no Next.js).
  * **-10 pontos**: Configuração de regras do Linter que colidem com os padrões recomendados do framework.

---

## 6. Métrica de Consistência Arquitetural (Nota: 0 a 100)
Mede a fidelidade técnica do código real em relação ao perfil identificado pelo APE.

* **Pontuação Inicial**: 100 pontos
* **Deduções (Penalidades por Ocorrência)**:
  * **-20 pontos**: Vazamento de fluxo ou desvios das fronteiras do perfil identificado (ex: imports de Client Components em Server Components no Next.js).
  * **-15 pontos**: Coexistência de múltiplos estilos de design concorrentes de forma inconsistente no mesmo domínio sem justificativa em ADR.

---

## 7. Métrica de Complexidade Acidental (Nota: 0 a 100)
Mede o nível de indireções desnecessárias, código morto e over-engineering.

* **Pontuação Inicial**: 100 pontos
* **Deduções (Penalidades por Ocorrência)**:
  * **-20 pontos**: Introdução de abstrações genéricas/interfaces prematuras sem reutilização ou necessidade comprovada.
  * **-15 pontos**: Mapeamentos de dados repetitivos (boilerplate) que não adicionam desacoplamento real.

---

## 8. Métrica de Proporcionalidade das Soluções (Nota: 0 a 100)
Mede se as soluções propostas e implementadas são proporcionais à escala do problema.

* **Pontuação Inicial**: 100 pontos
* **Deduções (Penalidades por Ocorrência)**:
  * **-25 pontos**: Sugerir ou codificar soluções sob o pretexto de "boas práticas" que inflacionam o esforço e a complexidade ciclomática do sistema sem retorno de valor palpável (ex: propor CQRS ou microsserviços para cadastros CRUD simples).
  * **-15 pontos**: Ausência de justificativa clara de trade-offs de decisão técnica em novos planos de refatoração ou ADRs.

---

## 9. Cálculo do Índice Geral EOS

O **Índice Geral EOS** é a média aritmética simples das oito dimensões avaliadas:

$$\text{Índice Geral EOS} = \frac{\text{ARQ} + \text{GOV} + \text{TST} + \text{EVO} + \text{ADQ} + \text{CON} + \text{CXA} + \text{PRP}}{8}$$

### 9.1 Limiares Mínimos Individuais por Dimensão
Cada uma das dimensões técnicas possui um portão de nota mínima obrigatória:
* **Arquitetura (ARQ)**: Mínimo **80**
* **Governança (GOV)**: Mínimo **90**
* **Testabilidade (TST)**: Mínimo **90**
* **Evolução (EVO)**: Mínimo **80**
* **Adequação ao Contexto (ADQ)**: Mínimo **90**
* **Consistência Arquitetural (CON)**: Mínimo **90**
* **Complexidade Acidental (CXA)**: Mínimo **80**
* **Proporcionalidade (PRP)**: Mínimo **90**

> [!IMPORTANT]
> **Regra Impeditiva de Dimensão**: Se qualquer uma das oito dimensões individuais ficar abaixo de seu respectivo limiar mínimo, o status final do projeto será alterado automaticamente para **Reprovado (Bloqueio)**, independente de a média global do Índice Geral EOS ser alta.

### 9.2 Tabela de Classificação Final
* **90 a 100** (e com todos os limiares individuais atendidos): 🟢 **Padrão Ouro** (Pronto para congelamento técnico, excelente maturidade).
* **70 a 89** (e com todos os limiares individuais atendidos): 🟡 **Apto com Ressalvas** (Aprovado, mas com débitos técnicos que devem ser mapeados no Roadmap).
* **0 a 69** (ou com qualquer limiar individual violado): 🔴 **Reprovado (Bloqueio)** (Bloqueio técnico. Exige refatoração imediata antes de novas releases).
