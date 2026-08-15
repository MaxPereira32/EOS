# EOS — CAUSAL FLOW SPECIFICATION
## The Lifecyle of Verification

This document specifies the exact, inviolable sequence of state transitions required to assert a property as `VERIFIED` in EOS.

### 1. The Causal Model
A valid audit conclusion must trace causally backward to raw, unadulterated reality.

```text
1. Observation
   ↓ (Collector creates Observation based on raw reality)
2. Evidence
   ↓ (Collector binds Observation to a Source Reference)
3. Fact
   ↓ (FactProvider derives an immutable Semantic Assertion from Evidence)
4. Finding
   ↓ (Engine evaluates Facts against Rules)
5. Resolution / Action
   ↓ (Human/Agent proposes ActionPlan, Approved via ApprovalRecord, Executed in ExecutionJournal)
6. Revalidation
   ↓ (Platform acquires new Observation, verifying the Resolution)
7. Audit Artifact
   ↓ (Sovereign JCS Canonical JSON persisted with OS 'wx' lock)
```

### 2. Causal Invariants of Execution
EOS enforces these through `CausalTransitionValidators` and `NistAssessmentEngine`:

- **Observation ≠ Evidence**: Raw data must be bound to a known source to become evidence.
- **Evidence ≠ Fact**: A file existing is an evidence; the fact that it violates an architecture rule is a semantic derivation.
- **Fact ≠ Finding**: A fact only becomes a finding when mapped to a policy rule.
- **Finding ≠ Resolution**: A finding being mitigated in a plan does not resolve it until execution generates an `ExecutionJournal`.

### 3. Central Causal Invariant: The Void Cannot Verify
If the chain breaks, the property is `NOT_VERIFIED`.
- `NO_EVIDENCE` implies `NOT_VERIFIED`.
- `UNKNOWN_APPLICABILITY` implies `NOT_VERIFIED`.
- `SYNTHETIC_EVIDENCE` (mocked) implies `NOT_VERIFIED`.
- An empty finding (`findings: []`) implies `VERIFIED` **ONLY IF** there is concrete execution evidence proving that all checks ran and observed zero flaws.

### 4. Implementation Mapping
- The flow is coordinated by `core/eos-platform.ts`.
- The strict validators reside in `core/domain/causal-pipeline-contracts.ts`.
- The Evidence -> Verdict logic resides in `core/engines/nist-assessment-engine.ts`.
- The Persistence of the Causal Chain resides in `core/storage/audit-history-repository.ts`.
