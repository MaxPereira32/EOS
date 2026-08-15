/**
 * EOS CORE SERVICES — REPOSITORY IDENTITY REGISTRY (v3.1.1 DENY-BY-DEFAULT)
 * Maps ProjectId to canonical RepositoryRoot on disk.
 * DENY-BY-DEFAULT SECURITY POLICY: Unregistered projects are STRICTLY REJECTED.
 * Prevents arbitrary unauthenticated or cross-project path injection attacks.
 */

import * as path from 'path';
import * as fs from 'fs';

export interface RepositoryIdentity {
  readonly projectId: string;
  readonly repositoryRoot: string;
  readonly canonicalName: string;
}

export class RepositoryIdentityRegistry {
  private static registeredProjects: Map<string, RepositoryIdentity> = new Map();

  static {
    // DENY-BY-DEFAULT: Nenhum projeto é registrado implicitamente.
  }

  public static registerProject(identity: RepositoryIdentity): void {
    if (!identity || !identity.projectId || !identity.repositoryRoot) {
      throw new Error('REPOSITORY_IDENTITY_ERROR: projectId e repositoryRoot são obrigatórios.');
    }

    if (this.registeredProjects.has(identity.projectId)) {
      throw new Error(`SECURITY_VIOLATION_PROJECT_OVERWRITE: O projeto '${identity.projectId}' já está registrado.`);
    }

    const normalized = path.normalize(identity.repositoryRoot).toLowerCase();
    
    if (normalized.includes('..')) {
      throw new Error(`SECURITY_VIOLATION_INVALID_ROOT: Path de repositório malicioso ou relativo bloqueado.`);
    }

    if (!fs.existsSync(normalized)) {
      throw new Error(`SECURITY_VIOLATION_INVALID_ROOT: O diretório do repositório '${normalized}' não existe no disco.`);
    }

    this.registeredProjects.set(identity.projectId, {
      ...identity,
      repositoryRoot: normalized
    });
  }

  /**
   * DENY-BY-DEFAULT VALIDATION POLICY:
   * 1. projectId não fornecido -> REJECT
   * 2. projectId não registrado -> REJECT (SECURITY_VIOLATION_UNREGISTERED_PROJECT)
   * 3. repositoryRoot não coincide -> REJECT (SECURITY_VIOLATION_REPOSITORY_IDENTITY_MISMATCH)
   * 4. Apenas projetos cadastrados com raízes válidas -> ALLOW
   */
  public static validateProjectRepository(projectId: string, candidateRoot: string): void {
    if (!projectId) {
      throw new Error('SECURITY_VIOLATION_INVALID_PROJECT_ID: O projectId é obrigatório.');
    }

    if (!candidateRoot) {
      throw new Error('SECURITY_VIOLATION_INVALID_REPOSITORY_ROOT: O repositoryRoot é obrigatório.');
    }

    const registered = this.registeredProjects.get(projectId);

    // DENY-BY-DEFAULT: Projetos não registrados são BLOQUEADOS imediatamente
    if (!registered) {
      throw new Error(`SECURITY_VIOLATION_UNREGISTERED_PROJECT: O projeto '${projectId}' não está registrado no RepositoryIdentityRegistry (Deny-By-Default).`);
    }

    const normalizedCandidate = path.normalize(candidateRoot).toLowerCase();

    if (registered.repositoryRoot !== normalizedCandidate) {
      throw new Error(`SECURITY_VIOLATION_REPOSITORY_IDENTITY_MISMATCH: O projeto '${projectId}' está vinculado ao repositório '${registered.repositoryRoot}', mas a tentativa de execução apontou para '${normalizedCandidate}'.`);
    }
  }

  public static getRegisteredIdentity(projectId: string): RepositoryIdentity | null {
    return this.registeredProjects.get(projectId) || null;
  }

  public static unregisterProject(projectId: string): boolean {
    return this.registeredProjects.delete(projectId);
  }

  public static reset(): void {
    this.registeredProjects.clear();
  }
}
