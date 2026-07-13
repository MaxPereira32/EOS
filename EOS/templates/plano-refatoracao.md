# Plano de Refatoração — [Nome do Componente/Módulo]

* **ADR Relacionado**: [ADR-XXXX]
* **Autor(es)**: [Nome/Perfil do Autor]
* **Data**: [AAAA-MM-DD]

---

## 1. Objetivos da Refatoração

*Defina claramente quais melhorias estruturais ou de qualidade de código motivam este plano (ex: remover acoplamento, reduzir complexidade ciclomática, quebrar arquivos incoesos). O comportamento funcional externo do sistema NÃO deve mudar.*

---

## 2. Escopo

### O que será modificado:
* [Item 1] — Ex: Arquivo `src/estados/criarStoreCrud.ts`.
* [Item 2] — Ex: Conexão direta com Firestore será removida deste escopo.

### O que NÃO será modificado:
* [Item 1] — Ex: A API exposta pelas stores para as telas de UI (actions e state fields).
* [Item 2] — Ex: Componentes de UI não sofrerão refatoração nesta etapa.

---

## 3. Etapas de Execução (Mudanças Pequenas)

*Divida a refatoração em passos incrementais com salvaguardas ou testes intermediários em cada fase. Evite commits gigantescos.*

### Fase 1: [Nome da Fase]
1. [Passo 1.1]
2. [Passo 1.2]
* **Validação intermediária**: [Como testar se esta fase está ok?] Ex: Executar testes de unidade de `X` e certificar-se de que passam.

### Fase 2: [Nome da Fase]
1. [Passo 2.1]
2. [Passo 2.2]
* **Validação intermediária**: [Como testar se esta fase está ok?] Ex: Executar build local (`npm run build`).

---

## 4. Testes e Salvaguardas

*Descreva quais testes automatizados (unitários, integração, E2E) ou manuais de regressão devem ser executados para validar a preservação de comportamento do sistema.*

* **Testes Automatizados Afetados**: [Lista de arquivos de teste]
* **Validação Manual**: [Roteiro de cliques ou fluxo rápido de tela para atestar conformidade]

---

## 5. Estratégia de Rollback

*Se a refatoração falhar no ambiente de homologação ou produção, qual o plano de recuperação rápida?*

* **Rollback de Git**: Ex: `git checkout main` ou reverter commit específico `git revert [hash]`.
* **Rollback de Infraestrutura/Dados**: Ex: Se houve migração de banco de dados, como restaurar o estado anterior.
