import {prepareCeremonyAudio,createCeremonyAudio} from './ceremony-audio-v23.js';
import {realmCopy} from './realms-copy-v16.js';
const rows={
 soundOn:['音效開啟','音效开启','Sound on','音声オン'],
 soundOff:['音效關閉','音效关闭','Sound off','音声オフ'],
 soundEnable:['開啟音效','开启音效','Enable sound','音声を有効にする'],
 volume:['音量','音量','Volume','音量'],

 intro:['一日一時，開啟你的五行篇章','一日一时，开启你的五行篇章','A date, a time, a story of five elements','生まれた日と時刻から、五行の物語へ'],
 help:['預設輸入國曆，自動換算農曆與節氣。不保存出生資料。','默认输入公历，自动换算农历与节气。不保存出生资料。','Enter a Gregorian date. Lunar dates and solar terms are calculated automatically. Birth inputs are not stored.','西暦で入力すると、旧暦と節気を自動換算します。出生情報は保存しません。'],
 advanced:['其他曆法與出生地設定','其他历法与出生地设置','Calendar and birth timezone options','暦・出生地のタイムゾーン設定'],
 zoneNote:['自動採用裝置時區；若出生地不同，請在下方設定修改。午夜換日，可於設定調整。','自动采用设备时区；出生地不同时请在下方设置修改。默认午夜换日，可调整。','Your device timezone is used. Change it below if your birth timezone differs. Day boundary defaults to midnight.','端末のタイムゾーンを使います。出生地が異なる場合は下で変更してください。日付の境界は初期設定で午前0時です。'],
 unknownHint:['留空表示時辰未知','留空表示时辰未知','Leave blank if the time is unknown','時刻が不明な場合は空欄に'],
 lunarHint:['農曆輸入請選擇下方農曆，並確認閏月；不能由日期數字猜測曆法。','农历输入请选择下方农历并确认闰月；无法由日期数字猜测历法。','For a lunar birthday, select Lunar below and confirm a leap month if applicable. Date numbers cannot identify a calendar.','旧暦の誕生日は下で旧暦を選び、閏月を確認してください。日付の数字だけでは暦を判別できません。'],
 reduced:['直接查看結果，略過情境動畫','直接查看结果，略过情境动画','Go straight to results; skip the story animation','演出を省略して結果を表示'],
 begin:['開啟五行篇章','开启五行篇章','Begin your element story','五行の物語を始める'],
 guide:['守石人・雲衡','守石人・云衡','Yunheng · Keeper of Stones','雲衡・石の守り人'],
 fiction:['原創修仙角色與法陣為藝術情境，不代表科學測量或實物商品。','原创修仙角色与法阵为艺术情境，不代表科学测量或实物商品。','Original character and ritual circle are fictional art, not scientific measurement or product photography.','人物と陣はオリジナルの創作演出です。科学的測定や実物の商品写真ではありません。'],
 skip:['跳過動畫','跳过动画','Skip animation','演出をスキップ'],
 stages:[['守石人，邀你入境','五行法陣，緩緩展開','五行屬性，緩緩覺醒','靈石現世，收藏有緣'],['守石人，邀你入境','五行法阵，缓缓展开','五行属性，缓缓觉醒','灵石现世，收藏有缘'],['Meet the keeper','The five-element circle unfolds','A cultural theme awakens','A stone story comes to light'],['守り人との出会い','五行の陣がひらく','文化のテーマが目覚める','石の物語が現れる']],
 waiting:['正在計算曆法，請稍候…','正在计算历法，请稍候…','Calculating the calendar…','暦を計算しています…'],
 result:['你的五行文化篇章','你的五行文化篇章','Your five-element cultural story','あなたの五行文化の物語'],
 dates:['國曆 / 農曆','公历 / 农历','Gregorian / Lunar','西暦 / 旧暦'],
 leapMark:['閏','闰','leap','閏'],
 terms:['前後節氣（節月邊界，Asia/Shanghai）','前后节气（节月边界，Asia/Shanghai）','Surrounding solar month boundaries (Asia/Shanghai)','前後の節入り（Asia/Shanghai）'],
 termUnknown:['時辰未知，不指定節氣瞬間；跨界柱位保留未知。','时辰未知，不指定节气瞬间；跨界柱位保留未知。','Time unknown: no solar-term instant is assumed; uncertain pillars remain unknown.','時刻不明のため節入りの瞬間は仮定せず、境界をまたぐ柱は不明とします。'],
 pillarYear:['年柱','年柱','Year','年柱'],pillarMonth:['月柱','月柱','Month','月柱'],pillarDay:['日柱','日柱','Day','日柱'],pillarHour:['時柱','时柱','Hour','時柱'],
 theme:['文化探索主題','文化探索主题','Cultural themes to explore','文化を楽しむテーマ'],
 rule:['依可確認天干地支的五行出現次數，選出較少出現的文化主題；這不是命理強弱、人體缺乏或改運判定。','依可确认干支的五行出现次数，选出较少出现的文化主题；这不是命理强弱、人体缺乏或改运判定。','Themes with the lowest visible stem-and-branch counts are selected for cultural exploration. This does not measure destiny, health or a deficiency.','確認できる干支の五行のうち出現回数が少ないテーマを文化的に選びます。運命の強弱や身体の不足を判断するものではありません。'],
 eligible:['只推薦本館已上架、可販售且有實拍與安全、來源及配送確認的商品；配對依商品的文化分類。','仅推荐本馆已上架、可销售且有实拍、安全、来源及配送确认的商品；配对依据商品文化分类。','Only our listed, sale-eligible stones with verified photographs, safety, provenance and shipping checks are matched by cultural tags.','実写・安全・出所・配送の確認が済んだ当館の販売中商品だけを文化分類で紹介します。'],
 noStock:['目前沒有符合此文化主題的已確認上架靈石。不以虛構商品或生成圖片代替推薦。','目前没有符合此文化主题的已确认上架灵石。不以虚构商品或生成图片代替推荐。','No verified listed stone currently matches these themes. We do not substitute invented products or generated product images.','このテーマに合う確認済みの販売中商品はまだありません。架空の商品や生成画像で補いません。'],
 fail:['無法完成解析，請檢查出生日期、時區與進階設定後重試。','无法完成解析，请检查出生日期、时区与高级设置后重试。','Analysis could not finish. Check the date, timezone and advanced settings, then retry.','解析できませんでした。日付・タイムゾーン・詳細設定を確認して再度お試しください。'],
 ambiguous:['此時間因夏令時間重複，請展開設定，選擇較早或較晚時段。','此时间因夏令时重复，请展开设置选择较早或较晚时段。','This time occurs twice due to daylight saving. Open settings and choose the earlier or later occurrence.','夏時間により同じ時刻が2回あります。設定で早い時刻か遅い時刻を選んでください。'],
 nonexistent:['此地當天的時間因夏令時間調整而不存在，請確認出生時間。','该地当天的时间因夏令时调整而不存在，请确认出生时间。','This local time did not exist because of a clock change. Check the birth time.','夏時間の切り替えで存在しない時刻です。出生時刻を確認してください。'],
 timeout:['連線逾時，請稍後重試。','连接超时，请稍后重试。','The request timed out. Please retry.','接続がタイムアウトしました。再度お試しください。'],
 ritual:['聞香搭配依個人偏好，保持通風，短暫靜坐記下今日感受。','闻香搭配依个人偏好，保持通风，短暂静坐记下今日感受。','Choose incense by scent preference; ventilate the room and take a quiet moment to journal.','香りは好みで選び、換気をしながら静かに日々の気持ちを記録しましょう。']
};
export const journeyCopy=(lang,key)=>rows[key]?.[Math.max(0,['zh-Hant','zh-Hans','en','ja'].indexOf(lang))]||key;
function timezone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Taipei'}catch{return 'Asia/Taipei'}}
export function journeyForm(c){const {lang,t,esc}=c,g=k=>journeyCopy(lang,k),r=k=>realmCopy(lang,k);return `<div class="journey-intro"><img src="./assets/art/keeper-v15-480.webp" width="480" height="640" loading="lazy" decoding="async" alt="${esc(g('guide'))}"><div><span class="eyebrow">XIANGYUN / THREE CULTURAL PATHS</span><h3>${esc(g('guide'))}</h3><small>${esc(g('fiction'))}</small></div></div><form id="birth-form" class="form-panel birth-simple"><div class="birth-primary"><label>${esc(t('date'))}<input name="date" type="date" min="1901-01-01" max="2100-12-31" required></label><label>${esc(t('time'))}<input name="time" type="time" aria-describedby="time-hint"><small id="time-hint">${esc(g('unknownHint'))}</small></label></div><label class="inline"><input type="checkbox" name="unknown_time">${esc(t('unknown'))}</label><input type="hidden" name="timezone" value="${esc(timezone())}"><input type="hidden" name="calendar" value="solar"><input type="hidden" name="day_boundary" value="midnight"><p class="birth-auto-note">${esc(r('auto'))} <strong>${esc(timezone())}</strong></p><fieldset class="birth-dst" hidden><legend>${esc(r('unresolved'))}</legend><select name="dst_fold" aria-label="${esc(t('fold'))}"><option value="">${esc(t('choose'))}</option><option value="earlier">${esc(t('earlier'))}</option><option value="later">${esc(t('later'))}</option></select></fieldset><button type="submit">${esc(r('start'))} ↗</button><p id="birth-status" role="status" tabindex="-1"></p></form>`}
function ceremony(c,skip){
 const g=k=>k==='stages'?realmCopy(c.lang,k):journeyCopy(c.lang,k),esc=c.esc;
 if(skip||matchMedia('(prefers-reduced-motion: reduce)').matches)return {finished:Promise.resolve(),close(){},setTheme(){}};
 const d=document.createElement('dialog');d.className='awakening';d.setAttribute('aria-labelledby','awakening-title');d.innerHTML=`<div class="awakening-toolbar"><button type="button" class="awakening-sound" aria-pressed="true">${esc(g('soundOn'))}</button><label class="awakening-volume">${esc(g('volume'))}<input type="range" min="0" max="100" step="1" value="35" aria-label="${esc(g('volume'))}"></label><button type="button" class="awakening-skip">${esc(g('skip'))} ↗</button></div><div class="awakening-scene" data-stage="0"><img class="keeper" src="./assets/art/keeper-v15-960.webp" width="720" height="960" alt="${esc(g('guide'))}"><div class="element-circle" aria-hidden="true"><i></i>${['metal','wood','water','fire','earth'].map((k,i)=>`<span class="rune rune-${i}" data-element="${k}">${esc(c.t(k))}</span>`).join('')}<b class="story-stone"></b></div><div class="awakening-caption"><small>${esc(g('guide'))}</small><h2 id="awakening-title">${esc(g('stages')[0])}</h2><p>${esc(g('fiction'))}</p></div></div>`;document.body.append(d);d.showModal();
 let resolve,done=false,ready=false,revealing=false;const start=performance.now(),timers=[],finished=new Promise(r=>resolve=r);
 const soundButton=d.querySelector('.awakening-sound'),volume=d.querySelector('input[type=range]');
 const sound=createCeremonyAudio(state=>{soundButton.textContent=g(state.available?(state.muted?'soundOff':'soundOn'):'soundEnable');soundButton.setAttribute('aria-pressed',String(!state.muted&&state.available));volume.value=String(Math.round(state.volume*100));d.dataset.audioState=state.stopped?'stopped':state.available?(state.muted?'muted':'running'):'unavailable'});
 const close=()=>{if(done)return;done=true;timers.forEach(clearTimeout);sound.stop();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',close);d.close();d.remove();resolve()};
 const hidden=()=>{if(document.hidden)close()};document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',close,{once:true});
 soundButton.onclick=()=>sound.toggle();volume.oninput=()=>sound.volume(Number(volume.value)/100);
 d.querySelector('.awakening-skip').onclick=close;d.addEventListener('cancel',e=>{e.preventDefault();close()});
 const stage=i=>{if(done)return;d.querySelector('.awakening-scene').dataset.stage=String(i);d.querySelector('h2').textContent=g('stages')[i];sound.stage(i)};
 const reveal=()=>{if(done||!ready||revealing)return;revealing=true;stage(2);timers.push(setTimeout(()=>stage(3),780));timers.push(setTimeout(close,1640))};
 stage(0);timers.push(setTimeout(()=>stage(1),780));timers.push(setTimeout(()=>{if(ready)reveal();else d.querySelector('h2').textContent=g('waiting')},1560));
 return {finished,close,setTheme(elements){if(done)return;ready=true;for(const el of d.querySelectorAll('[data-element]'))el.classList.toggle('is-theme',elements.includes(el.dataset.element));if(performance.now()-start>=1560)reveal()}};
}
export function bindJourney(c){
 const {t,esc,post,card}=c,g=k=>journeyCopy(c.lang,k),form=document.querySelector('#birth-form'),output=document.querySelector('#analysis-result');if(!form||!output)return;prepareCeremonyAudio();
 form.elements.unknown_time.onchange=e=>{form.elements.time.disabled=e.target.checked;if(e.target.checked)form.elements.time.value=''};
 const section=document.querySelector('#analysis');if(section){section.querySelector('h1,h2').textContent=realmCopy(c.lang,'title');const intro=section.querySelector(':scope > p');if(intro)intro.textContent=realmCopy(c.lang,'subtitle')}
 let active=false;
 form.onsubmit=async e=>{e.preventDefault();if(active)return;active=true;const button=form.querySelector('button[type=submit]'),status=form.querySelector('#birth-status');button.disabled=true;output.replaceChildren();status.textContent=g('waiting');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000),animation=ceremony(c,form.elements.skip_animation?.checked||false);const cancel=()=>{abort.abort();animation.close()};window.addEventListener('hashchange',cancel,{once:true});
  try{const data=Object.fromEntries(new FormData(form));data.unknown_time=form.elements.unknown_time.checked||!data.time;data.leap_month=false;delete data.skip_animation;
   const b=await post('/analysis',data,{},abort.signal);animation.setTheme(b.cultural_profile?(b.cultural_profile.primary_element?[b.cultural_profile.primary_element]:[]):b.reason.elements);await animation.finished;if(!form.isConnected||abort.signal.aborted)return;
   if(c.onComplete){status.textContent='';c.onComplete(b,data);return}
   const r=b.result,l=r.lunar_date;
   output.innerHTML=`<div class="result journey-result" tabindex="-1"><span class="eyebrow">XIANGYUN / CULTURAL REFLECTION</span><h3>${esc(g('result'))}</h3><p>${esc(g('dates'))} · ${esc(r.solar_date)} / ${esc(l.year)}-${esc(l.leap_month?g('leapMark'):'')}${esc(l.month)}-${esc(l.day)}<br>${esc(r.timezone)}</p><div class="pillar-grid">${['year','month','day','hour'].map(k=>`<div><small>${esc(g('pillar'+k[0].toUpperCase()+k.slice(1)))}</small><strong>${esc(r.pillars[k]?.code||t('unknownValue'))}</strong></div>`).join('')}</div><div class="elements">${Object.entries(r.five_elements).map(([k,v])=>`<div class="element">${esc(t(k))}<strong>${v}</strong></div>`).join('')}</div><h4>${esc(g('theme'))} · ${b.reason.elements.map(k=>esc(t(k))).join(' / ')}</h4><p>${esc(g('rule'))}</p><p>${esc(g('eligible'))}</p>${b.recommendations.length?`<div class="grid">${b.recommendations.map(card).join('')}</div>`:`<p class="empty real-stock-empty">${esc(g('noStock'))}</p>`}<p>${esc(g('ritual'))}</p><details><summary>${esc(g('terms'))}</summary>${r.solar_terms?`<p>${esc(r.solar_terms.previous.name)} · ${esc(r.solar_terms.previous.at)}<br>${esc(r.solar_terms.next.name)} · ${esc(r.solar_terms.next.at)}</p>`:`<p>${esc(g('termUnknown'))}</p>`}<small>${esc(r.engine_version)} · ${esc(r.convention.day)} · ${esc(t('analysisIntro'))}</small></details></div>`;
   status.textContent='';const target=output.querySelector('.result');target.focus({preventScroll:true});target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }catch(err){animation.close();if(form.isConnected){status.textContent=g(err.name==='AbortError'?'timeout':err.message==='AMBIGUOUS_LOCAL_TIME'?'ambiguous':err.message==='NONEXISTENT_LOCAL_TIME'?'nonexistent':'fail');if(err.message==='AMBIGUOUS_LOCAL_TIME'){form.querySelector('.birth-dst').hidden=false;status.textContent=realmCopy(c.lang,'unresolved')}status.focus({preventScroll:true})}}
  finally{clearTimeout(timer);animation.close();window.removeEventListener('hashchange',cancel);button.disabled=false;active=false}
 };
}
export function animatePage(){const el=document.querySelector('main');if(!el)return;el.classList.remove('page-arrive');void el.offsetWidth;el.classList.add('page-arrive')}
