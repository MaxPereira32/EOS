import { test, describe } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

describe('EOS Phase 3.1.4 — Architectural Boundary Enforcement Suite', () => {
  const CORE_DIR = path.join(process.cwd(), 'EOS', 'core');

  function getFilesRecursively(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getFilesRecursively(filePath, fileList);
      } else if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  function detectForbiddenImports(filePath: string, forbiddenModules: string[]): string[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const violations: string[] = [];

    // Regex to match "import ... from 'module'" or "import * as name from 'module'" or "require('module')"
    const importRegex = /^(?:import\s+.*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|.*require\(['"]([^'"]+)['"]\))/;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(importRegex);
      if (match) {
        const moduleName = match[1] || match[2] || match[3];
        if (moduleName) {
          // Check if moduleName matches exactly or is a sub-module (e.g., fs/promises)
          if (forbiddenModules.some(fm => moduleName === fm || moduleName.startsWith(`${fm}/`))) {
            violations.push(`Line ${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
    }
    return violations;
  }

  test('1. DOMAIN BOUNDARY — core/domain MUST NOT import Infrastructure modules (fs, path, child_process)', () => {
    const domainDir = path.join(CORE_DIR, 'domain');
    const tsFiles = getFilesRecursively(domainDir);
    const forbidden = ['fs', 'path', 'child_process']; // Note: crypto is P3 debt, so we allow it temporarily or restrict to DEBT-001.

    const allViolations: { file: string; violations: string[] }[] = [];

    for (const file of tsFiles) {
      const violations = detectForbiddenImports(file, forbidden);
      if (violations.length > 0) {
        allViolations.push({ file, violations });
      }
    }

    if (allViolations.length > 0) {
      const errorMessage = allViolations.map(v => `\nFile: ${v.file}\n${v.violations.join('\n')}`).join('');
      assert.fail(`ARCHITECTURAL_VIOLATION: Encontradas dependências proibidas em core/domain:\n${errorMessage}`);
    }
  });

  test('2. RULES BOUNDARY — core/rules MUST NOT import concrete infrastructure (fs, child_process)', () => {
    const rulesDir = path.join(CORE_DIR, 'rules');
    if (!fs.existsSync(rulesDir)) return;
    
    const tsFiles = getFilesRecursively(rulesDir);
    const forbidden = ['fs', 'child_process']; 

    const allViolations: { file: string; violations: string[] }[] = [];

    for (const file of tsFiles) {
      const violations = detectForbiddenImports(file, forbidden);
      if (violations.length > 0) {
        allViolations.push({ file, violations });
      }
    }

    if (allViolations.length > 0) {
      const errorMessage = allViolations.map(v => `\nFile: ${v.file}\n${v.violations.join('\n')}`).join('');
      assert.fail(`ARCHITECTURAL_VIOLATION: Encontradas dependências proibidas em core/rules:\n${errorMessage}`);
    }
  });

  test('3. ADVERSARIAL — Teste Negativo garante que a detecção funciona (Mock injection)', () => {
    const mockFile = path.join(process.cwd(), '.tmp-mock-domain-file.ts');
    fs.writeFileSync(mockFile, "import * as fs from 'fs';\nimport { exec } from 'child_process';\nexport const x = 1;", 'utf8');

    try {
      const violations = detectForbiddenImports(mockFile, ['fs', 'child_process']);
      assert.strictEqual(violations.length, 2, 'O teste não detectou os imports proibidos na fixture.');
      assert.ok(violations[0].includes('import * as fs'));
      assert.ok(violations[1].includes('child_process'));
    } finally {
      fs.unlinkSync(mockFile);
    }
  });
});
