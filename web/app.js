const q=s=>document.querySelector(s),room=q('#room'),plant=q('#plant'),time=q('#time'),stage=q('#stage'),rest=q('#rest'),msg=q('#msg'),bar=q('#bar'),next=q('#next');
const harvest=q('#harvest'),sunPoints=q('#sunPoints'),completedPlants=q('#completedPlants'),activePlantName=q('#activePlantName');
const MIN=60000,META_KEY='mindGardenMetaV1';

const CATALOG={
  species:[
    {id:'calendula',name:'금잔화',icon:'🟠',seedPrice:40,growthMinutes:90,reward:120,difficulty:'쉬움',season:'9월 추천'},
    {id:'cornflower',name:'수레국화',icon:'🔵',seedPrice:60,growthMinutes:120,reward:150,difficulty:'보통',season:'9월 추천'},
    {id:'pansy',name:'팬지',icon:'🟣',seedPrice:80,growthMinutes:150,reward:180,difficulty:'보통+',season:'9월~초10월'},
    {id:'nigella',name:'니겔라',icon:'💠',seedPrice:100,growthMinutes:180,reward:220,difficulty:'어려움',season:'9월 추천'}
  ],
  pots:[
    {id:'ivory',name:'아이보리 화분',icon:'◯',price:0},
    {id:'clay',name:'테라코타 화분',icon:'🟤',price:100},
    {id:'moss',name:'모스 화분',icon:'🟢',price:150},
    {id:'sage',name:'세이지 화분',icon:'🪴',milestone:'week3'}
  ],
  scenes:[
    {id:'window',name:'햇살 창가',icon:'☀️',price:0},
    {id:'warm',name:'따뜻한 거실',icon:'🛋️',price:150},
    {id:'forest',name:'초록 정원',icon:'🌳',price:200}
  ]
};

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
    seedCounts:{calendula:0,cornflower:0,pansy:0,nigella:0},
    inventory:{species:[],pots:['ivory'],scenes:['window']},
    active:{species:'calendula',pot:'ivory',scene:'window',planted:true},
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
  if(typeof m.active.planted!=='boolean')m.active.planted=true;
  m.schemaVersion=2;
  return m;
}
let meta=loadMeta(),total=+(localStorage.sun||0),running=false,start=0,wakeLock=null;

