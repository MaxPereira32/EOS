import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export function causalFixture(mode = 'ASSERTION', replacement = 'enabled: false') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-causal-test-'));
  fs.mkdirSync(path.join(root, 'src', 'domain'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/domain/security.js'), 'module.exports = { enabled: true };');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({scripts:{'security:test':'node check.js'}}));
  fs.writeFileSync(path.join(root, 'check.js'), `
const assert = require('node:assert/strict');
const mode = ${JSON.stringify(mode)};
const emit = (type, details) => console.log('EOS_CAUSAL_RECORD ' + JSON.stringify({
 version:1, nonce:process.env.EOS_CAUSAL_NONCE, phase:process.env.EOS_CAUSAL_PHASE,
 claim_id:process.env.EOS_CAUSAL_CLAIM_ID, assertion_id:process.env.EOS_CAUSAL_ASSERTION_ID,
 type,...details
}));
const enabled = require('./src/domain/security.js').enabled;
if (!enabled && mode === 'INFRA') throw new Error('Database unavailable');
if (!enabled && mode === 'UNMARKED') process.exit(1);
if (mode === 'NO_BASELINE') process.exit(0);
try {
 assert.equal(mode === 'SURVIVOR' ? true : enabled, true);
 emit('ASSERTION',{status:'PASS'}); emit('COMPLETION',{kind:'PASS'});
} catch(error) {
 if(mode === 'STALE') process.env.EOS_CAUSAL_NONCE='old-run';
 if(mode === 'WRONG_ASSERTION') process.env.EOS_CAUSAL_ASSERTION_ID='wrong';
 emit('ASSERTION',{status:'FAIL'}); emit('COMPLETION',{kind:mode === 'FATAL'?'INFRASTRUCTURE':'ASSERTION'});
 if(mode === 'DUPLICATE') emit('ASSERTION',{status:'PASS'});
 process.exitCode = mode === 'ZERO_EXIT' ? 0 : 1;
}
`);
  fs.writeFileSync(path.join(root, 'eos.causal.json'), JSON.stringify({claims:{
    'SEC-CLAIM-TEST-001':{kind:'TEXT_REPLACE',target:'src/domain/security.js',search:'enabled: true',
      replacement,expected_replacements:1,assertion_id:'CONTROL-ENABLED'}
  }}));
  return root;
}
