import * as assert from 'assert';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { TypescriptAstCollector } from '../EOS/core/collectors/typescript-ast-collector';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { SemanticModuleResolver } from '../EOS/core/resolvers/semantic-module-resolver';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase44AdversarialTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE ADVERSARIAL DA FASE 4.4 — SEMANTIC RESOLVER');
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
  const collector = new TypescriptAstCollector();
  const target = TargetResolver.resolve('.');

  const customTsconfig = {
    baseUrl: '.',
    paths: {
      '@domain/*': ['src/domain/*'],
      '@infra/*': ['src/infrastructure/*'],
      '@shared/*': ['src/shared/*'],
    },
    knownFiles: [
      'src/infrastructure/db.ts',
      'src/domain/db.ts',
      'src/domain/user-service.ts',
      'src/domain/user-repository.ts',
    ],
    knownPackages: ['@my-infra-tool/client'],
  };

  const providerWithTsConfig = new DependencyFactProvider(customTsconfig);
  const rule = new NoDisallowedDependencyRule();

  // INV-44-001: Determinismo
  await test('INV-44-001: Mesmas evidências e tsconfig produzem exatamente o mesmo fact_id e input_hash', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-44-DET',
      observation_id: 'OBS-44-DET',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/UserService.ts',
      locator: { relative_path: 'src/domain/UserService.ts', line: 1 },
      source_hash: 'hash1',
      content_hash: 'hash2',
      snippet: 'import { Db } from "@infra/db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '@infra/db', import_type: 'STATIC' },
    };

    const fact1 = providerWithTsConfig.generateFacts([ev])[0];
    const fact2 = providerWithTsConfig.generateFacts([ev])[0];

    assert.strictEqual(fact1.fact_id, fact2.fact_id);
    assert.strictEqual(fact1.input_hash, fact2.input_hash);
    if (fact1.payload.fact_type === 'MODULE_DEPENDENCY') {
      assert.strictEqual(fact1.payload.target_module, 'src/infrastructure/db');
    }
  });

  // INV-44-002: Proveniência intacta
  await test('INV-44-002: Resolução semântica não altera a proveniência nem o arquivo físico da Evidence', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-PROV-44',
      observation_id: 'OBS-PROV-44',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/Domain/User.ts',
      locator: { relative_path: 'src/Domain/User.ts', line: 15 },
      source_hash: 'sha256-original',
      content_hash: 'sha256-snippet',
      snippet: 'import { db } from "@infra/db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '@infra/db', import_type: 'STATIC' },
    };

    const facts = providerWithTsConfig.generateFacts([ev]);
    assert.strictEqual(ev.source_reference, 'src/Domain/User.ts');
    assert.strictEqual(ev.locator.line, 15);
    assert.strictEqual(ev.source_hash, 'sha256-original');
    assert.strictEqual(facts[0].evidence_ids[0], 'EVD-PROV-44');
  });

  // INV-44-003: No False Resolution
  await test('INV-44-003: Especificador vazio ou inválido resulta em UNRESOLVED sem criar fato falso', () => {
    const res = resolver.resolve('src/domain/User.ts', '');
    assert.strictEqual(res.resolved_module, 'UNRESOLVED');
    assert.strictEqual(res.resolution_type, 'UNRESOLVED');
  });

  // INV-44-004: No False Merge
  await test('INV-44-004: Módulos fisicamente distintos não são mesclados indevidamente', () => {
    const res1 = resolver.resolve('src/domain/User.ts', './user-service', customTsconfig);
    const res2 = resolver.resolve('src/domain/User.ts', './user-repository', customTsconfig);
    assert.notStrictEqual(res1.resolved_module, res2.resolved_module);
    assert.strictEqual(res1.resolved_module, 'src/domain/user-service');
    assert.strictEqual(res2.resolved_module, 'src/domain/user-repository');
  });

  // Testes de Resolução e Aliases
  await test('4.4-ALIAS-01: Resolução de @infra/db via tsconfig.paths para src/infrastructure/db', () => {
    const res = resolver.resolve('src/domain/User.ts', '@infra/db', customTsconfig);
    assert.strictEqual(res.resolved_module, 'src/infrastructure/db');
    assert.strictEqual(res.resolution_type, 'PATH_ALIAS');
    assert.strictEqual(res.is_external, false);
  });

  await test('4.4-ALIAS-02: Distinção entre @infra/db (alias interno) e @my-infra-tool/client (pacote externo)', () => {
    const resInternal = resolver.resolve('src/domain/User.ts', '@infra/db', customTsconfig);
    const resExternal = resolver.resolve('src/domain/User.ts', '@my-infra-tool/client', customTsconfig);

    assert.strictEqual(resInternal.resolved_module, 'src/infrastructure/db');
    assert.strictEqual(resInternal.is_external, false);

    assert.strictEqual(resExternal.resolved_module, '@my-infra-tool/client');
    assert.strictEqual(resExternal.is_external, true);

    // Avaliação da regra não deve acusar violação para pacote externo npm
    const factsExternal = providerWithTsConfig.generateFacts([{
      evidence_id: 'EVD-EXT',
      observation_id: 'OBS-EXT',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/UserService.ts',
      locator: { relative_path: 'src/domain/UserService.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'import client from "@my-infra-tool/client"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '@my-infra-tool/client', import_type: 'STATIC' },
    }]);

    const evalExternal = rule.evaluate(factsExternal, target);
    assert.strictEqual(evalExternal.evaluation.status, 'PASS');
  });

  await test('4.4-EXT-01: Extensões .ts, .tsx, .js, .jsx, .mts, .cts e sufixos /index', () => {
    const exts = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];
    for (const ext of exts) {
      const res = resolver.resolve('src/domain/User.ts', `./db${ext}`, customTsconfig);
      assert.strictEqual(res.resolved_module, 'src/domain/db');
    }

    const resIndex = resolver.resolve('src/domain/User.ts', './db/index.ts', customTsconfig);
    assert.strictEqual(resIndex.resolved_module, 'src/domain/db');
  });

  await test('4.4-REEXPORT-01: Captura de re-exports estáticos e de wildcard em AST', () => {
    const code = `
      export { Service } from './Service';
      export { Repo as Repository } from './Repo';
      export * from './Types';
      export * as Namespace from './Helpers';
    `;
    const imports = collector.parseSource('src/domain/User.ts', code);
    assert.strictEqual(imports.length, 4);
    assert.strictEqual(imports[0].module_specifier, './Service');
    assert.strictEqual(imports[1].module_specifier, './Repo');
    assert.strictEqual(imports[2].module_specifier, './Types');
    assert.strictEqual(imports[3].module_specifier, './Helpers');
  });

  await test('4.4-SAFETY-01: Resolução de especificador não mapeado sem evidencia resulta em INSUFFICIENT_EVIDENCE', () => {
    const providerDefault = new DependencyFactProvider();
    const facts = providerDefault.generateFacts([{
      evidence_id: 'EVD-DEF',
      observation_id: 'OBS-DEF',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/UserService.ts',
      locator: { relative_path: 'src/domain/UserService.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'import { db } from "@infra/db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.4.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '@infra/db', import_type: 'STATIC' },
    }]);

    const evalRes = rule.evaluate(facts, target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.4: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase44AdversarialTests().catch(err => {
  console.error('Erro na suíte adversarial da Fase 4.4:', err);
  process.exit(1);
});
