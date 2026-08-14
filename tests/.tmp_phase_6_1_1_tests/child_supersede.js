
      const { FileFactRepository } = require('C:/Users/lindomax.pereira/Desktop/Portifolito/Projeto/Frameworck/EOS/EOS/core/storage/file-fact-repository.ts');
      const { canonicalHash } = require('C:/Users/lindomax.pereira/Desktop/Portifolito/Projeto/Frameworck/EOS/EOS/core/utils/canonical-json.ts');

      const storePath = process.argv[2];
      const factId = process.argv[3];
      const inpTag = process.argv[4];

      const repo = new FileFactRepository(storePath);
      const payload = { fact_type: "MODULE_DEPENDENCY", source_module: "Shared.ts", target_module: "Dep.ts", import_type: "STATIC", resolution_kind: "INTERNAL", resolution_strategy: "RELATIVE" };
      const semHash = canonicalHash(payload);

      const fact = {
        fact_id: factId,
        schema_version: "1.0",
        fact_type: "MODULE_DEPENDENCY",
        provider_id: "dependency-fact-provider",
        provider_version: "6.1.1",
        evidence_ids: ["EVD-SUP"],
        input_hash: inpTag,
        semantic_hash: semHash,
        lifecycle_status: "VALID",
        payload: payload,
        composite_confidence: 1.0,
        created_at: new Date().toISOString()
      };

      repo.save(fact);
    