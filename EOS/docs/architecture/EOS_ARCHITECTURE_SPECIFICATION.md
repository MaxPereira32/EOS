# EOS — ARCHITECTURE SPECIFICATION
## The Canonical Foundation of the Engineering Operating System

### 1. The Fundamental Definition
EOS is canonically defined as:
**"A trusted verification system within a trusted environment."**

EOS provides deterministic guarantees of causal verification, referential integrity, and logical immutability **inside** the execution boundary it considers trusted. 

**What EOS IS NOT:**
- It is NOT a cryptographically authenticated system against a compromised root host.
- It is NOT a remote attestation oracle.
- It is NOT tamper-proof against hardware or kernel-level malicious administrators.
- It is NOT a system of absolute, mathematically perfect trust.

### 2. The Trust Boundary

#### TRUSTED (In-Scope)
- **Node.js Runtime:** Assumed to execute JavaScript deterministically and uncompromised.
- **Local Filesystem:** Assumed to respect POSIX locks (`wx`) and ACLs provided by the OS.
- **OS Process Isolation:** Assumed to prevent memory interference between sibling processes.
- **Source Code & Tests:** Executed within the trusted environment as the source of truth.

#### UNTRUSTED / OUT OF SCOPE (Future Evolution / External)
- **Root/Admin Compromise:** A malicious administrator who can synchronously alter a payload and recalculate its JCS hash in transit.
- **Malware on Host:** Modifying runtime binaries in memory.
- **Filesystem Tampering Outside EOS:** Direct disk sector edits bypassing OS filesystem drivers.
- **Public Key Infrastructure (PKI) / HSM / Blockchain:** Not implemented in the current phase.

### 3. Absolute Principle: Code is the Source of Truth
In EOS, the hierarchy of authority is strictly enforced:
1. Executable Code
2. Executable Tests
3. Execution Evidence (Audit Artifacts)
4. Configuration
5. Documentation
6. Human Claims

If documentation contradicts code, **documentation is wrong**. If a claim has no evidence, it is **UNSUPPORTED**.

### 4. The Principle of Evidence Non-Equivalence
`NO EVIDENCE` ≠ `NO FINDING` ≠ `VERIFIED`.
The absence of a finding without the concrete, positive presence of observation evidence yields `NOT_VERIFIED`. An empty findings array (`[]`) does not establish security unless a pipeline explicitly executed and proved the absence of flaws. Synthetic (mocked) evidence cannot establish a `VERIFIED` state.
