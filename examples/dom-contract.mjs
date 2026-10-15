// Same interaction scenarios as contract.mjs, with a DOM runtime for environments
// that cannot launch a browser process. No candidate/source implementation imports
// are used for expected results or CSV parsing.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {createServer,build} from 'vite';
import {project} from './setup.mjs';
const repo=process.cwd(),kind=process.argv[2]??'target',upstream=process.argv.includes('--upstream');
if(!['donor','target'].includes(kind))throw Error('Expected donor or target contract.');
if(!fs.existsSync(path.join(repo,'node_modules')))fs.symlinkSync(path.join(project,'node_modules'),path.join(repo,'node_modules'),'dir');
try{execFileSync(process.execPath,[path.join(project,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(repo,'tsconfig.json')],{cwd:repo,stdio:'pipe'});}catch(e){throw Error(`Typecheck failed:\n${e.stdout?.toString()??e.message}`);}
await build({root:repo,configFile:false,logLevel:'error'});
// Vite build sets NODE_ENV=production; interaction tests need React's test runtime.
process.env.NODE_ENV='test';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLAnchorElement','Node','Event','MouseEvent','MutationObserver'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=(await import('react')).default;
const {render,cleanup,waitFor}=await import('@testing-library/react');
const userModule=(await import('@testing-library/user-event')).default,user=(userModule.default??userModule).setup({document:dom.window.document});
const downloads=[];URL.createObjectURL=blob=>{downloads.push({blob});return 'blob:featuregraft-test';};URL.revokeObjectURL=()=>{};
dom.window.HTMLAnchorElement.prototype.click=function(){downloads.at(-1).name=this.download;};
const server=await createServer({root:repo,configFile:false,logLevel:'error',server:{fs:{allow:[repo,project]}},ssr:{external:['react','react-dom','react/jsx-runtime','react/jsx-dev-runtime']}});
function parseCsv(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}assert.equal(quoted,false);if(field||row.length){row.push(field);rows.push(row);}return rows;}
try {
  await server.listen();
  const fixture=[{id:'1',name:'Atlas redesign',category:'Active'},{id:'2',name:'Café storefront',category:'Active'},{id:'3',name:'Orbit launch',category:'Planned'},{id:'4',name:'Press "kit", Q4',category:'Completed'},{id:'5',name:'Tokyo 東京',category:'Planned'},{id:'6',name:'Notes\narchive',category:'Completed'}];
  const module=await server.ssrLoadModule(kind==='donor'?'/src/features/ProjectTable.tsx':'/src/App.tsx');
  const view=render(React.createElement(kind==='donor'?module.ProjectTable:module.App,kind==='donor'?{items:fixture}:{}));
  const label=kind==='donor'?'Search projects':'Search work',filterLabel=kind==='donor'?'Category':'Status',sortLabel=kind==='donor'?'Sort by name':'Sort by project';
  assert.equal(view.queryAllByLabelText(label,{exact:true}).length,1,`${label} feature is missing`);
  const search=view.getByLabelText(label,{exact:true}),filter=view.getByLabelText(filterLabel,{exact:true});
  const rows=()=>[...view.container.querySelectorAll('tbody tr')],names=()=>rows().map(row=>row.querySelector('td').textContent);
  assert.equal(rows().length,6);
  if(kind==='target') {assert.equal(view.queryAllByRole('heading',{name:'Relay overview',exact:true}).length,1);assert.equal(view.queryAllByText('$6,600',{exact:true}).length,1);assert.equal(view.queryAllByText(/NORTHSTAR/).length,0);}
  const all=names();assert.deepEqual(all,[...all].sort((a,b)=>a.localeCompare(b)));
  await user.click(view.getByRole('button',{name:sortLabel,exact:true}));assert.deepEqual(names(),[...all].reverse());
  await user.click(view.getByRole('button',{name:sortLabel,exact:true}));
  await user.selectOptions(filter,'Active');assert.equal(rows().length,2);
  await user.type(search,'  AtLaS  ');assert.equal(rows().length,1);assert.equal(names()[0],'Atlas redesign');
  await user.clear(search);await user.type(search,'no-such-record');assert.equal(rows().length,0);
  await user.clear(search);await user.selectOptions(filter,'All');await user.type(search,'東京');assert.equal(rows().length,1);
  await user.clear(search);await user.type(search,upstream?'cafe':'Café');assert.equal(rows().length,1,upstream?'Upstream accent-insensitive search was not transferred':'Accented text search');assert.equal(names()[0],'Café storefront');
  await user.clear(search);await user.selectOptions(filter,'Completed');assert.equal(rows().length,2);
  await user.click(view.getByRole('button',{name:'Export CSV',exact:true}));assert.equal(downloads.length,1);assert.match(downloads[0].name,/\.csv$/);
  const csv=await downloads[0].blob.text();
  const expected=kind==='donor'?[['Name','Category'],['Notes\narchive','Completed'],['Press "kit", Q4','Completed']]:[['Project','Status','Budget'],['Notes\narchive','Completed','100'],['Press "kit", Q4','Completed','650']];
  assert.deepEqual(parseCsv(csv),expected,'Filtered export and CSV quoting must survive');
  console.log(JSON.stringify({passed:true,runtime:'jsdom',kind,upstream,scenarios:['build-and-typecheck','existing-data','target-brand-and-total','sort','combined-filter','empty-results','unicode','accent-search','filtered-csv-escaping']}));
}finally{cleanup();dom.window.close();await server.close();}
