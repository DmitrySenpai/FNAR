/* FNAR CCTV roster transition. Image-only effect; AI, clocks and controls never wait. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&typeof root.document!=='undefined')root.FNAR_CAMERA_TRANSITION=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DURATION_MS=500;
  const REVEAL_MS=250;
  const sameIds=(a,b)=>a.length===b.length&&a.every(id=>b.includes(id));
  function cameraRosterChanged({previousCamera,currentCamera,previousIds,nextIds,previousFile,nextFile,eligible}){
    return Boolean(eligible&&previousCamera===currentCamera&&
      Array.isArray(previousIds)&&Array.isArray(nextIds)&&
      !sameIds(previousIds,nextIds)&&
      typeof previousFile==='string'&&previousFile.length>0&&
      typeof nextFile==='string'&&nextFile.length>0&&
      previousFile!==nextFile);
  }
  function createController({
    warm,allowed,onStart,onReveal,onFinish,
    schedule=(fn,ms)=>setTimeout(fn,ms),
    unschedule=id=>clearTimeout(id)
  }){
    let active=null,serial=0;
    const copy=target=>({camera:target.camera,file:target.file,ids:[...(target.ids||[])]});
    const status=()=>active?Object.freeze({
      camera:active.camera,file:active.latest.file,
      started:active.started,token:active.token,revealDue:active.revealDue
    }):null;
    function cancel(reason='cancelled'){
      const job=active;
      if(!job)return false;
      active=null;
      if(job.first!==null)unschedule(job.first);
      if(job.second!==null)unschedule(job.second);
      onFinish(job,reason);
      return true;
    }
    function allowedNow(job){
      if(!allowed({camera:job.camera,file:job.latest.file,ids:job.latest.ids})){
        cancel('cancelled');return false;
      }
      return true;
    }
    function revealLatest(job){
      if(active!==job||!job.revealDue||!allowedNow(job))return;
      const newest=job.latest;
      if(!job.ready.has(newest.file))return; // Keep old frame until newest is decoded.
      if(job.revealed&&job.revealed.file===newest.file&&sameIds(job.revealed.ids,newest.ids))return;
      job.revealed=copy(newest);
      onReveal(copy(newest));
    }
    function begin(job){
      if(active!==job||job.started||!job.ready.has(job.latest.file)||!allowedNow(job))return;
      job.started=true;
      onStart(job);
      job.first=schedule(()=>{
        if(active!==job||!allowedNow(job))return;
        job.revealDue=true;
        revealLatest(job);
      },REVEAL_MS);
      job.second=schedule(()=>{
        if(active!==job||!allowedNow(job))return;
        revealLatest(job);
        active=null;onFinish(job,'completed');
      },DURATION_MS);
    }
    function prepare(job,file){
      if(job.ready.has(file)||job.loading.has(file))return;
      job.loading.add(file);
      Promise.resolve().then(()=>warm(file)).then(()=>{
        if(active!==job)return;
        job.loading.delete(file);job.ready.add(file);
        if(!allowedNow(job))return;
        if(!job.started)begin(job);
        else revealLatest(job); // Coalesce later movement without restarting the timer.
      }).catch(()=>{
        if(active!==job)return;
        job.loading.delete(file);
        if(job.latest.file===file)cancel('load-error');
      });
    }
    function start(target){
      if(active||!allowed(target))return false;
      const job={
        camera:target.camera,latest:copy(target),sourceFile:target.sourceFile||null,
        token:++serial,started:false,revealDue:false,first:null,second:null,
        ready:new Set(),loading:new Set(),revealed:null
      };
      active=job;
      prepare(job,job.latest.file);
      return true;
    }
    function update(target){
      const job=active;
      if(!job)return false;
      if(target.camera!==job.camera||!allowed(target)){cancel();return false;}
      job.latest=copy(target);
      if(!job.started&&job.sourceFile===target.file){
        cancel('reverted');return false;
      }
      prepare(job,target.file);
      if(job.started&&job.revealDue)revealLatest(job);
      return true;
    }
    return Object.freeze({start,update,cancel,status,cameraRosterChanged,
      DURATION_MS,REVEAL_MS});
  }
  return Object.freeze({DURATION_MS,REVEAL_MS,cameraRosterChanged,createController});
});
