const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const BLOCK_TYPES = new Set(["hero","text","image","image_text","carousel","button","product_grid","collection_grid","video","facebook_live","map","faq","contact_form","newsletter_form","social_links","html_embed","spacer","divider","testimonials"]);
const VISIBILITY = new Set(["public","hidden","token","password","member"]);
const MIME_TYPES = new Set(["image/jpeg","image/png","image/webp","image/gif","image/svg+xml"]);

async function sha(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(bytes)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
function slug(value) { const result = clean(value, 120).toLowerCase(); return /^[a-z0-9][a-z0-9-]*$/.test(result) ? result : ""; }
function pathValue(value) { const result = clean(value, 300); return /^\/[a-zA-Z0-9/_-]*$/.test(result) ? result : ""; }
function parseJson(value, fallback = {}) { try { return typeof value === "string" ? JSON.parse(value) : (value ?? fallback); } catch { return fallback; } }
function snapshot(page, changes = {}) {
  return {
    title: changes.title ?? page.title, slug: changes.slug ?? page.slug,
    page_type: changes.page_type ?? page.page_type, visibility: changes.visibility ?? page.visibility,
    canonical_url: changes.canonical_url ?? page.canonical_url,
    seo_json: changes.seo_json ?? parseJson(page.seo_json),
    publish_at: changes.publish_at ?? page.publish_at, unpublish_at: changes.unpublish_at ?? page.unpublish_at,
  };
}
function safeSettings(blockType, input) {
  const settings = typeof input === "object" && input ? input : {};
  const encoded = JSON.stringify(settings);
  if (encoded.length > 24000) throw new Error("BLOCK_SETTINGS_TOO_LARGE");
  if (blockType === "html_embed") {
    const html = clean(settings.html, 20000);
    if (/<script\b|\son\w+\s*=|javascript:|data:text\/html/i.test(html)) throw new Error("UNSAFE_HTML_EMBED");
    const iframes = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)/gi)].map((match) => match[1]);
    if (iframes.some((source) => !/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.facebook\.com|maps\.google\.com)\//i.test(source))) throw new Error("UNSAFE_IFRAME_DOMAIN");
  }
  return settings;
}
async function audit(db, merchant, actor, action, entityType, entityId, metadata = {}) {
  return db.prepare("INSERT INTO merchant_cms_audit_logs(id,merchant_id,actor_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)").bind(uid("cmsaudit"), merchant, actor, action, entityType, entityId, JSON.stringify(metadata));
}
async function pageRecord(db, merchant, id) { return db.prepare("SELECT * FROM merchant_site_pages WHERE id=? AND merchant_id=? AND archived_at IS NULL").bind(id, merchant).first(); }
async function latestVersion(db, pageId) { return db.prepare("SELECT * FROM merchant_page_versions WHERE page_id=? ORDER BY version_no DESC LIMIT 1").bind(pageId).first(); }
async function versionBlocks(db, merchant, versionId) { return (await db.prepare("SELECT * FROM merchant_page_blocks WHERE merchant_id=? AND version_id=? ORDER BY sort_order,id").bind(merchant, versionId).all()).results || []; }

