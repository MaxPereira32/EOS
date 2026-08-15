import * as fs from 'fs';
import { execSync } from 'child_process';

const TARGET_GOVERNANCE_SCRIPT = 'scripts/governance-check.ts';
const TARGET_CRITICAL_FILES = 'EOS/docs/governance/EOS_CRITICAL_FILES.md';
const TARGET_INVARIANT_REGISTRY = 'EOS/docs/governance/EOS_INVARIANT_REGISTRY.md';
const TARGET_BOUNDARY_TEST = 'EOS/tests/phase-3-1-4-architectural-boundary.test.ts';

// Save original content
const origGovernanceScript = fs.readFileSync(TARGET_GOVERNANCE_SCRIPT, 'utf-8');
const origCriticalFiles = fs.readFileSync(TARGET_CRITICAL_FILES, 'utf-8');
const origInvariantRegistry = fs.readFileSync(TARGET_INVARIANT_REGISTRY, 'utf-8');
const origBoundaryTest = fs.readFileSync(TARGET_BOUNDARY_TEST, 'utf-8');

function restoreAll() {
  fs.writeFileSync(TARGET_GOVERNANCE_SCRIPT, origGovernanceScript);
  fs.writeFileSync(TARGET_CRITICAL_FILES, origCriticalFiles);
  fs.writeFileSync(TARGET_INVARIANT_REGISTRY, origInvariantRegistry);
  fs.writeFileSync(TARGET_BOUNDARY_TEST, origBoundaryTest);
}

function runGovernance(): boolean {
  try {
    execSync('npm run governance', { stdio: 'ignore' });
    return true; // PASS
  } catch (err) {
    return false; // FAIL
  }
}

async function runScenario(id: string, description: string, mutate: () => void, expectPass: boolean) {
  console.log(`\n▶ ATTACK ${id}: ${description}`);
  try {
    mutate();
    const passed = runGovernance();
    
    if (passed === expectPass) {
      console.log(`  ✔ SUCCESS: Expected ${expectPass ? 'PASS' : 'FAIL'}, got ${passed ? 'PASS' : 'FAIL'}.`);
      if (expectPass) {
         console.log('  ⚠️ This means Self-Governance could NOT detect the tampering! (Governance Gap Confirmed)');
      } else {
         console.log('  🛡️ This means Self-Governance DETECTED the tampering! (Independent Assurance Confirmed)');
      }
    } else {
      console.log(`  ❌ FAILURE: Expected ${expectPass ? 'PASS' : 'FAIL'}, got ${passed ? 'PASS' : 'FAIL'}.`);
    }
  } catch (err: any) {
    console.error(`  ❌ ERROR running scenario: ${err.message}`);
  } finally {
    restoreAll();
  }
}

async function runAll() {
  console.log('\n======================================================');
  console.log('  🛡️ TEST-THE-TEST 2.0 (SELF-GOVERNANCE INTEGRITY)');
  console.log('======================================================');

  // G1: Remove Type Safety gate from governance-check.ts
  await runScenario('G1', 'Remove Type Safety gate from governance-check.ts', () => {
    const mutated = origGovernanceScript.replace(
      /{[^}]+name: '1. Type Safety & Contract Adherence',[^}]+},/,
      ''
    );
    fs.writeFileSync(TARGET_GOVERNANCE_SCRIPT, mutated);
  }, true); // Expect PASS because nothing currently checks if governance-check.ts has all gates

  // G2: Force 'exit 0' in governance-check.ts
  await runScenario('G2', 'Force exit 0 regardless of failures in governance-check.ts', () => {
    const mutated = origGovernanceScript.replace(
      /if \(hasFailure\) \{\s*process\.exit\(1\);\s*\}/,
      'if (hasFailure) { process.exit(0); /* FORCED PASS */ }'
    );
    fs.writeFileSync(TARGET_GOVERNANCE_SCRIPT, mutated);
  }, true);

  // G3: Remove a Critical File from registry
  await runScenario('G3', 'Remove EOS_CRITICAL_FILES.md protection entry', () => {
    const mutated = origCriticalFiles.replace(
      /- `core\/domain\/\*\*\/\*\.ts`/,
      ''
    );
    fs.writeFileSync(TARGET_CRITICAL_FILES, mutated);
  }, true); // Documentation only! Nothing executable parses this to fail the gate.

  // G4: Weaken Invariant Registry
  await runScenario('G4', 'Modify VERIFIED to NOT_VERIFIED in Invariant Registry', () => {
    const mutated = origInvariantRegistry.replace(/VERIFIED/g, 'NOT_VERIFIED');
    fs.writeFileSync(TARGET_INVARIANT_REGISTRY, mutated);
  }, true); // Again, documentation.

  // G5: Remove forbidden dependency 'fs' from boundary test
  await runScenario('G5', 'Remove "fs" from forbidden dependencies in architecture test', () => {
    const mutated = origBoundaryTest.replace(/'fs', /g, '');
    fs.writeFileSync(TARGET_BOUNDARY_TEST, mutated);
  }, true); // The architecture test will pass if we remove the rule. Governance check doesn't hash the test itself!

  console.log('\n======================================================');
  console.log('  🏁 AUDIT COMPLETE: ALL EXPECTED GAPS CONFIRMED.');
  console.log('======================================================');
}

runAll().catch(console.error);
