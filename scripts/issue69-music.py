"""Original synthesized pentatonic sound design; no recordings or borrowed melody."""
import math, wave, os
import numpy as np
os.makedirs('video-production/issue69/assets/audio',exist_ok=True)
rate=48000
for film in range(1,6):
    length=24; t=np.arange(rate*length)/rate
    track=np.zeros((len(t),2),np.float64)
    base=[130.8128,146.8324,164.8138,130.8128,146.8324][film-1]
    for j,ratio in enumerate([1,1.5,2]):
        tone=np.sin(2*np.pi*base*ratio*t+0.15*np.sin(2*np.pi*.07*t))*.022/(j+1)
        track[:,0]+=tone;track[:,1]+=np.sin(2*np.pi*base*ratio*t+.018)*.022/(j+1)
    scale=[0,2,4,7,9,12,14,16]
    for k in range(12):
        start=.8+k*1.85; freq=base*2*2**(scale[(k*3+film)%8]/12)
        u=t-start; mask=u>=0; env=np.where(mask,(1-np.exp(-np.maximum(u,0)*22))*np.exp(-np.maximum(u,0)*1.5),0)
        note=sum(np.sin(2*np.pi*freq*h*np.maximum(u,0))*a for h,a in [(1,1),(2,.19),(3,.07)])*env*.075
        pan=.25+.5*((k*5+film)%9)/8
        track[:,0]+=note*math.sqrt(1-pan);track[:,1]+=note*math.sqrt(pan)
        for delay,gain in [(.19,.18),(.38,.09),(.64,.04)]:
            d=int(delay*rate);track[d:,0]+=note[:-d]*gain;track[d:,1]+=note[:-d]*gain*.9
    envelope=np.minimum(t/1.6,1)*np.minimum((length-t)/2,1)
    track*=np.maximum(envelope,0)[:,None]
    peak=np.max(np.abs(track));track*=.28/max(peak,.28)
    with wave.open(f'video-production/issue69/assets/audio/promo-{film:02}.wav','wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes((track*32767).astype('<i2').tobytes())
print('5 original 24-second stereo ambient soundtracks created; no voiceover.')
