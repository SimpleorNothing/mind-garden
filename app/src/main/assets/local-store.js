/* Local-only automatic garden persistence. Restore before app initialization. */
(function(root){
  'use strict';
  const keys=['mindGardenMetaV1','sun','myPlants','room','plantX','plantY','plantSize','roomX','roomY','roomScale','mindGardenFocusSessionV1'];
  function validate(state){
    if(!state || state.version!==1 || !state.values || typeof state.values!=='object' || Array.isArray(state.values))throw Error('잘못된 정원 저장 파일');
    for(const [key,value] of Object.entries(state.values))if(!keys.includes(key)||typeof value!=='string')throw Error('잘못된 정원 값');
    for(const key of ['mindGardenMetaV1','myPlants','mindGardenFocusSessionV1'])if(state.values[key]){
      const v=JSON.parse(state.values[key]);
      if(key==='myPlants' ? !Array.isArray(v) : !v || typeof v!=='object'||Array.isArray(v))throw Error('잘못된 정원 기록');
    }
    return state.values;
  }
  function snapshot(storage){return Object.fromEntries(keys.map(k=>[k,storage.getItem(k)]).filter(([,v])=>v!==null));}
  function restore(storage,state){
    const values=validate(state),before=snapshot(storage);
    try{for(const k of keys){if(Object.hasOwn(values,k))storage.setItem(k,values[k]);else storage.removeItem(k);}}
    catch(e){for(const k of keys){if(Object.hasOwn(before,k))storage.setItem(k,before[k]);else storage.removeItem(k);}throw e;}
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={keys,validate,snapshot,restore};return;}
  const storage=root.localStorage,bridge=root.AndroidBridge,pending=new Map();
  let last='',ready=false,inFlight=false,sequence=0;
  root.mindGardenLocalResult=(id,result)=>{const p=pending.get(id);if(p){pending.delete(id);result.ok?p.resolve(result):p.reject(Error(result.error||'정원을 저장하지 못했습니다.'));}};
  function request(op,payload){return new Promise((resolve,reject)=>{const id=String(++sequence);pending.set(id,{resolve,reject});try{bridge.gardenLocalRequest(id,op,JSON.stringify(payload));}catch(e){pending.delete(id);reject(e);}});}
  function notify(message){console.warn(message);if(root.document){let el=document.getElementById('localSaveNotice');if(!el){el=document.createElement('p');el.id='localSaveNotice';el.setAttribute('role','status');document.querySelector('main').appendChild(el);}el.textContent=message;}}
  async function flush(){
    if(!ready||!bridge?.gardenLocalRequest||inFlight)return;
    const text=JSON.stringify(snapshot(storage));if(text===last)return;
    inFlight=true;let saved=false;
    try{const result=await request('save',{version:1,savedAt:new Date().toISOString(),values:JSON.parse(text)});last=text;saved=true;if(result.warning)notify(result.warning);}
    catch(e){notify(e.message);}finally{inFlight=false;if(saved&&JSON.stringify(snapshot(storage))!==last)flush();}
  }
  root.MindGardenLocalStore={flush};
  async function boot(){
    try{if(bridge?.gardenLocalRequest){const result=await request('prepare',{version:1,values:snapshot(storage)});if(result.state)restore(storage,result.state);if(result.warning)notify(result.warning);}}
    catch(e){notify(e.message);}
    const script=document.createElement('script');script.src='app.js?v=63';
    script.onload=()=>{ready=true;flush();setInterval(flush,1000);};document.body.appendChild(script);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});root.addEventListener('pagehide',flush);
  boot();
})(typeof window==='undefined'?globalThis:window);
