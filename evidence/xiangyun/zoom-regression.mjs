import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../../public/tanxiang-stable/pavilion.js',import.meta.url),'utf8');
const paint=src.slice(src.indexOf('  function paint()'),src.indexOf('  function reset()'));
const controls={};const image={naturalWidth:0,naturalHeight:0,style:{}};
const context={picture:image,stage:{getBoundingClientRect:()=>({width:1100,height:600})},scale:1.5,x:0,y:0,$:s=>controls[s]??=( {} )};
vm.createContext(context);vm.runInContext(paint+'paint();',context);assert(!image.style.transform.includes('NaN'));assert(image.style.transform.includes('scale(1.5)'));
image.naturalWidth=1536;image.naturalHeight=1024;vm.runInContext('paint();',context);assert(Number.isFinite(context.x));assert(Number.isFinite(context.y));assert.equal(controls['#zoom-value'].value,'150%');
context.x=NaN;context.y=NaN;vm.runInContext('paint();',context);assert.equal(context.x,0);assert.equal(context.y,0);
console.log('PASS: cold image load zoom, decode repaint, nonfinite recovery');

