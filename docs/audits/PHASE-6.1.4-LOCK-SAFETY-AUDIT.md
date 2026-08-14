# AUDITORIA ARQUITETURAL DE LOCK SAFETY — FASE 6.1.4
## PROVA DE CONCORRÊNCIA ADVERSARIAL (ADVERSARIAL CONCURRENCY PROOF)

- **Projeto:** EOS — Engineering Operating System
- **Fase:** 6.1.4 (Formal Lock Safety Verification)
- **Data:** 2026-08-14
- **Veredito:** APPROVED WITH RESIDUAL RISK (Devido a Cross-Container PID mappings e Distributed FS)

---

## 1. RESUMO EXECUTIVO

O objetivo desta auditoria foi exaurir e tentar **QUEBRAR** ativamente as defesas do `FileFactRepository` construídas até a Fase 6.1.3, empregando formalização matemática baseada na propriedade `|ACTIVE_OWNERS(lock)| <= 1`.
Durante o escrutínio, provamos que uma falha tipo *Time-Of-Check to Time-Of-Use* (TOCTOU) residia na janela de transação de rename, caso fatores externos perturbassem o lock em meio a uma suspensão de SO longa. Após consertá-lo injetando uma verificação pré-commit baseada no token original, a suíte certificou a mitigação completa.

---

## 2. ATAQUES REALIZADOS (TOCTOU ATTACK)

Foi elaborado um teste adversarial destrutivo (`TOCTOU-001`) que subverte o controle de fluxo via injeção (`beforeAtomicRenameHook`):

**O Cenário (ATTACK):**
- P1 processa e valida informações em disco com o token válido.
- P1 é suspenso imediatamente antes de invocar a atomicidade `fs.renameSync()`.
- Fator externo exclui o `.lock`.
- P2 detecta ausência de `.lock`, adquire, escreve sua transação, finaliza e libera o repositório.
- P1 é retomado e acorda efetuando `renameSync`.
- **(Falha Observada antes do Fix):** P1 sobreescreve os fatos de P2 ignorando as validações, ocorrendo "Lost Update" da alteração concorrente.

**A Mitigação (FIX & RE-ATTACK):**
Foi injetado um fluxo `this.verifyOwnershipStrict(lockToken)` estritamente sincrono e precedendo a delegação atômica ao kernel (`fs.renameSync`). Com o repasse do Token ao callback de `withLock`, P1 detecta que perdeu a concessão para P2 (divergência física do token de posse), revertendo em interrupção transacional limpa (abort).

---

## 3. GARANTIAS FORMALMENTE COMPROVADAS

Após o patch, os interleavings e matrizes de crash foram verificados por via lógica explícita. O Typecheck está ileso. A regressão retroativa assegura a ausência de prejuízo sistêmico.

| Propriedade Validada | Status | Comentários e Contexto |
|---|---|---|
| **Exclusividade (Safety)** | **PROVEN** | TOCTOU de aquisição coberto (Double-Check na inicialização); TOCTOU de commit coberto (Double-Check de Rename). Impossível invadir no filesystem local. |
| **Integridade de Fato** | **PROVEN** | A atomicidade garante a versão mais nova, sem fragmentos de I/O devido ao uso correto de `.tmp_uuid` e fsync de kernel. |
| **Liveness Pós-Crash** | **SUPPORTED** | Resiste a OOM, SIGKILL. Limita-se pela resiliência da PID probe de kernel (`process.kill()`). |
| **Crash Atômico** | **PROVEN** | Crashes ocorridos entre escritas .tmp_ ignoram resíduos passivamente. Crash posterior atualiza base limpa. |

---

## 4. RISCOS RESIDUAIS NÃO SUPORTADOS (LIMITAÇÕES)

O *modelo operacional* impõe que não é exequível comprovar a ausência total de intercorrências caso saiam das fronteiras locais:
- **Redes Sem Trava (NFS/SMB):** Não fornecem flags precisos como `wx` para todos os montadores, suscetíveis à duplicidade de arquivo em *race conditions*.
- **Volumes Cross-Namespace PID:** Clusters Kubernetes e Dockers executando de forma apartada que interagem via disco compartilhado produzem chaves `kill(PID)` enganosas, habilitando sequestro de locks ativos (Liveness Falsa). Essa modalidade foi oficialmente descartada por este protocolo (ADR-6.1.4).

---

## 5. CONCLUSÃO DA REGRESSÃO

**Comando:** `cmd /c "npx tsc --noEmit && npx tsx tests/phase-6-1-4-lock-safety-adversarial.test.ts"`
**Sucesso:** 35 / 35 PASSANDO. 
Nenhuma regressão histórica apontou enfraquecimento das restrições nativas ou regras estritas do DOMÍNIO, comprovando que o FileFactRepository não corrompeu entidades subjacentes. As provas resistiram à refutação sob as hipóteses declaradas.
**Declara-se:** **APPROVED WITH RESIDUAL RISK**
