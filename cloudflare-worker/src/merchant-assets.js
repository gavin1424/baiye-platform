const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

export function detectProductImageMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "image/webp";
  return "";
}

function extension(mime) { return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp"; }

export async function handleMerchantProductAsset(request, env, url, cors, authorization) {
  const match = url.pathname.match(/^\/api\/merchant-admin\/products\/([^/]+)\/image$/);
  if (!match || request.method !== "POST") return null;
  if (!env.MERCHANT_ASSETS) return json({ code: "MERCHANT_ASSET_STORAGE_UNAVAILABLE", error: "商品圖片儲存服務尚未設定。" }, 503, cors);
  const db = env.FINANCE_DB, merchantId = authorization.session.merchant_id, productId = decodeURIComponent(match[1]);
  const product = await db.prepare("SELECT id FROM merchant_menu_items WHERE merchant_id=? AND id=? AND status<>'archived'").bind(merchantId, productId).first();
  if (!product) return json({ code: "PRODUCT_NOT_FOUND", error: "找不到此商家的商品。" }, 404, cors);
  const form = await request.formData().catch(() => null), file = form?.get("image");
  if (!(file instanceof File)) return json({ code: "IMAGE_REQUIRED", error: "請選擇商品圖片。" }, 422, cors);
  if (file.size < 1 || file.size > MAX_BYTES) return json({ code: "IMAGE_TOO_LARGE", error: "圖片大小不可超過 5 MB。" }, 413, cors);
  const bytes = new Uint8Array(await file.arrayBuffer()), mime = detectProductImageMime(bytes);
  if (!mime || !ALLOWED.has(mime) || (file.type && file.type !== mime)) return json({ code: "IMAGE_MIME_INVALID", error: "只允許內容正確的 JPEG、PNG 或 WebP 圖片。" }, 415, cors);
  const assetId = uid("productasset"), key = `merchant-assets/${merchantId}/products/${productId}/${assetId}.${extension(mime)}`;
  await env.MERCHANT_ASSETS.put(key, bytes, { httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { merchant_id: merchantId, product_id: productId, asset_id: assetId } });
  try {
    await db.prepare("INSERT INTO merchant_product_assets(id,merchant_id,product_id,object_key,content_type,byte_size,status,created_by_user_id) VALUES(?,?,?,?,?,?, 'staged',?)")
      .bind(assetId, merchantId, productId, key, mime, file.size, authorization.session.user_id).run();
  } catch (error) {
    await env.MERCHANT_ASSETS.delete(key);
    throw error;
  }
  const publicUrl = `${url.origin}/api/merchant-assets/${encodeURIComponent(merchantId)}/products/${assetId}`;
  return json({ id: assetId, product_id: productId, image_url: publicUrl, content_type: mime, byte_size: file.size, status: "staged" }, 201, cors);
}

export async function attachMerchantProductAssetFromUrl(db, merchantId, productId, imageUrl) {
  const match = String(imageUrl || "").match(/\/api\/merchant-assets\/([^/]+)\/products\/([^/?#]+)/);
  if (!match || decodeURIComponent(match[1]) !== merchantId) return;
  await db.batch([
    db.prepare("UPDATE merchant_product_assets SET status='deleted',deleted_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND product_id=? AND status='attached' AND id<>?").bind(merchantId, productId, match[2]),
    db.prepare("UPDATE merchant_product_assets SET status='attached',attached_at=COALESCE(attached_at,CURRENT_TIMESTAMP),deleted_at=NULL WHERE merchant_id=? AND product_id=? AND id=? AND status='staged'").bind(merchantId, productId, match[2]),
  ]);
}

export async function serveMerchantProductAsset(env, url) {
  const match = url.pathname.match(/^\/api\/merchant-assets\/([^/]+)\/products\/([^/]+)$/);
  if (!match || !env.FINANCE_DB || !env.MERCHANT_ASSETS) return null;
  const row = await env.FINANCE_DB.prepare("SELECT object_key,content_type,status FROM merchant_product_assets WHERE merchant_id=? AND id=? AND status IN ('staged','attached')").bind(decodeURIComponent(match[1]), match[2]).first();
  if (!row) return new Response("Not found", { status: 404 });
  const object = await env.MERCHANT_ASSETS.get(row.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": row.content_type, "cache-control": row.status === "attached" ? "public, max-age=31536000, immutable" : "private, no-store", "x-content-type-options": "nosniff", etag: object.httpEtag } });
}

export async function resetMerchantProductAssets(env, merchantId) {
  if (!env.MERCHANT_ASSETS) return;
  let cursor;
  do {
    const page = await env.MERCHANT_ASSETS.list({ prefix: `merchant-assets/${merchantId}/products/`, cursor });
    if (page.objects.length) await env.MERCHANT_ASSETS.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await env.FINANCE_DB.prepare("DELETE FROM merchant_product_assets WHERE merchant_id=?").bind(merchantId).run();
}
