"""Build ten original closed concept meshes; never imply a physical scan.

The unchanged owner-supplied WebP is embedded for provenance; a granular concept
material uses its mineral palette. Backs, depth and scale are design guesses.
"""
from pathlib import Path
import json, math, random, struct, hashlib, zlib, bisect
from PIL import Image
from xiangyun_ore_pbr import mineral_maps

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'public/tanxiang-stable/v1/assets/lingstone'
OUT=ASSETS/'models';OUT.mkdir(exist_ok=True)
catalog=json.loads((ASSETS/'catalog.json').read_text(encoding='utf-8'))

def studio_environment():
 """Original numeric soft-box HDR lighting, not a product image."""
 width,height=256,128;raw=bytearray(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 128 +X 256\n')
 def direction(theta,phi):return (math.sin(phi)*math.cos(theta),math.cos(phi),math.sin(phi)*math.sin(theta))
 lights=[(direction(1.1,.65),(6.0,6.0,6.0),12),(direction(2.9,1.2),(2.1,2.2,2.3),8),(direction(-1.4,.75),(3.8,3.5,3.1),20)]
 for y in range(height):
  scan=[]
  for x in range(width):
   v=direction(x/width*math.tau,y/height*math.pi);rgb=[.35,.38,.35]
   for lv,color,power in lights:
    amount=max(0,sum(a*b for a,b in zip(v,lv)))**power
    rgb=[c+amount*l for c,l in zip(rgb,color)]
   m=max(rgb);mantissa,exponent=math.frexp(m);scale=mantissa*256/m
   scan.append([int(c*scale) for c in rgb]+[exponent+128])
  raw.extend([2,2,width>>8,width&255])
  for channel in range(4):
   for start in range(0,width,127):
    block=scan[start:start+127];raw.append(len(block));raw.extend(p[channel] for p in block)
 data=bytes(raw);name='studio-v192-'+hashlib.sha256(data).hexdigest()[:10]+'.hdr';(ASSETS/name).write_bytes(data)
 return '/tanxiang-stable/v1/assets/lingstone/'+name
# Each profile is independently designed from its supplied front concept image.
# (relative height, width, depth, profile radii bottom->top, lean, corner exponent)
SHAPES=[
 (1.65,1.22,.83,[.60,.92,1,.87,.69,.48,.27,.03],-.16,2.6),
 (1.25,1.43,.98,[.67,.96,1,.98,.78,.48,.22,.04],.13,3.0),
 (1.46,1.24,.88,[.32,.68,.91,1,.84,.63,.30,.03],-.24,3.8),
 (1.23,1.44,.88,[.70,.92,1,.99,.86,.65,.30,.03],.08,2.1),
 (1.98,.94,.76,[.67,.91,1,.81,.60,.44,.25,.02],-.22,2.8),
 (1.62,1.22,.89,[.62,.92,1,.86,.82,.56,.32,.02],-.18,3.0),
 (1.29,1.42,.95,[.70,.93,1,.95,.91,.72,.31,.03],.16,3.6),
 (1.40,1.52,.86,[.53,.79,.95,1,.97,.83,.41,.03],-.12,3.3),
 (.96,1.82,1.03,[.70,.98,1,.96,.83,.65,.28,.03],.23,3.2),
 (1.12,1.52,1.02,[.75,1,.99,.92,.79,.54,.26,.03],-.16,3.0),
]

def fracture(x,y,z,seed):
 # Coherent object-space value noise: no latitude-ring displacement/striping.
 ix,iy,iz=math.floor(x),math.floor(y),math.floor(z);fx,fy,fz=x-ix,y-iy,z-iz
 fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);result=0
 for dx in (0,1):
  for dy in (0,1):
   for dz in (0,1):
    n=((ix+dx)*374761393+(iy+dy)*668265263+(iz+dz)*2147483647+seed*1442695041)&0xffffffff
    n=((n^(n>>13))*1274126177)&0xffffffff;value=((n^(n>>16))&65535)/65535-.5
    result+=value*(fx if dx else 1-fx)*(fy if dy else 1-fy)*(fz if dz else 1-fz)
 return result

