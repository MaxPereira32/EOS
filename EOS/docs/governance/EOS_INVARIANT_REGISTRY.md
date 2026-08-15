# EOS — INVARIANT REGISTRY
## Canonical Absolute Properties

The following invariants represent absolute truths enforced by the EOS implementation. Violating them causes deliberate failure.

### EOS-INV-001
- **NAME:** ZERO-SYNTHETIC-EVIDENCE
- **DESCRIPTION:** An execution cannot be marked `VERIFIED` based on mocked or synthetic evidence.
- **SOURCE:** `core/engines/nist-assessment-engine.ts`
- **TEST:** `tests/phase-3-nist-assessment-engine.test.ts`
- **GATE:** Governance Regression Suite
- **SEVERITY:** CRITICAL
- **STATUS:** GREEN — VERIFIED
- **EVIDENCE:** PASS in Governance Gate

### EOS-INV-002
- **NAME:** IDENTITY-DENY-BY-DEFAULT
- **DESCRIPTION:** A repository identity is denied unless explicitly whitelisted in the Identity Registry. Cross-project audit access is blocked.
- **SOURCE:** `core/services/repository-identity-registry.ts`
- **TEST:** `tests/phase-1-1-repository-identity-and-access.test.ts`
- **GATE:** Governance Regression Suite
- **SEVERITY:** CRITICAL
- **STATUS:** GREEN — VERIFIED
- **EVIDENCE:** PASS in Governance Gate

### EOS-INV-003
- **NAME:** MULTI-PROCESS-ATOMICITY (WRITE-ONCE-AUDIT)
- **DESCRIPTION:** Audit Artifacts cannot be overwritten. Writing uses OS kernel-level atomic exclusivity (`wx`).
- **SOURCE:** `core/storage/audit-history-repository.ts`
- **TEST:** `tests/phase-1-2-audit-storage-immutability.test.ts`
- **GATE:** Governance Regression Suite
- **SEVERITY:** HIGH
- **STATUS:** GREEN — VERIFIED
- **EVIDENCE:** PASS in Governance Gate

### EOS-INV-004
- **NAME:** DOMAIN-IMMUTABILITY
- **DESCRIPTION:** Mutating the root context or core models dynamically in runtime is rejected.
- **SOURCE:** `core/eos-platform.ts`
- **TEST:** `tests/phase-1-context-integrity.test.ts`
- **GATE:** Governance Regression Suite
- **SEVERITY:** HIGH
- **STATUS:** GREEN — VERIFIED
- **EVIDENCE:** PASS in Governance Gate

### EOS-INV-005
- **NAME:** NO-EVIDENCE-NO-FINDING-NOT-VERIFIED
- **DESCRIPTION:** The absence of evidence combined with an empty findings array does not equal `VERIFIED`. It equals `NOT_VERIFIED`.
- **SOURCE:** `core/engines/nist-assessment-engine.ts`
- **TEST:** `tests/phase-3-nist-assessment-engine.test.ts`
- **GATE:** Governance Regression Suite
- **SEVERITY:** CRITICAL
- **STATUS:** GREEN — VERIFIED
- **EVIDENCE:** PASS in Governance Gate

### EOS-INV-006
- **NAME:** CAUSAL-MIGRATION
- **DESCRIPTION:** Migrating legacy audit artifacts requires explicit schema upcasting. Missing fields are not inferred automatically unless the semantic is guaranteed.
- **SOURCE:** `core/storage/audit-artifact-migrator.ts`
- **TEST:** `tests/phase-1-3-audit-artifact-migration.test.ts`
- **GATE:** Governance Regression Suite
- **SEVERITY:** HIGH
- **STATUS:** GREEN — VERIFIED
- **EVIDENCE:** PASS in Governance Gate

### EOS-INV-007
- **NAME:** JCS-CANONICALIZATION
- **DESCRIPTION:** Cryptographic hashes of JSON payloads must conform to JCS RFC 8785 to prevent structural mutation forgery.
- **SOURCE:** `core/services/canonical-hash-service.ts`
- **TEST:** `tests/phase-3-1-2-verification-closure.test.ts`
- **GATE:** Governance Regression Suite
- **SEVERITY:** HIGH
- **STATUS:** GREEN — VERIFIED
- **EVIDENCE:** PASS in Governance Gate

### EOS-INV-008
- **NAME:** SELF-GOVERNANCE
- **DESCRIPTION:** The engine verifies the integrity of its own core modules before executing pipelines.
- **SOURCE:** `core/utils/governor-integrity-verifier.ts`
- **TEST:** `tests/run-self-governance.ts`
- **GATE:** Self-Governance Executable Gate
- **SEVERITY:** CRITICAL
- **STATUS:** GREEN — VERIFIED
- **EVIDENCE:** PASS in Governance Gate
