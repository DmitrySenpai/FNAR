/* FNAR tablet faults: deterministic rules, no DOM or external executables. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FNAR_TABLET_FAULTS=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TABLET_FAULTS=Object.freeze({
    IDLE:'idle',USB_DISCONNECT:'usb',REBOOT:'reboot',
    FROZEN_FEED:'frozen',SIGNAL_LOST:'signal_lost',
    INPUT_LAG:'input_lag',STALE_FEED:'stale',
    NETVIDEO_CRASH:'crash',AUDIO_SPAM:'audio_spam',
    CHICKEN_VIRUS:'chicken'
  });
  const CHANCES=Object.freeze([
    ['usb',15],['reboot',10],['frozen',15],['signal_lost',15],
    ['input_lag',12],['stale',10],['crash',8],['audio_spam',8],['chicken',7]
  ]);
  const AD_INTERVALS=Object.freeze({4:[25,40],5:[23,35],6:[20,30],7:[18,27]});
  const DURATIONS=Object.freeze({
    frozen:[4,7],signal_lost:[5,8],input_lag:[3,5],
    stale:[5,6],audio_spam:[4,6],chicken:[15,20]
  });
  function randomBetween(a,b,rng=Math.random){
    const v=Math.max(0,Math.min(.9999999999999999,Number(rng())));
    return a+(b-a)*v;
  }
  function nextAdDelay(night,rng=Math.random){
    const range=AD_INTERVALS[night];return range?randomBetween(...range,rng):Infinity;
  }
  function weightedFault(rng=Math.random){
    let roll=randomBetween(0,100,rng);
    for(const [mode,weight] of CHANCES){
      if(roll<weight)return mode;
      roll-=weight;
    }
    return CHANCES[CHANCES.length-1][0];
  }
  function faultDuration(mode,rng=Math.random){
    const range=DURATIONS[mode];return range?randomBetween(...range,rng):0;
  }
  function isCameraUnavailable(mode,camera,targetCamera=0){
    if(!Number.isInteger(camera)||camera<1||camera>9)return false;
    switch(mode){
      case TABLET_FAULTS.USB_DISCONNECT:
      case TABLET_FAULTS.REBOOT:
      case TABLET_FAULTS.NETVIDEO_CRASH:
        return true;
      case TABLET_FAULTS.FROZEN_FEED:
      case TABLET_FAULTS.STALE_FEED:
      case TABLET_FAULTS.SIGNAL_LOST:
        return targetCamera===camera;
      default:
        return false;
    }
  }
  function safeObservation(mode,camera,targetCamera=0,adVisible=false){
    return !adVisible&&!isCameraUnavailable(mode,camera,targetCamera);
  }
  function validFault(mode){
    return CHANCES.some(([candidate])=>candidate===mode);
  }
  if(CHANCES.reduce((acc,x)=>acc+x[1],0)!==100)throw new Error('Tablet fault weights must total 100%');
  return Object.freeze({TABLET_FAULTS,CHANCES,AD_INTERVALS,DURATIONS,
    randomBetween,nextAdDelay,weightedFault,faultDuration,isCameraUnavailable,
    safeObservation,validFault});
});
