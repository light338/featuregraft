import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {git} from '../src/git.mjs';
export const project=fileURLToPath(new URL('../',import.meta.url));
export function setup(root) {
  root=path.resolve(root);
  if(fs.existsSync(root))throw Error('Demo directory must not exist.');
  fs.mkdirSync(root,{recursive:true});
  for(const name of ['donor','target']) {
    const repo=path.join(root,name);fs.cpSync(path.join(project,'examples/apps',name),repo,{recursive:true});
    fs.copyFileSync(path.join(project,'LICENSE'),path.join(repo,'LICENSE'));
    fs.writeFileSync(path.join(repo,'.gitignore'),'node_modules/\ndist/\n');
    fs.symlinkSync(path.join(project,'node_modules'),path.join(repo,'node_modules'),'dir');
    git(repo,['init','-q']);git(repo,['config','user.name','FeatureGraft demo']);git(repo,['config','user.email','demo@example.invalid']);
    git(repo,['add','.']);git(repo,['commit','-qm',`Initial ${name} application`]);
  }
  fs.mkdirSync(path.join(root,'evidence'));
  return {root,source:path.join(root,'donor'),target:path.join(root,'target')};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(setup(process.argv[2]??path.join(project,'demo-work')),null,2));
