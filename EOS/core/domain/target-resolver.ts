import { AuditTarget } from './types';

export interface TargetResolver {
  resolve(inputPath: string): AuditTarget;
}
