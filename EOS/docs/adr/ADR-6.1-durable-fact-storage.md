# ADR-6.1 — DURABLE FACT STORAGE, ATOMIC SUPERSEDING & RESTART CONSISTENCY

- **Status:** APPROVED
- **Date:** 2026-08-14
- **Context:** EOS Phase 6.1 Architecture Evolution

---

## 1. CONTEXTO & PROBLEMA

A Fase 6.0 introduziu a abstração `FactRepository` e a implementação `InMemoryFactRepository`. Embora a Fase 6.0 tenha comprovado todas as invariantes de imutabilidade, superseding e versionamento histórico em memória, o ciclo de vida do repositório estava limitado à duração da execução do processo Node.js.

Ao encerrar o processo, todos os fatos auditados eram perdidos. Para consultar o estado anterior ou verificar a evolução temporal de conformidade sem reexecutar os Collectors sobre o sistema de arquivos original, o EOS necessitava de uma **camada de persistência durável** que sobrevivesse a reinicializações de processo e falhas de máquina.

---

## 2. DECISÕES ARQUITETURAIS & JUSTIFICATIVA DE TECNOLOGIA

### 2.1 Escolha da Tecnologia de Persistência (`FileFactRepository` Atomic OS-backed)
Escolhemos implementar um repositório durável baseado no sistema de arquivos nativo do sistema operacional (`FileFactRepository`), utilizando técnica de escrita atômica com arquivo temporário (`.tmp`) e substituição via `fs.renameSync`.

**Justificativa de Tecnologia:**
- **Zero Dependências Externas (0 npm packages):** Evita acoplamento a drivers C++ binários (`better-sqlite3`, `sqlite3`) que causam falhas de compilação em ambientes nativos Windows/Linux/CI e adicionam custos de manutenção.
- **Portabilidade Absoluta:** Opera em qualquer ambiente onde o Node.js v18+ seja executado.
- **Atomicidade Garantida no SO:** A operação `fs.renameSync` em sistemas POSIX e NTFS (Windows) é uma operação atômica de ponteiro de diretório no sistema de arquivos.
- **Transparência e Auditabilidade:** Cada Fato (ou índice de fatos) é armazenado em formato JSON Canônico determinístico, permitindo inspeção direta por ferramentas de auditoria sem a necessidade de ferramentas proprietárias de banco de dados.

### 2.2 Por que o Domínio NÃO conhece o Storage?
A interface `FactRepository` (`EOS/core/domain/fact-repository.ts`) permanece 100% pura na camada de **Domínio**. As **Rules**, **Fact Providers** e o **Semantic Resolver** ignoram completamente se o repositório em uso é `InMemoryFactRepository` ou `FileFactRepository`. A injeção de dependência ocorre no nível da aplicação ou entrada da CLI.

### 2.3 Como a Atomicidade do Superseding é Garantida?
A operação de *superseding* (marcar versões anteriores com o mesmo `semantic_hash` como `SUPERSEDED` e registrar o novo fato como `VALID`) é executada sob uma transação atômica em arquivo com lock de escrita em memória por diretório de storage:
1. O repositório carrega o estado persistido atual.
2. Executa a validação de integridade do novo fato (INV-6.1-03, INV-6.1-11).
3. Verifica regras de *No-Overwrite* (INV-6.1-04).
4. Aplica as transições de `lifecycle_status` das versões anteriores e insere o novo fato.
5. Escreve a nova imagem consistente em um arquivo temporário exclusivo `.tmp_<random>`.
6. Executa a renomeação atômica (`fs.renameSync`), substituindo o arquivo de dados original em uma única instrução do sistema operacional.
7. Se qualquer erro ocorrer entre os passos 1 e 5, o arquivo temporário é limpo e a transação sofre **ROLLBACK** imediato, mantendo a cópia em disco intacta.

### 2.4 Como a Corrupção / Tampering é Detectada?
Na inicialização do repositório ou na leitura de um Fato persistido:
1. O repositório revalida as invariantes obrigatórias (formato SHA-256 de `semantic_hash` e `input_hash`, não-vacuidade de `evidence_ids`, `schema_version = "1.0"`).
2. Se a assinatura semântica armazenada divergir da serialização canônica do payload, ou se qualquer campo obrigatório estiver corrompido, o repositório rejeita a leitura e lança `FactIntegrityError` (ou `FactCorruptedError`), impedindo a propagação de dados violados.

### 2.5 Tratamento de Schema Evolution
Fatos persistidos contêm o campo imutável `schema_version = "1.0"`. Se o repositório encontrar um fato persistido com `schema_version` incompatível com a versão suportada pela aplicação, a operação falha explicitamente (INV-6.1-11), forçando uma migração de schema explícita via CLI ou ferramenta de migração de domínio, sem suposições silenciosas.

### 2.6 Tratamento de Concorrência & Restart Consistency
Duas instâncias independentes de `FileFactRepository` apontando para o mesmo diretório/arquivo de storage leem do sistema de arquivos e enxergam exatamente o mesmo estado consistente após reinicialização de processo (*Restart Consistency*). Para gravações concorrentes no mesmo processo,Locks síncronos garantem a ordem estrita de salvamento.

---

## 3. ALTERNATIVAS AVALIADAS E REJEITADAS

1. **SQLite (`better-sqlite3`)**: Rejeitado devido à necessidade de binários nativos C++ pré-compilados e incompatibilidades ocasionais de node-gyp no Windows sem ferramentas de build C++.
2. **ORM (TypeORM / Prisma)**: Rejeitado por introduzir complexidade acidental desnecessária, dependências pesadas e violação da Clean Architecture.
3. **Escrita Direta Sem Temp File (`fs.writeFileSync` direto)**: Rejeitado porque quedas de energia ou interrupções de processo durante a gravação deixariam arquivos parcialmente gravados e corrompidos, violando o princípio de atomicidade (INV-6.1-07 e INV-6.1-08).

---

## 4. CONSEQUÊNCIAS & CONFORMIDADE

- **Garantias Mantidas:** As 88 suítes de testes históricos (Fases 4.9.4 a 6.0) continuam 100% verdes. `InMemoryFactRepository` permanece intocado.
- **Validação:** Atestada por 30 novos testes adversariais unitários, de integridade, restart, concorrência e corrupção em `tests/phase-6-1-durable-fact-storage-adversarial.test.ts`.
