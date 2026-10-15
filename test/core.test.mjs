import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {FeatureGraft} from '../src/core.mjs';
import {fingerprint,git} from '../src/git.mjs';
import {fixture,write,commit} from './fixtures.mjs';
const prepare=(app,source,extra={})=>app.prepare({source,entry:'src/feature.ts',featureId:'answer',instruction:'Bring the answer into this app; preserve original.',checks:[[process.execPath,'--test','test/keep.test.mjs'],[process.execPath,'-e',"import('./answer.mjs').then(m=>{if(m.answer!==42)process.exit(1)})"]],...extra});
function adapt(app,p,value=42){write(p.candidate,{'answer.mjs':`export const answer=${value};\n`});app.finish({planId:p.planId,note:'Adapted named export to the target interface.'});}

test('creates pinned source capsule and verifies adaptation while preserving both originals',t=>{
  const {source,target}=fixture(t),app=new FeatureGraft(target),before={source:fingerprint(source),target:fingerprint(target)};
  const p=prepare(app,source);adapt(app,p);
  assert.equal(app.verify({planId:p.planId}).passed,true);
  const inspected=app.inspect({planId:p.planId});assert.equal(inspected.status,'checks_passed');assert.equal(inspected.verificationStale,false);
  assert.match(inspected.diff,/\+export const answer=42/,'Review diff must include new untracked feature files');
  assert.deepEqual(fingerprint(source),before.source);assert.deepEqual(fingerprint(target),before.target);
  const receipt=JSON.parse(fs.readFileSync(path.join(p.candidate,'.featuregraft/answer.json')));
  assert.equal(receipt.source.commit,p.sourceCommit);assert.equal(receipt.source.files.length,2);
  assert.ok(fs.existsSync(path.join(p.candidate,'.featuregraft/licenses/answer.txt')));
  write(p.candidate,{'answer.mjs':'export const answer=0;'});
  assert.equal(app.inspect({planId:p.planId}).status,'checks_stale');
  assert.throws(()=>app.verify({planId:p.planId}),/Finish the current candidate/);
});

test('rejects weakened existing tests and changed external contracts before claiming success',t=>{
  const {root,source,target}=fixture(t),app=new FeatureGraft(target);
  const oracle=path.join(root,'oracle.mjs');fs.writeFileSync(oracle,'console.log("external");\n');
  const p=prepare(app,source,{checks:[[process.execPath,oracle]],contractFiles:[oracle]});
  write(p.candidate,{'answer.mjs':'export const answer=42;','test/keep.test.mjs':'// assertions deleted'});
  assert.throws(()=>app.finish({planId:p.planId,note:'Attempt'}),/Existing test was changed/);
  fs.copyFileSync(path.join(target,'test/keep.test.mjs'),path.join(p.candidate,'test/keep.test.mjs'));
  app.finish({planId:p.planId,note:'Restored the original checks.'});
  fs.writeFileSync(oracle,'// removed external assertions');
  assert.throws(()=>app.verify({planId:p.planId}),/External contract was changed/);
});

test('fails checks that mutate candidate files and detects a changed source capsule',t=>{
  const {source,target}=fixture(t),app=new FeatureGraft(target);
  const p=prepare(app,source,{checks:[[process.execPath,'-e',"require('fs').writeFileSync('answer.mjs','changed')"]]});adapt(app,p);
  const verified=app.verify({planId:p.planId});assert.equal(verified.passed,false);assert.equal(verified.changedDuringChecks,true);
  const cap=app.get(p.planId).capsule;fs.appendFileSync(path.join(cap.directory,'files/src/value.ts'),'// changed');
  assert.equal(app.inspect({planId:p.planId}).status,'integrity_failed');
});

test('refuses overwritten destinations, nested candidates, missing checks and replaced worktrees',t=>{
  const {root,source,target}=fixture(t),app=new FeatureGraft(target);
  assert.throws(()=>prepare(app,source,{checks:[]}),/behavioral check/);
  assert.throws(()=>prepare(app,source,{output:source}),/must not exist/);
  assert.throws(()=>prepare(app,source,{output:path.join(target,'nested')}),/outside both/);
  assert.throws(()=>app.inspectSource({source:'https://attacker.invalid/repo'}),/public HTTPS GitHub/);
  const p=prepare(app,source);fs.renameSync(p.candidate,path.join(root,'real-candidate'));fs.symlinkSync(path.join(root,'real-candidate'),p.candidate);
  assert.throws(()=>app.finish({planId:p.planId,note:'Attempt'}),/symlink/);
});

test('upstream update starts from the verified adaptation and carries only changed source evidence',t=>{
  const {source,target}=fixture(t),app=new FeatureGraft(target),p=prepare(app,source);adapt(app,p);app.verify({planId:p.planId});
  const adaptedCommit=app.get(p.planId).adaptedCommit;
  write(source,{'src/value.ts':'export const value=43;\n'});commit(source);
  const delta=app.updates({planId:p.planId});assert.deepEqual(delta.changes,[{file:'src/value.ts',kind:'changed'}]);assert.match(delta.diff,/43/);
  const next=app.prepareUpdate({planId:p.planId,instruction:'Carry upstream value 43, preserve the target interface.',checks:[[process.execPath,'-e',"import('./answer.mjs').then(m=>{if(m.answer!==43)process.exit(1)})"]]});
  assert.equal(git(next.candidate,['rev-parse','HEAD']),adaptedCommit);assert.equal(fs.readFileSync(path.join(next.candidate,'answer.mjs'),'utf8'),'export const answer=42;\n');
  adapt(app,next,43);assert.equal(app.verify({planId:next.planId}).passed,true);
  assert.equal(app.get(next.planId).parentPlan,p.planId);
});
