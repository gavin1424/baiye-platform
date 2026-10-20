// Synthetic preview fixtures only. Never invoked by the production recipe.
import {registerStones,validateTest} from './stones-v20.js';
function testPDF(code){const text=`TEST FIXTURE - NOT A LAB REPORT - ${code} - Synthetic UI measurements only`;const content=`BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 160] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];let out='%PDF-1.4\n',offsets=[0];objects.forEach((s,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${s}\nendobj\n`});const pos=out.length;out+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`;return new TextEncoder().encode(out)}
export async function seedPreviewStoneFixtures(storage,env){
 if(env.XIANGYUN_STONE_TEST_MODE!=='1'||env.XIANGYUN_DEPLOYMENT_CHANNEL!=='preview'||String(env.XIANGYUN_STORE_NAME||'').includes('production'))return;
 const sql=storage.sql;if(sql.exec("SELECT id FROM xy_stone_audit WHERE action='fixture.complete'").toArray().length)return;
 const definitions=[['MET','TEST A · 未檢測'],['MET','TEST B · 單一位置'],['WOD','TEST C · 兩個位置'],['WAT','TEST D · 未檢測'],['FIR','TEST E · 未檢測'],['EAR','TEST F · 未檢測']];
 const stones=await registerStones(storage,definitions.map(([series_prefix,public_name])=>({series_prefix,public_name,is_test:true})), 'preview-system-fixtures','preview-fixtures-v20',env);
 for(const [i,s]of stones.entries()){
  const photo='fixture-photo-'+s.id,doc='fixture-doc-'+s.id,key='stone-registry-test/'+s.id+'/synthetic.pdf',pdf=testPDF(s.code),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pdf)),n=>n.toString(16).padStart(2,'0')).join('');
  await env.MERCHANT_ASSETS.put(key,pdf,{httpMetadata:{contentType:'application/pdf'}});
  storage.transactionSync(()=>{
   sql.exec("INSERT OR IGNORE INTO xy_stone_photos(id,stone_id,fixture_path,kind,verified_real,is_public,sha256,alt) VALUES(?,?,?,'front',0,1,?,'TEST DIAGRAM — NOT A MINERAL PHOTO')",photo,s.id,'/tanxiang-stable/v1/assets/fixtures/registration-demo.svg','TEST_FIXTURE_NOT_PHOTOGRAPH');
   sql.exec("INSERT OR IGNORE INTO xy_stone_documents(id,stone_id,storage_key,mime,sha256,doc_type,status,verified_by,public_visible) VALUES(?,?,?,'application/pdf',?,'SYNTHETIC_TEST_DOCUMENT','confirmed','preview-system-fixtures',1)",doc,s.id,key,digest);
   if(i===1||i===2){const id='fixture-test-'+s.id,points=i===1?[{label:'A',photo_id:photo,x:.38,y:.45,readings:[{element:'Fe',reading:'12.340',unit:'%',uncertainty:'0.120'},{element:'Pb',reading:'0.010',unit:'%',uncertainty:'0.002'}]}]:[{label:'A',photo_id:photo,x:.38,y:.45,readings:[{element:'Fe',reading:'21.100',unit:'%',uncertainty:'0.200'}]},{label:'B',photo_id:photo,x:.68,y:.64,readings:[{element:'Fe',reading:'15.600',unit:'%',uncertainty:'0.180'},{element:'Cd',reading:'0.020',unit:'%',uncertainty:'0.003'}]}];
    const b={sample_id:'SYNTHETIC-'+s.code,device:'Synthetic UI test device',analysis_mode:'Synthetic fixture, not a mineral measurement',tested_at:'2026-10-20',institution:'TEST ONLY',status:'confirmed',document_id:doc,identity_evidence:'Synthetic preview fixture for this registration only; no actual stone or laboratory measurement.',is_public:true,points};validateTest(b,sql,s);
    sql.exec("INSERT OR IGNORE INTO xy_stone_tests(id,stone_id,sample_id,device,analysis_mode,tested_at,institution,status,document_id,identity_evidence,is_public,reviewer) VALUES(?,?,?,?,?,?,?,'confirmed',?,?,1,'preview-system-fixtures')",id,s.id,b.sample_id,b.device,b.analysis_mode,b.tested_at,b.institution,doc,b.identity_evidence);
    for(const [n,p]of points.entries()){const pid=id+'-'+n;sql.exec('INSERT OR IGNORE INTO xy_stone_test_points(id,test_id,point_label,photo_id,x,y) VALUES(?,?,?,?,?,?)',pid,id,p.label,p.photo_id,p.x,p.y);for(const r of p.readings)sql.exec('INSERT OR IGNORE INTO xy_stone_readings(id,point_id,element,reading,unit,uncertainty) VALUES(?,?,?,?,?,?)',pid+'-'+r.element,pid,r.element,r.reading,r.unit,r.uncertainty)}
   }
   sql.exec('UPDATE xy_stones SET published=1,ever_published=1 WHERE id=?',s.id);
  });
 }
 storage.transactionSync(()=>sql.exec("INSERT INTO xy_stone_audit(id,stone_id,actor_id,action,revision) VALUES(?,?,'preview-system-fixtures','fixture.complete',1)",crypto.randomUUID(),stones[0].id));
}
