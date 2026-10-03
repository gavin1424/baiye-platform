const sharp = require('C:/Users/wwwas/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const dir = __dirname;
(async () => {
  // Normalize the two 390px browser captures to the same presentation scale.
  const before = await sharp(path.join(dir,'before-mobile-390.jpg')).resize(390,844,{fit:'contain',background:'#F7F3EA'}).toBuffer();
  const after = await sharp(path.join(dir,'production-mobile-390.jpg')).resize(390,844,{fit:'contain',background:'#F7F3EA'}).toBuffer();
  await sharp({create:{width:828,height:892,channels:3,background:'#F7F3EA'}}).composite([{input:before,left:16,top:24},{input:after,left:422,top:24}]).jpeg({quality:93}).toFile(path.join(dir,'mobile-before-after.jpg'));
  const full = path.join(dir,'production-mobile-full.jpg');
  const {width,height} = await sharp(full).metadata();
  const stripHeight = Math.ceil(height / 6);
  const strips = [];
  for(let top=0,index=0;top<height;top+=stripHeight,index++){
    const buffer = await sharp(full).extract({left:0,top,width,height:Math.min(stripHeight,height-top)}).toBuffer();
    strips.push({input:buffer,left:index*(width+16)+16,top:16});
  }
  await sharp({create:{width:(width+16)*strips.length+16,height:stripHeight+32,channels:3,background:'#F7F3EA'}}).composite(strips).jpeg({quality:90}).toFile(path.join(dir,'mobile-full-contact-sheet.jpg'));
  const desktopBefore=await sharp(path.join(dir,'before-desktop.jpg')).resize(1000).toBuffer();
  const desktopAfter=await sharp(path.join(dir,'production-desktop.jpg')).resize(1000).toBuffer();
  await sharp({create:{width:2048,height:744,channels:3,background:'#F7F3EA'}}).composite([{input:desktopBefore,left:16,top:24},{input:desktopAfter,left:1032,top:24}]).jpeg({quality:92}).toFile(path.join(dir,'desktop-before-after.jpg'));
  console.log('Comparison and contact sheet saved. Originals are unchanged.');
})().catch(error=>{console.error(error);process.exitCode=1});
