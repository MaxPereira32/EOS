# EOS ARCHITECTURAL DRIFT CONTROL

**Status**: ACTIVE & ENFORCED
**Class**: Class C (Architectural Governance)

## Overview
This document defines the architectural drift detection mechanisms for the EOS. 
Drift is defined as any divergence from the intended architecture (dependency boundaries, forbidden imports) that bypasses static tests or occurs outside the defined rules.

## Core Directives
1. **Source Code is the Truth**: Architectural diagrams do not matter if the imports allow drift.
2. **Fail-Closed Execution**: Drift detection acts as Gate 0.1 of the Governance Pipeline. Any detected drift aborts the pipeline with exit code 1.

## Forbidden Dependencies (Zone Enforcement)

### 1. Core Domain (`core/domain`)
- **Allowed**: Internal domain logic only.
- **Forbidden**: 
  - File system (`fs`, `path`)
  - Operating system APIs (`child_process`, `os`)
  - Any concrete infrastructure adapters (`core/adapters`)
  - Orchestration layers (`core/orchestration`)

### 2. Core Engines (`core/engines`)
- **Allowed**: Domain entities, evaluation logic.
- **Forbidden**:
  - Direct file system access
  - Orchestration dependencies (`core/orchestration`)
  - Adapters (`core/adapters`)

### 3. Core Adapters (`core/adapters`)
- **Allowed**: File system, Infrastructure libraries.
- **Forbidden**:
  - Should not hold domain logic or enforce structural business rules.

## Verification Mechanism
- **Script**: `scripts/check-architectural-drift.ts`
- **Execution**: Triggered automatically via `npm run drift-check` in the Governance Pipeline.
- **Strategy**: AST or Regex-based static analysis of `import` statements across all files in specific directories, validating against the forbidden lists.

## Drift Remediation
If drift is detected:
1. The Governance Gate is BLOCKED.
2. The offending import must be removed.
3. If an interface is required, it must be defined in the `domain` and implemented in the `adapter` (Dependency Inversion).
