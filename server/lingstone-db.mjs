import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export class LocalD1 {
 constructor(path=':memory:'){this.sqlite=new DatabaseSync(path);this.sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');}
 prepare(sql){const stmt=this.sqlite.prepare(sql);let values=[];return {bind(...v){values=v;return this},async first(){return stmt.get(...values)||null},async all(){return {results:stmt.all(...values)}},async run(){const r=stmt.run(...values);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}}}
 async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const result=[];for(const s of statements)result.push(await s.run());this.sqlite.exec('COMMIT');return result}catch(e){this.sqlite.exec('ROLLBACK');throw e}}
 close(){this.sqlite.close()}
}
export function migrateLocal(db){
 db.sqlite.exec('CREATE TABLE IF NOT EXISTS ls_local_migrations(name TEXT PRIMARY KEY)');
 for(const name of ['0001_finance_core.sql','0002_partner_portal.sql','0009_production_admin_auth.sql','0011_qr_membership_ordering.sql','0015_phone_only_platform_membership.sql','0041_lingstone_v1.sql']){
  if(db.sqlite.prepare('SELECT name FROM ls_local_migrations WHERE name=?').get(name))continue;
  db.sqlite.exec('BEGIN IMMEDIATE');try{db.sqlite.exec(readFileSync(new URL('../cloudflare-worker/migrations/'+name,import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO ls_local_migrations VALUES(?)').run(name);db.sqlite.exec('COMMIT')}catch(e){db.sqlite.exec('ROLLBACK');throw e}
 }
}
