/* FNAR shared asset and audio manager. Keep this script before app.js and tablet-os.js. */
(function(global) {
  'use strict';
  const VERSION = 'v055';
  const CACHE = 'fnar-game-assets-' + VERSION;
  const SHORT = new Set(['beep','blip','chimes','door','hang-up','knock','knock-2','knock-3',
    'open-camera','os_balloon','os_info','os_shutdown','os_startup','os_usb_connect',
    'os_usb_remove','power-outage','running-fast','running','scream','static-bm','light']);
  const audioBuffers = new Map(), pending = new Map(), urls = new Map(), blobs = new Map(), active = new Set();
  const errors = new Set();
  let context = null, muted = false, paused = false, cachePromise = null;
  let completed = 0, failures = 0;
  const sounds = new Map();
  const cap = value => Math.max(0,Math.min(1,Number(value)||0));
  function warnOnce(key,error) {
    if(errors.has(key)) return;
    errors.add(key);
    console.warn('[FNAR audio] ' + key, error);
  }
  function getContext() {
    if(context) return context;
    const Ctor = global.AudioContext || global.webkitAudioContext;
    if(Ctor) {
      try { context = new Ctor(); } catch(e) { warnOnce('AudioContext unavailable',e); }
    }
    return context;
  }
  function unlock() {
    const ctx = getContext();
    if(!ctx) return Promise.resolve(false);
    return ctx.resume().then(()=>true).catch(e=>{warnOnce('AudioContext resume failed',e);return false;});
  }
  async function getCache() {
    if(!('caches' in global) || global.location?.protocol==='file:') return null;
    if(!cachePromise) cachePromise = caches.open(CACHE).catch(e=>{
      warnOnce('CacheStorage unavailable',e);return null;
    });
    return cachePromise;
  }
  async function cleanOldCaches() {
    if(!('caches' in global)) return;
    try {
      for(const key of await caches.keys()) {
        if(key.startsWith('fnar-game-assets-') && key !== CACHE) await caches.delete(key);
      }
    }catch(e){warnOnce('Cache cleanup failed',e);}
  }
  function contentRange(response) {
    const header = response.headers.get('Content-Range') || '';
    const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(header);
    if(!m) throw Error('Invalid Content-Range: '+header);
    const start=Number(m[1]),end=Number(m[2]),total=Number(m[3]);
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||!Number.isSafeInteger(total)
       ||start<0||end<start||end>=total||total===0) throw Error('Invalid byte range');
    return {start,end,total};
  }
  function validated200(response,bytes) {
    const length = response.headers.get('Content-Length');
    // Fetch exposes a decoded body, while Content-Length may describe a
    // compressed transfer (e.g. a gzip-compressed SVG). Compare only identity.
    const encoding=(response.headers.get('Content-Encoding')||'identity').toLowerCase();
    if(encoding==='identity'&&length!==null && (!/^\d+$/.test(length)||Number(length)!==bytes.byteLength))
      throw Error('Incomplete HTTP 200 response');
    if(!bytes.byteLength)throw Error('Empty HTTP 200 response');
    return bytes;
  }
  async function fetchFull(path) {
    // First try a whole-file request without relying on a stale browser HTTP cache.
    const request = new Request(path,{cache:'reload'});
    let response = await fetch(request);
    if(response.status===200) {
      const bytes = validated200(response,await response.arrayBuffer());
      return new Response(bytes,{status:200,headers:{'Content-Type':response.headers.get('Content-Type')||guessType(path),'Content-Length':String(bytes.byteLength)}});
    }
    if(response.status!==206) throw Error('HTTP '+response.status+' for '+path);
    // Some servers insist on 206. Reconstruct with strict byte ranges and no overlap.
    const first = contentRange(response);
    const total=first.total;
    if(total>512*1024*1024) throw Error('Asset too large to reconstruct');
    const chunks=[];
    const blockSize=1024*1024;
    const mime=response.headers.get('Content-Type')||guessType(path);
    // Start from byte zero: the initial unsolicited partial response may start elsewhere.
    // Always issue explicit ranges; reject any response that ignores or changes them.
    for(let start=0;start<total;) {
      const end=Math.min(total-1,start+blockSize-1);
      const part=await fetch(path,{cache:'no-store',headers:{Range:'bytes='+start+'-'+end,'Accept':'*/*'}});
      if(part.status===200 && start===0) {
        const all=validated200(part,await part.arrayBuffer());
        if(all.byteLength!==total) throw Error('Full response differs from advertised total');
        return new Response(all,{status:200,headers:{'Content-Type':part.headers.get('Content-Type')||mime,'Content-Length':String(all.byteLength)}});
      }
      if(part.status!==206) throw Error('Expected 206 for range '+start+'-'+end+', got '+part.status);
      const range=contentRange(part);
      if(range.total!==total || range.start!==start || range.end>end)
        throw Error('Unexpected Content-Range for '+start+'-'+end);
      const data=new Uint8Array(await part.arrayBuffer());
      if(data.byteLength!==range.end-range.start+1) throw Error('Truncated range at '+start);
      chunks.push(data);
      start=range.end+1;
    }
    const all=new Uint8Array(total);
    let offset=0;
    for(const chunk of chunks) { all.set(chunk,offset);offset+=chunk.byteLength; }
    if(offset!==total) throw Error('Missing bytes in reconstructed resource');
    return new Response(all,{status:200,headers:{'Content-Type':mime,'Content-Length':String(total)}});
  }
  function guessType(path) {
    if(/\.mp3(?:$|\?)/i.test(path))return 'audio/mpeg';
    if(/\.webm(?:$|\?)/i.test(path))return 'video/webm';
    if(/\.webp(?:$|\?)/i.test(path))return 'image/webp';
    if(/\.png(?:$|\?)/i.test(path))return 'image/png';
    if(/\.svg(?:$|\?)/i.test(path))return 'image/svg+xml';
    return 'application/octet-stream';
  }
  async function getAsset(path) {
    if(pending.has(path))return pending.get(path);
    const task=(async()=>{
      const retained=blobs.get(path);
      if(retained)return retained;
      const cache=await getCache();
      let response=null;
      if(cache){try{response=await cache.match(path);}catch(error){warnOnce('Cache read unavailable: '+path,error);}}
      // Only full cache entries are valid. Purge suspect old entries.
      if(response){
        const len=response.headers.get('Content-Length');
        const body=await response.clone().arrayBuffer();
        if(response.status!==200||!body.byteLength||(len!==null&&Number(len)!==body.byteLength)){
          try{await cache.delete(path);}catch(_){}response=null;
        }
      }
      const downloaded=!response;
      if(!response)response=await fetchFull(path);
      const blob=await response.blob();
      if(!blob.size)throw Error('Empty resource: '+path);
      if(downloaded&&cache){
        try{await cache.put(path,new Response(blob,{status:200,
          headers:{'Content-Type':response.headers.get('Content-Type')||guessType(path),
                   'Content-Length':String(blob.size)}}));}
        catch(e){warnOnce('Could not persist '+path,e);}
      }
      completed++;
      blobs.set(path,blob);
      return blob;
    })().catch(e=>{failures++;warnOnce('Load failed: '+path,e);throw e;})
      .finally(()=>pending.delete(path));
    pending.set(path,task);
    return task;
  }
  async function getURL(path) {
    if(urls.has(path))return urls.get(path);
    const blob=await getAsset(path);
    const url=global.URL.createObjectURL(blob);
    urls.set(path,url);
    return url;
  }
  async function preload(name) {
    if(!SHORT.has(name)) return getURL('assets/sound/'+name+'.mp3');
    if(audioBuffers.has(name))return audioBuffers.get(name);
    if(sounds.has(name))return sounds.get(name);
    const promise=(async()=>{
      const ctx=getContext();
      if(!ctx)throw Error('Web Audio not available');
      const blob=await getAsset('assets/sound/'+name+'.mp3');
      const raw=await blob.arrayBuffer();
      const buffer=await ctx.decodeAudioData(raw);
      audioBuffers.set(name,buffer);
      return buffer;
    })().finally(()=>sounds.delete(name));
    sounds.set(name,promise);
    return promise;
  }

  // Web Audio playback handles implement pause/resume, unlike a one-shot
  // AudioBufferSourceNode. Mixer.register() controls every handle's base gain.
  function play(name,base=.5,options={}) {
    const loop=!!options.loop;
    const mixer=global.FNAR_AUDIO_SETTINGS;
    let handle;
    if(SHORT.has(name)&&audioBuffers.has(name)&&getContext()){
      const ctx=getContext(),buffer=audioBuffers.get(name),gain=ctx.createGain();
      gain.connect(ctx.destination);
      const listeners=new Map();
      let node=null,offset=0,startedAt=0,playing=false,disposed=false;
      let vol=cap(base),silent=muted,ended=null,error=null;
      const apply=()=>{gain.gain.value=silent?0:vol;};
      function finish(){
        if(disposed)return;
        disposed=true;playing=false;node=null;active.delete(handle);
        mixer?.forget(handle);
        for(const cb of listeners.get('ended')||[])try{cb();}catch(_){}
        if(typeof ended==='function')ended();
        try{gain.disconnect();}catch(_){}
      }
      function start(){
        if(disposed||playing)return Promise.resolve();
        try{
          const source=ctx.createBufferSource();source.buffer=buffer;source.loop=loop;
          source.connect(gain);
          node=source;startedAt=ctx.currentTime;playing=true;
          const startOffset=loop?offset%(buffer.duration||1):Math.min(offset,Math.max(0,buffer.duration-.001));
          source.onended=()=>{if(node===source&&playing)finish();};
          source.start(0,startOffset);
          if(ctx.state==='suspended'&&!paused)ctx.resume().catch(()=>{});
        }catch(e){
          playing=false;warnOnce('Effect failed: '+name,e);finish();return Promise.reject(e);
        }
        return Promise.resolve();
      }
      function pause(){
        if(!playing||disposed)return;
        offset+=ctx.currentTime-startedAt;
        if(loop)offset%=buffer.duration||1;
        else offset=Math.min(offset,buffer.duration);
        const old=node;node=null;playing=false;
        if(old){old.onended=null;try{old.stop();old.disconnect();}catch(_){}}
      }
      handle={
        __webAudio:true,__name:name,
        pause,play:start,
        get paused(){return !playing;},
        get currentTime(){return playing?offset+ctx.currentTime-startedAt:offset;},
        set currentTime(value){offset=Math.max(0,Number(value)||0);if(playing){pause();start();}},
        get volume(){return vol;},set volume(v){vol=cap(v);apply();},
        get muted(){return silent;},set muted(v){silent=!!v;apply();},
        get loop(){return loop;},
        get onended(){return ended;},set onended(fn){ended=fn;},
        get onerror(){return error;},set onerror(fn){error=fn;},
        dispose(){pause();disposed=true;active.delete(handle);mixer?.forget(handle);try{gain.disconnect();}catch(_){}},
        addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
        removeEventListener(type,fn){listeners.get(type)?.delete(fn);}
      };
      apply();
      active.add(handle);
      mixer?.register(handle,'effects',base);
      if(!paused)start().catch(()=>{});
      return handle;
    }
    // Safe fallback: browsers can stream the original URL. Never treat a 206
    // body as a complete blob, even when a server disallows range reconstruction.
    const path='assets/sound/'+name+'.mp3';
    handle=new Audio(options.url||urls.get(path)||path);
    handle.preload='auto';handle.loop=loop;
    handle.__name=name;
    handle.volume=cap(base);handle.muted=muted;
    active.add(handle);
    mixer?.register(handle,'effects',base);
    function done(){active.delete(handle);mixer?.forget(handle);}
    handle.addEventListener('ended',done,{once:true});
    handle.addEventListener('error',done,{once:true});
    if(!paused)handle.play().catch(e=>warnOnce('Playback blocked: '+name,e));
    return handle;
  }
  function release(token){
    if(!token)return;
    if(typeof token.dispose==='function')token.dispose();
    else {token.pause();active.delete(token);global.FNAR_AUDIO_SETTINGS?.forget(token);}
  }
  function stop(name) {
    for(const token of [...active])if(!name||token.__name===name){
      release(token);try{token.currentTime=0;}catch(_){}
    }
  }
  const stopAll=()=>stop();
  function setMuted(value) {
    muted=!!value;
    for(const token of active)token.muted=muted;
  }
  function setPaused(value) {
    const next=!!value;
    if(paused===next)return;paused=next;
    if(context) {
      const promise=paused?context.suspend():context.resume();
      if(promise?.catch)promise.catch(()=>{});
    }
  }
  async function checkCache() {
    const cache=await getCache();
    if(!cache)return {available:false};
    const keys=await cache.keys();
    let valid=0,invalid=0;
    for(const request of keys) {
      const response=await cache.match(request);
      if(!response||response.status!==200){invalid++;continue;}
      const bytes=await response.arrayBuffer(),len=response.headers.get('Content-Length');
      if(!bytes.byteLength||(len!==null&&Number(len)!==bytes.byteLength))invalid++;
      else valid++;
    }
    const result={available:true,entries:keys.length,valid,invalid};
    console.table(result);return result;
  }
  const api={getAsset,getURL,preload,unlock,play,stop,stopAll,release,setMuted,setPaused,
    cleanOldCaches,checkCache,fetchFull,contentRange,
    isShort:name=>SHORT.has(name),hasBuffer:name=>audioBuffers.has(name),cacheName:CACHE,
    status(){const result={cachedObjectURLs:urls.size,decoded:audioBuffers.size,
      loaded:completed,failed:failures,active:active.size,muted,paused,
      contextState:context?.state||'unavailable'};
      console.table(result);return result;}
  };
  global.AudioManager=api;
  global.FNARAudioDebug={status:()=>api.status(),
    test:name=>{api.unlock();return api.play(name,.5);},
    checkCache:()=>api.checkCache()};
  if(global.location?.protocol!=='file:')cleanOldCaches();
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
