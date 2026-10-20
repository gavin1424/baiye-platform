/* 香雲冷香館：十款靈石概念商品圖片緊急修復 V4
 * 只新增圖庫，不改站上會員、購物車、金流、八字與其他模組。
 * 概念圖不是實物照；不啟用未驗證商品付款。
 */
(() => {
  'use strict';
  const ASSET_BASE = '/tanxiang-stable/v1/assets/lingstone/';
  const DATA_URL = ASSET_BASE + 'catalog.json';
  const ROOT_ID = 'xy-lingstone-visual-catalog';
  let catalog = null;
  let busy = false;
  const i18n = {
    'zh-Hant': {eyebrow:'TEN COLLECTIBLE DESIGNS', title:'天地五行靈石・十款珍藏', subtitle:'十款不同原石風格，逐款展示與選石洽詢。', warning:'此區為 AI 藝術風格示意，並非十件實物逐一拍攝；請先向館方確認實際石頭、重量、尺寸及材料安全後再購買。', inquiry:'詢問這一款', details:'查看典藏資料', price:'規劃售價', imageError:'圖片暫時無法載入', close:'關閉', weight:'重量', dimensions:'尺寸', notMeasured:'待實測', verify:'獨立樣品檢測', notVerified:'尚無本顆個別的檢測報告', safety:'尚未確認實物安全與出貨條件，不提供直接付款。', empty:'暫時無法載入商品圖片，請聯絡館方。'},
    'zh-Hans': {eyebrow:'TEN COLLECTIBLE DESIGNS', title:'天地五行灵石・十款珍藏', subtitle:'十款不同原石风格，逐款展示与选石咨询。', warning:'此区为 AI 艺术风格示意，并非十件实物逐一拍摄；请先确认实际石头、重量、尺寸及材料安全后再购买。', inquiry:'咨询此款', details:'查看典藏资料', price:'规划售价', imageError:'图片暂时无法加载', close:'关闭', weight:'重量', dimensions:'尺寸', notMeasured:'待实测', verify:'单件检测', notVerified:'尚无此件专属检测报告', safety:'实物安全和出货条件未确认，暂不直接付款。', empty:'暂无法加载商品图片，请联系馆方。'},
    en: {eyebrow:'TEN COLLECTIBLE DESIGNS', title:'Five Elements · Ten Lingstone Designs', subtitle:'Explore ten different stone concepts and ask about the real specimens.', warning:'AI-generated concept images, not photographs of ten verified stones. Request actual photos, measurements and material-safety information before buying.', inquiry:'Inquire about this design', details:'View details', price:'Proposed price', imageError:'Image unavailable', close:'Close', weight:'Weight', dimensions:'Size', notMeasured:'To be measured', verify:'Per-item analysis', notVerified:'No verified analysis for this particular stone', safety:'No checkout until the actual item and safety/shipping details have been verified.', empty:'Images temporarily unavailable. Please contact the gallery.'},
    ja: {eyebrow:'TEN COLLECTIBLE DESIGNS', title:'天地五行霊石・十のコレクション', subtitle:'異なる十種類の石のデザインをご覧いただけます。', warning:'画像はAIによるデザインイメージで、十点の現物を撮影したものではありません。現物写真・重量・サイズ・安全情報をご確認の上ご購入ください。', inquiry:'このデザインを問い合わせる', details:'資料を見る', price:'予定価格', imageError:'画像を表示できません', close:'閉じる', weight:'重量', dimensions:'サイズ', notMeasured:'実測待ち', verify:'個別分析', notVerified:'この石の個別分析書は未確認', safety:'現物・安全性・配送情報確認前の決済はできません。', empty:'画像を読み込めません。店舗にお問い合わせください。'}
  };
  function lang() {
    const l = new URL(location.href).searchParams.get('lang') || document.documentElement.lang || 'zh-Hant';
    if (/^zh-(Hans|CN)/i.test(l)) return 'zh-Hans';
    if (/^en/i.test(l)) return 'en';
    if (/^ja/i.test(l)) return 'ja';
    return 'zh-Hant';
  }
  function t(key){ return (i18n[lang()] || i18n['zh-Hant'])[key]; }
  function node(tag, klass, value) {
    const el=document.createElement(tag);
    if(klass) el.className=klass;
    if(value!==undefined) el.textContent=String(value);
    return el;
  }
  function hideOldEmptyState(container) {
    container.querySelectorAll('p,div,span').forEach(el=>{
      if(el.children.length===0 && /尚無已確認的實物商品|尚无已确认的实物商品/.test((el.textContent||'').trim())) el.hidden=true;
    });
  }
  function openDetail(product) {
    let dialog=document.getElementById('xy-lingstone-detail-dialog');
    if(!dialog) {dialog=node('dialog','xy-lingstone-modal');dialog.id='xy-lingstone-detail-dialog'; document.body.append(dialog);}
    dialog.replaceChildren();
    const closer=node('button','xy-lingstone-close',t('close')+' ✕');closer.type='button';closer.addEventListener('click',()=>dialog.close());
    const photo=node('img');photo.src=product.image;photo.alt=product.displayName+' · AI concept';photo.loading='eager';
    const title=node('h2','',product.displayName), price=node('strong','xy-lingstone-price',t('price')+' NT$ '+Number(product.priceTWD).toLocaleString('en-US'));
    const specs=node('dl','xy-lingstone-specs');
    for(const [a,b] of [[t('weight'),t('notMeasured')],[t('dimensions'),t('notMeasured')],[t('verify'),t('notVerified')]]) {
      specs.append(node('dt','',a),node('dd','',b));
    }
    const info=node('div','xy-lingstone-modal-info');info.append(title,price,specs,node('p','xy-lingstone-warning',t('warning')),node('p','xy-lingstone-safe',t('safety')));
    const contact=node('a','xy-lingstone-inquiry',t('inquiry'));
    contact.href='mailto:service@tanxiang.com.tw?subject='+encodeURIComponent('香雲冷香館選石洽詢 '+product.sku+' '+product.displayName);
    info.append(contact);
    const wrapper=node('div','xy-lingstone-modal-grid');wrapper.append(photo,info);dialog.append(closer,wrapper);
    if(typeof dialog.showModal==='function') dialog.showModal();
  }
  function makeCard(product, index){
    const card=node('article','xy-lingstone-card');card.dataset.sku=product.sku;
    const photoWrap=node('div','xy-lingstone-photo');
    const img=node('img');img.src=product.thumb || product.image;img.alt=product.displayName+' AI 風格概念圖';img.loading=index<2?'eager':'lazy'; img.decoding='async';img.width=450;img.height=563;
    img.addEventListener('error',()=>{photoWrap.classList.add('xy-lingstone-broken');const e=node('p','',t('imageError'));photoWrap.append(e);}, {once:true});
    const badge=node('span','xy-lingstone-number',String(index+1).padStart(2,'0'));
    photoWrap.append(img,badge);
    const name=node('h3','',product.displayName),price=node('div','xy-lingstone-price',t('price')+' NT$ '+Number(product.priceTWD).toLocaleString('en-US'));
    const actions=node('div','xy-lingstone-actions');
    const detail=node('button','',t('details'));detail.type='button';detail.addEventListener('click',()=>openDetail(product));
    const ask=node('a','',t('inquiry'));ask.href='mailto:service@tanxiang.com.tw?subject='+encodeURIComponent('香雲冷香館選石洽詢 '+product.sku+' '+product.displayName);
    actions.append(detail,ask);
    const copy=node('div','xy-lingstone-copy');copy.append(name,price,actions);
    card.append(photoWrap,copy);
    return card;
  }
  function attach() {
    const anchor=document.getElementById('catalog');
    if(!anchor || !catalog || !Array.isArray(catalog)) return false;
    if(anchor.contains(document.getElementById(ROOT_ID))) return true;
    const root=node('section','xy-lingstone-gallery');root.id=ROOT_ID;root.dataset.galleryVersion='V4';
    const header=node('header','xy-lingstone-header');header.append(node('span','xy-lingstone-eyebrow',t('eyebrow')),node('h2','',t('title')),node('p','',t('subtitle')));
    const warning=node('p','xy-lingstone-warning',t('warning'));
    const grid=node('div','xy-lingstone-grid');grid.id='xy-lingstone-gallery-grid';
    catalog.forEach((p,i)=>grid.append(makeCard(p,i)));
    root.append(header,grid,warning);
    anchor.prepend(root);hideOldEmptyState(anchor);
    return true;
  }
  function attachRepeatedly(){
    attach();
    const mo=new MutationObserver(()=>{ if(!document.getElementById(ROOT_ID)) attach(); });
    mo.observe(document.body,{subtree:true,childList:true});
    setTimeout(()=>mo.disconnect(),90000);
    window.addEventListener('hashchange',attach);
  }
  async function start() {
    if(busy)return;busy=true;
    try {
      const res=await fetch(DATA_URL,{credentials:'same-origin',cache:'no-cache'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      catalog=await res.json();
      if(!Array.isArray(catalog)||catalog.length!==10)throw new Error('應有10款但取得'+catalog?.length+'款');
      if(new Set(catalog.map(p=>p.sku)).size!==10)throw new Error('SKU重複');
      if(!catalog.every(p=>p.imageType==='AI_CONCEPT_NOT_PRODUCT_PHOTO' && p.saleEnabled===false))throw new Error('未驗證項目不得收款');
      attachRepeatedly();
      console.info('[lingstone-gallery] 10款概念圖片來源已載入；等待圖片實際呈現驗收');
    } catch(e) {console.error('[lingstone-gallery] 無法顯示十款圖片:',e);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
