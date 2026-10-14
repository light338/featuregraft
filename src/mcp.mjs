import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {FeatureGraft} from './core.mjs';

const str={type:'string',minLength:1,maxLength:16000};
const list={type:'array',items:str,maxItems:128};
const checks={type:'array',minItems:1,maxItems:32,items:{type:'array',minItems:1,maxItems:64,items:str}};
const schema=(properties,required)=>({type:'object',properties,required,additionalProperties:false});
const tools=[
  ['graft_inspect_source','Inspect source license, package and exported entry points. Choose the feature entry before preparing.',schema({source:str},['source']),'inspectSource',true],
  ['graft_prepare','Extract the selected feature and its static local imports into a pinned capsule. Create an isolated target worktree; register frozen behavioral checks before adaptation.',schema({source:str,entry:str,featureId:str,instruction:str,checks,contractFiles:list},['source','entry','featureId','instruction','checks']),'prepare',false],
  ['graft_prompt','Read the adaptation brief, exact source files, dependencies, checks and upstream differences.',schema({planId:str},['planId']),'prompt',true],
  ['graft_finish','Snapshot the implemented candidate, add original license and source provenance. Call again if candidate implementation changes.',schema({planId:str,note:str},['planId','note']),'finish',false],
  ['graft_verify','Run registered checks in the candidate. Reject changed existing tests, external contracts, source capsules or original repositories.',schema({planId:str},['planId']),'verify',false],
  ['graft_inspect','Inspect candidate diff, check results, evidence integrity and verification freshness.',schema({planId:str},['planId']),'inspect',true],
  ['graft_updates','Compare the original feature capsule with the latest source commit, including new local dependencies.',schema({planId:str},['planId']),'updates',true],
  ['graft_prepare_update','Create a new candidate based on the last verified adaptation (or its accepted target receipt), carrying the new source diff for agent adaptation.',schema({planId:str,instruction:str,checks,contractFiles:list},['planId','instruction']),'prepareUpdate',false],
];
function validate(value,s) {
  if(s.type==='object') {
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Tool arguments must be an object.');
    for(const key of s.required)if(!(key in value))throw Error(`Missing ${key}.`);
    for(const [key,item]of Object.entries(value)){if(!s.properties[key])throw Error(`Unknown argument ${key}.`);validate(item,s.properties[key]);}
  } else if(s.type==='array') {
    if(!Array.isArray(value)||value.length<(s.minItems??0)||value.length>(s.maxItems??128))throw Error('Invalid array argument.');
    for(const item of value)validate(item,s.items);
  } else if(typeof value!=='string'||value.length<(s.minLength??0)||value.length>(s.maxLength??16000))throw Error('Invalid string argument.');
}
export async function serve(target) {
  const app=new FeatureGraft(target);
  const server=new Server({name:'featuregraft',version:'0.1.0'},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:tools.map(([name,description,inputSchema,,readOnlyHint])=>({name,description,inputSchema,annotations:{readOnlyHint,destructiveHint:name==='graft_verify',openWorldHint:name==='graft_verify'||name==='graft_inspect_source'||name==='graft_prepare'||name==='graft_updates'||name==='graft_prepare_update'}}))}));
  server.setRequestHandler(CallToolRequestSchema,async request=>{
    try {
      const tool=tools.find(t=>t[0]===request.params.name);if(!tool)throw Error('Unknown tool.');
      const args=request.params.arguments??{};validate(args,tool[2]);
      const result=app[tool[3]](args);
      return {content:[{type:'text',text:typeof result==='string'?result:JSON.stringify(result,null,2)}]};
    }catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
  });
  await server.connect(new StdioServerTransport());
}
