import * as fs from 'fs';
import * as path from 'path';
import { FormalEvidence, SecurityClaimEvaluation, SecurityDataContract, ThreatModelVector } from '../domain/types';

export class FirestoreSecurityEngine {
  public evaluateRules(targetPath: string, contract?: SecurityDataContract): SecurityClaimEvaluation[] {
    const claims: SecurityClaimEvaluation[] = [];
    const rulesPath = path.resolve(targetPath, 'firestore.rules');

    if (!fs.existsSync(rulesPath)) {
      // Nenhum arquivo firestore.rules encontrado
      return claims;
    }

    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    const blockingReasons: string[] = [];

    // 1. Auditoria de Whitelist vs Blacklist no perfil de usuário
    const userMatch = rulesContent.match(/match\s+\/usuarios\/\{[^}]+\}\s*\{([^}]+)\}/s);
    const userRuleBlock = userMatch ? userMatch[1] : '';

    const usesBlacklist = userRuleBlock.includes('hasAny') || rulesContent.includes('hasAny');
    const usesWhitelist = userRuleBlock.includes('hasOnly') || rulesContent.includes('hasOnly');

    if (usesBlacklist && !usesWhitelist) {
      blockingReasons.push('POLÍTICA DE SEGURANÇA INSEGURA: A regra para /usuarios/{userId} utiliza Blacklist (hasAny) em vez de Whitelist estrita (hasOnly).');
    }

    // 2. Detecção de Runtime e Simulação
    // Verificar se existe um arquivo de teste de regras
    const testFiles = [
      path.resolve(targetPath, 'src/nucleo/firebase/regrasFirestore.test.ts'),
      path.resolve(targetPath, 'src/regrasFirestore.test.ts')
    ];

    let testContent = '';
    let testPathFound = '';
    for (const tf of testFiles) {
      if (fs.existsSync(tf)) {
        testContent = fs.readFileSync(tf, 'utf8');
        testPathFound = tf;
        break;
      }
    }

    const usesRulesTestingSdk = testContent.includes('@firebase/rules-unit-testing') || testContent.includes('initializeTestEnvironment');
    const isSimulationOnly = !usesRulesTestingSdk || testContent.includes('SimuladorLocal') || testContent.includes('evaluarRegra');

    if (isSimulationOnly) {
      blockingReasons.push('EVIDÊNCIA SIMULADA: O teste de regras de segurança é SIMULATION_ONLY e não executa o Firebase Rules Engine real.');
    }

    // 3. Vetores do Threat Model
    const threatVectors: ThreatModelVector[] = [
      { vector_id: 'UNAUTHENTICATED_ACCESS', description: 'Consulta/Alteração por usuário não autenticado', required: true, verified: testContent.includes('DENIED') || testContent.includes('unauthenticated') },
      { vector_id: 'UNAUTHORIZED_MUTATION', description: 'Mutação de perfil por outro usuário normal', required: true, verified: testContent.includes('CONSULTA') || testContent.includes('unauthorized') },
      { vector_id: 'PRIVILEGE_ESCALATION', description: 'Elevação de privilégio alterando nivel/perfil', required: true, verified: testContent.includes('nivel') || testContent.includes('perfil') },
      { vector_id: 'FIELD_INJECTION', description: 'Injeção de campos arbitrários não autorizados', required: true, verified: testContent.includes('hasOnly') },
      { vector_id: 'FIELD_DELETION', description: 'Remoção de campos obrigatórios do documento', required: true, verified: testContent.includes('hasOnly') },
      { vector_id: 'IDENTITY_SWAP', description: 'Alteração de ID ou Email de outro usuário', required: true, verified: testContent.includes('uid') || testContent.includes('Email') },
      { vector_id: 'LEGITIMATE_OPERATION', description: 'Operação legítima autorizada pelo usuário/admin', required: true, verified: testContent.includes('ALLOWED') || testContent.includes('allowed') }
    ];

    const unverifiedRequiredVectors = threatVectors.filter(v => v.required && !v.verified);
    if (unverifiedRequiredVectors.length > 0) {
      blockingReasons.push(`COBERTURA ADVERSARIAL INCOMPLETA: Os vetores [${unverifiedRequiredVectors.map(v => v.vector_id).join(', ')}] não foram comprovadamente verificados.`);
    }

    const formalEvidence: FormalEvidence = {
      evidence_id: `EVD-SEC-FS-${Date.now()}`,
      category: isSimulationOnly ? 'SIMULATION' : (usesRulesTestingSdk ? 'RUNTIME' : 'UNIT'),
      source_artifact: 'firestore.rules',
      test_artifact: testPathFound || undefined,
      runtime_environment: usesRulesTestingSdk ? 'FIREBASE_RULES_EMULATOR' : 'JS_MOCK',
      causality_status: isSimulationOnly ? 'UNVERIFIED' : 'CORRELATED',
      confidence_score: isSimulationOnly ? 0.3 : 0.95,
      source_reliability: isSimulationOnly ? 0.2 : 0.9,
      reproducible: true,
      is_simulation_only: isSimulationOnly,
      payload: {
        usesBlacklist,
        usesWhitelist,
        rulesPath,
        testPathFound
      }
    };

    const isProven = !isSimulationOnly && blockingReasons.length === 0;

    claims.push({
      claim_id: 'SEC-CLAIM-FIRESTORE-001',
      claim_type: 'FIRESTORE_RULES',
      target_artifact: 'firestore.rules',
      evidence: formalEvidence,
      security_contract: contract,
      threat_vectors: threatVectors,
      proven: isProven,
      phase_status: isProven ? 'GREEN' : 'BLOCKED',
      blocking_reasons: blockingReasons
    });

    return claims;
  }
}
