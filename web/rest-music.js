/* Original offline soundscapes; native Android playback or bundled browser audio. */
(()=>{
  const tracks=['meditation','piano','forest','rain'];
  let audio=null,session=0,enabled=true,volume=0.65,track='meditation';
  const button=document.querySelector('#restMusicToggle'),slider=document.querySelector('#restMusicVolume'),select=document.querySelector('#restMusicTrack');
  function restoreSettings(){
    try{const saved=window.localStorage?.getItem('mindGardenMusicTrack');if(tracks.includes(saved))track=saved;}catch(_){}
    if(select)select.value=track;
  }
  function label(){button.textContent=enabled?'♫ 명상음악 켜짐':'♫ 명상음악 꺼짐';button.setAttribute('aria-pressed',String(enabled));}
  function stop(){
    session++;
    window.AndroidBridge?.stopRestMusic?.();
    if(audio){audio.pause();audio.currentTime=0;audio=null;}
  }
  async function start(){
    stop();if(!enabled)return;
    const id=session;
    try{
      if(window.AndroidBridge?.startRestMusicTrack){window.AndroidBridge.startRestMusicTrack(volume,track);return;}
      if(window.AndroidBridge?.startRestMusic){window.AndroidBridge.startRestMusic(volume);return;}
      const player=new window.Audio('audio/'+track+'.ogg');audio=player;
      player.loop=true;player.volume=volume;
      player.onerror=()=>{if(id===session){stop();window.MindGardenRestMusic.onError?.();}};
      await player.play();
      if(id!==session){player.pause();player.currentTime=0;}
    }catch(_){if(id===session){stop();window.MindGardenRestMusic.onError?.();}}
  }
  window.MindGardenRestMusic={start,stop,restoreSettings,isResting:()=>false,onError:null};
  button.onclick=()=>{enabled=!enabled;label();if(enabled&&window.MindGardenRestMusic.isResting())start();else stop();};
  slider.oninput=()=>{volume=Number(slider.value)/100;window.AndroidBridge?.setRestMusicVolume?.(volume);if(audio)audio.volume=volume;};
  if(select)select.onchange=()=>{
    track=tracks.includes(select.value)?select.value:'meditation';select.value=track;
    try{window.localStorage?.setItem('mindGardenMusicTrack',track);}catch(_){}
    if(enabled&&window.MindGardenRestMusic.isResting())start();else stop();
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  slider.value=String(volume*100);restoreSettings();label();
})();
