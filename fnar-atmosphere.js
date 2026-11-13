/* FNAR harmless ambience, independent of AI, power and camera logic.
   Browser: window.FNAR_ATMOSPHERE. Node: require('./fnar-atmosphere.js'). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&typeof root.document!=='undefined')root.FNAR_ATMOSPHERE=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TYPES=Object.freeze([
    'light_flicker','distant_creak','camera_static',
    'shadow','ventilation','camera_anomaly'
  ]);
  const LIMITS=Object.freeze({1:1,2:2,3:2,4:3,5:3,6:3,7:2});
  const CAMERA_TYPES=new Set(['camera_static','camera_anomaly']);
  const AUDIO_TYPES=new Set(['distant_creak','ventilation']);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function safe(ctx){
    return Boolean(ctx?.active&&!ctx.paused&&!ctx.phone&&!ctx.jumpscare&&
      !ctx.victory&&!ctx.blackout&&!ctx.tabletBusy&&!ctx.danger);
  }
  function availableTypes(ctx){
    if(!safe(ctx))return [];
    return TYPES.filter(type=>CAMERA_TYPES.has(type)?
      Boolean(ctx.cameraOpen&&ctx.camera!==8):
      (type==='distant_creak'||type==='ventilation'||!ctx.cameraOpen));
  }
  function duration(type,rng){
    const ranges={light_flicker:[.3,.8],distant_creak:[.65,1.3],
      camera_static:[.2,.5],shadow:[1,2],ventilation:[3,6],camera_anomaly:[.3,.65]};
    const [min,max]=ranges[type];return min+(max-min)*clamp(rng(),0,.999999999);
  }
  function createSystem({rng=Math.random,onStart=()=>{},onFrame=()=>{},onEnd=()=>{}}={}){
    let night=1,elapsed=0,count=0,lastEnd=-60,active=null;
    const snapshot=()=>Object.freeze({night,elapsed,count,max:LIMITS[night],active:active?
      Object.freeze({...active}):null,lastEnd});
    function clear(){
      if(!active)return false;
      const old=active;active=null;lastEnd=elapsed;
      onEnd(old);return true;
    }
    function reset(value=1){
      clear();night=LIMITS[value]?value:1;
      elapsed=0;count=0;lastEnd=-60;
    }
    function launch(type,ctx,forced=false){
      if(active||!TYPES.includes(type)||!safe(ctx)||(!forced&&count>=LIMITS[night]))
        return false;
      if(!availableTypes(ctx).includes(type))return false;
      if(!forced&&(elapsed<45||elapsed-lastEnd<60))return false;
      const event={type,elapsed:0,duration:duration(type,rng)};
      active=event;
      if(!forced)count++;
      onStart(event);
      onFrame(event,ctx);return true;
    }
    function tick(dt,ctx){
      if(!Number.isFinite(dt)||dt<=0)return snapshot();
      if(ctx?.paused||ctx?.phone)return snapshot(); // Pause the event timer and animation.
      if(!ctx?.active){clear();return snapshot();}
      elapsed+=dt;
      if(active){
        // Remove any transient visual when a real threat or OS fault arrives.
        if(!safe(ctx)){clear();return snapshot();}
        active.elapsed+=dt;
        if(active.elapsed>=active.duration)clear();
        else onFrame(active,ctx);
        return snapshot();
      }
      const types=availableTypes(ctx);
      if(count>=LIMITS[night]||elapsed<45||elapsed-lastEnd<60||types.length===0)
        return snapshot();
      // Poisson arrivals; RNG controls a chance, not a mandatory fixed schedule.
      if(rng()<1-Math.exp(-dt/115)){
        const type=types[Math.floor(clamp(rng(),0,.999999999)*types.length)];
        launch(type,ctx);
      }
      return snapshot();
    }
    return Object.freeze({reset,tick,trigger:(type,ctx)=>launch(type,ctx,true),
      clear,status:snapshot,TYPES,LIMITS});
  }
  function createRenderer({office,camera,audio,reducedMotion=()=>false}){
    const hide=element=>{
      if(!element)return;
      element.className='atmosphere-overlay';
      element.style.opacity='0';
      element.style.transform='';
    };
    const clear=()=>{
      hide(office);hide(camera);
      audio?.stopAtmosphere?.();
    };
    function onStart(ev){
      clear();
      if(AUDIO_TYPES.has(ev.type))audio?.playAtmosphere?.(ev.type,ev.duration);
      const element=CAMERA_TYPES.has(ev.type)?camera:office;
      if(element)element.classList.add('atmos-'+ev.type);
    }
    function onFrame(ev,ctx){
      const target=CAMERA_TYPES.has(ev.type)?camera:office;
      if(!target)return;
      const t=clamp(ev.elapsed/ev.duration,0,1);
      const fade=Math.min(1,t*5,(1-t)*5);
      const quietMotion=reducedMotion();
      let amount=0;
      switch(ev.type){
        case 'light_flicker':amount=.14*fade;break;
        case 'camera_static':amount=.13*fade;break;
        case 'camera_anomaly':amount=.12*fade;break;
        case 'shadow':amount=(quietMotion?.11:.18)*fade;break;
        default:amount=0;
      }
      target.style.opacity=String(CAMERA_TYPES.has(ev.type)&&
        (!ctx.cameraOpen||ctx.camera===8)?0:amount);
      if(ev.type==='shadow')target.style.transform=quietMotion?'none':
        'translateX('+(t*18-9).toFixed(2)+'%)';
    }
    return {onStart,onFrame,onEnd:clear,clear};
  }
  return Object.freeze({TYPES,LIMITS,safe,availableTypes,duration,createSystem,createRenderer});
});
