import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {git} from '../src/git.mjs';
export function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'featuregraft-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  function repo(name,files) {
    const directory=path.join(root,name);fs.mkdirSync(directory);
    git(directory,['init','-q']);git(directory,['config','user.name','Test']);git(directory,['config','user.email','test@example.invalid']);
    write(directory,files);commit(directory);return directory;
  }
  const source=repo('source',{'LICENSE':'MIT License\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n','package.json':'{"type":"module","dependencies":{"react":"19.3.0"}}\n','src/feature.ts':'export { value } from "./value";\n','src/value.ts':'export const value = 42;\n'});
  const target=repo('target',{'package.json':'{"type":"module"}\n','original.mjs':'export const original = "keep";\n','test/keep.test.mjs':'import assert from "node:assert/strict"; import {original} from "../original.mjs"; assert.equal(original,"keep");\n'});
  return {root,source,target,repo};
}
export function write(repo,files){for(const [name,content]of Object.entries(files)){const file=path.join(repo,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}}
export function commit(repo){git(repo,['add','-A']);git(repo,['commit','-qm','Fixture change']);}
