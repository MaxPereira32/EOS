/**
 * EOS AUTONOMOUS PATCH APPLIER ENGINE (v2.2.0)
 * 
 * Takes Machine-Actionable Remediation objects containing Unified Diff patches
 * and applies them directly to target files in the workspace.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Remediation } from '../domain-graph';

export interface ApplyResult {
  fix_id: string;
  success: boolean;
  applied_files: string[];
  message: string;
}

export class PatchApplierEngine {
  /**
   * Aplica autonomamente as alterações descritas em um patch Unified Diff
   */
  public applyPatch(remediation: Remediation, rootDir: string = process.cwd()): ApplyResult {
    if (!remediation.patch_diff || remediation.patch_diff.trim() === '') {
      return {
        fix_id: remediation.fix_id,
        success: false,
        applied_files: [],
        message: 'Nenhum patch_diff válido fornecido no objeto de remediação.',
      };
    }

    const appliedFiles: string[] = [];

    try {
      // Divide o diff por blocos de arquivo ("--- a/" ...)
      const fileBlocks = remediation.patch_diff.split(/(?=--- a\/)/);

      for (const block of fileBlocks) {
        if (!block.trim()) continue;

        const headerMatch = block.match(/--- a\/(.+)\r?\n\+\+\+ b\/(.+)/);
        if (!headerMatch) continue;

        const targetRelativePath = headerMatch[2].trim();
        const absolutePath = path.join(rootDir, targetRelativePath);

        if (!fs.existsSync(absolutePath)) {
          // Se o arquivo não existir, cria o diretório e o arquivo se necessário
          const dir = path.dirname(absolutePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        // Aplica modificações simples de adição de linhas (+)
        const linesToAdd: string[] = [];
        const lines = block.split('\n');

        lines.forEach((line) => {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            linesToAdd.push(line.slice(1));
          }
        });

        if (linesToAdd.length > 0) {
          const currentContent = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
          const newContent = currentContent ? `${currentContent}\n${linesToAdd.join('\n')}` : linesToAdd.join('\n');
          
          fs.writeFileSync(absolutePath, newContent, 'utf8');
          appliedFiles.push(targetRelativePath);
        }
      }

      return {
        fix_id: remediation.fix_id,
        success: true,
        applied_files: appliedFiles,
        message: `Patch aplicado com sucesso nos arquivos: ${appliedFiles.join(', ')}`,
      };
    } catch (err: any) {
      return {
        fix_id: remediation.fix_id,
        success: false,
        applied_files: [],
        message: `Falha ao aplicar patch: ${err.message}`,
      };
    }
  }
}
