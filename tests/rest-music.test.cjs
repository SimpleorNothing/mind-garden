const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup({deferred=false,bridge=null,saved=null}={}){
  const elements={'#restMusicToggle':{setAttribute(){}},'#restMusicVolume':{value:'30'},'#restMusicTrack':{value:'meditation'}},events={},players=[];
  const values=new Map(saved?[['mindGardenMusicTrack',saved]]:[]);
  class Audio {
    constructor(src){this.src=src;this.paused=true;players.push(this);}
    play(){this.paused=false;return deferred?new Promise(resolve=>this.resolve=resolve):Promise.resolve();}
    pause(){this.paused=true;}
  }
  const window={Audio,AndroidBridge:bridge,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},addEventListener:(name,cb)=>events[name]=cb};
  const document={hidden:false,querySelector:s=>elements[s],addEventListener:(name,cb)=>events[name]=cb};
  vm.runInNewContext(fs.readFileSync('web/rest-music.js','utf8'),{window,document});
  return {music:window.MindGardenRestMusic,elements,players,events,document,values};
}
test('browser playback loops and switching replaces the current player; mute stays silent',async()=>{
  const s=setup();s.music.isResting=()=>true;await s.music.start();
  assert.equal(s.players[0].loop,true);assert.equal(s.players[0].volume,0.65);
  s.elements['#restMusicTrack'].value='forest';s.elements['#restMusicTrack'].onchange();
  assert.equal(s.players[0].paused,true);assert.equal(s.players[1].src,'audio/forest.ogg');assert.equal(s.values.get('mindGardenMusicTrack'),'forest');
  s.elements['#restMusicVolume'].value='80';s.elements['#restMusicVolume'].oninput();assert.equal(s.players[1].volume,0.8);
  s.elements['#restMusicToggle'].onclick();assert.equal(s.players[1].paused,true);
  s.elements['#restMusicTrack'].value='rain';s.elements['#restMusicTrack'].onchange();assert.equal(s.players.length,2);
  s.elements['#restMusicToggle'].onclick();assert.equal(s.players[2].src,'audio/rain.ogg');
  s.document.hidden=true;s.events.visibilitychange();assert.equal(s.players[2].paused,true);
});
test('stopping while play is pending prevents late playback',async()=>{
  const s=setup({deferred:true}),pending=s.music.start();s.music.stop();s.players[0].resolve();await pending;assert.equal(s.players[0].paused,true);
});
test('restored selection is loaded after native data restore and invalid selections use default',()=>{
  const s=setup({saved:'piano'});assert.equal(s.elements['#restMusicTrack'].value,'piano');
  s.values.set('mindGardenMusicTrack','rain');s.music.restoreSettings();assert.equal(s.elements['#restMusicTrack'].value,'rain');
  s.elements['#restMusicTrack'].value='../bad';s.elements['#restMusicTrack'].onchange();assert.equal(s.values.get('mindGardenMusicTrack'),'meditation');
});
test('native Android playback receives selected track and volume and stops on exit',async()=>{
  const calls=[],bridge={startRestMusicTrack:(v,t)=>calls.push(['start',v,t]),stopRestMusic:()=>calls.push(['stop']),setRestMusicVolume:v=>calls.push(['volume',v])};
  const s=setup({bridge,saved:'piano'});s.music.isResting=()=>true;await s.music.start();assert.equal(s.players.length,0);assert.deepEqual(calls.at(-1),['start',0.65,'piano']);
  s.elements['#restMusicTrack'].value='rain';s.elements['#restMusicTrack'].onchange();assert.deepEqual(calls.at(-1),['start',0.65,'rain']);
  s.document.hidden=true;s.events.visibilitychange();assert.deepEqual(calls.at(-1),['stop']);
});
test('play errors notify only for the active session',async()=>{
  const s=setup();let errors=0;s.music.onError=()=>errors++;await s.music.start();const old=s.players[0];await s.music.start();old.onerror();assert.equal(errors,0);s.players[1].onerror();assert.equal(errors,1);
});
test('web and APK control assets match and all soundscapes are bundled',()=>{
  for(const p of ['index.html','rest-music.js','local-store.js','style.css'])assert.equal(fs.readFileSync('web/'+p,'utf8'),fs.readFileSync('app/src/main/assets/'+p,'utf8'));
  for(const t of ['meditation','piano','forest','rain'])assert.deepEqual(fs.readFileSync('web/audio/'+t+'.ogg'),fs.readFileSync('app/src/main/res/raw/'+t+'.ogg'));
});
