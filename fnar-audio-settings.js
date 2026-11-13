/* FNAR audio controls: persistent categories and live gain changes.
   Browser: window.FNAR_AUDIO_SETTINGS. Node: require('./fnar-audio-settings.js'). */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&typeof root.document!=='undefined')
    root.FNAR_AUDIO_SETTINGS=api.createManager((()=>{try{return root.localStorage}catch(_){return null}})());
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const STORAGE_KEY='fnar_audio_settings';
  const CATEGORIES=Object.freeze(['master','effects','ambience','phone','tablet']);
  const DEFAULTS=Object.freeze({master:100,effects:100,ambience:100,phone:100,tablet:100});
  const clamp=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Math.round(Number(value)))):100;
  function load(storage){
    let raw;
    try{raw=JSON.parse(storage?.getItem(STORAGE_KEY)||'null');}catch(_){raw=null;}
    return Object.fromEntries(CATEGORIES.map(key=>[key,clamp(raw&&Object.prototype.hasOwnProperty.call(raw,key)?raw[key]:100)]));
  }
  function createManager(storage=null){
    let settings=load(storage),muted=false;
    const media=new Map(),listeners=new Set();
    let context=null,bus=null,synth=null,synthPaused=false;
    const values=()=>({...settings});
    const effective=(base,category)=>Math.max(0,Math.min(1,Number(base)||0))*
      settings.master/100*(settings[category]??100)/100;
    const applyMedia=(el,data)=>{
      try{el.volume=effective(data.base,data.category);el.muted=muted;}catch(_){}
    };
    const applyAll=()=>{
      for(const [el,data]of media)applyMedia(el,data);
      if(bus)bus.gain.value=muted?0:effective(1,'ambience');
      for(const fn of listeners)try{fn(values());}catch(error){console.warn('[FNAR Audio] listener error',error);}
    };
    const api={
      get:values,
      get muted(){return muted;},
      effective,
      register(el,category='effects',base=1){
        if(!el)return el;
        if(!CATEGORIES.includes(category)||category==='master')throw new RangeError('Invalid audio category');
        const previous=media.get(el);
        if(previous&&el.removeEventListener)el.removeEventListener('ended',previous.cleanup);
        const cleanup=()=>api.forget(el);
        const data={category,base:Math.max(0,Math.min(1,Number(base)||0)),cleanup};
        media.set(el,data);
        if(el.addEventListener)el.addEventListener('ended',cleanup,{once:true});
        applyMedia(el,data);return el;
      },
      forget(el){
        const data=media.get(el);
        if(data&&el.removeEventListener)el.removeEventListener('ended',data.cleanup);
        media.delete(el);
      },
      set(category,value){
        if(!CATEGORIES.includes(category))throw new RangeError('Invalid audio category');
        settings={...settings,[category]:clamp(value)};
        try{storage?.setItem(STORAGE_KEY,JSON.stringify(settings));}catch(_){}
        applyAll();return settings[category];
      },
      setMuted(value){muted=Boolean(value);applyAll();return muted;},
      subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
      trackedCount(){return media.size;},
      unlockAtmosphere(){
        if(!context){
          const Ctor=root?.AudioContext||root?.webkitAudioContext;
          if(!Ctor)return false;
          try{
            context=new Ctor();
            bus=context.createGain();bus.connect(context.destination);
            bus.gain.value=muted?0:effective(1,'ambience');
          }catch(_){context=null;return false;}
        }
        if(!synthPaused&&context.state==='suspended')context.resume().catch(()=>{});
        return true;
      },
      stopAtmosphere(){
        if(synth){
          try{synth.source.stop();}catch(_){}
          try{synth.source.disconnect();synth.env.disconnect();}catch(_){}
          synth=null;
        }
      },
      pauseAtmosphere(value){
        const next=Boolean(value);
        if(synthPaused===next)return;
        synthPaused=next;
        if(!context)return;
        if(next&&context.state==='running')context.suspend().catch(()=>{});
        if(!next&&context.state==='suspended')context.resume().catch(()=>{});
      },
      // Light non-threatening synthesized sounds; no new MP3 downloads, door knocks or attack cues.
      playAtmosphere(type,duration){
        api.stopAtmosphere();
        if(!['distant_creak','ventilation'].includes(type))return false;
        if(!api.unlockAtmosphere())return false;
        const now=context.currentTime,length=Math.max(.1,Number(duration)||1);
        const env=context.createGain();
        env.connect(bus);
        const source=context.createOscillator();
        if(type==='distant_creak'){
          source.type='triangle';
          source.frequency.setValueAtTime(240,now);
          source.frequency.exponentialRampToValueAtTime(95,now+Math.min(length,.9));
          env.gain.setValueAtTime(0,now);
          env.gain.linearRampToValueAtTime(.035,now+.12);
          env.gain.exponentialRampToValueAtTime(.0001,now+length);
        }else{
          source.type='sine';
          source.frequency.setValueAtTime(73,now);
          source.frequency.linearRampToValueAtTime(79,now+length);
          env.gain.setValueAtTime(0,now);
          env.gain.linearRampToValueAtTime(.055,now+Math.min(1,length/3));
          env.gain.setValueAtTime(.055,now+Math.max(.1,length-1));
          env.gain.linearRampToValueAtTime(0,now+length);
        }
        source.connect(env);
        source.start(now);source.stop(now+length+.02);
        synth={source,env};
        source.onended=()=>{if(synth?.source===source){synth=null;try{source.disconnect();env.disconnect();}catch(_){}}};
        return true;
      }
    };
    return api;
  }
  return Object.freeze({STORAGE_KEY,CATEGORIES,DEFAULTS,clamp,load,createManager});
});
