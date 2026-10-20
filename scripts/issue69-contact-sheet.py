"""A factual 0 / mid / end frame sheet, no image generation or scene alteration."""
from PIL import Image, ImageDraw, ImageFont
import os
root='video-production/issue69/qa'
font=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',23)
small=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',17)
names=['修仙之路，一石結緣','每一顆，都值得細看','金木水火土，尋找你的靈石','石中紋理・家族記憶','遇見你的那顆靈石']
W,H=1040,3420
sheet=Image.new('RGB',(W,H),'#101d18');d=ImageDraw.Draw(sheet)
d.text((35,20),'香雲冷香館｜五支成片・開頭／中段／結尾',font=font,fill='#c4a477')
for i,name in enumerate(names):
    y=85+i*660;d.text((35,y),f'{i+1:02}  {name}  ｜ 24 秒',font=font,fill='#f5f0e8')
    for col,(tag,label) in enumerate([('start','0.0 秒'),('middle','12.8 秒'),('end','23.0 秒')]):
        x=35+col*337;im=Image.open(f'{root}/{i+1:02}-{tag}.png').convert('RGB');im.thumbnail((305,545));sheet.paste(im,(x,y+45));d.text((x,y+598),label,font=small,fill='#e1c79e')
os.makedirs('data/lingstone/issue69',exist_ok=True);sheet.save('data/lingstone/issue69/five-films-contact-sheet.jpg',quality=94)
print('Five-film 15-frame review sheet saved.')
