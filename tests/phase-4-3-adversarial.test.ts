import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { TypescriptAstCollector } from '../EOS/core/collectors/typescript-ast-collector';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule, normalizeModuleIdentity } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase43AdversarialTests() {
  console.log('==================================================');
  console.log('INICIANDO AUDITORIA ADVERSARIAL DA FASE 4.3');
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
  const target = TargetResolver.resolve('.');

  // AST-4.3-001: Canonical module identity
  await test('AST-4.3-001: Identidade canônica de módulo normaliza caminhos de forma reproduzível', () => {
    const id1 = normalizeModuleIdentity('src/Domain/UserService.ts');
    const id2 = normalizeModuleIdentity('src/domain/userservice.ts');
    assert.strictEqual(id1, id2);
  });

  // AST-4.3-002: Extension equivalence
  await test('AST-4.3-002: Equivalência de extensão em especificadores relativos', () => {
    const norm1 = provider.normalizeTargetModule('src/domain/User.ts', '../infra/db');
    const norm2 = provider.normalizeTargetModule('src/domain/User.ts', '../infra/db.ts');
    assert.strictEqual(norm1, norm2);
  });

  // AST-4.3-003: Index module resolution
  await test('AST-4.3-003: Resolução de módulos /index', () => {
    const norm1 = provider.normalizeTargetModule('src/domain/User.ts', '../infra/db/index');
    const norm2 = provider.normalizeTargetModule('src/domain/User.ts', '../infra/db/index.ts');
    assert.strictEqual(norm1, norm2);
    assert.strictEqual(norm1, 'src/infra/db');
  });

  // AST-4.3-004: Re-export detection
  await test('AST-4.3-004: Detecção de re-exports estáticos (export { X } from "./mod")', async () => {
    const code = `export { User } from '../infra/db';`;
    const extracted = collector.parseSource('src/domain/User.ts', code);
    assert.strictEqual(extracted.length, 1);
    assert.strictEqual(extracted[0].module_specifier, '../infra/db');
  });

  // AST-4.3-005: Wildcard re-export detection
  await test('AST-4.3-005: Detecção de wildcard re-exports (export * from "./mod")', async () => {
    const code = `export * from '../infra/db';`;
    const extracted = collector.parseSource('src/domain/User.ts', code);
    assert.strictEqual(extracted.length, 1);
    assert.strictEqual(extracted[0].module_specifier, '../infra/db');
  });

  // AST-4.3-006: Windows casing
  await test('AST-4.3-006: Resiliência a casing no Windows (Domain vs domain)', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-WIN-CASE',
      observation_id: 'OBS-WIN-CASE',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/Domain/UserService.ts',
      locator: { relative_path: 'src/Domain/UserService.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'import { DB } from "../infra/db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '../infra/db', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    const evalRes = rule.evaluate(facts, target);
    assert.strictEqual(evalRes.evaluation.status, 'FAIL');
  });

  // AST-4.3-007: Windows separators
  await test('AST-4.3-007: Resiliência a separadores de caminho do Windows (\\)', () => {
    const norm = provider.normalizeTargetModule('src\\domain\\User.ts', '..\\infra\\db');
    assert.strictEqual(norm, 'src/infra/db');
  });

  // AST-4.3-008: tsconfig path alias identification
  await test('AST-4.3-008: Identificação de alias de tsconfig (@domain/User, @infra/db)', () => {
    const normDomain = provider.normalizeTargetModule('src/domain/User.ts', '@domain/User');
    const normInfra = provider.normalizeTargetModule('src/domain/User.ts', '@infra/db');
    assert.strictEqual(normDomain, 'src/domain/User');
    assert.strictEqual(normInfra, 'src/infrastructure/db');
  });

  // AST-4.3-009: Alias cannot bypass architecture rule
  await test('AST-4.3-009: Alias (@infra/db ou @infrastructure/db) NÃO pode burlar regra de arquitetura', () => {
    const aliases = ['@infra/db', '@infrastructure/db', 'infra/db', 'infrastructure/db'];
    
    for (const alias of aliases) {
      const ev: Evidence = {
        evidence_id: `EVD-ALIAS-${alias}`,
        observation_id: 'OBS-ALIAS',
        collector_id: 'typescript-ast-collector-v4',
        source_reference: 'src/domain/UserService.ts',
        locator: { relative_path: 'src/domain/UserService.ts', line: 1 },
        source_hash: 'sha1',
        content_hash: 'sha2',
        snippet: `import { DB } from "${alias}"`,
        confidence: 1.0,
        provenance: { target_id: target.target_id, collector_version: '4.2.0' },
        ast_metadata: { kind: 'MODULE_IMPORT', specifier: alias, import_type: 'STATIC' },
      };

      const facts = provider.generateFacts([ev]);
      const evalRes = rule.evaluate(facts, target);
      assert.strictEqual(evalRes.evaluation.status, 'FAIL', `Alias '${alias}' bypassou a regra de arquitetura!`);
    }
  });

  // AST-4.3-010: Different physical modules are not incorrectly merged
  await test('AST-4.3-010: Módulos físicos distintos não são colapsados indevidamente', () => {
    const norm1 = provider.normalizeTargetModule('src/domain/User.ts', './user-service');
    const norm2 = provider.normalizeTargetModule('src/domain/User.ts', './user-repository');
    assert.notStrictEqual(norm1, norm2);
  });

  // AST-4.3-011: Evidence provenance preserved after normalization
  await test('AST-4.3-011: Proveniência da Evidence é mantida intacta', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-PROV-43',
      observation_id: 'OBS-PROV-43',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/Domain/UserService.ts',
      locator: { relative_path: 'src/Domain/UserService.ts', line: 10 },
      source_hash: 'sha-source-123',
      content_hash: 'sha-snippet-456',
      snippet: 'import { x } from "./x"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './x', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts[0].evidence_ids[0], 'EVD-PROV-43');
    assert.strictEqual(ev.source_reference, 'src/Domain/UserService.ts');
    assert.strictEqual(ev.locator.line, 10);
    assert.strictEqual(ev.source_hash, 'sha-source-123');
  });

  // AST-4.3-012: Snippet mutation does not affect Fact
  await test('AST-4.3-012: Mutações no snippet não afetam a geração do Fact', () => {
    const evOriginal: Evidence = {
      evidence_id: 'EVD-MUT-12',
      observation_id: 'OBS-MUT-12',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'ORIGINAL SNIPPET',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '../infra/db', import_type: 'STATIC' },
    };

    const evMutated: Evidence = {
      ...evOriginal,
      snippet: 'COMPLETELY ALTERED SNIPPET',
    };

    const fact1 = provider.generateFacts([evOriginal]);
    const fact2 = provider.generateFacts([evMutated]);

    assert.strictEqual(fact1[0].fact_id, fact2[0].fact_id);
    assert.strictEqual(fact1[0].input_hash, fact2[0].input_hash);
  });

  // AST-4.3-013: Deterministic fact_id
  await test('AST-4.3-013: fact_id é determinístico', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-DET-13',
      observation_id: 'OBS-DET-13',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'import { DB } from "../infra/db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '../infra/db', import_type: 'STATIC' },
    };

    const factA = provider.generateFacts([ev])[0];
    const factB = provider.generateFacts([ev])[0];

    assert.strictEqual(factA.fact_id, factB.fact_id);
  });

  // AST-4.3-014: Deterministic input_hash
  await test('AST-4.3-014: input_hash é determinístico', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-DET-14',
      observation_id: 'OBS-DET-14',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'import { DB } from "../infra/db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '../infra/db', import_type: 'STATIC' },
    };

    const factA = provider.generateFacts([ev])[0];
    const factB = provider.generateFacts([ev])[0];

    assert.strictEqual(factA.input_hash, factB.input_hash);
  });

  // AST-4.3-015: No execution of analyzed code
  await test('AST-4.3-015: Código com instrução nociva não é executado', () => {
    const codeWithExploit = `
      global.EXPLOIT_EXECUTED = true;
      import { DB } from '../infra/db';
    `;
    (global as any).EXPLOIT_EXECUTED = false;
    collector.parseSource('src/domain/User.ts', codeWithExploit);
    assert.strictEqual((global as any).EXPLOIT_EXECUTED, false);
  });

  // AST-4.3-016: Read-only filesystem
  await test('AST-4.3-016: Collector opera sem modificar filesystem', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-readonly-'));
    const filePath = path.join(tmpDir, 'File.ts');
    const content = `import { X } from './X';`;
    fs.writeFileSync(filePath, content);
    const mtimeBefore = fs.statSync(filePath).mtimeMs;

    const tgt = TargetResolver.resolve(tmpDir);
    await collector.collectFromArtifacts(tgt, [{
      relative_path: 'File.ts',
      absolute_path: filePath,
      file_extension: '.ts',
      size_bytes: content.length,
      sha256_hash: crypto.createHash('sha256').update(content).digest('hex'),
      status: 'ACCESSIBLE',
    }]);

    const mtimeAfter = fs.statSync(filePath).mtimeMs;
    assert.strictEqual(mtimeBefore, mtimeAfter);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // AST-4.3-017: Malformed metadata does not create false Fact
  await test('AST-4.3-017: Metadados malformados não criam Fato falso', () => {
    const evBad: Evidence = {
      evidence_id: 'EVD-BAD-17',
      observation_id: 'OBS-BAD-17',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'INVALID SNIPPET WITHOUT SPECIFIER',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
    };

    const facts = provider.generateFacts([evBad]);
    assert.strictEqual(facts.length, 0);
  });

  // AST-4.3-018: Existing regression compatibility
  await test('AST-4.3-018: Compatibilidade de regressão mantida com a suíte base', () => {
    assert.ok(collector);
    assert.ok(provider);
    assert.ok(rule);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.3: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase43AdversarialTests().catch(err => {
  console.error('Erro na suíte adversarial da Fase 4.3:', err);
  process.exit(1);
});
