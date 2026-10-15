import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {extractSource,importsOf} from '../src/source.mjs';
import {fixture,write,commit} from './fixtures.mjs';

test('extracts transitive imports, reexports, TS aliases and CSS without unrelated app files',t=>{
  const {source}=fixture(t);
  write(source,{'tsconfig.json':'{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
    'src/feature.tsx':'import type {Row} from "@/types"; import {value} from "./value.js"; import "./feature.css"; export function Widget(){ return <div>{value}</div> };\n',
    'src/types.ts':'export interface Row {id:string}\n','src/feature.css':'div { color: red; }\n','src/unrelated.ts':'export const secretAppState = 1;\n'});commit(source);
  const cap=extractSource(source,'src/feature.tsx');
  assert.deepEqual(cap.files.map(f=>f.path),['src/feature.css','src/feature.tsx','src/types.ts','src/value.ts']);
  assert.deepEqual(cap.dependencies,{react:'19.3.0'});assert.equal(cap.license.spdx,'MIT');
  assert.equal(cap.files.find(f=>f.path==='src/value.ts').content,'export const value = 42;\n');
});

test('refuses computed imports, unresolved local dependencies and undeclared external packages',t=>{
  const {source}=fixture(t);
  assert.throws(()=>importsOf('x.ts','const name="x"; import(name)'),/Computed imports/);
  write(source,{'src/feature.ts':'export {x} from "./missing";'});commit(source);
  assert.throws(()=>extractSource(source,'src/feature.ts'),/Unresolved local import/);
  write(source,{'src/feature.ts':'import z from "undeclared"; export const x=z;'});commit(source);
  assert.throws(()=>extractSource(source,'src/feature.ts'),/Declare imported packages/);
});

test('follows CSS imports and refuses missing local assets instead of silently omitting dependencies',t=>{
  const {source}=fixture(t);
  write(source,{'src/feature.ts':'import "./theme.css"; export const widget=true;', 'src/theme.css':'@import "colors.css"; .x{color:red}', 'src/colors.css':'.x{background:white}'});commit(source);
  assert.deepEqual(extractSource(source,'src/feature.ts').files.map(f=>f.path),['src/colors.css','src/feature.ts','src/theme.css']);
  write(source,{'src/theme.css':'.x{background:url("./missing.svg")}'});commit(source);
  assert.throws(()=>extractSource(source,'src/feature.ts'),/Unresolved local import/);
});

test('does not extract symlinks, escaping imports, unknown licenses or dirty source',t=>{
  const {root,source}=fixture(t);
  assert.throws(()=>extractSource(source,'../private.ts'),/Unsafe/);
  fs.writeFileSync(path.join(root,'private.ts'),'private');fs.symlinkSync(path.join(root,'private.ts'),path.join(source,'src/link.ts'));commit(source);
  assert.throws(()=>extractSource(source,'src/link.ts'),/regular tracked/);
  write(source,{'LICENSE':'All rights reserved'});commit(source);
  assert.throws(()=>extractSource(source,'src/feature.ts'),/Unrecognized source license/);
  write(source,{'untracked.txt':'unrecorded'});
  assert.throws(()=>extractSource(source,'src/feature.ts'),/Commit or remove/);
});
