# Avisos de terceiros e inventário de licenças

Este arquivo registra o procedimento para atribuição e licenças de terceiros no EOS. **Não é uma declaração de que a auditoria de todas as dependências, arquivos e materiais já foi concluída.**

## 1. Regra geral

O arquivo [LICENSE](LICENSE) cobre apenas os materiais aos quais seus termos se aplicam. Dependências, trechos de código, fontes, imagens, marcas, modelos, datasets e outros materiais externos podem ter licenças e condições próprias. Em caso de dúvida, não incorpore o material até confirmar sua origem e permissão.

## 2. Inventário a manter

Para cada dependência ou material externo relevante, registrar:

| Campo | Conteúdo esperado |
|---|---|
| Nome e versão | Nome identificável e versão/commit utilizado |
| Local de uso | Pacote, arquivo ou componente |
| Origem | URL oficial ou fonte verificável |
| Titular/autoria | Conforme declarado pela fonte |
| Licença | Identificador SPDX ou texto da licença |
| Obrigações | Avisos, atribuição, disponibilização de fonte ou outras condições |
| Evidência | Manifesto, arquivo de licença, URL ou relatório datado |
| Situação | Verificado, pendente, incompatível ou não aplicável |

## 3. Processo de revisão

1. Examinar package.json e o arquivo de lockfile.
2. Identificar dependências diretas e transitivas, incluindo suas licenças e avisos.
3. Verificar também conteúdo não gerenciado pelo pacote: código incorporado, exemplos, prompts, documentação, imagens e fontes.
4. Confirmar compatibilidade com a forma de distribuição planejada e preservar os avisos obrigatórios.
5. Registrar dúvidas e exceções; não classificar item desconhecido como compatível.
6. Repetir a revisão quando novas dependências ou materiais externos forem adicionados e antes de uma distribuição/release relevante.

## 4. Estado inicial

- [ ] Inventariar dependências diretas.
- [ ] Inventariar dependências transitivas.
- [ ] Verificar código e exemplos incorporados.
- [ ] Verificar prompts, documentação, imagens, fontes e demais ativos.
- [ ] Confirmar avisos obrigatórios e compatibilidade das licenças.
- [ ] Anexar relatório de ferramenta e revisar manualmente os casos ambíguos.
- [ ] Registrar data, responsável, versão/commit e exceções aprovadas.

**Estado:** pendente de auditoria documentada. Não interprete a ausência de uma entrada como prova de que não há material de terceiros.
