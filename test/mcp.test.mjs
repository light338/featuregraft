import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fixture,write} from './fixtures.mjs';

test('real MCP stdio client discovers tools and completes a protected graft lifecycle',async t=>{
  const {source,target}=fixture(t);
  const client=new Client({name:'featuregraft-test',version:'1'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../bin/featuregraft.mjs',import.meta.url)),'mcp','--repo',target]});
  t.after(()=>client.close());await client.connect(transport);
  assert.equal((await client.listTools()).tools.length,8);
  const tool=async(name,args)=>{const r=await client.callTool({name,arguments:args});assert.equal(r.isError,undefined,JSON.stringify(r));return JSON.parse(r.content[0].text);};
  const inspected=await tool('graft_inspect_source',{source});assert.ok(inspected.entries.some(e=>e.path==='src/feature.ts'));
  const p=await tool('graft_prepare',{source,entry:'src/feature.ts',featureId:'mcp',instruction:'Bring value',checks:[[process.execPath,'--test','test/keep.test.mjs']]});
  write(p.candidate,{'value.mjs':'export const value=42;'});
  await tool('graft_finish',{planId:p.planId,note:'MCP integration fixture.'});
  assert.equal((await tool('graft_verify',{planId:p.planId})).passed,true);
  const invalid=await client.callTool({name:'graft_prepare',arguments:{source,entry:'src/feature.ts',featureId:'x',instruction:'x',checks:[[process.execPath,'-e','0']],repo:'/'}});
  assert.equal(invalid.isError,true);
});
