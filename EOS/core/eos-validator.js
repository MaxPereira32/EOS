#!/usr/bin/env node

/**
 * EOS Schema & Metrics Validator — v0.1.8
 * 
 * Executa o "Evidence Engine" do EOS. Em vez de parsing markdown frágil,
 * o validador consome .eos/auditorias/auditoria.json e atesta fisicamente
 * a existência das evidências técnicas declaradas (arquivos de configuração de testes,
 * linters, ADRs e assinaturas de framework) antes de homologar a auditoria.
 */

const fs = require('fs');
const path = require('path');

// Limiares Mínimos Obrigatórios (EOS v0.1.8)
const THRESHOLDS = {
  ARQ: { name: 'Arquitetura', min: 80 },
  GOV: { name: 'Governança', min: 90 },
  TST: { name: 'Testabilidade', min: 90 },
  EVO: { name: 'Evolução', min: 80 },
  ADQ: { name: 'Adequação ao Contexto', min: 90 },
  CON: { name: 'Consistência Arquitetural', min: 90 },
  CXA: { name: 'Complexidade Acidental', min: 80 },
  PRP: { name: 'Proporcionalidade', min: 90 }
};

const jsonPath = path.join(process.cwd(), '.eos', 'auditorias', 'auditoria.json');

if (!fs.existsSync(jsonPath)) {
  console.error('[-] Erro de Governança: Arquivo .eos/auditorias/auditoria.json não encontrado.');
  console.error('[!] O EOS v0.1.8 exige o formato JSON como fonte única de verdade de scores.');
  process.exit(1);
}

let auditData;
try {
  auditData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (err) {
  console.error(`[-] Falha de Sintaxe no JSON: ${err.message}`);
  process.exit(1);
}

let hasFailures = false;

console.log('[+] Iniciando Validação de Limiares Matemáticos...');
const scores = auditData.indicadores || {};

// 1. Validar Limiares das Notas
Object.keys(THRESHOLDS).forEach(key => {
  const score = scores[key];
  const { name, min } = THRESHOLDS[key];
  
  if (score === undefined || score === null) {
    console.error(`[-] Erro de Metadados: Dimensão obrigatória ausente no JSON: ${name} (${key})`);
    hasFailures = true;
  } else if (score < min) {
    console.error(`[❌] FALHA DE LIMIAR: ${name} (${key}) = ${score}/100 (Mínimo exigido: ${min}/100)`);
    hasFailures = true;
  } else {
    console.log(`[✓] PASSOU: ${name} (${key}) = ${score}/100 (Mínimo: ${min}/100)`);
  }
});

console.log('\n[+] Ativando o Evidence Engine (Validação de Provas Físicas)...');

const evidencias = auditData.evidencias || {};

// Helper para validar arquivos
const verificarArquivo = (label, filePath) => {
  if (!filePath) return;
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`[✓] EVIDÊNCIA COMPROVADA: Configuração de ${label} encontrada em "${filePath}"`);
  } else {
    console.error(`[❌] FALHA DE PROVA: Arquivo de configuração de ${label} declarado mas não encontrado: "${filePath}"`);
    hasFailures = true;
  }
};

// 2. Validar Existência dos Arquivos de Configuração Declarados
if (evidencias.linter_dependencias && evidencias.linter_dependencias.executado) {
  verificarArquivo('Linter de Dependências', evidencias.linter_dependencias.config_file);
}

if (evidencias.linter_codigo && evidencias.linter_codigo.executado) {
  verificarArquivo('Linter de Código', evidencias.linter_codigo.config_file);
}

if (evidencias.testes_automatizados && evidencias.testes_automatizados.executado) {
  verificarArquivo('Suíte de Testes', evidencias.testes_automatizados.config_file);
}

// 3. Validar Diretório de ADRs
if (evidencias.governanca && evidencias.governanca.diretorio_decisoes) {
  const adrDir = path.join(process.cwd(), evidencias.governanca.diretorio_decisoes);
  if (fs.existsSync(adrDir)) {
    console.log(`[✓] EVIDÊNCIA COMPROVADA: Diretório de decisões governamentais em "${evidencias.governanca.diretorio_decisoes}"`);
  } else {
    console.error(`[❌] FALHA DE PROVA: Diretório de ADRs declarado mas inexistente: "${evidencias.governanca.diretorio_decisoes}"`);
    hasFailures = true;
  }
}

// 4. Validar Assinatura do Perfil Arquitetural Selecionado
const perfil = auditData.perfil_arquitetural;
console.log(`\n[+] Validando Assinatura do Perfil Arquitetural: ${perfil}`);

if (perfil === 'PROF-LARAVEL-AR') {
  if (fs.existsSync(path.join(process.cwd(), 'composer.json'))) {
    console.log('[✓] ASSINATURA COMPROVADA: composer.json encontrado.');
  } else {
    console.error('[❌] FALHA DE PERFIL: Declarado Laravel ActiveRecord mas composer.json ausente na raiz.');
    hasFailures = true;
  }
} else if (perfil === 'PROF-FRONTEND-SPA' || perfil === 'PROF-NEXTJS-SSR') {
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    console.log('[✓] ASSINATURA COMPROVADA: package.json encontrado.');
  } else {
    console.error('[❌] FALHA DE PERFIL: Declarado perfil Node/Frontend mas package.json ausente na raiz.');
    hasFailures = true;
  }
}

// Resumo final do Engine
if (hasFailures) {
  console.error('\n[🔴] REPROVADO: O Evidence Engine bloqueou a homologação devido a inconsistências físicas ou violações de limiares.');
  process.exit(1);
} else {
  console.log('\n[🟢] APROVADO: Todas as declarações de scores e evidências físicas estão consistentes.');
  process.exit(0);
}
