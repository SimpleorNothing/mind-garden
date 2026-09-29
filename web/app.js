const q=s=>document.querySelector(s),room=q('#room'),plant=q('#plant'),time=q('#time'),stage=q('#stage'),rest=q('#rest'),msg=q('#msg'),bar=q('#bar'),next=q('#next');
const harvest=q('#harvest'),sunPoints=q('#sunPoints'),completedPlants=q('#completedPlants'),activePlantName=q('#activePlantName');
const MIN=60000,META_KEY='mindGardenMetaV1';

let CATALOG={
  species:(window.MIND_GARDEN_FLOWERS&&window.MIND_GARDEN_FLOWERS.species)||[],
  pots:[
    {id:'ivory',name:'아이보리 화분',icon:'◯',price:0},
    {id:'clay',name:'테라코타 화분',icon:'🟤',price:0},
    {id:'moss',name:'모스 화분',icon:'🟢',price:0},
    {id:'sage',name:'세이지 화분',icon:'🪴',price:0}
  ],
  scenes:[
    {id:'window',name:'햇살 좋은 거실 창가',icon:'☀️',price:0,image:'sunny-living-room.webp'},
    {id:'desk',name:'차분한 공부방 책상',icon:'📚',price:0,image:'calm-study-desk.webp'},
    {id:'balcony',name:'초록빛 베란다 정원',icon:'🌿',price:0,image:'green-veranda-garden.webp'},
    {id:'tea-yard',name:'차 마시는 뜰',icon:'🍵',price:0,image:'tea-yard-clean.webp'},
    {id:'tea-yard2',name:'산이 보이는 창가',icon:'🏔️',price:0,image:'tea-yard2-clean.webp'}
  ]
};

function loadFlowerCatalogFromGitHub(){
  fetch('data/flowers.json?v=4',{cache:'no-cache'})
    .then(r=>{if(!r.ok)throw new Error('flower catalog '+r.status);return r.json()})
    .then(data=>{
      if(!data||!Array.isArray(data.species)||!data.species.length)return;
      CATALOG.species=data.species;
      refreshFlowerChoices();applyCosmetics();draw();
      if(window.renderGardenRewards)window.renderGardenRewards();
    })
    .catch(()=>{});
}
loadFlowerCatalogFromGitHub();

async function loadGitHubFlowerCatalog(){
  try{
    const res=await fetch('data/flowers.json?v=4',{cache:'no-store'});
    if(!res.ok)throw new Error('flowers.json '+res.status);
    const data=await res.json();
    if(Array.isArray(data.species)&&data.species.length){
      CATALOG.species=data.species;
      refreshFlowerChoices();applyCosmetics();draw();
      if(window.renderGardenRewards)window.renderGardenRewards();
    }
  }catch(e){console.warn('GitHub flower catalog fallback',e)}
}
loadGitHubFlowerCatalog();

function localDateKey(d=new Date()){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function weekKey(d=new Date()){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),day=(x.getDay()+6)%7;
  x.setDate(x.getDate()-day);
  return localDateKey(x);
}
function defaultMeta(){
  return {
    schemaVersion:2,
    points:0,
    completedCount:0,
    codex:{},
    collection:[],
    seedCounts:{calendula:1,cornflower:0,pansy:0,nigella:0,chrysanthemum:0},
    inventory:{species:[],pots:['ivory'],scenes:['window']},
    active:{species:'calendula',pot:'ivory',scene:'window',planted:false},
    dailyFocus:{},
    week:{key:weekKey(),days:[],bonus3:false,bonus7:false},
    lastDailyCompletionBonus:'',
    social:{publicGardenOptIn:false,gardenId:null,displayName:'',syncRevision:0}
  };
}
function loadMeta(){
  let m=defaultMeta();
  try{
    const saved=JSON.parse(localStorage.getItem(META_KEY)||'null');
    if(saved&&typeof saved==='object'){
      m={...m,...saved};
      m.inventory={...m.inventory,...(saved.inventory||{})};
      m.seedCounts={...m.seedCounts,...(saved.seedCounts||{})};
      m.active={...m.active,...(saved.active||{})};
      m.social={...m.social,...(saved.social||{})};
      m.codex=saved.codex||{};
      m.collection=Array.isArray(saved.collection)?saved.collection:[];
      m.dailyFocus=saved.dailyFocus||{};
      m.week={...m.week,...(saved.week||{})};
    }
  }catch(_){}
  if(m.week.key!==weekKey())m.week={key:weekKey(),days:[],bonus3:false,bonus7:false};
  if(!CATALOG.species.some(x=>x.id===m.active.species))m.active.species='calendula';
  if(!CATALOG.scenes.some(x=>x.id===m.active.scene))m.active.scene='window';
  if(typeof m.active.planted!=='boolean')m.active.planted=true;
  m.schemaVersion=2;
  return m;
}
let meta=loadMeta(),total=+(localStorage.sun||0),running=false,start=0,wakeLock=null;
const FOCUS_KEY='mindGardenFocusSessionV1';
let focusSession=null;
try{const saved=JSON.parse(localStorage.getItem(FOCUS_KEY)||'null');if(saved&&['reading','study'].includes(saved.mode)&&Number.isFinite(saved.startedAt)&&Number.isFinite(saved.durationMs)&&saved.durationMs>0)focusSession=saved}catch(_){}

