import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {git,hash,repoRoot,clean,safeRelative} from './git.mjs';

const supported=/\.(?:[cm]?tsx?|[cm]?jsx?|json|css)$/i;
export function sourceTree(repo,revision='HEAD') {
  repo=repoRoot(repo); clean(repo);
  if(typeof revision!=='string'||revision.startsWith('-')||/[\s\0]/.test(revision)) throw Error('Invalid source revision.');
  const commit=git(repo,['rev-parse','--verify',`${revision}^{commit}`]);
  const files=new Map(git(repo,['ls-tree','-rz',commit]).split('\0').filter(Boolean).map(line=>{
    const [meta,name]=line.split('\t'),[mode,type,oid]=meta.split(' ');return [name,{mode,type,oid}];
  }));
  const read=file=>{
    const item=files.get(safeRelative(file));
    if(!item||item.type!=='blob'||!['100644','100755'].includes(item.mode)) throw Error(`Not a regular tracked source file: ${file}`);
    const value=git(repo,['show',`${commit}:${file}`]);
    if(value.includes('\0')||Buffer.byteLength(value)>1024*1024) throw Error(`Binary or oversized source file: ${file}`);
    // git() strips trailing whitespace only at end-of-output; read blob bytes exactly.
    return git(repo,['cat-file','blob',item.oid],{encoding:'buffer'});
  };
  // Buffer decoding happens explicitly so file hashes preserve trailing newlines.
  const readText=file=>{
    const bytes=read(file);
    try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error(`Non-UTF-8 source file: ${file}`);}
  };
  return {repo,commit,files,read:readText};
}
export function importsOf(file,content) {
  if(file.endsWith('.css')) {
    const imports=[...content.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)].map(m=>m[1]);
    const urls=[...content.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g)].map(m=>m[1]);
    return [...new Set([...imports,...urls].filter(s=>!s.startsWith('data:')&&!/^https?:/.test(s)&&!s.startsWith('#')).map(s=>s.startsWith('.')?s:`./${s}`))];
  }
  if(!/\.[cm]?[jt]sx?$/.test(file)) return [];
  const source=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true);
  const imports=[];
  function visit(node) {
    let specifier;
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)) specifier=node.moduleSpecifier;
    else if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference)) specifier=node.moduleReference.expression;
    else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))) {
      specifier=node.arguments[0];
      if(!specifier||!ts.isStringLiteralLike(specifier)) throw Error(`Computed imports need manual extraction: ${file}`);
    }
    if(specifier&&ts.isStringLiteralLike(specifier)) imports.push(specifier.text);
    ts.forEachChild(node,visit);
  }
  visit(source);
  if(file.endsWith('.tsx')||file.endsWith('.jsx')) imports.push('react');
  return [...new Set(imports)];
}
function configOf(tree) {
  if(!tree.files.has('tsconfig.json')) return {paths:{},baseUrl:''};
  const parsed=ts.parseConfigFileTextToJson('tsconfig.json',tree.read('tsconfig.json'));
  if(parsed.error) throw Error('Unable to parse source tsconfig.json.');
  if(parsed.config?.extends) throw Error('Source tsconfig extends is not supported yet; supply a self-contained config.');
  const options=parsed.config?.compilerOptions??{};
  return {paths:options.paths??{},baseUrl:options.baseUrl??''};
}
function resolveImport(tree,from,specifier,config) {
  let bases=[];
  if(specifier.startsWith('.')) bases=[path.posix.join(path.posix.dirname(from),specifier)];
  else for(const [alias,targets] of Object.entries(config.paths)) {
    const [prefix,suffix='']=alias.split('*');
    if((alias.includes('*')&&specifier.startsWith(prefix)&&specifier.endsWith(suffix))||alias===specifier) {
      const middle=alias.includes('*')?specifier.slice(prefix.length,specifier.length-suffix.length):'';
      bases=targets.map(target=>path.posix.join(config.baseUrl,target.replace('*',middle)));break;
    }
  }
  if(!bases.length&&config.baseUrl) bases=[path.posix.join(config.baseUrl,specifier)];
  for(const base of bases) {
    safeRelative(base);
    const stem=/\.[cm]?js$/.test(base)?base.replace(/\.[cm]?js$/, ''):base;
    const candidates=[base,...['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs','.json','.css'].map(ext=>stem+ext),...['index.ts','index.tsx','index.js','index.jsx'].map(v=>path.posix.join(base,v))];
    const found=candidates.find(candidate=>tree.files.has(candidate));
    if(found) return found;
  }
  if(specifier.startsWith('.')||Object.keys(config.paths).some(p=>specifier.startsWith(p.split('*')[0]))) throw Error(`Unresolved local import ${specifier} in ${from}`);
  return null;
}
export function licenseOf(tree) {
  const file=[...tree.files.keys()].find(f=>/^(LICENSE|LICENCE)(\.(md|txt))?$/i.test(f));
  if(!file) throw Error('Source must include a root LICENSE file.');
  const text=tree.read(file);
  const spdx=/Permission is hereby granted, free of charge/i.test(text)?'MIT':/Apache License[\s\S]{0,100}Version 2\.0/i.test(text)?'Apache-2.0':/Redistribution and use in source and binary forms/i.test(text)?'BSD':null;
  if(!spdx) throw Error('Unrecognized source license; v0.1 supports MIT, Apache-2.0 and BSD license texts.');
  return {file,spdx,text,sha256:hash(text)};
}
export function extractSource(repo,entry,revision='HEAD') {
  safeRelative(entry);
  const tree=sourceTree(repo,revision),config=configOf(tree),license=licenseOf(tree);
  const queue=[entry],seen=new Set(),edges=[],packages=new Set();let total=0;
  while(queue.length) {
    const file=queue.shift();if(seen.has(file))continue;
    if(seen.size>=128) throw Error('Feature closure exceeds 128 files; choose a smaller entry.');
    if(!supported.test(file)) throw Error(`Unsupported source asset ${file}; v0.1 supports code, JSON and CSS.`);
    const content=tree.read(file);total+=Buffer.byteLength(content);
    if(total>4*1024*1024)throw Error('Feature closure exceeds 4 MB.');
    seen.add(file);
    for(const specifier of importsOf(file,content)) {
      const resolved=resolveImport(tree,file,specifier,config);
      edges.push({from:file,import:specifier,to:resolved});
      if(resolved) queue.push(resolved);
      else if(!specifier.startsWith('node:')) packages.add(specifier.startsWith('@')?specifier.split('/').slice(0,2).join('/'):specifier.split('/')[0]);
    }
  }
  const pkg=tree.files.has('package.json')?JSON.parse(tree.read('package.json')):{};
  const declared={...pkg.devDependencies,...pkg.peerDependencies,...pkg.dependencies};
  const dependencies=Object.fromEntries([...packages].sort().map(name=>[name,declared[name]??null]));
  const undeclared=Object.keys(dependencies).filter(name=>dependencies[name]===null);
  if(undeclared.length)throw Error(`Declare imported packages in source package.json: ${undeclared.join(', ')}`);
  const files=[...seen].sort().map(file=>({path:file,mode:tree.files.get(file).mode,sha256:hash(tree.read(file)),content:tree.read(file)}));
  return {source:tree.repo,commit:tree.commit,entry,license,dependencies,edges,files};
}
export function inspectSource(repo) {
  const tree=sourceTree(repo),license=licenseOf(tree);
  const entries=[];
  for(const file of tree.files.keys()) if(/\.[jt]sx?$/.test(file)&&!/(^|\/)(node_modules|dist|test|tests)\//.test(file)&&!/[.]test[.]/.test(file)) {
    const text=tree.read(file);if(/\bexport\b/.test(text)) entries.push({path:file,exports:[...text.matchAll(/export\s+(?:default\s+)?(?:function|class|interface|type|const)\s+(\w+)/g)].map(m=>m[1])});
    if(entries.length>=100)break;
  }
  return {source:tree.repo,commit:tree.commit,license:{spdx:license.spdx,file:license.file},entries,
    package:tree.files.has('package.json')?JSON.parse(tree.read('package.json')):{},readme:tree.files.has('README.md')?tree.read('README.md').slice(0,4000):''};
}