def build(index,product):
 rng=random.Random(6400+index);h,w,d,profile,lean,exponent=SHAPES[index]
 maps,relief,material_stats=mineral_maps(Image.open(ROOT/'public'/product['image'].lstrip('/')).convert('RGB'),index)
 segments,rings=144,96;pos=[];uv=[];colors=[];indices=[]
 phase=rng.random()*6.28
 # Equal-distance vertices avoid giant triangles spanning a flat superellipse
 # face. Correct UVs alone cannot repair interpolation across those triangles.
 path=[];arc=[0.0]
 for k in range(4097):
  aa=k/4096*math.tau;cc,ss=math.cos(aa),math.sin(aa)
  point=(w*math.copysign(abs(cc)**(2/exponent),cc),d*math.copysign(abs(ss)**(2/exponent),ss))
  if path:arc.append(arc[-1]+math.dist(point,path[-1]))
  path.append(point)
 angles=[]
 for col in range(segments+1):
  target=arc[-1]*col/segments;jj=max(1,min(4096,bisect.bisect_left(arc,target)))
  angles.append((jj-1+(target-arc[jj-1])/(arc[jj]-arc[jj-1]))/4096*math.tau)

 def add(x,y,z,u,v):
  pos.extend([x,y,z]);uv.extend([u,v])
  colors.extend([1,1,1,1])
 # Duplicate the seam for continuous geometry; front, sides and back are all volumes.
 for row in range(rings+1):
  t=row/rings;f=t*(len(profile)-1);j=min(int(f),len(profile)-2)
  radius=profile[j]+(profile[j+1]-profile[j])*(f-j)
  for col in range(segments+1):
   a=angles[col];ca,sa=math.cos(a),math.sin(a)
   sample=float(relief[min(511,int(t*511)),int(col/segments*(relief.shape[1]-1))])-.40
   bump=1+.025*math.sin(5*a+phase+5*t)
   # Deterministic coherent roughness so adjacent seam points remain identical.
   crag=0
   xx=math.copysign(abs(ca)**(2/exponent),ca);zz=math.copysign(abs(sa)**(2/exponent),sa)
   x=w*.5*radius*bump*xx+lean*(t-.35)+.055*math.sin(t*7+index)
   y=.085+t*h+crag*(math.sin(t*math.pi)**.6)
   z=d*.5*radius*bump*zz+.045*math.sin(t*9+index)
   rock=fracture(x*15,y*15,z*15,192+index)*.07+fracture(x*39,y*39,z*39,209+index)*.022
   x+=rock*ca*math.sin(t*math.pi);z+=rock*sa*math.sin(t*math.pi);y+=rock*.55*math.sin(t*math.pi)
   # Tile the reconstructed concept material; never make a new product photo.
   u=col/segments
   v=t
   add(x,y,z,u,v)
 # Arc-length unwrap of each superellipse cross-section. Angular UVs stretch
 # the flat broad faces into horizontal smears, regardless of texture quality.
 for row in range(rings+1):
  start=row*(segments+1);distance=[0.0]
  for col in range(1,segments+1):
   a=(start+col-1)*3;b=(start+col)*3
   distance.append(distance[-1]+math.sqrt((pos[a]-pos[b])**2+(pos[a+2]-pos[b+2])**2))
  for col in range(segments+1):uv[(start+col)*2]=distance[col]/distance[-1]
 for row in range(rings):
  for col in range(segments):
   a=row*(segments+1)+col;b=a+segments+1
   indices.extend([a,b,a+1,a+1,b,b+1])
 # Cap the bottom and top: no flat billboard or disconnected spinning photos.
 bottom=len(pos)//3;add(lean*(-.35)+.055*math.sin(index),.085,.045*math.sin(index),.5,.5)
 top=len(pos)//3;add(lean*.65+.055*math.sin(7+index),.085+h,.045*math.sin(9+index),.5,.5)
 for col in range(segments):
  indices.extend([bottom,col,col+1]);a=rings*(segments+1)+col;indices.extend([top,a+1,a])
 normals=[0.0]*len(pos)
 for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):
  av=pos[a*3:a*3+3];bv=pos[b*3:b*3+3];cv=pos[c*3:c*3+3]
  e=[bv[i]-av[i] for i in range(3)];f=[cv[i]-av[i] for i in range(3)]
  n=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]]
  for ix in [a,b,c]:
   for k in range(3):normals[ix*3+k]+=n[k]
 for i in range(0,len(normals),3):
  n=math.sqrt(sum(v*v for v in normals[i:i+3])) or 1
  normals[i:i+3]=[v/n for v in normals[i:i+3]]
 # Translate the real contact plane onto a centered, substantial display base.
 foot_x=lean*(-.35)+.055*math.sin(index);foot_z=.045*math.sin(index);plinth_top=.20
 for i in range(0,len(pos),3):pos[i]-=foot_x;pos[i+1]+=plinth_top-.085;pos[i+2]-=foot_z
 radius=max(max(abs(v) for v in pos[0::3]),max(abs(v) for v in pos[2::3]))*1.20+.07
 def plinth_mesh(profile):
  bp=[];bn=[];bi=[];segments=96
  for row,(yy,rr) in enumerate(profile):
   previous=profile[max(0,row-1)];following=profile[min(len(profile)-1,row+1)];slope=(following[1]-previous[1])/max(.001,following[0]-previous[0])
   for col in range(segments+1):
    a=col/segments*math.tau;nx,ny,nz=math.cos(a),-radius*slope,math.sin(a);length=math.sqrt(nx*nx+ny*ny+nz*nz)
    bp.extend([math.cos(a)*radius*rr,yy,math.sin(a)*radius*rr]);bn.extend([nx/length,ny/length,nz/length])
  for row in range(len(profile)-1):
   for col in range(segments):
    a=row*(segments+1)+col;b=a+segments+1;bi.extend([a,b,a+1,a+1,b,b+1])
  for (yy,rr),ny in [(profile[0],-1),(profile[-1],1)]:
   center=len(bp)//3;bp.extend([0,yy,0]);bn.extend([0,ny,0])
   for col in range(segments+1):a=col/segments*math.tau;bp.extend([math.cos(a)*radius*rr,yy,math.sin(a)*radius*rr]);bn.extend([0,ny,0])
   for col in range(segments):bi.extend([center,center+col+1,center+col+2] if ny<0 else [center,center+col+2,center+col+1])
  return bp,bn,bi
 base_pos,base_norm,base_idx=plinth_mesh([(0,.92),(.025,1),(.145,1),(.18,.975),(plinth_top,.92)])
 rim_pos,rim_norm,rim_idx=plinth_mesh([(.138,1.003),(.153,1.003)])
 # Baked contact occlusion lies on the actual plinth top, not a floating screen overlay.
 contact=pos[:(segments+1)*3];cx=max(abs(x) for x in contact[0::3])*1.14;cz=max(abs(z) for z in contact[2::3])*1.14
 shadow_pos=[];shadow_norm=[];shadow_colors=[];shadow_idx=[]
 for rr,alpha in [(0,.32),(.7,.25),(1,0)]:
  for col in range(97):
   a=col/96*math.tau;shadow_pos.extend([math.cos(a)*cx*rr,plinth_top+.0005,math.sin(a)*cz*rr]);shadow_norm.extend([0,1,0]);shadow_colors.extend([0,0,0,alpha])
 for row in range(2):
  for col in range(96):a=row*97+col;b=a+97;shadow_idx.extend([a,a+1,b,a+1,b+1,b])
 chunks=bytearray();views=[];accessors=[]
 def buffer(data,target=None):
  while len(chunks)%4:chunks.append(0)
  offset=len(chunks);chunks.extend(data);view={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
  if target:view['target']=target
  views.append(view);return len(views)-1
 def accessor(values,kind,ctype=5126):
  width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[kind]
  packed=struct.pack('<'+('f' if ctype==5126 else 'H')*len(values),*values)
  entry={'bufferView':buffer(packed,34963 if kind=='SCALAR' else 34962),'componentType':ctype,'count':len(values)//width,'type':kind}
  if kind=='VEC3':entry.update(min=[min(values[k::3]) for k in range(3)],max=[max(values[k::3]) for k in range(3)])
  accessors.append(entry);return len(accessors)-1
 tangents=[]
 for i in range(0,len(normals),3):
  nx,ny,nz=normals[i:i+3];tx,ty,tz=-nz,0,nx
  if tx*tx+tz*tz<.0001:tx,ty,tz=1-nx*nx,-nx*ny,-nx*nz
  tn=math.sqrt(tx*tx+ty*ty+tz*tz) or 1;tangents.extend([tx/tn,ty/tn,tz/tn,-1])
 stone={'attributes':{'POSITION':accessor(pos,'VEC3'),'NORMAL':accessor(normals,'VEC3'),'TANGENT':accessor(tangents,'VEC4'),'TEXCOORD_0':accessor(uv,'VEC2'),'COLOR_0':accessor(colors,'VEC4')},'indices':accessor(indices,'SCALAR',5123),'material':0}
 base={'attributes':{'POSITION':accessor(base_pos,'VEC3'),'NORMAL':accessor(base_norm,'VEC3')},'indices':accessor(base_idx,'SCALAR',5123),'material':1}
 rim={'attributes':{'POSITION':accessor(rim_pos,'VEC3'),'NORMAL':accessor(rim_norm,'VEC3')},'indices':accessor(rim_idx,'SCALAR',5123),'material':2}
 shadow={'attributes':{'POSITION':accessor(shadow_pos,'VEC3'),'NORMAL':accessor(shadow_norm,'VEC3'),'COLOR_0':accessor(shadow_colors,'VEC4')},'indices':accessor(shadow_idx,'SCALAR',5123),'material':3}
 texture=(ROOT/'public'/product['image'].lstrip('/')).read_bytes();texture_view=buffer(texture)
 # Embedded PBR atlas: neutral sRGB albedo, linear normal and packed AO/roughness/metalness.
 normal_view,albedo_view,pbr_view=[buffer(data) for data in maps]
 extras={'sku':product['sku'],'modelStatus':'concept','modelSource':'Original procedural concept mesh from supplied AI front artwork; sides and back inferred. Not a scan.','scaleApproximate':True,'physicalMeasurementsKnown':False,'saleEnabled':False,'materialRevision':'1.9.2','plinthTop':plinth_top,'plinthRadius':radius,'contactCentered':True,'materialLayers':material_stats}
 doc={'asset':{'version':'2.0','generator':'Xiangyun V1.9 original concept generator','copyright':'Xiangyun owner-supplied AI artwork and original procedural geometry'},'extensionsUsed':['EXT_texture_webp'],'extensionsRequired':['EXT_texture_webp'],'scene':0,'scenes':[{'nodes':[0,1,2,3]}],'nodes':[{'name':product['sku']+' concept stone','mesh':0,'extras':extras},{'name':'Centered beveled display plinth','mesh':1},{'name':'Champagne gold edge','mesh':2},{'name':'Soft stone contact occlusion','mesh':3}], 'meshes':[{'primitives':[stone]},{'primitives':[base]},{'primitives':[rim]},{'primitives':[shadow]}], 'materials':[{'name':'Coarse mineral concept surface','normalTexture':{'index':1,'scale':.8},'occlusionTexture':{'index':3,'texCoord':0,'strength':.8},'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':2},'metallicRoughnessTexture':{'index':3},'metallicFactor':1,'roughnessFactor':1}},{'name':'Walnut dark display plinth','pbrMetallicRoughness':{'baseColorFactor':[.018,.028,.021,1],'metallicFactor':.25,'roughnessFactor':.48}},{'name':'Brushed champagne edge','pbrMetallicRoughness':{'baseColorFactor':[.40,.25,.095,1],'metallicFactor':.75,'roughnessFactor':.38}},{'name':'Soft contact shadow','alphaMode':'BLEND','pbrMetallicRoughness':{'baseColorFactor':[0,0,0,1],'metallicFactor':0,'roughnessFactor':1}}], 'textures':[{'sampler':0,'extensions':{'EXT_texture_webp':{'source':0}}},{'sampler':0,'source':1},{'sampler':0,'source':2},{'sampler':0,'source':3}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'images':[{'bufferView':texture_view,'mimeType':'image/webp'},{'bufferView':normal_view,'mimeType':'image/png'},{'bufferView':albedo_view,'mimeType':'image/png'},{'bufferView':pbr_view,'mimeType':'image/png'}],'buffers':[{'byteLength':len(chunks)}],'bufferViews':views,'accessors':accessors,'extras':extras}
 raw=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();raw+=b' '*((-len(raw))%4);chunks.extend(b'\0'*((-len(chunks))%4))
 binary=struct.pack('<III',0x46546C67,2,12+8+len(raw)+8+len(chunks))+struct.pack('<II',len(raw),0x4E4F534A)+raw+struct.pack('<II',len(chunks),0x004E4942)+chunks
 filename=f'lingstone-concept-{index+1:02d}-v192-{hashlib.sha256(binary).hexdigest()[:12]}.glb';(OUT/filename).write_bytes(binary)
 return {'id':f'xy-concept-{index+1:02d}','sku':product['sku'],'modelUrl':'/tanxiang-stable/v1/assets/lingstone/models/'+filename,'posterImage':product['image'],'modelStatus':'concept','frames360':[],'modelSource':extras['modelSource'],'modelSizeBytes':len(binary),'scaleApproximate':True,'saleEnabled':False,'sha256':hashlib.sha256(binary).hexdigest(),'vertices':len(pos)//3,'triangles':len(indices)//3,'silhouette':{'height':h,'width':w,'depth':d},'sourceImageSha256':hashlib.sha256(texture).hexdigest(),'presentation':{'plinthTop':plinth_top,'plinthRadius':radius,'materialRevision':'1.9.2'},'materialLayers':material_stats}

if __name__=='__main__':
 models=[build(i,p) for i,p in enumerate(catalog)]
 manifest={'version':'1.9.2','environmentImage':studio_environment(),'type':'AI_CONCEPT_NOT_PHYSICAL_SCAN','products':models}
 (ASSETS/'models-v19.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (ROOT/'public/tanxiang-stable/v1/model-data-v19.js').write_text('/* Original simulated models. No physical dimensions or verified backs. */\nexport const modelCatalog = '+json.dumps(manifest,ensure_ascii=False,indent=2)+';\nexport const modelById = id => modelCatalog.products.find(p=>p.id===id);\n',encoding='utf-8')
 print(json.dumps({'models':len(models),'distinct':len(set(p['sha256'] for p in models)),'bytes':[p['modelSizeBytes'] for p in models]}))
