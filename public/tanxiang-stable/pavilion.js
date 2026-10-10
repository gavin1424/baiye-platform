'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const titles = ['天然油線紋路','結香部位','琥珀色內核','自然裂紋肌理','木質細膩紋理','側面天然紋理'];
  // Real multi-angle photos can be attached here once provenance is verified.
  const collection = { views: [], model: null, provenanceVerified: false };
  const dialog = $('.viewer'), stage = $('#viewer-stage'), picture = $('#viewer-image');
  let current = 0, hero = false, scale = 1, x = 0, y = 0, opener, start, pinchDistance = 0, pinchScale = 1;
  const pointers = new Map();
  function paint() {
    const box = stage.getBoundingClientRect();
    // Keep pan bounds finite before an uncached image has decoded.
    const ratio = picture.naturalWidth && picture.naturalHeight ? picture.naturalWidth / picture.naturalHeight : 1.5;
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    const width = Math.min(box.width, box.height * ratio), height = width / ratio;
    const maxX = Math.max(0, (width * scale - box.width) / 2), maxY = Math.max(0, (height * scale - box.height) / 2);
    x = Math.max(-maxX, Math.min(maxX, x)); y = Math.max(-maxY, Math.min(maxY, y));
    picture.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    $('#zoom-value').value = Math.round(scale * 100) + '%';
    $('#zoom-out').disabled = scale <= 1; $('#zoom-in').disabled = scale >= 4;
  }
  function reset() { scale = 1; x = y = 0; paint(); }
  function render() {
    picture.src = hero ? './assets/concepts/pavilion-large.webp' : `./assets/concepts/detail-${current + 1}-large.webp`;
    picture.alt = 'AI 概念示意，非實物照片：' + (hero ? '大型沉香展示櫃' : titles[current]);
    $('#viewer-title').textContent = hero ? '木之形，香之境' : titles[current];
    $('#viewer-count').textContent = hero ? '單張展示圖' : `${current + 1} / 6`;
    $('#viewer-prev').disabled = hero; $('#viewer-next').disabled = hero;
    reset();
  }
  function next(direction) { if (!hero) { current = (current + direction + titles.length) % titles.length; render(); } }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    opener = button; hero = button.dataset.view === 'hero'; current = hero ? 0 : Number(button.dataset.view);
    dialog.showModal(); document.body.style.overflow = 'hidden'; render(); $('#viewer-close').focus();
  }));
  picture.addEventListener('load', paint);
  $('#viewer-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; pointers.clear(); opener?.focus({preventScroll:true}); });
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  $('#viewer-prev').addEventListener('click', () => next(-1)); $('#viewer-next').addEventListener('click', () => next(1));
  function zoom(delta) { scale = Math.max(1,Math.min(4,scale + delta)); paint(); }
  $('#zoom-in').addEventListener('click', () => zoom(.5)); $('#zoom-out').addEventListener('click', () => zoom(-.5)); $('#zoom-reset').addEventListener('click', reset);
  stage.addEventListener('dblclick', () => scale === 1 ? zoom(1) : reset());
  stage.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? .15 : -.15); }, {passive:false});
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size === 1) start = {x:e.clientX,y:e.clientY,dx:x,dy:y};
    if(pointers.size === 2) { const p = [...pointers.values()]; pinchDistance = Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y); pinchScale = scale; }
  });
  stage.addEventListener('pointermove', e => {
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size === 2) { const p = [...pointers.values()]; scale = Math.max(1,Math.min(4,pinchScale*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/(pinchDistance||1))); paint(); }
    else if(start && scale > 1) { x=start.dx+e.clientX-start.x; y=start.dy+e.clientY-start.y; paint(); }
  });
  function endPointer(e) {
    if(pointers.size===1 && start && scale===1 && e.type!=='pointercancel') { const dx=e.clientX-start.x,dy=e.clientY-start.y; if(Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)) next(dx<0?1:-1); }
    pointers.delete(e.pointerId); start=null;
    if(pointers.size===1){const p=[...pointers.values()][0];start={x:p.x,y:p.y,dx:x,dy:y};}
  }
  stage.addEventListener('pointerup',endPointer);stage.addEventListener('pointercancel',endPointer);
  dialog.addEventListener('keydown', e => {
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      e.preventDefault();
      if(scale===1){if(e.key==='ArrowLeft')next(-1);if(e.key==='ArrowRight')next(1);}
      else {if(e.key==='ArrowLeft')x+=45;if(e.key==='ArrowRight')x-=45;if(e.key==='ArrowUp')y+=45;if(e.key==='ArrowDown')y-=45;paint();}
    }
    if(e.key==='+'||e.key==='=')zoom(.5);if(e.key==='-')zoom(-.5);if(e.key==='0')reset();
  });
  window.addEventListener('resize', () => {if(dialog.open)paint();});
  $('.mobile-menu').querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>$('.mobile-menu').open=false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('.mobile-menu').open=false;});
  document.addEventListener('click',e=>{if(!$('.mobile-menu').contains(e.target))$('.mobile-menu').open=false;});
  $('#copy-email').addEventListener('click',async()=>{
    try {await navigator.clipboard.writeText('service@tanxiang.com.tw');$('#contact-status').textContent='已複製客服信箱，可貼至您的郵件程式。';}
    catch {$('#contact-status').textContent='請選取並複製上方信箱：service@tanxiang.com.tw';}
  });
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  if('IntersectionObserver' in window && !reduced.matches){
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.remove('pending');io.unobserve(entry.target);}}),{threshold:.06});
    document.querySelectorAll('.reveal').forEach(el=>{if(el.getBoundingClientRect().top>window.innerHeight){el.classList.add('pending');io.observe(el);}});
    reduced.addEventListener('change',()=>{if(reduced.matches){document.querySelectorAll('.pending').forEach(el=>el.classList.remove('pending'));io.disconnect();}});
  }
})();
