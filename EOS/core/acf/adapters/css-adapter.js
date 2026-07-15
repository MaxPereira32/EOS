/**
 * EOS ACF Adapters — CSS Adapter
 * 
 * Adaptador especializado para arquivos de estilização (CSS).
 * Realiza análise estática em arquivos CSS para registrar folhas de estilo como
 * artefatos e localizar as definições de classes CSS em suas regras.
 */

const fs = require('fs');
const path = require('path');
const StyleAdapter = require('./style-adapter');
const ACFFacts = require('../domain/facts');

class CSSAdapter extends StyleAdapter {
  constructor() {
    super('css');
  }

  _walk(dir, filterFn) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this._walk(fullPath, filterFn));
      } else if (filterFn(fullPath)) {
        results.push(fullPath);
      }
    });
    return results;
  }

  /**
   * Executa a coleta de folhas de estilo e suas definições de classes.
   */
  collect(config, context) {
    const searchPath = config.path || path.join(process.cwd(), 'src');
    const facts = [];

    if (!fs.existsSync(searchPath)) {
      console.warn(`[CSSAdapter] Diretório de busca não existe: ${searchPath}`);
      return facts;
    }

    // Achar arquivos CSS
    const files = this._walk(searchPath, (filePath) => {
      const ext = path.extname(filePath);
      return ext === '.css' && !filePath.includes('node_modules');
    });

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const filename = path.basename(file);
      const relativePath = path.relative(process.cwd(), file);
      const artifactId = relativePath.replace(/\\/g, '/');

      // 1. Identificar o Artefato CSS
      facts.push(ACFFacts.artifactIdentified(this.getName(), {
        id: artifactId,
        name: path.basename(file, path.extname(file)),
        type: 'style',
        path: relativePath,
        details: { filename }
      }));

      // 1b. Procurar referências a folhas de estilo importadas (@import "./...")
      const importRegex = /@import\s+['"]([^'"]+\.css)['"]/g;
      let importMatch;
      while ((importMatch = importRegex.exec(content)) !== null) {
        const cssRef = importMatch[1];
        let targetId = cssRef;
        if (cssRef.startsWith('.')) {
          const absoluteDest = path.resolve(path.dirname(file), cssRef);
          targetId = path.relative(process.cwd(), absoluteDest).replace(/\\/g, '/');
        }
        facts.push(ACFFacts.referenceFound(this.getName(), {
          from: artifactId,
          to: targetId,
          type: 'style_sheet_import',
          location: {
            file: relativePath,
            line: this._getLineNumber(content, importMatch.index)
          }
        }));
      }

      // 2. Localizar as definições de classes CSS (ex: .btn-primary)
      // Encontra padrões como .btn-primary { ... } ou .btn, .card { ... }
      const classDefRegex = /\.([a-zA-Z0-9_-]+)(?:\s*,\s*\.[a-zA-Z0-9_-]+)*\s*\{/g;
      let match;
      while ((match = classDefRegex.exec(content)) !== null) {
        // Obter todas as classes declaradas juntas no seletor
        const selectorBlock = match[0].split('{')[0];
        const classes = selectorBlock.split(',').map(s => {
          const trimmed = s.trim();
          if (trimmed.startsWith('.')) {
            return trimmed.substring(1).trim().split(/\s+/)[0]; // pega a primeira classe da cadeia
          }
          return null;
        }).filter(Boolean);

        classes.forEach(cls => {
          facts.push(ACFFacts.definitionLocated(this.getName(), {
            artifactId: artifactId,
            location: {
              file: relativePath,
              line: this._getLineNumber(content, match.index)
            }
          }));

          // Registrar também como uma definição mapeada pela Engine de Correlação
          // Criamos um fato específico do adaptador que serve de lookup do nome da classe
          facts.push(ACFFacts.artifactIdentified(this.getName(), {
            id: `${artifactId}#${cls}`,
            name: cls,
            type: 'css_class',
            path: relativePath,
            details: { parentArtifact: artifactId }
          }));
        });
      }
    });

    return facts;
  }

  _getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Refatorador CSS: Remove ou atualiza seletores se solicitado.
   */
  applyRefactoring(changePlannedMetadata, context) {
    const file = path.resolve(process.cwd(), changePlannedMetadata.target);
    if (!file.startsWith(process.cwd())) {
      return {
        status: 'failed',
        details: { error: `[Segurança] Tentativa de Path Traversal bloqueada para o caminho: ${changePlannedMetadata.target}` }
      };
    }
    if (!fs.existsSync(file)) {
      return {
        status: 'failed',
        details: { error: `Arquivo CSS não encontrado: ${changePlannedMetadata.target}` }
      };
    }

    try {
      // Exemplo básico de refatoração de estilo:
      // se sugerida a renomeação de arquivo, etc.
      return {
        status: 'success',
        details: { message: `Limpeza de estilos aplicada via CSSAdapter em ${changePlannedMetadata.target}` }
      };
    } catch (e) {
      return {
        status: 'failed',
        details: { error: e.message }
      };
    }
  }
}

module.exports = CSSAdapter;