function saveMeta(){localStorage.setItem(META_KEY,JSON.stringify(meta))}
function catalogItem(type,id){return CATALOG[type].find(x=>x.id===id)||CATALOG[type][0]}
function activeSpecies(){return catalogItem('species',meta.active.species)}
function growthTargetMs(){return activeSpecies().growthMinutes*MIN}
function stageInfo(ratio){
  if(!meta.active.planted)return {name:'씨앗 대기',key:'empty'};
  if(ratio<.08)return {name:'씨앗',key:'seed'};
  if(ratio<.22)return {name:'발아',key:'germination'};
  if(ratio<.45)return {name:'새싹',key:'sprout'};
  if(ratio<.72)return {name:'본잎',key:'leaves'};
  if(ratio<1)return {name:'봉오리',key:'bud'};
  return {name:'개화',key:'bloom'};
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
function renderPlantVisual(ratio){
  const sp=activeSpecies(),st=stageInfo(ratio);
  plant.innerHTML=flowerSVG(sp.id,st.key);
  plant.dataset.species=sp.id;
  plant.dataset.pot=meta.active.pot;
  stage.textContent=st.name;
}
function applyCosmetics(){
  const sp=activeSpecies();
  plant.dataset.species=sp.id;
  plant.dataset.pot=meta.active.pot;
  room.dataset.scene=meta.active.scene;
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
function recordFocus(ms){
  if(ms<=0)return;
  const day=localDateKey();
  meta.dailyFocus[day]=(meta.dailyFocus[day]||0)+ms;
  if(meta.dailyFocus[day]>=10*MIN&&!meta.week.days.includes(day)){
    meta.week.days.push(day);unlockWeeklyRewards();
  }
  saveMeta();
}
function draw(){
  let t=total+(running?Date.now()-start:0),m=Math.floor(t/MIN),sec=Math.floor(t/1000)%60;
  const target=activeSpecies().growthMinutes,ratio=meta.active.planted?Math.min(1,t/(target*MIN)):0;
  time.textContent=String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  renderPlantVisual(ratio);
  plant.style.transform='translateX(-50%) scale('+(1+ratio*.2)+')';
  bar.style.width=(ratio*100)+'%';
  if(!meta.active.planted){
    next.textContent='상점에서 씨앗을 구매하고 심어주세요.';
    harvest.hidden=true;rest.disabled=true;
  }else if(ratio>=1){
    next.textContent='꽃이 활짝 폈어요. 수확하면 햇살 포인트를 받아요.';
    harvest.hidden=false;rest.disabled=true;
  }else{
    next.textContent='개화까지 '+Math.max(0,target-m)+'분 · '+activeSpecies().difficulty;
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
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRest('background')});
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
;(()=>{const light=q('#liveLight'),sun=q('#sun'),shadow=q('#plantShadow');const rise=6*60+18,set=18*60+24;
function live(){if(room.dataset.live==='0'){room.classList.remove('live-night','live-dawn','live-day','live-evening');sun.style.opacity='0';shadow.style.opacity='0';return}const n=new Date(),m=n.getHours()*60+n.getMinutes(),day=m>=rise&&m<=set,p=Math.max(0,Math.min(1,(m-rise)/(set-rise))),noon=(rise+set)/2,side=Math.max(-1,Math.min(1,(m-noon)/((set-rise)/2)));
room.classList.remove('live-night','live-dawn','live-day','live-evening');
if(!day)room.classList.add('live-night');else if(p<.16)room.classList.add('live-dawn');else if(p>.82)room.classList.add('live-evening');else room.classList.add('live-day');
if(day){sun.style.left=(7+86*p)+'%';sun.style.right='auto';sun.style.top=(38-27*Math.sin(Math.PI*p))+'px';sun.style.opacity='1';sun.style.filter='brightness('+(1+.18*Math.sin(Math.PI*p))+')';}
const pr=plant.getBoundingClientRect(),rr=room.getBoundingClientRect(),cx=pr.left-rr.left+pr.width/2,cy=pr.bottom-rr.top-8;
shadow.style.left=cx+'px';shadow.style.top=cy+'px';shadow.style.opacity=day?String(.18+.22*Math.abs(side)):'0';shadow.style.width=(55+105*Math.abs(side))+'px';shadow.style.transform='rotate('+(90+62*side)+'deg)';
}
live();setInterval(live,30000);window.addEventListener('resize',live);room.addEventListener('pointerup',()=>setTimeout(live,0));q('#editDone').addEventListener('click',()=>setTimeout(live,0));
})();
;(()=>{const home=q('#homeSheet'),add=q('#addSheet'),list=q('#plantList'),photo=q('#photo'),virtual=q('#virtualChoices'),name=q('#newName'),place=q('#newPlace'),live=q('#newLive');let imageMode='mine',virtualId='',pendingImage='';let plants=[];try{plants=JSON.parse(localStorage.myPlants||'[]')}catch(_){}
function compressImage(file,cb){let r=new FileReader;r.onload=()=>{let im=new Image;im.onload=()=>{let max=1400,s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);let out=c.toDataURL('image/jpeg',.78);cb(out)};im.src=r.result};r.readAsDataURL(file)}
function bgFor(v){return v==='desk'?'linear-gradient(135deg,#d9cbb8,#f4eee4)':v==='balcony'?'linear-gradient(135deg,#b9d4b1,#e8f0df)':'linear-gradient(135deg,#f6d99a,#d8e8e7)'}
function render(){list.innerHTML=plants.length?'':'<p style="color:#788078">아직 등록한 식물이 없습니다. 거실 창가나 공부방 책상 위의 식물을 추가해 보세요.</p>';plants.forEach((p,i)=>{let d=document.createElement('div');d.className='plantItem';let bg=p.image?'url('+p.image+')':bgFor(p.virtual);d.innerHTML='<div class="plantThumb" style="background:'+bg+'">🪴</div><div><strong>'+p.name+'</strong><small>'+p.place+' · '+(p.live?'LIVE':'고정 환경')+'</small></div><button>보기</button>';d.querySelector('button').onclick=()=>{if(p.image){const rp=q('#roomPhoto');rp.onload=()=>{room.classList.add('has-photo');room.style.backgroundImage='none';room.style.background='';};rp.onerror=()=>alert('저장된 이미지를 불러오지 못했습니다. 내 정원에서 이미지를 다시 선택해 주세요.');rp.src=p.image;room.classList.add('has-photo');room.style.backgroundImage='none';room.style.background='';}else{q('#roomPhoto').removeAttribute('src');room.classList.remove('has-photo');room.style.background=bgFor(p.virtual)};room.dataset.live=p.live?'1':'0';home.classList.remove('open')};list.appendChild(d)})}
q('#myHome').onclick=()=>{render();home.classList.add('open')};q('#homeClose').onclick=()=>home.classList.remove('open');q('#addPlant').onclick=()=>{home.classList.remove('open');add.classList.add('open')};q('#addClose').onclick=()=>add.classList.remove('open');
q('#useMine').onclick=()=>{imageMode='mine';q('#useMine').classList.add('on');q('#useVirtual').classList.remove('on');virtual.classList.remove('show');photo.click()};
q('#useVirtual').onclick=()=>{imageMode='virtual';q('#useVirtual').classList.add('on');q('#useMine').classList.remove('on');virtual.classList.add('show')};
photo.addEventListener('change',e=>{let f=e.target.files[0];if(!f)return;compressImage(f,out=>{pendingImage=out})});
virtual.querySelectorAll('button').forEach(b=>b.onclick=()=>{virtualId=b.dataset.v;virtual.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))});
q('#savePlant').onclick=()=>{if(!name.value.trim()||!place.value.trim())return alert('식물 이름과 장소를 입력해 주세요.');if(imageMode==='mine'&&!pendingImage)return alert('내 이미지를 선택해 주세요.');if(imageMode==='virtual'&&!virtualId)return alert('가상 이미지를 선택해 주세요.');const added={name:name.value.trim(),place:place.value.trim(),live:live.checked,image:imageMode==='mine'?pendingImage:'',virtual:imageMode==='virtual'?virtualId:''};plants.push(added);try{localStorage.myPlants=JSON.stringify(plants)}catch(_){plants.pop();alert('저장 공간이 부족합니다. 사진을 더 압축해 다시 시도해 주세요.');return}if(added.image){const rp=q('#roomPhoto');rp.src=added.image;room.classList.add('has-photo');room.style.backgroundImage='none';room.style.background='';}else{q('#roomPhoto').removeAttribute('src');room.classList.remove('has-photo');room.style.background=bgFor(added.virtual)};room.dataset.live=added.live?'1':'0';name.value='';place.value='';pendingImage='';virtualId='';add.classList.remove('open');render();home.classList.remove('open')};
render()})();
;(()=>{['click','dblclick','contextmenu'].forEach(t=>{plant.addEventListener(t,e=>{if(!room.classList.contains('editing')){e.preventDefault();e.stopPropagation()}},true);roomPhoto.addEventListener(t,e=>{if(!room.classList.contains('editing')){e.preventDefault();e.stopPropagation()}},true)});})();
;(()=>{['click','dblclick','contextmenu'].forEach(t=>{plant.addEventListener(t,e=>{if(!room.classList.contains('editing')){e.preventDefault();e.stopPropagation()}},true);roomPhoto.addEventListener(t,e=>{if(!room.classList.contains('editing')){e.preventDefault();e.stopPropagation()}},true)});})();

