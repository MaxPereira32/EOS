# EOS PILOT — CEBUS | FINDINGS & REMEDIATION PLAN (PHASE C1)

> **PHASE C1 READ-ONLY AUDIT STATUS**: ALL FINDINGS ARE UNFIXED (STATUS: `VERIFIED FINDING` / `OPEN`).
> ABSOLUTELY NO CODE OR CONFIGURATION CHANGES WERE APPLIED TO CEBUS DURING THIS READ-ONLY GOVERNANCE AUDIT.

---

## 1. FINDINGS SUMMARY MATRIX

| Finding ID | Severity | Category | Target File(s) | Line(s) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FINDING-CEBUS-001** | `CRITICAL` | Domain Invariant & Transactional Integrity | `src/modulos/Saidas.tsx`, `src/modulos/Entradas.tsx`, `src/nucleo/servicos/servicoEstoque.ts` | L157-169 (Saidas), L167-186 (Entradas), L66-91 (Estoque) | `VERIFIED FINDING` |
| **FINDING-CEBUS-002** | `HIGH` | Security & Architectural Mismatch | `firestore.rules`, `src/nucleo/servicos/servicoLog.ts` | L73 (rules), L131-159 (servicoLog) | `VERIFIED FINDING` |
| **FINDING-CEBUS-003** | `HIGH` | Architecture & Compilation Safety | `src/nucleo/servicos/servicoEstoque.ts`, `src/modulos/Permissoes.tsx` | L99, L105 (Estoque), L149, L165, L189 (Permissoes) | `VERIFIED FINDING` |
| **FINDING-CEBUS-004** | `MEDIUM` | Security & Data Hygiene | `src/nucleo/validacoes/schemas.ts` | L1-128 (schemas.ts) | `VERIFIED FINDING` |
| **FINDING-CEBUS-005** | `MEDIUM` | Type Safety & Contract Integrity | `src/estados/use*.ts` (Zustand Stores) | Multiple lines across store definitions | `VERIFIED FINDING` |
| **FINDING-CEBUS-006** | `MEDIUM` | Test & Verification Coverage | `package.json`, `src/nucleo/servicos/*` | Project-wide test suite scope | `VERIFIED FINDING` |

---

## 2. DETAILED FINDINGS & REMEDIATION PLANS

### FINDING-CEBUS-001: Non-Atomic Inventory Operations, Orphan Exits & Stock Corruption

