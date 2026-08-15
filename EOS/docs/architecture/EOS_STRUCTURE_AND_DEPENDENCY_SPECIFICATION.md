# EOS — STRUCTURE AND DEPENDENCY SPECIFICATION
## Physical Structure vs. Logical Architecture

### 1. Logical Boundaries & Responsibilities

| Boundary | Responsibility | Allowed Dependencies | Forbidden Dependencies |
| :--- | :--- | :--- | :--- |
| **Domain** (`core/domain/`) | Entities, Value Objects, Causal Contracts, Pure Policies. | None (Ideally). | `fs`, `child_process`, Infrastructure adapters, Storage. |
| **Application** (`core/services/`) | Use cases, coordination, contextual authorization. | Domain, Storage, Infrastructure. | None strictly forbidden. |
| **Infrastructure** (`core/collectors/`, `adapters/`) | Adapters, POSIX/IO interactions, AST parsers. | Domain. | Application (Circular). |
| **Storage** (`core/storage/`) | Persistence, Artifacts, JCS Canonicalization, OS Locks. | Domain. | Application. |
| **Orchestration** (`core/engines/`) | Lifecycle execution, Verification pipelines. | Application, Domain, Infra. | None strictly forbidden. |
| **Verification** (`tests/`) | Execution of invariants to prove properties. | All. | Modifying Domain state directly bypassing Application layer. |

### 2. Physical Verification vs Intended Architecture
By auditing the `core/` directory, the following structural facts were extracted from the codebase (`package.json`, `core/eos-platform.ts`, `core/domain/types.ts`):

1. **`core/eos-platform.ts`**: The primary Application orchestrator (Entry Point).
2. **`core/engines/`**: The core logic orchestrators (`nist-assessment-engine.ts`, `multi-agent-orchestration-engine.ts`).
3. **`core/storage/`**: The persistence layer (`audit-history-repository.ts` handles OS `wx` locks, IDOR prevention, and `AuditArtifactMigrator`).
4. **`core/domain/`**: The pure models (`types.ts`, `causal-pipeline-contracts.ts`).
5. **`core/services/`**: The application coordinators (`audit-history-projection-service.ts`, `repository-identity-registry.ts`).

### 3. Direction of Dependencies (Matrix)

| From | To | Type | Status | Risk / Reason |
| :--- | :--- | :--- | :--- | :--- |
| `core/services/` | `core/domain/` | IMPORT | ✅ ALLOWED | Standard Clean Architecture. |
| `core/storage/` | `core/domain/` | IMPORT | ✅ ALLOWED | Storage implements persistence of Domain entities. |
| `core/engines/` | `core/domain/` | IMPORT | ✅ ALLOWED | Engines execute domain rules. |
| `core/collectors/` | `fs` | IMPORT | ✅ ALLOWED | Collectors gather physical data. |
| `core/domain/` | `fs` | IMPORT | ❌ ARCHITECTURAL DEBT (P2) | Domain leakage. Limits in-memory testing. Found in `semantic-policy-engine.ts`, `target-resolver.ts`. |

### 4. Code Is Truth - Deviation Report
- **Documented**: Domain layer is pure.
- **Implemented**: `core/domain/target-resolver.ts` and `semantic-policy-engine.ts` currently import `fs` and `path` to resolve targets on disk. This is acknowledged as a structural debt.
