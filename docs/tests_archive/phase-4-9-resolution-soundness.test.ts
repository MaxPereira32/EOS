import * as assert from 'assert';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { SemanticModuleResolver } from '../EOS/core/resolvers/semantic-module-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { ProjectManifestCollector } from '../EOS/core/collectors/project-manifest-collector';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase49ResolutionSoundnessTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 4.9.1 — EVIDENCE-BASED SOUNDNESS DO RESOLVER');
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
  const manifestCollector = new ProjectManifestCollector();
  const manifestRes = manifestCollector.collect(target);

  // GATE A: Package Evidence vs Unresolved Package Specifiers (Zero Heurísticas Textuais)
  await test('4.9.1-PKG-001: Módulo Built-in do Node (fs) é classificado como EXTERNAL / PACKAGE', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', 'fs');
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, true);
  });

  await test('4.9.1-PKG-002: Módulo Node com prefixo node: (node:path) é classificado como EXTERNAL / PACKAGE', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', 'node:path');
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, true);
  });

  await test('4.9.1-PKG-003: Pacote declarado em package.json (typescript) é classificado como EXTERNAL / PACKAGE', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', 'typescript', manifestRes.evidenceContext);
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, true);
  });

  await test('4.9.1-PKG-004: Subpacote de pacote declarado (typescript/lib/tsserverlibrary) é classificado como EXTERNAL', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', 'typescript/lib/tsserverlibrary', manifestRes.evidenceContext);
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, true);
  });

  await test('4.9.1-PKG-005: Pacote customizado com evidência (knownPackages) é classificado como EXTERNAL', () => {
    const config = { knownPackages: ['@my-infra-tool/client'] };
    const res = resolver.resolveDetailed('src/domain/User.ts', '@my-infra-tool/client', config);
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, true);
  });

  await test('4.9.1-ANTI-HEURISTIC-001: @unknown/db não declarado nem instalado é UNRESOLVED sem heurística textual', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', '@unknown/db', manifestRes.evidenceContext);
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, false);
  });

  await test('4.9.1-ANTI-HEURISTIC-002: pacote-fantasma-123 (pacote arbítrio inexistente) é UNRESOLVED', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', 'pacote-fantasma-123', manifestRes.evidenceContext);
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, false);
  });

  await test('4.9.1-ANTI-HEURISTIC-003: @empresa/seguranca (scoped package inexistente) é UNRESOLVED', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', '@empresa/seguranca', manifestRes.evidenceContext);
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, false);
  });

  await test('4.9.1-ANTI-HEURISTIC-004: @qualquer-scope/modulo-inexistente/subpath é UNRESOLVED', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', '@qualquer-scope/modulo-inexistente/subpath', manifestRes.evidenceContext);
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.strategy, 'PACKAGE');
    assert.strictEqual(res.is_external, false);
  });

  // GATE B: Internal Module Resolution with Real Evidence
  await test('4.9.1-INT-001: Alias com arquivo fisicamente existente no projeto (EOS/core/domain/types) resulta em INTERNAL', () => {
    const config = {
      baseUrl: '.',
      paths: { '@domain/*': ['EOS/core/domain/*'] },
      knownFiles: ['EOS/core/domain/types.ts'],
    };
    const res = resolver.resolveDetailed('EOS/core/services/AuditService.ts', '@domain/types', config);
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.strategy, 'PATH_ALIAS');
    assert.strictEqual(res.canonical_module, 'EOS/core/domain/types');
  });

  await test('4.9.1-INT-002: Alias com arquivo inexistente no projeto (@domain/DoesNotExist) resulta em UNRESOLVED', () => {
    const config = { baseUrl: '.', paths: { '@domain/*': ['EOS/core/domain/*'] } };
    const res = resolver.resolveDetailed('EOS/core/services/AuditService.ts', '@domain/DoesNotExist', config);
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.strategy, 'PATH_ALIAS');
  });

  await test('4.9.1-INT-003: Import relativo com arquivo inexistente (./DoesNotExist) resulta em UNRESOLVED', () => {
    const res = resolver.resolveDetailed('EOS/core/domain/types.ts', './DoesNotExist');
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.strategy, 'RELATIVE');
  });

  await test('4.9.1-INT-004: Import relativo com arquivo existente (./target-resolver) resulta em INTERNAL', () => {
    const knownFiles = ['EOS/core/domain/types.ts', 'EOS/core/domain/target-resolver.ts'];
    const res = resolver.resolveDetailed('EOS/core/domain/types.ts', './target-resolver', undefined, knownFiles);
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.strategy, 'RELATIVE');
    assert.strictEqual(res.canonical_module, 'EOS/core/domain/target-resolver');
  });

  await test('4.9.1-INT-005: Resolução via knownFiles inventariado valida existência e ambiguidade', () => {
    const knownFiles = ['src/domain/User.ts', 'src/domain/Order.ts'];
    const config = { baseUrl: '.', paths: { '@domain/*': ['src/domain/*'] } };

    const resExist = resolver.resolveDetailed('src/app.ts', '@domain/User', config, knownFiles);
    assert.strictEqual(resExist.kind, 'INTERNAL');

    const resInexist = resolver.resolveDetailed('src/app.ts', '@domain/Product', config, knownFiles);
    assert.strictEqual(resInexist.kind, 'UNRESOLVED');
  });

  await test('4.9.1-INT-006: Múltiplos candidatos em knownFiles gera AMBIGUOUS', () => {
    const knownFiles = ['src/domain/db.ts', 'src/domain/db/index.ts'];
    const res = resolver.resolveDetailed('src/domain/User.ts', './db', undefined, knownFiles);
    assert.strictEqual(res.strategy, 'RELATIVE');
    assert.strictEqual(res.kind, 'AMBIGUOUS');
    assert.strictEqual(res.candidates.length, 2);
  });

  // Symlinks e Contenção
  await test('4.9.1-SYM-001: Link simbólico inválido resulta em UNRESOLVED sob strategy=SYMLINK', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', 'symlink:invalid/broken/target');
    assert.strictEqual(res.strategy, 'SYMLINK');
    assert.strictEqual(res.kind, 'UNRESOLVED');
  });

  // Regra de Governança
  await test('4.9.1-RULE-001: Pacote inexistente ou módulo incerto gera INSUFFICIENT_EVIDENCE na Rule', () => {
    const provider = new DependencyFactProvider();
    const ev: Evidence = {
      evidence_id: 'EVD-AST-UNRES-FANTASMA',
      observation_id: 'OBS-FANTASMA',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 8 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import db from "pacote-fantasma-123"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.9.1' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'pacote-fantasma-123', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    const rule = new NoDisallowedDependencyRule();
    const evalRes = rule.evaluate(facts, target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.9.1: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase49ResolutionSoundnessTests().catch(err => {
  console.error('Erro na suíte da Fase 4.9.1:', err);
  process.exit(1);
});
