/**
 * EOS CORE SERVICES — REPOSITORY IDENTITY REGISTRY
 * Maps ProjectId to canonical RepositoryRoot on disk.
 * Prevents arbitrary unauthenticated or cross-project path injection attacks.
 */

import * as path from 'path';

export interface RepositoryIdentity {
  readonly projectId: string;
  readonly repositoryRoot: string;
  readonly canonicalName: string;
}

export class RepositoryIdentityRegistry {
  private static registeredProjects: Map<string, RepositoryIdentity> = new Map();

  static {
    // Default fallback mappings for workspace projects
    const root = process.cwd();
    this.registerProject({
      projectId: 'project-alpha',
      repositoryRoot: root,
      canonicalName: 'EOS Master Repository'
    });
    this.registerProject({
      projectId: 'proj-omega',
      repositoryRoot: root,
      canonicalName: 'Project Omega Repository'
    });
    this.registerProject({
      projectId: 'proj-restart',
      repositoryRoot: root,
      canonicalName: 'Project Restart Repository'
    });
    this.registerProject({
      projectId: 'proj-export',
      repositoryRoot: root,
      canonicalName: 'Project Export Repository'
    });
    this.registerProject({
      projectId: 'proj-conc',
      repositoryRoot: root,
      canonicalName: 'Project Concurrent Repository'
    });
    this.registerProject({
      projectId: 'proj-legacy',
      repositoryRoot: root,
      canonicalName: 'Project Legacy Repository'
    });
  }

  public static registerProject(identity: RepositoryIdentity): void {
    if (!identity || !identity.projectId || !identity.repositoryRoot) {
      throw new Error('REPOSITORY_IDENTITY_ERROR: projectId e repositoryRoot são obrigatórios.');
    }
    const normalized = path.normalize(identity.repositoryRoot).toLowerCase();
    this.registeredProjects.set(identity.projectId, {
      ...identity,
      repositoryRoot: normalized
    });
  }

  public static validateProjectRepository(projectId: string, candidateRoot: string): void {
    if (!projectId) {
      throw new Error('SECURITY_VIOLATION_INVALID_PROJECT_ID: O projectId é obrigatório.');
    }

    const registered = this.registeredProjects.get(projectId);
    const normalizedCandidate = path.normalize(candidateRoot).toLowerCase();

    // Se o projeto estiver cadastrado na identidade do repositório, valida obrigatoriamente a raiz
    if (registered && registered.repositoryRoot !== normalizedCandidate) {
      throw new Error(`SECURITY_VIOLATION_REPOSITORY_IDENTITY_MISMATCH: O projeto '${projectId}' está vinculado ao repositório '${registered.repositoryRoot}', mas a tentativa de execução apontou para '${normalizedCandidate}'.`);
    }
  }

  public static getRegisteredIdentity(projectId: string): RepositoryIdentity | null {
    return this.registeredProjects.get(projectId) || null;
  }
}
