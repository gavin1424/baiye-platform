import { handleOwnerAuth, requireOwner } from "./owner-auth.js";
import { checkOwnerProductionSite, handleOwnerAdmin } from "./owner-admin.js";

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store","x-robots-tag":"noindex, nofollow",...headers}});
const allowedOrigin=(request,env)=>{const origin=request.headers.get("origin");if(!origin)return null;return String(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).includes(origin)?origin:null;};
const corsHeaders=(origin)=>origin?{"access-control-allow-origin":origin,"access-control-allow-methods":"GET, POST, PUT, PATCH, DELETE, OPTIONS","access-control-allow-headers":"content-type, x-csrf-token","access-control-allow-credentials":"true","access-control-max-age":"86400",vary:"Origin"}:{};

export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=allowedOrigin(request,env),cors=corsHeaders(origin);
    if(url.pathname==="/health"&&request.method==="GET")return json({ok:true,service:"Baiye Owner Admin API",database:Boolean(env.FINANCE_DB)});
    if(!url.pathname.startsWith("/api/owner/"))return json({error:"Not found"},404);
    if(request.method==="OPTIONS")return origin?new Response(null,{status:204,headers:cors}):json({error:"Origin not allowed"},403);
    if(!origin)return json({error:"Origin not allowed"},403);
    if(url.pathname.startsWith("/api/owner/auth/"))return(await handleOwnerAuth(request,env,url,cors))||json({error:"Not found"},404,cors);
    const owner=await requireOwner(request,env);
    if(!owner)return json({error:"需要 OWNER_ADMIN 授權。"},403,cors);
    return(await handleOwnerAdmin(request,env,url,cors,owner))||json({error:"Not found"},404,cors);
  },
  async scheduled(_event,env,ctx){
    const assets=await env.FINANCE_DB.prepare("SELECT merchant_id FROM merchant_system_assets WHERE production_url IS NOT NULL AND trim(production_url)!='' ORDER BY updated_at DESC LIMIT 25").all();
    ctx.waitUntil(Promise.allSettled((assets.results||[]).map(item=>checkOwnerProductionSite(env,item.merchant_id))));
  }
};
