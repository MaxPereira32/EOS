import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ExecutionManifest, EvidenceState } from '../domain/universal-contracts';

export interface AstReferenceCheck {
  readonly hasValidCallExpression: boolean;
  readonly activeReferenceCount: number;
  readonly deadImportCount: number;
  readonly commentOnlyCount: number;
  readonly isSimulationOnly: boolean;
  readonly rationale: string;
}

export class SubprocessExecutionCollector {

  /**
   * Dispara a execução controlada de um test runner em subprocesso isolado.
   */
  public executeSubprocess(
    command: string,
    args: string[],
    cwd: string,
    env: Record<string, string> = {}
  ): { manifest: ExecutionManifest; state: EvidenceState; stdout: string; stderr: string } {
    const startTime = new Date();
    const sanitizedEnv = { ...process.env, ...env };

    try {
      const fullCmd = `${command} ${args.join(' ')}`;
      const result = child_process.spawnSync(command, args, {
        cwd,
        env: sanitizedEnv,
        encoding: 'utf8',
        timeout: 30000, // 30s timeout
        maxBuffer: 10 * 1024 * 1024
      });

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const manifest: ExecutionManifest = {
        execution_id: `EXEC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        process_id: result.pid || 0,
        command_line: fullCmd,
        working_directory: path.resolve(cwd),
        exit_code: result.status !== null ? result.status : -1,
        stdout_bytes: result.stdout ? Buffer.byteLength(result.stdout, 'utf8') : 0,
        stderr_bytes: result.stderr ? Buffer.byteLength(result.stderr, 'utf8') : 0,
        start_timestamp_iso: startTime.toISOString(),
        end_timestamp_iso: endTime.toISOString(),
        duration_ms: durationMs,
        sanitized_environment: { NODE_ENV: sanitizedEnv.NODE_ENV || 'test' }
      };

      if (result.error || result.status !== 0) {
        return {
          manifest,
          state: 'TOOLING_FAILURE',
          stdout: result.stdout || '',
          stderr: result.stderr || (result.error ? result.error.message : 'Subprocess exited with non-zero code')
        };
      }

      return {
        manifest,
        state: 'EXECUTED',
        stdout: result.stdout || '',
        stderr: result.stderr || ''
      };
    } catch (err: any) {
      const endTime = new Date();
      const manifest: ExecutionManifest = {
        execution_id: `EXEC-ERR-${Date.now()}`,
        process_id: 0,
        command_line: `${command} ${args.join(' ')}`,
        working_directory: path.resolve(cwd),
        exit_code: -1,
        stdout_bytes: 0,
        stderr_bytes: 0,
        start_timestamp_iso: startTime.toISOString(),
        end_timestamp_iso: endTime.toISOString(),
        duration_ms: endTime.getTime() - startTime.getTime(),
        sanitized_environment: {}
      };

      return {
        manifest,
        state: 'TOOLING_FAILURE',
        stdout: '',
        stderr: err.message || 'Falha catastrófica ao disparar subprocesso'
      };
    }
  }

  /**
   * AST Execution Reference Visitor:
   * Examina o AST TypeScript de um arquivo de teste e valida se a SDK/função
   * é realmente INVOCADA em CallExpressions ativas, descartando comentários e imports mortos.
   */
  public analyzeAstExecutionReferences(testFilePath: string, targetSymbols: string[]): AstReferenceCheck {
    if (!fs.existsSync(testFilePath)) {
      return {
        hasValidCallExpression: false,
        activeReferenceCount: 0,
        deadImportCount: 0,
        commentOnlyCount: 1,
        isSimulationOnly: true,
        rationale: 'FALHA DE SINAL AST: Arquivo de teste não existe no caminho informado.'
      };
    }

    const fileContent = fs.readFileSync(testFilePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      testFilePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true // setParentNodes: true
    );

    let activeReferenceCount = 0;
    let deadImportCount = 0;
    let commentOnlyCount = 0;

    // 1. Contar comentários que contêm os símbolos
    const comments = fileContent.match(/\/\/.*/g) || [];
    for (const comment of comments) {
      if (targetSymbols.some(symbol => comment.includes(symbol))) {
        commentOnlyCount++;
      }
    }

    // 2. Visitar nós da AST para encontrar CallExpressions e Imports
    const visit = (node: ts.Node) => {
      // Checar se é CallExpression (Ex: initializeTestEnvironment(...) ou evaluarRegra(...))
      if (ts.isCallExpression(node)) {
        const expressionText = node.expression.getText(sourceFile);
        if (targetSymbols.some(symbol => expressionText.includes(symbol))) {
          activeReferenceCount++;
        }
      }

      // Checar se é ImportDeclaration sem uso
      if (ts.isImportDeclaration(node)) {
        const importText = node.getText(sourceFile);
        if (targetSymbols.some(symbol => importText.includes(symbol))) {
          // Import encontrado, verificar se há chamadas ativas além do import
          deadImportCount++;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Descontar imports da contagem ativada se não houver CallExpressions reais
    const hasValidCall = activeReferenceCount > 0;
    const isSimulationOnly = !hasValidCall;

    let rationale = '';
    if (!hasValidCall && commentOnlyCount > 0) {
      rationale = `FALHA DE EVIDÊNCIA (ATTACK-01 / ATTACK-02): O símbolo reservado foi encontrado apenas em COMENTÁRIOS ou IMPORTS MORTOS (${commentOnlyCount} comentários, ${deadImportCount} imports). Nenhuma CallExpression ativa foi executada.`;
    } else if (!hasValidCall) {
      rationale = 'FALHA DE EVIDÊNCIA AST: Nenhuma invocação de função de segurança real foi detectada na AST.';
    } else {
      rationale = `EVIDÊNCIA AST VÁLIDA: Detectadas ${activeReferenceCount} chamadas de função ativas na AST.`;
    }

    return {
      hasValidCallExpression: hasValidCall,
      activeReferenceCount,
      deadImportCount,
      commentOnlyCount,
      isSimulationOnly,
      rationale
    };
  }
}
