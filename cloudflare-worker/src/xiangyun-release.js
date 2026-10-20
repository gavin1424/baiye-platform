import {handleStones} from './xiangyun/stones-v20.js';
import {internalRequest,publicResponse,legacyRedirect} from './xiangyun/identity-v20.js';
import {handleCollection} from './xiangyun/collection-v17.js';
import {handleLingstone} from './xiangyun/commerce.js';
import {calculateBazi} from './xiangyun/calendar.js';
import {handleAuth,json} from './xiangyun/auth.js';
import {handleFourSpirits} from './xiangyun/four-spirits.js';
const PREFIX='/tanxiang-stable/v1';
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname===PREFIX)return Response.redirect(url.origin+PREFIX+'/'+url.search,308);
 if(!url.pathname.startsWith(PREFIX+'/'))return json({error:'NOT_FOUND'},404);
 const alias=legacyRedirect(url.pathname);if(alias)return Response.redirect(url.origin+alias+url.search,308);
 const path=url.pathname.slice(PREFIX.length);
 if(path.startsWith('/api/')){
  if(!path.startsWith('/api/lingstone/'))return json({error:'NOT_FOUND'},404);
  if(request.method==='OPTIONS')return new Response(null,{status:204});
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json({error:'ORIGIN_NOT_ALLOWED'},403);
  const response=await env.XIANGYUN_STORE.get(env.XIANGYUN_STORE.idFromName(env.XIANGYUN_STORE_NAME||'xiangyun-preview-v14')).fetch(request),headers=new Headers(response.headers);
  if(env.CF_VERSION_METADATA?.id)headers.set('x-xiangyun-deployment',env.CF_VERSION_METADATA.id);
  if(/^[a-f0-9]{40}$/.test(env.XIANGYUN_SOURCE_COMMIT||''))headers.set('x-xiangyun-source-commit',env.XIANGYUN_SOURCE_COMMIT);
  return new Response(response.body,{status:response.status,headers});
 }
 if(!['GET','HEAD'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
 let assetRequest=request,certificateStatus=null;if(/^\/certificate\/(?:MET|WOD|WAT|FIR|EAR)-[0-9]{3,}\/?$/.test(path)){const u=new URL(request.url);u.pathname=PREFIX+'/api/lingstone/certificates/'+path.split('/')[2];const record=await env.XIANGYUN_STORE.get(env.XIANGYUN_STORE.idFromName(env.XIANGYUN_STORE_NAME||'xiangyun-preview-v14')).fetch(new Request(u));certificateStatus=record.status;u.pathname=PREFIX+'/certificate';assetRequest=new Request(u,request)}
 const asset=await env.ASSETS.fetch(assetRequest),headers=new Headers(asset.headers);
 if(env.CF_VERSION_METADATA?.id)headers.set('x-xiangyun-deployment',env.CF_VERSION_METADATA.id);
 if(/^[a-f0-9]{40}$/.test(env.XIANGYUN_SOURCE_COMMIT||''))headers.set('x-xiangyun-source-commit',env.XIANGYUN_SOURCE_COMMIT);
 if(/\.(html|js|css|json|glb)$/.test(url.pathname)||url.pathname.endsWith('/'))headers.set('cache-control','no-cache');
 if(certificateStatus!==null)headers.set('cache-control','no-store');
 if(asset.status===200&&url.pathname.endsWith('.glb'))headers.set('content-type','model/gltf-binary');
 headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','strict-origin-when-cross-origin');headers.set('x-frame-options','DENY');
 headers.set('permissions-policy','camera=(self), microphone=(), geolocation=()');
 headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: https:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
 return new Response(asset.body,{status:asset.ok&&certificateStatus!==null?certificateStatus:asset.status,headers});
}};

async function handleInternalApi(request,env){
 const url=new URL(request.url),path=url.pathname.slice(PREFIX.length);
 if(!path.startsWith('/api/lingstone/'))return json({error:'NOT_FOUND'},404);
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json({error:'ORIGIN_NOT_ALLOWED'},403);
  const route=path.slice('/api/lingstone'.length);
  if(route==='/orders'&&request.method!=='GET'||route.startsWith('/payments/')||/\/orders\/[^/]+\/simulate$/.test(route))return json({error:'CHECKOUT_NOT_ENABLED'},503);
  if(!env.FINANCE_DB||!env.MERCHANT_ASSETS)return json({error:'DATABASE_UNAVAILABLE'},503);
  const scope=new URL(url);scope.pathname=path;const req=new Request(scope,request);
  const bindings={...env,LINGSTONE_BAZI:calculateBazi,LINGSTONE_PAYMENT_MODE:'disabled',LINGSTONE_LOCAL_SIMULATOR:'0',LINGSTONE_PUBLIC_PREFIX:PREFIX,ALLOWED_ORIGINS:url.origin};
  try{return await handleAuth(req,bindings,route)||await handleStones(req,bindings,route)||await handleFourSpirits(req,bindings,route)||await handleCollection(req,bindings,route)||await handleLingstone(req,bindings)}catch(e){return json({error:e.status?e.message:'SERVICE_UNAVAILABLE'},e.status||503)}
}

export {XiangyunStore} from './xiangyun/store.js';

export async function handleXiangyunApi(request,env){try{return publicResponse(await handleInternalApi(await internalRequest(request),env))}catch(e){return json({error:e.status?e.message:'SERVICE_UNAVAILABLE'},e.status||503)}}
