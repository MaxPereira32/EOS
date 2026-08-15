# EOS — CRITICAL FILES REGISTRY
## Repository Heart Mapping

This document specifies the critical core paths of the EOS application. Any modifications to these files are automatically classified as **CLASS C (ARCHITECTURAL CHANGE)** or **CLASS D (CRITICAL GOVERNANCE CHANGE)**.

### 1. CORE DOMAIN (CLASS C & D)
The Domain layer defines the ultimate causality and entities of the system.
- `core/domain/**/*.ts`
- **Notable Core Files:**
  - `core/domain/assessment-snapshot.ts` (Data Structure for Traceability)
  - `core/domain/causal-pipeline-contracts.ts` (Contracts for Evidence-to-Verdict)
  - `core/domain/canonical-ids.ts` (System Identifiers)

### 2. CORE ENGINES (CLASS D)
Engines implement the mathematical, verification, and governance policies. Modifying these alters how truth is computed.
- `core/engines/**/*.ts`
- **Notable Engines:**
  - `core/engines/nist-assessment-engine.ts` (Central Truth Evaluator)
  - `core/engines/hard-quality-gate-engine.ts` (Release Blocker)
  - `core/engines/multi-agent-orchestration-engine.ts` (Agent Executor)

### 3. SERVICES & IDENTITY (CLASS C & D)
Application services that control authorization and lifecycle tracking.
- `core/services/repository-identity-registry.ts` (Drives `IDENTITY-DENY-BY-DEFAULT` invariant)
- `core/services/audit-history-projection-service.ts`

### 4. STORAGE & PERSISTENCE (CLASS C)
Controls how data is physically persisted and guarantees `WRITE-ONCE-AUDIT` immutability.
- `core/storage/audit-history-repository.ts`
- `core/storage/audit-artifact-migrator.ts`

### 5. SELF-GOVERNANCE (CLASS D)
Mechanisms that verify the runtime integrity of the tools themselves.
- `core/utils/governor-integrity-verifier.ts`
- `core/utils/report-integrity-signer.ts`

Any modification to these files must adhere strictly to the change control mechanisms defined in `EOS_CHANGE_CONTROL.md`.
