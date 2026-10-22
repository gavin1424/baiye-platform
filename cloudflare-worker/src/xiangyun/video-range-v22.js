import {videoAssets} from './video-assets-v22.js';
import {reviewAssets} from './review-assets-v23.js';

// ASSETS currently returns 200 for Range. Serve bounded single ranges as a
// stream: never buffer an entire film in the Worker or change other assets.
export function videoResponse(request,response,path){
 const spec=[...videoAssets,...reviewAssets].find(v=>v.path===path);
 if(!spec||response.status!==200)return response;
 const headers=new Headers(response.headers),size=spec.bytes;
 headers.set('accept-ranges','bytes');headers.set('content-type','video/mp4');headers.set('content-length',String(size));
 const full=()=>new Response(request.method==='HEAD'?null:response.body,{status:200,headers});
 if(request.method==='HEAD')return full();
 const value=request.headers.get('range');if(!value)return full();
 const ifRange=request.headers.get('if-range');if(ifRange){const modified=Date.parse(headers.get('last-modified')||'');if(ifRange!==headers.get('etag')&&!(Number.isFinite(Date.parse(ifRange))&&Number.isFinite(modified)&&Date.parse(ifRange)>=modified))return full();}
 // Unknown units and multi-range requests are ignored per HTTP semantics.
 if(!value.startsWith('bytes=')||value.includes(','))return full();
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);
 const invalid=()=>{headers.set('content-range','bytes */'+size);headers.set('content-length','0');response.body?.cancel();return new Response(null,{status:416,headers});};
 if(!match||(!match[1]&&!match[2]))return invalid();
 let start,end;
 if(match[1]){start=Number(match[1]);end=match[2]?Number(match[2]):size-1;}
 else{const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return invalid();start=Math.max(0,size-suffix);end=size-1;}
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return invalid();end=Math.min(end,size-1);
 headers.set('content-range',`bytes ${start}-${end}/${size}`);headers.set('content-length',String(end-start+1));
 const reader=response.body.getReader();let offset=0,finished=false;
 const body=new ReadableStream({async pull(controller){try{while(!finished){const {done,value}=await reader.read();if(done){finished=true;controller.error(new Error('INCOMPLETE_VIDEO_ASSET'));return;}const from=Math.max(0,start-offset),to=Math.min(value.byteLength,end+1-offset);offset+=value.byteLength;if(to>from)controller.enqueue(value.subarray(from,to));if(offset>end){finished=true;controller.close();await reader.cancel();return;}if(to>from)return;}}catch(e){if(!finished){finished=true;controller.error(e);}}},cancel(reason){finished=true;return reader.cancel(reason);}});
 return new Response(body,{status:206,headers});
}
