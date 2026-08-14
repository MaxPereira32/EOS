# ADR-6.1.5 — CONSOLIDAÇÃO FORMAL DO LOCK PROTOCOL & THREAT-MODEL BOUNDARY

- **Status:** APPROVED WITH RESIDUAL RISK
- **Date:** 2026-08-14
- **Context:** EOS Phase 6.1.5 Formal Consolidation

---

## 1. OBJETIVO

O objetivo desta fase é consolidar os limites absolutos de segurança da arquitetura atual do `FileFactRepository`, definindo inequivocamente aquilo que o protocolo de locking em `Node.js + Filesystem Nativo` provou assegurar e, crucialmente, aquilo que ele **NÃO PROVA**, sem utilizar paliativos arquiteturais.

## 2. INVARIANTES FORMAIS (INVARIANTS 6.1.5)

| ID | Descrição |
|---|---|
| **INVARIANT 6.1.5-A** | O protocolo garante isolamento transacional entre atores cooperativos que respeitam integralmente o protocolo de locking. |
| **INVARIANT 6.1.5-B** | A existência ou posse lógica de um arquivo `.lock` não constitui autoridade garantida pelo kernel sobre o pathname. |
| **INVARIANT 6.1.5-C** | A sequência `verifyOwnershipStrict()` → `fs.renameSync()` contém uma janela TOCTOU que não pode ser convertida em operação condicional atomicamente vinculada à identidade esperada do lock utilizando apenas as primitivas atuais da arquitetura. |
| **INVARIANT 6.1.5-D** | Um ator externo capaz de manipular o filesystem durante a janela TOCTOU está fora do modelo de confiança do protocolo. |
| **INVARIANT 6.1.5-E** | As garantias não devem ser extrapoladas para filesystems distribuídos, redes, clusters ou ambientes em que as premissas do liveness probe e da identidade de processo não sejam confiáveis. |

## 3. MODELOS DE AMEAÇA (THREAT MODELING) E BOUNDARIES

A classificação dos modelos de ameaça define o limite de segurança (*Safety Boundary*):

- **MODEL A — Cooperative Actor:** `STATUS: PROVEN` (Invariante A). O protocolo de aquisição, lease criptográfico e liberação funciona de forma consistente para processos internos e honestos.
- **MODEL B — Crash-Adversarial:** `STATUS: PROVEN`. Processos morrendo (OOM, SIGKILL) em qualquer etapa de gravação não provocam corrupção ou lock-starvation. O sistema de Liveness e uso de `.tmp_` provou blindagem contra falha limpa ou bruta.
- **MODEL C — External Lock Manipulation:** 
  - `TOCTOU EXPLOITABILITY: PROVEN`
  - `TOCTOU SAFETY: NOT PROVEN`
  Foi provado que um invasor (ou bug de cron-job) removendo o `.lock` durante um *Preempt* imediatamente antes de `renameSync` produz um Lost Update irreversível. A arquitetura NodeJS carece de primitivas locais nativas para acoplar verificação em dois inodes de forma atômica.
- **MODEL D — External Filesystem Mutation:** `STATUS: PARTIALLY PROVEN / NOT PROVEN`. Mutações destrutivas na base fora do protocolo escapam à vigilância. (Invariantes B e D).
- **MODEL E — Filesystem / Namespace Anomalies:** `STATUS: NOT PROVEN`. O *Liveness Probe* via PID colapsa quando clusters dividem IDs, bem como `fs.openSync` com flag `wx` em caches inconsistentes de NFS/SMB. (Invariante E).

## 4. MATRIZ DE GARANTIAS (THREAT → GUARANTEE → BOUNDARY)

| Threat Model | Ataque / Incidente | Precondições | Mecanismo de Defesa | Resultado Observado | Garantia (Status) | Limitação | Evidence (Teste) |
|---|---|---|---|---|---|---|---|
| **A** | Concorrência natural | Processos cooperam | PID + Token Lock Protocol | Fatos são gravados serialmente sem corrupção | **PROVEN** | Limita-se a processos que usam a mesma API do FileFactRepository | `SND-COOP-001` |
| **B** | Processo crasha durante I/O | SIGKILL durante File Write | Gravação em `.tmp_` e `renameSync` posterior | Arquivo real intacto, e lock reciclado no futuro | **PROVEN** | O Liveness Probe precisa conseguir ver PIDs do SO | `SND-CRASH-001` até `005` |
| **B** | Processo morre com Lock ativo | Processo abortado abruptamente | Liveness Probe `kill(pid, 0)` | Lock stale detectado via PID offline e re-adquirido | **PROVEN** | - | `REQ-011` |
| **C** | TOCTOU Lock Deletion | OS Suspende P1 antes de `rename` | Duplo Check pré-commit (`verifyOwnershipStrict`) | O atacante deleta o lock nesse micro-gap, e P1 faz overwrite (Lost Update) | `EXPLOITABILITY: PROVEN`, `SAFETY: NOT PROVEN` | O Kernel POSIX não condiciona um `rename` ao estado de um `.lock` (Sem lock de inode) | `TOCTOU-MICROSCOPIC-001` |
| **D** | External Overwrite | Acesso shell ao volume de arquivos | Nenhuma nativa para arquivo final | O estado é sobreposto | `OUT OF TRUST BOUNDARY` | N/A | `SND-EXT-003` |
| **E** | Network FS Race | Arquitetura NFS ou SMB (Cross-Node) | Nenhuma | Duas instâncias podem receber "sucesso" em adquirir arquivo de lock em flag `wx` | `NOT PROVEN` | FS Distribuídos carecem de consistência atômica e estrita sem um broker externo | `SND-FS-002` |

## 5. CONCLUSÃO E DECISÃO ARQUITETURAL

O FileFactRepository NÃO possui, neste ecossistema nativo restrito, suporte a atomicidade `Check-Then-Use` em relação ao arquivo `.lock`. Paliativos (retries, delaios) **foram ativamente bloqueados** de modo a preservar a fronteira da verdade técnica. O `TOCTOU` reside exclusivamente no ambiente do `Model C`, fora da Boundary (Invariante 6.1.5-D).
- Status Final: **APPROVED WITH RESIDUAL RISK.**
