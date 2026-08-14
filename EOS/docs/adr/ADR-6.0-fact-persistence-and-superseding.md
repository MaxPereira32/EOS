# ADR-6.0 — FACT HISTORICAL PERSISTENCE & SUPERSEDING GOVERNANCE

- **Status:** APPROVED
- **Date:** 2026-08-14
- **Context:** EOS Phase 6.0 Architecture Evolution

---

## 1. CONTEXTO & PROBLEMA

O Engineering Operating System (EOS) consolidou a produção determinística de `Fact`s imutáveis a partir de `Evidence`s físicas (Fases 4.x–5.x). No entanto, o sistema operava com retenção de fatos em memória apenas durante o ciclo de uma única auditoria.

Isso impedia responder a perguntas históricas cruciais de governança, como:
- "Qual era o estado de conformidade arquitetural deste módulo há 3 commits?"
- "Quando uma nova dependência física foi introduzida para substituir uma existente sem alterar a assinatura semântica?"
- "Consigo reconstruir o histórico de auditoria se eu não reexecutar os Collectors?"

Nenhum fato histórico podia ser persistido de forma segura sem uma abstração formal que previsse imutabilidade, versionamento e regras estritas de não-sobrescrita (*No-Overwrite*).

---

## 2. DECISÕES ARQUITETURAIS

### 2.1 Por que Facts precisam de persistência histórica?
A governança contínua exige rastreabilidade temporal. A persistência histórica permite que o EOS armazene uma série temporal imutável de afirmações semânticas. Se o processo do EOS for encerrado e reiniciado amanhã, o repositório histórico contendo os `Fact`s permite reconstruir a evolução completa de conformidade do projeto sem depender de reexecutar os Collectors ou reler o sistema de arquivos original.

### 2.2 Por que o domínio não conhece storage?
Seguindo a Clean/Hexagonal Architecture e o Princípio de Inversão de Dependências (DIP), a interface `FactRepository` pertence inteiramente à camada de **Domínio** (`EOS/core/domain/fact-repository.ts`). Ela não importa nenhum módulo de I/O de infraestrutura (`fs`, `child_process`, `net`, drivers SQL/NoSQL).
O código da aplicação e das regras arquiteturais interage exclusivamente com a abstração `FactRepository`.

### 2.3 Por que overwrite é terminantemente proibido?
Permitir que um `Fact` existente sob o mesmo `fact_id` tenha seu conteúdo alterado silenciosamente destruiria a auditabilidade e a irrepreensibilidade do EOS. Se um `Fact` sob um determinado `fact_id` for enviado novamente com conteúdo divergente, o repositório rejeita a operação com `FactOverwriteForbiddenError`. Operações com o mesmo `fact_id` e conteúdo idêntico são tratadas como **idempotentes**.

### 2.4 Como o Superseding funciona?
Quando um novo `Fact` ($F_{new}$) com o mesmo `semantic_hash` mas com um `input_hash` diferente (diferente proveniência física) é salvo:
1. As versões anteriores ($F_{old}$) atreladas a esse `semantic_hash` que possuíam `lifecycle_status = 'VALID'` transicionam seu estado de ciclo de vida para `'SUPERSEDED'`.
2. O payload, evidências, hashes e dados históricos de $F_{old}$ permanecem 100% intactos e imutáveis.
3. O novo fato $F_{new}$ é armazenado com `lifecycle_status = 'VALID'`.

### 2.5 Como Facts semanticamente iguais são versionados?
O `semantic_hash` funciona como a chave de identidade semântica de longa duração. Múltiplas instâncias fisicamente distintas (com `input_hash`es diferentes) que compartilham o mesmo `semantic_hash` coexistem no repositório ordenadas por ordem de inserção/execução.

### 2.6 Como Facts históricos são recuperados?
A interface provê métodos especializados:
- `findBySemanticHash(hash)` / `findHistoryBySemanticHash(hash)`: Retorna toda a linhagem histórica (`[F_old (SUPERSEDED), F_new (VALID)]`).
- `findValidBySemanticHash(hash)`: Retorna a versão ativa (`VALID`) mais recente.
- `findByInputHash(hash)`: Retorna exatamente os fatos gerados por uma proveniência física específica.

### 2.7 Substituibilidade de Infraestrutura (SQL/NoSQL/Filesystem)
A implementação inicial `InMemoryFactRepository` reside na camada de infraestrutura (`EOS/core/storage/`). Uma implementação posterior utilizando PostgreSQL, SQLite, Redis ou arquivos JSON imutáveis poderá ser injetada na aplicação sem necessidade de alterar uma única linha das **Rules** ou da camada de **Domínio**.

### 2.8 Garantias Independentes de Infraestrutura
As 6 Invariantes de Persistência (**INV-6.0-01 a INV-6.0-06**) são aplicadas programaticamente no método `save()` de qualquer implementação de `FactRepository`, garantindo que schemas inválidos, hashes malformados ou fatos sem evidências sejam rejeitados na fronteira de persistência.

---

## 3. CONSEQUÊNCIAS E CONFORMIDADE

- **Consequências Positivas:** Preservação de linhagem auditável, total desacoplamento entre armazenamento e regras, imunidade contra mutações em memória via `Object.freeze`.
- **Validação:** Atestada por 26 testes adversariais unitários e estáticos em `tests/phase-6-0-fact-persistence-adversarial.test.ts`.
