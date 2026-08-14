import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ArtifactFingerprint, EvidenceState } from '../domain/universal-contracts';

export interface ArtifactBindingResult {
  readonly fingerprint: ArtifactFingerprint;
  readonly state: EvidenceState;
  readonly binding_status: 'BOUND' | 'ARTIFACT_MISMATCH' | 'PROVENANCE_INVALID' | 'TOOLING_FAILURE';
  readonly rationale: string;
}

export class ArtifactBindingEngine {

  /**
   * Resolve o caminho real do arquivo (resolvendo symlinks e normalizações)
   * e calcula o hash SHA-256 canônico.
   */
  public calculateFileHash(filePath: string): { sha256: string; realPath: string } | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const realPath = fs.realpathSync(filePath);
      const content = fs.readFileSync(realPath);
      const sha256 = crypto.createHash('sha256').update(content).digest('hex');
      return { sha256, realPath };
    } catch {
      return null;
    }
  }

  /**
   * Audita a proveniência e o vínculo (binding) entre o artefato de produção auditado
   * e o artefato efetivamente carregado/utilizado na execução do teste.
   */
  public verifyBinding(
    productionArtifactPath: string,
    executionArtifactPath?: string,
    testAstPath?: string
  ): ArtifactBindingResult {
    const prodHashRes = this.calculateFileHash(productionArtifactPath);

    if (!prodHashRes) {
      const emptyFingerprint: ArtifactFingerprint = {
        production_sha256: '',
        execution_sha256: '',
        ast_sha256: '',
        is_bound: false,
        resolved_realpath: ''
      };
      return {
        fingerprint: emptyFingerprint,
        state: 'TOOLING_FAILURE',
        binding_status: 'TOOLING_FAILURE',
        rationale: `FALHA DE ARTEFATO: O artefato de produção auditado '${productionArtifactPath}' não foi encontrado.`
      };
    }

    const execPath = executionArtifactPath || productionArtifactPath;
    const execHashRes = this.calculateFileHash(execPath);

    const astPath = testAstPath || productionArtifactPath;
    const astHashRes = this.calculateFileHash(astPath);

    const prodHash = prodHashRes.sha256;
    const execHash = execHashRes ? execHashRes.sha256 : '';
    const astHash = astHashRes ? astHashRes.sha256 : '';

    // Testar Mismatch de Hash ou Mismatch de Realpath (substituição de Symlink ou Fake Artifact)
    const isSameRealpath = prodHashRes.realPath === (execHashRes ? execHashRes.realPath : prodHashRes.realPath);
    const isHashMatch = prodHash === execHash;

    const isBound = isHashMatch && isSameRealpath;

    const fingerprint: ArtifactFingerprint = {
      production_sha256: prodHash,
      execution_sha256: execHash,
      ast_sha256: astHash,
      is_bound: isBound,
      resolved_realpath: prodHashRes.realPath
    };

    if (!isSameRealpath) {
      return {
        fingerprint,
        state: 'ARTIFACT_MISMATCH',
        binding_status: 'ARTIFACT_MISMATCH',
        rationale: `FALHA CRÍTICA DE VÍNCULO (ATTACK-13 / ATTACK-06): O artefato executado ('${execHashRes?.realPath}') difere fisicamente do caminho real do artefato auditado ('${prodHashRes.realPath}').`
      };
    }

    if (!isHashMatch) {
      return {
        fingerprint,
        state: 'ARTIFACT_MISMATCH',
        binding_status: 'ARTIFACT_MISMATCH',
        rationale: `FALHA CRÍTICA DE PROVENIÊNCIA (ATTACK-06 / ATTACK-14): Hash SHA-256 do artefato executado (${execHash}) não coincide com o artefato de produção (${prodHash}).`
      };
    }

    return {
      fingerprint,
      state: 'COLLECTED',
      binding_status: 'BOUND',
      rationale: 'ARTEFATO VINCULADO COM SUCESSO: Tripla de proveniência criptográfica (Production SHA-256, Execution SHA-256, Realpath) verificada e associada.'
    };
  }
}
