# RELATÓRIO DE AUDITORIA DE ARQUITETURA CONTINUA (EOS v3.0)

**Audit Run ID:** `RUN-b7df494e58bf`  
**Data / Hora:** `2026-08-14T17:00:27.222Z`  
**Target ID:** `TGT-fbece22b573fcfe6`  
**Caminho Alvo:** `C:\Users\lindomax.pereira\Desktop\Portifolito\Projeto\Frameworck\EOS`  
**Branch / Commit:** `main` / `b7e98d74fd34cb5833dbe1e63b446440ccdff9ca`  

## 1. MÉTICAS DE COBERTURA DE COLETA

| Métrica | Valor |
|---|---|
| Arquivos Descobertos | 167 |
| Arquivos Analisados | 167 |
| Arquivos Ignorados | 0 |
| Arquivos com Erro | 0 |
| Arquivos Inacessíveis | 0 |
| Diretórios Descobertos | 36 |
| Diretórios Ignorados | 3 |
| Symlinks Descobertos | 0 |
| Symlinks Ignorados | 0 |

## 2. RESULTADO DOS QUALITY GATES & RULES

### Rule: `ARCH-RULE-001-MANDATORY-DOMAIN-DIR` (❌ FAIL)
- **Versão:** `3.0.0`
- **Justificativa:** Violação Arquitetural: O diretório obrigatório de domínio 'src/domain' não existe no repositório auditado.
- **Fatos Utilizados:** `FCT-FS-db9a4513e5a5`

