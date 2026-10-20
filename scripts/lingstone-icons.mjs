import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {List} from '@phosphor-icons/react/dist/csr/List';
import {ShoppingBag} from '@phosphor-icons/react/dist/csr/ShoppingBag';
import {X} from '@phosphor-icons/react/dist/csr/X';
const dir='public/tanxiang-stable/v1/assets/icons';await mkdir(dir,{recursive:true});
for(const [name,Icon] of Object.entries({menu:List,bag:ShoppingBag,close:X}))await writeFile(`${dir}/${name}.svg`,renderToStaticMarkup(React.createElement(Icon,{size:24,color:'#C4A477',weight:'light','aria-hidden':true})));
await copyFile('node_modules/@phosphor-icons/react/LICENSE',`${dir}/LICENSE`);
