# ADR-6.1.3 — LOCK OWNERSHIP PROTOCOL

- **Status:** APPROVED
- **Date:** 2026-08-14
- **Context:** EOS Phase 6.1.3 Architecture Evolution

---

## 1. PROBLEMA & THREAT MODEL

Nas fases 6.1.1 e 6.1.2, implementamos um sistema robusto de lock multi-processos utilizando substituição atômica e checagem de viabilidade (`kill(pid, 0)`).
Entretanto, um threat model adversarial (Race Condition por Suspensão de SO) revelou a seguinte vulnerabilidade:

1. **Processo A** cria o arquivo vazio via `openSync('wx')`.
2. **Sistema Operacional** suspende o Processo A imediatamente.
3. **Processo B** tenta adquirir o lock, encontra o arquivo vazio e sem owner e, após o `staleTimeout`, rouba o lock (apaga o arquivo vazio e cria o seu).
4. **Processo A** acorda. Ignorante do roubo, ele usa o *file descriptor* original da memória, escreve o metadata em um *inode unlinked* e prossegue.
5. **A e B estão simultaneamente na região crítica (Violação de LOCK-SAFETY).**

## 2. PROTOCOLO ANTERIOR VS. NOVO PROTOCOLO

**Protocolo Anterior:**
Ownership baseava-se unicamente em "quem possui o file descriptor" e na presença do `PID` escrito no disco.

**Novo Protocolo (Ownership via Token Criptográfico Duplo-Checado):**
A partir de agora, **PID não é Ownership**. Ownership é definido por um par indissociável `(PID, Token Aleatório)` gerado dinamicamente no momento da aquisição.

A aquisição do lock segue rigorosamente:
1. Gera um `token` criptograficamente seguro (`crypto.randomBytes(16)`).
2. Adquire exclusividade de criação com `fs.openSync('wx')`.
3. Escreve `PID` e `Token` em JSON.
4. **DOUBLE-CHECK:** Imediatamente após fechar o arquivo, relê o conteúdo do disco pelo caminho original (ignorando file descriptors antigos).
5. Se o conteúdo lido não possuir o mesmo `PID` e `Token`, o lock foi roubado durante uma preempção. O processo aborta imediatamente.

## 3. RELEASE SAFETY

A remoção (`fs.unlinkSync`) no bloco `finally` nunca apaga cegamente o arquivo. O arquivo é lido e apenas apagado se, e somente se, o `PID` e o `Token` coincidirem com o owner da execução. Se o lock foi roubado ou suplantado, o owner caduco jamais destruirá o lock alheio.

## 4. GARANTIAS & MODELO OPERACIONAL SUPORTADO

- **Ambiente:** Node.js, Filesystems Locais POSIX/NTFS.
- **SAFETY GUARANTEES (PROVEN):** É impossível para dois processos em concorrência local adquirirem a região crítica e considerarem ter posse simultânea do repositório. Preempções extremas são bloqueadas pelo Double-Check Token.
- **LIVENESS GUARANTEES (SUPPORTED):** Stale Recovery detecta mortes limpas e crashes severos através de liveness probes, reciclando locks abandonados sem comprometer Safety.
- **DURABILITY GUARANTEES (PROVEN):** Uso de `fsyncSync` + `renameSync` na gravação atômica.
- **LIMITAÇÕES & RISCOS RESIDUAIS (RESIDUAL RISK):**
  - **Deadlock Temporário por PID Reuse:** Se o Processo A morre, e o SO reaproveita exatamente o seu PID para o Processo B (não relacionado ao EOS), a probe `kill(pid, 0)` reportará "vivo". O sistema não roubará o lock, gerando liveness starvation (timeout constante) até que B termine. Isso **não quebra Safety**, e foi classificado como *Trade-off aceitável* vs complexidade de I/O em checagem de criação de processo em SO heterogêneo.
  - **NFS/SMB Distributed FS:** O sistema *não garante* consistência atômica `wx` em volumes de rede sem configuração de hard-mount compatível. Homologado apenas para Local File Systems.

## 5. DECISÕES REJEITADAS

- **Bibliotecas Nativas (e.g., `fs-ext` flock):** Rejeitado por violar a restrição `ZERO NPM DEPENDENCIES` e quebrar cross-compilation transparente Windows/Linux.
- **Sleep / Retry Infinito:** Rejeitado. Retries são curtos, e loops protegem liveness sem mascarar deadlocks.

## 6. TRANSAÇÃO (TRANSACTION PROTOCOL)

1. Acquire (Gera Token, 'wx', Write, Close).
2. VerifyOwnership (Read File, Check PID+Token).
3. Lê Estado Atual.
4. Computa Novo Estado.
5. Escreve Temporário -> `fsyncSync` (Durabilidade).
6. Atomic `renameSync` (Atomicidade vs Crash).
7. Release (Verifica PID+Token novamente -> unlink).
