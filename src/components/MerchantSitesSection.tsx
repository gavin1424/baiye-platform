import { ArrowRight, ArrowUpRight, CrownSimple, GlobeHemisphereWest, Handshake, Heart, LinkSimple, Sparkle } from "@phosphor-icons/react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { getActiveMerchantSites, type MerchantSite } from "../data/merchantSites";
import "../home-merchant-sites.css";

const merchantSiteHighlights = [
  { icon: CrownSimple, title: "精選優質商家", text: "真實品牌・安心選擇" },
  { icon: GlobeHemisphereWest, title: "多元產業領域", text: "一站探索・拓展視野" },
  { icon: Heart, title: "連結美好未來", text: "好的品牌・創造更好的生活" },
];

export function MerchantSitesSection() {
  const isDirectoryPage = useLocation().pathname === "/merchant-sites";
  useEffect(() => {
    const section = document.getElementById("merchant-sites-section");
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      document.body.classList.toggle("merchant-sites-in-view", entry.isIntersecting);
    });
    observer.observe(section);
    return () => {
      observer.disconnect();
      document.body.classList.remove("merchant-sites-in-view");
    };
  }, []);
  const sites = getActiveMerchantSites();
  const featured = sites.find((site) => site.featured);
  const otherSites = sites.filter((site) => site.id !== featured?.id);
  return <section className="home-merchant-sites" id="merchant-sites-section" aria-labelledby="merchant-sites-title">
    <div className="merchant-sites-hero">
      <div className="merchant-sites-ambient" aria-hidden="true"><i /><i /><i /></div>
      <div className="merchant-sites-inner">
        <header className="merchant-sites-heading">
          <span className="merchant-sites-kicker"><Sparkle weight="fill" /> CURATED BUSINESS WEBSITES</span>
          <h2 id="merchant-sites-title">商家網站專區</h2>
          <p>快速瀏覽不同產業的官方介紹網站</p>
        </header>
        <div className="merchant-sites-highlights" aria-label="商家網站專區特色">
          {merchantSiteHighlights.map(({ icon: Icon, title, text }) => <article key={title}>
            <span><Icon weight="duotone" /></span>
            <div><strong>{title}</strong><small>{text}</small></div>
          </article>)}
        </div>
      </div>
    </div>

    <div className="merchant-sites-content">
      {featured && <a className="merchant-featured-card" href={featured.url} target="_blank" rel="noopener noreferrer" aria-label={`前往${featured.name}官方網站（另開新分頁）`}>
        <div className="merchant-featured-copy">
          <span className="merchant-featured-label"><CrownSimple weight="fill" /> 精選商家網站</span>
          <p className="merchant-featured-eyebrow">{featured.category}</p>
          <h3>{featured.name}</h3>
          <p>{featured.description}</p>
          <div className="merchant-site-tags">{featured.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="merchant-featured-actions">
            <span className="merchant-site-button">立即前往 <ArrowUpRight weight="bold" /></span>
            <span className="merchant-official-link"><LinkSimple weight="bold" /> 官方網站</span>
          </div>
        </div>
        <div className="merchant-featured-visual"><img src={featured.image} alt={`${featured.shortName}官方網站首頁預覽`} width="1440" height="900" loading="lazy" decoding="async" /></div>
        <span className="merchant-featured-badge"><CrownSimple weight="fill" />推薦精選</span>
      </a>}

      <div className="merchant-sites-list-heading" id="merchant-sites-list">
        <h3>更多精選商家網站</h3>
        <p>探索更多優質品牌・發現不同產業的精彩價值</p>
      </div>

      <div className="merchant-sites-grid">
        {otherSites.map((site) => <MerchantSiteCard key={site.id} site={site} />)}
      </div>

      <aside className="merchant-sites-cta">
        <span className="merchant-cta-icon"><Handshake weight="duotone" /></span>
        <div><h3>串聯百工・連結更大的世界</h3><p>在創百業智慧鏈，看見更多優質商家，一起創造共好、共贏、共榮的數位未來。</p></div>
        {isDirectoryPage
          ? <a href="#merchant-sites-list">探索更多商家 <ArrowRight weight="bold" /></a>
          : <Link to="/merchant-sites">前往商家網站專區 <ArrowRight weight="bold" /></Link>}
      </aside>
    </div>
  </section>;
}

function MerchantSiteCard({ site }: { site: MerchantSite }) {
  return <a className="merchant-site-card" href={site.url} target="_blank" rel="noopener noreferrer" aria-label={`前往${site.name}官方網站（另開新分頁）`}>
    <div className="merchant-site-visual">
      <img src={site.image} alt={`${site.shortName}官方網站首頁預覽`} width="1440" height="900" loading="lazy" decoding="async" />
      <span className="merchant-card-official"><LinkSimple weight="bold" /> 官方網站</span>
    </div>
    <div className="merchant-site-card-copy">
      <h3>{site.name}</h3>
      <p>{site.description}</p>
      <div className="merchant-site-tags">{site.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <span className="merchant-site-button">立即前往 <ArrowUpRight weight="bold" /></span>
    </div>
  </a>;
}

