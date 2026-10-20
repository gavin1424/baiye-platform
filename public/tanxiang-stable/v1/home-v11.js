// Presentation only: product, account, analysis and commerce APIs remain unchanged.
// The public API only returns media reviewed as real; retain compatibility with V1's DTO.
export function verifiedPhoto(product){return product?.media?.find(m=>m.kind==='photo'&&(m.verified_real===undefined||Number(m.verified_real)===1)&&/^https:\/\//.test(m.url));}
export function heroArtwork(product,{t,esc}){
 const photo=verifiedPhoto(product);
 if(!photo)return `<figure class="hero-art hero-landscape" aria-hidden="true"><picture><source type="image/webp" srcset="./assets/heritage-mountains-480.webp 480w, ./assets/heritage-mountains-768.webp 768w, ./assets/heritage-mountains-1536.webp 1536w" sizes="100vw"><img src="./assets/heritage-mountains-1536.webp" width="1536" height="1024" alt="" fetchpriority="high" decoding="async"></picture></figure>`;
 return `<figure class="hero-art hero-product"><img src="${esc(photo.url)}" alt="${esc(photo.alt||product.name)}" fetchpriority="high" decoding="async"><figcaption><span>${esc(product.serial)}</span><a href="#product=${encodeURIComponent(product.id)}">${esc(product.name)} ↗</a></figcaption></figure>`;
}
export function saleEligible(p){return p.status==='sale'&&p.safety==='confirmed'&&p.source_status==='confirmed'&&p.compliance==='confirmed'&&p.grade!=='mother'&&p.price_minor>0;}
export function bindMenu({document:doc= document,t}){
 const toggle=doc.getElementById('menu-toggle'),panel=doc.getElementById('site-menu');
 let previousOverflow='';
 const set=open=>{toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',t(open?'closeMenu':'openMenu'));panel.classList.toggle('is-open',open);doc.body.classList.toggle('menu-open',open);if(open){previousOverflow=doc.body.style.overflow;doc.body.style.overflow='hidden'}else doc.body.style.overflow=previousOverflow;};
 toggle.onclick=()=>set(toggle.getAttribute('aria-expanded')!=='true');
 panel.onclick=e=>{if(e.target.closest('a'))set(false)};
 toggle.addEventListener('keydown',e=>{if(e.key==='Escape')set(false)});
 doc.addEventListener('keydown',e=>{if(toggle.getAttribute('aria-expanded')!=='true')return;if(e.key==='Escape'){set(false);toggle.focus()}if(e.key==='Tab'){const nodes=[toggle,...panel.querySelectorAll('a,select,button')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus()}}});
 const media=matchMedia('(min-width:1051px)');media.addEventListener('change',()=>set(false));
 return ()=>set(false);
}
