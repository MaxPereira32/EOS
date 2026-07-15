/**
 * EOS ACF Engine — Regression Engine
 * 
 * Executa o Modelo 7: Regressão.
 * Compara o diagnóstico atual com o estado histórico (última auditoria gravada em disco)
 * para detectar regressões arquiteturais de consistência e computar tendências de evolução.
 */

class RegressionEngine {
  /**
   * Compara o estado atual com a linha de base histórica.
   * 
   * @param {import('../../domain/fact')[]} currentDiagnostics - Inconsistências atuais
   * @param {object} historicalReport - Relatório da auditoria anterior em JSON (se disponível)
   * @returns {object} Métricas de regressão e evolução
   */
  execute(currentDiagnostics, historicalReport) {
    console.log('[ACF Engine] Iniciando Modelo 7: Análise de Regressão...');

    const currentIds = currentDiagnostics.map(inc => inc.metadata.inconsistencyId || inc.metadata.type);
    const historyIds = [];
    
    // Extrair histórico do auditoria.json anterior (fatos de inconsistência detectada)
    if (historicalReport && historicalReport.fatos_brutos) {
      historicalReport.fatos_brutos.forEach(f => {
        if (f.metric === 'acf.inconsistency.detected' && f.metadata) {
          historyIds.push(f.metadata.inconsistencyId || f.metadata.type);
        }
      });
    }

    const newInconsistencies = currentIds.filter(id => !historyIds.includes(id));
    const resolvedInconsistencies = historyIds.filter(id => !currentIds.includes(id));
    const delta = currentIds.length - historyIds.length;

    const regressionDetected = newInconsistencies.length > 0;
    const trend = delta < 0 ? 'improving' : (delta > 0 ? 'regressing' : 'stable');

    console.log(`[ACF Engine] [Regressão] Tendência: ${trend}. Novas: ${newInconsistencies.length}, Resolvidas: ${resolvedInconsistencies.length}. Delta: ${delta}`);

    return {
      regressionDetected,
      trend, // improving, regressing, stable
      newInconsistencies,
      resolvedInconsistencies,
      historicalTotal: historyIds.length,
      currentTotal: currentIds.length,
      delta
    };
  }
}

module.exports = RegressionEngine;
