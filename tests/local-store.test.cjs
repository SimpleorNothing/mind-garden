const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {validate,snapshot,restore}=require('../web/local-store.js');
function storage(initial={}){const m=new Map(Object.entries(initial));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('preserves photos, plants, points and focus state without unrelated keys',()=>{
 const s=storage({room:'data:image/png;base64,abc',myPlants:'[{"name":"꽃"}]',sun:'120',mindGardenFocusSessionV1:'{"mode":"study"}',secret:'token'});
 assert.deepEqual(Object.keys(snapshot(s)).sort(),['room','myPlants','sun','mindGardenFocusSessionV1'].sort());
 const out=storage();restore(out,{version:1,values:snapshot(s)});assert.deepEqual(snapshot(out),snapshot(s));
});
test('rejects unknown keys, malformed records and wrong version before mutation',()=>{
 for(const state of [{version:2,values:{}},{version:1,values:{secret:'x'}},{version:1,values:{myPlants:'{}'}},{version:1,values:{mindGardenMetaV1:'[]'}},{version:1,values:{sun:7}}])assert.throws(()=>validate(state));
});
test('restoring replaces garden keys and leaves unrelated storage intact',()=>{
 const s=storage({sun:'15',room:'old',secret:'keep'});restore(s,{version:1,values:{sun:'50'}});assert.equal(s.getItem('sun'),'50');assert.equal(s.getItem('room'),null);assert.equal(s.getItem('secret'),'keep');
});
test('quota failure rolls back to previous garden',()=>{
 const s=storage({sun:'15',room:'old'}),set=s.setItem;s.setItem=(k,v)=>{if(v==='huge')throw Error('quota');set(k,v);};
 assert.throws(()=>restore(s,{version:1,values:{sun:'50',room:'huge'}}));assert.deepEqual(snapshot(s),{sun:'15',room:'old'});
});
test('native restore finishes before app initialization; direct assignments are saved on polling',async()=>{
 const s=storage(),scripts=[],timers=[],requests=[];
 const context={localStorage:s,console,document:{hidden:false,addEventListener(){},createElement:()=>({}),body:{appendChild:el=>scripts.push(el)}},addEventListener(){},setInterval:fn=>timers.push(fn)};
 context.window=context;context.AndroidBridge={gardenLocalRequest:(id,op,payload)=>requests.push({id,op,payload:JSON.parse(payload)})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../web/local-store.js'),'utf8'),context);
 assert.equal(scripts.length,0);assert.equal(requests[0].op,'prepare');
 context.mindGardenLocalResult(requests[0].id,{ok:true,state:{version:1,values:{sun:'120',room:'photo'}}});
 await new Promise(setImmediate);assert.equal(scripts.length,1);assert.equal(s.getItem('sun'),'120');scripts[0].onload();
 assert.equal(requests[1].op,'save');context.mindGardenLocalResult(requests[1].id,{ok:true});await new Promise(setImmediate);
 s.setItem('sun','200');timers[0]();assert.equal(requests[2].payload.values.sun,'200');
});
test('website without Android bridge starts normally with local storage',async()=>{
 const scripts=[],context={localStorage:storage({sun:'8'}),console,document:{addEventListener(){},createElement:()=>({}),body:{appendChild:s=>scripts.push(s)}},addEventListener(){},setInterval(){}};context.window=context;
 vm.runInNewContext(fs.readFileSync(require.resolve('../web/local-store.js'),'utf8'),context);assert.equal(scripts.length,1);assert.equal(context.localStorage.getItem('sun'),'8');
});
test('web and APK assets match and removed save cards cannot initialize',()=>{
 for(const file of ['index.html','app.js','local-store.js'])assert.equal(fs.readFileSync('web/'+file,'utf8'),fs.readFileSync('app/src/main/assets/'+file,'utf8'));
 const html=fs.readFileSync('web/index.html','utf8');assert.doesNotMatch(html,/gardenSync|backupGarden|restoreGarden|GitHub/);
 assert.doesNotMatch(fs.readFileSync('web/app.js','utf8'),/mindGardenRestoreBackup|backupStatus/);
});
