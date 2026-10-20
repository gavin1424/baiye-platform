// Only the five completed, reviewed renders may be exposed; never the legacy script cards.
import {PROMO_RELEASE_READY,promos} from './promos-data-v22.js';
export {PROMO_RELEASE_READY};
const labels={
 heading:['天地靈石・五支短影音','天地灵石・五支短视频','Lingstone · five short films','天地霊石・5つのショートフィルム'],
 intro:['從石形、紋理到五行文化，走進香雲冷香館的收藏世界。','从石形、纹理到五行文化，走进香云冷香馆的收藏世界。','Forms, textures and five-element culture. Step into the Xiangyun collection.','石のかたち、紋理、五行文化。香雲冷香館のコレクションへ。'],
 note:['繁中字幕・原創氛圍音樂・無人聲配音。部分為AI概念圖與模擬3D，非實物攝影或掃描。','繁中字幕・原创氛围音乐・无人声配音。部分为AI概念图与模拟3D，非实物摄影或扫描。','Traditional Chinese captions · original ambient music · no voiceover. Includes AI concept art and simulated 3D, not photographs or scans of real items.','繁体字中国語字幕・オリジナル環境音楽・ナレーションなし。AIイメージと模擬3Dを含み、実物の写真・スキャンではありません。'],
 play:['播放短片','播放短片','Play film','動画を再生'],pause:['暫停','暂停','Pause','一時停止'],
 loading:['影片載入中…','视频加载中…','Loading film…','動画を読み込み中…'],
 ready:['點擊播放，聲音由你開啟。','点击播放，声音由你开启。','Press play; you control the sound.','再生と音声はご自身で操作できます。'],
 error:['影片暫時無法播放，請重試或開啟MP4。','视频暂时无法播放，请重试或打开MP4。','Playback unavailable. Retry or open the MP4.','再生できません。再試行するかMP4を開いてください。'],
 file:['開啟MP4','打开MP4','Open MP4','MP4を開く'],subtitle:['繁中字幕 SRT','繁中字幕 SRT','Chinese captions · SRT','中国語字幕 · SRT'],
 explore:['探索同系列收藏','探索同系列收藏','Explore the collection','コレクションを見る'],
 wide:['品牌簡介・橫式完整版','品牌简介・横版完整版','Brand introduction · landscape edition','ブランド紹介・横長版'],
 ask:['選石洽詢・暫不提供付款','选石洽询・暂不提供付款','Stone enquiries · payments unavailable','石選びのお問い合わせ・決済は未対応'],
};
const titles=[['修仙之路，一石結緣','修仙之路，一石结缘','A bond set in stone','仙道の旅、一石が結ぶ縁'],['每一顆，都值得細看','每一颗，都值得细看','Every form deserves a closer look','一つひとつを、じっくりと'],['金木水火土，尋找你的靈石','金木水火土，寻找你的灵石','Five elements, your own story','五行から見つける、あなたの石'],['石中紋理・家族記憶','石中纹理・家族记忆','Textures that hold a memory','石の紋理・家族の記憶'],['遇見你的那顆靈石','遇见你的那颗灵石','Your collection begins here','あなたの石に出会う']];
export function mountPromos({lang,esc,document:doc=document}){
 const slot=doc.querySelector('#films');if(!slot)return;
 if(!PROMO_RELEASE_READY){slot.remove();return;}
 const index=Math.max(0,['zh-Hant','zh-Hans','en','ja'].indexOf(lang)),t=k=>labels[k][index],url=n=>'./assets/videos/'+n;
 const player=(p,wide=false)=>{const id='promo-'+p.number+(wide?'-wide':'');const title=wide?t('wide'):titles[p.number-1][index],revision=wide?p.wideRevision:p.revision,src=url(wide?p.wide:p.file)+(revision?'?v='+revision:'');return `<article class="promo-card ${wide?'promo-wide':''}"><div class="promo-picture"><video id="${id}" width="${wide?1920:1080}" height="${wide?1080:1920}" controls playsinline preload="none" poster="${url(wide?(p.widePoster||p.poster):p.poster)+(revision?'?v='+revision:'')}" data-promo-src="${src}" aria-label="${esc(title)}" aria-describedby="${id}-status"><track kind="subtitles" srclang="zh-Hant" label="繁體中文" src="${url(p.vtt)}"></video></div><div class="promo-copy"><span class="eyebrow">${wide?'BRAND FILM':String(p.number).padStart(2,'0')+' / FIVE FILMS'} · 24 SEC</span><h3>${esc(title)}</h3><p class="promo-status" id="${id}-status" role="status">${esc(t('ready'))}</p><button class="button" data-promo-play="${id}">${esc(t('play'))}</button><div class="promo-links"><a href="${src}" target="_blank" rel="noopener">${esc(t('file'))} ↗</a><a href="${url(p.srt)}" download>${esc(t('subtitle'))} ↓</a><a href="${p.number===3?'#analysis':'#catalog'}">${esc(t('explore'))} →</a></div></div></article>`;};
 slot.className='section promo-section';slot.innerHTML=`<span class="eyebrow">XIANGYUN / MOVING STORIES</span><h2>${esc(t('heading'))}</h2><p class="section-lead">${esc(t('intro'))}</p><p class="promo-provenance">${esc(t('note'))}</p>${player(promos[0],true)}<div class="promo-grid">${promos.map(p=>player(p)).join('')}</div><p class="promo-provenance">${esc(t('ask'))}</p>`;
 for(const button of slot.querySelectorAll('[data-promo-play]')){const video=doc.getElementById(button.dataset.promoPlay),status=doc.getElementById(video.id+'-status');
  const failed=()=>{status.textContent=t('error');button.textContent=t('play');button.disabled=false;};
  button.addEventListener('click',async()=>{if(!video.paused){video.pause();return;}if(!video.getAttribute('src')){video.src=video.dataset.promoSrc;video.load();}try{await video.play()}catch{failed()}});
  video.addEventListener('loadstart',()=>{status.textContent=t('loading')});video.addEventListener('waiting',()=>{status.textContent=t('loading')});
  video.addEventListener('play',()=>{for(const other of slot.querySelectorAll('video'))if(other!==video)other.pause();button.textContent=t('pause')});
  video.addEventListener('playing',()=>{status.textContent=''});video.addEventListener('pause',()=>{button.textContent=t('play')});video.addEventListener('ended',()=>{button.textContent=t('play')});video.addEventListener('error',failed);
 }
}
