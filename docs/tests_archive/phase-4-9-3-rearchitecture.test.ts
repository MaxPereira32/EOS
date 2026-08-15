import * as assert from 'assert';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { SemanticModuleResolver } from '../EOS/core/resolvers/semantic-module-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { ProjectManifestCollector } from '../EOS/core/collectors/project-manifest-collector';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase493RearchitectureTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 4.9.3 — RE-ARQUITETURA DO RESOLVER & PROVENANCE');
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

  // 1. CORREÇÃO F-4.9.2-01: Eliminação Total de Aliases Hardcoded / Default Mappings
  await test('4.9.3-ALI-001: Alias @domain/User sem tsconfig.paths declarado resulta obrigatoriamente em UNRESOLVED', () => {
    const res = resolver.resolveDetailed('src/app.ts', '@domain/User', {}); // Sem tsconfig.paths
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.is_external, false);
  });

  await test('4.9.3-ALI-002: Alias @domain/User com tsconfig.paths declarado e conhecido resulta em INTERNAL', () => {
    const config = {
      baseUrl: '.',
      paths: { '@domain/*': ['src/domain/*'] },
      knownFiles: ['src/domain/User.ts'],
    };
    const res = resolver.resolveDetailed('src/app.ts', '@domain/User', config);
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.strategy, 'PATH_ALIAS');
    assert.strictEqual(res.canonical_module, 'src/domain/User');
  });

  // 2. CORREÇÃO F-4.9.2-02: Validação Estrita de Subpaths de Pacotes Externos
  await test('4.9.3-SUB-001: Subpath de pacote inexistente (typescript/lib/non-existent-file) resulta em UNRESOLVED', () => {
    const config = {
      knownPackages: ['typescript'],
      installedPackageFiles: ['typescript/lib/tsserverlibrary.js', 'typescript/lib/typescript.js'],
    };
    const res = resolver.resolveDetailed('src/app.ts', 'typescript/lib/non-existent-file', config);
    assert.strictEqual(res.kind, 'UNRESOLVED');
  });

  await test('4.9.3-SUB-002: Subpath de pacote existente em installedPackageFiles resulta em EXTERNAL', () => {
    const config = {
      knownPackages: ['typescript'],
      installedPackageFiles: ['typescript/lib/tsserverlibrary.js'],
    };
    const res = resolver.resolveDetailed('src/app.ts', 'typescript/lib/tsserverlibrary', config);
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.strategy, 'PACKAGE');
  });

  // 3. CORREÇÃO F-4.9.2-03: Proteção contra Dependências Fantasma (Phantom / Transitive Undeclared)
  await test('4.9.3-PHN-001: Pacote em node_modules mas não declarado em knownPackages/package.json resulta em UNRESOLVED', () => {
    const config = {
      knownPackages: ['axios'], // 'lodash' não está declarado diretamente
      installedPackages: ['axios', 'lodash'],
    };
    const res = resolver.resolveDetailed('src/app.ts', 'lodash', config);
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.strategy, 'PACKAGE');
  });

  // 4. CORREÇÃO F-4.9.2-04: Resolução com ZERO I/O na Camada de Resolver
  await test('4.9.3-ZIO-001: Resolver executa puramente em memória sem conhecidos sem lançar exceções de FS', () => {
    const res = resolver.resolveDetailed('src/domain/User.ts', './NonExistentFile', {});
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.strategy, 'RELATIVE');
  });

  // 5. CORREÇÃO F-4.9.2-05: Modificação de Contexto de Manifesto altera input_hash do Fact
  await test('4.9.3-PRV-001: Alteração do manifestHash no contexto produz input_hash diferente para mesmo Fact', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-AST-PRV-1',
      observation_id: 'OBS-PRV-1',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 5 },
      source_hash: 'sh_prv',
      content_hash: 'ch_prv',
      snippet: 'import { Order } from "./Order"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.9.3' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './Order', import_type: 'STATIC' },
    };

    const provA = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'hash_v1' });
    const provB = new DependencyFactProvider({ knownFiles: ['src/domain/Order.ts'], manifestHash: 'hash_v2' });

    const factsA = provA.generateFacts([ev]);
    const factsB = provB.generateFacts([ev]);

    assert.strictEqual(factsA.length, 1);
    assert.strictEqual(factsB.length, 1);
    assert.notStrictEqual(factsA[0].input_hash, factsB[0].input_hash);
  });

  // 6. Teste do ProjectManifestCollector
  await test('4.9.3-COL-001: ProjectManifestCollector extrai pacote typescript do package.json do projeto', () => {
    const manifestCollector = new ProjectManifestCollector();
    const res = manifestCollector.collect(target);
    assert.ok(res.evidenceContext.knownPackages?.includes('typescript'));
    assert.ok(res.manifestHash.length > 0);
  });

  // 7. Validação do Fluxo Completo Evidence -> Fact -> Rule Fail-Closed
  await test('4.9.3-PIP-001: Fluxo completo com pacote não declarado gera INSUFFICIENT_EVIDENCE na Rule', () => {
    const manifestCollector = new ProjectManifestCollector();
    const manifestRes = manifestCollector.collect(target);

    const provider = new DependencyFactProvider(manifestRes.evidenceContext);
    const ev: Evidence = {
      evidence_id: 'EVD-AST-UNRES-PIP',
      observation_id: 'OBS-PIP',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sh_pip',
      content_hash: 'ch_pip',
      snippet: 'import db from "pacote-nao-declarado-999"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.9.3' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'pacote-nao-declarado-999', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    const rule = new NoDisallowedDependencyRule();
    const evalRes = rule.evaluate(facts, target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.9.3: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase493RearchitectureTests().catch(err => {
  console.error('Erro na suíte da Fase 4.9.3:', err);
  process.exit(1);
});
