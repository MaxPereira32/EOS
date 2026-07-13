const { execSync } = require('child_process');
const Fact = require('../domain/fact');

module.exports = {
  name: 'depcruise',
  collect(config) {
    console.log(`[*] Executando Coletor Dependency-Cruiser (${config.config_file})...`);
    let output = '';
    try {
      output = execSync(`npx depcruise --config ${config.config_file} --output-type json src`, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' });
    } catch (err) { output = err.stdout || ''; }

    try {
      const data = JSON.parse(output);
      const count = (data.summary.violations || []).length;
      return [new Fact({ metric: 'depcruise.violations', value: count, source: 'depcruise' })];
    } catch (e) {
      return [new Fact({ metric: 'depcruise.violations', value: 0, source: 'depcruise' })];
    }
  }
};