async function appendVersion(db, merchant, page, actor, changes = {}, transform = (items) => items, note = "內容更新") {
  const previous = await latestVersion(db, page.id);
  const blocks = previous ? await versionBlocks(db, merchant, previous.id) : [];
  const nextBlocks = transform(blocks.map((item) => ({ ...item, settings_json: parseJson(item.settings_json) })));
  const nextSnapshot = snapshot(page, changes);
  const id = uid("pagever"); const versionNo = Number(previous?.version_no || 0) + 1;
  const statements = [
    db.prepare("INSERT INTO merchant_page_versions(id,merchant_id,page_id,version_no,content_hash,created_by,page_snapshot_json,version_note) VALUES(?,?,?,?,?,?,?,?)").bind(id, merchant, page.id, versionNo, await sha(JSON.stringify({ page: nextSnapshot, blocks: nextBlocks })), actor, JSON.stringify(nextSnapshot), clean(note, 200)),
    ...nextBlocks.map((block, index) => db.prepare("INSERT INTO merchant_page_blocks(id,merchant_id,page_id,version_id,block_type,sort_order,settings_json) VALUES(?,?,?,?,?,?,?)").bind(uid("block"), merchant, page.id, id, block.block_type, index, JSON.stringify(block.settings_json))),
    db.prepare("UPDATE merchant_site_pages SET title=?,slug=?,page_type=?,visibility=?,canonical_url=?,seo_json=?,publish_at=?,unpublish_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(nextSnapshot.title, nextSnapshot.slug, nextSnapshot.page_type, nextSnapshot.visibility, nextSnapshot.canonical_url || null, JSON.stringify(nextSnapshot.seo_json || {}), nextSnapshot.publish_at || null, nextSnapshot.unpublish_at || null, page.id, merchant),
    await audit(db, merchant, actor, "page.version_created", "page", page.id, { version_no: versionNo, note: clean(note, 200) }),
  ];
  await db.batch(statements);
  return { id, version_no: versionNo };
}

function pagePayload(page, version, blocks, versions = []) {
  return { ...page, seo: parseJson(page.seo_json), version, blocks: blocks.map((block) => ({ ...block, settings: parseJson(block.settings_json) })), versions };
}

async function publicCms(request, env, url, cors) {
  const db = env.FINANCE_DB;
  const preview = url.pathname.match(/^\/api\/commerce\/public\/site-previews\/([^/]+)$/);
  if (preview && request.method === "GET") {
    const access = await db.prepare("SELECT * FROM merchant_page_access_tokens WHERE token_hash=? AND token_type='preview' AND revoked_at IS NULL AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(await sha(preview[1])).first();
    if (!access) return json({ error: "PREVIEW_EXPIRED" }, 404, cors);
    const page = await pageRecord(db, access.merchant_id, access.page_id); const version = page && await latestVersion(db, page.id);
    if (!page || !version) return json({ error: "Not found" }, 404, cors);
    return json(pagePayload(page, version, await versionBlocks(db, access.merchant_id, version.id)), 200, cors);
  }
  const pageMatch = url.pathname.match(/^\/api\/commerce\/public\/sites\/([^/]+)\/pages\/([^/]+)$/);
  if (pageMatch && request.method === "GET") {
    const merchant = clean(pageMatch[1], 100); const pageSlug = slug(pageMatch[2]);
    const page = await db.prepare("SELECT * FROM merchant_site_pages WHERE merchant_id=? AND slug=? AND status='published' AND archived_at IS NULL AND (publish_at IS NULL OR datetime(publish_at)<=datetime('now')) AND (unpublish_at IS NULL OR datetime(unpublish_at)>datetime('now'))").bind(merchant, pageSlug).first();
    if (!page || page.visibility === "hidden") return json({ error: "Not found" }, 404, cors);
    if (page.visibility === "member") return json({ error: "MEMBER_REQUIRED" }, 401, cors);
    if (["token","password"].includes(page.visibility)) {
      const token = request.headers.get("x-page-access") || "";
      const access = token && await db.prepare("SELECT id FROM merchant_page_access_tokens WHERE merchant_id=? AND page_id=? AND token_type=? AND token_hash=? AND revoked_at IS NULL").bind(merchant, page.id, page.visibility === "password" ? "password" : "page_access", await sha(token)).first();
      if (!access) return json({ error: "PAGE_ACCESS_REQUIRED" }, 401, cors);
    }
    const publication = await db.prepare("SELECT v.* FROM merchant_site_publications p JOIN merchant_page_versions v ON v.id=p.version_id WHERE p.merchant_id=? AND p.page_id=? AND datetime(p.published_at)<=datetime('now') AND (p.unpublished_at IS NULL OR datetime(p.unpublished_at)>datetime('now')) ORDER BY p.published_at DESC LIMIT 1").bind(merchant, page.id).first();
    if (!publication) return json({ error: "Not found" }, 404, cors);
    return json(pagePayload(page, publication, await versionBlocks(db, merchant, publication.id)), 200, { ...cors, "cache-control": "public,max-age=60" });
  }
  const sitemap = url.pathname.match(/^\/api\/commerce\/public\/sites\/([^/]+)\/sitemap\.xml$/);
  if (sitemap && request.method === "GET") {
    const pages = (await db.prepare("SELECT slug,canonical_url,updated_at FROM merchant_site_pages WHERE merchant_id=? AND status='published' AND visibility='public' AND archived_at IS NULL").bind(clean(sitemap[1], 100)).all()).results || [];
    const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((page) => `<url><loc>${page.canonical_url || `https://baiyeconnect.com/#/store/${sitemap[1]}/${page.slug}`}</loc><lastmod>${page.updated_at}</lastmod></url>`).join("")}</urlset>`;
    return new Response(body, { headers: { ...cors, "content-type": "application/xml; charset=UTF-8" } });
  }
  const robots = url.pathname.match(/^\/api\/commerce\/public\/sites\/([^/]+)\/robots\.txt$/);
  if (robots && request.method === "GET") {
    const seo = await db.prepare("SELECT robots FROM merchant_seo_settings WHERE merchant_id=?").bind(clean(robots[1], 100)).first();
    return new Response((seo?.robots || "noindex,nofollow").includes("noindex") ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n", { headers: { ...cors, "content-type": "text/plain; charset=UTF-8" } });
  }
  return null;
}

export async function handleCms(request, env, url, cors = {}, session = null) {
  const publicResponse = url.pathname.startsWith("/api/commerce/public/") ? await publicCms(request, env, url, cors) : null;
  if (publicResponse) return publicResponse;
  if (!/^\/api\/commerce\/(site|pages|navigation|media|redirects|domains|seo|cms-audit)(?:\/|$)/.test(url.pathname)) return null;
  if (!session) return json({ error: "UNAUTHENTICATED" }, 401, cors);
  const db = env.FINANCE_DB; const merchant = session.merchant_id; const actor = session.user_id;
  try {
    if (url.pathname === "/api/commerce/site" && request.method === "GET") {
      const site = await db.prepare("SELECT * FROM merchant_sites WHERE merchant_id=?").bind(merchant).first();
      return json({ ...site, theme: parseJson(site?.theme_json), header: parseJson(site?.header_json), footer: parseJson(site?.footer_json) }, 200, cors);
    }
    if (url.pathname === "/api/commerce/site" && request.method === "PATCH") {
      const body = await request.json(); const name = clean(body.name, 160); if (!name) return json({ error: "SITE_NAME_REQUIRED" }, 400, cors);
      const result = await db.batch([db.prepare("UPDATE merchant_sites SET name=?,theme_json=?,header_json=?,footer_json=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?").bind(name, JSON.stringify(body.theme || {}), JSON.stringify(body.header || {}), JSON.stringify(body.footer || {}), merchant), await audit(db, merchant, actor, "site.updated", "site", merchant)]);
      return json({ ok: true, changes: result[0]?.meta?.changes || 0 }, 200, cors);
    }
    if (url.pathname === "/api/commerce/pages" && request.method === "GET") {
      const items = (await db.prepare("SELECT p.*,(SELECT MAX(version_no) FROM merchant_page_versions WHERE page_id=p.id) current_version,(SELECT COUNT(*) FROM merchant_page_blocks b JOIN merchant_page_versions v ON v.id=b.version_id WHERE v.page_id=p.id AND v.version_no=(SELECT MAX(version_no) FROM merchant_page_versions WHERE page_id=p.id)) block_count FROM merchant_site_pages p WHERE p.merchant_id=? AND p.archived_at IS NULL ORDER BY p.updated_at DESC").bind(merchant).all()).results || [];
      return json({ items }, 200, cors);
    }
    if (url.pathname === "/api/commerce/pages" && request.method === "POST") {
      const body = await request.json(); const title = clean(body.title, 160); const pageSlug = slug(body.slug); const site = await db.prepare("SELECT id FROM merchant_sites WHERE merchant_id=?").bind(merchant).first();
      if (!site || !title || !pageSlug) return json({ error: "INVALID_PAGE" }, 400, cors);
      const id = uid("page"); const versionId = uid("pagever"); const initial = { title, slug: pageSlug, page_type: clean(body.page_type, 30) || "standard", visibility: "public", canonical_url: null, seo_json: {}, publish_at: null, unpublish_at: null };
      await db.batch([db.prepare("INSERT INTO merchant_site_pages(id,merchant_id,site_id,slug,title,page_type,status) VALUES(?,?,?,?,?,?,'draft')").bind(id, merchant, site.id, pageSlug, title, initial.page_type), db.prepare("INSERT INTO merchant_page_versions(id,merchant_id,page_id,version_no,content_hash,created_by,page_snapshot_json,version_note) VALUES(?,?,?,?,?,?,?,?)").bind(versionId, merchant, id, 1, await sha(JSON.stringify(initial)), actor, JSON.stringify(initial), "建立頁面"), await audit(db, merchant, actor, "page.created", "page", id)]);
      return json({ id, version_id: versionId, status: "draft" }, 201, cors);
    }
    const pageMatch = url.pathname.match(/^\/api\/commerce\/pages\/([^/]+)$/);
    if (pageMatch && request.method === "GET") {
      const page = await pageRecord(db, merchant, pageMatch[1]); if (!page) return json({ error: "Not found" }, 404, cors);
      const version = await latestVersion(db, page.id); const versions = (await db.prepare("SELECT id,version_no,content_hash,version_note,created_by,created_at FROM merchant_page_versions WHERE merchant_id=? AND page_id=? ORDER BY version_no DESC").bind(merchant, page.id).all()).results || [];
      return json(pagePayload(page, version, version ? await versionBlocks(db, merchant, version.id) : [], versions), 200, cors);
    }
    if (pageMatch && request.method === "PATCH") {
      const page = await pageRecord(db, merchant, pageMatch[1]); if (!page) return json({ error: "Not found" }, 404, cors); const body = await request.json();
      const changes = { title: clean(body.title, 160) || page.title, slug: body.slug === undefined ? page.slug : slug(body.slug), page_type: clean(body.page_type, 30) || page.page_type, visibility: VISIBILITY.has(body.visibility) ? body.visibility : page.visibility, canonical_url: clean(body.canonical_url, 500) || null, seo_json: body.seo || parseJson(page.seo_json), publish_at: body.publish_at || null, unpublish_at: body.unpublish_at || null };
      if (!changes.slug || (changes.canonical_url && !/^https:\/\//.test(changes.canonical_url))) return json({ error: "INVALID_PAGE_SETTINGS" }, 400, cors);
      const version = await appendVersion(db, merchant, page, actor, changes, (blocks) => blocks, body.version_note || "頁面設定更新");
      return json({ ok: true, version }, 200, cors);
    }
    if (pageMatch && request.method === "DELETE") {
      const page = await pageRecord(db, merchant, pageMatch[1]); if (!page) return json({ error: "Not found" }, 404, cors);
      const published = await db.prepare("SELECT id FROM merchant_site_publications WHERE merchant_id=? AND page_id=? LIMIT 1").bind(merchant, page.id).first();
      if (published) return json({ error: "PUBLISHED_PAGE_CANNOT_BE_DELETED" }, 409, cors);
      const versions = (await db.prepare("SELECT id FROM merchant_page_versions WHERE merchant_id=? AND page_id=?").bind(merchant, page.id).all()).results || [];
      await db.batch([...versions.map((version) => db.prepare("DELETE FROM merchant_page_blocks WHERE merchant_id=? AND version_id=?").bind(merchant, version.id)), db.prepare("DELETE FROM merchant_page_versions WHERE merchant_id=? AND page_id=?").bind(merchant, page.id), db.prepare("DELETE FROM merchant_site_pages WHERE merchant_id=? AND id=?").bind(merchant, page.id), await audit(db, merchant, actor, "page.deleted", "page", page.id)]);
      return json({ ok: true }, 200, cors);
    }
    const pageAction = url.pathname.match(/^\/api\/commerce\/pages\/([^/]+)\/(copy|archive|publish|unpublish|preview-token)$/);
    if (pageAction && request.method === "POST") {
      const page = await pageRecord(db, merchant, pageAction[1]); if (!page) return json({ error: "Not found" }, 404, cors); const action = pageAction[2]; const body = await request.json().catch(() => ({}));
      if (action === "copy") {
        const copySlug = slug(body.slug || `${page.slug}-copy`); if (!copySlug) return json({ error: "INVALID_SLUG" }, 400, cors); const id = uid("page"); const versionId = uid("pagever"); const current = await latestVersion(db, page.id); const blocks = current ? await versionBlocks(db, merchant, current.id) : []; const copySnapshot = { ...snapshot(page), title: clean(body.title, 160) || `${page.title} 副本`, slug: copySlug, publish_at: null, unpublish_at: null };
        await db.batch([db.prepare("INSERT INTO merchant_site_pages(id,merchant_id,site_id,slug,title,page_type,status,visibility,canonical_url,seo_json) VALUES(?,?,?,?,?,?,'draft',?,?,?)").bind(id, merchant, page.site_id, copySlug, copySnapshot.title, page.page_type, page.visibility, null, JSON.stringify(copySnapshot.seo_json)), db.prepare("INSERT INTO merchant_page_versions(id,merchant_id,page_id,version_no,content_hash,created_by,page_snapshot_json,version_note) VALUES(?,?,?,?,?,?,?,?)").bind(versionId, merchant, id, 1, await sha(JSON.stringify({ copySnapshot, blocks })), actor, JSON.stringify(copySnapshot), "複製頁面"), ...blocks.map((block, index) => db.prepare("INSERT INTO merchant_page_blocks(id,merchant_id,page_id,version_id,block_type,sort_order,settings_json) VALUES(?,?,?,?,?,?,?)").bind(uid("block"), merchant, id, versionId, block.block_type, index, block.settings_json)), await audit(db, merchant, actor, "page.copied", "page", id, { source_page_id: page.id })]);
        return json({ id }, 201, cors);
      }
      if (action === "archive") { await db.batch([db.prepare("UPDATE merchant_site_pages SET status='archived',archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(page.id, merchant), await audit(db, merchant, actor, "page.archived", "page", page.id)]); return json({ ok: true }, 200, cors); }
      if (action === "preview-token") { const token = crypto.randomUUID()+crypto.randomUUID(); await db.batch([db.prepare("UPDATE merchant_page_access_tokens SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND page_id=? AND token_type='preview' AND revoked_at IS NULL").bind(merchant, page.id), db.prepare("INSERT INTO merchant_page_access_tokens(id,merchant_id,page_id,token_hash,token_type,expires_at,created_by) VALUES(?,?,?,?,'preview',datetime('now','+2 hours'),?)").bind(uid("access"), merchant, page.id, await sha(token), actor), await audit(db, merchant, actor, "page.preview_token_created", "page", page.id)]); return json({ token, expires_in: 7200 }, 201, cors); }
      if (action === "unpublish") { await db.batch([db.prepare("UPDATE merchant_site_pages SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(page.id, merchant), db.prepare("UPDATE merchant_site_publications SET unpublished_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND page_id=? AND unpublished_at IS NULL").bind(merchant, page.id), await audit(db, merchant, actor, "page.unpublished", "page", page.id)]); return json({ ok: true }, 200, cors); }
      const version = await latestVersion(db, page.id); if (!version) return json({ error: "VERSION_REQUIRED" }, 409, cors); const publishAt = body.publish_at || new Date().toISOString(); const unpublishAt = body.unpublish_at || null; if (unpublishAt && new Date(unpublishAt) <= new Date(publishAt)) return json({ error: "INVALID_SCHEDULE" }, 400, cors);
      await db.batch([db.prepare("UPDATE merchant_site_pages SET status=?,publish_at=?,unpublish_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(new Date(publishAt)>new Date() ? "scheduled" : "published", publishAt, unpublishAt, page.id, merchant), db.prepare("INSERT INTO merchant_site_publications(id,merchant_id,page_id,version_id,published_at,unpublished_at,created_by) VALUES(?,?,?,?,?,?,?)").bind(uid("publication"), merchant, page.id, version.id, publishAt, unpublishAt, actor), await audit(db, merchant, actor, "page.published", "page", page.id, { version_id: version.id, publish_at: publishAt, unpublish_at: unpublishAt })]); return json({ ok: true, version_id: version.id }, 200, cors);
    }
    const rollback = url.pathname.match(/^\/api\/commerce\/pages\/([^/]+)\/versions\/([^/]+)\/rollback$/);
    if (rollback && request.method === "POST") {
      const page = await pageRecord(db, merchant, rollback[1]); const version = await db.prepare("SELECT * FROM merchant_page_versions WHERE id=? AND page_id=? AND merchant_id=?").bind(rollback[2], rollback[1], merchant).first(); if (!page || !version) return json({ error: "Not found" }, 404, cors);
      const oldSnapshot = parseJson(version.page_snapshot_json, snapshot(page)); const oldBlocks = await versionBlocks(db, merchant, version.id); const created = await appendVersion(db, merchant, page, actor, oldSnapshot, () => oldBlocks.map((item) => ({ ...item, settings_json: parseJson(item.settings_json) })), `Rollback v${version.version_no}`); return json({ ok: true, version: created }, 200, cors);
    }
    const blocksCollection = url.pathname.match(/^\/api\/commerce\/pages\/([^/]+)\/blocks$/);
    if (blocksCollection && request.method === "POST") { const page = await pageRecord(db, merchant, blocksCollection[1]); if (!page) return json({ error: "Not found" }, 404, cors); const body = await request.json(); if (!BLOCK_TYPES.has(body.block_type)) return json({ error: "INVALID_BLOCK_TYPE" }, 400, cors); const settings = safeSettings(body.block_type, body.settings); const version = await appendVersion(db, merchant, page, actor, {}, (blocks) => [...blocks, { block_type: body.block_type, settings_json: settings }], "新增區塊"); return json({ ok: true, version }, 201, cors); }
    const blockItem = url.pathname.match(/^\/api\/commerce\/pages\/([^/]+)\/blocks\/([^/]+)$/);
    if (blockItem && ["PATCH","DELETE"].includes(request.method)) { const page = await pageRecord(db, merchant, blockItem[1]); if (!page) return json({ error: "Not found" }, 404, cors); const body = request.method === "PATCH" ? await request.json() : {}; const version = await appendVersion(db, merchant, page, actor, {}, (blocks) => { const found = blocks.some((block) => block.id === blockItem[2]); if (!found) throw new Error("BLOCK_NOT_FOUND"); if (request.method === "DELETE") return blocks.filter((block) => block.id !== blockItem[2]); return blocks.map((block) => block.id === blockItem[2] ? { ...block, block_type: BLOCK_TYPES.has(body.block_type) ? body.block_type : block.block_type, settings_json: safeSettings(BLOCK_TYPES.has(body.block_type) ? body.block_type : block.block_type, body.settings) } : block); }, request.method === "DELETE" ? "刪除區塊" : "修改區塊"); return json({ ok: true, version }, 200, cors); }
    const reorder = url.pathname.match(/^\/api\/commerce\/pages\/([^/]+)\/blocks\/reorder$/);
    if (reorder && request.method === "POST") { const page = await pageRecord(db, merchant, reorder[1]); if (!page) return json({ error: "Not found" }, 404, cors); const body = await request.json(); if (!Array.isArray(body.ids)) return json({ error: "INVALID_ORDER" }, 400, cors); const version = await appendVersion(db, merchant, page, actor, {}, (blocks) => { if (body.ids.length !== blocks.length || new Set(body.ids).size !== blocks.length || blocks.some((block) => !body.ids.includes(block.id))) throw new Error("INVALID_ORDER"); return body.ids.map((id) => blocks.find((block) => block.id === id)); }, "區塊排序"); return json({ ok: true, version }, 200, cors); }
    if (url.pathname === "/api/commerce/navigation/menus" && request.method === "GET") { const menus = (await db.prepare("SELECT * FROM merchant_navigation_menus WHERE merchant_id=? ORDER BY location").bind(merchant).all()).results || []; const items = (await db.prepare("SELECT i.* FROM merchant_navigation_items i JOIN merchant_navigation_menus m ON m.id=i.menu_id WHERE i.merchant_id=? AND m.merchant_id=? ORDER BY i.menu_id,i.sort_order").bind(merchant,merchant).all()).results || []; return json({ items: menus.map((menu) => ({ ...menu, items: items.filter((item) => item.menu_id === menu.id) })) }, 200, cors); }
    if (url.pathname === "/api/commerce/navigation/menus" && request.method === "POST") { const body=await request.json(); const name=clean(body.name,120),location=clean(body.location,40); if(!name||!location)return json({error:"INVALID_MENU"},400,cors); const id=uid("menu"); await db.batch([db.prepare("INSERT INTO merchant_navigation_menus(id,merchant_id,name,location) VALUES(?,?,?,?)").bind(id,merchant,name,location),await audit(db,merchant,actor,"navigation.menu_created","menu",id)]); return json({id},201,cors); }
    const menuItem=url.pathname.match(/^\/api\/commerce\/navigation\/menus\/([^/]+)\/items$/);
    if(menuItem&&request.method==="POST"){const menu=await db.prepare("SELECT id FROM merchant_navigation_menus WHERE id=? AND merchant_id=?").bind(menuItem[1],merchant).first();if(!menu)return json({error:"Not found"},404,cors);const body=await request.json();const label=clean(body.label,100),target=pathValue(body.target);if(!label||!target)return json({error:"INVALID_NAVIGATION_ITEM"},400,cors);const id=uid("navitem");await db.batch([db.prepare("INSERT INTO merchant_navigation_items(id,merchant_id,menu_id,kind,label,target,sort_order,enabled) VALUES(?,?,?,?,?,?,?,?)").bind(id,merchant,menu.id,clean(body.kind,20)||"page",label,target,Number(body.sort_order)||0,body.enabled?1:0),await audit(db,merchant,actor,"navigation.item_created","navigation_item",id)]);return json({id},201,cors);}
    const navItem=url.pathname.match(/^\/api\/commerce\/navigation\/items\/([^/]+)$/);
    if(navItem&&request.method==="PATCH"){const body=await request.json();const target=pathValue(body.target);if(!clean(body.label,100)||!target)return json({error:"INVALID_NAVIGATION_ITEM"},400,cors);const result=await db.batch([db.prepare("UPDATE merchant_navigation_items SET label=?,target=?,sort_order=?,enabled=? WHERE id=? AND merchant_id=?").bind(clean(body.label,100),target,Number(body.sort_order)||0,body.enabled?1:0,navItem[1],merchant),await audit(db,merchant,actor,"navigation.item_updated","navigation_item",navItem[1])]);return result[0]?.meta?.changes?json({ok:true},200,cors):json({error:"Not found"},404,cors);}
    if(navItem&&request.method==="DELETE"){await db.batch([db.prepare("DELETE FROM merchant_navigation_items WHERE id=? AND merchant_id=?").bind(navItem[1],merchant),await audit(db,merchant,actor,"navigation.item_deleted","navigation_item",navItem[1])]);return json({ok:true},200,cors);}
    if(url.pathname==="/api/commerce/media"&&request.method==="GET"){const rows=await db.prepare("SELECT * FROM merchant_media_assets WHERE merchant_id=? ORDER BY created_at DESC").bind(merchant).all();return json({items:rows.results||[]},200,cors);}
    if(url.pathname==="/api/commerce/media"&&request.method==="POST"){if(!env.COMMERCE_ASSETS)return json({error:"MEDIA_STORAGE_UNAVAILABLE"},503,cors);const body=await request.json();const mime=clean(body.mime_type,80);if(!MIME_TYPES.has(mime))return json({error:"INVALID_MEDIA_TYPE"},400,cors);let bytes;try{bytes=Uint8Array.from(atob(String(body.base64||"")),char=>char.charCodeAt(0));}catch{return json({error:"INVALID_MEDIA"},400,cors);}if(!bytes.length||bytes.length>5_000_000)return json({error:"INVALID_MEDIA_SIZE"},400,cors);const id=uid("media"),fileName=clean(body.file_name,180)||"asset",key=`commerce/${merchant}/${id}-${fileName.replace(/[^a-zA-Z0-9._-]/g,"-")}`;await env.COMMERCE_ASSETS.put(key,bytes,{httpMetadata:{contentType:mime}});try{await db.batch([db.prepare("INSERT INTO merchant_media_assets(id,merchant_id,object_key,mime_type,alt_text,size_bytes,file_name) VALUES(?,?,?,?,?,?,?)").bind(id,merchant,key,mime,clean(body.alt_text,300),bytes.length,fileName),await audit(db,merchant,actor,"media.uploaded","media",id,{mime_type:mime,size_bytes:bytes.length})]);}catch(error){await env.COMMERCE_ASSETS.delete(key);throw error;}return json({id,object_key:key},201,cors);}
    const media=url.pathname.match(/^\/api\/commerce\/media\/([^/]+)$/);if(media&&request.method==="PATCH"){const body=await request.json();const result=await db.batch([db.prepare("UPDATE merchant_media_assets SET alt_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(clean(body.alt_text,300),media[1],merchant),await audit(db,merchant,actor,"media.updated","media",media[1])]);return result[0]?.meta?.changes?json({ok:true},200,cors):json({error:"Not found"},404,cors);}if(media&&request.method==="DELETE"){const asset=await db.prepare("SELECT object_key FROM merchant_media_assets WHERE id=? AND merchant_id=?").bind(media[1],merchant).first();if(!asset)return json({error:"Not found"},404,cors);if(env.COMMERCE_ASSETS)await env.COMMERCE_ASSETS.delete(asset.object_key);await db.batch([db.prepare("DELETE FROM merchant_media_assets WHERE id=? AND merchant_id=?").bind(media[1],merchant),await audit(db,merchant,actor,"media.deleted","media",media[1])]);return json({ok:true},200,cors);}
    if(url.pathname==="/api/commerce/seo"&&request.method==="GET"){const row=await db.prepare("SELECT * FROM merchant_seo_settings WHERE merchant_id=?").bind(merchant).first();return json(row?{...row,og:parseJson(row.og_json)}:{merchant_id:merchant,robots:"noindex,nofollow",og:{}},200,cors);}if(url.pathname==="/api/commerce/seo"&&request.method==="PATCH"){const body=await request.json();const robots=["index,follow","noindex,nofollow"].includes(body.robots)?body.robots:"noindex,nofollow";await db.batch([db.prepare("INSERT INTO merchant_seo_settings(merchant_id,title_template,description,robots,og_json) VALUES(?,?,?,?,?) ON CONFLICT(merchant_id) DO UPDATE SET title_template=excluded.title_template,description=excluded.description,robots=excluded.robots,og_json=excluded.og_json").bind(merchant,clean(body.title_template,200)||null,clean(body.description,500)||null,robots,JSON.stringify(body.og||{})),await audit(db,merchant,actor,"seo.updated","seo",merchant)]);return json({ok:true},200,cors);}
    if(url.pathname==="/api/commerce/redirects"&&request.method==="GET"){const rows=await db.prepare("SELECT * FROM merchant_redirects WHERE merchant_id=? ORDER BY source_path").bind(merchant).all();return json({items:rows.results||[]},200,cors);}if(url.pathname==="/api/commerce/redirects"&&request.method==="POST"){const body=await request.json(),source=pathValue(body.source_path),target=pathValue(body.target_path),status=Number(body.status_code);if(!source||!target||source===target||![301,302].includes(status))return json({error:"INVALID_REDIRECT"},400,cors);const id=uid("redirect");await db.batch([db.prepare("INSERT INTO merchant_redirects(id,merchant_id,source_path,target_path,status_code,enabled) VALUES(?,?,?,?,?,?)").bind(id,merchant,source,target,status,body.enabled?1:0),await audit(db,merchant,actor,"redirect.created","redirect",id)]);return json({id},201,cors);}const redirect=url.pathname.match(/^\/api\/commerce\/redirects\/([^/]+)$/);if(redirect&&request.method==="DELETE"){await db.batch([db.prepare("DELETE FROM merchant_redirects WHERE id=? AND merchant_id=?").bind(redirect[1],merchant),await audit(db,merchant,actor,"redirect.deleted","redirect",redirect[1])]);return json({ok:true},200,cors);}
    if(url.pathname==="/api/commerce/domains"&&request.method==="GET"){const rows=await db.prepare("SELECT id,merchant_id,hostname,status,dns_target,verified_at,last_checked_at,created_at FROM merchant_domains WHERE merchant_id=? ORDER BY created_at DESC").bind(merchant).all();return json({items:rows.results||[]},200,cors);}if(url.pathname==="/api/commerce/domains"&&request.method==="POST"){const body=await request.json(),hostname=clean(body.hostname,253).toLowerCase();if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname))return json({error:"INVALID_HOSTNAME"},400,cors);const token=crypto.randomUUID()+crypto.randomUUID(),id=uid("domain");await db.batch([db.prepare("INSERT INTO merchant_domains(id,merchant_id,hostname,status,verification_token_hash,dns_target) VALUES(?,?,?,'pending',?,?)").bind(id,merchant,hostname,await sha(token),`domains.baiyeconnect.com`),await audit(db,merchant,actor,"domain.created","domain",id,{hostname})]);return json({id,verification_token:token,dns_target:"domains.baiyeconnect.com"},201,cors);}const verify=url.pathname.match(/^\/api\/commerce\/domains\/([^/]+)\/verify$/);if(verify&&request.method==="POST"){const domain=await db.prepare("SELECT * FROM merchant_domains WHERE id=? AND merchant_id=?").bind(verify[1],merchant).first();if(!domain)return json({error:"Not found"},404,cors);let verified=false;try{const response=await fetch(`https://${domain.hostname}/.well-known/baiye-domain-verification.txt`,{headers:{accept:"text/plain"}});const proof=clean(await response.text(),200);verified=response.ok&&await sha(proof)===domain.verification_token_hash;}catch{}await db.batch([db.prepare("UPDATE merchant_domains SET status=?,verified_at=?,last_checked_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(verified?"verified":"pending",verified?new Date().toISOString():null,domain.id,merchant),await audit(db,merchant,actor,verified?"domain.verified":"domain.verification_failed","domain",domain.id)]);return json({verified,status:verified?"verified":"pending"},verified?200:409,cors);}
    if(url.pathname==="/api/commerce/cms-audit"&&request.method==="GET"){const rows=await db.prepare("SELECT id,actor_id,action,entity_type,entity_id,metadata_json,created_at FROM merchant_cms_audit_logs WHERE merchant_id=? ORDER BY created_at DESC LIMIT 200").bind(merchant).all();return json({items:(rows.results||[]).map((row)=>({...row,metadata:parseJson(row.metadata_json)}))},200,cors);}
  } catch (error) {
    const message=String(error?.message||error); if(message.includes("UNIQUE"))return json({error:"DUPLICATE_RESOURCE"},409,cors); if(["BLOCK_NOT_FOUND","INVALID_ORDER","UNSAFE_HTML_EMBED","UNSAFE_IFRAME_DOMAIN","BLOCK_SETTINGS_TOO_LARGE"].some((code)=>message.includes(code)))return json({error:message.match(/(BLOCK_NOT_FOUND|INVALID_ORDER|UNSAFE_HTML_EMBED|UNSAFE_IFRAME_DOMAIN|BLOCK_SETTINGS_TOO_LARGE)/)?.[1]},400,cors); throw error;
  }
  return null;
}
