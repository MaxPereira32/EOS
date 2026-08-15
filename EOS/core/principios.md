# EOS Architectural Principles

## TRUSTED ENVIRONMENT VERIFICATION PRINCIPLE

O EOS é um sistema de verificação confiável dentro de um ambiente confiável (*Trusted Environment*).

O EOS fornece garantias de verificação, causalidade, integridade referencial e imutabilidade no nível de domínio dentro do ambiente executor considerado confiável. 

Essas garantias dependem da integridade do runtime (Node.js), do sistema de arquivos (Filesystem), do isolamento de processos executores e dos artefatos de referência utilizados pelo EOS.

O EOS **NÃO** afirma autenticidade criptográfica independente contra um adversário que controle integralmente o Trust Boundary (ex: acesso root local ao host com capacidade de adulterar síncronamente o payload e recalcular os hashes canônicos).

---

## EVIDENCE NON-EQUIVALENCE PRINCIPLE

O EOS NUNCA deve transformar:

ausência de evidência
em:
evidência de ausência.

Toda conclusão afirmativa DEVE ser sustentada por uma cadeia de evidências observada, atribuível, reproduzível e com escopo devidamente delimitado.

Estados desconhecidos, ambíguos, indisponíveis, corrompidos ou não verificados DEVEM permanecer distinguíveis de estados negativos verificados.

### Implicações Práticas
1. **Empty Findings:** A ausência de achados (`findings: []`) não implica automaticamente um estado CLEAN ou VERIFIED a menos que uma execução válida do pipeline tenha observado o domínio e provado explicitamente a ausência de vulnerabilidades.
2. **Semântica de Migração:** Um artefato legado sem a propriedade `finding` não pode ser inferido como vazio. Semânticas desconhecidas ou ambíguas devem ser rejeitadas.
3. **Resultados de Teste:** Um teste não executado (pulado, ausente) não equivale a PASS.
4. **Artefatos Corrompidos:** A ausência de evidências dentro de um artefato corrompido não pode produzir conclusão positiva.
5. **Auto-Governança:** A verificação interna das regras do EOS contra seus próprios módulos atesta a auto-consistência (*Self-Consistency*), mas não equivale à atestação independente (*Independent Assurance*) por oráculo externo.
