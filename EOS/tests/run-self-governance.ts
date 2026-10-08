import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FirestoreSecurityEngine } from '../core/engines/firestore-security-engine';
import { CausalityMutationEngine } from '../core/engines/causality-mutation-engine';
import { HardQualityGateEngine } from '../core/engines/hard-quality-gate-engine';
import { GeneratedAppSecurityEngine } from '../core/engines/generated-app-security-engine';
import { RuleCatalog } from '../core/rules/rule-catalog';
import { SecurityClaimEvaluation, FormalEvidence } from '../core/domain/types';

console.log('======================================================');
console.log('  🛡️ EXECUÇÃO DA SUÍTE DE SELF-GOVERNANCE DO EOS');
console.log('======================================================\n');

const causalityEngine = new CausalityMutationEngine();
const hardGateEngine = new HardQualityGateEngine();

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    failed++;
  }
}

// TEST 1: CASE B
const evidenceB: FormalEvidence = {
  evidence_id: 'EVD-TEST-001',
  category: 'SIMULATION',
  source_artifact: 'firestore.rules',
  test_artifact: 'src/nucleo/firebase/regrasFirestore.test.ts',
  runtime_environment: 'JS_MOCK',
  causality_status: 'UNVERIFIED',
  confidence_score: 0.3,
  source_reliability: 0.2,
  reproducible: true,
  is_simulation_only: true
};

const claimB: SecurityClaimEvaluation = {
  claim_id: 'SEC-TEST-001',
  claim_type: 'FIRESTORE_RULES',
  target_artifact: 'firestore.rules',
  evidence: evidenceB,
  threat_vectors: [],
  proven: false,
  phase_status: 'BLOCKED',
  blocking_reasons: ['EVIDÊNCIA SIMULADA']
};

const resB = hardGateEngine.evaluateHardGates([claimB], [], true, 100);
assert(resB.overall_phase_status === 'BLOCKED', 'CASE B: Regra correta + Teste Simulation Only deve resultar em BLOCKED');
assert(resB.can_grant_green === false, 'CASE B: can_grant_green deve ser FALSE');

// TEST 2: CASE C
const mutResC = causalityEngine.evaluateCausality('cebus', evidenceB);
assert(mutResC.causality_proven === false, 'CASE C: Regra permissiva + Teste simulado deve falhar na Causalidade');

// TEST 3: CASE G
const resG = hardGateEngine.evaluateHardGates([claimB], [], true, 100);
assert(resG.overall_phase_status === 'BLOCKED', 'CASE G: Score 100 com Hard Gate crítico ausente NÃO PODE conceder GREEN');

// TEST 4: CASE H
assert(mutResC.mutated_status === 'PASS', 'CASE H: Teste simulado continua fornecendo PASS após mutação (comprovando falha de causação)');

// TEST 5: Taxonomia e catálogo das regras estáticas (Fases A/D)
const taxonomyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-selfgov-taxonomy-'));
try {
  fs.writeFileSync(path.join(taxonomyRoot, 'routes.py'), [
    '@api.route("/items", methods=["POST"])',
    '@jwt_required(optional=True)',
    'def create():',
    '    payload = dict(request.get_json())',
    '    for field in payload:',
    '        if hasattr(ItemModel, field):',
    '            datas2db[field] = payload[field]',
    '    item = ItemModel(**datas2db)',
  ].join('\n'));
  const scan = new GeneratedAppSecurityEngine().scan(taxonomyRoot, 'TGT-SELF-GOV', false);
  const massAssignment = scan.findings.find(finding => finding.finding_id.startsWith('EOS-GENAI-PY-MASSASSIGN-001'));
  assert(
    massAssignment?.taxonomy?.cwe_id === 'CWE-915: Improperly Controlled Modification of Dynamically-Determined Object Attributes',
    'CASE I: mass-assignment deve carregar a taxonomia CWE-915',
  );
  assert(
    RuleCatalog.getRule('EOS-GENAI-PY-MASSASSIGN-001') !== undefined,
    'CASE J: regra estática deve resolver no RuleCatalog',
  );
} finally {
  fs.rmSync(taxonomyRoot, { recursive: true, force: true });
}

console.log('\n------------------------------------------------------');
console.log(`RESULTADO FINAL DA SUÍTE DE SELF-GOVERNANCE: ${passed} PASSED, ${failed} FAILED.`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
