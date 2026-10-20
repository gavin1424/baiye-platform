// Server-only aliases preserve existing foreign keys and enquiry references.
const aliases=[{"legacy": "xy-concept-01", "public": "art-4da8666c3a9e6dc4"}, {"legacy": "xy-concept-02", "public": "art-cf2130a6f0e5b00c"}, {"legacy": "xy-concept-03", "public": "art-574160ec4c4c2236"}, {"legacy": "xy-concept-04", "public": "art-c1ec7e0779e4fb78"}, {"legacy": "xy-concept-05", "public": "art-e19515eb829bb71d"}, {"legacy": "xy-concept-06", "public": "art-273c46ddf89d5dc6"}, {"legacy": "xy-concept-07", "public": "art-ab57c5ee730e10a5"}, {"legacy": "xy-concept-08", "public": "art-d7f4c61f6e43cf84"}, {"legacy": "xy-concept-09", "public": "art-0c0e526bb37c6592"}, {"legacy": "xy-concept-10", "public": "art-60d1e5d6b2c419b1"}];
export const publicDesignId=id=>aliases.find(x=>x.legacy===id)?.public||id;
export const internalDesignId=id=>aliases.find(x=>x.public===id)?.legacy||id;
const retired=v=>typeof v==='string'&&/^XY-(?:CONCEPT-|C)\d+$/.test(v);
const idKeys=new Set(['id','product_id','product_template_id','template_id','serial','catalog_sku','sku','physical_sku']);
export function translateIdentity(value,out=true,key=''){
 if(Array.isArray(value))return value.map(v=>translateIdentity(v,out,key));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,translateIdentity(v,out,k)]));
 if(typeof value!=='string')return value;
 if(key==='product_ids'){try{if(value.startsWith('['))return JSON.stringify(JSON.parse(value).map(out?publicDesignId:internalDesignId))}catch{}return (out?publicDesignId:internalDesignId)(value)}
 if(idKeys.has(key)){if(out&&retired(value))return null;return(out?publicDesignId:internalDesignId)(value)}
 if(['url','activation_path','product_url'].includes(key)){for(const a of aliases)value=value.replaceAll(out?a.legacy:a.public,out?a.public:a.legacy)}
 return value;
}
export async function internalRequest(request){
 const u=new URL(request.url);u.pathname=u.pathname.split('/').map(internalDesignId).join('/');
 for(const k of ['template','product_id'])if(u.searchParams.has(k))u.searchParams.set(k,internalDesignId(u.searchParams.get(k)));
 if(/XY-(?:CONCEPT|C)/i.test(u.searchParams.get('q')||''))u.searchParams.set('q','__retired_public_identifier__');
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('content-type')?.includes('application/json')){let b;try{const reader=request.clone().body?.getReader();let raw='',total=0,decoder=new TextDecoder();if(reader)while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>100000){await reader.cancel();throw Object.assign(Error('TOO_LARGE'),{status:413})}raw+=decoder.decode(part.value,{stream:true})}raw+=decoder.decode();b=JSON.parse(raw)}catch(e){if(e.status)throw e;return new Request(u,request)}const h=new Headers(request.headers);h.delete('content-length');return new Request(u,{method:request.method,headers:h,body:JSON.stringify(translateIdentity(b,false))})}
 return new Request(u,request);
}
export async function publicResponse(response){if(!response?.headers.get('content-type')?.includes('application/json'))return response;return new Response(JSON.stringify(translateIdentity(await response.json())),{status:response.status,headers:response.headers})}
export function legacyRedirect(path){const match=path.match(/^\/tanxiang-stable\/v1\/products\/([^/]+)(?:\/(?:index(?:-[a-zA-Z-]+)?\.html)?)?$/);if(!match)return null;const id=publicDesignId(match[1]);return id!==match[1]?'/tanxiang-stable/v1/products/'+id+'/':null;}
