module.exports=()=>{
 const Native=window.AudioContext||window.webkitAudioContext,connect=AudioNode.prototype.connect;
 window.__audioLogs=[];window.__audioRecordings=[];
 if(!Native)return;
 AudioNode.prototype.connect=function(target,...rest){if(target instanceof AudioDestinationNode&&this.context.__capture){const c=this.context;connect.call(this,c.__capture);const analyser=c.createAnalyser();analyser.fftSize=256;connect.call(this,analyser);c.__analyser=analyser}return connect.call(this,target,...rest)};
 class CaptureContext extends Native{constructor(...args){super(...args);this.__capture=this.createMediaStreamDestination();const c=this,entry={created:Date.now(),cues:[],peaks:[],closed:false};window.__audioLogs.push(entry);this.__entry=entry;const recorder=new MediaRecorder(this.__capture.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[];this.__recorder=recorder;entry.recordingStart=Date.now();recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{const a=new Uint8Array(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());let s='';for(const v of a)s+=String.fromCharCode(v);window.__audioRecordings.push({start:entry.recordingStart,base64:btoa(s),end:Date.now()})};recorder.start();this.__poll=setInterval(()=>{if(c.__analyser){const a=new Float32Array(c.__analyser.fftSize);c.__analyser.getFloatTimeDomainData(a);entry.peaks.push({at:Date.now(),rms:Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length)})}},40)}
 createBufferSource(){const n=super.createBufferSource(),orig=n.start.bind(n);n.start=(...args)=>{this.__entry.cues.push({at:Date.now(),duration:n.buffer?.duration});return orig(...args)};return n}
 close(){this.__entry.closed=true;this.__entry.closedAt=Date.now();clearInterval(this.__poll);if(this.__recorder.state!=='inactive')this.__recorder.stop();return super.close()}}
 window.AudioContext=CaptureContext;if(window.webkitAudioContext)window.webkitAudioContext=CaptureContext;
};
