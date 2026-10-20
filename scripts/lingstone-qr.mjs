import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.resolve('vite'));
const {build}=await import(pathToFileURL(require.resolve('esbuild')).href);
await build({entryPoints:['src/lingstone-qr.tsx'],outfile:'public/tanxiang-stable/v1/qr.js',bundle:true,minify:true,format:'esm',define:{'process.env.NODE_ENV':'"production"'}});
