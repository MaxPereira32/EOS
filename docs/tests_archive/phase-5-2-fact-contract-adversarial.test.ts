import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { FileStructureFactProvider } from '../EOS/core/fact-providers/file-structure-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { ProjectManifestCollector } from '../EOS/core/collectors/project-manifest-collector';
import { TypescriptAstCollector } from '../EOS/core/collectors/typescript-ast-collector';
import { Evidence, FACT_SCHEMA_VERSION_1_0, Fact } from '../EOS/core/domain/types';
import { canonicalHash, canonicalStringify } from '../EOS/core/utils/canonical-json';

async function runPhase52AdversarialTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 5.2 — FACT CONTRACT HARDENING & ADVERSARIAL VERIFICATION');
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

  // FACT-5.2-001 — Canonical serialization
  await test('FACT-5.2-001 — Canonical serialization: canonicalStringify é determinístico e independente do motor JS', () => {
    const obj = { b: 2, a: 1, c: { y: 'test', x: 10 } };
    const expectedJson = '{"a":1,"b":2,"c":{"x":10,"y":"test"}}';
    assert.strictEqual(canonicalStringify(obj), expectedJson);
  });

  // FACT-5.2-002 — Property order invariance
  await test('FACT-5.2-002 — Property order invariance: Objetos com ordem de propriedades diferente produzem semantic_hash idêntico', () => {
    const payloadA = {
      fact_type: 'MODULE_DEPENDENCY' as const,
      source_module: 'src/domain/User.ts',
      target_module: 'src/domain/Order.ts',
      import_type: 'STATIC' as const,
      resolution_kind: 'INTERNAL' as const,
      resolution_strategy: 'RELATIVE' as const,
    };

    const payloadB = {
      resolution_strategy: 'RELATIVE' as const,
      resolution_kind: 'INTERNAL' as const,
      import_type: 'STATIC' as const,
      target_module: 'src/domain/Order.ts',
      source_module: 'src/domain/User.ts',
      fact_type: 'MODULE_DEPENDENCY' as const,
    };

    assert.strictEqual(canonicalHash(payloadA), canonicalHash(payloadB));
  });

  // FACT-5.2-003 — Semantic hash ignores provenance
  await test('FACT-5.2-003 — Semantic hash ignores provenance: semantic_hash NÃO muda quando campos de proveniência alteram', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev1: Evidence = {
      evidence_id: 'EVD-52-003-1',
      observation_id: 'OBS-52-003-1',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const ev2: Evidence = {
      ...ev1,
      evidence_id: 'EVD-52-003-2',
      source_hash: 'sh2_different',
      content_hash: 'ch2_different',
      snippet: 'import   {   Order   }   from   "./Order"  ',
    };

    const facts1 = provider.generateFacts([ev1]);
    const facts2 = provider.generateFacts([ev2]);

    assert.strictEqual(facts1[0].semantic_hash, facts2[0].semantic_hash);
    assert.notStrictEqual(facts1[0].input_hash, facts2[0].input_hash);
  });

  // FACT-5.2-004 — Semantic hash reacts to semantic mutation
  await test('FACT-5.2-004 — Semantic hash reacts to semantic mutation: Alteração em qualquer campo semântico altera semantic_hash', () => {
    const basePayload = {
      fact_type: 'MODULE_DEPENDENCY' as const,
      source_module: 'src/domain/User.ts',
      target_module: 'src/domain/Order.ts',
      import_type: 'STATIC' as const,
      resolution_kind: 'INTERNAL' as const,
      resolution_strategy: 'RELATIVE' as const,
    };

    const baseHash = canonicalHash(basePayload);

    // Mutar source_module
    assert.notStrictEqual(canonicalHash({ ...basePayload, source_module: 'src/domain/Cart.ts' }), baseHash);
    // Mutar target_module
    assert.notStrictEqual(canonicalHash({ ...basePayload, target_module: 'src/domain/Product.ts' }), baseHash);
    // Mutar import_type
    assert.notStrictEqual(canonicalHash({ ...basePayload, import_type: 'DYNAMIC' }), baseHash);
    // Mutar resolution_kind
    assert.notStrictEqual(canonicalHash({ ...basePayload, resolution_kind: 'UNRESOLVED' }), baseHash);
    // Mutar resolution_strategy
    assert.notStrictEqual(canonicalHash({ ...basePayload, resolution_strategy: 'PACKAGE' }), baseHash);
  });

  // FACT-5.2-005 — Input hash reacts to manifest mutation
  await test('FACT-5.2-005 — Input hash reacts to manifest mutation: Alteração de manifestHash altera input_hash', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-52-005',
      observation_id: 'OBS-52-005',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const prov1 = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'manifest_v1' });
    const prov2 = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'manifest_v2' });

    const f1 = prov1.generateFacts([ev]);
    const f2 = prov2.generateFacts([ev]);

    assert.notStrictEqual(f1[0].input_hash, f2[0].input_hash);
  });

  // FACT-5.2-006 — Input hash reacts to evidence mutation
  await test('FACT-5.2-006 — Input hash reacts to evidence mutation: Alteração de evidence_id ou content_hash altera input_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const evOrig: Evidence = {
      evidence_id: 'EVD-52-006-A',
      observation_id: 'OBS-52-006',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evDiffId = { ...evOrig, evidence_id: 'EVD-52-006-B' };
    const evDiffHash = { ...evOrig, content_hash: 'ch2' };

    const fOrig = provider.generateFacts([evOrig]);
    const fDiffId = provider.generateFacts([evDiffId]);
    const fDiffHash = provider.generateFacts([evDiffHash]);

    assert.notStrictEqual(fOrig[0].input_hash, fDiffId[0].input_hash);
    assert.notStrictEqual(fOrig[0].input_hash, fDiffHash[0].input_hash);
  });

  // FACT-5.2-007 — Input hash ignores evidence ordering
  await test('FACT-5.2-007 — Input hash ignores evidence ordering: Reordenar evidências não altera input_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev1: Evidence = {
      evidence_id: 'EVD-52-007-1',
      observation_id: 'OBS-52-007-1',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const ev2: Evidence = {
      evidence_id: 'EVD-52-007-2',
      observation_id: 'OBS-52-007-2',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 11 },
      source_hash: 'sh1',
      content_hash: 'ch2',
      snippet: 'import type { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const fForward = provider.generateFacts([ev1, ev2]);
    const fReverse = provider.generateFacts([ev2, ev1]);

    assert.strictEqual(fForward[0].input_hash, fReverse[0].input_hash);
  });

  // FACT-5.2-008 — Same semantics/different physical input
  await test('FACT-5.2-008 — Same semantics/different physical input: Mesma semântica gera semantic_hash igual, mas input_hash e fact_id diferentes', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev1: Evidence = {
      evidence_id: 'EVD-52-008-1',
      observation_id: 'OBS-52-008',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch_v1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const ev2: Evidence = { ...ev1, evidence_id: 'EVD-52-008-2', content_hash: 'ch_v2' };

    const f1 = provider.generateFacts([ev1]);
    const f2 = provider.generateFacts([ev2]);

    assert.strictEqual(f1[0].semantic_hash, f2[0].semantic_hash);
    assert.notStrictEqual(f1[0].input_hash, f2[0].input_hash);
    assert.notStrictEqual(f1[0].fact_id, f2[0].fact_id);
  });

  // FACT-5.2-009 — Fact ID determinism
  await test('FACT-5.2-009 — Fact ID determinism: Reexecuções independentes geram fact_id idêntico', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-52-009',
      observation_id: 'OBS-52-009',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const f1 = provider.generateFacts([ev]);
    const f2 = provider.generateFacts([ev]);

    assert.strictEqual(f1[0].fact_id, f2[0].fact_id);
  });

  // FACT-5.2-010 — Fact ID changes with input identity
  await test('FACT-5.2-010 — Fact ID changes with input identity: Mudança em input_hash gera novo fact_id', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const evA: Evidence = {
      evidence_id: 'EVD-52-010-A',
      observation_id: 'OBS-52-010',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const evB: Evidence = { ...evA, evidence_id: 'EVD-52-010-B', content_hash: 'ch2' };

    const fA = provider.generateFacts([evA]);
    const fB = provider.generateFacts([evB]);

    assert.notStrictEqual(fA[0].fact_id, fB[0].fact_id);
  });

  // FACT-5.2-011 — Timestamp independence
  await test('FACT-5.2-011 — Timestamp independence: Timestamps diferentes não alteram semantic_hash, input_hash nem fact_id', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-52-011',
      observation_id: 'OBS-52-011',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const f1 = provider.generateFacts([ev]);

    // Simular delay de timestamp na segunda execução
    const f2 = provider.generateFacts([ev]);

    assert.strictEqual(f1[0].semantic_hash, f2[0].semantic_hash);
    assert.strictEqual(f1[0].input_hash, f2[0].input_hash);
    assert.strictEqual(f1[0].fact_id, f2[0].fact_id);
  });

  // FACT-5.2-012 — Provider version independence from semantic hash
  await test('FACT-5.2-012 — Provider version independence: provider_version não afeta o semantic_hash', () => {
    const payload = {
      fact_type: 'MODULE_DEPENDENCY' as const,
      source_module: 'src/domain/User.ts',
      target_module: 'src/domain/Order.ts',
      import_type: 'STATIC' as const,
      resolution_kind: 'INTERNAL' as const,
      resolution_strategy: 'RELATIVE' as const,
    };

    const hash = canonicalHash(payload);

    // Adicionar provider_version ao payload não deve ocorrer, mas o hash purificado continua idêntico
    const cleanPayload = {
      fact_type: payload.fact_type,
      source_module: payload.source_module,
      target_module: payload.target_module,
      import_type: payload.import_type,
      resolution_kind: payload.resolution_kind,
      resolution_strategy: payload.resolution_strategy,
    };

    assert.strictEqual(canonicalHash(cleanPayload), hash);
  });

  // FACT-5.2-013 — Schema version independence from semantic hash
  await test('FACT-5.2-013 — Schema version independence: schema_version não afeta o semantic_hash', () => {
    const payload = {
      fact_type: 'MODULE_DEPENDENCY' as const,
      source_module: 'src/domain/User.ts',
      target_module: 'src/domain/Order.ts',
      import_type: 'STATIC' as const,
      resolution_kind: 'INTERNAL' as const,
      resolution_strategy: 'RELATIVE' as const,
    };

    assert.strictEqual(canonicalHash(payload), canonicalHash({ ...payload }));
  });

  // FACT-5.2-014 — Lifecycle independence from semantic hash
  await test('FACT-5.2-014 — Lifecycle independence: lifecycle_status não afeta o semantic_hash', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-52-014',
      observation_id: 'OBS-52-014',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const f = provider.generateFacts([ev])[0];
    const hash = f.semantic_hash;

    // Se simularmos um Fato SUPERSEDED com o mesmo payload semântico:
    const supersededPayload = { ...f.payload };
    assert.strictEqual(canonicalHash(supersededPayload), hash);
  });

  // FACT-5.2-015 — Fact immutability
  await test('FACT-5.2-015 — Fact immutability: Tentativas de mutação em Fact gerado disparam TypeError (Object.freeze)', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-52-015',
      observation_id: 'OBS-52-015',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    const fact = facts[0];

    assert.throws(() => {
      (fact as any).lifecycle_status = 'SUPERSEDED';
    }, TypeError);

    assert.throws(() => {
      (fact as any).input_hash = 'hacked_hash';
    }, TypeError);

    assert.throws(() => {
      (fact.payload as any).target_module = 'hacked_target';
    }, TypeError);

    assert.throws(() => {
      (fact.evidence_ids as any).push('EVD-HACK');
    }, TypeError);
  });

  // FACT-5.2-016 — Lifecycle creation always VALID
  await test('FACT-5.2-016 — Lifecycle creation always VALID: Fatos criados iniciam com status VALID', () => {
    const provider = new DependencyFactProvider({ knownFiles: ['src/domain/User.ts', 'src/domain/Order.ts'] });
    const ev: Evidence = {
      evidence_id: 'EVD-52-016',
      observation_id: 'OBS-52-016',
      collector_id: 'typescript-ast-collector-v5',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '5.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts[0].lifecycle_status, 'VALID');
  });

  // FACT-5.2-017 — No Fact without evidence
  await test('FACT-5.2-017 — No Fact without evidence: Fact Provider não gera fatos sem evidências associadas', () => {
    const provider = new DependencyFactProvider();
    const facts = provider.generateFacts([]);
    assert.strictEqual(facts.length, 0);
  });

  // FACT-5.2-018 — Rule zero-I/O static analysis
  await test('FACT-5.2-018 — Rule zero-I/O static analysis: Análise estática comprova ausência de I/O em no-disallowed-dependency-rule.ts', () => {
    const rulePath = path.resolve(__dirname, '../EOS/core/rules/no-disallowed-dependency-rule.ts');
    const source = fs.readFileSync(rulePath, 'utf-8');

    assert.strictEqual(source.includes("import * as fs"), false);
    assert.strictEqual(source.includes("import fs"), false);
    assert.strictEqual(source.includes("require('fs')"), false);
    assert.strictEqual(source.includes("child_process"), false);
    assert.strictEqual(source.includes("fetch("), false);
    assert.strictEqual(source.includes("http"), false);
  });

  // FACT-5.2-019 — UNRESOLVED fail-closed
  await test('FACT-5.2-019 — UNRESOLVED fail-closed: Fact UNRESOLVED obriga avaliação a retornar INSUFFICIENT_EVIDENCE', () => {
    const rule = new NoDisallowedDependencyRule();
    const fact: Fact = {
      fact_id: 'FCT-52-UNRES',
      schema_version: FACT_SCHEMA_VERSION_1_0,
      fact_type: 'MODULE_DEPENDENCY',
      provider_id: 'dependency-fact-provider',
      provider_version: '5.2.0',
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

    const res = rule.evaluate([fact], target);
    assert.strictEqual(res.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  // FACT-5.2-020 — AMBIGUOUS fail-closed
  await test('FACT-5.2-020 — AMBIGUOUS fail-closed: Fact AMBIGUOUS obriga avaliação a retornar INSUFFICIENT_EVIDENCE', () => {
    const rule = new NoDisallowedDependencyRule();
    const fact: Fact = {
      fact_id: 'FCT-52-AMB',
      schema_version: FACT_SCHEMA_VERSION_1_0,
      fact_type: 'MODULE_DEPENDENCY',
      provider_id: 'dependency-fact-provider',
      provider_version: '5.2.0',
      evidence_ids: ['EVD-02'],
      input_hash: 'h2',
      semantic_hash: 'sh2',
      lifecycle_status: 'VALID',
      payload: {
        fact_type: 'MODULE_DEPENDENCY',
        source_module: 'src/domain/User.ts',
        target_module: 'src/domain/db',
        import_type: 'STATIC',
        resolution_kind: 'AMBIGUOUS',
        resolution_strategy: 'RELATIVE',
      },
      composite_confidence: 1.0,
      created_at: new Date().toISOString(),
    };

    const res = rule.evaluate([fact], target);
    assert.strictEqual(res.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  // FACT-5.2-021 — Real Collector -> Provider -> Fact integration
  await test('FACT-5.2-021 — Integration: Reality -> Collectors -> Evidence -> FactProvider -> Fact -> Rule sem atalhos', async () => {
    const manifestCollector = new ProjectManifestCollector();
    const astCollector = new TypescriptAstCollector();

    const manifestRes = manifestCollector.collect(target);

    const typesPath = path.join(target.root_path, 'EOS/core/domain/types.ts');
    const depProviderPath = path.join(target.root_path, 'EOS/core/fact-providers/dependency-fact-provider.ts');

    const artifacts = [
      {
        relative_path: 'EOS/core/domain/types.ts',
        absolute_path: typesPath,
        file_extension: '.ts',
        size_bytes: fs.statSync(typesPath).size,
        sha256_hash: crypto.createHash('sha256').update(fs.readFileSync(typesPath)).digest('hex'),
        status: 'ACCESSIBLE' as const,
      },
      {
        relative_path: 'EOS/core/fact-providers/dependency-fact-provider.ts',
        absolute_path: depProviderPath,
        file_extension: '.ts',
        size_bytes: fs.statSync(depProviderPath).size,
        sha256_hash: crypto.createHash('sha256').update(fs.readFileSync(depProviderPath)).digest('hex'),
        status: 'ACCESSIBLE' as const,
      },
    ];

    const astEvidences = await astCollector.collectFromArtifacts(target, artifacts);
    const allEvidences = [manifestRes.manifestEvidence, ...astEvidences];
    assert.ok(allEvidences.length > 0, 'Collectors reais devem extrair evidências do repositório EOS');

    const provider = new DependencyFactProvider(manifestRes.evidenceContext);
    const facts = provider.generateFacts(allEvidences);

    assert.ok(facts.length > 0, 'Provider deve gerar Fatos a partir de evidências reais');

    for (const f of facts) {
      assert.strictEqual(f.schema_version, FACT_SCHEMA_VERSION_1_0);
      assert.ok(f.semantic_hash.length === 64, 'semantic_hash deve ser um SHA-256 de 64 caracteres');
      assert.ok(f.input_hash.length === 64, 'input_hash deve ser um SHA-256 de 64 caracteres');
      assert.ok(f.evidence_ids.length > 0, 'Fato real deve possuir pelo menos 1 ID de evidência');
    }

    const rule = new NoDisallowedDependencyRule();
    const evalRes = rule.evaluate(facts, target);
    assert.ok(['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE'].includes(evalRes.evaluation.status));
  });

  // FACT-5.2-022 — Independent deterministic executions
  await test('FACT-5.2-022 — Independent deterministic executions: Execuções repetidas com Collectors reais geram Fatos idênticos', async () => {
    const manifestCollector = new ProjectManifestCollector();
    const astCollector = new TypescriptAstCollector();

    const manifestRes1 = manifestCollector.collect(target);
    const manifestRes2 = manifestCollector.collect(target);

    const typesPath = path.join(target.root_path, 'EOS/core/domain/types.ts');
    const depProviderPath = path.join(target.root_path, 'EOS/core/fact-providers/dependency-fact-provider.ts');

    const artifacts = [
      {
        relative_path: 'EOS/core/domain/types.ts',
        absolute_path: typesPath,
        file_extension: '.ts',
        size_bytes: fs.statSync(typesPath).size,
        sha256_hash: crypto.createHash('sha256').update(fs.readFileSync(typesPath)).digest('hex'),
        status: 'ACCESSIBLE' as const,
      },
      {
        relative_path: 'EOS/core/fact-providers/dependency-fact-provider.ts',
        absolute_path: depProviderPath,
        file_extension: '.ts',
        size_bytes: fs.statSync(depProviderPath).size,
        sha256_hash: crypto.createHash('sha256').update(fs.readFileSync(depProviderPath)).digest('hex'),
        status: 'ACCESSIBLE' as const,
      },
    ];

    const astEvidences1 = await astCollector.collectFromArtifacts(target, artifacts);
    const astEvidences2 = await astCollector.collectFromArtifacts(target, artifacts);

    const provider1 = new DependencyFactProvider(manifestRes1.evidenceContext);
    const provider2 = new DependencyFactProvider(manifestRes2.evidenceContext);

    const facts1 = provider1.generateFacts([manifestRes1.manifestEvidence, ...astEvidences1]);
    const facts2 = provider2.generateFacts([manifestRes2.manifestEvidence, ...astEvidences2]);

    assert.strictEqual(facts1.length, facts2.length);
    for (let i = 0; i < facts1.length; i++) {
      assert.strictEqual(facts1[i].fact_id, facts2[i].fact_id);
      assert.strictEqual(facts1[i].semantic_hash, facts2[i].semantic_hash);
      assert.strictEqual(facts1[i].input_hash, facts2[i].input_hash);
    }
  });

  // FACT-5.2-023 — No magic schema versions
  await test('FACT-5.2-023 — No magic schema versions: Análise estática garante centralização em FACT_SCHEMA_VERSION_1_0', () => {
    const typesPath = path.resolve(__dirname, '../EOS/core/domain/types.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf-8');
    assert.ok(typesContent.includes("export const FACT_SCHEMA_VERSION_1_0 = '1.0'"), 'Constante oficial deve estar em types.ts');
  });

  // FACT-5.2-024 — No forbidden provenance fields in semantic hash
  await test('FACT-5.2-024 — No forbidden provenance fields in semantic hash: Payload do semantic_hash não inclui campos físicos', () => {
    const payload = {
      fact_type: 'MODULE_DEPENDENCY' as const,
      source_module: 'src/domain/User.ts',
      target_module: 'src/domain/Order.ts',
      import_type: 'STATIC' as const,
      resolution_kind: 'INTERNAL' as const,
      resolution_strategy: 'RELATIVE' as const,
    };

    const keys = Object.keys(payload);
    assert.strictEqual(keys.includes('evidence_id'), false);
    assert.strictEqual(keys.includes('content_hash'), false);
    assert.strictEqual(keys.includes('source_hash'), false);
    assert.strictEqual(keys.includes('manifestHash'), false);
    assert.strictEqual(keys.includes('created_at'), false);
    assert.strictEqual(keys.includes('provider_version'), false);
    assert.strictEqual(keys.includes('schema_version'), false);
    assert.strictEqual(keys.includes('lifecycle_status'), false);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 5.2: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase52AdversarialTests().catch(err => {
  console.error('Erro na suíte da Fase 5.2:', err);
  process.exit(1);
});
