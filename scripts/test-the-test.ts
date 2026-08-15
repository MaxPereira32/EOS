import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const targetFile = path.join(process.cwd(), 'EOS', 'core', 'domain', 'test-violation.ts');

console.log('======================================================');
console.log('  🧪 GOVERNANCE GATE: DETECTION CAPABILITY VERIFICATION');
console.log('======================================================\n');

try {
  console.log('▶ STEP 1: Injecting Violation (Importing concrete fs in core/domain)');
  fs.writeFileSync(targetFile, `import * as fs from 'fs';\nexport const fake = true;`, 'utf8');

  console.log('▶ STEP 2: Running Governance Gate (Expecting Failure)');
  const child = spawnSync('npm', ['run', 'governance'], {
    stdio: 'pipe',
    env: process.env,
    shell: true
  });

  console.log(`▶ Exit Code: ${child.status}`);
  
  if (child.status !== 0) {
    console.log('✅ PASS: Governance Gate correctly BLOCKED the execution!');
  } else {
    console.error('❌ FAIL: Governance Gate allowed a violation to pass!');
    process.exit(1);
  }
} finally {
  console.log('▶ STEP 3: Cleanup (Removing violation)');
  if (fs.existsSync(targetFile)) {
    fs.unlinkSync(targetFile);
  }
}

console.log('\n======================================================');
console.log('  ✅ DETECTION CAPABILITY = VERIFIED');
console.log('======================================================\n');
process.exit(0);
