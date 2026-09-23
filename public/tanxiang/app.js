document.addEventListener("DOMContentLoaded", () => {
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const cart = new Map();
  const drawer = q("#drawer");
  const scrim = q("#scrim");
  const nav = q("nav");
  const menuBtn = q(".menubtn");

  const money = n => "NT$ " + Number(n).toLocaleString("zh-TW");

  function toast(msg){
    const t=q("#toast");
    if(!t) return;
    t.textContent=msg;
    t.classList.add("show");
    clearTimeout(window.__tanxiangToast);
    window.__tanxiangToast=setTimeout(()=>t.classList.remove("show"),1800);
  }
  function openCart(){
    if(!drawer || !scrim) return;
    drawer.classList.add("open");
    scrim.classList.add("show");
    document.body.classList.add("lock");
  }
  function closeCart(){
    if(!drawer || !scrim) return;
    drawer.classList.remove("open");
    scrim.classList.remove("show");
    document.body.classList.remove("lock");
  }
  function render(){
    let count=0,total=0;
    for(const v of cart.values()){ count+=v.qty; total+=v.qty*v.price; }
    const countEl=q("#count"), totalEl=q("#total"), items=q("#items");
    if(countEl) countEl.textContent=count;
    if(totalEl) totalEl.textContent=money(total);
    if(!items) return;
    items.innerHTML=count
      ? [...cart.entries()].map(([id,v]) =>
        '<div class="row"><div><p><strong>'+v.name+'</strong></p><small>'+money(v.price)+' × '+v.qty+'</small></div><button type="button" data-r="'+id+'">移除</button></div>'
      ).join("")
      : "<p>購物車目前是空的。</p>";
    qa("[data-r]", items).forEach(b => b.addEventListener("click", () => {
      cart.delete(b.dataset.r); render();
    }));
  }

  if(menuBtn && nav){
    menuBtn.setAttribute("aria-expanded","false");
    menuBtn.addEventListener("click", () => {
      const open=nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    qa("a", nav).forEach(a => a.addEventListener("click", () => {
      nav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded","false");
    }));
  }

  qa(".add").forEach(b => b.addEventListener("click", e => {
    const card=e.currentTarget.closest(".card");
    if(!card) return;
    const id=card.dataset.id;
    const v=cart.get(id) || {name:card.dataset.name, price:Number(card.dataset.price), qty:0};
    v.qty++;
    cart.set(id,v);
    render();
    toast("已加入：" + v.name);
  }));

  q("#cartBtn")?.addEventListener("click", openCart);
  q("#close")?.addEventListener("click", closeCart);
  scrim?.addEventListener("click", closeCart);
  q("#checkout")?.addEventListener("click", () => toast("目前為網站展示版，可再串接正式金流與訂單系統。"));
  document.addEventListener("keydown", e => { if(e.key==="Escape"){ closeCart(); nav?.classList.remove("open"); }});
  render();
});