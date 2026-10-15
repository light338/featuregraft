import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setup,project} from './setup.mjs';
import {git,run,fingerprint,hash} from '../src/git.mjs';
import {FeatureGraft} from '../src/core.mjs';

const root=path.resolve(process.argv[2]??path.join(project,'demo-work'));
const {source,target}=setup(root),evidence=path.join(root,'evidence');
const domOnly=process.env.FEATUREGRAFT_DOM_ONLY==='1';
const contract=path.join(project,domOnly?'examples/dom-contract.mjs':'examples/contract.mjs'),before={source:fingerprint(source),target:fingerprint(target),contract:hash(fs.readFileSync(contract))};
const oracle=(cwd,kind,phase,upstream=false)=>{
  const result=run(cwd,process.execPath,[contract,kind,...(upstream?['--upstream']:[])],{timeout:120000,env:{FEATUREGRAFT_SCREENSHOT:path.join(evidence,`${phase}.png`)}});
  fs.writeFileSync(path.join(evidence,`${phase}.json`),JSON.stringify(result,null,2)+'\n');return result;
};
assert.equal(oracle(source,'donor','source-before').ok,true,'Source feature must pass independent baseline checks.');
assert.equal(oracle(target,'target','target-before').ok,false,'The original target must not already contain the feature.');
const app=new FeatureGraft(target);
async function agent(phase,prompt) {
  fs.writeFileSync(path.join(evidence,`${phase}-prompt.txt`),prompt);
  const args=['exec','--ephemeral','--ignore-user-config','-s',process.env.FEATUREGRAFT_CODEX_SANDBOX??'workspace-write','-c','approval_policy="never"','-C',target,'--add-dir',root,'--json',
    '-c',`mcp_servers.featuregraft.command=${JSON.stringify(process.execPath)}`,
    '-c',`mcp_servers.featuregraft.args=${JSON.stringify([path.join(project,'examples/mcp-observer.mjs'),path.join(project,'bin/featuregraft.mjs'),target,path.join(evidence,'mcp.jsonl')])}`,
    '-c','mcp_servers.featuregraft.tool_timeout_sec=300','-o',path.join(evidence,`${phase}-final.txt`),'-'];
  const child=spawn(process.env.FEATUREGRAFT_CODEX_BIN??'codex',args,{env:{...process.env,PATH:`${path.dirname(process.execPath)}:${process.env.PATH}`},stdio:['pipe','pipe','pipe']});
  child.stdin.end(prompt);child.stdout.pipe(fs.createWriteStream(path.join(evidence,`${phase}-events.jsonl`)));child.stderr.pipe(fs.createWriteStream(path.join(evidence,`${phase}-stderr.txt`)));
  await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(`Codex ${phase} exited ${code}. Inspect evidence logs.`)));});
}
const firstPrompt=`Use FeatureGraft MCP to bring the working ProjectTable feature from ${source} into the existing Relay target. Call graft_inspect_source, then graft_prepare with entry src/features/ProjectTable.tsx, featureId project-table and checks ${JSON.stringify([[process.execPath,'--experimental-strip-types','--test','test/baseline.test.mjs'],[process.execPath,contract,'target']])}. Read graft_prompt. Implement the adaptation yourself, only in the returned candidate; no prewritten adapter is provided. Reuse the donor's behavior and static dependency evidence. Adapt the feature to the existing WorkItem records: key/project/stage/budget. Preserve Relay branding, sidebar, existing portfolio total and target design. Add a table with Search work input, Status select including All, a Sort by project button toggling name order, and Export CSV using columns Project,Status,Budget and current visible rows. Retain source CSV escaping and Unicode search. Use existing records, not copied donor data. Existing target tests, source repository, capsule and external oracle must remain byte-for-byte unchanged. Add your own tests if useful. The demo uses the dependency installation at ${path.join(project,'node_modules')}; if necessary symlink it as ignored node_modules in the candidate. Call graft_finish with a real adaptation note, graft_verify and graft_inspect. Fix actual implementation errors and finish/reverify if needed. Do not edit the ledger, weaken checks, merge or touch either original. Report evidence and limits.`;
console.log(`Live agent transplant. Evidence: ${evidence}`);await agent('transplant',firstPrompt);
let plans=Object.values(app.load().plans);assert.equal(plans.length,1,'Agent did not create exactly one transplant plan.');
const first=app.inspect({planId:plans[0].planId});assert.equal(first.status,'checks_passed',JSON.stringify(first));assert.equal(first.verificationStale,false);
assert.deepEqual(fingerprint(source),before.source);assert.deepEqual(fingerprint(target),before.target);
assert.equal(oracle(first.candidate,'target','target-after').ok,true);
fs.writeFileSync(path.join(evidence,'transplant.diff'),git(first.candidate,['diff',plans[0].base]));