function saveMeta(){localStorage.setItem(META_KEY,JSON.stringify(meta))}
function catalogItem(type,id){return CATALOG[type].find(x=>x.id===id)||CATALOG[type][0]}
const SUNRISE=6*60+18,SUNSET=18*60+24,INDOOR_NIGHT_IMAGES={window:'sunny-living-room-night.webp',desk:'calm-study-desk-night.webp','tea-yard':'tea-yard-night.webp','tea-yard2':'tea-yard2-night.webp'};
function sceneBackground(id){const item=CATALOG.scenes.find(x=>x.id===id),m=new Date().getHours()*60+new Date().getMinutes(),image=m>=SUNSET?INDOOR_NIGHT_IMAGES[id]||item?.image:item?.image;return image?'url("assets/backgrounds/'+image+'?v=20260928-5") center/cover no-repeat':'linear-gradient(135deg,#e9f1e8,#d3e7e2)'}
function refreshFlowerChoices(){const select=q('#newSpecies');if(!select)return;const chosen=select.value||meta?.active?.species||'calendula';select.replaceChildren(...CATALOG.species.map(sp=>{const o=document.createElement('option');o.value=sp.id;o.textContent=sp.name+' · 무료';return o}));select.value=CATALOG.species.some(sp=>sp.id===chosen)?chosen:'calendula'}
function activeSpecies(){return catalogItem('species',meta.active.species)}
function growthTargetMs(){return activeSpecies().growthMinutes*MIN}
function stageInfo(elapsedMinutes){
  if(!meta.active.planted)return {name:'씨앗 대기',key:'empty'};
  const [germination,sprout,leaves,bud,bloom]=activeSpecies().stageMinutes;
  if(elapsedMinutes<germination)return {name:'씨앗',key:'seed',nextAt:germination};
  if(elapsedMinutes<sprout)return {name:'발아',key:'germination',nextAt:sprout};
  if(elapsedMinutes<leaves)return {name:'새싹',key:'sprout',nextAt:leaves};
  if(elapsedMinutes<bud)return {name:'본잎',key:'leaves',nextAt:bud};
  if(elapsedMinutes<bloom)return {name:'봉오리',key:'bud',nextAt:bloom};
  return {name:'개화',key:'bloom',nextAt:null};
}
function petalRing(count,rx,ry,dist,fill){
  let out='<g fill="'+fill+'">';
  for(let i=0;i<count;i++)out+='<ellipse rx="'+rx+'" ry="'+ry+'" transform="rotate('+(i*360/count)+') translate(0 -'+dist+')"/>';
  return out+'</g>';
}
function potBase(){
  return '<ellipse cx="90" cy="207" rx="52" ry="8" fill="#000" opacity=".12"/><path d="M50 150h80l-8 51c-1 6-7 9-14 9H72c-7 0-13-3-14-9z" fill="#ece5d8"/><ellipse cx="90" cy="150" rx="40" ry="10" fill="#f7f0e4"/><ellipse cx="90" cy="150" rx="33" ry="7" fill="#493726"/>';
}
function flowerSVG(id,key){
  const pot=potBase();
  if(key==='empty')return '<svg viewBox="0 0 180 220" role="img">'+pot+'</svg>';
  const seeds={
    calendula:'<path d="M84 146c9-8 18-3 12 5-5 6-13 5-12-5z" fill="#c6a35f" stroke="#84682f" stroke-width="2"/>',
    cornflower:'<ellipse cx="90" cy="146" rx="5" ry="8" fill="#b9a36c"/><path d="M90 138l-5-7m5 7v-9m0 9l5-7" stroke="#d9d1ad" stroke-width="1.4"/>',
    pansy:'<ellipse cx="90" cy="146" rx="4.5" ry="5.5" fill="#6d4a2a"/>',
    nigella:'<path d="M85 149l3-8 7 2 1 7-6 4z" fill="#181818"/>'
  };
  if(key==='seed')return '<svg viewBox="0 0 180 220" role="img">'+pot+seeds[id]+'</svg>';
  if(key==='germination')return '<svg viewBox="0 0 180 220" role="img">'+pot+'<path d="M90 150c0-10 0-15 2-22" stroke="#6f9d4f" stroke-width="4" fill="none"/><path d="M92 130c-9-1-12-6-12-11 8-2 13 2 12 11z" fill="#91bf6d"/></svg>';
  const stem='<path d="M90 150C90 132 91 111 90 91" fill="none" stroke="#4d7f3b" stroke-width="5" stroke-linecap="round"/>';
  const cot='<path d="M90 132C77 131 71 123 71 114c12-2 20 4 19 18z" fill="#77ad58"/><path d="M91 128c3-11 11-17 21-16 0 11-7 18-21 16z" fill="#8abc65"/>';
  if(key==='sprout')return '<svg viewBox="0 0 180 220" role="img">'+pot+stem+cot+'</svg>';
  let leaves='',bud='',flower='';
  if(id==='calendula'){
    leaves='<path d="M90 124C70 121 65 110 68 101c16 1 23 9 22 23zM91 110c12-13 24-14 31-8-6 12-17 15-31 8z" fill="#6d9a50"/>';
    bud='<circle cx="90" cy="87" r="8" fill="#76a44e"/>';
    flower='<g transform="translate(90 82)">'+petalRing(14,6,18,13,'#ed9c2b')+'<circle r="10" fill="#7f5422"/><circle r="5" fill="#c77a19"/></g>';
  }else if(id==='cornflower'){
    leaves='<path d="M90 128c-12-10-18-20-15-29 10 4 15 13 15 29zM92 118c9-14 17-19 24-17-3 11-10 17-24 17z" fill="#789a78"/>';
    bud='<path d="M82 91q8-13 16 0l-2 8H84z" fill="#607c58"/>';
    flower='<g transform="translate(90 80)" fill="#477dcc">';
    for(let i=0;i<12;i++)flower+='<path d="M0 0 L-5 -24 L0 -19 L5 -24 Z" transform="rotate('+(i*30)+')"/>';
    flower+='<circle r="7" fill="#34538a"/></g>';
  }else if(id==='pansy'){
    leaves='<ellipse cx="76" cy="120" rx="17" ry="9" transform="rotate(-22 76 120)" fill="#668d49"/><ellipse cx="104" cy="116" rx="18" ry="10" transform="rotate(24 104 116)" fill="#739c52"/>';
    bud='<ellipse cx="90" cy="88" rx="8" ry="11" fill="#694d83"/>';
    flower='<g transform="translate(90 82)"><ellipse cx="-11" cy="-5" rx="15" ry="19" fill="#76519c"/><ellipse cx="11" cy="-5" rx="15" ry="19" fill="#76519c"/><ellipse cx="-10" cy="12" rx="14" ry="17" fill="#8b68ad"/><ellipse cx="10" cy="12" rx="14" ry="17" fill="#8b68ad"/><ellipse cy="17" rx="13" ry="17" fill="#f0c84f"/><path d="M-8 5L0 14 8 5M0 14v10" stroke="#4a315f" stroke-width="4" fill="none"/></g>';
  }else{
    leaves='<g stroke="#56805c" stroke-width="2" stroke-linecap="round"><path d="M90 134l-22-22m22 10l21-27m-20 19l-18-27m18 18l23-20"/><path d="M73 112l-10-2m10 2l-4-10m31-2l10-5m-10 5l3-11m-26 1l-8-8m8 8l2-12"/></g>';
    bud='<path d="M84 92q6-14 12 0l-1 8H85z" fill="#5b8060"/>';
    flower='<g transform="translate(90 80)">'+petalRing(8,7,21,9,'#9cc9dd')+'<circle r="8" fill="#527a83"/>';
    for(let i=0;i<10;i++)flower+='<path d="M0 0v-13" transform="rotate('+(i*36)+')" stroke="#385e50" stroke-width="1"/>';
    flower+='</g>';
  }
  return '<svg viewBox="0 0 180 220" role="img">'+pot+stem+cot+leaves+(key==='leaves'?'':(key==='bud'?bud:flower))+'</svg>';
}
window.__flowerFallback=(id,key)=>flowerSVG(id,key);
function renderPlantVisual(ratio,elapsedMinutes){
  const sp=activeSpecies(),st=stageInfo(elapsedMinutes);
  const cutout=null;
  const image=cutout||(sp.growthImages&&sp.growthImages[st.key]);
  plant.innerHTML=image?'<img class="plantPot" src="assets/pots/ivory-ceramic.webp?v=20260929-3" alt="" aria-hidden="true"><img class="growthStageImage" src="'+image+'?v=20260929-3" alt="'+sp.name+' '+st.name+'" draggable="false">':flowerSVG(sp.id,st.key);
  plant.classList.toggle('photo-growth',Boolean(image));
  plant.classList.toggle('opaque-cutout',Boolean(cutout));
  plant.classList.remove('needs-pot');
  plant.dataset.stage=st.key;
  plant.dataset.species=sp.id;
  plant.dataset.pot=meta.active.pot;
  stage.textContent=st.name;
}
function applyCosmetics(){
  const sp=activeSpecies();
  plant.dataset.species=sp.id;
  plant.dataset.pot=meta.active.pot;
  room.dataset.scene=meta.active.scene;
  if(!room.classList.contains('has-photo'))room.style.background=sceneBackground(meta.active.scene);
  activePlantName.textContent=meta.active.planted
    ?sp.icon+' '+sp.name+' · '+sp.difficulty+' · '+sp.growthMinutes+'분'
    :'씨앗을 선택해 심어주세요';
}
function refreshMetaSummary(){
  sunPoints.textContent=meta.points.toLocaleString()+'P';
  completedPlants.textContent=meta.completedCount.toLocaleString();
  q('#sheetPoints')&&(q('#sheetPoints').textContent=meta.points.toLocaleString()+'P');
  q('#sheetCompleted')&&(q('#sheetCompleted').textContent=meta.completedCount.toLocaleString());
  q('#weekDays')&&(q('#weekDays').textContent=(meta.week.days?.length||0)+'/7');
}
function showReward(text){
  const el=q('#rewardToast');if(!el)return;
  el.textContent=text;el.classList.add('show');
  clearTimeout(showReward.t);showReward.t=setTimeout(()=>el.classList.remove('show'),2600);
}
function unlockWeeklyRewards(){
  const n=meta.week.days.length;
  if(n>=3&&!meta.week.bonus3){
    meta.week.bonus3=true;
    if(!meta.inventory.pots.includes('sage'))meta.inventory.pots.push('sage');
    showReward('이번 주 3일 달성 · 세이지 화분 해금');
  }
  if(n>=7&&!meta.week.bonus7){
    meta.week.bonus7=true;
    meta.seedCounts.pansy=(meta.seedCounts.pansy||0)+1;
    showReward('이번 주 7일 달성 · 팬지 씨앗 1개 선물');
  }
}
function recordFocus(ms,day=localDateKey()){
  if(ms<=0)return;
  meta.dailyFocus[day]=(meta.dailyFocus[day]||0)+ms;
  if(meta.week.key===weekKey(new Date(day+'T12:00:00'))&&meta.dailyFocus[day]>=10*MIN&&!meta.week.days.includes(day)){
    meta.week.days.push(day);unlockWeeklyRewards();
  }
  saveMeta();
}
const focusLabels={reading:'독서',study:'공부'};
let focusMode='reading';
function focusElapsed(){return focusSession?Math.min(focusSession.durationMs,Math.max(0,Date.now()-focusSession.startedAt)):0}
function creditFocus(session,elapsed){
  if(elapsed<=0)return;
  total+=elapsed;localStorage.sun=total;
  const day=localDateKey(new Date(session.startedAt));
  recordFocus(elapsed,day);
  meta.focusByDay=meta.focusByDay||{};
  meta.focusByDay[day]=meta.focusByDay[day]||{reading:0,study:0};
  meta.focusByDay[day][session.mode]=(meta.focusByDay[day][session.mode]||0)+elapsed;
  saveMeta();
}
function finishFocus(completed=false){
  if(!focusSession)return;
  const session=focusSession,elapsed=focusElapsed();
  focusSession=null;localStorage.removeItem(FOCUS_KEY);
  creditFocus(session,elapsed);
  q('#focusMessage').textContent=completed?focusLabels[session.mode]+' '+Math.round(elapsed/MIN)+'분을 마쳤어요. 식물이 자랐습니다.':elapsed<MIN?'집중을 마쳤어요. 짧은 시간도 차곡차곡 기록했어요.':focusLabels[session.mode]+' '+Math.round(elapsed/MIN)+'분을 기록했어요.';
  renderFocus();draw();
}
function renderFocus(){
  const active=!!focusSession,mode=active?focusSession.mode:focusMode;
  q('#focusReading').classList.toggle('selected',mode==='reading');
  q('#focusStudy').classList.toggle('selected',mode==='study');
  q('#focusReading').setAttribute('aria-pressed',String(mode==='reading'));
  q('#focusStudy').setAttribute('aria-pressed',String(mode==='study'));
  q('#focusReading').disabled=active;q('#focusStudy').disabled=active;
  q('#focusDuration').disabled=active;
  const remaining=active?Math.max(0,focusSession.durationMs-focusElapsed()):Number(q('#focusDuration').value)*MIN;
  q('#focusClock').textContent=String(Math.floor(remaining/MIN)).padStart(2,'0')+':'+String(Math.floor(remaining/1000)%60).padStart(2,'0');
  q('#focusStart').hidden=active;q('#focusStop').hidden=!active;
  q('#focusStart').textContent=focusLabels[mode]+' 시작';
  const today=meta.focusByDay?.[localDateKey()]||{};
  q('#readingToday').textContent=Math.floor(((today.reading||0)+(active&&mode==='reading'?focusElapsed():0))/MIN)+'분';
  q('#studyToday').textContent=Math.floor(((today.study||0)+(active&&mode==='study'?focusElapsed():0))/MIN)+'분';
}
function startFocus(){
  if(focusSession)return;
  if(!meta.active.planted){showReward('먼저 꽃 씨앗을 심어주세요');return}
  if(running)stopRest('manual');
  focusSession={mode:focusMode,startedAt:Date.now(),durationMs:Number(q('#focusDuration').value)*MIN};
  localStorage.setItem(FOCUS_KEY,JSON.stringify(focusSession));
  q('#focusMessage').textContent=focusLabels[focusMode]+' 중입니다. 화면을 꺼도 타이머는 이어져요.';
  renderFocus();draw();
}
q('#focusReading').onclick=()=>{focusMode='reading';renderFocus()};
q('#focusStudy').onclick=()=>{focusMode='study';renderFocus()};
q('#focusDuration').onchange=renderFocus;
q('#focusStart').onclick=startFocus;
q('#focusStop').onclick=()=>finishFocus(false);
renderFocus();
function draw(){
  if(focusSession&&focusElapsed()>=focusSession.durationMs)finishFocus(true);
  let t=total+(running?Date.now()-start:0)+focusElapsed(),m=Math.floor(t/MIN),sec=Math.floor(t/1000)%60;
  renderFocus();
  const target=activeSpecies().growthMinutes,ratio=meta.active.planted?Math.min(1,t/(target*MIN)):0;
  time.textContent=String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  renderPlantVisual(ratio,m);
  plant.style.transform='translateX(-50%) scale('+(1+ratio*.2)+')';
  bar.style.width=(ratio*100)+'%';
  if(!meta.active.planted){
    next.textContent='상점에서 원하는 꽃을 무료로 선택해 주세요.';
    harvest.hidden=true;rest.disabled=true;
  }else if(ratio>=1){
    next.textContent='꽃이 활짝 폈어요. 수확하면 햇살 포인트를 받아요.';
    harvest.textContent='꽃 수확하기 · +'+activeSpecies().reward+'P';
    harvest.hidden=false;rest.disabled=true;
  }else{
    const st=stageInfo(m),toNext=st.nextAt===null?0:Math.max(0,st.nextAt-m);
    next.textContent=(st.nextAt===target?'개화':'다음 단계')+'까지 '+toNext+'분 · '+activeSpecies().difficulty;
    harvest.hidden=true;rest.disabled=false;
  }
}
setInterval(draw,1000);draw();

