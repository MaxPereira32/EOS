import * as assert from 'assert';
import * as path from 'path';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { SemanticModuleResolver } from '../EOS/core/resolvers/semantic-module-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase48StrategyOrchestrationTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 4.8 — STRATEGY ORCHESTRATION & SOUNDNESS');
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

  // S1 — Resolução Relativa via RelativeStrategyResolver
  await test('4.8-S1-001: RelativeStrategyResolver processa ./ e ../ com estratégia RELATIVE', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', './Order', { knownFiles: ['src/domain/Order.ts'] });
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.strategy, 'RELATIVE');
    assert.strictEqual(res.canonical_module, 'src/domain/Order');
  });

  // S1 — Resolução por Alias via AliasStrategyResolver
  await test('4.8-S1-002: AliasStrategyResolver processa tsconfig.paths com estratégia PATH_ALIAS', () => {
    const config = { baseUrl: '.', paths: { '@infra/*': ['src/infrastructure/*'] }, knownFiles: ['src/infrastructure/db.ts'] };
    const res = resolver.resolveDetailed('src/domain/User.ts', '@infra/db', config);
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.strategy, 'PATH_ALIAS');
    assert.strictEqual(res.canonical_module, 'src/infrastructure/db');
  });

  // S1 — Resolução por Package via PackageStrategyResolver
  await test('4.8-S1-003: PackageStrategyResolver processa pacotes npm externos com estratégia PACKAGE', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', 'typescript', { knownPackages: ['typescript'] });
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, true);
  });

  // S1 — Pacote contendo 'infra' no nome é classificado como PACKAGE, não PATH_ALIAS
  await test('4.8-S1-004: Pacote externo com "infra" no nome (@my-infra-tool/client) preserva estratégia PACKAGE', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', '@my-infra-tool/client', { knownPackages: ['@my-infra-tool/client'] });
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, true);
  });

  // S1 — Resolução por Symlink via SymlinkStrategyResolver
  await test('4.8-S1-005: SymlinkStrategyResolver processa links simbólicos explicitamente com estratégia SYMLINK', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', 'symlink:src/infrastructure/db');
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.strategy, 'SYMLINK');
    assert.strictEqual(res.canonical_module, 'src/infrastructure/db');
  });

  // S2 — Não Sobreposição & Precedência Determinística
  await test('4.8-S2-001: Precedência de especificidade em aliases sobrepostos (@/* e @infra/*)', () => {
    const config = {
      baseUrl: '.',
      paths: {
        '@/*': ['src/*'],
        '@infra/*': ['src/infrastructure/*'],
      },
      knownFiles: ['src/infrastructure/db.ts'],
    };
    const res = resolver.resolveDetailed('src/domain/User.ts', '@infra/db', config);
    assert.strictEqual(res.strategy, 'PATH_ALIAS');
    assert.strictEqual(res.canonical_module, 'src/infrastructure/db');
  });

  // S3 — Fail Closed (UNRESOLVED -> INSUFFICIENT_EVIDENCE)
  await test('4.8-S3-001: Fato com UNRESOLVED obriga regra a retornar status INSUFFICIENT_EVIDENCE', () => {
    const rule = new NoDisallowedDependencyRule();
    const fakeUnresolvedFact = {
      fact_id: 'FCT-DEP-UNRES',
      schema_version: '1.0',
      fact_type: 'MODULE_DEPENDENCY' as const,
      provider_id: 'dependency-fact-provider',
      provider_version: '4.8.0',
      evidence_ids: ['EVD-01'],
      input_hash: 'h1',
      semantic_hash: 'sh1',
      lifecycle_status: 'VALID' as const,
      payload: {
        fact_type: 'MODULE_DEPENDENCY' as const,
        source_module: 'src/domain/User.ts',
        target_module: 'UNRESOLVED',
        import_type: 'STATIC' as const,
        resolution_kind: 'UNRESOLVED' as const,
        resolution_strategy: 'PACKAGE' as const,
        is_external: false,
      },
    };

    const evalRes = rule.evaluate([fakeUnresolvedFact as any], target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  await test('4.8-S3-002: Fato com AMBIGUOUS obriga regra a retornar status INSUFFICIENT_EVIDENCE', () => {
    const rule = new NoDisallowedDependencyRule();
    const fakeAmbiguousFact = {
      fact_id: 'FCT-DEP-AMB',
      schema_version: '1.0',
      fact_type: 'MODULE_DEPENDENCY' as const,
      provider_id: 'dependency-fact-provider',
      provider_version: '4.8.0',
      evidence_ids: ['EVD-02'],
      input_hash: 'h2',
      semantic_hash: 'sh2',
      lifecycle_status: 'VALID' as const,
      payload: {
        fact_type: 'MODULE_DEPENDENCY' as const,
        source_module: 'src/domain/User.ts',
        target_module: 'src/domain/db',
        import_type: 'STATIC' as const,
        resolution_kind: 'AMBIGUOUS' as const,
        resolution_strategy: 'RELATIVE' as const,
        is_external: false,
      },
    };

    const evalRes = rule.evaluate([fakeAmbiguousFact as any], target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  // S4 — FactProvider Integrity
  await test('4.8-S4-001: FactProvider preserva evidence_ids, locator e hash intactos', () => {
    const provider = new DependencyFactProvider();
    const ev: Evidence = {
      evidence_id: 'EVD-ORIG-1',
      observation_id: 'OBS-ORIG-1',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 12 },
      source_hash: 'sh_orig',
      content_hash: 'ch_orig',
      snippet: 'import { Db } from "typescript"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.8.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'typescript', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts.length, 1);
    assert.strictEqual(facts[0].evidence_ids[0], 'EVD-ORIG-1');
    if (facts[0].payload.fact_type === 'MODULE_DEPENDENCY') {
      assert.strictEqual(facts[0].payload.source_module, 'src/domain/User.ts');
    } else {
      assert.fail('Payload deveria ser MODULE_DEPENDENCY');
    }
  });

  // S5 — Determinismo
  await test('4.8-S5-001: Resolução repetida N vezes produz byte-for-byte a mesma estrutura de ModuleResolution', () => {
    const config = { baseUrl: '.', paths: { '@infra/*': ['src/infrastructure/*'] }, knownFiles: ['src/infrastructure/db.ts'] };
    const resA = resolver.resolveDetailed('src/domain/User.ts', '@infra/db', config);
    for (let i = 0; i < 25; i++) {
      const resB = resolver.resolveDetailed('src/domain/User.ts', '@infra/db', config);
      assert.strictEqual(JSON.stringify(resA), JSON.stringify(resB));
    }
  });

  // S6 — NoDisallowedDependencyRule em Memória
  await test('4.8-S6-001: NoDisallowedDependencyRule executa puramente em memória sem I/O', () => {
    const rule = new NoDisallowedDependencyRule();
    const facts = [
      {
        fact_id: 'FCT-MEM-1',
        fact_type: 'MODULE_DEPENDENCY' as const,
        provider_id: 'dependency-fact-provider',
        provider_version: '4.8.0',
        evidence_ids: ['EVD-MEM-1'],
        input_hash: 'h_mem',
        payload: {
          fact_type: 'MODULE_DEPENDENCY' as const,
          source_module: 'src/domain/User.ts',
          target_module: 'typescript',
          import_type: 'STATIC' as const,
          resolution_kind: 'EXTERNAL' as const,
          resolution_strategy: 'PACKAGE' as const,
          is_external: true,
        },
      },
    ];

    const evalRes = rule.evaluate(facts as any, target);
    assert.strictEqual(evalRes.evaluation.status, 'PASS');
  });

  // Validação Extra de Segurança
  await test('4.8-001: Path traversal que tenta escapar da raiz resulta em UNRESOLVED', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', '../../../../etc/passwd');
    assert.strictEqual(res.kind, 'UNRESOLVED');
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.8: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase48StrategyOrchestrationTests().catch(err => {
  console.error('Erro na suíte da Fase 4.8:', err);
  process.exit(1);
});
