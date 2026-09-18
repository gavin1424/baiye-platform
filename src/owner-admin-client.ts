const API=(import.meta.env.VITE_OWNER_API_URL||"https://baiye-owner-admin-api.baiye-platform.workers.dev").replace(/\/$/,"");
let csrf="";
async function request(path:string,init:RequestInit={}){
  const method=String(init.method||"GET").toUpperCase();
  const response=await fetch(`${API}${path}`,{...init,credentials:"include",headers:{...(init.body?{"content-type":"application/json"}:{}),...(csrf&&!['GET','HEAD','OPTIONS'].includes(method)?{"x-csrf-token":csrf}:{}),...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error||"Owner Admin 服務暫時無法使用。"),{status:response.status,code:data.code});
  if(typeof data.csrf_token==="string")csrf=data.csrf_token;
  return data;
}
export const ownerSession=()=>request("/api/owner/auth/session");
export const ownerLogin=(email:string,password:string,otp:string)=>request("/api/owner/auth/login",{method:"POST",body:JSON.stringify({email,password,otp})});
export const ownerLogout=async()=>{try{await request("/api/owner/auth/logout",{method:"POST"});}finally{csrf="";}};
export const ownerApi=(path:string,init:RequestInit={})=>request(path,init);
