# EOS — TRACEABILITY MATRIX
## Mapping Properties to Proofs

For a property to be considered `VERIFIED` in EOS, it must demonstrate an unbroken chain from human claim down to executable test and empirical evidence.

| Property (Claim) | Source File (Implementation) | Test Suite (Executor) | Empirical Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **1. Causal Execution (No synthetic findings)** | `nist-assessment-engine.ts` | `EOS Phase 3 — NIST Assessment Engine` | Fails gracefully when `is_synthetic` or `UNKNOWN` is detected. | **GREEN — VERIFIED** |
| **2. Multi-Process Concurrency (OS Atomicity)** | `audit-history-repository.ts` | `Phase 6.1.6 Storage Integrity Suite` | Native OS file locking (`fs.openSync` with `wx`) prevents TOCTOU overwrites. | **GREEN — VERIFIED** |
| **3. Causal Lineage (Strict Migration)** | `audit-artifact-migrator.ts` | `EOS Phase 3.1.2 — Conditional Verification` | Missing findings fallback to `[]` only if properly migrated without ambiguity. | **GREEN — VERIFIED** |
| **4. Referential Integrity (JCS canonicalization)** | `audit-history-repository.ts` | `EOS Phase 3.1.2 — Track A` | JCS RFC 8785 guarantees consistent hashes across differing JSON structural orders. | **GREEN — VERIFIED** |
| **5. Identity (Deny-by-Default / IDOR Defense)** | `repository-identity-registry.ts` | `EOS Phase 3.1.2 — Mutation Verification` | Rejects cross-project reads (`getAuditTimelineDetail`) and unregistered IDs. | **GREEN — VERIFIED** |
| **6. Pure Domain (No filesystem coupling)** | `semantic-policy-engine.ts` | Manual Audit | Domain layer directly uses `fs.readFileSync` causing leakage. | **YELLOW — STRUCTURAL DEBT** |
| **7. System Authenticity (Against Root Attacker)** | N/A | N/A | Exceeds the defined Trust Boundary. Hardware/Root is trusted. | **OUT OF SCOPE** |

Any property missing an executable test or verifiable evidence defaults to `NOT_VERIFIED`.
