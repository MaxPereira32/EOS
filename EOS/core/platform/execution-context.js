/**
 * EOS Platform — ExecutionContext
 * 
 * Identidade imutável da execução. Todo evento no Event Bus
 * carrega este contexto para garantir rastreabilidade completa.
 */

const { execSync } = require('child_process');

class ExecutionContext {
  /**
   * @param {object} config - Dados do auditoria.json
   */
  constructor(config) {
    this.project = config.projeto || (config.context && config.context.project) || 'desconhecido';
    this.branch = this._detectBranch();
    this.commit = this._detectCommit();
    this.timestamp = new Date().toISOString();
    this.environment = process.env.CI ? 'ci' : 'local';
    this.eosVersion = '0.4.0';

    Object.freeze(this);
  }

  _detectBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch { return 'unknown'; }
  }

  _detectCommit() {
    try {
      return execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch { return 'unknown'; }
  }

  toJSON() {
    return {
      project: this.project,
      branch: this.branch,
      commit: this.commit,
      timestamp: this.timestamp,
      environment: this.environment,
      eosVersion: this.eosVersion
    };
  }
}

module.exports = ExecutionContext;
