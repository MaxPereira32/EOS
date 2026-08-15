import { execSync } from 'child_process';
import * as path from 'path';

console.log('\n================================================================');
console.log('  🛡️ EOS CHANGE-CONTROL CLASSIFIER');
console.log('================================================================\n');

function getModifiedFiles(): string[] {
  try {
    const stdout = execSync('git status --short', { encoding: 'utf-8' });
    return stdout
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.trim().substring(2).trim());
  } catch (err) {
    console.error('Failed to run git status', err);
    return [];
  }
}

function classifyFile(filePath: string): string {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');

  if (normalized.includes('docs/') && !normalized.includes('governance/')) {
    return 'CLASS A';
  }

  const classDPaths = [
    'core/domain/',
    'core/engines/',
    'scripts/governance-check.ts',
    'core/services/repository-identity-registry.ts',
    'core/utils/governor-integrity-verifier.ts',
    'docs/governance/'
  ];

  if (classDPaths.some(p => normalized.includes(p))) {
    return 'CLASS D';
  }

  const classCPaths = [
    'core/storage/',
    'core/adapters/',
    'core/orchestration/'
  ];

  if (classCPaths.some(p => normalized.includes(p))) {
    return 'CLASS C';
  }

  // Fallback for logic changes, tests, etc.
  return 'CLASS B';
}

function main() {
  const files = getModifiedFiles();
  if (files.length === 0) {
    console.log('✅ No files modified. Zero-drift baseline.');
    return;
  }

  const results = files.map(file => {
    const changeClass = classifyFile(file);
    return {
      File: file,
      Class: changeClass,
      Gates: changeClass === 'CLASS A' ? 'PR Review' : 'Full Governance Pipeline'
    };
  });

  console.table(results);

  const hasCriticalChanges = results.some(r => r.Class === 'CLASS C' || r.Class === 'CLASS D');
  if (hasCriticalChanges) {
    console.log('⚠️ CRITICAL CHANGES DETECTED (Class C/D). Strict Governance Execution Required.');
  }

  // This script just maps and classifies. It doesn't fail unless there's an internal error.
  process.exit(0);
}

main();