async function setScreenAwake(on){
  try{
    if(window.AndroidBridge&&typeof window.AndroidBridge.setKeepScreenOn==='function'){
      window.AndroidBridge.setKeepScreenOn(on);return;
    }
    if(on&&'wakeLock' in navigator){if(!wakeLock)wakeLock=await navigator.wakeLock.request('screen')}
    else if(!on&&wakeLock){await wakeLock.release();wakeLock=null}
  }catch(_){wakeLock=null}
}
function startRest(){
  if(focusSession){showReward('진행 중인 집중 시간을 먼저 마쳐주세요');return}
  if(!meta.active.planted){showReward('먼저 꽃 씨앗을 심어주세요');return}
  if(running||total>=growthTargetMs())return;
  running=true;start=Date.now();rest.textContent='휴식 종료';room.classList.add('active');
  msg.textContent='광합성 중이에요. 화면은 켜진 상태로 유지됩니다.';
  setScreenAwake(true);draw();
}
function stopRest(reason='manual'){
  if(!running)return;
  const elapsed=Date.now()-start;
  total+=elapsed;localStorage.sun=total;recordFocus(elapsed);
  running=false;rest.textContent='햇살 휴식 시작';room.classList.remove('active');setScreenAwake(false);
  msg.textContent=reason==='background'?'앱을 벗어나 햇살 휴식이 정지됐어요. 다시 시작해 주세요.':'잘 쉬었어요. 식물이 조금 더 자랐습니다.';
  draw();
}
function harvestPlant(){
  if(focusSession)finishFocus(false);
  if(running)stopRest('manual');
  const sp=activeSpecies();
  if(total<growthTargetMs())return;
  const today=localDateKey();
  let reward=sp.reward;
  if(meta.lastDailyCompletionBonus!==today){reward+=20;meta.lastDailyCompletionBonus=today}
  meta.points+=reward;meta.completedCount+=1;
  meta.codex[sp.id]=(meta.codex[sp.id]||0)+1;
  meta.collection.unshift({
    id:'plant-'+Date.now(),
    species:sp.id,
    speciesName:sp.name,
    completedAt:new Date().toISOString(),
    focusMinutes:sp.growthMinutes,
    visibility:'private',
    shareId:null
  });
  total=0;localStorage.sun=0;
  meta.active.planted=false;
  saveMeta();refreshMetaSummary();applyCosmetics();renderGardenRewards();
  showReward(sp.name+' 완성 · +'+reward+'P');
  msg.textContent=reward>100?'오늘 첫 완성 보너스까지 받았어요.':'완성한 식물이 내 정원에 보관됐어요.';
  draw();
}
rest.onclick=()=>running?stopRest('manual'):startRest();
harvest.onclick=harvestPlant;
window.mindGardenPauseForBackground=()=>stopRest('background');
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRest('background');else draw()});
window.addEventListener('pagehide',()=>stopRest('background'));
applyCosmetics();refreshMetaSummary();

