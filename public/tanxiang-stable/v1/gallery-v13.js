// Public video presentation stays off until finished media passes review.
import {PROMO_RELEASE_READY} from './promos-data-v22.js';
export const SHOW_VIDEO = PROMO_RELEASE_READY;
const copy = {
  stoneArt:['黑金原石收藏意象','黑金原石收藏意象','Dark stone collection study','黒い原石のコレクションイメージ'],
  woodArt:['天然木質收藏意象','天然木质收藏意象','Natural wood collection study','天然木のコレクションイメージ'],
  dual:['一石一木，兩種收藏之美','一石一木，两种收藏之美','Stone & wood, a dialogue','石と木、ふたつの美'],
  dualText:['循著石的稜角，走進木的溫潤。讓收藏從一眼心動開始。','循着石的棱角，走进木的温润。让收藏从一眼心动开始。','Follow the contours of stone into the warmth of wood. A collection begins with a moment of connection.','石の輪郭から、木のぬくもりへ。心が動く瞬間から、コレクションは始まります。'],
  art:['藝術情境・非實物商品照片','艺术情境・非实物商品照片','Artistic scene · not a product photograph','アートイメージ・実物の商品写真ではありません'],
  heritageArt:['採金與收藏的藝術重現，非歷史影像或檢測證據。','采金与收藏的艺术重现，非历史影像或检测证据。','Artistic reconstructions of mining and collecting; not historical images or test evidence.','採掘と収集を描いたアートです。歴史写真や検査資料ではありません。'],
  featured:['精選收藏・實物圖錄','精选收藏・实物图录','Selected collections · real objects','選りすぐりのコレクション'],
  micro:['石中有山，紋理成境','石中有山，纹理成境','A landscape within every texture','紋理の中に、ひとつの風景'],
  microText:['沿著層理、光澤與結晶，細賞礦物之美。以下為礦物藝術意象；成分與安全性仍以對應原石的檢測紀錄為準。','沿着层理、光泽与结晶，细赏矿物之美。以下为矿物艺术意象；成分与安全性仍以对应原石的检测记录为准。','Explore layers, lustre and crystal forms through mineral-inspired art. Composition and safety require records for the individual specimen.','層、光沢、結晶の美をアートで楽しむ。成分と安全性は、個々の原石に対応する検査記録で確認します。'],
  strata:['層理・時間的筆觸','层理・时间的笔触','Strata · traces of time','層理・時の筆跡'],
  lustre:['光澤・微光之間','光泽・微光之间','Lustre · a quiet glimmer','光沢・ほのかな輝き'],
  crystal:['結晶・自然的秩序','结晶・自然的秩序','Crystal · natural geometry','結晶・自然のかたち'],
  home:['讓日常，留一處山水','让日常，留一处山水','Make room for a quiet landscape','日常に、小さな山水を'],
  homeText:['一方玄關，一隅書房。以留白、光線與木質，想像屬於你的收藏空間。以下為居家陳設藝術提案，非現貨展示。','一方玄关，一隅书房。以留白、光线与木质，想象属于你的收藏空间。以下为居家陈设艺术提案，非现货展示。','An entrance, a study, a place to pause. Light, wood and space frame these imagined interiors; the objects shown are not inventory.','玄関に、書斎に。光と木、余白から生まれる展示空間のアート提案です。掲載の品は販売在庫ではありません。'],
  living:['光落客廳，石入日常','光落客厅，石入日常','An afternoon in the living room','午後のリビング'],
  study:['書房一隅，靜賞有時','书房一隅，静赏有时','A quiet corner of the study','静かな書斎の一角'],
  mining:['循著家族口述，想像採金的往昔','循着家族口述，想象采金的往昔','Imagining the memories of mining','語り継がれた採掘の記憶を描く'],
  archive:['收藏，也收藏一段記憶','收藏，也收藏一段记忆','Objects that hold a memory','ものとともに、記憶を受け継ぐ'],
  elements:['金木水火土・文化意象','金木水火土・文化意象','Five elements · a cultural composition','木火土金水・文化のイメージ'],
  preview:['天地靈石・典藏圖錄','天地灵石・典藏图录','THE LINGSTONE COLLECTION','天地霊石・コレクション'],
};
export function galleryCopy(lang,key){return copy[key][['zh-Hant','zh-Hans','en','ja'].indexOf(lang)]||copy[key][2]}
export function artFigure(name,title,note,{esc,wide=false}={}){
 return `<figure class="editorial-art"><picture><source type="image/webp" srcset="./assets/${name}-480.webp 480w, ./assets/${name}-768.webp 768w, ./assets/${name}-1536.webp 1536w" sizes="${wide?'(max-width:768px) 100vw, 90vw':'(max-width:640px) 100vw, 50vw'}"><img src="./assets/${name}-768.webp" width="1536" height="1024" loading="lazy" decoding="async" alt="${esc(title)}"></picture><figcaption><span>${esc(title)}</span><small>${esc(note)}</small></figcaption></figure>`;
}
export function applyGallery({document:doc=document,lang,t,esc}){
 const g=key=>galleryCopy(lang,key),art=(name,title,note='art',wide=false)=>artFigure(name,g(title),g(note),{esc,wide});
 doc.querySelector('.hero .eyebrow').textContent=g('preview');
 doc.querySelector('.hero-copy').insertAdjacentHTML('beforeend',`<small class="hero-art-note">${esc(g('art'))}</small>`);
 const dual=doc.createElement('section');dual.className='section gallery-light';dual.id='dual-collections';
 dual.innerHTML=`<span class="eyebrow">01 / STONE & WOOD</span><h2>${esc(g('dual'))}</h2><p class="section-lead">${esc(g('dualText'))}</p><div class="editorial-pair"><article>${art('stone-series','stoneArt')}<h3>${esc(t('seriesBlack'))}</h3><a class="text-link" href="#catalog">${esc(t('stoneExplore'))} ↗</a></article><article>${art('incense-series','woodArt')}<h3>${esc(t('incense'))}</h3><a class="text-link" href="#incense-art">${esc(t('incenseExplore'))} ↗</a></article></div>`;
 doc.querySelector('.rail').after(dual);
 doc.querySelector('#catalog h2').textContent=g('featured');
 doc.querySelector('#catalog .eyebrow').textContent='02 / SELECTED COLLECTIONS';
 const story=doc.querySelector('#story');story.classList.add('gallery-warm');story.classList.remove('split');story.querySelector('.eyebrow').textContent='03 / ORIGIN & MEMORY';
 story.querySelector('.story-index').remove();story.insertAdjacentHTML('beforeend',`<div class="editorial-pair heritage-pair">${art('heritage-mining','mining','heritageArt')}${art('heritage-archive','archive','heritageArt')}</div>`);
 const micro=doc.createElement('section');micro.className='section mineral-gallery';micro.id='mineral-gallery';micro.innerHTML=`<span class="eyebrow">04 / THE INNER LANDSCAPE</span><h2>${esc(g('micro'))}</h2><p class="section-lead">${esc(g('microText'))}</p><div class="editorial-trio">${art('macro-strata','strata')}${art('macro-lustre','lustre')}${art('macro-crystal','crystal')}</div>`;story.after(micro);
 const interiors=doc.createElement('section');interiors.className='section gallery-light';interiors.id='living-gallery';interiors.innerHTML=`<span class="eyebrow">05 / ART OF LIVING</span><h2>${esc(g('home'))}</h2><p class="section-lead">${esc(g('homeText'))}</p><div class="editorial-pair">${art('interior-living','living')}${art('interior-study','study')}</div>`;micro.after(interiors);
 const analysis=doc.querySelector('#analysis');analysis.querySelector('.eyebrow').textContent='06 / FIVE ELEMENTS';analysis.insertAdjacentHTML('afterbegin',`<div class="elements-art">${art('elements-art','elements','art',true)}</div>`);
 if(!SHOW_VIDEO)doc.querySelector('#films')?.remove();
 doc.querySelector('#incense-art').classList.add('gallery-warm');
 doc.querySelector('.incense-atmosphere').removeAttribute('aria-hidden');doc.querySelector('.incense-atmosphere').insertAdjacentHTML('beforeend',`<figcaption>${esc(g('art'))}</figcaption>`);
}
export function applyVideoVisibility(doc=document){for(const a of doc.querySelectorAll('a[href="#films"]'))a.hidden=!SHOW_VIDEO;}
