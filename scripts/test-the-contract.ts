import * as fs from 'fs';
import { execSync } from 'child_process';

const TARGET_CONTRACT = 'EOS/docs/architecture/EOS_FINAL_ARCHITECTURAL_CONTRACT.md';
const origContract = fs.readFileSync(TARGET_CONTRACT, 'utf-8');

function restoreAll() {
  fs.writeFileSync(TARGET_CONTRACT, origContract);
}

function runGovernance(): boolean {
  try {
    execSync('npm test', { stdio: 'ignore' });
    return true; // PASS
  } catch (err) {
    return false; // FAIL
  }
}

async function runScenario(id: string, description: string, mutate: () => void, expectPass: boolean) {
  console.log(`\n▶ CONTRACT ATTACK ${id}: ${description}`);
  try {
    mutate();
    const passed = runGovernance();
    
    if (passed === expectPass) {
      console.log(`  ✔ SUCCESS: Expected ${expectPass ? 'PASS' : 'FAIL'}, got ${passed ? 'PASS' : 'FAIL'}.`);
      if (expectPass) {
         console.log('  ⚠️ The system could NOT detect the contractual tampering! (Gap Confirmed)');
      } else {
         console.log('  🛡️ The system DETECTED the contractual tampering! (Enforcement Confirmed)');
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
  console.log('  🛡️ TEST-THE-CONTRACT (ARCHITECTURAL CONTRACT INTEGRITY)');
  console.log('======================================================');

  // C1: Remove a rule from the contract
  await runScenario('C1', 'Remove a rule (INV-001) from the Contract', () => {
    const mutated = origContract.replace(/INV-001/g, 'REMOVED-001');
    fs.writeFileSync(TARGET_CONTRACT, mutated);
  }, false); // Should FAIL because phase-3-2-0 test enforces INV-001 is referenced

  // C2: Alter a status of VERIFIED
  await runScenario('C2', 'Alter a status of VERIFIED to NOT_VERIFIED', () => {
    // If we just change text, the regex test might still find the string, but let's test if the specific line is checked.
    // Our test just checks `.includes('INV-001')`. It doesn't check the matrix deeply. So changing VERIFIED to NOT_VERIFIED will PASS.
    const mutated = origContract.replace(/VERIFIED/g, 'NOT_VERIFIED');
    fs.writeFileSync(TARGET_CONTRACT, mutated);
  }, true); // Will PASS (Gap) because the test isn't perfectly parsing markdown tables.

  // C3: Remove a test reference
  await runScenario('C3', 'Remove Governance Gate Reference', () => {
    const mutated = origContract.replace(/Gate 0.1/g, 'Gate 9.9');
    fs.writeFileSync(TARGET_CONTRACT, mutated);
  }, false); // Should FAIL because phase-3-2-0 test expects "Gate 0.1"

  // C5: Remove a Trust Boundary Limitation
  await runScenario('C5', 'Remove Trust Boundary Limitation', () => {
    const mutated = origContract.replace(/Root\/Administrator compromise/g, 'Hacked');
    fs.writeFileSync(TARGET_CONTRACT, mutated);
  }, false); // Should FAIL because phase-3-2-0 test enforces this exact string.

  console.log('\n======================================================');
  console.log('  🏁 CONTRACT AUDIT COMPLETE.');
  console.log('======================================================');
}

runAll().catch(console.error);
