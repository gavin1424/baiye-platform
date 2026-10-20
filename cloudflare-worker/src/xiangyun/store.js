import {stoneSchema} from './stones-schema-v20.js';
import {seedPreviewStoneFixtures} from './stones-fixtures-v20.js';
import {collectionSchema,seedCollection} from './collection-v17.js';
import {artSchema,importV4} from './catalog-v4.js';
import {schema} from './schema.js';
import {handleXiangyunApi} from '../xiangyun-release.js';
// Physical SQLite storage belongs only to this brand's Durable Object namespace.
export class BrandSqliteAdapter{
 constructor(storage){this.storage=storage;this.sql=storage.sql}
 prepare(query){const self=this;let values=[];const execute=()=>{const rows=self.sql.exec(query,...values).toArray();const changes=self.sql.exec('SELECT changes() AS n').toArray()[0].n;return {results:rows,meta:{changes}}};return {bind(...v){values=v;return this},execute,async all(){return execute()},async first(){return execute().results[0]||null},async run(){return execute()}}}
 async batch(statements){return this.storage.transactionSync(()=>statements.map(s=>s.execute()))}
}
export class XiangyunStore{
 constructor(ctx,env){
  this.env=env;this.storage=ctx.storage;const sql=ctx.storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS xy_schema(version INTEGER PRIMARY KEY)');
  if(!sql.exec('SELECT version FROM xy_schema WHERE version=1').toArray().length)ctx.storage.transactionSync(()=>{sql.exec(schema);sql.exec('INSERT INTO xy_schema(version) VALUES(1)')});
  if(!sql.exec('SELECT version FROM xy_schema WHERE version=2').toArray().length)ctx.storage.transactionSync(()=>{sql.exec(collectionSchema);sql.exec('INSERT INTO xy_schema(version) VALUES(2)')});
  if(!sql.exec('SELECT version FROM xy_schema WHERE version=3').toArray().length)ctx.storage.transactionSync(()=>{sql.exec(artSchema);sql.exec('INSERT INTO xy_schema(version) VALUES(3)')});
  if(env.XIANGYUN_CATALOG_V17==='1'||env.XIANGYUN_CATALOG_V17_PREVIEW==='1')ctx.storage.transactionSync(()=>seedCollection(sql));
  if(env.XIANGYUN_CATALOG_V4==='1')ctx.storage.transactionSync(()=>importV4(sql));
  this.db=new BrandSqliteAdapter(ctx.storage);
  ctx.blockConcurrencyWhile(async()=>{
   if(!sql.exec('SELECT version FROM xy_schema WHERE version=4').toArray().length){
    const bookmark=ctx.storage.getCurrentBookmark?await ctx.storage.getCurrentBookmark():null;
    ctx.storage.transactionSync(()=>{sql.exec(stoneSchema);sql.exec('INSERT INTO xy_schema(version) VALUES(4)')});
    await ctx.storage.put('registry_v20_migration',{schema:4,previousBookmark:bookmark,appliedAt:new Date().toISOString(),policy:'FORWARD_ONLY_KEEP_ALL_ISSUED_NUMBERS'});
   }
   if(env.XIANGYUN_STONE_TEST_MODE==='1'&&env.XIANGYUN_DEPLOYMENT_CHANNEL==='preview')await seedPreviewStoneFixtures(ctx.storage,env);
  });
 }
 async fetch(request){return handleXiangyunApi(request,{...this.env,FINANCE_DB:this.db,XIANGYUN_STORAGE:this.storage})}
}
