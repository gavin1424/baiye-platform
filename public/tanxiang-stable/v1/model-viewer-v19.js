import {passportCopy} from './passport-copy-v20.js';
import {fetchMineralSource,reloadMineralMaps} from './model-pbr-reload.js';
import {verifyMineralMaterial} from './model-material-health.js';
import {modelCopy} from './model-copy-v19.js';
import {modelById,modelCatalog} from './model-data-v19.js';
import {drafts} from './collection-data-v17.js';
import {plannedPrice,detailURL} from './collection-v17.js';
let library;
export function loadModelLibrary(){return library||(library=import('./assets/vendor/model-viewer/model-viewer-4.4.0.min.js').then(mod=>{mod.ModelViewerElement.modelCacheSize=1;return mod}).catch(e=>{library=null;throw e}))}
export function modelButton(p,c){return p.modelStatus==='concept'&&typeof p.modelUrl==='string'&&modelById(p.id)?.modelUrl===p.modelUrl?`<button class="stone360-open outline btn--secondary" data-model-open="${c.esc(p.id)}"><span class="btn-orbit" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" focusable="false"><path d="M19 8a8 8 0 1 0 1 7M19 3v5h-5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>${c.esc(modelCopy(c.lang)('open'))}</span></button>`:''}
export const MODEL_VIEWER_BUILD='issue65-html-png-material-gate-2';
export const conceptCamera={orbit:'0deg 65deg 120%',fieldOfView:'32deg',rotationPerSecond:'30deg'};

