# RELATÓRIO DE AUDITORIA DE ARQUITETURA CONTINUA (EOS v3.0)

**Audit Run ID:** `RUN-233b9f5b3ad4`  
**Data / Hora:** `2026-08-15T01:43:54.913Z`  
**Target ID:** `TGT-93f757f06c42caa8`  
**Caminho Alvo:** `C:\Users\Max\Desktop\Projeto\EOS\EOS\core`  
**Branch / Commit:** `N/A` / `N/A`  

## 1. MÉTICAS DE COBERTURA DE COLETA

| Métrica | Valor |
|---|---|
| Arquivos Descobertos | 107 |
| Arquivos Analisados | 107 |
| Arquivos Ignorados | 0 |
| Arquivos com Erro | 0 |
| Arquivos Inacessíveis | 0 |
| Diretórios Descobertos | 18 |
| Diretórios Ignorados | 0 |
| Symlinks Descobertos | 0 |
| Symlinks Ignorados | 0 |

## 2. RESULTADO DOS QUALITY GATES & RULES

### Rule: `ARCH-RULE-001-MANDATORY-DOMAIN-DIR` (❌ FAIL)
- **Versão:** `3.0.0`
- **Justificativa:** Violação Arquitetural: O diretório obrigatório de domínio 'src/domain' não existe no repositório auditado.
- **Fatos Utilizados:** `FCT-FS-5f3e5773ca8b`

### Rule: `ARCH-RULE-002-NO-DOMAIN-TO-INFRA-DEPENDENCY` (⚠️ INSUFFICIENT_EVIDENCE)
- **Versão:** `4.6.0`
- **Justificativa:** Evidência Insuficiente: Existem 5 dependência(s) com resolução incerta (UNRESOLVED ou AMBIGUOUS) que não puderam ser verificadas com certeza semântica.
- **Fatos Utilizados:** `FCT-DEP-298d23bbce71`, `FCT-DEP-186004b8cec2`, `FCT-DEP-14dc8a6138e3`, `FCT-DEP-94735cb52adf`, `FCT-DEP-b42cbf36610e`

## 3. ACHADOS (FINDINGS)

### [HIGH] Diretório Crítico de Domínio Ausente (src/domain)
- **ID do Achado:** `FND-ARCH-ae71057cf8`
- **Localização:** `src/domain`
- **Descrição:** Conforme a convenção Clean Architecture, o projeto DEVE possuir a camada de domínio isolada na pasta 'src/domain'.
- **Fatos de Origem:** `FCT-FS-5f3e5773ca8b`
- **Evidências Rastreáveis:** `EVD-FS-0032cfc307ce`, `EVD-FS-004ce3148f1f`, `EVD-FS-01f7fa2c944b`, `EVD-FS-025f5cc0248f`, `EVD-FS-04883830046f`, `EVD-FS-062b4f9bf3f2`, `EVD-FS-07a7ab3e42a4`, `EVD-FS-0961097f6d0c`, `EVD-FS-097b779a37cd`, `EVD-FS-09cecfcccc04`

## 4. PROVENIÊNCIA & RASTREABILIDADE

Este relatório foi gerado deterministicamente sem injeção de dados de demonstração ou fixtures.
Todos os achados derivam de Evidências com hashes SHA-256 verificáveis contra o sistema de arquivos real.