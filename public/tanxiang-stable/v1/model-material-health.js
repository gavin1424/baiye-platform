// A mesh 'load' event does not prove its textures decoded or rendered correctly.
// Public model-viewer scene-graph APIs only; no material recoloring/overrides.
export function inspectMineralPixels(pixels,width,height){
 let x0=width,y0=height,x1=-1,y1=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(pixels[i+3]>=220){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
 if(x1<x0)return {ok:false,reason:'EMPTY_RENDER',samples:0};
 // Upper opaque silhouette excludes the plinth, its gold rim and soft shadow.
 const bottom=Math.floor(y0+(y1-y0)*.60);let samples=0,colored=0,white=0;let min=255,max=0;
 for(let y=y0;y<=bottom;y++)for(let x=x0;x<=x1;x++){const i=(y*width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],a=pixels[i+3];if(a<220)continue;samples++;const lo=Math.min(r,g,b),hi=Math.max(r,g,b);const light=.2126*r+.7152*g+.0722*b;min=Math.min(min,light);max=Math.max(max,light);if(hi-lo>=18&&r-g>=5&&r-b>=15)colored++;if(lo>190&&hi-lo<20)white++;}
 const coloredFraction=colored/Math.max(1,samples),whiteFraction=white/Math.max(1,samples);
 return {ok:samples>=64&&coloredFraction>=.025&&max-min>=45,reason:samples<64?'EMPTY_RENDER':coloredFraction<.025?'MINERAL_COLOR_MISSING':max-min<45?'MINERAL_CONTRAST_MISSING':null,samples,coloredFraction,whiteFraction,range:max-min};
}
async function raster(blob){
 const url=URL.createObjectURL(blob),image=new Image();
 try{image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=192;canvas.height=Math.max(1,Math.round(192*image.naturalHeight/image.naturalWidth));const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('CANVAS_UNAVAILABLE');ctx.drawImage(image,0,0,canvas.width,canvas.height);return {pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};}finally{URL.revokeObjectURL(url)}
}
async function textureEvidence(info){
 const texture=info?.texture;if(!texture?.source)throw Error('PBR_TEXTURE_MISSING');
 const source=texture.source,url=await source.createThumbnail(96,96),image=new Image();
 try{image.src=url;await image.decode();if(image.naturalWidth<1||image.naturalHeight<1)throw Error('PBR_DECODE_FAILED');return {name:texture.name,type:source.type,uri:source.uri||null,decoded:true,thumbnailWidth:image.naturalWidth,thumbnailHeight:image.naturalHeight};}finally{URL.revokeObjectURL(url)}
}
export async function verifyMineralMaterial(viewer){
 const material=viewer.model?.getMaterialByName('Coarse mineral concept surface');
 if(!material)throw Error('MINERAL_MATERIAL_MISSING');
 const pbr=material.pbrMetallicRoughness;
 const [baseColor,normal,roughnessMetalness]=await Promise.all([textureEvidence(pbr.baseColorTexture),textureEvidence(material.normalTexture),textureEvidence(pbr.metallicRoughnessTexture)]);
 // toBlob forces a render of this model. Keep the product photograph covering
 // the canvas until the rendered pixels, rather than only the mesh, pass.
 const frame=await viewer.toBlob({mimeType:'image/png',idealAspect:false});
 const image=await raster(frame),render=inspectMineralPixels(image.pixels,image.width,image.height);
 const evidence={material:material.name,baseColorFactor:Array.from(pbr.baseColorFactor),roughnessFactor:pbr.roughnessFactor,metallicFactor:pbr.metallicFactor,maps:{baseColor,normal,roughnessMetalness},render};
 if(!render.ok){const error=Error(render.reason);error.evidence=evidence;throw error;}
 return evidence;
}
