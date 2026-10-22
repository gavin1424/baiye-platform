"""Original modal synthesis. No recordings, sampled instruments or external IP."""
import numpy as np, wave, hashlib, json
from pathlib import Path
SR=48000
out=Path('public/tanxiang-stable/v1/assets/audio/awakening-v23');out.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(70023)
def write(name,a):
    a=np.tanh(a*.8); a*=np.minimum(np.arange(len(a))/240,1);a*=np.minimum(np.arange(len(a))[::-1]/1200,1)
    a=a/(max(1,np.max(np.abs(a))/.78));st=np.column_stack((a,np.roll(a,137)*.93));st[-137:]=0
    p=out/(name+'.wav')
    with wave.open(str(p),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((st*32767).astype('<i2').tobytes())
    return {'file':p.name,'duration':len(a)/SR,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'peak':float(abs(st).max()),'rms':float(np.sqrt(np.mean(st**2)))}
def clock(n):return np.arange(round(n*SR))/SR
t=clock(1.8);bell=sum(np.sin(2*np.pi*174*r*t)*np.exp(-t/(1.1/(1+i*.2)))/(1+i*.7) for i,r in enumerate([1,2.01,2.78,4.14,5.42]));bell+=.35*np.sin(2*np.pi*55*t)*np.exp(-t*8)
t=clock(.72);phase=2*np.pi*(48*t+65*(1-np.exp(-t*30))/30);drum=np.sin(phase)*np.exp(-t*9)+.24*rng.normal(size=len(t))*np.exp(-t*65)
t=clock(.76);noise=rng.normal(size=len(t));noise=np.convolve(noise,np.ones(13)/13,mode='same');circle=noise*np.sin(np.pi*t/.76)**2*.8+.28*np.sin(2*np.pi*(190*t+330*t*t))*np.sin(np.pi*t/.76)**2
t=clock(.76);awaken=sum(np.sin(2*np.pi*f*t)*np.sin(np.pi*t/.76)**1.5 for f in [146.83,220,293.66,440])*.19;awaken+=.25*np.sin(2*np.pi*(90*t+390*t*t))*np.sin(np.pi*t/.76)**2
t=clock(.84);guard=sum(np.sin(2*np.pi*f*t)*np.exp(-t*4.8) for f in [73.416,146.83,220,293.66,440])*.22;guard+=.32*rng.normal(size=len(t))*np.exp(-t*19)+.25*np.sin(2*np.pi*(52*t+1.5*(1-np.exp(-t*20))))*np.exp(-t*7)
files=[write(n,a) for n,a in [('bell',bell),('drum',drum),('circle',circle),('awaken',awaken),('guardian',guard)]]
manifest={'version':'2.3-issue70','origin':'Original deterministic mathematical synthesis; no external samples, melodies or imitated IP','generator':'scripts/issue70-sound.py','seed':70023,'sampleRate':SR,'channels':2,'files':files,'stages':{'0':['bell'],'1':['drum','circle'],'2':['drum','awaken'],'3':['guardian']},'volumeDefault':.35}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps(files))
