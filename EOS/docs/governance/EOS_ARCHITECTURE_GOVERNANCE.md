# EOS — ARCHITECTURE GOVERNANCE
## The Control Plane

The EOS Architecture Governance system is designed to prevent silent regression, architectural leakage, and evidence fabrication. It establishes rules for both human engineers and AI agents modifying the repository.

### 1. Governance Boundaries

#### Domain Boundary
**Responsible for:** Entities, Value Objects, Causal Contracts, Pure Policies.
**Must Not:** Access the filesystem, execute subprocesses, persist data, or depend on concrete adapters.
*(Protected by automated Architectural Enforcement Boundary Tests.)*

#### Application Boundary
**Responsible for:** Use Cases, Orchestration, Contextual Authorization, composing Domain and Infrastructure components.

#### Infrastructure Boundary
**Responsible for:** Filesystem (`fs`), Subprocesses (`child_process`), External APIs, Database Persistence.

#### Verification Boundary
**Responsible for:** Proving properties. Tests in EOS are not merely for "coverage"; they are the executors of system invariants.

### 2. Multi-Agent Governance
EOS employs a native Multi-Agent Orchestration Engine (`core/engines/multi-agent-orchestration-engine.ts`).
The governance rule for AI Agents is:
- **No Agent can self-certify.** The Implementer cannot unilaterally declare `VERIFIED`.
- **False Verdict Injection is blocked.** An agent returning `VERIFIED` without concrete `evidence_ids` triggers a `BLOCKED` orchestration state.

### 3. Change Control Authority
The authoritative documents governing changes are:
- Architecture Rules: `EOS_ARCHITECTURE_SPECIFICATION.md`
- Dependency Rules: `EOS_STRUCTURE_AND_DEPENDENCY_SPECIFICATION.md`
- Invariant Rules: `EOS_INVARIANT_REGISTRY.md`

Any PR/Agent modifying the system must explicitly map the impact on the Causal Flow and Invariant Registry.