;(()=>{ 
  const collection=q('#collectionList'),codex=q('#codexList'),shop=q('#shopList'),home=q('#homeSheet');
  function owned(type,id){
    const key=type==='species'?'species':type==='pots'?'pots':'scenes';
    return meta.inventory[key].includes(id);
  }
  function requirementText(item){
    if(item.milestone==='week3')return '이번 주 3일 휴식 달성 시 해금';
    if(item.milestone==='week7')return '이번 주 7일 휴식 달성 시 해금';
    return '';
  }
  function renderCollection(){
    if(!collection)return;
    if(!meta.collection.length){collection.innerHTML='<p class="emptyState">아직 완성한 식물이 없습니다. 60분의 햇살 휴식을 채워 첫 식물을 완성해 보세요.</p>';return}
    collection.innerHTML=meta.collection.map(x=>{
      const sp=catalogItem('species',x.species),d=new Date(x.completedAt);
      return '<article class="collectionCard"><div class="collectionIcon">'+sp.icon+'</div><div><strong>'+sp.name+'</strong><small>'+d.toLocaleDateString('ko-KR')+' 완성 · 공개 안 함</small></div><span>완성</span></article>'
    }).join('');
  }
  function renderCodex(){
    if(!codex)return;
    codex.innerHTML=CATALOG.species.map(sp=>{
      const count=meta.codex[sp.id]||0,has=meta.inventory.species.includes(sp.id);
      return '<article class="codexCard '+(has?'':'locked')+'"><div class="codexIcon">'+(has?sp.icon:'?')+'</div><div><strong>'+(has?sp.name:'미발견 식물')+'</strong><small>'+(has?('완성 '+count+'회'):(requirementText(sp)||'상점에서 해금'))+'</small></div><b>'+count+'/3</b></article>'
    }).join('');
  }
  function buyOrUse(type,item){
    const invKey=type==='species'?'species':type==='pots'?'pots':'scenes';
    const activeKey=type==='species'?'species':type==='pots'?'pot':'scene';
    const has=meta.inventory[invKey].includes(item.id);
    if(!has){
      if(item.milestone){showReward(requirementText(item));return}
      if(meta.points<(item.price||0)){showReward('햇살 포인트가 부족해요');return}
      meta.points-=item.price||0;meta.inventory[invKey].push(item.id);
      showReward(item.name+' 해금');
    }
    meta.active[activeKey]=item.id;saveMeta();applyCosmetics();refreshMetaSummary();renderShop();
    if(type==='scenes'&&!room.classList.contains('has-photo'))room.style.background='';
  }
  function renderShopGroup(title,type,items){
    const invKey=type==='species'?'species':type==='pots'?'pots':'scenes',activeKey=type==='species'?'species':type==='pots'?'pot':'scene';
    return '<section class="shopGroup"><h3>'+title+'</h3>'+items.map(item=>{
      const has=meta.inventory[invKey].includes(item.id),active=meta.active[activeKey]===item.id;
      let label=active?'사용 중':has?'사용하기':item.milestone?'조건 해금':(item.price+'P');
      return '<button class="shopItem '+(active?'active':'')+'" data-shop-type="'+type+'" data-shop-id="'+item.id+'"><span>'+item.icon+'</span><div><strong>'+item.name+'</strong><small>'+(has?'보유 중':(requirementText(item)||(item.price+'P로 해금')))+'</small></div><b>'+label+'</b></button>'
    }).join('')+'</section>';
  }
  function renderShop(){
    if(!shop)return;
    shop.innerHTML=renderShopGroup('식물 씨앗','species',CATALOG.species)+renderShopGroup('화분','pots',CATALOG.pots)+renderShopGroup('정원 배경','scenes',CATALOG.scenes);
    shop.querySelectorAll('[data-shop-id]').forEach(b=>b.onclick=()=>{
      const type=b.dataset.shopType,id=b.dataset.shopId,list=type==='species'?CATALOG.species:type==='pots'?CATALOG.pots:CATALOG.scenes;
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
  renderGardenRewards();
})();
