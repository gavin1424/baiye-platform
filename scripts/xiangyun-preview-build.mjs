// Reproducible brand-only build: approved icons/QR/film assets are already
// versioned, so publishing a material fix does not require the platform's React
// icon-generation toolchain or access to any private backup directory.
import './lingstone-seo.mjs';
import './xiangyun-v17-pages.mjs';
import './xiangyun-v4-assets.mjs';
import './xiangyun-v19-assets.mjs';
import {access} from 'node:fs/promises';
for(const file of ['public/tanxiang-stable/v1/assets/icons/menu.svg','public/tanxiang-stable/v1/assets/icons/bag.svg','public/tanxiang-stable/v1/assets/icons/close.svg','public/tanxiang-stable/v1/qr.js'])await access(file);
console.log('Brand-only preview source and versioned assets verified. No production route changed.');
