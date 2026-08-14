# ADR-6.1.1 — DURABILITY, MULTI-PROCESS CONCURRENCY & LIFECYCLE STATE MACHINE HARDENING

- **Status:** APPROVED
- **Date:** 2026-08-14
- **Context:** EOS Phase 6.1.1 Architectural Refinement

---

## 1. CONTEXTO & PROBLEMA

A auditoria da Fase 6.1 identificou imprecisões conceituais em relatórios anteriores:
1. **Substituição Atômica vs Durabilidade Física:** A chamada `fs.renameSync()` assegura a substituição atômica da entrada de diretório no sistema de arquivos, mas não garante a gravação física dos setores do disco contra perda bruta de energia (Power Loss) sem chamadas explícitas de `fsync()`.
2. **Imutabilidade vs Transição de Estado:** Afirmar que o `Fact` é "100% imutável" entra em conflito conceitual com a transição de `lifecycle_status` de `VALID` para `SUPERSEDED`.
3. **Concorrência Lógica vs Concorrência Física Multi-processo:** Sequenciar gravações em um único processo Node.js não previne o problema de *Lost Update* quando múltiplos processos OS independentes leem e gravam no mesmo arquivo de armazenamento concorrentemente.
4. **Integridade Estrutural vs Proveniência Verificável:** O repositório contendo apenas `input_hash` e `evidence_ids` valida a integridade estrutural e assinatura semântica interna, mas a proveniência física das evidências só é totalmente re-verificável se os conteúdos brutos das evidências estiverem disponíveis em um Evidence Store.

---

## 2. DECISÕES ARQUITETURAIS E FORMALIZAÇÕES

### 2.1 Máquina de Estados Estrita do Lifecycle (`VALID → SUPERSEDED`)
Formalizamos que todos os campos fáticos (`fact_id`, `schema_version`, `fact_type`, `provider_id`, `provider_version`, `evidence_ids`, `input_hash`, `semantic_hash`, `payload`, `composite_confidence`, `created_at`) são **estritamente imutáveis**.

A única mutação governada permitida em um `Fact` persistido é a transição de `lifecycle_status`:
```text
VALID ───────────────→ SUPERSEDED
```
**Regras Invioláveis da Máquina de Estados:**
- Transição permitida: exclusivamente `VALID → SUPERSEDED`.
- Transições proibidas: `SUPERSEDED → VALID`, `SUPERSEDED → SUPERSEDED`, `ANY → INVALID_STATUS`.
- Qualquer tentativa de transição inválida ou mutação dos campos fáticos dispara `FactIntegrityError` ou `FactStateTransitionForbiddenError`.

### 2.2 Escrita Atômica + `fsync()` para Durabilidade Física
Para garantir durabilidade física em disco além da substituição atômica:
1. Os dados são serializados canonicamente e gravados no arquivo `.tmp`.
2. Executa-se `fs.fsyncSync(fd)` no descritor de arquivo temporário para forçar o *flush* dos buffers do SO para o hardware do disco.
3. Executa-se `fs.renameSync(tmpPath, filePath)` para efetuar a substituição atômica do nome do arquivo no diretório.

### 2.3 Trava de Arquivo Multi-processo (*File Lock*) sem Dependências Externas
Para prevenir *Lost Updates* quando múltiplos processos independentes tentam salvar fatos concorrentemente no mesmo `FileFactRepository`:
- Implementamos trava exclusiva de arquivo `.eos/facts_store.json.lock` via `fs.openSync(lockPath, 'wx')`.
- Cada operação de escrita obtém a trava exclusiva antes de ler a imagem atual em disco e escrever o novo estado.
- Se a trava estiver retida por outro processo, aguarda com tentativas e timeout (5000ms).
- Trava obsoleta (*stale lock* > 3000ms por travamento de processo) é detectada e limpa automaticamente.

### 2.4 Distinção Formal entre Integridade e Proveniência
Documentamos formalmente que:
- **Integridade Estrutural:** O repositório garante que `input_hash` e `semantic_hash` sejam hexadecimais SHA-256 válidos e correspondem à assinatura canônica do payload armazenado.
- **Proveniência Verificável:** Exige acesso aos artefatos brutos e manifests originais (fornecidos pelos Collectors/EvidenceStore). O `FactRepository` isola a integridade interna dos fatos, declarando proveniência como verificável somente quando as evidências originais estão disponíveis.

---

## 3. CONSEQUÊNCIAS & CONFORMIDADE

- As 118 suítes de testes históricos permanecem 100% GREEN.
- Criados 28 novos testes adversariais em `tests/phase-6-1-1-durability-concurrency-adversarial.test.ts`.
- Mantida zero dependência externa (0 npm packages adicionais).
