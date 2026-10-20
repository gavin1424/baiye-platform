import {extractMineralMaps,reloadMineralMaps} from './model-pbr-reload.js';
import {modelCatalog} from './model-data-v19.js';
import {MODEL_VIEWER_BUILD,loadModelLibrary,conceptCamera} from './model-viewer-v19.js';
import {verifyMineralMaterial} from './model-material-health.js';
const $=s=>document.querySelector(s),issues=[],results=[];
const originalError=console.error.bind(console);console.error=(...args)=>{issues.push(args.map(x=>String(x)).join(' ').slice(0,1600));originalError(...args)};
window.addEventListener('securitypolicyviolation',e=>issues.push('CSP '+e.effectiveDirective+' '+e.blockedURI));
window.addEventListener('error',e=>issues.push(e.message));
const report={url:location.href,clientBuild:MODEL_VIEWER_BUILD,userAgent:navigator.userAgent,hardwareClass:'UNVERIFIED_DEVICE_TYPE',gpu:null,blobFetch:null,build:null,results,issues};
function show(){ $('#report').textContent=JSON.stringify(report,null,2); }
function gpu(){const c=document.createElement('canvas'),gl=c.getContext('webgl2');if(!gl)return {webgl2:false};const ext=gl.getExtension('WEBGL_debug_renderer_info'),r={webgl2:true,version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};gl.getExtension('WEBGL_lose_context')?.loseContext();return r;}
async function probe(){report.gpu=gpu();const url=URL.createObjectURL(new Blob(['same-origin embedded texture fetch probe']));try{const r=await fetch(url);report.blobFetch={ok:r.ok,status:r.status}}catch(e){report.blobFetch={ok:false,error:String(e)}}finally{URL.revokeObjectURL(url)}try{const r=await fetch('./build-info.json',{cache:'no-store'});report.deployment=r.headers.get('x-xiangyun-deployment');report.build=r.ok?await r.json():{status:r.status}}catch(e){report.build={error:String(e)}}$('#device').textContent=navigator.userAgent;show();}
function shaderEvidence(material){try{const objects=Object.getOwnPropertySymbols(material).map(s=>material[s]).find(v=>v instanceof Set&&Array.from(v).some(m=>m?.isMaterial));const m=objects&&Array.from(objects).find(m=>m?.isMaterial);if(!m)return {available:false,note:'Underlying renderer object not exposed; public SDK texture evidence is recorded separately.'};const map=t=>t?{name:t.name,colorSpace:t.colorSpace,width:t.source?.data?.width||t.image?.width,height:t.source?.data?.height||t.image?.height,version:t.version,format:t.format,type:t.type,sourceDataType:t.source?.data?.constructor?.name}:null;return {available:true,shader:m.type,color:m.color?.toArray(),materialVersion:m.version,map:map(m.map),normalMap:map(m.normalMap),roughnessMap:map(m.roughnessMap),metalnessMap:map(m.metalnessMap),aoMap:map(m.aoMap)};}catch(e){return {available:false,error:String(e)}}}
async function run(meta,mode){
 $('#status').textContent='正在檢查 '+meta.sku+'；先保留商品圖…';$('#poster').src=meta.posterImage;$('#poster').hidden=false;$('#slot').replaceChildren();$('#slot').dataset.ready='false';const started=performance.now(),entry={sku:meta.sku,mode,modelURL:new URL(meta.modelUrl,location.href).href};results.push(entry);show();let viewer;
 try{
  const r=await fetch(meta.modelUrl,{cache:'no-store'}),bytes=new Uint8Array(await r.arrayBuffer());entry.http={status:r.status,type:r.headers.get('content-type'),bytes:bytes.length,etag:r.headers.get('etag'),cache:r.headers.get('cache-control'),deployment:r.headers.get('x-xiangyun-deployment')};
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');entry.http.sha256=hash;if(!r.ok||!entry.http.type?.includes('model/gltf-binary')||hash!==meta.sha256)throw Error('MODEL_HTTP_OR_HASH_MISMATCH');
  const dv=new DataView(bytes.buffer),len=dv.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+len))),bin=28+len;
  entry.embeddedImages=doc.images.map((im,i)=>{const v=doc.bufferViews[im.bufferView],offset=bin+v.byteOffset;return {index:i,mimeType:im.mimeType,bytes:v.byteLength,...(im.mimeType==='image/png'?{width:dv.getUint32(offset+16),height:dv.getUint32(offset+20)}:{})}});
  await loadModelLibrary();viewer=document.createElement('model-viewer');viewer.style.opacity='0';for(const [k,v]of Object.entries({src:meta.modelUrl,'camera-controls':'','camera-orbit':conceptCamera.orbit,'field-of-view':conceptCamera.fieldOfView,'environment-image':modelCatalog.environmentImage,exposure:'.95','tone-mapping':'aces','shadow-intensity':'1.3',reveal:'auto',loading:'eager'}))viewer.setAttribute(k,v);
  const loaded=new Promise((resolve,reject)=>{viewer.addEventListener('load',resolve,{once:true});viewer.addEventListener('error',e=>reject(Error(e.detail?.type||'LOAD_ERROR')),{once:true})});$('#slot').append(viewer);
  let timeout;try{await Promise.race([loaded,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('MODEL_TIMEOUT')),30000))])}finally{clearTimeout(timeout)}
  const material=viewer.model?.getMaterialByName('Coarse mineral concept surface');entry.runtimeBefore=shaderEvidence(material);
  if(mode==='recover-color')material?.pbrMetallicRoughness.baseColorTexture?.setTexture(null);
  const restored=await reloadMineralMaps(viewer,await extractMineralMaps(bytes,meta));entry.reload=restored.evidence;
  if(mode==='missing-color')material?.pbrMetallicRoughness.baseColorTexture?.setTexture(null);
  entry.runtime=shaderEvidence(material);try{entry.material=await verifyMineralMaterial(viewer)}finally{restored.dispose()};viewer.style.opacity='1';$('#slot').dataset.ready='true';$('#poster').hidden=true;entry.result='MATERIAL_AND_RENDER_VERIFIED';$('#status').textContent=meta.sku+' 貼圖與實際渲染色彩已驗證。';
 }catch(e){viewer?.remove();$('#poster').hidden=false;entry.result='PHOTO_FALLBACK';entry.error=e.message;entry.material=e.evidence||null;$('#status').textContent=meta.sku+' 3D 材質未通過檢查，繼續展示商品圖。';}
 entry.elapsedMs=Math.round(performance.now()-started);entry.posterVisible=!$('#poster').hidden;show();return entry;
}
for(const m of modelCatalog.products){const o=document.createElement('option');o.value=m.id;o.textContent=m.sku;$('#sku').append(o)}$('#sku').value='xy-concept-03';
async function action(all){$('#run').disabled=$('#all').disabled=true;try{for(const m of (all?modelCatalog.products:[modelCatalog.products.find(m=>m.id===$('#sku').value)]))await run(m,$('#mode').value)}finally{$('#run').disabled=$('#all').disabled=false}}
$('#run').onclick=()=>action(false);$('#all').onclick=()=>action(true);$('#download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='xiangyun-3d-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
await probe();
