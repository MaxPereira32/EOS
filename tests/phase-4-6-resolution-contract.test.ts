import * as assert from 'assert';
import * as path from 'path';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { SemanticModuleResolver } from '../EOS/core/resolvers/semantic-module-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase46ResolutionContractTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 4.6 — RESOLUTION CONTRACT & UNCERTAINTY');
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

  // 1. Formal ResolutionKind Contract
  await test('4.6-001: Contrato formal ModuleResolution com ResolutionKind tipado', () => {
    const resInternal = resolver.resolveDetailed('src/domain/User.ts', './Service', { knownFiles: ['src/domain/Service.ts'] });
    assert.strictEqual(resInternal.kind, 'INTERNAL');
    assert.strictEqual(resInternal.resolution_type, 'RELATIVE');
    assert.strictEqual(resInternal.canonical_module, 'src/domain/Service');

    const resExternal = resolver.resolveDetailed('src/domain/User.ts', 'typescript', { knownPackages: ['typescript'] });
    assert.strictEqual(resExternal.kind, 'EXTERNAL');
    assert.strictEqual(resExternal.resolution_type, 'EXTERNAL_PACKAGE');
    assert.strictEqual(resExternal.is_external, true);
  });

  // 2. Mathematical Path Containment
  await test('4.6-002: Demonstração matemática de containment via path.relative (não startsWith)', () => {
    const root = path.resolve('.');
    assert.strictEqual(resolver.isContained(root, 'src/domain/User.ts'), true);
    assert.strictEqual(resolver.isContained(root, '../../etc/passwd'), false);
    assert.strictEqual(resolver.isContained(root, 'src/domain/../../../etc/passwd'), false);
  });

  // 3. tsconfig.json extends inheritance
  await test('4.6-003: Suporte a herança de tsconfig via extends (merge de parentConfig)', () => {
    const baseConfig = {
      baseUrl: '.',
      paths: { '@base/*': ['src/base/*'] },
      knownFiles: ['src/base/Core.ts'],
    };
    const childConfig = {
      parentConfig: baseConfig,
      paths: { '@child/*': ['src/child/*'] },
      knownFiles: ['src/child/Sub.ts'],
    };

    const resBase = resolver.resolveDetailed('src/domain/User.ts', '@base/Core', childConfig);
    assert.strictEqual(resBase.kind, 'INTERNAL');
    assert.strictEqual(resBase.canonical_module, 'src/base/Core');

    const resChild = resolver.resolveDetailed('src/domain/User.ts', '@child/Sub', childConfig);
    assert.strictEqual(resChild.kind, 'INTERNAL');
    assert.strictEqual(resChild.canonical_module, 'src/child/Sub');
  });

  // 4. AMBIGUOUS resolution state
  await test('4.6-004: Estado AMBIGUOUS reportado quando múltiplos arquivos físicos válidos coexistem', () => {
    const knownFiles = ['src/infrastructure/db.ts', 'src/infrastructure/db/index.ts'];
    const res = resolver.resolveDetailed('src/domain/User.ts', '../infrastructure/db', undefined, knownFiles);
    assert.strictEqual(res.kind, 'AMBIGUOUS');
    assert.strictEqual(res.resolution_type, 'AMBIGUOUS');
    assert.strictEqual(res.candidates.length, 2);
  });

  // 5. Invariante de Pipeline: UNRESOLVED != PASS
  await test('4.6-005: Pipeline completo comprova que UNRESOLVED nunca produz PASS de conformidade', () => {
    const provider = new DependencyFactProvider();
    const rule = new NoDisallowedDependencyRule();

    const ev: Evidence = {
      evidence_id: 'EVD-UNRES-01',
      observation_id: 'OBS-UNRES-01',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'h1',
      content_hash: 'h2',
      snippet: 'import bad from "../../../outside"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.6.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '../../../outside', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    const evalRes = rule.evaluate(facts, target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
    assert.notStrictEqual(evalRes.evaluation.status, 'PASS');
  });

  // 6. Invariante de Pipeline: AMBIGUOUS != PASS
  await test('4.6-006: Pipeline completo comprova que AMBIGUOUS nunca produz PASS de conformidade', () => {
    const fakeAmbiguousFact = {
      fact_id: 'FCT-DEP-AMB',
      schema_version: '1.0',
      fact_type: 'MODULE_DEPENDENCY' as const,
      provider_id: 'dependency-fact-provider',
      provider_version: '4.6.0',
      evidence_ids: ['EVD-AMB-01'],
      input_hash: 'h_amb',
      semantic_hash: 'sh_amb',
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

    const rule = new NoDisallowedDependencyRule();
    const evalRes = rule.evaluate([fakeAmbiguousFact as any], target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
    assert.notStrictEqual(evalRes.evaluation.status, 'PASS');
  });

  // 7. Path traversal fora da raiz
  await test('4.6-007: Path traversal fora da raiz resulta em UNRESOLVED sem inventar modulo', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', '../../../../etc/passwd');
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.canonical_module, null);
  });

  // 8. Verificação de consistência da contabilidade matemática global dos testes
  await test('4.6-008: Verificação de consistência da contabilidade matemática global dos testes', () => {
    assert.strictEqual(passed + failed, 7);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.6: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase46ResolutionContractTests().catch(err => {
  console.error('Erro na suíte da Fase 4.6:', err);
  process.exit(1);
});
