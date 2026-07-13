const { execSync } = require('child_process');

module.exports = {
  name: 'phpunit',
  collect(config) {
    console.log(`[*] Executando Coletor PHPUnit (${config.config_file})...`);
    let output = '';
    try {
      output = execSync(`vendor/bin/phpunit -c ${config.config_file}`, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' });
    } catch (err) {
      output = err.stdout || '';
    }

    if (output.includes('FAILURES!') || output.includes('Errors:')) {
      return { status: 'failed', failed: 1 };
    } else if (output.includes('OK (')) {
      return { status: 'passed', failed: 0 };
    } else {
      console.warn('[!] Saída do PHPUnit não pôde ser interpretada. Retornando falha por segurança.');
      return { status: 'unknown', failed: 1 };
    }
  }
};
