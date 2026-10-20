"""Photo-referenced, independently seeded baked mineral layers (not material analysis).

All texture maps use one non-repeating cylindrical UV atlas. Numeric relief,
occlusion and metallic masks describe an artistic simulation, never composition.
"""
import numpy as np
from PIL import Image, ImageFilter
import struct, zlib, hashlib

def png(array):
    array=np.asarray(array,dtype=np.uint8);h,w,_=array.shape
    raw=b''.join(b'\0'+row.tobytes() for row in array)
    def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')

def mineral_maps(source,index):
    rng=np.random.default_rng(19200+index);w,h=768,512
    def noise(gx,gy):
        # Periodic control lattice; the seam sees the same color and relief.
        a=rng.random((gy+1,gx+1));a[:,-1]=a[:,0];a[-1,:]=a[0,:]
        return np.asarray(Image.fromarray((a*255).astype('uint8')).resize((w+1,h+1),Image.Resampling.BICUBIC),dtype=float)[:h,:w]/255
    macro=noise(29+index%4,17);meso=noise(78,44);fine=noise(180,90);micro=rng.random((h,w))
    field=.64*macro+.25*meso+.11*fine
    # Different proportions and orientation for every supplied product.
    dark_share=[.22,.16,.20,.16,.34,.21,.24,.25,.33,.28][index]
    quartz_share=[.12,.22,.13,.12,.19,.17,.14,.24,.12,.13][index]
    rust_share=[.14,.08,.24,.15,.10,.16,.24,.14,.23,.13][index]
    dark=field<np.quantile(field,dark_share)
    quartzfield=.52*noise(57,33)+.30*meso+.18*fine
    quartz=(quartzfield>np.quantile(quartzfield,1-quartz_share))&~dark
    rustfield=.72*noise(11,7)+.28*meso
    rust=(rustfield>np.quantile(rustfield,1-rust_share))&~dark&~quartz
    # Sample only the interior stone region. Patch overlap removes a repeated
    # front projection and preserves the original fine-grained visual character.
    sw,sh=source.size;crop=source.crop((int(sw*.34),int(sh*.35),int(sw*.66),int(sh*.62)))
    photo=np.zeros((h,w,3),float);weight=np.zeros((h,w,1),float)
    patch=192;step=96;win=np.maximum(.025,np.outer(np.hanning(patch),np.hanning(patch)))[:,:,None]
    for yy in range(-step,h,step):
        for xx in range(-step,w,step):
            cw,ch=crop.size;x=int(rng.integers(0,max(1,cw-160)));y=int(rng.integers(0,max(1,ch-160)))
            tile=crop.crop((x,y,min(cw,x+160),min(ch,y+160))).resize((patch,patch),Image.Resampling.LANCZOS)
            tile=tile.transpose([Image.Transpose.FLIP_LEFT_RIGHT,Image.Transpose.ROTATE_90,Image.Transpose.ROTATE_180,Image.Transpose.ROTATE_270][int(rng.integers(4))])
            tx0=max(0,-xx);ty0=max(0,-yy);tx1=min(patch,w-xx);ty1=min(patch,h-yy)
            if tx1<=tx0 or ty1<=ty0:continue
            sl=np.s_[yy+ty0:yy+ty1,xx+tx0:xx+tx1];tw=win[ty0:ty1,tx0:tx1]
            photo[sl]+=np.asarray(tile,dtype=float)[ty0:ty1,tx0:tx1]*tw;weight[sl]+=tw
    photo/=weight
    # Local luminance removes broad baked-in studio lighting, retaining rock grain.
    lum=photo.mean(2);blur=np.asarray(Image.fromarray(lum.astype('uint8')).filter(ImageFilter.GaussianBlur(16)),float)
    grain=np.clip((lum+22)/(blur+22),.45,1.6)
    # Keep the supplied photograph's actual granular color relationships instead
    # of painting opaque procedural color islands over them. Lighting is locally
    # normalized; only inferred side/back patch layout is procedural.
    base=photo*np.clip(155/(blur+28),.78,1.20)[:,:,None]
    luminance=base.mean(2);chroma=base.max(2)-base.min(2)
    dark=luminance<np.quantile(luminance,dark_share)
    quartz=(luminance>np.quantile(luminance,1-quartz_share))&(chroma<100)
    rust=(base[:,:,0]>base[:,:,1]*1.55)&(base[:,:,0]>base[:,:,2]*2.1)&~dark
    gold=(base[:,:,0]>180)&(base[:,:,1]>120)&(base[:,:,2]<105)&(fine>.80)&~quartz&~dark
    inferred_oxide=(rustfield>np.quantile(rustfield,.91))&~dark&~quartz&~gold
    # Oxide patches retain photographic grain, not a flat color fill.
    base[inferred_oxide]*=np.array([1.10,.70,.52]);rust=rust|inferred_oxide
    # Visible clasts are photograph-derived irregular aggregates at multiple
    # scales; avoid artificial flat paint, identical dots or metallic coatings.
    base[dark]*=.48
    base[quartz]=np.clip(luminance[quartz,None]*1.28,165,232)*np.array([1.0,.99,.96])
    # Coarse fissures track the same field as the inclusions, while micro-pits
    # and crystal boundaries drive normal and AO maps rather than random normals.
    crack=np.exp(-((field-.49)/.006)**2)*(meso<.48)
    pits=(micro>.976)*(1-fine)
    height=.22*macro+.12*meso+.09*fine+.07*np.clip(grain,0,1.6)+.035*micro+.055*quartz-.045*dark-.055*crack-.09*pits
    gy,gx=np.gradient(height);nx=-gx*4;ny=gy*4;nz=np.ones_like(nx);norm=np.sqrt(nx*nx+ny*ny+nz*nz)
    normal=np.stack([nx/norm*.5+.5,ny/norm*.5+.5,nz/norm*.5+.5],2)*255
    ao=np.clip(1-.29*crack-.24*pits-.12*np.maximum(0,.50-field),.55,1)
    base*=np.clip(1-.36*crack-.26*pits,.45,1)[:,:,None]
    rough=np.clip(.91+.08*fine-.05*quartz,.80,.99);rough[gold]=.26+.17*meso[gold]
    metal=np.zeros((h,w));metal[gold]=.76+.21*fine[gold]
    orm=np.stack([ao,rough,metal],2)*255
    # Blend cylindrical seam, independently for each already-correlated map.
    def seam(a):
        a=a.copy()
        for k in range(8):
            mix=(a[:,k]+a[:,-1-k])*.5;alpha=1-k/8
            a[:,k]=a[:,k]*(1-alpha)+mix*alpha;a[:,-1-k]=a[:,-1-k]*(1-alpha)+mix*alpha
        return np.clip(a,0,255).astype('uint8')
    maps=[png(seam(normal)),png(seam(base)),png(seam(orm))]
    stats={'seed':19200+index,'resolution':[w,h],'darkFraction':float(dark.mean()),'crystalFraction':float(quartz.mean()),'oxideFraction':float(rust.mean()),'metallicFraction':float(gold.mean()),'mapBytes':[len(m) for m in maps],'mapSha256':[hashlib.sha256(m).hexdigest() for m in maps]}
    return maps,height,stats

