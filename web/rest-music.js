/* Original, offline meditation melody. Audio starts only from a rest/control tap. */
(()=>{
  let context=null,master=null,timer=null,session=0,enabled=true,volume=0.65;
  const melody=[0,4,7,11,7,4,2,7,9,14,9,7,4,9,11,16,11,9,2,7,4,0,4,7];
  const button=document.querySelector('#restMusicToggle'),slider=document.querySelector('#restMusicVolume');
  function label(){button.textContent=enabled?'♫ 명상음악 켜짐':'♫ 명상음악 꺼짐';button.setAttribute('aria-pressed',String(enabled));}
  function stop(){
    session++;
    window.AndroidBridge?.stopRestMusic?.();
    if(timer!==null)clearInterval(timer);
    timer=null;
    const old=context;context=null;master=null;
    if(old)old.close().catch(()=>{});
  }
  function note(ctx,out,semitone,at,length,level){
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();
    oscillator.type='sine';oscillator.frequency.value=130.8128*Math.pow(2,semitone/12);
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(level,at+0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001,at+length);
    oscillator.connect(gain);gain.connect(out);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    oscillator.start(at);oscillator.stop(at+length+0.1);
  }
  async function start(){
    stop();if(!enabled)return;
    if(window.AndroidBridge?.startRestMusic){
      try{window.AndroidBridge.startRestMusic(volume);}catch(_){window.MindGardenRestMusic.onError?.();}
      return;
    }
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){window.MindGardenRestMusic.onError?.();return;}
    const id=session;
    try{
      const ctx=new Audio();context=ctx;
      const out=ctx.createGain();master=out;out.gain.value=0;out.connect(ctx.destination);
      await ctx.resume();
      if(id!==session)return;
      out.gain.linearRampToValueAtTime(volume,ctx.currentTime+1.5);
      let index=0,next=ctx.currentTime+0.05;
      function schedule(){
        while(next<ctx.currentTime+6){
          note(ctx,out,melody[index%melody.length]+12,next,5.8,0.18);
          if(index%4===0){
            const root=[0,2,4,0][Math.floor(index/4)%4];
            [root,root+7,root+12].forEach(n=>note(ctx,out,n,next,11.5,0.055));
          }
          next+=3;index++;
        }
      }
      schedule();timer=setInterval(schedule,1000);
    }catch(_){if(id===session){stop();window.MindGardenRestMusic.onError?.();}}
  }
  window.MindGardenRestMusic={start,stop,isResting:()=>false,onError:null};
  button.onclick=()=>{enabled=!enabled;label();if(enabled&&window.MindGardenRestMusic.isResting())start();else stop();};
  slider.oninput=()=>{volume=Number(slider.value)/100;window.AndroidBridge?.setRestMusicVolume?.(volume);if(master)master.gain.setTargetAtTime(volume,context.currentTime,0.15);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  slider.value=String(volume*100);
  label();
})();
