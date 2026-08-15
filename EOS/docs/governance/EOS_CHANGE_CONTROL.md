# EOS — CHANGE CONTROL MANIFEST
## Engineering & Agent Governance Contract

Any human or AI Agent proposing a change to the EOS codebase **MUST** adhere to the following strict process.

### 1. Change Impact Classification

All modifications to the EOS repository must be explicitly classified. The classification dictates the required validation gates.

#### CLASS A — DOCUMENTATION
- **Impact**: No operational or contractual changes. 
- **Examples**: Modifying `docs/**/*.md` (except Governance Specs), fixing typos, adding comments.
- **Required Validation**: 
  - Standard PR Review
- **Allowed Verdict**: N/A (Does not affect execution).

#### CLASS B — NON-CRITICAL IMPLEMENTATION
- **Impact**: Changes to internal components that do NOT affect Domain Contracts, Storage, Identity, Orchestration, Evidence Generation, or Governance logic.
- **Examples**: Refactoring utility functions, improving logging, adding non-critical CLI arguments.
- **Required Validation**: 
  - Type Safety (`tsc`)
  - Unit Tests
  - Full Regression (`npm test`)
- **Allowed Verdict**: `VERIFIED`

#### CLASS C — ARCHITECTURAL CHANGE
- **Impact**: Structural modifications.
- **Examples**: Changing dependency directions, introducing new adapters, modifying storage mechanisms, altering orchestration flows.
- **Required Validation**:
  - Unit Tests
  - Architectural Boundary Tests
  - Full Regression
- **Allowed Verdict**: `VERIFIED` or `VERIFIED WITH DOCUMENTED DEBT`

#### CLASS D — CRITICAL GOVERNANCE CHANGE
- **Impact**: Changes that affect the core trust model.
- **Examples**: Altering Invariants, Evidence validation logic, Identity enforcement, Audit immutability mechanisms, Self-governance rules, or Governance Specification Documents.
- **Required Validation**:
  - Unit & Integration Tests
  - Adversarial Validation
  - Full Regression
  - Self-Governance Integrity Check
- **Allowed Verdict**: `VERIFIED`

### 2. Execution Protocol (For AI Agents)
Agents MUST follow this execution cycle:
1. **READ & UNDERSTAND**: Inspect physical code. Do not infer from names.
2. **CLASSIFY IMPACT**: Determine if the change is Class A, B, C, or D.
3. **PROPOSE**: Declare exactly what will change.
4. **IMPLEMENT**: Modify code surgically.
5. **TEST**: Run `npm run governance` (which enforces the FAIL-CLOSED Governance Gate).
6. **AUDIT**: Ensure tracebility (Evidence -> Verdict).
7. **DOCUMENT**: Update Architecture/Governance specs if applicable.

### 3. Absolute Prohibitions
It is **strictly forbidden** to:
- Edit code before understanding the surrounding architecture.
- Introduce silent fallbacks (e.g., `catch (e) { return true; }`).
- Fabricate synthetic evidence to force a test to pass.
- Alter tests merely to make them pass without fixing the root cause.
- Declare a property `VERIFIED` without physical evidence.

A change is ONLY considered complete when:
**CODE + TEST + EVIDENCE + TRACEABILITY + DOCUMENTATION** are aligned.