export function bindModelViewer(context){
 let dialog=null,viewer=null,selected=null,records=[],trigger=null,timer,timeout,play=false,generation=0,oldOverflow='',returnScroll={x:0,y:0},materialAbort=null,releaseMaterial=()=>{};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const ctx=()=>context(),g=key=>modelCopy(ctx().lang)(key);
 function status(key){dialog.dataset.state=key;dialog.querySelector('[data-model-status]').textContent=g(key)}
 function stop(){clearInterval(timer);clearTimeout(timeout);materialAbort?.abort();releaseMaterial();releaseMaterial=()=>{};viewer?.removeAttribute('auto-rotate')}
 function reset(){if(!viewer)return;viewer.resetTurntableRotation?.();viewer.cameraOrbit=conceptCamera.orbit;viewer.cameraTarget='auto auto auto';viewer.fieldOfView=conceptCamera.fieldOfView;viewer.jumpCameraToGoal?.()}
 function rotate(degrees,vertical=0){if(!viewer?.loaded)return;const o=viewer.getCameraOrbit();viewer.cameraOrbit=`${o.theta*180/Math.PI+degrees}deg ${Math.max(25,Math.min(120,o.phi*180/Math.PI+vertical))}deg ${o.radius}m`}
 function playback(){if(!viewer)return;viewer.toggleAttribute('auto-rotate',play);const button=dialog.querySelector('[data-model-action="play"]');button.textContent=g(play?'pause':'play');button.setAttribute('aria-pressed',String(play))}
 function fallback(reason='MODEL_LOAD_FAILED',evidence=null){if(!dialog?.open)return;generation++;stop();dialog.dataset.materialReady='false';dialog.dataset.materialError=reason;dialog.dataset.materialReport=JSON.stringify(evidence);status('failed');dialog.querySelector('[data-model-poster]').hidden=false;viewer?.remove();viewer=null;dialog.querySelector('[data-model-retry]').hidden=false;dialog.querySelectorAll('[data-camera-control]').forEach(b=>b.disabled=true)}
 async function mount(id){
  const token=++generation;selected=records.find(p=>p.id===id);if(!selected)return;
  const c=ctx(),meta=modelById(id),slot=dialog.querySelector('[data-model-slot]');stop();viewer?.remove();viewer=null;materialAbort=new AbortController();const materialSignal=materialAbort.signal;
  dialog.dataset.clientBuild=MODEL_VIEWER_BUILD;dialog.dataset.materialReady='false';delete dialog.dataset.materialError;delete dialog.dataset.materialReport;dialog.dataset.product=id;dialog.querySelector('[data-model-position]').textContent=String(records.findIndex(p=>p.id===id)+1).padStart(2,'0')+' / '+records.length;dialog.querySelector('[data-model-name]').textContent=c.translated(selected,'name');dialog.querySelector('[data-model-sku]').textContent=passportCopy(c.lang)('pending');
  dialog.querySelector('[data-model-price]').textContent=plannedPrice(selected,c);dialog.querySelector('[data-model-choose]').value=id;
  const poster=dialog.querySelector('[data-model-poster]');poster.src=meta.posterImage;poster.alt=c.translated(selected,'name')+' · '+g('label');poster.hidden=false;dialog.querySelector('[data-model-reference]').src=meta.posterImage;
  const enquiry=dialog.querySelector('[data-inquire]');enquiry.dataset.inquire=id;enquiry.textContent=g('enquiry');dialog.querySelector('[data-model-details]').href=detailURL(id,c.lang);
  dialog.querySelector('[data-model-retry]').hidden=true;dialog.querySelectorAll('[data-camera-control]').forEach(b=>b.disabled=true);status('load');
  try{
   timeout=setTimeout(()=>{if(token===generation)fallback('MATERIAL_TIMEOUT')},30000);await loadModelLibrary();const source=await fetchMineralSource(meta,materialSignal);if(token!==generation||!dialog.open)return;
   viewer=document.createElement('model-viewer');viewer.setAttribute('alt',c.translated(selected,'name')+' · '+g('label'));viewer.setAttribute('aria-label',g('view'));viewer.setAttribute('camera-controls','');viewer.setAttribute('disable-pan','');viewer.setAttribute('disable-tap','');viewer.setAttribute('touch-action','none');viewer.setAttribute('interaction-prompt','none');viewer.setAttribute('camera-orbit',conceptCamera.orbit);viewer.setAttribute('field-of-view',conceptCamera.fieldOfView);viewer.setAttribute('min-camera-orbit','auto 35deg 85%');viewer.setAttribute('max-camera-orbit','auto 85deg 180%');viewer.setAttribute('rotation-per-second',conceptCamera.rotationPerSecond);viewer.setAttribute('auto-rotate-delay','600');viewer.setAttribute('shadow-intensity','1.3');viewer.setAttribute('shadow-softness','1');viewer.setAttribute('exposure','.95');viewer.setAttribute('tone-mapping','aces');viewer.setAttribute('environment-image',modelCatalog.environmentImage);viewer.setAttribute('loading','eager');viewer.setAttribute('reveal','auto');viewer.setAttribute('poster',meta.posterImage);viewer.setAttribute('tabindex','0');
   const mounted=viewer;mounted.style.opacity='0';mounted.style.pointerEvents='none';
   mounted.addEventListener('error',e=>{if(token===generation)fallback(e.detail?.type||'MODEL_LOAD_FAILED')});
   mounted.addEventListener('load',async()=>{
    if(token!==generation)return;
    try{
     const restored=await reloadMineralMaps(mounted,source,materialSignal);if(token!==generation||viewer!==mounted||!dialog?.open){restored.dispose();return}releaseMaterial=restored.dispose;
     const evidence={...(await verifyMineralMaterial(mounted)),reload:restored.evidence};if(token!==generation||viewer!==mounted||!dialog?.open)return;
     clearTimeout(timeout);dialog.dataset.materialReport=JSON.stringify(evidence);dialog.dataset.materialReady='true';mounted.style.opacity='1';mounted.style.pointerEvents='auto';poster.hidden=true;status('ready');dialog.querySelectorAll('[data-camera-control]').forEach(b=>b.disabled=false);playback();dialog.scrollTop=0;
     mounted.shadowRoot?.querySelector('canvas')?.addEventListener('webglcontextlost',()=>{if(token===generation)fallback('WEBGL_CONTEXT_LOST')},{once:true});
     timer=setInterval(()=>{if(!viewer?.loaded||!dialog?.open)return;const o=viewer.getCameraOrbit(),angle=((viewer.turntableRotation-o.theta)*180/Math.PI%360+360)%360;const output=dialog.querySelector('[data-model-angle]');output.value=Math.round(angle)+'°';output.dataset.radius=o.radius.toFixed(3)},250);
    }catch(e){if(token===generation)fallback(e.message||'PBR_VALIDATION_FAILED',e.evidence||null)}
   });
   // Only this one model is requested; no ten-viewer initialization on the catalogue.
   viewer.setAttribute('src',meta.modelUrl);slot.append(viewer);
  }catch{if(token===generation)fallback('MODEL_LOAD_FAILED')}
 }
 async function open(id,button){
  const c=ctx();if(dialog?.open)return;trigger=button;returnScroll={x:window.scrollX,y:window.scrollY};
  // Get published prices and current visibility from this brand's own API.
  try{const b=await c.api('/collection');records=b.products.filter(p=>p.modelStatus==='concept'&&modelById(p.id)?.modelUrl===p.modelUrl)}catch{c.notify(g('failed'));return}
  if(!records.some(p=>p.id===id)){c.notify(g('failed'));return}
  dialog=document.createElement('dialog');dialog.className='stone360';dialog.id='stone360-dialog';dialog.setAttribute('aria-labelledby','stone360-title');
  dialog.innerHTML=`<div class="stone360-header"><span>${c.esc(g('title'))}</span><button data-model-action="close">${c.esc(g('close'))} ×</button></div><p class="stone360-disclosure">${c.esc(g('label'))}</p><div class="stone360-layout"><div class="stone360-stage"><div class="stone360-canvas" data-model-slot><img data-model-poster width="1122" height="1402" alt=""></div><p class="stone360-hint">↔ ${c.esc(g('hint'))} <output data-model-angle>0°</output></p><p data-model-status role="status" aria-live="polite"></p><button data-model-retry hidden>${c.esc(g('retry'))}</button><div class="stone360-controls"><button data-model-action="left" data-camera-control aria-label="${c.esc(g('left'))}">↶</button><button data-model-action="right" data-camera-control aria-label="${c.esc(g('right'))}">↷</button><button data-model-action="in" data-camera-control aria-label="${c.esc(g('in'))}">＋</button><button data-model-action="out" data-camera-control aria-label="${c.esc(g('out'))}">−</button><button data-model-action="reset" data-camera-control>${c.esc(g('reset'))}</button><button data-model-action="play" data-camera-control aria-pressed="false">${c.esc(g('play'))}</button></div></div><div class="stone360-info"><div class="stone360-product"><img data-model-reference width="96" height="120" alt="${c.esc(g('label'))}"><div><p class="stone360-eyebrow" data-model-sku></p><h2 id="stone360-title" data-model-name></h2><p class="stone360-price">${c.esc(g('price'))}<strong data-model-price></strong></p></div></div><label>${c.esc(g('choose'))}<select data-model-choose>${records.map(p=>`<option value="${c.esc(p.id)}">${c.esc(c.translated(p,'name'))}</option>`).join('')}</select></label><p class="stone360-position" data-model-position aria-live="polite"></p><div class="stone360-switch"><button data-model-action="previous">← ${c.esc(g('previous'))}</button><button data-model-action="next">${c.esc(g('next'))} →</button></div><p class="stone360-label">${c.esc(g('label'))}</p><p class="stone360-note">${c.esc(g('note'))}</p><div class="stone360-purchase"><button data-inquire="${c.esc(id)}">${c.esc(g('enquiry'))}</button><a class="button outline" data-model-details>${c.esc(g('details'))} ↗</a></div><p class="stone360-keyboard">${c.esc(g('keyboard'))}</p></div></div>`;
  document.body.append(dialog);dialog.dataset.returnY=String(returnScroll.y);oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();play=!reduced.matches;
  dialog.addEventListener('close',()=>{generation++;stop();viewer?.remove();document.body.style.overflow=oldOverflow;dialog.remove();dialog=null;viewer=null;window.scrollTo({left:returnScroll.x,top:returnScroll.y,behavior:'instant'});trigger?.focus({preventScroll:true})},{once:true});
  dialog.querySelector('[data-model-choose]').onchange=e=>mount(e.target.value);dialog.querySelector('[data-model-retry]').onclick=()=>mount(selected.id);
  dialog.addEventListener('click',e=>{const action=e.target.closest('[data-model-action]')?.dataset.modelAction;if(!action)return;
   if(action==='close'){dialog.close();return}if(action==='play'){play=!play;playback()}else if(action==='reset')reset();else if(action==='in'||action==='out')viewer?.zoom(action==='in'?2:-2);else if(action==='left'||action==='right')rotate(action==='left'?-45:45);else if(action==='previous'||action==='next'){const i=records.findIndex(p=>p.id===selected.id);mount(records[(i+(action==='next'?1:-1)+records.length)%records.length].id)}
   if(['play','reset','in','out','left','right'].includes(action))dialog.scrollTop=0;
  });
  dialog.addEventListener('keydown',e=>{if(e.target.closest('select,button,a'))return;const actions={ArrowLeft:()=>rotate(-15),ArrowRight:()=>rotate(15),ArrowUp:()=>rotate(0,-10),ArrowDown:()=>rotate(0,10),Home:reset,'+':()=>viewer?.zoom(2),'=':()=>viewer?.zoom(2),'-':()=>viewer?.zoom(-2)};if(actions[e.key]){e.preventDefault();actions[e.key]()}});
  dialog.querySelector('[data-model-details]').onclick=()=>dialog.close();await mount(id);
 }
 document.addEventListener('click',e=>{const button=e.target.closest('[data-model-open]');if(button)open(button.dataset.modelOpen,button);const inquiry=e.target.closest('.stone360 [data-inquire]');if(inquiry){document.querySelector(`.collection-card [data-inquire="${inquiry.dataset.inquire}"]`)?.click();if(!document.querySelector(`.collection-card [data-inquire="${inquiry.dataset.inquire}"]`)){const proxy=document.createElement('button');proxy.hidden=true;proxy.dataset.inquire=inquiry.dataset.inquire;document.querySelector('#main').append(proxy);proxy.click();proxy.remove()}inquiry.textContent=g('enquiry')+' ✓'}});
 reduced.addEventListener('change',()=>{if(reduced.matches&&dialog?.open){play=false;playback()}});
 window.addEventListener('hashchange',()=>dialog?.close());
}
