import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {v4Catalog} from '../cloudflare-worker/src/xiangyun/catalog-v4-data.js';
assert.equal(v4Catalog.products.length,10);assert.equal(new Set(v4Catalog.products.map(p=>p.id)).size,10);assert.equal(new Set(v4Catalog.products.map(p=>p.imageSha256)).size,10);
const raw=JSON.parse(await readFile('public/tanxiang-stable/v1/assets/lingstone/catalog.json','utf8'));
for(const p of v4Catalog.products){const source=raw.find(r=>r.sku===p.sku);assert.ok(source,p.sku);assert.equal(source.saleEnabled,false);assert.equal(source.physicalPhotoConfirmed,false);assert.equal(source.isPhysicalSkuIdentified,false);assert.equal(source.priceType,'PROPOSED_RETAIL');assert.equal(source.priceTWD,p.priceTWD);assert.equal(source.image,p.image);assert.equal(source.thumb,p.thumb);
 for(const name of ['image','thumb']){assert.match(p[name],/^\/tanxiang-stable\/v1\/assets\/lingstone\/stones\/lingstone-concept-\d{2}(?:-thumb)?\.webp$/);const bytes=await readFile('public'+p[name]);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(createHash('sha256').update(bytes).digest('hex'),p[name+'Sha256'],p[name])}
}
const xrf=await readFile('public/tanxiang-stable/v1/assets/lingstone/xrf-history-screen.webp');assert.equal(xrf.toString('ascii',8,12),'WEBP');
console.log('V4 preflight: 10 unique owner-supplied concepts + 10 thumbnails match the intake hashes; saleEnabled=false. Browser loading remains a separate acceptance check.');
