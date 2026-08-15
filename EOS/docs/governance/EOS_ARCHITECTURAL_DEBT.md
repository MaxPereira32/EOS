# EOS — ARCHITECTURAL DEBT REGISTER
## Formal Record of Structural Compromises

This document records deviations from the Canonical Architecture that exist in the codebase. Debt must be acknowledged, not hidden.

| Debt ID | Severity | Problem | Location | Impact | Remediation Strategy | Risk of Not Fixing | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEBT-001** | P2 | Domain Leakage to Infrastructure | `core/domain/semantic-policy-engine.ts`, `core/domain/target-resolver.ts` | The pure Domain layer directly calls `fs.readFileSync` and `fs.existsSync`. This violates Clean Architecture, tightly coupling domain logic to the filesystem. | Refactor these files to accept an abstract `IFileSystemAdapter` or `StorageRepository` interface via Dependency Injection. | Prevents execution of purely in-memory isolated tests for the Domain layer. | **RESOLVED (GREEN)** |

*Note: DEBT-001 was formally resolved in Phase 3.1.4 by migrating filesystem and dependency execution logic to `FilesystemTargetResolver` and `NativeFileOperationAdapter`, successfully decoupled from the Domain. An architectural enforcement test protects the boundary.*
