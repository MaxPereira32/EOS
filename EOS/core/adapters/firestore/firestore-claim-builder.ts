import { GovernanceClaim } from '../../domain/universal-contracts';

export class FirestoreClaimBuilder {
  public buildClaims(rulesPath: string): GovernanceClaim[] {
    return [
      {
        claimId: 'CLAIM-FIRESTORE-001',
        requirementId: 'NIST-SSDF-PW.4.4',
        domain: 'Firestore',
        description: 'Verificação de proteção de perfil de usuário com Whitelist estrita e runtime real no Firebase Emulator',
        targetArtifact: rulesPath,
        requiredCategory: 'CAUSALLY_VALIDATED',
        causalityRequirement: {
          required: true,
          strategy: 'WEAKEN_WRITE_RULE',
          minimumKillRatio: 1.0
        },
        provenanceRequirement: {
          required: true,
          strictBindingRequired: true
        }
      }
    ];
  }
}
