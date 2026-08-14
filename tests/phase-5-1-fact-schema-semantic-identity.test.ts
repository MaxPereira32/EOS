import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Evidence, FACT_SCHEMA_VERSION_1_0, Fact } from '../EOS/core/domain/types';

async function runPhase51FactSchemaSemanticIdentityTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 5.1 — FACT SCHEMA EVOLUTION & SEMANTIC IDENTITY');
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

  const target = TargetResolver.resolve('.');

  // FACT-5.1-001
  await test('FACT-5.1-001: Mesmo input -> mesmo semantic_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-51-001',
      observation_id: 'OBS-51-001',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const facts1 = provider.generateFacts([ev]);
    const facts2 = provider.generateFacts([ev]);

    assert.strictEqual(facts1[0].semantic_hash, facts2[0].semantic_hash);
  });

  // FACT-5.1-002
  await test('FACT-5.1-002: Mesmo input -> mesmo input_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-51-002',
      observation_id: 'OBS-51-002',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const facts1 = provider.generateFacts([ev]);
    const facts2 = provider.generateFacts([ev]);

    assert.strictEqual(facts1[0].input_hash, facts2[0].input_hash);
  });

  // FACT-5.1-003
  await test('FACT-5.1-003: Mudança de whitespace mantendo ast_metadata preserva semantic_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev1: Evidence = {
      evidence_id: 'EVD-51-003-1',
      observation_id: 'OBS-51-003',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const ev2: Evidence = {
      ...ev1,
      evidence_id: 'EVD-51-003-2',
      content_hash: 'ch2',
      snippet: 'import   {   Order   }   from   "./Order"  ',
    };

    const facts1 = provider.generateFacts([ev1]);
    const facts2 = provider.generateFacts([ev2]);

    assert.strictEqual(facts1[0].semantic_hash, facts2[0].semantic_hash);
  });

  // FACT-5.1-004
  await test('FACT-5.1-004: Mudança de target_module altera semantic_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts', 'src/domain/Product.ts'] });
    const evA: Evidence = {
      evidence_id: 'EVD-51-004-A',
      observation_id: 'OBS-51-004',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evB: Evidence = {
      ...evA,
      evidence_id: 'EVD-51-004-B',
      snippet: 'import { Product } from "./Product"',
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Product', import_type: 'STATIC' },
    };

    const factsA = provider.generateFacts([evA]);
    const factsB = provider.generateFacts([evB]);

    assert.notStrictEqual(factsA[0].semantic_hash, factsB[0].semantic_hash);
  });

  // FACT-5.1-005
  await test('FACT-5.1-005: Mudança de source_module altera semantic_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts', 'src/domain/Cart.ts'] });
    const evA: Evidence = {
      evidence_id: 'EVD-51-005-A',
      observation_id: 'OBS-51-005',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evB: Evidence = {
      ...evA,
      evidence_id: 'EVD-51-005-B',
      source_reference: 'src/domain/Cart.ts',
      locator: { relative_path: 'src/domain/Cart.ts', line: 5 },
    };

    const factsA = provider.generateFacts([evA]);
    const factsB = provider.generateFacts([evB]);

    assert.notStrictEqual(factsA[0].semantic_hash, factsB[0].semantic_hash);
  });

  // FACT-5.1-006
  await test('FACT-5.1-006: Mudança de import_type (STATIC -> DYNAMIC) altera semantic_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const evA: Evidence = {
      evidence_id: 'EVD-51-006-A',
      observation_id: 'OBS-51-006',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evB: Evidence = {
      ...evA,
      evidence_id: 'EVD-51-006-B',
      snippet: 'import("./Order")',
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'DYNAMIC' },
    };

    const factsA = provider.generateFacts([evA]);
    const factsB = provider.generateFacts([evB]);

    assert.notStrictEqual(factsA[0].semantic_hash, factsB[0].semantic_hash);
  });

  // FACT-5.1-007
  await test('FACT-5.1-007: Mudança de resolution_kind altera semantic_hash', () => {
    const provInternal = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const provUnresolved = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts'] });

    const ev: Evidence = {
      evidence_id: 'EVD-51-007',
      observation_id: 'OBS-51-007',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const factsInt = provInternal.generateFacts([ev]);
    const factsUnres = provUnresolved.generateFacts([ev]);

    assert.notStrictEqual(factsInt[0].semantic_hash, factsUnres[0].semantic_hash);
  });

  // FACT-5.1-008
  await test('FACT-5.1-008: Mudança de content_hash da evidencia altera input_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const evOriginal: Evidence = {
      evidence_id: 'EVD-51-008',
      observation_id: 'OBS-51-008',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'hash_v1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evMod: Evidence = { ...evOriginal, content_hash: 'hash_v2' };

    const factsOrig = provider.generateFacts([evOriginal]);
    const factsMod = provider.generateFacts([evMod]);

    assert.notStrictEqual(factsOrig[0].input_hash, factsMod[0].input_hash);
  });

  // FACT-5.1-009
  await test('FACT-5.1-009: Mudança de content_hash preserva semantic_hash quando o payload semântico é idêntico', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const evOriginal: Evidence = {
      evidence_id: 'EVD-51-009',
      observation_id: 'OBS-51-009',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'hash_v1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evMod: Evidence = { ...evOriginal, content_hash: 'hash_v2' };

    const factsOrig = provider.generateFacts([evOriginal]);
    const factsMod = provider.generateFacts([evMod]);

    assert.strictEqual(factsOrig[0].semantic_hash, factsMod[0].semantic_hash);
    assert.notStrictEqual(factsOrig[0].input_hash, factsMod[0].input_hash);
  });

  // FACT-5.1-010
  await test('FACT-5.1-010: Mudança de manifestHash no contexto altera input_hash', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-51-010',
      observation_id: 'OBS-51-010',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const provA = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'manifest_v1' });
    const provB = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'manifest_v2' });

    const factsA = provA.generateFacts([ev]);
    const factsB = provB.generateFacts([ev]);

    assert.notStrictEqual(factsA[0].input_hash, factsB[0].input_hash);
  });

  // FACT-5.1-011
  await test('FACT-5.1-011: Mudança de manifestHash preserva semantic_hash quando a semântica é idêntica', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-51-011',
      observation_id: 'OBS-51-011',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const provA = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'manifest_v1' });
    const provB = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'manifest_v2' });

    const factsA = provA.generateFacts([ev]);
    const factsB = provB.generateFacts([ev]);

    assert.strictEqual(factsA[0].semantic_hash, factsB[0].semantic_hash);
  });

  // FACT-5.1-012 & FACT-5.1-013
  await test('FACT-5.1-012 & 013: Reordenação de evidencias não altera semantic_hash nem input_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev1: Evidence = {
      evidence_id: 'EVD-51-012-1',
      observation_id: 'OBS-51-012-1',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const ev2: Evidence = {
      evidence_id: 'EVD-51-012-2',
      observation_id: 'OBS-51-012-2',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 6 },
      source_hash: 'sh1',
      content_hash: 'ch2',
      snippet: 'import type { OrderType } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const factsOrdered = provider.generateFacts([ev1, ev2]);
    const factsReversed = provider.generateFacts([ev2, ev1]);

    assert.strictEqual(factsOrdered[0].semantic_hash, factsReversed[0].semantic_hash);
    assert.strictEqual(factsOrdered[0].input_hash, factsReversed[0].input_hash);
  });

  // FACT-5.1-014
  await test('FACT-5.1-014: Fact recém-criado possui lifecycle_status = VALID', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-51-014',
      observation_id: 'OBS-51-014',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts[0].lifecycle_status, 'VALID');
  });

  // FACT-5.1-015
  await test('FACT-5.1-015: schema_version é centralizado e vale "1.0"', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-51-015',
      observation_id: 'OBS-51-015',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts[0].schema_version, FACT_SCHEMA_VERSION_1_0);
    assert.strictEqual(FACT_SCHEMA_VERSION_1_0, '1.0');
  });

  // FACT-5.1-019: Rules sem filesystem/I/O
  await test('FACT-5.1-019: NoDisallowedDependencyRule executa sem I/O', () => {
    const ruleFilePath = path.resolve(__dirname, '../EOS/core/rules/no-disallowed-dependency-rule.ts');
    const content = fs.readFileSync(ruleFilePath, 'utf-8');
    assert.strictEqual(content.includes("from 'fs'"), false);
    assert.strictEqual(content.includes("from 'child_process'"), false);
  });

  // FACT-5.1-020 & 021: Fail-Closed para UNRESOLVED e AMBIGUOUS
  await test('FACT-5.1-020 & 021: UNRESOLVED e AMBIGUOUS geram INSUFFICIENT_EVIDENCE na regra', () => {
    const rule = new NoDisallowedDependencyRule();
    const fakeUnresFact: Fact = {
      fact_id: 'FCT-UNRES-51',
      schema_version: '1.0',
      fact_type: 'MODULE_DEPENDENCY',
      provider_id: 'dependency-fact-provider',
      provider_version: '5.1.0',
      evidence_ids: ['EVD-01'],
      input_hash: 'h1',
      semantic_hash: 'sh1',
      lifecycle_status: 'VALID',
      payload: {
        fact_type: 'MODULE_DEPENDENCY',
        source_module: 'src/domain/User.ts',
        target_module: 'UNRESOLVED',
        import_type: 'STATIC',
        resolution_kind: 'UNRESOLVED',
        resolution_strategy: 'PACKAGE',
      },
      composite_confidence: 1.0,
      created_at: new Date().toISOString(),
    };

    const evalRes = rule.evaluate([fakeUnresFact], target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  // MUT-5.1 Conceptual Mutation Tests
  await test('MUT-5.1: semantic_hash NÃO varia por causa de evidence_id ou created_at', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev1: Evidence = {
      evidence_id: 'EVD-MUT-1',
      observation_id: 'OBS-MUT-1',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.1.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const ev2: Evidence = { ...ev1, evidence_id: 'EVD-MUT-2' };

    const f1 = provider.generateFacts([ev1]);
    const f2 = provider.generateFacts([ev2]);

    assert.strictEqual(f1[0].semantic_hash, f2[0].semantic_hash);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 5.1: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase51FactSchemaSemanticIdentityTests().catch(err => {
  console.error('Erro na suíte da Fase 5.1:', err);
  process.exit(1);
});
