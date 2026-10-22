// Original bell, drums and modal swells. No user data is persisted here.
const names=['bell','drum','circle','awaken','guardian'],cues=[['bell'],['drum','circle'],['drum','awaken'],['guardian']];
let preload;
export function prepareCeremonyAudio(){
 if(preload)return preload;
 preload=(async()=>{const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw Error('AUDIO_UNAVAILABLE');const decoder=new Offline(2,1,48000);const entries=await Promise.all(names.map(async name=>{const r=await fetch(new URL(`./assets/audio/awakening-v23/${name}.wav`,import.meta.url));if(!r.ok)throw Error('AUDIO_UNAVAILABLE');return[name,await decoder.decodeAudioData(await r.arrayBuffer())]}));return Object.fromEntries(entries)})().catch(()=>null);
 return preload;
}
function preferences(){try{const v=JSON.parse(localStorage.getItem('xiangyun-ceremony-sound')||'null');return {muted:v?.muted===true,volume:Math.max(0,Math.min(1,Number.isFinite(v?.volume)?v.volume:.35))}}catch{return {muted:false,volume:.35}}}
export function createCeremonyAudio(onState=()=>{}){
 const pref=preferences();let context,gain,compressor,stopped=false,stage=-1,stageAt=0,buffers=null;const playing=new Set();
 const notify=()=>onState({muted:pref.muted,volume:pref.volume,available:!!context&&context.state==='running',stopped});
 function save(){try{localStorage.setItem('xiangyun-ceremony-sound',JSON.stringify(pref))}catch{}}
 try{const Audio=window.AudioContext||window.webkitAudioContext;context=new Audio();gain=context.createGain();gain.gain.value=pref.muted?0:pref.volume;compressor=context.createDynamicsCompressor();compressor.threshold.value=-15;compressor.knee.value=8;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.15;gain.connect(compressor);compressor.connect(context.destination);context.resume().then(notify).catch(notify)}catch{context=null}
 function playStage(index){if(stopped||!context||!buffers||context.state!=='running')return;for(const name of cues[index]||[]){const node=context.createBufferSource();node.buffer=buffers[name];node.connect(gain);playing.add(node);node.onended=()=>{playing.delete(node);node.disconnect()};node.start()}}
 prepareCeremonyAudio().then(b=>{buffers=b;if(!stopped&&stage>=0&&performance.now()-stageAt<180)playStage(stage);notify()});
 return {
  stage(index){stage=index;stageAt=performance.now();playStage(index)},
  toggle(){if(stopped)return;pref.muted=context?.state==='running'?!pref.muted:false;gain?.gain.setTargetAtTime(pref.muted?0:pref.volume,context.currentTime,.01);context?.resume().then(notify).catch(notify);save();notify()},
  volume(value){if(stopped)return;pref.volume=Math.max(0,Math.min(1,Number(value)||0));if(gain)gain.gain.setTargetAtTime(pref.muted?0:pref.volume,context.currentTime,.01);save();notify()},
  stop(){if(stopped)return;stopped=true;for(const node of playing){try{node.stop();node.disconnect()}catch{}}playing.clear();gain?.disconnect();compressor?.disconnect();context?.close().catch(()=>{});notify()},
  state(){return {...pref,available:!!context&&context.state==='running',stopped}}
 };
}
