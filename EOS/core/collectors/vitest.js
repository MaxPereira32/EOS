const { execSync } = require('child_process');
const Fact = require('../domain/fact');

module.exports = {
  name: 'vitest',
  collect(config) {
    console.log(`[*] Executando Coletor Vitest (${config.config_file})...`);
    let output = '';
    try {
      output = execSync('npx vitest run --reporter=json', { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' });
    } catch (err) { output = err.stdout || ''; }

    try {
      const data = JSON.parse(output);
      return [
        new Fact({ metric: 'vitest.passed', value: data.numPassedTests || 0, source: 'vitest' }),
        new Fact({ metric: 'vitest.failed', value: data.numFailedTests || 0, source: 'vitest' })
      ];
    } catch (e) {
      return [
        new Fact({ metric: 'vitest.passed', value: 0, source: 'vitest' }),
        new Fact({ metric: 'vitest.failed', value: 0, source: 'vitest' })
      ];
    }
  }
};