#### Finding Details
- **ID**: `FINDING-CEBUS-001`
- **Severity**: `CRITICAL`
- **Category**: Domain Invariant & Transactional Integrity
- **File**: 
  - [Saidas.tsx](file:///c:/Users/Max/Desktop/Projeto/cebus/src/modulos/Saidas.tsx#L157-L169)
  - [Entradas.tsx](file:///c:/Users/Max/Desktop/Projeto/cebus/src/modulos/Entradas.tsx#L167-L186)
  - [servicoEstoque.ts](file:///c:/Users/Max/Desktop/Projeto/cebus/src/nucleo/servicos/servicoEstoque.ts#L66-L91)
- **Line**: L157-L169 (`Saidas.tsx`), L167-L186 (`Entradas.tsx`), L66-L91 (`servicoEstoque.ts`)
- **Evidence**:
  1. In `Saidas.tsx` (L157-L167), `adicionar({...})` executes a Firestore write to `/saidas` BEFORE calling `subtrairSaida(form.ID_Produto, qtd)`. If `subtrairSaida()` throws an `Error('Estoque insuficiente...')` (because `novoSaldo < 0`), the write to `/saidas` HAS ALREADY COMMITTED. The UI toast shows an error, but an orphan document remains in `/saidas` while `/estoque` balance remains unchanged.
  2. In `Entradas.tsx` (L196-L207) and `Saidas.tsx` (L176-L186), deleting an entry or exit item (`excluirItem()`) deletes the document from `/entradas` or `/saidas` but NEVER decrements or restores stock totals in `/estoque`. This permanently violates invariant `INV-01` (`Saldo = EntradaTotal - SaidaTotal`).
  3. `editarProduto()` in `servicoEstoque.ts` uses unvalidated `setDoc(ref, dados, { merge: true })`, permitting arbitrary raw overrides of `Saldo` without verifying domain constraints.
- **Root Cause**: Two-phase desynchronized multi-collection writes on the client without using Firestore `runTransaction` or `writeBatch` to lock `/saidas` (or `/entradas`) and `/estoque` in a single atomic transaction.
- **Impact**: Permanent desynchronization between historical movement audit logs (`/entradas`, `/saidas`) and live balance (`/estoque`); phantom inventory levels; risk of physical stock deficit.
- **Exploit/Failure Scenario**: An operator records a stock exit of 100 units when current balance is 10. The system creates the exit entry in `/saidas` but aborts the stock reduction due to `saldo < 0`. Reports reflect 100 units dispatched, but `/estoque` retains 10. Later, an entry of 50 units brings physical total to 60, but movement logs reflect cumulative exits of 100, breaking ledger auditability.
- **Confidence**: 100% (Proven via static code execution path analysis)
- **Source Reliability**: Direct source inspection & line trace
- **Status**: `VERIFIED FINDING` / `OPEN`

#### Remediation Plan
- **Root Cause**: Architectural separation between history collections (`/entradas`, `/saidas`) and balance collection (`/estoque`) executed via separate non-atomic client promises.
- **Method**: Refactor `adicionarEntrada`, `adicionarSaida`, `excluirEntrada`, `excluirSaida` to execute inside a unified `runTransaction` block that atomically updates both `/estoque` and the history collection simultaneously. If stock balance would drop below 0 (`INV-02`), the entire transaction aborts cleanly before any document is written.
- **Affected Files**:
  - `src/nucleo/servicos/servicoEstoque.ts`
  - `src/nucleo/servicos/servicoEntrada.ts`
  - `src/nucleo/servicos/servicoSaida.ts`
  - `src/modulos/Entradas.tsx`
  - `src/modulos/Saidas.tsx`
- **Expected Property**: Atomicity across `/estoque` and `/saidas`/`/entradas`. Invariant `INV-01` (`Saldo == EntradaTotal - SaidaTotal`) and `INV-02` (`Saldo >= 0`) guaranteed at database write boundary.
- **Validation Method**: Integration test simulating concurrent and failing stock exits with mock/emulator Firestore transaction runner.
- **Expected Evidence**: Zero orphan documents created in `/saidas` when stock exit exceeds balance; stock balance matches ledger delta after deletes.
- **Regression Risks**: Low; requires clean error handling in UI form handlers when transaction rejects.

---

### FINDING-CEBUS-002: Incompatible Firestore Audit Log Immutability Contract

#### Finding Details
- **ID**: `FINDING-CEBUS-002`
- **Severity**: `HIGH`
- **Category**: Security & Architectural Mismatch
- **File**: 
  - [firestore.rules](file:///c:/Users/Max/Desktop/Projeto/cebus/firestore.rules#L73)
  - [servicoLog.ts](file:///c:/Users/Max/Desktop/Projeto/cebus/src/nucleo/servicos/servicoLog.ts#L131-L159)
- **Line**: L73 (`firestore.rules`), L131-L159 (`servicoLog.ts`)
- **Evidence**:
  1. `firestore.rules` L73 explicitly enforces Write-Only Strict Audit Trail for compliance (LGPD/OWASP):
     ```firestore
     match /logs/{logId} {
       allow read: if isAdministrador();
       allow create: if isAutenticado();
       allow update, delete: if false;
     }
     ```
  2. `servicoLog.ts` exports client functions `servicoResolverLog` (L131), `servicoResolverMultiplosLogs` (L141), `servicoReabrirLog` (L146), and `servicoExcluirLog` (L156), which execute `updateDoc` and `deleteDoc` on `/logs/{id}`.
- **Root Cause**: Architectural divergence between security rule requirements (append-only immutable logs) and UI feature design (mutable error tickets with resolution status and deletion).
- **Impact**: All user attempts to resolve, re-open, or delete audit logs in the administrative interface fail with Firestore `FirebaseError: Missing or insufficient permissions`.
- **Exploit/Failure Scenario**: Administrator attempts to mark a resolved system error in `Logs.tsx`. The application attempts `updateDoc`, which is rejected by Firestore security rules, triggering an unhandled promise rejection and UI lockup.
- **Confidence**: 100%
- **Source Reliability**: Direct contract discrepancy between rules definition and frontend service implementation.
- **Status**: `VERIFIED FINDING` / `OPEN`

#### Remediation Plan
- **Root Cause**: Frontend code assumes `/logs` document mutation is permitted, while backend security policy strictly forbids `update` and `delete`.
- **Method**: Decouple operational system logs (immutable security audit stream) from issue tracking tickets, OR modify log state updates to write immutable state transitions to a subcollection `/logs/{logId}/resolucoes` (append-only resolution events) without modifying the base log document.
- **Affected Files**:
  - `firestore.rules`
  - `src/nucleo/servicos/servicoLog.ts`
  - `src/modulos/Logs.tsx`
- **Expected Property**: Compliance with LGPD/OWASP immutable log rule while allowing admins to log resolution state transitions.
- **Validation Method**: Vitest unit test and Firestore rules test suite verifying document update rejection and event append permission.
- **Expected Evidence**: Zero permission errors when resolving logs; base audit log document remains untouched.
- **Regression Risks**: Low; requires updating UI log status calculation logic to read latest event entry.

---

### FINDING-CEBUS-003: Missing Module Imports & Undeclared Identifiers Breaking Compilation

#### Finding Details
- **ID**: `FINDING-CEBUS-003`
- **Severity**: `HIGH`
- **Category**: Architecture & Compilation Safety
- **File**: 
  - [servicoEstoque.ts](file:///c:/Users/Max/Desktop/Projeto/cebus/src/nucleo/servicos/servicoEstoque.ts#L99)
  - [Permissoes.tsx](file:///c:/Users/Max/Desktop/Projeto/cebus/src/modulos/Permissoes.tsx#L149)
- **Line**: L99 & L105 (`servicoEstoque.ts`), L149, L165, L189 (`Permissoes.tsx`)
- **Evidence**:
  1. Running `npx tsc --project tsconfig.app.json --noEmit` produces explicit build failures:
     - `src/nucleo/servicos/servicoEstoque.ts(99,9): error TS2304: Cannot find name 'setDoc'.`
     - `src/nucleo/servicos/servicoEstoque.ts(105,9): error TS2304: Cannot find name 'setDoc'.`
     - `src/modulos/Permissoes.tsx(149,5): error TS2552: Cannot find name 'setCarregando'. Did you mean 'setCarregandoLogs'?`
  2. Inspection of `servicoEstoque.ts` L1 reveals `setDoc` is missing from the `firebase/firestore` import declaration:
     `import { collection, getDocs, doc, deleteDoc, runTransaction } from 'firebase/firestore'`
- **Root Cause**: Refactoring oversight where methods were introduced without updating header import statements, coupled with missing TypeScript verification in pre-commit CI hooks.
- **Impact**: Invoking `editarProduto()` or `adicionarProduto()` results in immediate unhandled JavaScript runtime crash `ReferenceError: setDoc is not defined`.
- **Exploit/Failure Scenario**: Operator submits a new product form. `adicionarProduto()` is called, hits line 105, and crashes the app runtime with an uncaught `ReferenceError`.
- **Confidence**: 100% (Empirically verified via `tsc` execution output)
- **Source Reliability**: Compiler diagnostic report
- **Status**: `VERIFIED FINDING` / `OPEN`

#### Remediation Plan
- **Root Cause**: Missing module import `setDoc` in `servicoEstoque.ts` and wrong identifier reference `setCarregando` in `Permissoes.tsx`.
- **Method**: Add `setDoc` to `firebase/firestore` imports in `servicoEstoque.ts`; correct state variable reference in `Permissoes.tsx` to `setCarregandoLogs`.
- **Affected Files**:
  - `src/nucleo/servicos/servicoEstoque.ts`
  - `src/modulos/Permissoes.tsx`
- **Expected Property**: `npx tsc --project tsconfig.app.json --noEmit` passes with 0 syntax or identifier errors.
- **Validation Method**: Execute `tsc --project tsconfig.app.json --noEmit`.
- **Expected Evidence**: Clean compiler exit code 0.
- **Regression Risks**: None.

---

### FINDING-CEBUS-004: Dead Input Validation System (Unenforced Zod Schemas)

#### Finding Details
- **ID**: `FINDING-CEBUS-004`
- **Severity**: `MEDIUM`
- **Category**: Security & Data Hygiene
- **File**: 
  - [schemas.ts](file:///c:/Users/Max/Desktop/Projeto/cebus/src/nucleo/validacoes/schemas.ts#L1-L128)
- **Line**: L1-L128
- **Evidence**:
  1. `src/nucleo/validacoes/schemas.ts` defines comprehensive Zod schemas (`schemaProduto`, `schemaEntrada`, `schemaSaida`, `schemaDistribuicao`, `schemaFornecedor`, `schemaEquipe`, `schemaUsuario`, `schemaLogin`, `schemaConfiguracoes`) with Anti-XSS rules (`/^[^<>]*$/`).
  2. Static search across all `.tsx` components and `.ts` stores confirms that neither `validar()` nor any Zod schema from `schemas.ts` is imported or invoked during form submission.
  3. UI components perform minimal inline string checks (`if (!form.Produto)...`), permitting raw un-sanitized objects to reach Firestore.
- **Root Cause**: Validation module was authored as a standalone layer but never wired into form submit handlers or Zustand action middleware.
- **Impact**: Users can submit malicious payload strings (e.g. `<script>alert('xss')</script>`), invalid numbers, or malformed fields directly into Firestore.
- **Exploit/Failure Scenario**: An attacker or misinformed user enters `<svg/onload=alert(1)>` in the product observation field. Since Zod validation is bypassed, the raw string is saved to Firestore and rendered in the admin dashboard, exposing users to cross-site scripting (XSS).
- **Confidence**: 100% (Static search confirms 0 imports of `schemas.ts` in components)
- **Source Reliability**: Grep AST search across codebase
- **Status**: `VERIFIED FINDING` / `OPEN`

#### Remediation Plan
- **Root Cause**: Validation helper `validar()` in `schemas.ts` is never called prior to dispatching store/service operations.
- **Method**: Integrate `validar(schema, formData)` into store actions (`useEntradaStore`, `useSaidaStore`, `useEstoqueStore`, etc.) or UI submit handlers prior to calling Firestore services.
- **Affected Files**:
  - `src/estados/useEstoqueStore.ts`
  - `src/estados/useEntradaStore.ts`
  - `src/estados/useSaidaStore.ts`
  - `src/modulos/*.tsx`
- **Expected Property**: All client writes validated against anti-XSS and type constraints before hitting network layer.
- **Validation Method**: Vitest unit test attempting to submit `<script>` tags or negative quantities, verifying validation failure response.
- **Expected Evidence**: Invalid input returns structured error list; zero malformed payloads reach Firestore.
- **Regression Risks**: Low; requires clear error toast display for validation failures.

---

### FINDING-CEBUS-005: TypeScript Interface Drift Between Stores and Services

#### Finding Details
- **ID**: `FINDING-CEBUS-005`
- **Severity**: `MEDIUM`
- **Category**: Type Safety & Contract Integrity
- **File**: 
  - `src/estados/useCronogramaStore.ts`
  - `src/estados/useDistribuicaoStore.ts`
  - `src/estados/useEntradaStore.ts`
  - `src/estados/useEquipeStore.ts`
  - `src/estados/useFornecedorStore.ts`
  - `src/estados/useSaidaStore.ts`
- **Line**: Various store state contract lines
- **Evidence**:
  1. `npx tsc --project tsconfig.app.json --noEmit` fails with 11 type assignment errors between service return types and store interface declarations:
     - `useDistribuicaoStore.ts`: `DistribuicaoItem` vs `Distribuicao` (`DiaSemana` optional vs required).
     - `useEquipeStore.ts`: `criadoEm` returned as `Date` by service but typed as `string` in store interface.
     - `useFornecedorStore.ts`: `criadoEm` returned as `Date` by service but typed as `string` in store interface.
     - `useCronogramaStore.ts`: state interface requires `Tarefa[]` with `titulo` and `data_limite`, but store setter passes partial objects.
- **Root Cause**: Inconsistent refactoring where service interfaces evolved independently of domain model types in `src/types/index.ts`.
- **Impact**: Broken type safety contract; high risk of `TypeError: cannot read property of undefined` or `Date.split is not a function` at runtime in UI components.
- **Exploit/Failure Scenario**: Component accesses `item.criadoEm.split('T')[0]`, assuming `criadoEm` is a string as defined in the store interface. At runtime, the service delivers a JS `Date` object, causing a crash `.split is not a function`.
- **Confidence**: 100% (Compiler verified)
- **Source Reliability**: TypeScript compiler diagnostics
- **Status**: `VERIFIED FINDING` / `OPEN`

#### Remediation Plan
- **Root Cause**: Disconnected interface definitions between `src/types/index.ts` and `src/nucleo/servicos/*`.
- **Method**: Standardize interface definitions so stores consume unified domain models from `src/types/index.ts` and services map Firestore snapshots to exact domain models.
- **Affected Files**:
  - `src/types/index.ts`
  - `src/estados/use*.ts`
  - `src/nucleo/servicos/*.ts`
- **Expected Property**: Single source of truth for domain types with 100% TypeScript type check compliance.
- **Validation Method**: Run `npx tsc --project tsconfig.app.json --noEmit`.
- **Expected Evidence**: Clean compiler pass (0 errors).
- **Regression Risks**: Low.

---

### FINDING-CEBUS-006: Severe Test Coverage Deficit (0% Business Logic & Rules Coverage)

#### Finding Details
- **ID**: `FINDING-CEBUS-006`
- **Severity**: `MEDIUM`
- **Category**: Test & Verification Quality
- **File**: 
  - `package.json`
  - `src/nucleo/servicos/*`
  - `firestore.rules`
- **Line**: Entire business logic service layer
- **Evidence**:
  1. `npx vitest run` reports 9 test files and 45 tests passing with 100% success.
  2. Audit of test files reveals coverage is restricted to simple static helpers (`validarCNPJ`, `gerarId`, `formatarTelefone`) and basic UI component render tests (`Botao.test.tsx`, `Campo.test.tsx`).
  3. `0` unit or integration tests exist for: `servicoEstoque.ts`, `servicoEntrada.ts`, `servicoSaida.ts`, `servicoMovimentacao.ts`, `servicoDistribuicao.ts`, `servicoAuth.ts`, `servicoUsuarios.ts`, `servicoLog.ts`.
  4. `0` security rules tests exist for `firestore.rules` (missing `@firebase/rules-unit-testing`).
- **Root Cause**: Initial test setup focused on superficial green metrics rather than coverage of high-risk business logic and domain invariants.
- **Impact**: Total lack of regression protection for critical inventory rules (`INV-01`, `INV-02`) and security boundaries; false sense of security provided by passing test command.
- **Exploit/Failure Scenario**: A developer modifies `servicoEstoque.ts` and breaks negative stock prevention. `npm test` completes with 100% green status because no test calls `servicoEstoque.ts`, masking the critical regression.
- **Confidence**: 100% (File listing verification)
- **Source Reliability**: Direct repository test suite inventory
- **Status**: `VERIFIED FINDING` / `OPEN`

#### Remediation Plan
- **Root Cause**: Unimplemented test suites for core business services and Firestore rules.
- **Method**: Implement comprehensive Vitest unit/integration test suites for all services in `src/nucleo/servicos/` and integrate `@firebase/rules-unit-testing` for `firestore.rules`.
- **Affected Files**:
  - `src/nucleo/servicos/*.test.ts` (NEW)
  - `firestore.rules.test.ts` (NEW)
  - `package.json`
- **Expected Property**: Business logic, stock invariants (`INV-01`, `INV-02`), and security rules protected by automated tests.
- **Validation Method**: Run `npm run coverage`.
- **Expected Evidence**: >85% statement & branch coverage on `src/nucleo/servicos/` and 100% rule path coverage.
- **Regression Risks**: None.