// An authored upstream change is the input to the second agent task, not a prewritten target repair.
const logic=path.join(source,'src/features/logic.ts');let content=fs.readFileSync(logic,'utf8');
content=content.replace('query.trim().toLocaleLowerCase()','fold(query.trim())').replace('item.name.toLocaleLowerCase()','fold(item.name)');
content="const fold=(text:string)=>text.normalize('NFD').replace(/\\p{Diacritic}/gu,'').toLocaleLowerCase();\n"+content;
fs.writeFileSync(logic,content);git(source,['add','.']);git(source,['commit','-qm','Make search accent-insensitive']);
const updatedSource=fingerprint(source);
assert.equal(oracle(source,'donor','source-updated',true).ok,true);
assert.equal(oracle(first.candidate,'target','old-target-update-check',true).ok,false,'New upstream behavior must not already be present.');
const secondPrompt=`Use FeatureGraft MCP to carry the new upstream accent-insensitive search fix into the verified ${first.planId} graft. Call graft_updates, then graft_prepare_update with planId ${first.planId}, instruction Preserve the Relay adaptation and carry accent-insensitive search so cafe finds Café, and checks ${JSON.stringify([[process.execPath,'--experimental-strip-types','--test','test/baseline.test.mjs'],[process.execPath,contract,'target','--upstream']])}. Read graft_prompt. Apply the source diff yourself ONLY in the new candidate, preserving the target data model, style, sorting and CSV behavior. Do not edit the previous candidate or either original, the oracle, existing tests, capsule or ledger. Call graft_finish, graft_verify and graft_inspect; fix actual implementation errors and reverify if necessary. No target repair code is supplied.`;
console.log('Live agent upstream update.');await agent('update',secondPrompt);
plans=Object.values(app.load().plans);assert.equal(plans.length,2);
const second=app.inspect({planId:plans[1].planId});assert.equal(second.status,'checks_passed',JSON.stringify(second));assert.equal(second.verificationStale,false);
assert.deepEqual(fingerprint(source),updatedSource);assert.deepEqual(fingerprint(target),before.target);
assert.equal(hash(fs.readFileSync(contract)),before.contract);assert.equal(oracle(second.candidate,'target','target-updated',true).ok,true);
const messages=fs.readFileSync(path.join(evidence,'mcp.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const calls=messages.filter(m=>m.direction==='request'&&m.message.method==='tools/call').map(m=>m.message.params.name);
for(const name of ['graft_inspect_source','graft_prepare','graft_prompt','graft_finish','graft_verify','graft_inspect','graft_updates','graft_prepare_update'])assert.ok(calls.includes(name),`Missing actual MCP call ${name}`);
const report={liveAgent:true,prewrittenTargetAdapters:false,verificationRuntime:domOnly?'jsdom':'Chromium',scenario:'One React/TypeScript feature transplant and authored upstream fix',originalTargetUnchanged:true,sourceUnchangedDuringEachAdaptation:true,contractUnchanged:true,
  sourceEntry:'src/features/ProjectTable.tsx',sourceClosure:plans[0].capsule.manifest.files.map(f=>f.path),dependencies:plans[0].capsule.manifest.dependencies,
  transplant:{planId:first.planId,candidate:first.candidate,verification:first.verification},update:{planId:second.planId,candidate:second.candidate,verification:second.verification},mcpCalls:calls,
  scope:'Controlled local fixtures, not independently selected projects or external adoption.'};
fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(evidence,'update.diff'),git(second.candidate,['diff',plans[1].base]));
console.log(JSON.stringify({passed:true,transplant:first.candidate,update:second.candidate,evidence},null,2));
