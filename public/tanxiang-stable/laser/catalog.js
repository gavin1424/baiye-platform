(()=>{
// 範例作品：新增款式只要在這裡加一行，並把圖放進 samples/（代號-wood.jpg、代號-gray.jpg）
const CATS=[['all','全部'],['dm','神明佛像'],['tw','台灣名勝'],['zhs','中國山水'],['ws','世界名景'],['cs','創作山水']];
const ITEMS=[
 {id:'dm-001',cat:'dm',name:'關聖帝君',desc:'忠義護佑，鎮宅招財，適合商家、居家供奉。'},
 {id:'dm-002',cat:'dm',name:'媽祖',desc:'天上聖母，海上守護，出入平安。'},
 {id:'tw-001',cat:'tw',name:'阿里山雲海',desc:'神木、涼亭與日出雲海。'},
 {id:'tw-002',cat:'tw',name:'日月潭晨曦',desc:'湖光山色，晨曦映照拉魯島。'},
 {id:'zhs-001',cat:'zhs',name:'黃山迎客松',desc:'奇松雲海，迎客納福。'},
 {id:'zhs-002',cat:'zhs',name:'桂林漓江山水',desc:'竹影扁舟，山水甲天下。'},
 {id:'ws-001',cat:'ws',name:'瑞士阿爾卑斯山',desc:'雪峰、木屋與高山湖泊。'},
 {id:'ws-002',cat:'ws',name:'美國大峽谷',desc:'夕陽下的壯闊峽谷。'},
 {id:'cs-001',cat:'cs',name:'紫光靈山',desc:'仙山瀑布，蓮花靈光。'},
 {id:'cs-002',cat:'cs',name:'星河仙境',desc:'星河流轉，天宮浮島。'}
];
const $=id=>document.getElementById(id);
const code=it=>it.id.toUpperCase();
const src=(it,k)=>`./samples/${it.id}-${k}.jpg`;
let cur='all',picked=null;

$('tabs').innerHTML=CATS.map(([k,v])=>`<button type="button" data-k="${k}"${k===cur?' class="on"':''}>${v}</button>`).join('');
$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;cur=b.dataset.k;[...$('tabs').children].forEach(x=>x.classList.toggle('on',x===b));draw()});

function draw(){
  const list=ITEMS.filter(it=>cur==='all'||it.cat===cur);
  $('cat').innerHTML=list.map(it=>`
<article class="item${picked&&picked.id===it.id?' picked':''}" data-id="${it.id}">
 <div class="pic" data-flip><img src="${src(it,'wood')}" alt="${it.name} 木刻效果" loading="lazy" width="720" height="722"><span class="badge">${CATS.find(c=>c[0]===it.cat)[1]}</span><span class="flip">看灰階圖</span></div>
 <div class="info"><h3>${it.name}</h3><div class="code">編號：${code(it)}</div><p>${it.desc}</p><button class="btn" type="button" data-pick>選這款</button></div>
</article>`).join('');
}
$('cat').addEventListener('click',e=>{
  const card=e.target.closest('.item');if(!card)return;const it=ITEMS.find(x=>x.id===card.dataset.id);
  if(e.target.closest('[data-flip]')){const img=card.querySelector('img'),f=card.querySelector('.flip'),gray=img.src.includes('-gray');img.src=src(it,gray?'wood':'gray');f.textContent=gray?'看灰階圖':'看木刻效果';return}
  if(e.target.closest('[data-pick]')){pick(it)}
});

function pick(it){
  picked=it;draw();
  $('oImg').src=src(it,'wood');$('oImg').alt=it.name;$('oName').textContent=it.name;$('oCode').textContent='編號：'+code(it);
  $('order').classList.add('on');$('oStatus').textContent='';msg();
  $('order').scrollIntoView({behavior:'smooth',block:'start'});
}
let size='20×20 公分';
$('oSize').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;size=b.dataset.v;[...$('oSize').children].forEach(x=>x.classList.toggle('on',x===b));msg()});
['oQty','oText'].forEach(id=>$(id).addEventListener('input',msg));
function text(){
  if(!picked)return'';const q=Math.max(1,parseInt($('oQty').value)||1),t=$('oText').value.trim();
  return `您好，我想訂購紫光雷射木刻：\n款式：${picked.name}（編號 ${code(picked)}）\n尺寸：${size}\n數量：${q}\n加刻文字：${t||'不需要'}\n請回覆報價與製作時間，謝謝！`;
}
function msg(){$('oMsg').textContent=text()}
async function copy(t){
  try{await navigator.clipboard.writeText(t);return true}catch(e){}
  const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){}a.remove();return ok;
}
$('oCopy').onclick=async()=>{$('oStatus').textContent=await copy(text())?'✅ 已複製，請打開 LINE 貼上傳給我們。':'請長按上面的訊息，自己複製後傳給我們。'};
$('oShare').onclick=async()=>{
  const t=text();
  if(navigator.share){try{await navigator.share({text:t});$('oStatus').textContent='✅ 請在分享選單選擇 LINE 傳給我們。';return}catch(e){if(e&&e.name==='AbortError')return}}
  const ok=await copy(t);$('oStatus').textContent=ok?'✅ 訊息已複製，請打開 LINE 貼上傳給我們。':'請長按上面的訊息複製，再用 LINE 傳給我們。';
};
draw();
})();
