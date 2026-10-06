import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeclaredClaimCausalityEngine } from '../core/engines/declared-claim-causality-engine';
import { causalFixture } from './causal-fixture';

function evaluate(root: string) {
 return new DeclaredClaimCausalityEngine().evaluateCausality(root,'SEC-CLAIM-TEST-001',
   'src/domain/security.js','security:test','eos.causal.json');
}
test('assertion identificada PASS -> FAIL prova causal e preserva alvo original', () => {
 const root=causalFixture();
 try {
  const original=fs.readFileSync(path.join(root,'src/domain/security.js'),'utf8');
  const result=evaluate(root);
  assert.equal(result.causality_proven,true);
  assert.equal(result.original_status,'PASS');
  assert.equal(result.mutated_status,'FAIL');
  assert.ok(result.validation_evidence);
  assert.equal(fs.readFileSync(path.join(root,'src/domain/security.js'),'utf8'),original);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
for(const mode of ['SURVIVOR','INFRA','UNMARKED','NO_BASELINE','STALE','WRONG_ASSERTION','FATAL','DUPLICATE','ZERO_EXIT']) {
 test('não promove evidência inválida: '+mode,()=>{
  const root=causalFixture(mode);
  try {assert.equal(evaluate(root).causality_proven,false);}
  finally {fs.rmSync(root,{recursive:true,force:true});}
 });
}
test('erro de sintaxe no mutante não prova controle',()=>{
 const root=causalFixture('ASSERTION','enabled: !!!');
 try {assert.equal(evaluate(root).causality_proven,false);}
 finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('spec inválido, match ausente e path traversal falham fechados',()=>{
 const root=causalFixture();
 try {
  const specPath=path.join(root,'eos.causal.json');
  const spec=JSON.parse(fs.readFileSync(specPath,'utf8'));
  spec.claims['SEC-CLAIM-TEST-001'].search='missing';
  fs.writeFileSync(specPath,JSON.stringify(spec));
  assert.equal(evaluate(root).causality_proven,false);
  spec.claims['SEC-CLAIM-TEST-001'].expected_replacements=0;
  fs.writeFileSync(specPath,JSON.stringify(spec));
  assert.equal(evaluate(root).causality_proven,false);
  assert.equal(new DeclaredClaimCausalityEngine().evaluateCausality(root,'x','../escape.js',
    'security:test','eos.causal.json').causality_proven,false);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('timeout inválido é falha operacional, nunca prova',()=>{
 const root=causalFixture();const previous=process.env.EOS_CAUSAL_TIMEOUT_MS;
 try {process.env.EOS_CAUSAL_TIMEOUT_MS='NaN';assert.equal(evaluate(root).causality_proven,false);}
 finally {
  if(previous===undefined)delete process.env.EOS_CAUSAL_TIMEOUT_MS;else process.env.EOS_CAUSAL_TIMEOUT_MS=previous;
  fs.rmSync(root,{recursive:true,force:true});
 }
});

test('JSON null é rejeitado sem lançar exceção',()=>{
 const root=causalFixture();
 try {fs.writeFileSync(path.join(root,'eos.causal.json'),'null');assert.equal(evaluate(root).causality_proven,false);}
 finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('symlink copiado não permite escrever no alvo original', (t)=>{
 const root=causalFixture();
 try {
  const file=path.join(root,'src/domain/security.js');
  const actual=path.join(root,'original.js');
  fs.renameSync(file,actual);
  try {fs.symlinkSync(actual,file,'file');}
  catch(error) {if((error as NodeJS.ErrnoException).code==='EPERM'){t.skip('Sistema não autoriza symlink de arquivo');return;}throw error;}
  const original=fs.readFileSync(actual,'utf8');
  assert.equal(evaluate(root).causality_proven,false);
  assert.equal(fs.readFileSync(actual,'utf8'),original);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
