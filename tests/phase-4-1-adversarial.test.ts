import * as assert from 'assert';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { TypescriptAstCollector } from '../EOS/core/collectors/typescript-ast-collector';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Evidence } from '../EOS/core/domain/types';

async function runAdversarialAuditTests() {
  console.log('==================================================');
  console.log('INICIANDO AUDITORIA ADVERSARIAL DA FASE 4.1');
  console.log('==================================================\n');

  const collector = new TypescriptAstCollector();
  const provider = new DependencyFactProvider();
  const rule = new NoDisallowedDependencyRule();
  const target = TargetResolver.resolve('.');

  // TESTE ADVERSARIAL 1: Casing Bypass no Windows (Uppercase Domain/ vs domain/)
  console.log('🔍 Testando Hipótese 41-01: Bypass de Regra por Casing no Windows (Domain/ vs domain/)');
  const evdCasing: Evidence = {
    evidence_id: 'EVD-ADV-01',
    observation_id: 'OBS-ADV-01',
    collector_id: 'typescript-ast-collector-v4',
    source_reference: 'src/Domain/UserService.ts', // 'Domain' com D maiúsculo
    locator: { relative_path: 'src/Domain/UserService.ts', line: 1 },
    source_hash: 'sha1',
    content_hash: 'sha2',
    snippet: '[STATIC IMPORT] import { Db } from "../infrastructure/db" (specifier: "../infrastructure/db")',
    confidence: 1.0,
    provenance: { target_id: target.target_id, collector_version: '4.0.0' },
  };

  const factsCasing = provider.generateFacts([evdCasing]);
  const evalCasing = rule.evaluate(factsCasing, target);
  
  if (evalCasing.evaluation.status === 'PASS') {
    console.log('  🚨 [ACHADO CONFIRMADO 41-01]: Bypass de Casing detectado! "src/Domain/" passou incólume na regra.');
  } else {
    console.log('  ✅ [PASS]: Regra capturou "src/Domain/".');
  }

  // TESTE ADVERSARIAL 2: Divergência de Extensão (.ts vs sem extensão)
  console.log('\n🔍 Testando Hipótese 41-02: Divergência de Extensão em target_module (.ts vs sem extensão)');
  const norm1 = provider.normalizeTargetModule('src/domain/User.ts', '../infra/db');
  const norm2 = provider.normalizeTargetModule('src/domain/User.ts', '../infra/db.ts');

  if (norm1 !== norm2) {
    console.log(`  🚨 [ACHADO CONFIRMADO 41-02]: Módulos equivalentes geram target_module distintos ("${norm1}" vs "${norm2}").`);
  } else {
    console.log('  ✅ [PASS]: Normalização de extensões é equivalente.');
  }

  // TESTE ADVERSARIAL 3: Import com aspas ou caracteres especiais no specifier
  console.log('\n🔍 Testando Hipótese 41-03: Fragilidade de Regex ao extrair specifier de snippet');
  const evdRegex: Evidence = {
    evidence_id: 'EVD-ADV-03',
    observation_id: 'OBS-ADV-03',
    collector_id: 'typescript-ast-collector-v4',
    source_reference: 'src/domain/User.ts',
    locator: { relative_path: 'src/domain/User.ts', line: 1 },
    source_hash: 'sha1',
    content_hash: 'sha2',
    snippet: '[STATIC IMPORT] import { X } from "module-with-specifier: \"inside\"" (specifier: "module-with-specifier: \"inside\"")',
    confidence: 1.0,
    provenance: { target_id: target.target_id, collector_version: '4.0.0' },
  };

  const factsRegex = provider.generateFacts([evdRegex]);
  if (factsRegex.length === 0 || factsRegex[0].payload.fact_type === 'MODULE_DEPENDENCY' && factsRegex[0].payload.target_module.includes('module-with-specifier')) {
    console.log('  ℹ️ [RESULTADO REGEX]: Regex tratou ou descartou import com aspas internas.');
  }

  console.log('\n==================================================');
  console.log('AUDITORIA ADVERSARIAL CONCLUÍDA');
  console.log('==================================================\n');
}

runAdversarialAuditTests().catch(console.error);
