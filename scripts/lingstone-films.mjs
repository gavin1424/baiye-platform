import {mkdir,writeFile} from 'node:fs/promises';
const langs=['zh-Hant','zh-Hans','en','ja'];
const titles=[
 ['修仙世界的靈石，真的來到人間？','修仙世界的灵石，真的来到人间？','Have fantasy spirit stones arrived in our world?','仙侠世界の霊石が現実に現れた？'],
 ['祖先採金，留下的神秘黑金','祖先采金，留下的神秘黑金','The mysterious black gold of a family story','先祖の採金物語に残る神秘の黒金'],
 ['一顆靈石，究竟經歷多少歲月？','一颗灵石，究竟经历多少岁月？','How much time does a stone hold?','一つの石はどれほどの時を経たのか'],
 ['黑色原石裡，藏著什麼秘密？','黑色原石里，藏着什么秘密？','What lies inside a dark natural stone?','黒い原石には何が隠れているのか'],
 ['深圳XRF檢測，揭開靈石元素之謎','深圳XRF检测，揭开灵石元素之谜','Shenzhen XRF: reading the elemental record','深圳XRF、元素の記録を読む'],
 ['修仙者為什麼需要靈石？','修仙者为什么需要灵石？','Why do fantasy cultivators seek spirit stones?','仙侠の修行者はなぜ霊石を求めるのか'],
 ['金木水火土，五行靈石如何選？','金木水火土，五行灵石如何选？','Choosing a stone through five-element culture','金木水火土、五行文化で石を選ぶ'],
 ['你的生辰八字，適合哪種靈石？','你的生辰八字，适合哪种灵石？','Birth charts and cultural stone associations','生辰八字と石の文化的なつながり'],
 ['靈運、靈氣、靈契、靈色','灵运、灵气、灵契、灵色','Ling Yun, Ling Qi, Ling Qi Collection, Ling Se','霊運・霊気・霊契・霊色'],
 ['靈石走入現代家庭','灵石走入现代家庭','Natural stones in a modern home','現代の住まいに原石を迎える']
];
const facts=[
 ['仙俠裡的靈石是想像；眼前的原石需要照片與紀錄來認識。','仙侠里的灵石是想象；眼前的原石需要照片与记录来认识。','Fantasy spirit stones belong to fiction. Real stones need photographs and records.','仙侠の霊石は創作です。実在の石は写真と記録で知ります。'],
 ['家族採金的口述記憶，等待文件與實物逐一對照。未查證的年代不作定論。','家族采金的口述记忆，等待文件与实物逐一对照。未查证的年代不作定论。','Family oral memories of gold mining await comparison with documents and specimens. Dates remain unverified.','家族に伝わる採金の記憶を資料と実物で照合します。未確認の年代は断定しません。'],
 ['紋理是觀察的起點，不能僅憑外觀推定地質年代。','纹理是观察的起点，不能仅凭外观推定地质年代。','Texture invites observation; appearance alone cannot establish geological age.','質感は観察の出発点ですが、外観だけで地質年代は決められません。'],
 ['黑色與金屬光澤都不是成分證明。材料判讀仍需要可追溯檢測。','黑色与金属光泽都不是成分证明。材料判读仍需要可追溯检测。','Dark color and metallic luster do not prove composition. Traceable testing is still needed.','黒い色や金属光沢は成分の証明になりません。追跡可能な検査が必要です。'],
 ['口述深圳歷史XRF曾有Au約1.028%至1.973%讀值，原件尚待核對，不能代表整批或可提煉金量。','口述深圳历史XRF曾有Au约1.028%至1.973%读值，原件尚待核对，不能代表整批或可提炼金量。','Reported historical Shenzhen XRF Au readings of about 1.028% to 1.973% await original records. They do not establish batch grade or recoverable gold.','深圳の過去XRFでAu約1.028%～1.973%との口伝は原本確認待ちです。ロット品位や回収金量を示しません。'],
 ['故事中的靈力屬於虛構。真實收藏看重實物、來源與個人的審美。','故事中的灵力属于虚构。真实收藏看重实物、来源与个人的审美。','Spiritual power in this story is fictional. Real collecting values specimens, provenance and personal taste.','物語の霊力は創作です。現実の収集では実物、由来、個人の美意識を大切にします。'],
 ['金木水火土是本系列的文化標籤，不是礦物成分或人體缺乏檢測。','金木水火土是本系列的文化标签，不是矿物成分或人体缺乏检测。','Metal, wood, water, fire and earth are cultural tags, not mineral composition or bodily deficiency tests.','金木水火土は文化タグであり、鉱物成分や身体の不足を調べる検査ではありません。'],
 ['沿用香雲冷香館八字引擎，未知時辰保留未知。推薦顯示文化分類理由，不保證改運。','沿用香雲冷香館八字引擎，未知时辰保留未知。推荐显示文化分类理由，不保证改运。','The existing Xiangyun engine preserves unknown birth times. Recommendations explain cultural tags and promise no change of destiny.','既存の香雲冷香館エンジンを使い、不明な時刻は不明のまま扱います。文化タグの理由を示し、開運を保証しません。'],
 ['四靈讓文化指引、心情、收藏與外觀紀錄各自選擇，各自授權。外觀變化不歸因於靈石。','四灵让文化指引、心情、收藏与外观记录各自选择，各自授权。外观变化不归因于灵石。','Choose guidance, mood, collection and appearance records independently, with separate consent. Appearance changes are not attributed to stones.','文化ガイド、気分、収蔵、外見記録は個別に選択・同意します。外見の変化を石に帰因させません。'],
 ['把原石放入日常之前，先確認安全、來源與運送條件；可收藏的心意，也需要負責任的紀錄。','把原石放入日常之前，先确认安全、来源与运送条件；可收藏的心意，也需要负责任的记录。','Before bringing a stone home, verify safety, provenance and shipping. Meaningful collecting deserves responsible records.','原石を住まいに迎える前に、安全性、由来、配送条件を確認します。大切な収集には責任ある記録が必要です。']
];
const common=[
 ['雲海深處，一位旅人循著石上的微光，尋找一段未完的故事。這是AI仙俠創作。','云海深处，一位旅人循着石上的微光，寻找一段未完的故事。这是AI仙侠创作。','Beyond a sea of clouds, a traveler follows a glimmer in stone toward an unfinished story. This is AI fantasy fiction.','雲海の奥で旅人が石の微光をたどり、未完の物語を探します。これはAI仙侠の創作です。'],
 ['鏡頭回到現實。每顆原石以獨立編號、實物照片和待確認欄位留下紀錄。','镜头回到现实。每颗原石以独立编号、实物照片和待确认字段留下记录。','The camera returns to reality. Each specimen has its own reference, real photographs and explicit unknowns.','カメラは現実へ。原石ごとに固有番号、実物写真、未確認項目を記録します。'],
 ['五行是一種文化觀看方式。它不替代科學檢驗，也不承諾醫療或命運效果。','五行是一种文化观看方式。它不替代科学检验，也不承诺医疗或命运效果。','The five elements offer a cultural perspective. They do not replace scientific testing or promise medical or destiny effects.','五行は文化的な見方です。科学検査に代わるものではなく、医療や運命への効果を約束しません。'],
 ['實物素材尚待確認時，不以AI礦石代替。母石僅供展示，未通過安全與合規不開放付款。','实物素材尚待确认时，不以AI矿石代替。母石仅供展示，未通过安全与合规不开放付款。','AI stones never replace missing specimen footage. Mother stones are for display; payment requires confirmed safety and compliance.','実物素材が未確認ならAIの石で代用しません。母石は展示のみ、安全と規制の確認前は決済できません。'],
 ['修仙之路，一石結緣。走進香雲冷香館，查看紀錄，再選擇屬於自己的收藏。','修仙之路，一石结缘。走进香云冷香馆，查看记录，再选择属于自己的收藏。','A journey of wonder. A bond set in stone. Visit Xiangyun Lengxiang, read the records and choose your own collection.','仙道の旅、一石が結ぶ縁。香雲冷香館で記録を読み、自分のコレクションを選びましょう。']
];
const visuals=[
 ['16:9雲海遠景，緩推旅人背影；固定顯示「AI仙俠創作」。','16:9云海远景，缓推旅人背影；固定显示“AI仙侠创作”。','16:9 cloud vista, slow push toward a traveler. Persistent label: AI fantasy fiction.','16:9の雲海。旅人の背へゆっくり接近。「AI仙侠創作」を常時表示。'],
 ['黑底暖金標題卡，使用本集已核對的文字；未知事項保留待驗證。','黑底暖金标题卡，使用本集已核对的文字；未知事项保留待验证。','Black-and-gold title card with the episode facts and explicit unverified status.','黒と金のタイトルカード。確認済み情報と未確認表示を明記。'],
 ['實物編號與原石微距，側光緩移。素材未交付則保留缺件標記，不渲染替代原石。','实物编号与原石微距，侧光缓移。素材未交付则保留缺件标记，不渲染替代原石。','Macro footage and specimen reference, slow side light. Missing real footage blocks rendering; no generated substitute.','原石番号と実物マクロ、側光が移動。実物映像不足なら出力を保留し、生成物で代用しない。'],
 ['五行文字圓環，慢速轉場；明示「文化敘事」。','五行文字圆环，慢速转场；明示“文化叙事”。','Five-element typography circle, gentle transition. Label: cultural narrative.','五行の文字円環、穏やかな転換。「文化的な物語」と表示。'],
 ['已核實商品頁截圖與追溯欄位；禁止出現未確認的安全徽章。','已核实商品页截图与追溯字段；禁止出现未确认的安全徽章。','Verified product-page capture with traceability fields. No unverified safety badges.','確認済み商品ページと追跡項目。未確認の安全バッジを表示しない。'],
 ['品牌字卡、系列入口與商城連結，5秒停留；不出現保證效果。','品牌字卡、系列入口与商城链接，5秒停留；不出现保证效果。','Brand end card, category link and store URL; hold five seconds, no effect claims.','ブランドカード、シリーズ入口、商城リンク。5秒保持し、効果を保証しない。']
];
const dir=new URL('../public/tanxiang-stable/v1/films/',import.meta.url);await mkdir(dir,{recursive:true});const episodes=[];
for(let i=0;i<10;i++){
 const id=`EP${String(i+1).padStart(2,'0')}`,locales={};
 for(let j=0;j<langs.length;j++){
  const lines=[common[0][j],facts[i][j],common[1][j],common[2][j],common[3][j],common[4][j]];
  const shots=lines.map((n,k)=>({time:`${k*10}–${(k+1)*10}s`,kind:k===0?'AI_FICTION':k===1?'FACT_STATUS':k===2||k===4?'REAL_ASSET_REQUIRED':'CULTURE',visual:visuals[k][j],narration:n}));
  locales[langs[j]]={title:titles[i][j],synopsis:facts[i][j],shots,narration:lines.join('\n')};
  const stamp=s=>`00:${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')},000`;
  await writeFile(new URL(`${id}-${langs[j]}.srt`,dir),lines.map((line,k)=>`${k+1}\n${stamp(k*10)} --> ${stamp((k+1)*10)}\n${line}\n`).join('\n'));
 }
 episodes.push({id,status:'SCRIPT_AND_STORYBOARD_ONLY',duration_seconds:60,aspect_ratio:'16:9',future_aspect_ratios:['9:16'],category:['heaven','blackgold','heritage','blackgold','blackgold','heaven','elements','elements','incense_pair','home'][i]==='heritage'?'heaven':['heaven','blackgold','heaven','blackgold','blackgold','heaven','elements','elements','incense_pair','home'][i],product_ids:[],mp4_url:null,required_assets:['OWNER_VERIFIED_SPECIMEN_MACRO','SPECIMEN_REFERENCE','VERIFIED_PROVENANCE_RECORDS','OWNER_APPROVED_MUSIC','VERIFIED_PRODUCT_CAPTURE',...(i===4?['ORIGINAL_SHENZHEN_XRF_RECORD']:[])],locales});
}
await writeFile(new URL('episodes.json',dir),JSON.stringify(episodes,null,2)+'\n');
console.log('Generated 10 × 4 scripts/storyboards/narrations/SRT. MP4: not produced. Real assets required.');
