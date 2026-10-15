import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import {project} from './setup.mjs';
import {FeatureGraft} from '../src/core.mjs';
const root=path.resolve(process.argv[2]??path.join(project,'demo-work'));
const plans=Object.values(new FeatureGraft(path.join(root,'target')).load().plans);
const roots=[['Source',path.join(root,'donor'),5171],['Target before',path.join(root,'target'),5172],...(plans.length?[['Target after',plans.at(-1).candidate,5173]]:[])];
const servers=[];
for(const [label,directory,port]of roots){if(!fs.existsSync(path.join(directory,'node_modules')))fs.symlinkSync(path.join(project,'node_modules'),path.join(directory,'node_modules'),'dir');const server=await createServer({root:directory,configFile:false,server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[directory,project]}}});await server.listen();servers.push(server);console.log(`${label}: http://127.0.0.1:${port}`);}
async function close(){await Promise.all(servers.map(server=>server.close()));process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
