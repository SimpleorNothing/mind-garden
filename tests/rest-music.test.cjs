const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(deferred=false,bridge=null){
  const elements={'#restMusicToggle':{setAttribute(){}},'#restMusicVolume':{value:'30'}},events={},contexts=[],timers=new Map();let seq=0;
  const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(v){this.value=v;}});
  class AudioContext {
    constructor(){this.currentTime=0;this.destination={};this.closed=false;this.notes=0;contexts.push(this);}
    createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
    createOscillator(){this.notes++;return {frequency:parameter(),connect(){},disconnect(){},start(){},stop(){}};}
    resume(){return deferred?new Promise(resolve=>this.resolve=resolve):Promise.resolve();}
    close(){this.closed=true;return Promise.resolve();}
  }
  const window={AndroidBridge:bridge,AudioContext,addEventListener(name,cb){events[name]=cb;}},document={hidden:false,querySelector:s=>elements[s],addEventListener(name,cb){events[name]=cb;}};
  vm.runInNewContext(fs.readFileSync('web/rest-music.js','utf8'),{window,document,setInterval:cb=>{timers.set(++seq,cb);return seq;},clearInterval:id=>timers.delete(id)});
  return {music:window.MindGardenRestMusic,elements,contexts,timers,events,document};
}
test('rest music schedules melody, adjusts volume, stops and restarts without duplicate playback',async()=>{
  const s=setup();await s.music.start();assert.ok(s.contexts[0].notes>0);assert.equal(s.timers.size,1);
  await s.music.start();assert.equal(s.contexts[0].closed,true);assert.equal(s.timers.size,1);
  s.music.isResting=()=>true;s.elements['#restMusicToggle'].onclick();assert.equal(s.contexts[1].closed,true);assert.equal(s.timers.size,0);
  await s.music.start();assert.equal(s.contexts.length,2); // disabled stays silent
  s.elements['#restMusicToggle'].onclick();await Promise.resolve();assert.equal(s.contexts.length,3);
  s.elements['#restMusicVolume'].value='0';s.elements['#restMusicVolume'].oninput();
  s.document.hidden=true;s.events.visibilitychange();assert.equal(s.contexts[2].closed,true);assert.equal(s.timers.size,0);
});
test('stopping while audio resume is pending cannot start music later',async()=>{
  const s=setup(true),pending=s.music.start();s.music.stop();s.contexts[0].resolve();await pending;
  assert.equal(s.contexts[0].closed,true);assert.equal(s.contexts[0].notes,0);assert.equal(s.timers.size,0);
});
test('web and APK contain identical offline music and load it before app boot',()=>{
  assert.equal(fs.readFileSync('web/rest-music.js','utf8'),fs.readFileSync('app/src/main/assets/rest-music.js','utf8'));
  const html=fs.readFileSync('web/index.html','utf8');assert.ok(html.indexOf('src="rest-music.js')<html.indexOf('src="local-store.js'));
});

test('Android plays via native media bridge, volume and background stop reach the player', async()=>{
  const calls=[];
  const s=setup(false,{
    startRestMusic(v){calls.push(['start',v]);},
    stopRestMusic(){calls.push(['stop']);},
    setRestMusicVolume(v){calls.push(['volume',v]);}
  });
  await s.music.start();
  assert.deepEqual(calls,[['stop'],['start',0.65]]);
  assert.equal(s.contexts.length,0);
  s.elements['#restMusicVolume'].value='75';s.elements['#restMusicVolume'].oninput();
  assert.deepEqual(calls.at(-1),['volume',0.75]);
  s.document.hidden=true;s.events.visibilitychange();
  assert.deepEqual(calls.at(-1),['stop']);
  s.music.isResting=()=>true;s.elements['#restMusicToggle'].onclick();
  const count=calls.filter(c=>c[0]==='start').length;
  await s.music.start();assert.equal(calls.filter(c=>c[0]==='start').length,count);
  s.elements['#restMusicToggle'].onclick();assert.deepEqual(calls.at(-1),['start',0.75]);
});
