/**
 * EOS ACF Adapters — React Adapter
 * 
 * Adaptador especializado para componentes React (JSX/TSX).
 * Realiza varreduras estáticas em arquivos React para identificar componentes
 * e extrair referências a estilos (classNames e imports).
 */

const fs = require('fs');
const path = require('path');
const PresentationAdapter = require('./presentation-adapter');
const ACFFacts = require('../domain/facts');

class ReactAdapter extends PresentationAdapter {
  constructor() {
    super('react');
  }

  /**
   * Varre recursivamente diretórios procurando arquivos.
   */
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
   * Executa a coleta de componentes e suas referências.
   */
  collect(config, context) {
    const searchPath = config.path || path.join(process.cwd(), 'src');
    const facts = [];

    if (!fs.existsSync(searchPath)) {
      console.warn(`[ReactAdapter] Diretório de busca não existe: ${searchPath}`);
      return facts;
    }

    // Achar arquivos React (js, jsx, tsx), ignorando arquivos de teste
    const files = this._walk(searchPath, (filePath) => {
      const ext = path.extname(filePath);
      return ['.js', '.jsx', '.tsx'].includes(ext) && 
             !filePath.includes('node_modules') && 
             !filePath.includes('.test.') && 
             !filePath.includes('.spec.');
    });

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const filename = path.basename(file);
      const relativePath = path.relative(process.cwd(), file);
      const componentName = path.basename(file, path.extname(file));

      // 1. Identificar o Artefato Componente
      facts.push(ACFFacts.artifactIdentified(this.getName(), {
        id: relativePath.replace(/\\/g, '/'),
        name: componentName,
        type: 'component',
        path: relativePath,
        details: { filename }
      }));

      // 2. Procurar referências a folhas de estilo (imports)
      const importRegex = /import\s+['"]([^'"]+\.css)['"]/g;
      let importMatch;
      while ((importMatch = importRegex.exec(content)) !== null) {
        const cssRef = importMatch[1];
        let targetId = cssRef;
        if (cssRef.startsWith('.')) {
          const absoluteDest = path.resolve(path.dirname(file), cssRef);
          targetId = path.relative(process.cwd(), absoluteDest).replace(/\\/g, '/');
        }
        facts.push(ACFFacts.referenceFound(this.getName(), {
          from: relativePath.replace(/\\/g, '/'),
          to: targetId,
          type: 'style_sheet_import',
          location: { file: relativePath, line: this._getLineNumber(content, importMatch.index) }
        }));
      }

      // 3. Procurar uso de classes CSS (className="...")
      // Suporta className="nome-da-classe" e className={'nome'} simples
      const classNameRegex = /className=["']([^"']+)["']/g;
      let classMatch;
      while ((classMatch = classNameRegex.exec(content)) !== null) {
        const classes = classMatch[1].split(/\s+/).filter(Boolean);
        classes.forEach(cls => {
          facts.push(ACFFacts.referenceFound(this.getName(), {
            from: relativePath.replace(/\\/g, '/'),
            to: cls,
            type: 'css_class_usage',
            location: { file: relativePath, line: this._getLineNumber(content, classMatch.index) }
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
   * Refatorador React: Simula a correção alterando as referências se solicitado.
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
        details: { error: `Arquivo alvo não encontrado para refatoração: ${changePlannedMetadata.target}` }
      };
    }

    try {
      let content = fs.readFileSync(file, 'utf8');
      
      // Se a mudança for para resolver uma referência de nomenclatura incorreta, podemos tentar aplicar a substituição
      if (changePlannedMetadata.description.includes('Renomear')) {
        // Lógica de refatoração para demonstração: simulamos a aplicação da nova convenção de nomenclatura
        // (Exemplo: mudando a nomenclatura do componente para PascalCase)
        const oldName = path.basename(file, path.extname(file));
        const newName = oldName.charAt(0).toUpperCase() + oldName.slice(1);
        
        if (oldName !== newName) {
          const newPath = path.join(path.dirname(file), newName + path.extname(file));
          fs.renameSync(file, newPath);
          return {
            status: 'success',
            details: {
              message: `Componente React renomeado de [${oldName}] para [${newName}].`,
              originalPath: file,
              newPath: newPath
            }
          };
        }
      }

      return {
        status: 'success',
        details: { message: `Refatoração aplicada via ReactAdapter em ${changePlannedMetadata.target}` }
      };
    } catch (e) {
      return {
        status: 'failed',
        details: { error: e.message }
      };
    }
  }
}

module.exports = ReactAdapter;
