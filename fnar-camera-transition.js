/* FNAR camera roster signal transition. Visual only: never changes AI or power. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&typeof root.document!=='undefined')root.FNAR_CAMERA_TRANSITION=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DURATION_MS=500;
  const REVEAL_MS=420;
  function secondRoosterArrives({previousCamera,currentCamera,previousIds,nextIds,previousFile,nextFile,eligible}){
    return Boolean(eligible&&previousCamera===currentCamera&&
      Array.isArray(previousIds)&&previousIds.length===1&&
      Array.isArray(nextIds)&&nextIds.length>=2&&
      nextIds.includes(previousIds[0])&&
      previousFile!==nextFile&&
      /_c\d+_c\d+\.webp$/.test(nextFile));
  }
  function createController({
    warm,allowed,onStart,onReveal,onFinish,
    schedule=(fn,ms)=>setTimeout(fn,ms),
    unschedule=id=>clearTimeout(id)
  }){
    let active=null;
    const status=()=>active?{camera:active.camera,file:active.file,
      started:active.started,token:active.token}:null;
    let token=0;
    function cancel(reason='cancelled'){
      if(!active)return false;
      const job=active;active=null;
      if(job.first!==null)unschedule(job.first);
      if(job.second!==null)unschedule(job.second);
      onFinish(job,reason);
      return true;
    }
    function start(target){
      if(active||!allowed(target))return false;
      const job={...target,token:++token,started:false,first:null,second:null};
      active=job;
      // Load/validate the replacement image before displaying any noise.
      // The old camera frame stays visible through the short effect.
      Promise.resolve().then(()=>warm(job.file)).then(()=>{
        if(active!==job)return;
        if(!allowed(job)){cancel();return;}
        job.started=true;
        onStart(job);
        job.first=schedule(()=>{
          if(active!==job)return;
          if(!allowed(job)){cancel();return;}
          onReveal(job);
          job.second=schedule(()=>{
            if(active!==job)return;
            active=null;onFinish(job,'completed');
          },DURATION_MS-REVEAL_MS);
        },REVEAL_MS);
      }).catch(error=>{
        if(active===job)cancel('load-error');
      });
      return true;
    }
    return Object.freeze({start,cancel,status,secondRoosterArrives,
      DURATION_MS,REVEAL_MS});
  }
  return Object.freeze({DURATION_MS,REVEAL_MS,secondRoosterArrives,createController});
});