q('#water').onclick=()=>{plant.style.transform='translateX(-50%) scale(1.08)';setTimeout(()=>plant.style.transform='translateX(-50%)',450);msg.textContent='물을 천천히 마시고 있어요.'};q('#leaf').onclick=()=>{plant.style.filter='drop-shadow(0 12px 7px #0002) brightness(1.18)';setTimeout(()=>plant.style.filter='',700);msg.textContent='잎이 반짝반짝 깨끗해졌어요.'};const roomPhoto=q('#roomPhoto');function applyRoomPhoto(data){roomPhoto.src=data;room.classList.add('has-photo');room.style.backgroundImage='none'}q('#photo').onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader;r.onload=()=>{applyRoomPhoto(r.result);try{localStorage.room=r.result}catch(_){}};r.readAsDataURL(f)};try{if(localStorage.room)applyRoomPhoto(localStorage.room)}catch(_){};


;(()=>{const roomPhoto=q('#roomPhoto'),editPanel=q('#editPanel'),editPlant=q('#editPlant'),editRoom=q('#editRoom'),minus=q('#sizeMinus'),plus=q('#sizePlus'),done=q('#editDone'),target=q('#editTarget');
let px=parseFloat(localStorage.plantX)||50,py=parseFloat(localStorage.plantY)||72,ps=parseFloat(localStorage.plantSize)||130;
let rx=parseFloat(localStorage.roomX)||50,ry=parseFloat(localStorage.roomY)||50,rs=parseFloat(localStorage.roomScale)||1;
let mode='plant',editing=false,drag=false,pid=null,startX=0,startY=0,baseX=0,baseY=0;
function plantPlace(){plant.style.setProperty('left',px+'%','important');plant.style.setProperty('top',py+'%','important');plant.style.setProperty('bottom','auto','important');plant.style.setProperty('width',ps+'px','important');plant.style.setProperty('height',(ps*1.31)+'px','important');plant.style.setProperty('transform','translate(-50%,-50%)','important')}
function roomPlace(){roomPhoto.style.left=rx+'%';roomPhoto.style.top=ry+'%';roomPhoto.style.transform='translate(-50%,-50%) scale('+rs+')'}
function save(){localStorage.plantX=px;localStorage.plantY=py;localStorage.plantSize=ps;localStorage.roomX=rx;localStorage.roomY=ry;localStorage.roomScale=rs}
function setMode(m){mode=m;room.classList.toggle('edit-plant',m==='plant');room.classList.toggle('edit-room',m==='room');editPlant.classList.toggle('on',m==='plant');editRoom.classList.toggle('on',m==='room');target.textContent=m==='plant'?'화분 조절':'내 집 이미지 조절'}
function beginEdit(m){editing=true;room.classList.add('editing');setMode(m)}
function point(e){let r=room.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100}}
let holdTimer=null,holdStart=null;
function cancelHold(){if(holdTimer){clearTimeout(holdTimer);holdTimer=null}holdStart=null}
function armHold(e,m,el){if(editing){if(mode!==m)return;drag=true;pid=e.pointerId;if(m==='room'){let p=point(e);startX=p.x;startY=p.y;baseX=rx;baseY=ry}try{el.setPointerCapture(pid)}catch(_){};e.preventDefault();return}
holdStart={x:e.clientX,y:e.clientY};pid=e.pointerId;
holdTimer=setTimeout(()=>{holdTimer=null;beginEdit(m);drag=true;if(m==='room'){let p=point(e);startX=p.x;startY=p.y;baseX=rx;baseY=ry}try{el.setPointerCapture(pid)}catch(_){};if(navigator.vibrate)navigator.vibrate(35)},800)}
function holdMove(e){if(!holdTimer||!holdStart)return;if(Math.hypot(e.clientX-holdStart.x,e.clientY-holdStart.y)>12)cancelHold()}
plant.addEventListener('pointerdown',e=>armHold(e,'plant',plant));
roomPhoto.addEventListener('pointerdown',e=>armHold(e,'room',roomPhoto));
plant.addEventListener('pointermove',holdMove);roomPhoto.addEventListener('pointermove',holdMove);
plant.addEventListener('pointerup',()=>{if(holdTimer)cancelHold()});roomPhoto.addEventListener('pointerup',()=>{if(holdTimer)cancelHold()});
room.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==pid)return;let p=point(e);if(mode==='plant'){px=Math.max(4,Math.min(96,p.x));py=Math.max(8,Math.min(94,p.y));plantPlace()}else{rx=Math.max(0,Math.min(100,baseX+p.x-startX));ry=Math.max(0,Math.min(100,baseY+p.y-startY));roomPlace()}e.preventDefault()});
function end(){cancelHold();drag=false;pid=null}room.addEventListener('pointerup',end);room.addEventListener('pointercancel',end);
editPlant.onclick=e=>{e.stopPropagation();setMode('plant')};editRoom.onclick=e=>{e.stopPropagation();setMode('room')};
minus.onclick=e=>{e.stopPropagation();if(mode==='plant')ps=Math.max(55,ps-12);else rs=Math.max(.6,rs-.08);plantPlace();roomPlace()};
plus.onclick=e=>{e.stopPropagation();if(mode==='plant')ps=Math.min(280,ps+12);else rs=Math.min(2.5,rs+.08);plantPlace();roomPlace()};
done.onclick=e=>{e.stopPropagation();save();editing=false;drag=false;room.classList.remove('editing','edit-plant','edit-room')};

