import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { ProjectManifestCollector } from '../EOS/core/collectors/project-manifest-collector';
import { Evidence, Fact } from '../EOS/core/domain/types';

async function runPhase50FactIntegrityTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 5.0 — FACT INTEGRITY & PROVENANCE CONTRACT');
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

  // FACT-001: Mesmo input semântico -> mesmo Fact
  await test('FACT-001: Mesmas evidências e contexto geram exatamente o mesmo fact_id e input_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-AST-F001',
      observation_id: 'OBS-F001',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const facts1 = provider.generateFacts([ev]);
    const facts2 = provider.generateFacts([ev]);

    assert.strictEqual(facts1.length, 1);
    assert.strictEqual(facts2.length, 1);
    assert.strictEqual(facts1[0].fact_id, facts2[0].fact_id);
    assert.strictEqual(facts1[0].input_hash, facts2[0].input_hash);
  });

  // FACT-002: Mudança semântica -> Fact diferente
  await test('FACT-002: Alteração no specifier de import resulta em target_module e fact_id diferentes', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts', 'src/domain/Product.ts'] });
    const evA: Evidence = {
      evidence_id: 'EVD-AST-F002A',
      observation_id: 'OBS-F002',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evB: Evidence = {
      ...evA,
      evidence_id: 'EVD-AST-F002B',
      snippet: 'import { Product } from "./Product"',
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Product', import_type: 'STATIC' },
    };

    const factsA = provider.generateFacts([evA]);
    const factsB = provider.generateFacts([evB]);

    assert.notStrictEqual(factsA[0].fact_id, factsB[0].fact_id);
    assert.strictEqual(factsA[0].payload.fact_type, 'MODULE_DEPENDENCY');
    assert.strictEqual(factsB[0].payload.fact_type, 'MODULE_DEPENDENCY');
    if (factsA[0].payload.fact_type === 'MODULE_DEPENDENCY' && factsB[0].payload.fact_type === 'MODULE_DEPENDENCY') {
      assert.notStrictEqual(factsA[0].payload.target_module, factsB[0].payload.target_module);
    }
  });

  // FACT-003: Mudança irrelevante (whitespace no snippet com mesmo ast_metadata) -> mesma identidade semântica
  await test('FACT-003: Mudança de espaços no snippet mantendo ast_metadata idêntico preserva o payload semântico', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev1: Evidence = {
      evidence_id: 'EVD-AST-F003-1',
      observation_id: 'OBS-F003',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const ev2: Evidence = {
      ...ev1,
      evidence_id: 'EVD-AST-F003-2',
      content_hash: 'ch2_different',
      snippet: 'import   {   Order   }   from   "./Order"  ',
    };

    const facts1 = provider.generateFacts([ev1]);
    const facts2 = provider.generateFacts([ev2]);

    assert.strictEqual(facts1[0].payload.fact_type, 'MODULE_DEPENDENCY');
    assert.strictEqual(facts2[0].payload.fact_type, 'MODULE_DEPENDENCY');
    if (facts1[0].payload.fact_type === 'MODULE_DEPENDENCY' && facts2[0].payload.fact_type === 'MODULE_DEPENDENCY') {
      assert.strictEqual(facts1[0].payload.source_module, facts2[0].payload.source_module);
      assert.strictEqual(facts1[0].payload.target_module, facts2[0].payload.target_module);
      assert.strictEqual(facts1[0].payload.import_type, facts2[0].payload.import_type);
    }
  });

  // FACT-004: Reordenação -> mesmo Fact
  await test('FACT-004: Reordenação do array de evidências de entrada produz fatos idênticos', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev1: Evidence = {
      evidence_id: 'EVD-AST-F004-1',
      observation_id: 'OBS-F004-1',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const ev2: Evidence = {
      evidence_id: 'EVD-AST-F004-2',
      observation_id: 'OBS-F004-2',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 11 },
      source_hash: 'sh1',
      content_hash: 'ch2',
      snippet: 'import type { OrderType } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const factsOrdered = provider.generateFacts([ev1, ev2]);
    const factsReversed = provider.generateFacts([ev2, ev1]);

    assert.strictEqual(factsOrdered.length, factsReversed.length);
    assert.strictEqual(factsOrdered[0].fact_id, factsReversed[0].fact_id);
    assert.strictEqual(factsOrdered[0].input_hash, factsReversed[0].input_hash);
  });

  // FACT-005: Evidence removida -> comportamento definido (retorna array vazio de fatos)
  await test('FACT-005: Ausência de evidências de AST resulta em 0 Fatos sem inventar dados', () => {
    const provider = new DependencyFactProvider();
    const facts = provider.generateFacts([]);
    assert.strictEqual(facts.length, 0);
  });

  // FACT-006: Evidence alterada em content_hash -> altera input_hash
  await test('FACT-006: Alteração no content_hash da evidencia altera o input_hash do Fact', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const evOriginal: Evidence = {
      evidence_id: 'EVD-AST-F006',
      observation_id: 'OBS-F006',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'hash_original',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evModified: Evidence = {
      ...evOriginal,
      content_hash: 'hash_modified',
    };

    const factsOrig = provider.generateFacts([evOriginal]);
    const factsMod = provider.generateFacts([evModified]);

    assert.notStrictEqual(factsOrig[0].input_hash, factsMod[0].input_hash);
  });

  // FACT-007: Evidence conflitante / ambígua -> preserva incerteza (AMBIGUOUS)
  await test('FACT-007: Múltiplos candidatos físicos geram resolution_kind AMBIGUOUS no Fact', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/db.ts', 'src/domain/db/index.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-AST-F007',
      observation_id: 'OBS-F007',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import db from "./db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './db', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts[0].payload.fact_type, 'MODULE_DEPENDENCY');
    if (facts[0].payload.fact_type === 'MODULE_DEPENDENCY') {
      assert.strictEqual(facts[0].payload.resolution_kind, 'AMBIGUOUS');
    }
  });

  // FACT-008: Fact possui evidence_ids não vazios garantindo proveniência
  await test('FACT-008: Todo Fact gerado obrigatoriamente contém evidence_ids não vazios', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-AST-F008',
      observation_id: 'OBS-F008',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.ok(facts[0].evidence_ids.length > 0);
    assert.strictEqual(facts[0].evidence_ids[0], 'EVD-AST-F008');
  });

  // FACT-010 & FACT-011: Rule isolation (NoDisallowedDependencyRule não faz I/O nem consulta Collectors)
  await test('FACT-010: NoDisallowedDependencyRule executa sem importar fs ou child_process', () => {
    const ruleFilePath = path.resolve(__dirname, '../EOS/core/rules/no-disallowed-dependency-rule.ts');
    const content = fs.readFileSync(ruleFilePath, 'utf-8');
    assert.strictEqual(content.includes("from 'fs'"), false, 'Rule não pode importar "fs"');
    assert.strictEqual(content.includes("from 'child_process'"), false, 'Rule não pode importar "child_process"');
  });

  // FACT-012: Fact auditabilidade e reprodutibilidade
  await test('FACT-012: Duas execuções com mesmos dados geram fatos idênticos em todas as propriedades', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-AST-F012',
      observation_id: 'OBS-F012',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const factsA = provider.generateFacts([ev]);
    const factsB = provider.generateFacts([ev]);

    assert.deepStrictEqual(factsA[0].payload, factsB[0].payload);
    assert.strictEqual(factsA[0].input_hash, factsB[0].input_hash);
    assert.strictEqual(factsA[0].fact_id, factsB[0].fact_id);
  });

  // FACT-015: Superseded Facts via manifestHash
  await test('FACT-015: Mudança de contexto (manifestHash) invalida/suplanta Fact anterior gerando novo input_hash', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-AST-F015',
      observation_id: 'OBS-F015',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.0.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const provV1 = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'manifest_v1' });
    const provV2 = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'manifest_v2' });

    const factsV1 = provV1.generateFacts([ev]);
    const factsV2 = provV2.generateFacts([ev]);

    assert.notStrictEqual(factsV1[0].input_hash, factsV2[0].input_hash);
    assert.notStrictEqual(factsV1[0].fact_id, factsV2[0].fact_id);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 5.0: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase50FactIntegrityTests().catch(err => {
  console.error('Erro na suíte da Fase 5.0:', err);
  process.exit(1);
});