### Rule: `ARCH-RULE-002-NO-DOMAIN-TO-INFRA-DEPENDENCY` (✅ PASS)
- **Versão:** `4.6.0`
- **Justificativa:** Conformidade de Camadas: Nenhuma dependência indevida de Domínio para Infraestrutura foi encontrada.
- **Fatos Utilizados:** `FCT-DEP-949d15182764`, `FCT-DEP-f3e8e137872f`, `FCT-DEP-db75d1e2da95`, `FCT-DEP-0c33aa14ba4c`, `FCT-DEP-7f25fe409473`, `FCT-DEP-f31da2545833`, `FCT-DEP-d90a96a729a5`, `FCT-DEP-63667f08f164`, `FCT-DEP-26c30491ef07`, `FCT-DEP-789177a760eb`, `FCT-DEP-b729bca6d351`, `FCT-DEP-c4a2b6d15aa7`, `FCT-DEP-eb05eec3c3fe`, `FCT-DEP-77ea41e40600`, `FCT-DEP-e89873c05d8e`, `FCT-DEP-c3a0bcaca7c8`, `FCT-DEP-99dedc1060c2`, `FCT-DEP-350ecf4368ef`, `FCT-DEP-e0716899c583`, `FCT-DEP-e521e89c292d`, `FCT-DEP-fa8e23c59d00`, `FCT-DEP-802040f9b287`, `FCT-DEP-e83c0fea18a7`, `FCT-DEP-58e7454a4d58`, `FCT-DEP-f4d3bb9f3ba8`, `FCT-DEP-54acb3e93018`, `FCT-DEP-53675e7e579b`, `FCT-DEP-47036b758313`, `FCT-DEP-9ca79bac92f6`, `FCT-DEP-2b2b6ff638ab`, `FCT-DEP-648bf6ca57d1`, `FCT-DEP-5bcddc709300`, `FCT-DEP-5a16edf85cb6`, `FCT-DEP-87c677e5576e`, `FCT-DEP-5a25c8748da8`, `FCT-DEP-c65378eea6a1`, `FCT-DEP-640b66c1d839`, `FCT-DEP-4ec0eeee7aa7`, `FCT-DEP-fd6245a228a6`, `FCT-DEP-13182e47eec3`, `FCT-DEP-50a3d7f5107a`, `FCT-DEP-fbc572e652ad`, `FCT-DEP-5b0c95991c8e`, `FCT-DEP-a2021186c58f`, `FCT-DEP-72577f3e018e`, `FCT-DEP-1aeae8c1ec15`, `FCT-DEP-fc0ad4dff41e`, `FCT-DEP-90581b9620e1`, `FCT-DEP-2490ff97aab7`, `FCT-DEP-67023fd46ab9`, `FCT-DEP-5e1c19a4c8c4`, `FCT-DEP-d52824e2cd5f`, `FCT-DEP-19f68c2be074`, `FCT-DEP-91eeca77cbe2`, `FCT-DEP-a73d37ec02ce`, `FCT-DEP-72d5f3edebd6`, `FCT-DEP-f26b6d7db747`, `FCT-DEP-1dc44bbbe60d`, `FCT-DEP-45cba4396230`, `FCT-DEP-e1d2226b346d`, `FCT-DEP-6f19dc687fc4`, `FCT-DEP-516749296667`, `FCT-DEP-3e70f65d1003`, `FCT-DEP-1ee3c550f798`, `FCT-DEP-ed69ba4d9b8a`, `FCT-DEP-a9c4905ecfd1`, `FCT-DEP-7c2bdaaf470e`, `FCT-DEP-cf9150552672`, `FCT-DEP-88ae559fd9f7`, `FCT-DEP-cc8aa84147c7`, `FCT-DEP-b2c2f750032e`, `FCT-DEP-643ba16dba94`, `FCT-DEP-8cfd09772da6`, `FCT-DEP-557fe732603d`, `FCT-DEP-e63c39e03aa8`, `FCT-DEP-22e5f4837048`, `FCT-DEP-87f70e7fbbbb`, `FCT-DEP-59220818ea66`, `FCT-DEP-340491fd7a6f`, `FCT-DEP-cad225102e51`, `FCT-DEP-5c0dc5e02a7e`, `FCT-DEP-c8ad8ed9af05`, `FCT-DEP-6fe7e6426380`, `FCT-DEP-21e3918deea1`, `FCT-DEP-620776c9ba88`, `FCT-DEP-90f98b47f797`, `FCT-DEP-f591ebe7c9ed`, `FCT-DEP-91667d6b3248`, `FCT-DEP-0eba3bdd3987`, `FCT-DEP-b2ec094db386`, `FCT-DEP-4cd76dbf1420`, `FCT-DEP-9bd543812c52`, `FCT-DEP-213ab0ef8460`, `FCT-DEP-040f77c1aea0`, `FCT-DEP-7edeec80e572`, `FCT-DEP-2c12a683efd2`, `FCT-DEP-a0ab9d5ae578`, `FCT-DEP-cff2259071d5`, `FCT-DEP-6b9066e4ea85`, `FCT-DEP-59693f2007d6`, `FCT-DEP-9ab9ff8dd794`, `FCT-DEP-a793408a9c87`, `FCT-DEP-38baa4ce2c39`, `FCT-DEP-86785a19a503`, `FCT-DEP-993241558195`, `FCT-DEP-7ee57d7192b6`, `FCT-DEP-eb2885cf904e`, `FCT-DEP-61236ac94e0d`, `FCT-DEP-cb4a34715ba1`, `FCT-DEP-cac7a244153c`, `FCT-DEP-a082e2f6f42d`, `FCT-DEP-d7f73b6fdfa8`, `FCT-DEP-efff0bbb263c`, `FCT-DEP-fb411998f306`, `FCT-DEP-4dca4c929547`, `FCT-DEP-2afb266def2b`, `FCT-DEP-5bbe72841f18`, `FCT-DEP-8354121e53cf`, `FCT-DEP-e19cf6a9ee05`, `FCT-DEP-4e389b6fe1e9`, `FCT-DEP-90a6db4c4d69`, `FCT-DEP-e21be8dab117`, `FCT-DEP-61856b537ab6`, `FCT-DEP-101f9f1ad052`, `FCT-DEP-c1b6ce452ea8`, `FCT-DEP-71aa6ff2511c`, `FCT-DEP-4ad6ab24e09c`, `FCT-DEP-15158c9438e9`, `FCT-DEP-d0d861faac26`, `FCT-DEP-a422b6bad6e6`, `FCT-DEP-21adfc72ecfb`, `FCT-DEP-904bece8968b`, `FCT-DEP-842392b90052`, `FCT-DEP-daefb4791013`, `FCT-DEP-1481c7e002cd`, `FCT-DEP-7efb0519d025`, `FCT-DEP-fe1299cecd00`, `FCT-DEP-1c852063da85`, `FCT-DEP-72d89b8f521e`, `FCT-DEP-e5aa009646b0`, `FCT-DEP-66e3d097ccc2`, `FCT-DEP-5757778c5b6c`, `FCT-DEP-50f11c1cb527`, `FCT-DEP-7ac59d680b9f`, `FCT-DEP-dcbf1e3b6c38`, `FCT-DEP-0ebac115d4a5`, `FCT-DEP-8e26e342a11b`, `FCT-DEP-cf5478ee390f`, `FCT-DEP-478cd533fe08`, `FCT-DEP-4bc6f15d2124`, `FCT-DEP-d5cbec5165c9`, `FCT-DEP-798e0d2644c3`, `FCT-DEP-3d64aa2e842b`, `FCT-DEP-14206d2a80c3`, `FCT-DEP-d6d30b5a74da`, `FCT-DEP-c63b763534db`, `FCT-DEP-89afd8c6e761`, `FCT-DEP-e17bfa55d526`, `FCT-DEP-0caeef912f42`, `FCT-DEP-7b095a8626ef`, `FCT-DEP-b53def6848de`, `FCT-DEP-c84b313daca2`, `FCT-DEP-934b33849e99`, `FCT-DEP-79cc9ebf0157`

## 3. ACHADOS (FINDINGS)

### [HIGH] Diretório Crítico de Domínio Ausente (src/domain)
- **ID do Achado:** `FND-ARCH-7458fd4786`
- **Localização:** `src/domain`
- **Descrição:** Conforme a convenção Clean Architecture, o projeto DEVE possuir a camada de domínio isolada na pasta 'src/domain'.
- **Fatos de Origem:** `FCT-FS-db9a4513e5a5`
- **Evidências Rastreáveis:** `EVD-FS-0234aed19ac3`, `EVD-FS-0236fc2eb7ef`, `EVD-FS-043ba4030729`, `EVD-FS-0483b1ebbcfc`, `EVD-FS-04d342866e6e`, `EVD-FS-054ba64d0a6c`, `EVD-FS-0629c42e054d`, `EVD-FS-06790a5145fd`, `EVD-FS-0be78d27cd9d`, `EVD-FS-0c091c45730e`

## 4. PROVENIÊNCIA & RASTREABILIDADE

Este relatório foi gerado deterministicamente sem injeção de dados de demonstração ou fixtures.
Todos os achados derivam de Evidências com hashes SHA-256 verificáveis contra o sistema de arquivos real.