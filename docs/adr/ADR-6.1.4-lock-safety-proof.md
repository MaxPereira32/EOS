# ADR-6.1.4 — FORMAL LOCK SAFETY PROOF & TOCTOU MITIGATION

- **Status:** APPROVED
- **Date:** 2026-08-14
- **Context:** EOS Phase 6.1.4 Formal Verification

---

## 1. OBJETIVO & MODELO FORMAL

A Fase 6.1.4 estabeleceu um ataque rigoroso contra a integridade do sistema de File Locking para comprovar ou refutar a segurança matemática sob um modelo de concorrência restrita. 

Formalizamos os **LOCK STATES**: `ABSENT -> CREATING -> ACTIVE -> RELEASED` e os loops adversariais `ACTIVE -> STALE -> RECOVERING`.
A propriedade central de segurança define:
`|ACTIVE_OWNERS(lock)| <= 1` em todos os instantes $t$.

## 2. O ATAQUE TOCTOU E A VULNERABILIDADE DESCOBERTA

Durante a verificação adversarial de *interleavings*, detectamos uma vulnerabilidade fatal classificada como **TOCTOU (Time-Of-Check to Time-Of-Use)**.

**Interleaving Crítico (Threat Model):**
1. `P1` adquire o lock, lê o estado atual, e calcula o novo estado.
2. `P1` grava em `.tmp_` e executa o `fsyncSync`.
3. **P1 sofre uma suspensão longa pelo Sistema Operacional.**
4. Uma intervenção externa (manual ou container bug) remove silenciosamente o arquivo `.lock` antigo.
5. `P2` inicia e adquire o lock.
6. `P2` escreve o novo estado, comita (`renameSync`) e finaliza a transação.
7. **P1 acorda e continua a execução imediatamente na instrução seguinte.**
8. `P1` executa `renameSync`, sobrepondo silenciosamente as transações legítimas de `P2`!
9. **Resultado:** OVERLAP NA ZONA CRÍTICA E LOST UPDATE.

## 3. SOLUÇÃO ARQUITETURAL APLICADA (O "FIX")

A premissa da vulnerabilidade era de que `P1` mantinha sua transação presumindo *continuidade de ownership* garantida apenas no instante da aquisição.

**O novo desenho exige validação Pre-Commit:**
Injetamos a rotina `verifyOwnershipStrict(token)` diretamente antes da instrução `fs.renameSync(tmpPath, this.filePath)`.

Com essa rotina, todo processo é forçado a re-atestar a posse física do token no disco antes da escrita final.
- Se o arquivo sumiu, ele aborta.
- Se o token no arquivo divergir do token gerado na aquisição, ele aborta.

## 4. CRASH MATRIX & GARANTIAS

- `Crash em qualquer fase antes de renameSync`: Estado ignorado, temp file pode ficar órfão e lock liberado na recuperação.
- `Crash durante renameSync`: A nível de POSIX e NTFS, rename é uma reatribuição atômica de inode/entry point. Logo, não há meio-termo corrompido visível para leituras.
- `Crash durante write do novo lock`: Pode ser interpretado como legacy lock e sofrer recover por TTL ou ser sobreposto. Garantia de Liveness ativada.

## 5. CONCLUSÃO & LIMITAÇÕES DECLARADAS

A restrição matemática: **LOCK-SAFETY = PROVEN.**

**Modelo Suportado:** Single PID namespace, File System atômico local (NTFS/POSIX).
**Limitações Residuais Declaradas:**
- Ambientes com virtualização de PID assíncrona (como clusters montando o mesmo NAS). Nestes ambientes o `kill(pid, 0)` se desassocia do processo real. A garantia de segurança degrada para **RESIDUAL RISK**. Solução exigiria um Daemon-Lock ou Redis. Devido à diretriz de `ZERO NPM/EXTERNO`, tal cenário fica oficialmente fora do suporte validado da aplicação.
