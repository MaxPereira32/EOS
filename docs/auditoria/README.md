# Convenção de Registro de Auditorias (regra geral — qualquer projeto)

Esta convenção é uma **regra de governança**, aplicável a **qualquer projeto** onde auditorias forem realizadas ou documentadas, não apenas ao EOS. Ela resolve uma falha da estrutura mínima por achado: com arquivos de nome fixo por achado (`parecer-auditoria.md`, `testes.md`…), uma segunda auditoria **misturaria ou sobrescreveria** registros da primeira.

## Princípio

**Toda auditoria é uma unidade de registro imutável, com identificador e pasta próprios. Nenhuma auditoria escreve na pasta de outra.**

## Identificadores

| Identificador | Formato | Onde é registrado |
|---|---|---|
| Auditoria | `AUD-<YYYY-MM-DD>-<NN>` | `registro-auditorias.md` (append-only) + pasta `auditorias/<AUD-ID>/` |
| Sequência curta | `A1`, `A2`, … | mapa no registro (para nomes de evidência) |
| Achado | `<ID estável>` (ex.: `EOS-GOV-003`) | `auditorias/<AUD-ID>/achados/<ID>/` |
| Rodada | `R<NN>-<YYYY-MM-DD>-<slug>` | `achados/<ID>/rodadas/<R…>/` |
| Evidência | `EVD-<Aseq>-<achado>-<nnn>-<slug>` | `achados/<ID>/evidencias/` + manifesto |
| Parecer | um arquivo por rodada/veredito | `achados/<ID>/rodadas/<R…>/parecer.md` |

## Estrutura

```
docs/auditoria/
├── diretriz-governanca.md        # política normativa (imutável)
├── registro-auditorias.md        # índice global de auditorias (append-only)
├── README.md                     # esta convenção
└── auditorias/
    └── AUD-<YYYY-MM-DD>-<NN>/    # ⬅ UMA PASTA POR AUDITORIA
        ├── escopo.md             # identificação, baseline, executores/auditores, limitações
        ├── plano-de-correcoes.md # status corrente DESTA auditoria
        ├── matriz-rastreabilidade.md
        ├── historico-decisoes.md # decisões datadas (append-only)
        └── achados/
            └── <ID-DO-ACHADO>/
                ├── diagnostico.md
                ├── criterios-aceite.md
                ├── rodadas/
                │   └── R<NN>-<data>-<slug>/
                │       ├── implementacao.md
                │       ├── testes.md
                │       └── parecer.md
                └── evidencias/
                    ├── MANIFEST.md            # append-only: EVD → arquivo → SHA-256 → rodada → critério
                    └── EVD-<Aseq>-…           # artefatos brutos, imutáveis
```

## Regras de isolamento (obrigatórias)

1. **Auditoria nova = pasta nova + linha nova** em `registro-auditorias.md`. Nunca reaproveitar `AUD-ID`.
2. **Nenhuma escrita cruza auditorias.** Arquivos de `auditorias/AUD-x/` só são alterados dentro do ciclo de vida da própria AUD-x (antes do encerramento). Após encerrada, apenas **errata** (novo arquivo `ERRATA-n.md`).
3. **Rodada nova = arquivos novos** em `rodadas/R<n>-…/`; a rodada anterior permanece intacta (proibido sobrescrever `parecer.md` de rodada fechada).
4. **Evidência bruta é imutável.** Correções de evidência = novo arquivo com sufixo `-ERRATA-n`; o manifesto registra a relação.
5. **MANIFEST append-only** com SHA-256 por artefato; entradas publicadas não são editadas.
6. **Código alterado após aprovação** → avaliação de impacto; se afetar a validade, reabrir em nova rodada antes de manter status.
7. **Reutilização entre auditorias**: evidência de uma auditoria anterior pode ser *citada por ID*, jamais reutilizada como prova fresca sem revalidação na auditoria corrente.
8. **Reauditar um achado em outro momento** = nova `AUD` cria seu próprio dossiê do achado; o dossiê antigo permanece como história.

## Aplicação imediata em qualquer projeto

- Em projetos auditados pelo EOS, os artefatos de execução seguem a mesma regra mecanicamente: cada execução grava `.eos/auditorias/<run_id>/` (além do `.eos/auditoria.json` canônico de compatibilidade) — ver achado EOS-GOV-011.

## Registro histórico

- `plano_de_correcoes_auditoria_codex.md` (nesta pasta) é registro histórico da auditoria de origem; **não é editado**.
