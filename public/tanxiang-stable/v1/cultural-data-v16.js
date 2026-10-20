// Owner-supplied collection design correspondences, not universal religious doctrine.
export const CULTURE_VERSION='xiangyun-cultural-correspondence-1.6';
export const languages=['zh-Hant','zh-Hans','en','ja'];
export const local=(values,lang)=>Array.isArray(values)?values[Math.max(0,languages.indexOf(lang))]:values;
export const stones={
 metal:{name:['玄金靈石','玄金灵石','Mystic Metal Stone','玄金霊石'],keywords:['堅定／智慧／守護','坚定／智慧／守护','Resolve / Wisdom / Protection','決意／知恵／守護']},
 wood:{name:['青木靈石','青木灵石','Verdant Wood Stone','青木霊石'],keywords:['生機／成長／靈感','生机／成长／灵感','Vitality / Growth / Inspiration','生命力／成長／ひらめき']},
 water:{name:['玄水靈石','玄水灵石','Mystic Water Stone','玄水霊石'],keywords:['平安／包容／柔和','平安／包容／柔和','Peace / Acceptance / Gentleness','安寧／包容／柔和']},
 fire:{name:['赤炎靈石','赤炎灵石','Crimson Flame Stone','赤炎霊石'],keywords:['熱情／行動／精進','热情／行动／精进','Passion / Action / Dedication','情熱／行動／精進']},
 earth:{name:['厚土靈石','厚土灵石','Deep Earth Stone','厚土霊石'],keywords:['穩定／福德／圓滿','稳定／福德／圆满','Stability / Kindness / Fulfilment','安定／福徳／円満']}
};
export const zodiac=[
 ['rat','子','water',['鼠','鼠','Rat','子（ねずみ）']],['ox','丑','earth',['牛','牛','Ox','丑（うし）']],['tiger','寅','wood',['虎','虎','Tiger','寅（とら）']],['rabbit','卯','wood',['兔','兔','Rabbit','卯（うさぎ）']],['dragon','辰','earth',['龍','龙','Dragon','辰（たつ）']],['snake','巳','fire',['蛇','蛇','Snake','巳（へび）']],['horse','午','fire',['馬','马','Horse','午（うま）']],['goat','未','earth',['羊','羊','Goat','未（ひつじ）']],['monkey','申','metal',['猴','猴','Monkey','申（さる）']],['rooster','酉','metal',['雞','鸡','Rooster','酉（とり）']],['dog','戌','earth',['狗','狗','Dog','戌（いぬ）']],['pig','亥','water',['豬','猪','Pig','亥（いのしし）']]
].map(([id,branch,element,name])=>({id,branch,element,name}));
const buddhas=[
 ['千手觀音','千手观音','Thousand-Armed Avalokiteshvara','千手観音'],['虛空藏菩薩','虚空藏菩萨','Akasagarbha Bodhisattva','虚空蔵菩薩'],['文殊菩薩','文殊菩萨','Manjushri Bodhisattva','文殊菩薩'],['普賢菩薩','普贤菩萨','Samantabhadra Bodhisattva','普賢菩薩'],['大勢至菩薩','大势至菩萨','Mahasthamaprapta Bodhisattva','勢至菩薩'],['大日如來','大日如来','Mahavairocana','大日如来'],['不動明王','不动明王','Acala','不動明王'],['阿彌陀佛','阿弥陀佛','Amitabha Buddha','阿弥陀如来']
];
const buddhaIndex=[0,1,1,2,3,3,4,5,5,6,7,7];
const buddhistWishes=[
 ['慈悲平安','慈悲平安','Compassion and peace','慈悲と安寧'],['福德安定','福德安定','Kindness and stability','福徳と安定'],['勇氣成就','勇气成就','Courage and accomplishment','勇気と成就'],['智慧文昌','智慧文昌','Wisdom and learning','知恵と学び'],['德行圓滿','德行圆满','Virtue and fulfilment','徳と円満'],['修身精進','修身精进','Self-cultivation and dedication','修養と精進'],['光明行動','光明行动','Light and action','光明と行動'],['和合圓融','和合圆融','Harmony and wholeness','和合と円融'],['智慧通達','智慧通达','Wisdom and understanding','知恵と通達'],['堅定守護','坚定守护','Resolve and protection','決意と守護'],['安寧守成','安宁守成','Peace and preservation','安寧と守成'],['平安圓滿','平安圆满','Peace and fulfilment','安寧と円満']
];
export const buddhist=zodiac.map((z,i)=>({...z,guardian:buddhas[buddhaIndex[i]],stone:stones[z.element].name,wish:buddhistWishes[i]}));
const taoistWishes=[
 ['靈慧守護／智慧開運／避災納福','灵慧守护／智慧开运／避灾纳福','Insight and protection / Wisdom and fortune / Wishes for safety','霊慧と守護／知恵と開運／厄除けと福'],
 ['福德安定／事業穩健／財庫充盈','福德安定／事业稳健／财库充盈','Kindness and stability / Steady work / Abundance','福徳と安定／仕事の堅実さ／豊かさ'],
 ['勇敢開運／權威領導／化煞除邪','勇敢开运／权威领导／化煞除邪','Courage and fortune / Leadership / Wishes to ward off adversity','勇気と開運／指導力／厄除けの願い'],
 ['文運昌隆／學業順利／人緣和合','文运昌隆／学业顺利／人缘和合','Literary inspiration / Learning / Harmonious relationships','文運／学業／人との和合'],
 ['尊榮興旺／權勢貴人／開創成功','尊荣兴旺／权势贵人／开创成功','Honour and prosperity / Helpful allies / New beginnings','尊栄と繁栄／良き支援者／開拓の成就'],
 ['護身精進／化險為夷／轉危為安','护身精进／化险为夷／转危为安','Dedication and protection / Wishes for resilience / Safety','守護と精進／困難を越える願い／安寧'],
 ['光明行動／事業騰達／名利雙收','光明行动／事业腾达／名利双收','Light and action / Career aspirations / Recognition and prosperity','光明と行動／仕事の発展／名誉と実り'],
 ['和合圓滿／家庭安定／貴人相助','和合圆满／家庭安定／贵人相助','Harmony / A stable home / Helpful allies','和合と円満／家庭の安定／良き支援'],
 ['智慧通達／機智應變／創新突破','智慧通达／机智应变／创新突破','Understanding / Resourcefulness / Innovation','知恵と通達／機転／創造と突破'],
 ['正氣守護／辟邪化煞／事業順利','正气守护／辟邪化煞／事业顺利','Integrity and protection / Wishes to ward off adversity / Steady work','正気と守護／厄除けの願い／仕事の順調さ'],
 ['安寧守成／忠誠護佑／家庭平安','安宁守成／忠诚护佑／家庭平安','Peace and preservation / Loyalty / A peaceful home','安寧と守成／忠誠と守護／家庭の平安'],
 ['平安圓滿／財富豐盈／福樂長久','平安圆满／财富丰盈／福乐长久','Peace and fulfilment / Abundance / Lasting joy','平安と円満／豊かさ／長く続く喜び']
];
export const taoist=zodiac.map((z,i)=>({...z,guardian:[`${z.branch}${z.name[0]}元辰星君`,`${z.branch}${z.name[1]}元辰星君`,`${z.branch} ${z.name[2]} · Yuanchen Star Lord`,`${z.branch}・${z.name[3]}の元辰星君`],stone:stones[z.element].name,wish:taoistWishes[i]}));
export const western=[
 ['metal',['雅典娜 Athena','雅典娜 Athena','Athena','アテナ Athena'],['頭盔、盾與橄欖枝','头盔、盾与橄榄枝','Helmet, shield and olive branch','兜・盾・オリーブの枝'],['智慧／守護／決斷','智慧／守护／决断','Wisdom / Protection / Judgement','知恵／守護／決断']],
 ['wood',['阿耳忒彌斯 Artemis','阿耳忒弥斯 Artemis','Artemis','アルテミス Artemis'],['弓、月光與森林','弓、月光与森林','Bow, moonlight and forest','弓・月光・森'],['成長／生機／靈感','成长／生机／灵感','Growth / Vitality / Inspiration','成長／生命力／ひらめき']],
 ['water',['波塞頓 Poseidon','波塞顿 Poseidon','Poseidon','ポセイドン Poseidon'],['三叉戟與海浪','三叉戟与海浪','Trident and sea waves','三叉の矛と波'],['平安／包容／流動','平安／包容／流动','Peace / Acceptance / Flow','安寧／包容／流れ']],
 ['fire',['阿波羅 Apollo','阿波罗 Apollo','Apollo','アポロン Apollo'],['太陽光、月桂與里拉琴','太阳光、月桂与里拉琴','Sunlight, laurel and lyre','陽光・月桂樹・竪琴'],['光明／行動／榮耀','光明／行动／荣耀','Light / Action / Glory','光明／行動／栄光']],
 ['earth',['狄蜜特 Demeter','狄蜜特 Demeter','Demeter','デメテル Demeter'],['麥穗與豐收之籃','麦穗与丰收之篮','Wheat and a harvest basket','麦の穂と収穫の籠'],['穩定／豐盛／圓滿','稳定／丰盛／圆满','Stability / Abundance / Fulfilment','安定／豊穣／円満']]
].map(([element,guardian,image,wish])=>({id:element,element,guardian,image,stone:stones[element].name,wish}));
export function culturalProfile(result){
 const z=zodiac.find(z=>z.branch===result.pillars.year?.branch)||null;
 const primary=result.pillars.day?.stem_element||null;
 return {version:CULTURE_VERSION,zodiac:z?.id||null,primary_element:primary,recommended_element:primary,buddhist:z?.id||null,taoist:z?.id||null,western:primary,rule:{zodiac:'BAZI_YEAR_BRANCH_LICHUN_BOUNDARY',primary:'DAY_STEM_ELEMENT_NOT_STRENGTH_OR_FAVOURABLE_ELEMENT',correspondence:'OWNER_SUPPLIED_COLLECTION_DESIGN_NOT_UNIVERSAL_RELIGIOUS_DOCTRINE'},uncertain:!z||!primary};
}