plantPlace();roomPlace()})();

// Evening apartment lights are anchored to the window in the supplied room photo.
;(()=>{
  const lights=document.createElement('div');
  lights.id='cityLights';
  lights.setAttribute('aria-hidden','true');
  const windows=[
    [48,55],[53,57],[59,56],[65,55],[72,56],[78,54],
    [48,61],[54,62],[60,61],[66,62],[73,61],[79,62],
    [49,68],[55,67],[61,69],[67,68],[74,68],[80,67],
    [49,74],[55,75],[62,74],[68,75],[75,74],[81,75]
  ];
  windows.forEach(([x,y],i)=>{
    if(![0,2,4,7,10,12,15,17,19,21,23].includes(i))return;
    const pane=document.createElement('i');
    pane.style.left=x+'%';
    pane.style.top=y+'%';
    lights.appendChild(pane);
  });
  room.insertBefore(lights,q('#plantShadow'));
})();
;(()=>{const light=q('#liveLight'),sun=q('#sun'),shadow=q('#plantShadow');const rise=SUNRISE,set=SUNSET;
function live(){if(room.dataset.live==='0'){room.classList.remove('live-night','live-twilight','live-dawn','live-day','live-evening');sun.style.opacity='0';shadow.style.opacity='0';return}const hasPhoto=room.classList.contains('has-photo'),n=new Date(),m=n.getHours()*60+n.getMinutes(),day=m>=rise&&m<=set,p=Math.max(0,Math.min(1,(m-rise)/(set-rise))),noon=(rise+set)/2,side=Math.max(-1,Math.min(1,(m-noon)/((set-rise)/2)));
room.classList.remove('live-night','live-lit-night','live-dawn','live-day','live-evening');
if(m<rise)room.classList.add('live-night');else if(m>set)room.classList.add('live-lit-night');else if(p<.16)room.classList.add('live-dawn');else if(p>.82)room.classList.add('live-evening');else room.classList.add('live-day');
if(!hasPhoto)room.style.background=sceneBackground(meta.active.scene);
if(day&&hasPhoto){sun.style.left=(7+86*p)+'%';sun.style.right='auto';sun.style.top=(38-27*Math.sin(Math.PI*p))+'px';sun.style.opacity='1';sun.style.filter='brightness('+(1+.18*Math.sin(Math.PI*p))+')';}else sun.style.opacity='0';
const pr=plant.getBoundingClientRect(),rr=room.getBoundingClientRect(),cx=pr.left-rr.left+pr.width/2,cy=pr.bottom-rr.top-8;
shadow.style.left=cx+'px';shadow.style.top=cy+'px';shadow.style.opacity=hasPhoto&&day?String(.18+.22*Math.abs(side)):'0';shadow.style.width=(55+105*Math.abs(side))+'px';shadow.style.transform='rotate('+(90+62*side)+'deg)';
}
live();setInterval(live,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)live()});window.addEventListener('pageshow',live);window.addEventListener('resize',live);new MutationObserver(live).observe(room,{attributes:true,attributeFilter:['data-live']});room.addEventListener('pointerup',()=>setTimeout(live,0));q('#editDone').addEventListener('click',()=>setTimeout(live,0));
})();
// Virtual scenes reflect weather only. Use an existing location permission, otherwise Seoul.
;(()=>{
  const states=['weather-clear','weather-cloudy','weather-rain','weather-snow'];
  function show(code,location){
    room.classList.remove(...states);
    const state=[71,73,75,77,85,86].includes(code)?'weather-snow':([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)?'weather-rain':([1,2,3,45,48].includes(code)?'weather-cloudy':'weather-clear'));
    room.classList.add(state);
    room.title='가상 배경 날씨 · '+location+' 기준';
  }
  async function update(){
    let latitude=37.5665,longitude=126.978,location='서울';
    try{
      if(navigator.permissions&&navigator.geolocation){
        const permission=await navigator.permissions.query({name:'geolocation'});
        if(permission.state==='granted'){
          const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:5000,maximumAge:3600000}));
          latitude=position.coords.latitude;longitude=position.coords.longitude;location='현재 위치';
        }
      }
    }catch(_){}
    try{
      const url='https://api.open-meteo.com/v1/forecast?latitude='+latitude+'&longitude='+longitude+'&current=weather_code&timezone=auto';
      const response=await fetch(url);
      if(!response.ok)throw Error('weather unavailable');
      const data=await response.json();
      if(Number.isFinite(data.current?.weather_code))show(data.current.weather_code,location);
    }catch(_){room.classList.remove(...states);room.removeAttribute('title')}
  }
  update();setInterval(update,30*60*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();
;(()=>{const home=q('#homeSheet'),add=q('#addSheet'),list=q('#plantList'),photo=q('#photo'),virtual=q('#virtualChoices'),name=q('#newName'),place=q('#newPlace'),live=q('#newLive');let imageMode='mine',virtualId='',pendingImage='',editingIndex=-1,activePlantIndex=-1;let plants=[];try{plants=JSON.parse(localStorage.myPlants||'[]')}catch(_){}
function compressImage(file,cb){let r=new FileReader;r.onload=()=>{let im=new Image;im.onload=()=>{let max=1400,s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);let out=c.toDataURL('image/jpeg',.78);cb(out)};im.src=r.result};r.readAsDataURL(file)}
function bgFor(v){return sceneBackground(v)}
const actionDialog=q('#plantActionDialog'),actionTitle=q('#plantActionTitle'),actionMessage=q('#plantActionMessage');
let actionIndex=-1;
function closeActions(){actionDialog.hidden=true;actionIndex=-1;actionDialog.dataset.confirm='0'}
function openActions(i){actionIndex=i;actionDialog.dataset.confirm='0';actionTitle.textContent=plants[i].name;actionMessage.textContent='이 식물을 어떻게 할까요?';q('#plantActionEdit').hidden=false;q('#plantActionDelete').textContent='삭제';actionDialog.hidden=false}
function setImageMode(mode){imageMode=mode;q('#useMine').classList.toggle('on',mode==='mine');q('#useVirtual').classList.toggle('on',mode==='virtual');virtual.classList.toggle('show',mode==='virtual')}
function resetEditor(){editingIndex=-1;name.value='';place.value='';live.checked=true;q('#newSpecies').value='calendula';pendingImage='';virtualId='';photo.value='';setImageMode('mine');virtual.querySelectorAll('button').forEach(b=>b.classList.remove('on'));q('#plantEditorTitle').textContent='식물 추가';q('#savePlant').textContent='추가 완료'}
function editPlant(i){const p=plants[i];editingIndex=i;refreshFlowerChoices();name.value=p.name;place.value=p.place;q('#newSpecies').value=p.species||'calendula';live.checked=!!p.live;pendingImage=p.image||'';virtualId=p.virtual||'';photo.value='';setImageMode(p.image?'mine':'virtual');virtual.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===virtualId));q('#plantEditorTitle').textContent='식물 수정';q('#savePlant').textContent='수정 완료';closeActions();home.classList.remove('open');add.classList.add('open')}
actionDialog.addEventListener('click',e=>{if(e.target===actionDialog)closeActions()});q('#plantActionCancel').onclick=closeActions;q('#plantActionEdit').onclick=()=>{if(actionIndex>=0)editPlant(actionIndex)};
q('#plantActionDelete').onclick=()=>{if(actionIndex<0)return;if(actionDialog.dataset.confirm!=='1'){actionDialog.dataset.confirm='1';actionMessage.textContent='「'+plants[actionIndex].name+'」을(를) 내 정원에서 삭제할까요?';q('#plantActionEdit').hidden=true;q('#plantActionDelete').textContent='삭제 확인';return}
const i=actionIndex,removed=plants.splice(i,1)[0];try{localStorage.myPlants=JSON.stringify(plants)}catch(_){plants.splice(i,0,removed);alert('삭제 내용을 저장하지 못했습니다.');return}closeActions();if(activePlantIndex===i){activePlantIndex=-1;if(plants.length){render();list.querySelector('.plantItem button')?.click()}else{meta.active.planted=false;saveMeta();draw()}}else{if(activePlantIndex>i)activePlantIndex--;render()}};
function render(){list.innerHTML=plants.length?'':'<p style="color:#788078">아직 등록한 식물이 없습니다. 거실 창가나 공부방 책상 위의 식물을 추가해 보세요.</p>';
plants.forEach((p,i)=>{const d=document.createElement('div');d.className='plantItem';const bg=p.image?'url('+p.image+')':bgFor(p.virtual);d.innerHTML='<div class="plantThumb" style="background:'+bg+'">🪴</div><div><strong>'+p.name+'</strong><small>'+p.place+' · '+(p.live?'LIVE':'고정 환경')+'</small></div><button>보기</button>';
let hold=null,sx=0,sy=0,held=false;const cancel=()=>{if(hold){clearTimeout(hold);hold=null}};
d.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;sx=e.clientX;sy=e.clientY;held=false;cancel();hold=setTimeout(()=>{hold=null;held=true;if(navigator.vibrate)navigator.vibrate(35);openActions(i)},700)});
d.addEventListener('pointermove',e=>{if(hold&&Math.hypot(e.clientX-sx,e.clientY-sy)>12)cancel()});['pointerup','pointercancel','pointerleave'].forEach(t=>d.addEventListener(t,cancel));d.addEventListener('contextmenu',e=>e.preventDefault());
d.querySelector('button').onclick=()=>{if(held)return;activePlantIndex=i;if(p.image){const rp=q('#roomPhoto');rp.onload=()=>{room.classList.add('has-photo');room.style.backgroundImage='none';room.style.background=''};rp.onerror=()=>alert('저장된 이미지를 불러오지 못했습니다. 내 정원에서 이미지를 다시 선택해 주세요.');rp.src=p.image;room.classList.add('has-photo');room.style.backgroundImage='none';room.style.background=''}else{q('#roomPhoto').removeAttribute('src');room.classList.remove('has-photo');localStorage.removeItem('room');room.style.background=bgFor(p.virtual);meta.active.scene=p.virtual||'window';saveMeta()}room.dataset.live=p.live?'1':'0';if(p.species&&p.species!==meta.active.species){meta.active.species=p.species;meta.active.planted=true;total=0;localStorage.sun=0;saveMeta();applyCosmetics();draw()}home.classList.remove('open')};list.appendChild(d)})}
q('#myHome').onclick=()=>{render();home.classList.add('open')};q('#homeClose').onclick=()=>home.classList.remove('open');q('#addPlant').onclick=()=>{refreshFlowerChoices();resetEditor();home.classList.remove('open');add.classList.add('open')};q('#addClose').onclick=()=>{add.classList.remove('open');resetEditor()};
q('#useMine').onclick=()=>{setImageMode('mine');photo.click()};
q('#useVirtual').onclick=()=>setImageMode('virtual');
photo.addEventListener('change',e=>{let f=e.target.files[0];if(!f)return;compressImage(f,out=>{pendingImage=out})});
virtual.querySelectorAll('button').forEach(b=>b.onclick=()=>{virtualId=b.dataset.v;virtual.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))});
q('#savePlant').onclick=()=>{if(!name.value.trim()||!place.value.trim())return alert('식물 이름과 장소를 입력해 주세요.');if(imageMode==='mine'&&!pendingImage)return alert('내 이미지를 선택해 주세요.');if(imageMode==='virtual'&&!virtualId)return alert('가상 이미지를 선택해 주세요.');const added={name:name.value.trim(),place:place.value.trim(),species:q('#newSpecies').value||'calendula',live:live.checked,image:imageMode==='mine'?pendingImage:'',virtual:imageMode==='virtual'?virtualId:''};if(editingIndex>=0){const i=editingIndex,old=plants[i];plants[i]=added;try{localStorage.myPlants=JSON.stringify(plants)}catch(_){plants[i]=old;alert('저장 공간이 부족합니다. 사진을 더 압축해 다시 시도해 주세요.');return}add.classList.remove('open');resetEditor();render();if(i===activePlantIndex)list.querySelectorAll('.plantItem button')[i]?.click();return}plants.push(added);activePlantIndex=plants.length-1;try{localStorage.myPlants=JSON.stringify(plants)}catch(_){plants.pop();alert('저장 공간이 부족합니다. 사진을 더 압축해 다시 시도해 주세요.');return}if(added.image){const rp=q('#roomPhoto');rp.src=added.image;room.classList.add('has-photo');room.style.backgroundImage='none';room.style.background='';}else{q('#roomPhoto').removeAttribute('src');room.classList.remove('has-photo');localStorage.removeItem('room');room.style.background=bgFor(added.virtual)};room.dataset.live=added.live?'1':'0';meta.active.species=added.species;meta.active.planted=true;meta.active.scene=added.virtual||meta.active.scene;total=0;localStorage.sun=0;saveMeta();applyCosmetics();draw();name.value='';place.value='';pendingImage='';virtualId='';add.classList.remove('open');render();home.classList.remove('open')};
render()})();
;(()=>{['click','dblclick','contextmenu'].forEach(t=>{plant.addEventListener(t,e=>{if(!room.classList.contains('editing')){e.preventDefault();e.stopPropagation()}},true);roomPhoto.addEventListener(t,e=>{if(!room.classList.contains('editing')){e.preventDefault();e.stopPropagation()}},true)});})();
;(()=>{['click','dblclick','contextmenu'].forEach(t=>{plant.addEventListener(t,e=>{if(!room.classList.contains('editing')){e.preventDefault();e.stopPropagation()}},true);roomPhoto.addEventListener(t,e=>{if(!room.classList.contains('editing')){e.preventDefault();e.stopPropagation()}},true)});})();

