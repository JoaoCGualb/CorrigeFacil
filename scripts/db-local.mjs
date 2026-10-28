import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=spawnSync(process.execPath,[
  '--import',new URL('./sites-env.mjs',import.meta.url).href,
  path.join(root,'node_modules/wrangler/bin/wrangler.js'),
  'd1','migrations','apply','DB','--local','--config',path.join(root,'wrangler.local.json'),
  '--persist-to',path.join(root,'.wrangler/state')
],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
