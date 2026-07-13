const { execSync } = require('child_process');
const Fact = require('../domain/fact');

module.exports = {
  name: 'eslint',
  collect(config) {
    console.log(`[*] Executando Coletor ESLint (${config.config_file})...`);
    let output = '';
    try {
      output = execSync('npx eslint src --format=json', { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' });
    } catch (err) { output = err.stdout || ''; }

    try {
      const data = JSON.parse(output);
      let errors = 0, warnings = 0;
      data.forEach(file => { errors += file.errorCount || 0; warnings += file.warningCount || 0; });
      return [
        new Fact({ metric: 'eslint.errors', value: errors, source: 'eslint' }),
        new Fact({ metric: 'eslint.warnings', value: warnings, source: 'eslint' })
      ];
    } catch (e) {
      return [
        new Fact({ metric: 'eslint.errors', value: 0, source: 'eslint' }),
        new Fact({ metric: 'eslint.warnings', value: 0, source: 'eslint' })
      ];
    }
  }
};
