const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
const source=fs.readFileSync(__dirname+'/../web/sync.js','utf8');
function fixture(initial={},handler=()=>({ok:true,sha:'',state:null}),connected=true){
 const data=new Map(Object.entries(initial)),requests=[],scripts=[],elements=new Map(),intervals=[];
 const storage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const document={getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},createElement:()=>({}),body:{appendChild:s=>scripts.push(s)},addEventListener(){},visibilityState:'visible'};
 const win={localStorage:storage,document,Date,confirm:()=>true,location:{reload(){win.reloaded=true;}},setTimeout,clearTimeout,setInterval:f=>intervals.push(f),addEventListener(){},AndroidBridge:{gardenStateDigest:hash,hasGardenGitHubConnection:()=>connected,connectGardenGitHub(){},gardenGitHubRequest(id,op,payload){requests.push({op,payload:JSON.parse(payload)});const result=handler(op,JSON.parse(payload));Promise.resolve(result).then(r=>win.mindGardenGitHubResponse(id,r));}}};
 vm.runInNewContext(source,{window:win,Date});
 return {win,data,storage,requests,scripts,intervals,elements};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('fresh install restores photos and progress before app starts',async()=>{
 const f=fixture({},()=>({ok:true,sha:'old',state:{version:1,values:{sun:'123',myPlants:'[]',room:'data:image/jpeg;base64,abc'}}}));
 assert.equal(f.scripts.length,0);await tick();
 assert.equal(f.data.get('sun'),'123');assert.equal(f.data.get('room'),'data:image/jpeg;base64,abc');assert.equal(f.scripts.length,1);assert.equal(f.requests.length,1);
});
test('offline restore does not delete local records or upload defaults',async()=>{
 const f=fixture({sun:'456'},()=>({ok:false,code:0,message:'offline'}));await tick();assert.equal(f.data.get('sun'),'456');assert.equal(f.scripts.length,1);assert.deepEqual(f.requests.map(x=>x.op),['load']);
});
test('dirty records with unchanged remote SHA upload local state',async()=>{
 const f=fixture({sun:'456',gardenSyncPending:'1',gardenSyncSha:'old'},op=>op==='load'?{ok:true,sha:'old',state:{version:1,values:{sun:'123'}}}:{ok:true,sha:'new'});
 await tick();f.scripts[0].onload();await tick();assert.equal(f.requests[1].payload.state.values.sun,'456');assert.equal(f.requests[1].payload.sha,'old');assert.equal(f.data.get('gardenSyncPending'),'0');assert.equal(f.data.get('gardenSyncSha'),'new');
});
test('changes immediately before process death are recovered from last saved baseline',async()=>{
 const f=fixture({sun:'456',gardenSyncPending:'0',gardenSyncSha:'old',gardenSyncBaseline:hash('{"sun":"123"}')},op=>op==='load'?{ok:true,sha:'old',state:{version:1,values:{sun:'123'}}}:{ok:true,sha:'new'});
 await tick();f.scripts[0].onload();await tick();assert.equal(f.data.get('sun'),'456');assert.equal(f.requests[1].payload.state.values.sun,'456');
});
test('remote conflict preserves pending local data without overwriting server',async()=>{
 const f=fixture({sun:'456',gardenSyncPending:'1',gardenSyncSha:'old'},()=>({ok:true,sha:'other',state:{version:1,values:{sun:'123'}}}));await tick();f.scripts[0].onload();await tick();assert.equal(f.data.get('sun'),'456');assert.equal(f.requests.length,1);assert.equal(f.data.get('gardenSyncPending'),'1');
});
test('HTTP conflict never marks upload saved',async()=>{
 const f=fixture({sun:'456'},op=>op==='load'?{ok:true,sha:'',state:null}:{ok:false,code:409,message:'conflict'});await tick();f.scripts[0].onload();await tick();assert.equal(f.data.get('gardenSyncPending'),'1');assert.equal(f.data.get('sun'),'456');assert.equal(f.data.get('gardenSyncSavedAt'),undefined);
});
test('record changed during upload stays pending',async()=>{
 let resolve;
 const f=fixture({sun:'456'},op=>op==='load'?{ok:true,sha:'',state:null}:new Promise(r=>resolve=r));await tick();f.scripts[0].onload();await tick();f.storage.setItem('sun','789');resolve({ok:true,sha:'new'});await tick();assert.equal(f.data.get('gardenSyncPending'),'1');assert.equal(f.data.get('sun'),'789');
});
test('unknown keys and malformed plant lists rejected before local mutation',async()=>{
 const f=fixture({sun:'456'},()=>({ok:true,sha:'bad',state:{version:1,values:{token:'secret'}}}));await tick();assert.equal(f.data.get('sun'),'456');assert.equal(f.data.get('token'),undefined);
 assert.throws(()=>f.win.MindGardenSync.apply({version:1,values:{myPlants:'{}'}}));assert.equal(f.data.get('sun'),'456');
});
test('browser without native bridge still boots existing app',()=>{
 const f=fixture({},undefined,false);delete f.win.AndroidBridge;assert.equal(f.scripts.length,1);
});
