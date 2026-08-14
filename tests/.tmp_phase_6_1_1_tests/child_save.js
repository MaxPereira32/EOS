
      const { FileFactRepository } = require('C:/Users/lindomax.pereira/Desktop/Portifolito/Projeto/Frameworck/EOS/EOS/core/storage/file-fact-repository.ts');
      const { canonicalHash } = require('C:/Users/lindomax.pereira/Desktop/Portifolito/Projeto/Frameworck/EOS/EOS/core/utils/canonical-json.ts');
      const storePath = process.argv[2];
      const factId = process.argv[3];
      const semTag = process.argv[4];

      const repo = new FileFactRepository(storePath);
      const fact = {
        fact_id: factId,
        schema_version: "1.0",
        fact_type: "MODULE_DEPENDENCY",
        provider_id: "dependency-fact-provider",
        provider_version: "6.1.1",
        evidence_ids: ["EVD-PROC"],
        input_hash: "a".repeat(64),
        semantic_hash: semTag,
        lifecycle_status: "VALID",
        payload: {
          fact_type: "MODULE_DEPENDENCY",
          source_module: factId,
          target_module: "Target.ts",
          import_type: "STATIC",
          resolution_kind: "INTERNAL",
          resolution_strategy: "RELATIVE"
        },
        composite_confidence: 1.0,
        created_at: new Date().toISOString()
      };

      fact.semantic_hash = canonicalHash(fact.payload);
      repo.save(fact);
    