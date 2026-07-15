/**
 * EOS ACF Engine — Discovery Engine
 * 
 * Executa a Fase 0: Descoberta Arquitetural.
 * Detecta automaticamente as linguagens, frameworks, organização física e estilização
 * do projeto sob auditoria, gerando um Architecture Profile estruturado em um Fato.
 */

const fs = require('fs');
const path = require('path');
const ACFFacts = require('../domain/facts');

class DiscoveryEngine {
  /**
   * Executa a Fase 0: Descoberta Arquitetural.
   * 
   * @param {import('../../platform/execution-context')} context
   * @returns {import('../../domain/fact')} Fato profileDiscovered contendo o Architecture Profile
   */
  execute(context) {
    console.log('[ACF Engine] Iniciando Fase 0: Descoberta Arquitetural...');
    
    const projectRoot = process.cwd();
    const profile = {
      languages: [],
      frameworks: [],
      structure: {
        hasSrc: false,
        dirs: []
      },
      styling: [],
      namingConventions: [],
      designSystem: {}
    };

    // 1. Tentar ler package.json para inferir frameworks e dependências
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        // Frameworks
        if (deps['react'] || deps['react-dom']) profile.frameworks.push('React');
        if (deps['vue']) profile.frameworks.push('Vue');
        if (deps['@angular/core']) profile.frameworks.push('Angular');
        if (deps['svelte']) profile.frameworks.push('Svelte');

        // Linguagens
        if (deps['typescript']) {
          profile.languages.push('TypeScript');
        } else {
          profile.languages.push('JavaScript');
        }

        // Estilização
        if (deps['tailwindcss']) profile.styling.push('TailwindCSS');
        if (deps['styled-components']) profile.styling.push('Styled Components');
        if (deps['sass'] || deps['node-sass']) profile.styling.push('SCSS/SASS');
        if (deps['postcss']) profile.styling.push('PostCSS');
      } catch (e) {
        console.warn(`[ACF Engine] [Descoberta] Erro ao ler package.json: ${e.message}`);
      }
    }

    // 2. Analisar estrutura física de diretórios
    const commonDirs = ['src', 'public', 'styles', 'lib', 'components', 'estilos', 'modulos'];
    commonDirs.forEach(dir => {
      const dirPath = path.join(projectRoot, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        if (dir === 'src') profile.structure.hasSrc = true;
        profile.structure.dirs.push(dir);
      }
    });

    // 3. Fallbacks estruturais
    if (profile.languages.length === 0) profile.languages.push('JavaScript');
    if (profile.styling.length === 0) {
      // Procurar arquivos .css ou .scss
      const stylesDir = path.join(projectRoot, 'src', 'estilos');
      if (fs.existsSync(stylesDir)) {
        profile.styling.push('CSS');
      }
    }

    console.log(`[ACF Engine] [Descoberta] Profile identificado: Frameworks: ${profile.frameworks.join(', ') || 'Nenhum'}, Estilos: ${profile.styling.join(', ')}`);

    return ACFFacts.profileDiscovered('discovery-engine', profile);
  }
}

module.exports = DiscoveryEngine;
