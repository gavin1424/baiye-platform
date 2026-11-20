(()=>{
// LINE 官方帳號或個人 LINE 的加好友網址，例如 https://line.me/R/ti/p/@xxxx
const LINE_URL='';

const $=id=>document.getElementById(id);
const cvSrc=$('cvSrc'),cvOut=$('cvOut'),cvWood=$('cvWood');
const PREVIEW=900;
const defaults={bright:0,contrast:20,sharp:30,gamma:100,auto:true,invert:false,mirror:false,mode:'gray',size:2000};
let state={...defaults},img=null,fileName='photo',timer=0;

function segInit(id,key){$(id).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;state[key]=key==='size'?+b.dataset.v:b.dataset.v;syncSeg(id,state[key]);schedule()})}
function syncSeg(id,v){[...$(id).children].forEach(b=>b.classList.toggle('on',String(b.dataset.v)===String(v)))}
segInit('mode','mode');segInit('size','size');
for(const k of ['bright','contrast','sharp','gamma'])$(k).addEventListener('input',()=>{state[k]=+$(k).value;showVals();schedule()});
for(const k of ['auto','invert','mirror'])$(k).addEventListener('change',()=>{state[k]=$(k).checked;schedule()});
function showVals(){$('brightV').textContent=state.bright;$('contrastV').textContent=state.contrast;$('sharpV').textContent=state.sharp;$('gammaV').textContent=(state.gamma/100).toFixed(1)}
$('reset').onclick=()=>{state={...defaults};for(const k of ['bright','contrast','sharp','gamma'])$(k).value=state[k];for(const k of ['auto','invert','mirror'])$(k).checked=state[k];syncSeg('mode',state.mode);syncSeg('size',state.size);showVals();schedule()};
$('another').onclick=()=>$('file').click();

const drop=$('drop');
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)load(f)});
$('file').addEventListener('change',e=>{const f=e.target.files[0];if(f)load(f);e.target.value=''});

function load(f){
  if(!f.type.startsWith('image/')&&!/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)){status('請選擇照片檔（JPG 或 PNG）');return}
  fileName=(f.name||'photo').replace(/\.[^.]+$/,'').replace(/[^\w一-鿿-]+/g,'_').slice(0,40)||'photo';
  const im=new Image(),rd=new FileReader();
  im.onload=()=>{img=im;document.querySelectorAll('.work').forEach(s=>s.classList.add('on'));status('');render();$('work').scrollIntoView({behavior:'smooth',block:'start'})};
  im.onerror=()=>status('這張照片無法讀取，請改用 JPG 或 PNG（iPhone 可在相簿選「最相容」格式）');
  rd.onload=()=>{im.src=rd.result};rd.onerror=im.onerror;rd.readAsDataURL(f);
}
function schedule(){if(!img)return;clearTimeout(timer);timer=setTimeout(render,60)}

