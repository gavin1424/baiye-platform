import json,tomllib,urllib.request,hashlib
from pathlib import Path
root=Path('baiye-platform-xiangyun')
token=tomllib.loads((Path.home()/'AppData/Roaming/xdg.config/.wrangler/config/default.toml').read_text())['oauth_token']
req=urllib.request.Request('https://api.cloudflare.com/client/v4/accounts/6162cf8d674f8b566b1bb6682d7beb9b/pages/projects/baiye-platform',headers={'Authorization':'Bearer '+token})
d=json.load(urllib.request.urlopen(req))['result']; dep=d['canonical_deployment']
out={k:dep.get(k) for k in ['id','url','environment','created_on','deployment_trigger','latest_stage']};out['production_branch']=d['production_branch'];out['domains']=d['domains']
(root/'evidence/xiangyun/production-before.json').write_text(json.dumps(out,indent=2),encoding='utf8');print(json.dumps(out))
for name,path in [('original-index.html',''),('original-hero.jpg','assets/hero.jpg')]:
 data=urllib.request.urlopen('https://baiyeconnect.com/tanxiang-stable/'+path).read();(root/'evidence/xiangyun'/name).write_bytes(data)
 local=(root/'public/tanxiang-stable'/('index.html' if not path else path)).read_bytes()
 print(name,'matches repo:', data==local,hashlib.sha256(data).hexdigest())
