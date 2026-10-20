// Brand-owned adapter. Only the generic MIT lunar-javascript dependency is used.
import lunar from 'lunar-javascript';
const {Solar,Lunar}=lunar;
export const ENGINE_VERSION='xiangyun-calendar-1.1/lunar-javascript-1.7.7';
export function normalizeBirthInput(input){
 if(!input||typeof input!=='object')throw Error('INVALID_BIRTH_INPUT');
 if(!('date' in input))return input;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date||''))throw Error('INVALID_BIRTH_DATE');
 const [year,month,day]=input.date.split('-').map(Number);
 return {...input,year,month,day,calendar:input.calendar||'solar',day_boundary:input.day_boundary||'midnight',timezone:input.timezone||'Asia/Taipei',unknown_time:input.unknown_time===true||!input.time};
}
const stems='甲乙丙丁戊己庚辛壬癸',branches='子丑寅卯辰巳午未申酉戌亥';
const se=['wood','wood','fire','fire','earth','earth','metal','metal','water','water'],be=['water','earth','wood','wood','earth','fire','fire','earth','metal','metal','earth','water'];
const pad=n=>String(n).padStart(2,'0');
const utc=p=>Date.UTC(p.year,p.month-1,p.day,p.hour||0,p.minute||0,p.second||0);
const formatters=new Map();
function civil(ms,zone){try{if(!formatters.has(zone)){if(formatters.size>=32)formatters.clear();formatters.set(zone,new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}))}return Object.fromEntries(formatters.get(zone).formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]))}catch{throw Error('INVALID_TIMEZONE')}}
export function resolveCivil(p,zone,fold){
 if(typeof zone!=='string'||zone.length>100)throw Error('INVALID_TIMEZONE');
 const target=utc(p),offsets=new Set();
 for(const hours of [-36,-24,-12,0,12,24,36]){const sample=target+hours*3600000;offsets.add(utc(civil(sample,zone))-sample)}
 const candidates=[...offsets].map(o=>target-o).filter(ms=>utc(civil(ms,zone))===target).sort((a,b)=>a-b);
 if(!candidates.length)throw Error('NONEXISTENT_LOCAL_TIME');
 if(candidates.length>1&&!['earlier','later'].includes(fold))throw Error('AMBIGUOUS_LOCAL_TIME');
 return fold==='later'?candidates.at(-1):candidates[0];
}
const asSolar=p=>Solar.fromYmdHms(p.year,p.month,p.day,p.hour||0,p.minute||0,p.second||0);
const pillar=code=>({code,stem:code[0],branch:code[1],stem_element:se[stems.indexOf(code[0])],branch_element:be[branches.indexOf(code[1])]});
function calculateAt(p,zone,boundary,fold){
 const instant=resolveCivil(p,zone,fold),termCalendar=asSolar(civil(instant,'Asia/Shanghai')).getLunar(),local=asSolar(p).getLunar().getEightChar();
 local.setSect(boundary==='zi_23'?1:2);
 return {instant:new Date(instant).toISOString(),pillars:{year:pillar(termCalendar.getYearInGanZhiExact()),month:pillar(termCalendar.getMonthInGanZhiExact()),day:pillar(local.getDay()),hour:pillar(local.getTime())}};
}
export function calculateBazi(input){
 input=normalizeBirthInput(input);
 if(!input||!['solar','lunar'].includes(input.calendar)||!['midnight','zi_23'].includes(input.day_boundary))throw Error('INVALID_CONVENTION');
 let {year,month,day}=input;if(![year,month,day].every(Number.isInteger)||year<1901||year>2100||month<1||month>12||day<1||day>31)throw Error('INVALID_BIRTH_DATE');
 if(input.calendar==='lunar'){try{const l=Lunar.fromYmd(year,input.leap_month?-month:month,day);const s=l.getSolar(),back=s.getLunar();if(back.getYear()!==year||Math.abs(back.getMonth())!==month||back.getDay()!==day||((back.getMonth()<0)!==!!input.leap_month))throw Error();[year,month,day]=[s.getYear(),s.getMonth(),s.getDay()]}catch{throw Error('INVALID_LUNAR_DATE')}}
 const d=new Date(Date.UTC(year,month-1,day));if(d.getUTCFullYear()!==year||d.getUTCMonth()+1!==month||d.getUTCDate()!==day)throw Error('INVALID_BIRTH_DATE');
 const p={year,month,day,hour:0,minute:0,second:0};let result;const uncertain=[];
 if(input.unknown_time===true){
  // All possible civil hours are inspected. No invented birth instant is returned.
  const possibilities=[];
  for(let hour=0;hour<24;hour++)for(const minute of [0,59]){try{const candidate={...p,hour,minute,second:minute===59?59:0};possibilities.push(calculateAt(candidate,input.timezone,input.day_boundary,'earlier'));possibilities.push(calculateAt(candidate,input.timezone,input.day_boundary,'later'))}catch(e){if(e.message!=='NONEXISTENT_LOCAL_TIME')throw e}}
  if(!possibilities.length)throw Error('NONEXISTENT_LOCAL_TIME');
  result={instant:null,pillars:{...possibilities[0].pillars,hour:null}};
  for(const k of ['year','month','day'])if(new Set(possibilities.map(x=>x.pillars[k].code)).size>1){result.pillars[k]=null;uncertain.push(k)}
 }else{
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time||''))throw Error('INVALID_BIRTH_TIME');
  const [hour,minute]=input.time.split(':').map(Number);result=calculateAt({...p,hour,minute},input.timezone,input.day_boundary,input.dst_fold);
 }
 const five_elements={wood:0,fire:0,earth:0,metal:0,water:0};for(const q of Object.values(result.pillars))if(q){five_elements[q.stem_element]++;five_elements[q.branch_element]++}
 const l=Solar.fromYmd(year,month,day).getLunar();
 const termCalendar=result.instant?asSolar(civil(Date.parse(result.instant),'Asia/Shanghai')).getLunar():null;
 const term=q=>({name:q.getName(),at:q.getSolar().toYmdHms(),timezone:'Asia/Shanghai'});
 return {engine_version:ENGINE_VERSION,...result,unknown_time:input.unknown_time===true,uncertain_pillars:uncertain,timezone:input.timezone,solar_date:`${year}-${pad(month)}-${pad(day)}`,lunar_date:{year:l.getYear(),month:Math.abs(l.getMonth()),day:l.getDay(),leap_month:l.getMonth()<0},solar_terms:termCalendar?{previous:term(termCalendar.getPrevJie()),next:term(termCalendar.getNextJie())}:null,five_elements,convention:{year:'LICHUN_INSTANT',month:'TWELVE_JIE_INSTANTS',solar_terms_time_basis:'Asia/Shanghai',day:input.day_boundary,hour:'LUNAR_LIBRARY_LATE_ZI_USES_NEXT_DAY_STEM',true_solar_time:false,elements:'VISIBLE_STEMS_AND_BRANCHES_UNWEIGHTED',supported_years:[1901,2100]},interpretation_kind:'CULTURE_REFLECTION_ONLY'};
}
export function dailyGuidance(date,timezone='Asia/Taipei'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('INVALID_BIRTH_DATE');const [year,month,day]=date.split('-').map(Number);
 const r=calculateBazi({year,month,day,calendar:'solar',time:'12:00',timezone,day_boundary:'midnight'});
 return {date,timezone,reference:'LOCAL_CIVIL_NOON_NOT_PERSONAL_PREDICTION',day:r.pillars.day,theme:r.pillars.day.stem_element,engine_version:ENGINE_VERSION,stored:false};
}
