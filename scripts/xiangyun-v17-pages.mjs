import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {drafts} from '../public/tanxiang-stable/v1/collection-data-v17.js';
import {collectionCopy} from '../public/tanxiang-stable/v1/collection-copy-v17.js';
const root='public/tanxiang-stable/v1/',base='https://baiyeconnect.com/tanxiang-stable/v1/';
const source=await readFile(root+'index.html','utf8'),languages=['zh-Hant','zh-Hans','en','ja'];
const urls=[];
for(const p of drafts){
 const dir=root+'products/'+p.id;await mkdir(dir,{recursive:true});
 for(const lang of languages){
  const name=p.translations[lang]?.name||p.name,g=collectionCopy(lang),url=base+'products/'+p.id+'/?lang='+lang;
  const html=source.replace('<head>','<head><base href="../../">').replace('<html lang="zh-Hant">',`<html lang="${lang}">`).replace(/<title>.*?<\/title>/,`<title>${name} · ${g('record')}</title>`).replace(/<meta name="description"[^>]+>/,`<meta name="description" content="${name} · ${g('draft')} · ${g('recordNote')}">`).replace('</head>',`<link rel="canonical" href="${url}">${languages.map(l=>`<link rel="alternate" hreflang="${l}" href="${base}products/${p.id}/?lang=${l}">`).join('')}</head>`);
  await writeFile(dir+(lang==='zh-Hant'?'/index.html':'/index-'+lang+'.html'),html);urls.push(`<url><loc>${url}</loc></url>`);
 }
}
const sitemap=await readFile(root+'sitemap.xml','utf8');await writeFile(root+'sitemap.xml',sitemap.replace('</urlset>',urls.join('')+'</urlset>'));
console.log('Generated 10 independent collection document routes and four localized shells; no offers or certification claims.');
