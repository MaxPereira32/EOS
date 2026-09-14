# RELATÓRIO DE AUDITORIA DE ARQUITETURA CONTINUA (EOS v3.0)

**Audit Run ID:** `RUN-70649dbdd626`  
**Data / Hora:** `2026-09-14T00:49:08.241Z`  
**Target ID:** `TGT-5865e8a287b5ac25`  
**Caminho Alvo:** `C:\Users\lindo\OneDrive\Desktop\Dev\Projeto\EOS`  
**Branch / Commit:** `main` / `b843616d932d280f2a91d74aa776c613c6081930`  

## 1. MÉTICAS DE COBERTURA DE COLETA

| Métrica | Valor |
|---|---|
| Arquivos Descobertos | 279 |
| Arquivos Analisados | 279 |
| Arquivos Ignorados | 0 |
| Arquivos com Erro | 0 |
| Arquivos Inacessíveis | 0 |
| Diretórios Descobertos | 53 |
| Diretórios Ignorados | 3 |
| Symlinks Descobertos | 0 |
| Symlinks Ignorados | 0 |

## 2. RESULTADO DOS QUALITY GATES & RULES

### Rule: `ARCH-RULE-001-MANDATORY-DOMAIN-DIR` (❌ FAIL)
- **Versão:** `3.0.0`
- **Justificativa:** Violação Arquitetural: O diretório obrigatório de domínio 'src/domain' não existe no repositório auditado.
- **Fatos Utilizados:** `FCT-FS-f9e0aac76ce1`

### Rule: `ARCH-RULE-002-NO-DOMAIN-TO-INFRA-DEPENDENCY` (⚠️ INSUFFICIENT_EVIDENCE)
- **Versão:** `4.6.0`
- **Justificativa:** Evidência Insuficiente: Existem 29 dependência(s) com resolução incerta (UNRESOLVED ou AMBIGUOUS) que não puderam ser verificadas com certeza semântica.
- **Fatos Utilizados:** `FCT-DEP-16d47cde6296`, `FCT-DEP-13eba52d9d7a`, `FCT-DEP-fe892e4a74ae`, `FCT-DEP-42a6e2344068`, `FCT-DEP-f45719b3079f`, `FCT-DEP-b0640882a1a0`, `FCT-DEP-7246f0e1c499`, `FCT-DEP-b526044f72fc`, `FCT-DEP-0c10afbeea1d`, `FCT-DEP-9cee04b53e0a`, `FCT-DEP-73fd912f74e8`, `FCT-DEP-886da9c09321`, `FCT-DEP-1165e46f23a8`, `FCT-DEP-870a809e688c`, `FCT-DEP-cee47a4336e8`, `FCT-DEP-9a9d73f29906`, `FCT-DEP-a58b9e5c4da5`, `FCT-DEP-02ace3541631`, `FCT-DEP-30175c1a927a`, `FCT-DEP-c4db569ef411`, `FCT-DEP-354f429db777`, `FCT-DEP-c6d281fba138`, `FCT-DEP-e6954d2117da`, `FCT-DEP-f9a52d7ea970`, `FCT-DEP-c66f418c2f4f`, `FCT-DEP-c6ea9f52a787`, `FCT-DEP-f8e736844246`, `FCT-DEP-6e3e106eee8d`, `FCT-DEP-3dfe28fb747b`

### Rule: `EOS-COVERAGE-001` (✅ PASS)
- **Versão:** `1.0`
- **Justificativa:** A coleta não registrou arquivos inacessíveis ou erros de leitura.
- **Fatos Utilizados:** Nenhum

### Rule: `EOS-EXECUTION-001` (✅ PASS)
- **Versão:** `1.0`
- **Justificativa:** Validações executadas e aprovadas: npm run test.
- **Fatos Utilizados:** Nenhum

## 3. VALIDAÇÕES EXECUTADAS

| Comando | Resultado | Código | Duração |
|---|---:|---:|---:|
| `npm run test` | PASS | 0 | 3885 ms |

## 4. ACHADOS (FINDINGS)

### [HIGH] Diretório Crítico de Domínio Ausente (src/domain)
- **ID do Achado:** `FND-ARCH-8e83a950d0`
- **Localização:** `src/domain`
- **Descrição:** Conforme a convenção Clean Architecture, o projeto DEVE possuir a camada de domínio isolada na pasta 'src/domain'.
- **Fatos de Origem:** `FCT-FS-f9e0aac76ce1`
- **Evidências Rastreáveis:** `EVD-FS-01d6e8f9d34e`, `EVD-FS-024347470a0c`, `EVD-FS-047ba5b079fa`, `EVD-FS-07a5b4722aff`, `EVD-FS-08b52737b384`, `EVD-FS-0a303326b8f8`, `EVD-FS-0aa6343d4d37`, `EVD-FS-0cd28c83edb9`, `EVD-FS-0cd764341a3d`, `EVD-FS-0d72d2778403`

### [CRITICAL] Bloqueio de Governança [SIMULATION_ONLY]
- **ID do Achado:** `EOS-DOM-CLAIM-FIRESTORE-001-1`
- **Localização:** `firestore.rules`
- **Descrição:** FALHA DE SINAL AST: Arquivo de teste não existe no caminho informado.
- **Fatos de Origem:** 
- **Evidências Rastreáveis:** `ENV-FS-1789346948240-3bbhyu`

## 5. PROVENIÊNCIA & RASTREABILIDADE

Este relatório registra somente evidências coletadas e validações executadas no alvo; ausência de execução é identificada como evidência insuficiente.
Todos os achados derivam de Evidências com hashes SHA-256 verificáveis contra o sistema de arquivos real.