;(()=>{ 
  const collection=q('#collectionList'),codex=q('#codexList'),shop=q('#shopList');
  function renderCollection(){
    if(!collection)return;
    if(!meta.collection.length){collection.innerHTML='<p class="emptyState">아직 완성한 꽃이 없습니다. 씨앗을 심고 햇살 휴식으로 꽃을 피워보세요.</p>';return}
    collection.innerHTML=meta.collection.map(x=>{
      let sp=CATALOG.species.find(y=>y.id===x.species);if(!sp)sp={icon:'🪴',name:x.speciesName||'이전 식물',growthMinutes:x.focusMinutes||60};const d=new Date(x.completedAt);
      return '<article class="collectionCard"><div class="collectionIcon">'+sp.icon+'</div><div><strong>'+sp.name+'</strong><small>'+d.toLocaleDateString('ko-KR')+' 완성 · '+(x.focusMinutes||sp.growthMinutes)+'분 · 공개 안 함</small></div><span>완성</span></article>'
    }).join('');
  }
  function renderCodex(){
    if(!codex)return;
    codex.innerHTML=CATALOG.species.map(sp=>{
      const count=meta.codex[sp.id]||0;
      return '<article class="codexCard"><div class="codexIcon">'+sp.icon+'</div><div><strong>'+sp.name+'</strong><small>'+sp.season+' · '+sp.difficulty+' · '+sp.growthMinutes+'분 · 완성 '+count+'회</small></div><b>'+count+'/3</b></article>'
    }).join('');
  }
  function buySeed(id){
    const sp=catalogItem('species',id);
    meta.seedCounts[id]=(meta.seedCounts[id]||0)+1;
    saveMeta();refreshMetaSummary();renderShop();
    showReward(sp.name+' 씨앗을 무료로 받았어요');
  }
  function plantSeed(id){
    if(running){showReward('햇살 휴식을 먼저 종료해 주세요');return}
    if(meta.active.planted&&meta.active.species===id)return;
    if(total>0){total=0;localStorage.sun=0}
    meta.active.species=id;
    meta.active.planted=true;
    total=0;localStorage.sun=0;
    saveMeta();applyCosmetics();renderShop();draw();
    showReward(catalogItem('species',id).name+'을(를) 선택했어요');
  }
  function buyOrUse(type,item){
    const invKey=type==='pots'?'pots':'scenes';
    const activeKey=type==='pots'?'pot':'scene';
    const has=meta.inventory[invKey].includes(item.id);
    if(!has)meta.inventory[invKey].push(item.id);
    meta.active[activeKey]=item.id;saveMeta();applyCosmetics();refreshMetaSummary();renderShop();
    if(type==='scenes'){roomPhoto.removeAttribute('src');room.classList.remove('has-photo');localStorage.removeItem('room');room.style.background=sceneBackground(item.id)}
  }
  function renderSeedShop(){
    return '<section class="shopGroup"><h3>9월 꽃 씨앗</h3><p class="seedNote">씨앗 → 발아 → 새싹 → 본잎 → 봉오리 → 개화 순서로 자랍니다. 앱의 성장시간은 휴식 습관용으로 실제 생육기간을 압축한 시간입니다.</p>'+
      CATALOG.species.map(sp=>{
        const count=meta.seedCounts[sp.id]||0,active=meta.active.planted&&meta.active.species===sp.id;
        return '<article class="seedShopItem '+(active?'active':'')+'"><div class="seedPreview">'+flowerSVG(sp.id,'seed')+'</div><div class="seedInfo"><strong>'+sp.name+'</strong><small>'+sp.season+' · '+sp.difficulty+' · 개화 '+sp.growthMinutes+'분</small><em>무료 제공 · 완성 보상 '+sp.reward+'P</em></div><div class="seedActions"><button data-plant-seed="'+sp.id+'">'+(active?'현재 꽃':'무료로 선택')+'</button></div></article>'
      }).join('')+'</section>';
  }
  function renderShopGroup(title,type,items){
    const invKey=type==='pots'?'pots':'scenes',activeKey=type==='pots'?'pot':'scene';
    return '<section class="shopGroup"><h3>'+title+'</h3>'+items.map(item=>{
      const has=meta.inventory[invKey].includes(item.id),active=meta.active[activeKey]===item.id;
      let label=active?'사용 중':'무료로 선택';
      return '<button class="shopItem '+(active?'active':'')+'" data-shop-type="'+type+'" data-shop-id="'+item.id+'"><span>'+item.icon+'</span><div><strong>'+item.name+'</strong><small>무료 제공</small></div><b>'+label+'</b></button>'
    }).join('')+'</section>';
  }
  function renderShop(){
    if(!shop)return;
    shop.innerHTML=renderSeedShop()+renderShopGroup('화분','pots',CATALOG.pots)+renderShopGroup('정원 배경','scenes',CATALOG.scenes);
    shop.querySelectorAll('[data-buy-seed]').forEach(b=>b.onclick=()=>buySeed(b.dataset.buySeed));
    shop.querySelectorAll('[data-plant-seed]').forEach(b=>b.onclick=()=>plantSeed(b.dataset.plantSeed));
    shop.querySelectorAll('[data-shop-id]').forEach(b=>b.onclick=()=>{
      const type=b.dataset.shopType,id=b.dataset.shopId,list=type==='pots'?CATALOG.pots:CATALOG.scenes;
      buyOrUse(type,list.find(x=>x.id===id));
    });
  }
  window.renderGardenRewards=()=>{renderCollection();renderCodex();renderShop();refreshMetaSummary()};
  document.querySelectorAll('[data-garden-tab]').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('[data-garden-tab]').forEach(x=>x.classList.toggle('on',x===btn));
    document.querySelectorAll('[data-garden-panel]').forEach(p=>p.classList.toggle('on',p.dataset.gardenPanel===btn.dataset.gardenTab));
    renderGardenRewards();
  });
  const existingOpen=q('#myHome').onclick;
  q('#myHome').onclick=()=>{existingOpen&&existingOpen();renderGardenRewards()};
  q('#openCodex').onclick=()=>{
    q('#myHome').click();
    const btn=document.querySelector('[data-garden-tab="codex"]');btn&&btn.click();
  };
  renderGardenRewards();refreshFlowerChoices();
})();;
