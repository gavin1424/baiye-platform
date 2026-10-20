import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PROMO_RELEASE_READY,promos} from '../../public/tanxiang-stable/v1/promos-data-v22.js';
const root='public/tanxiang-stable/v1/assets/videos/';
test('only the five complete films are released, with independent posters and Chinese caption files',async()=>{
 assert.equal(PROMO_RELEASE_READY,true);assert.equal(promos.length,5);assert.equal(new Set(promos.map(p=>p.file)).size,5);assert.equal(new Set(promos.map(p=>p.poster)).size,5);
 const hashes=[];for(const p of promos){const srt=await readFile(root+p.srt,'utf8');assert.match(srt,/00:00:00,000/);assert.match(srt,/00:00:24,000/);assert.doesNotMatch(srt,/XY-CONCEPT|蜂揪|蜂啾/);assert.ok((await stat(root+p.vtt)).size>50);const image=await readFile(root+p.poster);assert.equal(image.toString('ascii',8,12),'WEBP');hashes.push(createHash('sha256').update(image).digest('hex'));}assert.equal(new Set(hashes).size,5);
});
test('published MP4s match the decoded release manifest, with portrait and independently framed wide edition',async()=>{
 const manifest=JSON.parse(await readFile(root+'manifest-v22.json','utf8'));assert.equal(manifest.files.length,6);for(const f of manifest.files){const bytes=await readFile(root+f.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);assert.equal(bytes.length,f.bytes);assert.ok(bytes.length<25*1024*1024);assert.ok(bytes.indexOf(Buffer.from('moov'))<bytes.indexOf(Buffer.from('mdat')));assert.equal(f.fullDecode,'PASS');assert.equal(f.codec,'h264');assert.equal(f.pixelFormat,'yuv420p');assert.equal(f.fps,'30/1');assert.ok(f.duration>=20&&f.duration<=30);assert.equal(f.audio,'aac');assert.deepEqual([f.width,f.height],f.file.includes('wide')?[1920,1080]:[1080,1920]);}
});
