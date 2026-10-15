// Independent behavioral oracle: written before either agent adaptation.
// Does not import implementation helpers from the donor or candidate.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer,build} from 'vite';
import {chromium} from 'playwright';
import {project} from './setup.mjs';

const repo=process.cwd(),kind=process.argv[2]??'target',upstream=process.argv.includes('--upstream');
if(!['donor','target'].includes(kind))throw Error('Contract kind must be donor or target.');
if(!fs.existsSync(path.join(repo,'node_modules')))fs.symlinkSync(path.join(project,'node_modules'),path.join(repo,'node_modules'),'dir');
try{execFileSync(process.execPath,[path.join(project,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(repo,'tsconfig.json')],{cwd:repo,stdio:'pipe'});}catch(e){throw Error(`Typecheck failed:\n${e.stdout?.toString()??e.message}`);}
await build({root:repo,configFile:false,logLevel:'error'});
const server=await createServer({root:repo,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,fs:{allow:[repo,project]}}});
let browser;
function parseCsv(text) {
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
    else field+=c;
  }
  assert.equal(quoted,false,'Unclosed CSV quote');if(field||row.length){row.push(field);rows.push(row);}return rows;
}
try {
  await server.listen();const port=server.httpServer.address().port;
  const installedChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser=await chromium.launch({headless:true,...(process.env.FEATUREGRAFT_BROWSER?{executablePath:process.env.FEATUREGRAFT_BROWSER}:fs.existsSync(installedChrome)?{channel:'chrome'}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:980},acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle'});
  if(process.env.FEATUREGRAFT_SCREENSHOT)await page.screenshot({path:process.env.FEATUREGRAFT_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[],'Application runtime errors');
  const searchName=kind==='donor'?'Search projects':'Search work',filterName=kind==='donor'?'Category':'Status',sortName=kind==='donor'?'Sort by name':'Sort by project';
  assert.equal(await page.getByLabel(searchName,{exact:true}).count(),1,`${searchName} feature is missing`);
  const search=page.getByLabel(searchName,{exact:true}),filter=page.getByLabel(filterName,{exact:true}),rows=page.locator('tbody tr');
  assert.equal(await rows.count(),6,'All existing records must be rendered');
  if(kind==='target'){
    assert.equal(await page.getByRole('heading',{name:'Relay overview',exact:true}).count(),1,'Target brand was lost');
    assert.equal(await page.getByText('$6,600',{exact:true}).count(),1,'Existing portfolio total was lost');
    assert.equal(await page.getByText('NORTHSTAR',{exact:false}).count(),0,'Donor app branding was copied');
  }
  const names=()=>rows.locator('td:first-child').allTextContents();
  const all=await names();assert.deepEqual(all,[...all].sort((a,b)=>a.localeCompare(b)),'Initial order must be ascending');
  await page.getByRole('button',{name:sortName,exact:true}).click();assert.deepEqual(await names(),[...all].reverse(),'Sort toggle must reverse the current ordering');
  await page.getByRole('button',{name:sortName,exact:true}).click();
  await filter.selectOption({label:'Active'});assert.equal(await rows.count(),2,'Status filter');
  await search.fill('  AtLaS  ');assert.equal(await rows.count(),1,'Combined filter, whitespace and case handling');assert.equal((await names())[0],'Atlas redesign');
  await search.fill('no-such-record');assert.equal(await rows.count(),0,'Empty result');
  await search.fill('');await filter.selectOption({label:'All'});await search.fill('東京');assert.equal(await rows.count(),1,'Unicode search');
  await search.fill(upstream?'cafe':'Café');assert.equal(await rows.count(),1,upstream?'Upstream accent-insensitive search was not transferred':'Accented text search');assert.equal((await names())[0],'Café storefront');
  await search.fill('');await filter.selectOption({label:'Completed'});assert.equal(await rows.count(),2);
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();
  const download=await downloading,csv=fs.readFileSync(await download.path(),'utf8'),parsed=parseCsv(csv);
  const expected=kind==='donor'?[['Name','Category'],['Notes\narchive','Completed'],['Press "kit", Q4','Completed']]:[['Project','Status','Budget'],['Notes\narchive','Completed','100'],['Press "kit", Q4','Completed','650']];
  assert.deepEqual(parsed,expected,'CSV must use target fields, current filtered rows, quote escaping and embedded newlines');
  assert.deepEqual(errors,[],'Late application runtime errors');
  console.log(JSON.stringify({passed:true,kind,upstream,scenarios:['build-and-typecheck','existing-data','target-brand-and-total','sort','combined-filter','empty-results','unicode','accent-search','filtered-csv-escaping']}));
}finally{await browser?.close();await server.close();}
