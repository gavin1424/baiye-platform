import {cp,mkdir,readFile,writeFile,readdir,rename,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve('data/lingstone/release-static'),destination=path.join(root,'tanxiang-stable/v1');
const publish=process.argv.includes('--production');
// Never merge a release over retired files: archive the exact prior build intact.
// Both resolved paths must remain inside this task's dedicated build directory.
if(path.dirname(root)!==path.resolve('data/lingstone'))throw Error('UNSAFE_RELEASE_PATH');
try{const info=await lstat(root);if(info.isSymbolicLink()||!info.isDirectory())throw Error('UNSAFE_RELEASE_DIRECTORY');const archived=root+'.backup-'+Date.now();if(path.dirname(archived)!==path.dirname(root))throw Error('UNSAFE_ARCHIVE_PATH');await rename(root,archived)}catch(e){if(e.code!=='ENOENT')throw e}
await mkdir(destination,{recursive:true});
await cp('public/tanxiang-stable/v1',destination,{recursive:true});
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}).trim();
const sourceCommit=process.env.XIANGYUN_SOURCE_COMMIT||git('rev-parse','HEAD'),sourceBranch=process.env.XIANGYUN_SOURCE_BRANCH||git('branch','--show-current');
const published=!!process.env.XIANGYUN_SOURCE_COMMIT;
if(published){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit)||!/^(?:fix\/issue(?:65|67|68)-[a-z0-9-]+|feature\/issue67-[a-z0-9-]+)$/.test(sourceBranch))throw Error('INVALID_SOURCE_IDENTITY');
 const remote=git('ls-remote','--exit-code','origin','refs/heads/'+sourceBranch).split(/\s/)[0];if(remote!==sourceCommit)throw Error('PUBLISHED_SOURCE_REF_MISMATCH');
 const scope=JSON.parse(await readFile('scripts/xiangyun-source-paths.json','utf8'));
 git('diff','--quiet',sourceCommit,'--',...scope);
}
const viewerCode=await readFile('public/tanxiang-stable/v1/model-viewer-v19.js','utf8'),clientBuild=viewerCode.match(/MODEL_VIEWER_BUILD='([^']+)'/)?.[1]||null;
await writeFile(path.join(destination,'build-info.json'),JSON.stringify({release:'2.1-issue68',repository:'gavin1424/baiye-platform',branch:sourceBranch,sourceCommit,sourceState:published?'PUBLISHED_SOURCE_VERIFIED':'LOCAL_SOURCE_NOT_PUBLISHED',clientBuild,channel:publish?'production':'preview',builtAt:new Date().toISOString(),modelManifestSha256:createHash('sha256').update(await readFile('public/tanxiang-stable/v1/assets/lingstone/models-v19.json')).digest('hex'),payment:'disabled'},null,2)+'\n');
async function sourceFiles(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await sourceFiles(p));else result.push(p)}return result}
for(const file of await sourceFiles(destination))if(/\.(html|js)$/.test(file)){
 const name=path.basename(file);let text=await readFile(file,'utf8');
 text=text.replaceAll('../index.html','https://baiyeconnect.com/tanxiang-stable/').replaceAll('../assets/','https://baiyeconnect.com/tanxiang-stable/assets/');
 if(publish){
  if(name.endsWith('.html'))text=text.replace(/V1\.(\d+) PREVIEW/g,'V1.$1');
  if(name==='gallery-v13.js')text=text.replace(/V1\.(\d+) 精品圖錄・預覽/g,'V1.$1 精品圖錄').replace(/V1\.(\d+) 精品图录・预览/g,'V1.$1 精品图录').replace(/V1\.(\d+) · Gallery preview/g,'V1.$1 · Collection gallery').replace(/V1\.(\d+)・ギャラリープレビュー/g,'V1.$1・コレクションギャラリー');
  if(name==='gallery-v13.js')text=text.replaceAll('V1.3 精品圖錄・預覽','V1.3 精品圖錄').replaceAll('V1.3 精品图录・预览','V1.3 精品图录').replaceAll('V1.3 · Gallery preview','V1.3 · Collection gallery').replaceAll('V1.3・ギャラリープレビュー','V1.3・コレクションギャラリー');
  if(name==='gallery-v13.js')text=text.replaceAll('V1.4 精品圖錄・預覽','V1.4 精品圖錄').replaceAll('V1.4 精品图录・预览','V1.4 精品图录').replaceAll('V1.4 · Gallery preview','V1.4 · Collection gallery').replaceAll('V1.4・ギャラリープレビュー','V1.4・コレクションギャラリー');
 }
 if(!publish&&name.endsWith('.html'))text=text.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>');
 if(name.endsWith('.html'))text=text.replace('</head>','<meta name="lingstone-api-base" content="/tanxiang-stable/v1"><meta name="lingstone-release" content="production"></head>').replace('V1.0 STAGING','V1.0');
 await writeFile(file,text);
}
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isDirectory())await walk(full);else files.push({path:path.relative(root,full).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(full)).digest('hex')})}}
await walk(root);
await writeFile('data/lingstone/release-manifest.json',JSON.stringify({status:'PREPARED_NOT_DEPLOYED',channel:publish?'production':'preview',public_prefix:'/tanxiang-stable/v1/',payment:'disabled',private_engine:'SERVER_BUNDLE_ONLY',files},null,2)+'\n');
console.log('Release package prepared: '+files.length+' static files. No private engine, credentials or SQLite databases included.');
