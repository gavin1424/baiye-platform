// Rebind the original verified PNG bytes through model-viewer's TextureLoader
// (HTMLImageElement) path, independently of GLTFLoader's ImageBitmap path.
// No painting, palette replacement, shader injection or third-party requests.
export async function extractMineralMaps(bytes,meta){
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==meta.sha256)throw Error('MODEL_HASH_MISMATCH');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length)throw Error('INVALID_GLB');
 const length=view.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length))),bin=28+length;
 const mat=doc.materials.find(m=>m.name==='Coarse mineral concept surface');if(!mat)throw Error('MINERAL_MATERIAL_MISSING');
 const bindings={baseColor:mat.pbrMetallicRoughness.baseColorTexture.index,normal:mat.normalTexture.index,roughnessMetalness:mat.pbrMetallicRoughness.metallicRoughnessTexture.index},maps={};
 for(const [name,index]of Object.entries(bindings)){
  const image=doc.images[doc.textures[index].source],buffer=doc.bufferViews[image.bufferView];if(image.mimeType!=='image/png'||!buffer)throw Error('UNSUPPORTED_PBR_IMAGE');
  const start=bin+(buffer.byteOffset||0),end=start+buffer.byteLength;if(start<bin||end>bytes.length)throw Error('INVALID_PBR_RANGE');
  const data=bytes.slice(start,end),png=new DataView(data.buffer);if(png.getUint32(0)!==0x89504e47)throw Error('INVALID_PBR_PNG');
  maps[name]={data,mimeType:image.mimeType,width:png.getUint32(16),height:png.getUint32(20)};
 }
 return {maps,sha256:hash,bytes:bytes.length};
}
export async function fetchMineralSource(meta,signal){
 const r=await fetch(meta.modelUrl,{cache:'reload',signal,credentials:'same-origin'});
 if(!r.ok||!r.headers.get('content-type')?.includes('model/gltf-binary'))throw Error('MODEL_HTTP_FAILED');
 const source=await extractMineralMaps(new Uint8Array(await r.arrayBuffer()),meta);
 source.http={url:r.url,status:r.status,contentType:r.headers.get('content-type'),etag:r.headers.get('etag'),cacheControl:r.headers.get('cache-control'),deployment:r.headers.get('x-xiangyun-deployment')};return source;
}
export async function reloadMineralMaps(viewer,source,signal){
 const material=viewer.model?.getMaterialByName('Coarse mineral concept surface');if(!material)throw Error('MINERAL_MATERIAL_MISSING');
 const pbr=material.pbrMetallicRoughness,slots={baseColor:pbr.baseColorTexture,normal:material.normalTexture,roughnessMetalness:pbr.metallicRoughnessTexture},urls=[],textures={},details={};
 const dispose=()=>{for(const url of urls.splice(0))URL.revokeObjectURL(url)};
 try{
  for(const [name,map]of Object.entries(source.maps)){
   signal?.throwIfAborted();if(!slots[name])throw Error('PBR_SLOT_MISSING');if(map.width>4096||map.height>4096)throw Error('PBR_IMAGE_TOO_LARGE');
   const url=URL.createObjectURL(new Blob([map.data],{type:map.mimeType}));urls.push(url);
   textures[name]=await viewer.createTexture(url,map.mimeType);if(!textures[name])throw Error('PBR_IMAGE_DECODE_FAILED');
   details[name]={width:map.width,height:map.height,bytes:map.data.length,decoder:'TextureLoader/HTMLImageElement'};
  }
  signal?.throwIfAborted();for(const name of Object.keys(slots))slots[name].setTexture(textures[name]);material.occlusionTexture?.setTexture(textures.roughnessMetalness);
  return {dispose,evidence:{path:'VERIFIED_ORIGINAL_PNG_HTML_IMAGE_REBIND',sha256:source.sha256,modelBytes:source.bytes,http:source.http||null,maps:details}};
 }catch(e){dispose();throw e}
}
