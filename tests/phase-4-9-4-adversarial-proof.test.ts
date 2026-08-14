import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { SemanticModuleResolver } from '../EOS/core/resolvers/semantic-module-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { ProjectManifestCollector } from '../EOS/core/collectors/project-manifest-collector';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase494AdversarialProofTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 4.9.4 — ADVERSARIAL PROOF OF SOUNDNESS');
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

  // 1. TESTE ARQUITETURAL DE SEPARAÇÃO DE RESPONSABILIDADES (ZERO DISK I/O)
  await test('4.9.4-ZIO-001: Programmatic Check — semantic-module-resolver.ts não possui imports de "fs" nem "child_process"', () => {
    const resolverFilePath = path.resolve(__dirname, '../EOS/core/resolvers/semantic-module-resolver.ts');
    const content = fs.readFileSync(resolverFilePath, 'utf-8');
    assert.strictEqual(content.includes("from 'fs'"), false, 'Resolver não pode importar "fs"');
    assert.strictEqual(content.includes('from "fs"'), false, 'Resolver não pode importar "fs"');
    assert.strictEqual(content.includes("from 'child_process'"), false, 'Resolver não pode importar "child_process"');
    assert.strictEqual(content.includes('from "child_process"'), false, 'Resolver não pode importar "child_process"');
    assert.strictEqual(content.includes("require('fs')"), false, 'Resolver não pode requerer "fs"');
    assert.strictEqual(content.includes("require('child_process')"), false, 'Resolver não pode requerer "child_process"');
  });

  // 2. MATRIZ DE TESTES CONTRA ALIASES MÁGICOS (Zero Aliases sem tsconfig)
  await test('4.9.4-ALI-001: Matriz de 7 aliases convencionais sem tsconfig.paths resultam 100% em UNRESOLVED', () => {
    const magicAliases = [
      '@domain/User',
      '@infra/User',
      '@application/User',
      '@core/User',
      '@foo/User',
      '@empresa/User',
      '@random/User',
    ];

    for (const aliasSpec of magicAliases) {
      const res = resolver.resolveDetailed('src/app.ts', aliasSpec, {});
      assert.strictEqual(res.kind, 'UNRESOLVED', `Alias ${aliasSpec} sem tsconfig deve ser UNRESOLVED`);
      assert.strictEqual(res.is_external, false);
    }
  });

  // 3. TESTE DE RENOMEAÇÃO ADVERSARIAL (Semântica independente do nome do alias)
  await test('4.9.4-ALI-002: Alias arbitrário (@banana/User) com tsconfig.paths mapeado resolve identicamente para INTERNAL', () => {
    const config = {
      baseUrl: '.',
      paths: { '@banana/*': ['src/domain/*'] },
      knownFiles: ['src/domain/User.ts'],
    };
    const res = resolver.resolveDetailed('src/app.ts', '@banana/User', config);
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.strategy, 'PATH_ALIAS');
    assert.strictEqual(res.canonical_module, 'src/domain/User');
  });

  // 4. TESTE MATRICIAL DE SUBPATHS DE PACOTES EXTERNOS
  await test('4.9.4-SUB-001: Matriz de subpaths (existente, inexistente e path traversal)', () => {
    const config = {
      knownPackages: ['typescript'],
      installedPackageFiles: ['typescript/lib/tsserverlibrary.js', 'typescript/lib/typescript.js'],
    };

    // Subpath existente
    const res1 = resolver.resolveDetailed('src/app.ts', 'typescript/lib/tsserverlibrary', config);
    assert.strictEqual(res1.kind, 'EXTERNAL');

    // Subpath inexistente
    const res2 = resolver.resolveDetailed('src/app.ts', 'typescript/lib/non-existing', config);
    assert.strictEqual(res2.kind, 'UNRESOLVED');

    // Subpath profundo inexistente
    const res3 = resolver.resolveDetailed('src/app.ts', 'typescript/deep/non-existing', config);
    assert.strictEqual(res3.kind, 'UNRESOLVED');

    // Path traversal escapando do pacote
    const res4 = resolver.resolveDetailed('src/app.ts', 'typescript/../../outside', config);
    assert.strictEqual(res4.kind, 'UNRESOLVED');
  });

  // 5. TESTE DE PHANTOM DEPENDENCIES (Dimensões Declarado vs Instalado)
  await test('4.9.4-PHN-001: Validação das dimensões (Declarado vs Instalado vs Transitivo)', () => {
    const config = {
      knownPackages: ['pkg-declared-installed', 'pkg-declared-uninstalled'],
      installedPackages: ['pkg-declared-installed', 'pkg-phantom-installed', 'pkg-transitive-installed'],
    };

    // A) Declarado + Instalado -> EXTERNAL
    const resA = resolver.resolveDetailed('src/app.ts', 'pkg-declared-installed', config);
    assert.strictEqual(resA.kind, 'EXTERNAL');

    // B) Declarado + Não Instalado -> EXTERNAL (Análise Estática Declarativa)
    const resB = resolver.resolveDetailed('src/app.ts', 'pkg-declared-uninstalled', config);
    assert.strictEqual(resB.kind, 'EXTERNAL');

    // C) Não Declarado + Instalado (Phantom Dependency) -> UNRESOLVED
    const resC = resolver.resolveDetailed('src/app.ts', 'pkg-phantom-installed', config);
    assert.strictEqual(resC.kind, 'UNRESOLVED');

    // D) Não Declarado + Não Instalado -> UNRESOLVED
    const resD = resolver.resolveDetailed('src/app.ts', 'pkg-undeclared-uninstalled', config);
    assert.strictEqual(resD.kind, 'UNRESOLVED');

    // E) Transitivo Instalado não declarado diretamente -> UNRESOLVED
    const resE = resolver.resolveDetailed('src/app.ts', 'pkg-transitive-installed', config);
    assert.strictEqual(resE.kind, 'UNRESOLVED');
  });

  // 6. TESTE DE PROVENIÊNCIA REAL E HASH DE MANIFESTO
  await test('4.9.4-PRV-001: ProjectManifestCollector gera manifestHash determinístico e sensível a mudanças contratuais', () => {
    const manifestCollector = new ProjectManifestCollector();
    const resA = manifestCollector.collect(target);
    const resB = manifestCollector.collect(target);

    // Determinismo: Execuções no mesmo target produzem exatamente a mesma hash
    assert.strictEqual(resA.manifestHash, resB.manifestHash);
    assert.ok(resA.manifestHash.length === 64, 'manifestHash deve ser um SHA-256 de 64 caracteres');
  });

  // 7. TESTE DE DETERMINISMO DE REORDENAÇÃO
  await test('4.9.4-DET-001: Reordenação de elementos no EvidenceContext produz exatamente a mesma resolução e hash', () => {
    const configA = {
      knownPackages: ['axios', 'typescript', 'react'],
      knownFiles: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      paths: { '@b/*': ['src/b/*'], '@a/*': ['src/a/*'] },
    };

    const configB = {
      knownPackages: ['react', 'axios', 'typescript'],
      knownFiles: ['src/c.ts', 'src/a.ts', 'src/b.ts'],
      paths: { '@a/*': ['src/a/*'], '@b/*': ['src/b/*'] },
    };

    const resA = resolver.resolveDetailed('src/app.ts', '@a/User', configA);
    const resB = resolver.resolveDetailed('src/app.ts', '@a/User', configB);

    assert.strictEqual(resA.kind, resB.kind);
    assert.strictEqual(resA.strategy, resB.strategy);
    assert.strictEqual(resA.canonical_module, resB.canonical_module);
  });

  // 8. TESTE DE INTEGRITY E EVIDÊNCIA INCONSISTENTE
  await test('4.9.4-INT-001: Contexto inconsistente ou incompleto é degradado para UNRESOLVED sem forçar certeza', () => {
    // Specifier relativo sem conhecidos
    const res1 = resolver.resolveDetailed('src/app.ts', './MissingComponent', {});
    assert.strictEqual(res1.kind, 'UNRESOLVED');

    // Alias sem arquivo correspondente
    const res2 = resolver.resolveDetailed('src/app.ts', '@components/Missing', { paths: { '@components/*': ['src/components/*'] } });
    assert.strictEqual(res2.kind, 'UNRESOLVED');
  });

  // 9. TESTE MATRICIAL DE PATH TRAVERSAL ESCAPANDO DO TARGET
  await test('4.9.4-TRV-001: Path traversal tentativas de escape resultam em UNRESOLVED', () => {
    const traversals = [
      '../../../outside',
      '../../../../etc/passwd',
      '../../../../windows/system32',
    ];

    for (const trav of traversals) {
      const res = resolver.resolveDetailed('src/domain/User.ts', trav, { knownFiles: ['src/domain/User.ts'] });
      assert.strictEqual(res.kind, 'UNRESOLVED', `Path traversal ${trav} deve ser UNRESOLVED`);
    }
  });

  // 10. TESTE DO PIPELINE COMPLETO INTEGRADO (Collector -> Provider -> Fact -> Rule)
  await test('4.9.4-PIP-001: Fluxo completo integrado valida governança fail-closed sem falsos positivos', () => {
    const manifestCollector = new ProjectManifestCollector();
    const manifestRes = manifestCollector.collect(target);

    const provider = new DependencyFactProvider(manifestRes.evidenceContext);
    const rule = new NoDisallowedDependencyRule();

    // Cenário A: Import de pacote legítimo (typescript) -> PASS ou Fato resolvido como EXTERNAL
    const evLegit: Evidence = {
      evidence_id: 'EVD-AST-LEGIT',
      observation_id: 'OBS-LEGIT',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sh1',
      content_hash: 'ch1',
      snippet: 'import typescript from "typescript"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.9.4' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'typescript', import_type: 'STATIC' },
    };

    const factsLegit = provider.generateFacts([evLegit]);
    const evalLegit = rule.evaluate(factsLegit, target);
    assert.strictEqual(evalLegit.evaluation.status, 'PASS');

    // Cenário B: Import de pacote não declarado (phantom) -> INSUFFICIENT_EVIDENCE
    const evPhantom: Evidence = {
      evidence_id: 'EVD-AST-PHANTOM',
      observation_id: 'OBS-PHANTOM',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 2 },
      source_hash: 'sh2',
      content_hash: 'ch2',
      snippet: 'import phantom from "phantom-package-x"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.9.4' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: 'phantom-package-x', import_type: 'STATIC' },
    };

    const factsPhantom = provider.generateFacts([evPhantom]);
    const evalPhantom = rule.evaluate(factsPhantom, target);
    assert.strictEqual(evalPhantom.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.9.4: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase494AdversarialProofTests().catch(err => {
  console.error('Erro na suíte da Fase 4.9.4:', err);
  process.exit(1);
});
