import { spawn } from 'child_process';
import * as os from 'os';

console.log('\n======================================================');
console.log('  🛡️ EOS SUPREME GOVERNANCE GATE (PHASE 3.1.5)');
console.log('======================================================\n');

const STEPS = [
  {
    name: '0.1. Architectural Drift Detection',
    command: 'npm',
    args: ['run', 'drift-check']
  },
  {
    name: '0.2. Change-Control Verification',
    command: 'npm',
    args: ['run', 'change-control-check']
  },
  {
    name: '1. Type Safety & Contract Adherence',
    command: 'node',
    args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit']
  },
  {
    name: '2. Architectural Boundary Verification',
    command: 'node',
    args: ['node_modules/tsx/dist/cli.mjs', '--test', 'EOS/tests/phase-3-1-4-architectural-boundary.test.ts']
  },
  {
    name: '3. Invariant Regression Verification',
    command: 'node',
    args: ['node_modules/tsx/dist/cli.mjs', '--test', 'EOS/tests/phase-3-1-5-invariant-regression.test.ts']
  },
  {
    name: '4. Native Core & Identity Suites',
    command: 'npm',
    args: ['run', 'test']
  },
  {
    name: '5. Self-Governance Engine Verification',
    command: 'npm',
    args: ['run', 'self-governance']
  }
];

interface GateResult {
  gate: string;
  command: string;
  result: 'PASS' | 'FAIL' | 'BLOCKED';
  exitCode: number | null;
  durationMs: number;
}

const results: GateResult[] = [];
let hasFailure = false;

function spawnAsync(command: string, args: string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
      shell: true
    });
    child.on('close', code => resolve(code));
    child.on('error', err => reject(err));
  });
}

async function runGates() {
  for (const step of STEPS) {
    console.log(`▶ Executing: ${step.name}`);
    const startTime = Date.now();
    
    let exitCode: number | null = null;
    let resultStatus: 'PASS' | 'FAIL' | 'BLOCKED' = 'PASS';
    
    try {
      exitCode = await spawnAsync(step.command, step.args);
      if (exitCode !== 0) resultStatus = 'FAIL';
    } catch (err: any) {
      console.error(`\n❌ Failed to spawn process: ${err.message}`);
      resultStatus = 'BLOCKED';
    }
    
    const durationMs = Date.now() - startTime;

    results.push({
      gate: step.name,
      command: `${step.command} ${step.args.join(' ')}`,
      result: resultStatus,
      exitCode: exitCode,
      durationMs
    });

    if (resultStatus !== 'PASS') {
      hasFailure = true;
      console.error(`\n❌ [FAIL-CLOSED] Governance Check Failed at: ${step.name}`);
      console.error(`Command that failed: ${step.command} ${step.args.join(' ')}\n`);
      console.error('======================================================');
      console.error('  🚫 GOVERNANCE GATE BLOCKED THE EXECUTION');
      console.error('  A critical regression was detected. Do not bypass.');
      console.error('======================================================\n');
      break;
    } else {
      console.log(`✔ [PASS] ${step.name} (${durationMs}ms)\n`);
    }
  }

  // Print Executive Table
  console.log('\n========================================================================================');
  console.log('  GOVERNANCE GATE EXECUTION SUMMARY');
  console.log('========================================================================================');
  console.table(results.map(r => ({
    Gate: r.gate,
    Command: r.command,
    Result: r.result,
    ExitCode: r.exitCode,
    'Duration(ms)': r.durationMs
  })));
  console.log('========================================================================================\n');

  if (hasFailure) {
    process.exit(1);
  } else {
    console.log('✅ GREEN — VERIFIED\n');
    process.exit(0);
  }
}

runGates().catch(err => {
  console.error('Fatal error in governance gate:', err);
  process.exit(1);
});
