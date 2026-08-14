import * as fs from 'fs';
import * as path from 'path';
import { GovernanceClaim, EvidenceEnvelope, EvidenceState } from '../../domain/universal-contracts';
import { SubprocessExecutionCollector } from '../../collectors/subprocess-execution-collector';
import { ArtifactBindingEngine } from '../../engines/artifact-binding-engine';
import { CausalityKillRatioEngine } from '../../engines/causality-kill-ratio-engine';
import { FirestoreClaimBuilder } from './firestore-claim-builder';
import { FirestoreMutationStrategy } from './firestore-mutation-strategy';

export class FirestoreDomainAdapter {
  public readonly domain_name = 'Firestore';

  private claimBuilder = new FirestoreClaimBuilder();
  private mutationStrategy = new FirestoreMutationStrategy();
  private subprocessCollector = new SubprocessExecutionCollector();
  private bindingEngine = new ArtifactBindingEngine();
  private causalityEngine = new CausalityKillRatioEngine();

  public async discoverArtifacts(rootPath: string): Promise<string[]> {
    const rulesPath = path.resolve(rootPath, 'firestore.rules');
    if (fs.existsSync(rulesPath)) {
      return ['firestore.rules'];
    }
    return [];
  }

  public async buildClaims(artifacts: string[]): Promise<GovernanceClaim[]> {
    const claims: GovernanceClaim[] = [];
    for (const art of artifacts) {
      claims.push(...this.claimBuilder.buildClaims(art));
    }
    return claims;
  }

  public async executeCapture(claim: GovernanceClaim, rootPath: string): Promise<EvidenceEnvelope> {
    const rulesPath = path.resolve(rootPath, claim.targetArtifact);
    
    // Procurar arquivo de teste associado
    const candidateTests = [
      path.resolve(rootPath, 'src/nucleo/firebase/regrasFirestore.test.ts'),
      path.resolve(rootPath, 'src/regrasFirestore.test.ts')
    ];

    let testPathFound = '';
    for (const cand of candidateTests) {
      if (fs.existsSync(cand)) {
        testPathFound = cand;
        break;
      }
    }

    const blockingReasons: string[] = [];

    // 1. AST Reference Validation (Invocação de funções ativas em CallExpressions, descarte de comentários)
    const astRef = this.subprocessCollector.analyzeAstExecutionReferences(testPathFound, [
      'initializeTestEnvironment',
      'assertSucceeds',
      'assertFails'
    ]);

    let state: EvidenceState = 'OBSERVED';
    const isSimulationOnly = astRef.isSimulationOnly;

    if (isSimulationOnly) {
      blockingReasons.push(astRef.rationale);
      state = 'SIMULATION_ONLY';
    }

    // 2. Artifact Binding Proof
    const bindingRes = this.bindingEngine.verifyBinding(rulesPath, rulesPath, testPathFound);
    if (bindingRes.state === 'ARTIFACT_MISMATCH' || bindingRes.state === 'TOOLING_FAILURE') {
      blockingReasons.push(bindingRes.rationale);
      state = bindingRes.state;
    }

    // 3. Causality & Kill Ratio Verification
    if (!isSimulationOnly && testPathFound) {
      const causalityRes = this.causalityEngine.evaluateCausality(
        rootPath,
        claim.targetArtifact,
        testPathFound,
        this.mutationStrategy.getStrategies(),
        claim.causalityRequirement.minimumKillRatio
      );

      if (!causalityRes.causalityResult.isCausallyValidated) {
        blockingReasons.push(causalityRes.causalityResult.rationale);
        state = 'CAUSALITY_FAILED';
      } else if (state !== 'ARTIFACT_MISMATCH' && state !== 'TOOLING_FAILURE') {
        state = 'SECURITY_PROVEN';
      }
    }

    // 4. Verificação adicional de Blacklist vs Whitelist no conteúdo das regras
    if (fs.existsSync(rulesPath)) {
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');
      if (rulesContent.includes('hasAny') && !rulesContent.includes('hasOnly')) {
        blockingReasons.push('POLÍTICA INSEGURA (Blacklist): A regra utiliza hasAny em vez de Whitelist estrita (hasOnly).');
        state = 'BLOCKED';
      }
    }

    // Gerar HMAC Signature do Envelope
    const signaturePayload = `${claim.claimId}:${rulesPath}:${state}:${isSimulationOnly}:${Date.now()}`;
    const hmacSignature = require('crypto').createHash('sha256').update(signaturePayload).digest('hex');

    return {
      envelopeId: `ENV-FS-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      claimId: claim.claimId,
      targetArtifact: claim.targetArtifact,
      category: isSimulationOnly ? 'SIMULATION' : (state === 'SECURITY_PROVEN' ? 'SECURITY_PROVEN' : 'UNIT'),
      state: blockingReasons.length > 0 && state === 'OBSERVED' ? 'BLOCKED' : state,
      fingerprint: bindingRes.fingerprint,
      is_simulation_only: isSimulationOnly,
      blocking_reasons: blockingReasons,
      hmac_signature: hmacSignature
    };
  }
}
