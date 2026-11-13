/* FNAR power and game-time accounting: independent of night difficulty and FPS.
   Browser: window.FNAR_POWER; Node: require('./fnar-power.js'). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FNAR_POWER=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const NIGHT_LENGTH=360;
  const SIMULATION_STEP=0.05;
  const POWER_CONFIG=Object.freeze({
    base:0.095,
    camera:0.070,
    door:0.180,
    light:0.140
  });
  function validSeconds(seconds){
    if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Invalid positive elapsed seconds');
    return seconds;
  }
  function getPowerDrain(s={}){
    return POWER_CONFIG.base+
      (s.cameraOpen?POWER_CONFIG.camera:0)+
      (s.leftDoor?POWER_CONFIG.door:0)+
      (s.rightDoor?POWER_CONFIG.door:0)+
      (s.leftLight?POWER_CONFIG.light:0)+
      (s.rightLight?POWER_CONFIG.light:0);
  }
  function getUsageLevel(s={}){
    const drain=getPowerDrain(s);
    // Four existing bars, mapped to *actual* consumption rather than device count.
    // All thresholds track the power configuration if balancing values change.
    const thresholds=[
      POWER_CONFIG.base+POWER_CONFIG.camera*.8,
      POWER_CONFIG.base+POWER_CONFIG.door*1.2,
      POWER_CONFIG.base+POWER_CONFIG.door*2+POWER_CONFIG.camera*.25
    ];
    return 1+thresholds.reduce((n,threshold)=>n+Number(drain>=threshold-1e-10),0);
  }
  function resetNight(s){
    s.nightElapsed=0;
    s.power=100;
    return s;
  }
  function advanceClock(s,seconds,frozen=false){
    validSeconds(seconds);
    const old=Math.max(0,Math.min(NIGHT_LENGTH,Number(s.nightElapsed)||0));
    const passed=frozen?0:Math.min(seconds,NIGHT_LENGTH-old);
    s.nightElapsed=Math.min(NIGHT_LENGTH,old+passed);
    return passed;
  }
  function spendPower(s,seconds,controls={},frozen=false){
    validSeconds(seconds);
    const power=Math.max(0,Math.min(100,Number(s.power)||0));
    s.power=frozen?power:Math.max(0,power-seconds*getPowerDrain(controls));
    return s.power;
  }
  function forEachStep(elapsed,onStep){
    validSeconds(elapsed);
    if(typeof onStep!=='function')throw new TypeError('onStep must be a function');
    // Split actual wall elapsed time into short, deterministic AI/power steps.
    // In particular, do not truncate a 200 ms frame to 60 ms (which stretches nights).
    // An entire 360 s active night is an upper bound if a tab stalls for a long time.
    let remaining=Math.min(elapsed,NIGHT_LENGTH);
    let count=0;
    while(remaining>1e-9){
      const step=Math.min(SIMULATION_STEP,remaining);
      remaining-=step;
      count++;
      if(onStep(step)===false)break;
    }
    return count;
  }
  return Object.freeze({POWER_CONFIG,NIGHT_LENGTH,SIMULATION_STEP,
    getPowerDrain,getUsageLevel,resetNight,advanceClock,spendPower,forEachStep});
});