// 把照片畫成指定長邊的灰階陣列
function grayAt(longSide){
  const s=Math.min(1,longSide/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,Math.round(img.naturalWidth*s)),h=Math.max(1,Math.round(img.naturalHeight*s));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,w,h);
  if(state.mirror){x.translate(w,0);x.scale(-1,1)}
  x.drawImage(img,0,0,w,h);
  const d=x.getImageData(0,0,w,h).data,g=new Float32Array(w*h);
  for(let i=0,j=0;j<g.length;i+=4,j++)g[j]=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
  return {w,h,g,c};
}
function process(o){
  const {w,h,g}=o,n=g.length;
  // 自動調整：拉開 1%–99% 範圍
  let lo=0,hi=255;
  if(state.auto){const hist=new Uint32Array(256);for(let i=0;i<n;i++)hist[g[i]|0]++;let a=0;const cut=n*0.01;for(lo=0;lo<255&&(a+=hist[lo])<cut;lo++);a=0;for(hi=255;hi>0&&(a+=hist[hi])<cut;hi--);if(hi-lo<10){lo=0;hi=255}}
  const cf=(259*(state.contrast*2.55+255))/(255*(259-state.contrast*2.55)),br=state.bright*1.28,gm=100/state.gamma;
  const lut=new Float32Array(256);
  for(let v=0;v<256;v++){let t=Math.min(1,Math.max(0,(v-lo)/(hi-lo)));t=Math.pow(t,gm)*255;t=cf*(t-128)+128+br;lut[v]=Math.min(255,Math.max(0,t))}
  for(let i=0;i<n;i++)g[i]=lut[g[i]|0];
  // 銳利化（unsharp mask）
  if(state.sharp>0){
    const amt=state.sharp/50,b=new Float32Array(n);
    for(let y=0;y<h;y++){const y0=Math.max(0,y-1)*w,y1=y*w,y2=Math.min(h-1,y+1)*w;for(let x=0;x<w;x++){const x0=Math.max(0,x-1),x2=Math.min(w-1,x+1);b[y1+x]=(g[y0+x0]+g[y0+x]+g[y0+x2]+g[y1+x0]+g[y1+x]+g[y1+x2]+g[y2+x0]+g[y2+x]+g[y2+x2])/9}}
    for(let i=0;i<n;i++)g[i]=Math.min(255,Math.max(0,g[i]+(g[i]-b[i])*amt));
  }
  if(state.invert)for(let i=0;i<n;i++)g[i]=255-g[i];
  if(state.mode==='bw'){for(let i=0;i<n;i++)g[i]=g[i]<128?0:255}
  else if(state.mode==='dither'){ // Floyd–Steinberg
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,old=g[i],nv=old<128?0:255,e=old-nv;g[i]=nv;
      if(x+1<w)g[i+1]+=e*7/16;if(y+1<h){if(x>0)g[i+w-1]+=e*3/16;g[i+w]+=e*5/16;if(x+1<w)g[i+w+1]+=e/16}}
  }
  return o;
}
function paint(cv,o,wood){
  cv.width=o.w;cv.height=o.h;const x=cv.getContext('2d'),id=x.createImageData(o.w,o.h),d=id.data,g=o.g;
  // 木頭模擬：白=原木色，黑=灼燒深褐
  const W=[222,190,145],B=[52,31,18];
  for(let i=0,j=0;j<g.length;i+=4,j++){const v=Math.min(255,Math.max(0,g[j]));
    if(wood){const t=v/255,grain=1+0.035*Math.sin((j%o.w)*0.02+Math.sin((j/o.w)*0.05)*6);d[i]=(B[0]+(W[0]-B[0])*t)*grain;d[i+1]=(B[1]+(W[1]-B[1])*t)*grain;d[i+2]=(B[2]+(W[2]-B[2])*t)*grain}
    else{d[i]=d[i+1]=d[i+2]=v}d[i+3]=255}
  x.putImageData(id,0,0);
}
function render(){
  const o=grayAt(PREVIEW);
  cvSrc.width=o.w;cvSrc.height=o.h;cvSrc.getContext('2d').drawImage(o.c,0,0);
  process(o);paint(cvOut,o,false);paint(cvWood,o,true);
}
function buildFull(){const o=process(grayAt(state.size)),c=document.createElement('canvas');paint(c,o,false);return c}
function toBlob(c){return new Promise(r=>c.toBlob(r,'image/png'))}
function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`}
function outName(){return `雷射木刻_${fileName}_${stamp()}.png`}
function status(t){$('status').textContent=t}

// LINE、FB、IG 內建瀏覽器常常不能下載檔案
const inApp=/Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent);
if(inApp)$('inapp').hidden=false;
const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent));

function showResult(c){
  // 一定把成品圖顯示在頁面上，長按就能存，任何手機都可用
  $('resultImg').src=c.toDataURL('image/png');$('result').hidden=false;
  $('result').scrollIntoView({behavior:'smooth',block:'center'});
}
$('download').onclick=async()=>{
  if(!img)return;status('製作高解析圖檔中…');await new Promise(r=>setTimeout(r,30));
  const c=buildFull();showResult(c);
  if(mobile){status('✅ 圖檔做好了！請長按下面的圖片 →「儲存影像」或「加入照片」，存好後用 LINE 傳給我們。');return}
  const a=document.createElement('a');a.href=$('resultImg').src;a.download=outName();document.body.appendChild(a);a.click();a.remove();
  status('✅ 已下載。若沒看到檔案，可在下面圖片按右鍵 →「另存圖片」。接著把圖檔用 LINE 傳給我們。');
};
$('share').onclick=async()=>{
  if(!img)return;status('準備分享中…');await new Promise(r=>setTimeout(r,30));
  const blob=await toBlob(buildFull()),file=new File([blob],outName(),{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:'雷射木刻圖檔',text:'你好，我想訂做紫光雷射木刻，圖檔如附件。尺寸：＿＿ 數量：＿＿'});status('✅ 已開啟分享，請選擇 LINE 傳給我們。');return}
    catch(e){if(e&&e.name==='AbortError'){status('');return}}
  }
  showResult(buildFull());
  status('這個瀏覽器不能直接分享。請長按下面的圖片 →「儲存影像」，再打開 LINE 傳給我們。');
};
})();
