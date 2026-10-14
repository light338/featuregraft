#!/usr/bin/env node
import fs from 'node:fs';
import {FeatureGraft} from '../src/core.mjs';
import {serve} from '../src/mcp.mjs';
const args=process.argv.slice(2),command=args.shift();let repo=process.cwd(),input='{}';
try {
  while(args.length){const arg=args.shift();if(arg==='--repo')repo=args.shift();else if(arg==='--json')input=args.shift();else if(arg==='--input')input=fs.readFileSync(args.shift(),'utf8');else throw Error(`Unknown option: ${arg}`);}
  if(!command||['help','--help'].includes(command))console.log(`FeatureGraft 0.1.0 — bring a working feature into your project
Usage: featuregraft COMMAND --repo /absolute/target [--json JSON | --input request.json]
Commands: source, prepare, prompt, finish, verify, inspect, updates, update, mcp
source:  {source: local Git root or public HTTPS GitHub repo}
prepare: {source,entry,featureId,instruction,checks:[[command,arg,...]],contractFiles?:[],output?:path}
finish:  {planId,note}
prompt / verify / inspect / updates: {planId}
update:  {planId,instruction,checks?:[],contractFiles?:[],output?:path}
MCP: codex mcp add featuregraft -- node /absolute/featuregraft/bin/featuregraft.mjs mcp --repo /absolute/target
See README.md for supported source imports, frozen checks and candidate review.`);
  else if(command==='--version')console.log('0.1.0');
  else if(command==='mcp')await serve(repo);
  else {
    const method={source:'inspectSource',prepare:'prepare',prompt:'prompt',finish:'finish',verify:'verify',inspect:'inspect',updates:'updates',update:'prepareUpdate'}[command];
    if(!method)throw Error(`Unknown command: ${command}`);
    const result=new FeatureGraft(repo)[method](JSON.parse(input));console.log(typeof result==='string'?result:JSON.stringify(result,null,2));
    if(command==='verify'&&!result.passed)process.exitCode=2;
  }
}catch(e){console.error(e.message);process.exitCode=1;}
