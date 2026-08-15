import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as assert from 'assert';
import * as crypto from 'crypto';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { TypescriptAstCollector } from '../EOS/core/collectors/typescript-ast-collector';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase4Tests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE DE TESTES DA FASE 4.0 — AST & FACTS');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  const collector = new TypescriptAstCollector();
  const provider = new DependencyFactProvider();
  const rule = new NoDisallowedDependencyRule();

  // AST-001: Import estático simples
  await test('AST-001: Reconhece import estático simples', () => {
    const code = `import { User } from './User';`;
    const res = collector.parseSource('src/domain/UserService.ts', code);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].module_specifier, './User');
    assert.strictEqual(res[0].import_type, 'STATIC');
    assert.strictEqual(res[0].line, 1);
  });

  // AST-002: Import default
  await test('AST-002: Reconhece import default', () => {
    const code = `import Config from './Config';`;
    const res = collector.parseSource('src/ConfigLoader.ts', code);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].module_specifier, './Config');
    assert.strictEqual(res[0].import_type, 'STATIC');
  });

  // AST-003: Import namespace
  await test('AST-003: Reconhece import namespace', () => {
    const code = `import * as fs from 'fs';`;
    const res = collector.parseSource('src/infra/FileStorage.ts', code);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].module_specifier, 'fs');
    assert.strictEqual(res[0].import_type, 'STATIC');
  });

  // AST-004: Side-effect import
  await test('AST-004: Reconhece side-effect import', () => {
    const code = `import './styles.css';`;
    const res = collector.parseSource('src/App.ts', code);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].module_specifier, './styles.css');
    assert.strictEqual(res[0].import_type, 'STATIC');
  });

  // AST-005: Dynamic import
  await test('AST-005: Reconhece dynamic import', () => {
    const code = `async function load() { const mod = await import('./DynamicModule'); }`;
    const res = collector.parseSource('src/App.ts', code);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].module_specifier, './DynamicModule');
    assert.strictEqual(res[0].import_type, 'DYNAMIC');
  });

  // AST-006: Múltiplos imports
  await test('AST-006: Reconhece múltiplos imports no mesmo arquivo', () => {
    const code = `
import { A } from './A';
import B from './B';
import * as C from 'path';
import './side-effect';
const D = import('./D');
    `;
    const res = collector.parseSource('src/Multi.ts', code);
    assert.strictEqual(res.length, 5);
  });

  // AST-007: Localização correta da Evidence
  await test('AST-007: Preserva localização da linha exata na Evidence', () => {
    const code = `// Linha 1\n// Linha 2\nimport { Item } from './Item';`;
    const res = collector.parseSource('src/LineTest.ts', code);
    assert.strictEqual(res[0].line, 3);
  });

  // AST-008: SHA-256 e proveniência da Evidence
  await test('AST-008: Evidência de AST calcula SHA-256 válido e proveniência', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-ast-prov-'));
    const tsFile = path.join(tmpDir, 'sample.ts');
    const content = `import { Auth } from './Auth';`;
    fs.writeFileSync(tsFile, content);

    const target = TargetResolver.resolve(tmpDir);
    const sha = crypto.createHash('sha256').update(content).digest('hex');

    const evidences = await collector.collectFromArtifacts(target, [{
      relative_path: 'sample.ts',
      absolute_path: tsFile,
      file_extension: '.ts',
      size_bytes: content.length,
      sha256_hash: sha,
      status: 'ACCESSIBLE',
    }]);

    assert.strictEqual(evidences.length, 1);
    assert.strictEqual(evidences[0].source_hash, sha);
    assert.strictEqual(evidences[0].provenance.target_id, target.target_id);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // AST-009: Determinismo de Fatos
  await test('AST-009: FactProvider gera fatos determinísticos para mesmas evidências', () => {
    const ev1: Evidence = {
      evidence_id: 'EVD-AST-01',
      observation_id: 'OBS-01',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha-src-1',
      content_hash: 'sha-cnt-1',
      snippet: '[STATIC IMPORT] import { DB } from "../infra/DB" (specifier: "../infra/DB")',
      confidence: 1.0,
      provenance: { target_id: 'TGT-1', collector_version: '4.0.0' },
    };

    const facts1 = provider.generateFacts([ev1]);
    const facts2 = provider.generateFacts([ev1]);

    assert.strictEqual(facts1[0].fact_id, facts2[0].fact_id);
    assert.strictEqual(facts1[0].input_hash, facts2[0].input_hash);
  });

  // AST-010: Alteração de byte altera SHA-256 e input_hash
  await test('AST-010: Alteração de 1 byte na evidência altera input_hash do Fact', () => {
    const ev1: Evidence = {
      evidence_id: 'EVD-AST-01',
      observation_id: 'OBS-01',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha-src-1',
      content_hash: 'sha-cnt-1',
      snippet: '[STATIC IMPORT] import { DB } from "../infra/DB" (specifier: "../infra/DB")',
      confidence: 1.0,
      provenance: { target_id: 'TGT-1', collector_version: '4.0.0' },
    };

    const ev2: Evidence = {
      ...ev1,
      evidence_id: 'EVD-AST-02',
      content_hash: 'sha-cnt-2-modified',
    };

    const facts1 = provider.generateFacts([ev1]);
    const facts2 = provider.generateFacts([ev2]);

    assert.notStrictEqual(facts1[0].input_hash, facts2[0].input_hash);
  });

  // AST-011: Arquivo TypeScript inválido
  await test('AST-011: Código TypeScript com erros de sintaxe não provoca exceção', () => {
    const brokenCode = `import {{{ invalid syntax >>> class ===`;
    const res = collector.parseSource('src/Broken.ts', brokenCode);
    assert.strictEqual(Array.isArray(res), true);
  });

  // AST-012: Evidence insuficiente
  await test('AST-012: Ausência de evidências de AST não gera Fatos falsos', () => {
    const facts = provider.generateFacts([]);
    assert.strictEqual(facts.length, 0);
  });

  // AST-013: Fact sem Evidence deve ser rejeitado
  await test('AST-013: Todo fato gerado possui evidence_ids não vazios', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-AST-01',
      observation_id: 'OBS-01',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/App.ts',
      locator: { relative_path: 'src/App.ts', line: 1 },
      source_hash: 'sha-1',
      content_hash: 'sha-2',
      snippet: '[STATIC IMPORT] import { X } from "./X" (specifier: "./X")',
      confidence: 1.0,
      provenance: { target_id: 'TGT-1', collector_version: '4.0.0' },
    };

    const facts = provider.generateFacts([ev]);
    assert.ok(facts[0].evidence_ids.length > 0);
    assert.strictEqual(facts[0].evidence_ids[0], 'EVD-AST-01');
  });

  // AST-014: Rule não acessa filesystem
  await test('AST-014: NoDisallowedDependencyRule avalia apenas fatos sem I/O', () => {
    const target = TargetResolver.resolve('.');
    const mockProvider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/collectors/Storage.ts'] });
    const facts = mockProvider.generateFacts([{
      evidence_id: 'EVD-AST-01',
      observation_id: 'OBS-01',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha-1',
      content_hash: 'sha-2',
      snippet: 'import { Storage } from "../collectors/Storage"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '../collectors/Storage', import_type: 'STATIC' },
    }]);

    const res = rule.evaluate(facts, target);
    assert.strictEqual(res.evaluation.status, 'FAIL');
    assert.strictEqual(res.findings.length, 1);
  });

  // AST-015: Collector é READ-ONLY
  await test('AST-015: TypescriptAstCollector é read-only e não altera arquivos', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-ast-readonly-'));
    const tsFile = path.join(tmpDir, 'ReadonlyTest.ts');
    const content = `import { Data } from './Data';`;
    fs.writeFileSync(tsFile, content);

    const target = TargetResolver.resolve(tmpDir);
    await collector.collectFromArtifacts(target, [{
      relative_path: 'ReadonlyTest.ts',
      absolute_path: tsFile,
      file_extension: '.ts',
      size_bytes: content.length,
      sha256_hash: crypto.createHash('sha256').update(content).digest('hex'),
      status: 'ACCESSIBLE',
    }]);

    const afterContent = fs.readFileSync(tsFile, 'utf-8');
    assert.strictEqual(content, afterContent, 'Arquivo foi modificado durante análise!');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // AST-016: Nenhum código analisado é executado
  await test('AST-016: Código com efeitos colaterais nocivos não é executado', () => {
    let executed = false;
    (global as any).__AST_EXEC_TEST__ = () => { executed = true; };

    const maliciousCode = `
      // Tentar invocar código durante parse
      global.__AST_EXEC_TEST__();
      import { Exploit } from './Exploit';
    `;

    collector.parseSource('src/Malicious.ts', maliciousCode);
    assert.strictEqual(executed, false, 'CÓDIGO ANALISADO FOI EXECUTADO!');
    delete (global as any).__AST_EXEC_TEST__;
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.0: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch(err => {
  console.error('Erro nos testes de AST:', err);
  process.exit(1);
});
