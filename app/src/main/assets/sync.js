// Native authenticated transport. Credentials never enter WebView storage.
(function (win) {
  'use strict';
  const keys=['mindGardenMetaV1','myPlants','sun','room','plantX','plantY','plantSize','roomX','roomY','roomScale','mindGardenFocusSessionV1'];
  const storage=win.localStorage,bridge=win.AndroidBridge;
  const session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const digest=text=>bridge.gardenStateDigest(text);
  let sequence=0,active=false,blocked=false,ready=false,booted=false,baseline='',lastError=0;
  const requests=new Map();
  const read=()=>Object.fromEntries(keys.filter(k=>storage.getItem(k)!==null).map(k=>[k,storage.getItem(k)]));
  const serialized=()=>JSON.stringify(read());
  function status(text){const e=win.document.getElementById('gardenSyncStatus');if(e)e.textContent=text;}
  function validate(state){
    if(!state||state.version!==1||!state.values||typeof state.values!=='object'||Array.isArray(state.values))throw Error('저장 데이터 형식이 올바르지 않습니다.');
    for(const [key,value] of Object.entries(state.values)){if(!keys.includes(key)||typeof value!=='string')throw Error('저장 데이터 검증에 실패했습니다.');}
    for(const key of ['mindGardenMetaV1','myPlants','mindGardenFocusSessionV1'])if(state.values[key]){
      const value=JSON.parse(state.values[key]);
      if(key==='myPlants'&&!Array.isArray(value))throw Error('식물 목록 형식이 올바르지 않습니다.');
      if(key==='mindGardenMetaV1'&&(!value||typeof value!=='object'||Array.isArray(value)))throw Error('정원 기록 형식이 올바르지 않습니다.');
    }
    return state.values;
  }
  function apply(state){
    const values=validate(state),before=read();
    // Roll back every key if device storage cannot hold the restored photos.
    try{for(const key of keys){if(Object.hasOwn(values,key))storage.setItem(key,values[key]);else storage.removeItem(key);}}
    catch(error){for(const key of keys){if(Object.hasOwn(before,key))storage.setItem(key,before[key]);else storage.removeItem(key);}throw error;}
  }
  win.mindGardenGitHubResponse=function(id,response){const r=requests.get(id);if(!r)return;requests.delete(id);win.clearTimeout(r.timer);response.ok?r.resolve(response):r.reject(Object.assign(Error(response.message||'GitHub 연결 실패'),{code:response.code}));};
  function request(operation,payload){return new Promise((resolve,reject)=>{
    const id=session+':'+(++sequence),timer=win.setTimeout(()=>{requests.delete(id);reject(Error('연결 시간이 초과됐습니다.'));},45000);
    requests.set(id,{resolve,reject,timer});
    try{bridge.gardenGitHubRequest(id,operation,JSON.stringify(payload||{}));}catch(e){requests.delete(id);win.clearTimeout(timer);reject(e);}
  });}
  function conflict(){blocked=true;ready=false;status('다른 기기의 변경이 있습니다. 기기 데이터는 유지됩니다. GitHub 연결에서 복원 여부를 선택하세요.');}
  async function load(){
    const remote=await request('load');
    const local=serialized(),saved=storage.getItem('gardenSyncBaseline');
    if(saved!==null&&digest(local)!==saved)storage.setItem('gardenSyncPending','1');
    const dirty=storage.getItem('gardenSyncPending')==='1',base=storage.getItem('gardenSyncSha')||'';
    if(remote.state){
      validate(remote.state);
      const remoteText=JSON.stringify(Object.fromEntries(keys.filter(k=>Object.hasOwn(remote.state.values,k)).map(k=>[k,remote.state.values[k]])));
      if(local!==remoteText&&(dirty||(!base&&Object.keys(read()).length))){
        if(!dirty||base!==remote.sha){conflict();return;}
      }else if(local!==remoteText){
        apply(remote.state);storage.setItem('gardenSyncBaseline',digest(serialized()));
        if(booted){win.location.reload();return false;}
      }
      storage.setItem('gardenSyncSha',remote.sha);
    }else{
      if(base){conflict();return;}
      storage.setItem('gardenSyncPending','1');
    }
    ready=true;return true;
  }
  async function flush(){
    if(active||blocked||!bridge?.gardenGitHubRequest||!bridge.hasGardenGitHubConnection())return;
    active=true;
    try{
      if(!ready&&await load()===false)return;
      if(blocked)return;
      if(storage.getItem('gardenSyncPending')!=='1'){status('기기·GitHub 저장 완료');return;}
      const sent=serialized(),state={version:1,savedAt:new Date().toISOString(),values:JSON.parse(sent)};
      status('기기 저장 완료 · GitHub 저장 중…');
      const result=await request('save',{state,sha:storage.getItem('gardenSyncSha')||''});
      storage.setItem('gardenSyncSha',result.sha);
      storage.setItem('gardenSyncBaseline',digest(sent));
      if(serialized()===sent)storage.setItem('gardenSyncPending','0');
      storage.setItem('gardenSyncSavedAt',state.savedAt);
      status('기기·GitHub 저장 완료 · '+new Date().toLocaleTimeString('ko-KR'));
    }catch(e){
      if(e.code===409||e.code===422){conflict();return;}
      lastError=Date.now();status('기기 저장 유지 · '+e.message+' · 자동 재시도');
    }finally{active=false;}
  }
  async function restoreExplicit(){
    if(active)return;active=true;
    try{
      const remote=await request('load');if(!remote.state){status('GitHub에 저장된 정원이 없습니다.');return;}
      validate(remote.state);
      if(!win.confirm('GitHub의 정원으로 복원할까요? 현재 기기 기록은 이 기기에 복구용 사본으로 남깁니다.'))return;
      storage.setItem('gardenSyncRecovery',serialized());apply(remote.state);
      storage.setItem('gardenSyncSha',remote.sha);storage.setItem('gardenSyncBaseline',digest(serialized()));storage.setItem('gardenSyncPending','0');win.location.reload();
    }catch(e){status('기기 저장 유지 · '+e.message);}finally{active=false;}
  }
  function boot(){
    if(booted)return;booted=true;
    const script=win.document.createElement('script');script.src='app.js?v=60';
    script.onload=()=>{
      baseline=serialized();
      const panel=win.document.getElementById('gardenSync');
      if(!bridge?.gardenGitHubRequest)return;
      panel.hidden=false;
      win.document.getElementById('gardenSyncConnect').onclick=()=>bridge.connectGardenGitHub();
      win.document.getElementById('gardenSyncRestore').onclick=restoreExplicit;
      win.document.getElementById('gardenSyncRetry').onclick=()=>{blocked=false;ready=false;flush();};
      if(blocked)conflict();else if(bridge.hasGardenGitHubConnection())flush();else status('기기 저장 중 · GitHub 연결 후 자동 저장');
      win.setInterval(()=>{
        const current=serialized();if(current!==baseline){baseline=current;storage.setItem('gardenSyncPending','1');status('기기 저장 완료 · GitHub 저장 대기');}
        if(Date.now()-lastError>10000)flush();
      },2000);
    };
    script.onerror=()=>status('앱을 불러오지 못했습니다. 다시 열어주세요.');win.document.body.appendChild(script);
  }
  win.mindGardenGitHubConnected=()=>win.location.reload();
  win.addEventListener('online',()=>flush());
  win.document.addEventListener('visibilitychange',()=>{if(booted&&win.document.visibilityState==='visible')flush();});
  if(bridge?.gardenGitHubRequest&&bridge.hasGardenGitHubConnection()){
    status('GitHub 정원 불러오는 중…');active=true;
    load().catch(e=>{lastError=Date.now();status('기기 기록으로 시작 · '+e.message);}).finally(()=>{active=false;boot();});
  }else boot();
  // Exposed only for deterministic storage/transport tests, no credentials.
  win.MindGardenSync={validate,apply,read,flush};
})(window);
