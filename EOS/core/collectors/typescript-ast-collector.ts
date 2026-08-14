import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as ts from 'typescript';
import { AuditTarget, Evidence, FileArtifact } from '../domain/types';

export interface AstImportExtracted {
  readonly module_specifier: string;
  readonly import_type: 'STATIC' | 'DYNAMIC';
  readonly line: number;
  readonly snippet: string;
}

export class TypescriptAstCollector {
  private readonly collectorId = 'typescript-ast-collector-v4';
  private readonly collectorVersion = '4.2.0';

  /**
   * Analisa estática e segura do conteúdo TypeScript (READ-ONLY)
   * NUNCA executa o código ou avalia JavaScript.
   */
  public parseSource(relativeFilePath: string, sourceText: string): AstImportExtracted[] {
    const imports: AstImportExtracted[] = [];

    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(
        relativeFilePath,
        sourceText,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        ts.ScriptKind.TS
      );
    } catch {
      return [];
    }

    const visitNode = (node: ts.Node) => {
      // 1. Importations Estáticas: import { X } from './module'; import './module'; import * as X from './module';
      if (ts.isImportDeclaration(node)) {
        const importDecl = node as ts.ImportDeclaration;
        if (importDecl.moduleSpecifier && ts.isStringLiteral(importDecl.moduleSpecifier)) {
          const specifier = importDecl.moduleSpecifier.text;
          const startPos = node.getStart(sourceFile);
          const { line } = sourceFile.getLineAndCharacterOfPosition(startPos);
          const snippet = sourceText.substring(startPos, node.getEnd()).trim();

          imports.push({
            module_specifier: specifier,
            import_type: 'STATIC',
            line: line + 1,
            snippet: snippet,
          });
        }
      }

      // 2. Importations Dinâmicas: import('./module')
      else if (ts.isCallExpression(node)) {
        const callExpr = node as ts.CallExpression;
        if (callExpr.expression.kind === ts.SyntaxKind.ImportKeyword) {
          if (callExpr.arguments.length > 0 && ts.isStringLiteral(callExpr.arguments[0])) {
            const specifier = (callExpr.arguments[0] as ts.StringLiteral).text;
            const startPos = node.getStart(sourceFile);
            const { line } = sourceFile.getLineAndCharacterOfPosition(startPos);
            const snippet = sourceText.substring(startPos, node.getEnd()).trim();

            imports.push({
              module_specifier: specifier,
              import_type: 'DYNAMIC',
              line: line + 1,
              snippet: snippet,
            });
          }
        }
      }

      // 3. Re-export Declarations: export { X } from './module'; export * from './module'
      else if (ts.isExportDeclaration(node)) {
        const exportDecl = node as ts.ExportDeclaration;
        if (exportDecl.moduleSpecifier && ts.isStringLiteral(exportDecl.moduleSpecifier)) {
          const specifier = exportDecl.moduleSpecifier.text;
          const startPos = node.getStart(sourceFile);
          const { line } = sourceFile.getLineAndCharacterOfPosition(startPos);
          const snippet = sourceText.substring(startPos, node.getEnd()).trim();

          imports.push({
            module_specifier: specifier,
            import_type: 'STATIC',
            line: line + 1,
            snippet: snippet,
          });
        }
      }

      ts.forEachChild(node, visitNode);
    };

    ts.forEachChild(sourceFile, visitNode);
    return imports;
  }

  public async collectFromArtifacts(target: AuditTarget, artifacts: readonly FileArtifact[]): Promise<Evidence[]> {
    const evidences: Evidence[] = [];
    const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];

    for (const art of artifacts) {
      if (art.status !== 'ACCESSIBLE') continue;
      if (!validExtensions.includes(art.file_extension.toLowerCase())) continue;

      let content: string;
      try {
        content = fs.readFileSync(art.absolute_path, 'utf-8');
      } catch {
        continue;
      }

      const extractedImports = this.parseSource(art.relative_path, content);
      const sourceHash = art.sha256_hash || crypto.createHash('sha256').update(content).digest('hex');

      for (const imp of extractedImports) {
        const snippetHash = crypto.createHash('sha256').update(`${imp.snippet}:${imp.line}`).digest('hex');
        const obsId = `OBS-AST-${crypto.createHash('md5').update(`${target.target_id}:${art.relative_path}:${imp.line}`).digest('hex').slice(0, 12)}`;
        const evdId = `EVD-AST-${crypto.createHash('md5').update(`${obsId}:${imp.module_specifier}:${imp.line}`).digest('hex').slice(0, 12)}`;

        evidences.push({
          evidence_id: evdId,
          observation_id: obsId,
          collector_id: this.collectorId,
          source_reference: art.relative_path,
          locator: {
            relative_path: art.relative_path,
            line: imp.line,
          },
          source_hash: sourceHash,
          content_hash: snippetHash,
          snippet: `[${imp.import_type} IMPORT] ${imp.snippet} (specifier: "${imp.module_specifier}")`,
          confidence: 1.0,
          provenance: {
            target_id: target.target_id,
            collector_version: this.collectorVersion,
          },
          ast_metadata: {
            kind: 'MODULE_IMPORT',
            specifier: imp.module_specifier,
            import_type: imp.import_type,
          },
        });
      }
    }

    return evidences;
  }
}
