import { GovernorIntegrityVerifier } from '../core/utils/governor-integrity-verifier';
import { HardQualityGateEngine } from '../core/engines/hard-quality-gate-engine';
import * as path from 'path';

async function runSelfGovernanceChecks() {
  console.log('======================================================');
  console.log('  🛡️ EOS SELF-GOVERNANCE & GOVERNOR INTEGRITY CHECK');
  console.log('======================================================\n');

  const verifier = new GovernorIntegrityVerifier();
  const coreDir = path.resolve(__dirname, '../core');
  const integrityRes = verifier.verifyGovernorIntegrity(coreDir);

  console.log(`- Checked Core Files: ${integrityRes.checkedFilesCount}`);
  console.log(`- Integrity Status:  ${integrityRes.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`- Rationale:         ${integrityRes.rationale}`);

  const hardGateEngine = new HardQualityGateEngine();
  const gateRes = hardGateEngine.evaluateHardGates([], [], integrityRes.isValid, 100);

  console.log(`- Overall Phase Status: [ ${gateRes.overall_phase_status} ]`);

  if (!integrityRes.isValid || gateRes.overall_phase_status !== 'GREEN') {
    console.error('\n💥 GOVERNANCE TAMPERING OR INTEGRITY VIOLATION DETECTED!');
    process.exit(1);
  } else {
    console.log('\n✅ GOVERNANCE INTEGRITY VERIFIED: EOS Governor core is intact and self-governed.');
  }
}

runSelfGovernanceChecks().catch(err => {
  console.error('[-] Error executing self-governance checks:', err);
  process.exit(1);
});
