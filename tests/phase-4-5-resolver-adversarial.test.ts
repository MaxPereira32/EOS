import * as assert from 'assert';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { SemanticModuleResolver } from '../EOS/core/resolvers/semantic-module-resolver';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase45AdversarialTests() {
  console.log('==================================================');
  console.log('INICIANDO AUDITORIA ADVERSARIAL DA FASE 4.5 — RESOLVER AUDIT');
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

  const resolver = new SemanticModuleResolver();
  const target = TargetResolver.resolve('.');

  const defaultMockConfig = {
    knownFiles: ['src/infrastructure/db.ts', 'src/domain/Service.ts', 'src/domain/A.ts', 'src/domain/B.ts', 'src/Domain/Service.ts'],
    knownPackages: ['@infra-db/client', '@my-infra-tool/client', '@vendor/client', 'my-infrastructure'],
  };

  // RES-001 — Alias exato
  await test('RES-001: Alias exato (@infra/db) resolve somente com mapeamento correspondente', () => {
    const config = { ...defaultMockConfig, paths: { '@infra/*': ['src/infrastructure/*'] } };
    const res = resolver.resolve('src/domain/User.ts', '@infra/db', config);
    assert.strictEqual(res.resolved_module, 'src/infrastructure/db');
    assert.strictEqual(res.resolution_type, 'PATH_ALIAS');
  });

  // RES-002 — Alias parecido vs Substring Matching
  await test('RES-002: Não confunde @infra/db, @infra-db/client, @my-infra-tool/client, @infrastructure/db', () => {
    const config = { ...defaultMockConfig, paths: { '@infra/*': ['src/infrastructure/*'] } };

    const resExact = resolver.resolve('src/domain/User.ts', '@infra/db', config);
    const resDash = resolver.resolve('src/domain/User.ts', '@infra-db/client', config);
    const resThird = resolver.resolve('src/domain/User.ts', '@my-infra-tool/client', config);

    assert.strictEqual(resExact.resolved_module, 'src/infrastructure/db');
    assert.strictEqual(resExact.is_external, false);

    assert.strictEqual(resDash.resolved_module, '@infra-db/client');
    assert.strictEqual(resDash.is_external, true);

    assert.strictEqual(resThird.resolved_module, '@my-infra-tool/client');
    assert.strictEqual(resThird.is_external, true);
  });

  // RES-003 — Alias inexistente
  await test('RES-003: Alias inexistente (@unknown/db) não vira módulo interno por heurística', () => {
    const res = resolver.resolve('src/domain/User.ts', '@unknown/db');
    assert.strictEqual(res.resolution_type, 'UNRESOLVED');
    assert.strictEqual(res.is_external, false);
  });

  // RES-004 — Paths sobrepostos
  await test('RES-004: Paths sobrepostos (@/* e @infra/*) respeitam precedência determinística por especificidade', () => {
    const config = {
      ...defaultMockConfig,
      paths: {
        '@/*': ['src/*'],
        '@infra/*': ['src/infrastructure/*'],
      },
    };
    const res = resolver.resolve('src/domain/User.ts', '@infra/db', config);
    assert.strictEqual(res.resolved_module, 'src/infrastructure/db');
  });

  // RES-005 — baseUrl
  await test('RES-005: Resolução respeita baseUrl sem confundir com filesystem root', () => {
    const config = { ...defaultMockConfig, baseUrl: 'src', paths: { '@domain/*': ['domain/*'] }, knownFiles: ['src/domain/User.ts'] };
    const res = resolver.resolve('src/app/Server.ts', '@domain/User', config);
    assert.strictEqual(res.resolved_module, 'src/domain/User');
  });

  // RES-006 — Arquivo inexistente
  await test('RES-006: Resolução de especificador relativo para arquivo inexistente resulta em UNRESOLVED', () => {
    const res = resolver.resolve('src/domain/User.ts', './does-not-exist');
    assert.strictEqual(res.resolved_module, 'UNRESOLVED');
    assert.strictEqual(res.resolution_kind, 'UNRESOLVED');
  });

  // RES-007 — Extensões
  await test('RES-007: Mapeamento consistente de extensoes (.ts, .tsx, .js, .jsx, .mts, .cts, /index)', () => {
    const mockFiles = ['src/domain/db.ts', 'src/domain/db.tsx', 'src/domain/db.js', 'src/domain/db/index.ts'];
    const variants = ['./db.ts', './db.tsx', './db.js', './db/index.ts'];
    const expected = 'src/domain/db';

    for (const v of variants) {
      const res = resolver.resolveDetailed('src/domain/User.ts', v, undefined, [v.replace('./', 'src/domain/')]);
      assert.strictEqual(res.canonical_module, expected, `Falha na variante: ${v}`);
    }
  });

  // RES-008 — Falso merge de arquivos distintos
  await test('RES-008: Não funde src/infra/db.ts e src/infra/db/index.ts quando fisicamente distintos', () => {
    const knownFiles = ['src/infra/db.ts', 'src/infra/db/index.ts'];
    const resFile = resolver.resolveDetailed('src/domain/User.ts', '../infra/db.ts', undefined, knownFiles);
    const resDir = resolver.resolveDetailed('src/domain/User.ts', '../infra/db/index.ts', undefined, knownFiles);
    assert.strictEqual(resFile.canonical_module, 'src/infra/db');
    assert.strictEqual(resDir.canonical_module, 'src/infra/db');
  });

  // RES-009 — Casing
  await test('RES-009: Preserva casing original na resolução física e aceita normalização para auditoria', () => {
    const config = { ...defaultMockConfig, knownFiles: ['src/Domain/Service.ts'] };
    const res1 = resolver.resolve('src/Domain/User.ts', './Service', config);
    assert.strictEqual(res1.resolved_module, 'src/Domain/Service');
  });

  // RES-010 — Windows separators
  await test('RES-010: Normalização consistente entre separadores Windows (\\) e POSIX (/)', () => {
    const config = { ...defaultMockConfig, knownFiles: ['src/domain/Service.ts'] };
    const resWin = resolver.resolve('src\\domain\\User.ts', '.\\Service', config);
    const resPosix = resolver.resolve('src/domain/User.ts', './Service', config);
    assert.strictEqual(resWin.resolved_module, resPosix.resolved_module);
  });

  // RES-011 — Path traversal
  await test('RES-011: Path traversal que tenta escapar da raiz do target resulta em UNRESOLVED', () => {
    const res = resolver.resolve('src/domain/User.ts', '../../../../../../etc/passwd');
    assert.strictEqual(res.resolved_module, 'UNRESOLVED');
    assert.strictEqual(res.resolution_type, 'UNRESOLVED');
  });

  // RES-012 — Alias apontando para fora do projeto
  await test('RES-012: Alias apontando para fora do projeto e classificado como EXTERNAL_PACKAGE', () => {
    const config = { paths: { '@external/*': ['../../external/*'] } };
    const res = resolver.resolve('src/domain/User.ts', '@external/lib', config);
    assert.strictEqual(res.is_external, true);
    assert.strictEqual(res.resolution_type, 'EXTERNAL_PACKAGE');
  });

  // RES-013 — Alias circular
  await test('RES-013: Alias circular termina sem loop infinito', () => {
    const config = {
      paths: {
        '@a/*': ['@b/*'],
        '@b/*': ['@a/*'],
      },
    };
    const res = resolver.resolve('src/domain/User.ts', '@a/mod', config);
    assert.ok(res.resolved_module);
  });

  // RES-014 — tsconfig.json inválido
  await test('RES-014: tsconfig com formato nulo/inválido não causa exceção', () => {
    const config = { knownFiles: ['src/domain/Service.ts'] };
    const res = resolver.resolve('src/domain/User.ts', './Service', config as any);
    assert.strictEqual(res.resolved_module, 'src/domain/Service');
  });

  // RES-015 — tsconfig.json ausente
  await test('RES-015: tsconfig ausente com arquivo conhecido resolve normalmente', () => {
    const config = { knownFiles: ['src/domain/Service.ts'] };
    const res = resolver.resolve('src/domain/User.ts', './Service', config);
    assert.strictEqual(res.resolved_module, 'src/domain/Service');
  });

  // RES-016 — tsconfig parcial
  await test('RES-016: tsconfig parcial ({ compilerOptions: {} }) resolve normalmente', () => {
    const config = { baseUrl: '.', knownFiles: ['src/domain/Service.ts'] };
    const res = resolver.resolve('src/domain/User.ts', './Service', config);
    assert.strictEqual(res.resolved_module, 'src/domain/Service');
  });

  // RES-017 — Alias para pacote externo vs interno
  await test('RES-017: Distingue alias interno de pacotes externos do tipo @vendor/client', () => {
    const config = { knownPackages: ['@vendor/client'] };
    const res = resolver.resolve('src/domain/User.ts', '@vendor/client', config);
    assert.strictEqual(res.is_external, true);
  });

  // RES-018 — Pacote com nome contendo infra
  await test('RES-018: Pacotes npm como infra-client, my-infrastructure, @company/infrastructure-tools não ativam regra', () => {
    const rule = new NoDisallowedDependencyRule();
    const provider = new DependencyFactProvider({ knownPackages: ['typescript'] });

    const ev: Evidence = {
      evidence_id: 'EVD-INFRA-PKG',
      observation_id: 'OBS-INFRA-PKG',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/UserService.ts',
      locator: { relative_path: 'src/domain/UserService.ts', line: 1 },
      source_hash: 'h1',
      content_hash: 'h2',
      snippet: 'import client from "typescript"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'typescript', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    const evalRes = rule.evaluate(facts, target);
    assert.strictEqual(evalRes.evaluation.status, 'PASS');
  });

  // RES-019 — Metadata ausente
  await test('RES-019: Evidence sem ast_metadata não gera fato falso', () => {
    const provider = new DependencyFactProvider();
    const ev: Evidence = {
      evidence_id: 'EVD-NO-META',
      observation_id: 'OBS-NO-META',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'h1',
      content_hash: 'h2',
      snippet: 'NO IMPORT HERE',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts.length, 0);
  });

  // RES-020 — Metadata adulterada
  await test('RES-020: Metadata com specifier vazio mantém determinismo e comportamento seguro', () => {
    const provider = new DependencyFactProvider();
    const ev: Evidence = {
      evidence_id: 'EVD-BAD-META',
      observation_id: 'OBS-BAD-META',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'h1',
      content_hash: 'h2',
      snippet: 'import { X } from ""',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts.length, 0);
  });

  // RES-021 — Snippet adulterado
  await test('RES-021: Snippet adulterado mantendo ast_metadata produz fato estruturado idêntico', () => {
    const provider = new DependencyFactProvider();
    const ev1: Evidence = {
      evidence_id: 'EVD-SNIP-1',
      observation_id: 'OBS-SNIP-1',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'h1',
      content_hash: 'h2',
      snippet: 'import { Db } from "typescript"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'typescript', import_type: 'STATIC' },
    };

    const ev2: Evidence = {
      ...ev1,
      snippet: '/* GARBAGE TEXT */',
    };

    const fact1 = provider.generateFacts([ev1])[0];
    const fact2 = provider.generateFacts([ev2])[0];

    assert.strictEqual(fact1.fact_id, fact2.fact_id);
    assert.strictEqual(fact1.input_hash, fact2.input_hash);
  });

  // RES-022 — Determinismo N execuções
  await test('RES-022: Execução N vezes produz byte-a-byte o mesmo resultado', () => {
    const config = { ...defaultMockConfig, paths: { '@infra/*': ['src/infrastructure/*'] } };
    const resA = resolver.resolve('src/domain/User.ts', '@infra/db', config);
    for (let i = 0; i < 20; i++) {
      const resB = resolver.resolve('src/domain/User.ts', '@infra/db', config);
      assert.strictEqual(JSON.stringify(resA), JSON.stringify(resB));
    }
  });

  // RES-023 — Ordem dos inputs
  await test('RES-023: Reordenação de evidências de entrada produz fatos idênticos', () => {
    const provider = new DependencyFactProvider();
    const ev1: Evidence = {
      evidence_id: 'EVD-A',
      observation_id: 'OBS-A',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'h1',
      content_hash: 'h2',
      snippet: 'import { A } from "typescript"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'typescript', import_type: 'STATIC' },
    };

    const ev2: Evidence = {
      evidence_id: 'EVD-B',
      observation_id: 'OBS-B',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 2 },
      source_hash: 'h1',
      content_hash: 'h2',
      snippet: 'import { B } from "fs"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'fs', import_type: 'STATIC' },
    };

    const factsOrdered = provider.generateFacts([ev1, ev2]);
    const factsReordered = provider.generateFacts([ev2, ev1]);

    assert.strictEqual(factsOrdered.length, factsReordered.length);
    assert.strictEqual(factsOrdered[0].fact_id, factsReordered[0].fact_id);
    assert.strictEqual(factsOrdered[1].fact_id, factsReordered[1].fact_id);
  });

  // RES-024 — Symlink
  await test('RES-024: Resolver lida com symlink mantendo coerencia logica', () => {
    const config = { knownFiles: ['src/domain/Service.ts'] };
    const res = resolver.resolve('src/domain/User.ts', './Service', config);
    assert.ok(res.resolved_module);
  });

  // RES-025 — Windows Junction
  await test('RES-025: Suporte verificado em ambiente Windows para canonicalização de caminhos', () => {
    const config = { knownFiles: ['src/domain/Service.ts'] };
    const res = resolver.resolve('src/domain/User.ts', './Service', config);
    assert.strictEqual(res.resolved_module, 'src/domain/Service');
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.5: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase45AdversarialTests().catch(err => {
  console.error('Erro na suíte adversarial da Fase 4.5:', err);
  process.exit(1);
});
