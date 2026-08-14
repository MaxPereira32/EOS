import { MutationStrategy } from '../../engines/causality-kill-ratio-engine';

export class FirestoreMutationStrategy {
  public getStrategies(): MutationStrategy[] {
    return [
      {
        mutationId: 'MUT-FS-001-WEAKEN-WRITE',
        description: 'Substituição da trava de escrita de perfil por allow write: if true;',
        applyMutation: (content: string) => {
          return content.replace(/allow\s+(write|update)\s*:[^;]+;/g, 'allow write: if true;');
        }
      },
      {
        mutationId: 'MUT-FS-002-REMOVE-WHITELIST',
        description: 'Remoção do operador de Whitelist (hasOnly)',
        applyMutation: (content: string) => {
          return content.replace(/hasOnly\(([^)]+)\)/g, 'true');
        }
      }
    ];
  }
}
