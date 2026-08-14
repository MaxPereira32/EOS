
      const { FileFactRepository } = require('C:/Users/lindomax.pereira/Desktop/Portifolito/Projeto/Frameworck/EOS/EOS/core/storage/file-fact-repository.ts');
      const storePath = process.argv[2];
      const factJson = JSON.parse(process.argv[3]);

      const repo = new FileFactRepository(storePath);
      repo.save(factJson);
    