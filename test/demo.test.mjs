import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setup,project} from '../examples/setup.mjs';
import {run} from '../src/git.mjs';
import {extractSource} from '../src/source.mjs';

test('source React feature passes independent interactions; target baseline lacks that feature',t=>{
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'graft-react-test-'));
  t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
  const {source,target}=setup(path.join(parent,'demo'));
  const capsule=extractSource(source,'src/features/ProjectTable.tsx');assert.equal(capsule.files.length,3);
  const baseline=run(source,process.execPath,[path.join(project,'examples/dom-contract.mjs'),'donor'],{timeout:120000});
  assert.equal(baseline.ok,true,baseline.stdout+baseline.stderr);assert.match(baseline.stdout,/"passed":true/);
  const original=run(target,process.execPath,['--experimental-strip-types','--test','test/baseline.test.mjs']);assert.equal(original.ok,true,original.stderr);
  const absent=run(target,process.execPath,[path.join(project,'examples/dom-contract.mjs'),'target'],{timeout:120000});
  assert.equal(absent.ok,false);assert.match(absent.stderr,/Search work feature is missing/);
});
