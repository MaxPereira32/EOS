#!/usr/bin/env node

/**
 * EOS Collector Engine — v0.2.0 (Plugins & Rule Engine Integration)
 * 
 * Executa de forma desacoplada plugins coletores do diretório core/collectors/
 * e executa o core/rule-engine.js para calcular os scores a partir dos fatos obtidos.
 */

const fs = require('fs');
const path = require('path');
const ruleEngine = require('./rule-engine');

const jsonPath = path.join(process.cwd(), '.eos', 'auditorias', 'auditoria.json');

if (!fs.existsSync(jsonPath)) {
  console.error('[-] Erro de Governança: Arquivo .eos/auditorias/auditoria.json não encontrado.');
  process.exit(1);
}

let auditData;
try {
  auditData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (e) {
  console.error(`[-] Falha de Sintaxe no JSON: ${e.message}`);
  process.exit(1);
}

console.log('[+] Iniciando EOS Collector Engine (Modular Plugins v0.2.0)...');

auditData.fatos = auditData.fatos || {};
const evidencias = auditData.evidencias || {};

// Carregar plugins coletores disponíveis
const collectorsDir = path.join(__dirname, 'collectors');
const plugins = {};

if (fs.existsSync(collectorsDir)) {
  fs.readdirSync(collectorsDir).forEach(file => {
    if (file.endsWith('.js')) {
      const plugin = require(path.join(collectorsDir, file));
      plugins[plugin.name] = plugin;
    }
  });
}

// Mapeamento de coletores configurados nas evidencias
const mapeamento = {
  linter_dependencias: 'depcruise',
  linter_codigo: 'eslint',
  testes_automatizados: (config) => {
    if (config.config_file.endsWith('.xml')) return 'phpunit';
    return 'vitest';
  }
};

// Iterar sobre as evidencias e executar os coletores correspondentes
Object.keys(evidencias).forEach(key => {
  const config = evidencias[key];
  if (config && config.executado) {
    let pluginName = mapeamento[key];
    if (typeof pluginName === 'function') {
      pluginName = pluginName(config);
    }

    const plugin = plugins[pluginName];
    if (plugin) {
      try {
        const fatos = plugin.collect(config);
        auditData.fatos[pluginName] = fatos;
        console.log(`[✓] Plugin [${pluginName}] coletou fatos com sucesso.`);
      } catch (err) {
        console.error(`[-] Falha na execução do plugin [${pluginName}]: ${err.message}`);
      }
    } else {
      console.warn(`[!] Nenhum plugin coletor correspondente encontrado para [${key}].`);
    }
  }
});

// Executar o Rule Engine
auditData = ruleEngine.process(auditData);

// Salvar a auditoria com os fatos e scores calculados
fs.writeFileSync(jsonPath, JSON.stringify(auditData, null, 2), 'utf8');

console.log('\n[🎉] Coleta de fatos e processamento de regras concluídos.');
console.log('[+] Resultados gravados em .eos/auditorias/auditoria.json.');
process.exit(0);
