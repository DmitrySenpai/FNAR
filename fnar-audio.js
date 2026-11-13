/* FNAR shared asset and audio manager. Keep this script before app.js and tablet-os.js. */
(function(global) {
  'use strict';
  const VERSION = 'v051';
  const CACHE = 'fnar-game-assets-' + VERSION;
  const SHORT = new Set(['beep','blip','chimes','door','hang-up','knock','knock-2','knock-3',
    'open-camera','os_balloon','os_info','os_shutdown','os_startup','os_usb_connect',
    'os_usb_remove','power-outage','running-fast','running','scream','static-bm']);
  const audioBuffers = new Map(), pending = new Map(), urls = new Map(), active = new Set();
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
    if(!('caches' in global) || location.protocol==='file:') return null;
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
    if(length!==null && (!/^\d+$/.test(length)||Number(length)!==bytes.byteLength))
      throw Error('Incomplete HTTP 200 response');
    return bytes;
  }
  async function fetchFull(path) {
    // First try a whole-file request without relying on a stale browser HTTP cache.
    const request = new Request(path,{cache:'reload',headers:{'Accept-Encoding':'identity'}});
    let response = await fetch(request);
    if(response.status===200) {
      const bytes = validated200(response,await response.arrayBuffer());
      return new Response(bytes,{status:200,headers:{'Content-Type':response.headers.get('Content-Type')||guessType(path)}});
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
      const part=await fetch(path,{cache:'no-store',headers:{Range:'bytes='+start+'-'+end,'Accept-Encoding':'identity'}});
      if(part.status===200 && start===0) {
        const all=validated200(part,await part.arrayBuffer());
        if(all.byteLength!==total) throw Error('Full response differs from advertised total');
        return new Response(all,{status:200,headers:{'Content-Type':part.headers.get('Content-Type')||mime}});
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
      const cache=await getCache();
      let response=cache && await cache.match(path);
      // Only full cache entries are valid. Purge suspect old entries.
      if(response && response.status!==200) {await cache.delete(path);response=null;}
      if(!response) {
        response=await fetchFull(path);
        if(cache) {
          try{await cache.put(path,response.clone());}
          catch(e){warnOnce('Could not persist '+path,e);}
        }
      }
      const blob=await response.blob();
      if(!blob.size)throw Error('Empty resource: '+path);
      completed++;
      return blob;
    })().catch(e=>{failures++;warnOnce('Load failed: '+path,e);throw e;})
      .finally(()=>pending.delete(path));
    pending.set(path,task);
    return task;
  }
  async function getURL(path) {
    if(urls.has(path))return urls.get(path);
    const blob=await getAsset(path);
    const url=URL.createObjectURL(blob);
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
  function makeMedia(name,volume,loop) {
    const path='assets/sound/'+name+'.mp3';
    const el=new Audio(urls.get(path)||path);
    el.preload='auto';el.loop=loop;el.volume=cap(volume);el.muted=muted;
    const token={ pause(){el.pause();},play(){return el.play();},
      get paused(){return el.paused;},get currentTime(){return el.currentTime;},
      set currentTime(t){try{el.currentTime=t;}catch(_){ }},
      get volume(){return el.volume;},set volume(v){el.volume=cap(v);},
      get muted(){return el.muted;},set muted(v){el.muted=!!v;},
      get loop(){return el.loop;},set loop(v){el.loop=!!v;},
      get onended(){return el.onended;},set onended(v){el.onended=v;},
      get onerror(){return el.onerror;},set onerror(v){el.onerror=v;} };
    token.__name=name;
    active.add(token);
    el.addEventListener('ended',()=>active.delete(token),{once:true});
    el.addEventListener('error',()=>active.delete(token),{once:true});
    if(!paused)el.play().catch(e=>warnOnce('Playback blocked: '+name,e));
    return token;
  }
  function play(name,volume=.5,options={}) {
    const loop=!!options.loop;
    if(!SHORT.has(name)||!audioBuffers.has(name)||!getContext())
      return makeMedia(name,volume,loop);
    const ctx=getContext(),source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=audioBuffers.get(name);source.loop=loop;gain.gain.value=muted?0:cap(volume);
    source.connect(gain);gain.connect(ctx.destination);
    let stopped=false,startedAt=ctx.currentTime,offset=0,ended=null;
    const handle={
      pause(){if(stopped)return;offset=(offset+ctx.currentTime-startedAt)%(source.buffer.duration||1);try{source.stop();}catch(_){}stopped=true;active.delete(handle);},
      play(){return Promise.resolve();},
      get paused(){return stopped;},
      get currentTime(){return stopped?offset:offset+ctx.currentTime-startedAt;},
      set currentTime(_) {},
      get volume(){return volume;},set volume(v){volume=cap(v);gain.gain.value=muted?0:volume;},
      get muted(){return muted;},set muted(v){gain.gain.value=v?0:cap(volume);},
      get loop(){return source.loop;},set loop(v){source.loop=!!v;},
      get onended(){return ended;},set onended(fn){ended=fn;}
    };
    source.onended=()=>{if(!stopped){stopped=true;active.delete(handle);if(ended)ended();}};
    handle.__name=name;
    active.add(handle);
    if(paused){gain.gain.value=0;}
    source.start();
    return handle;
  }
  function stop(name) {
    for(const token of [...active]) if(!name||token.__name===name) {token.pause();active.delete(token);}
  }
  function stopAll(){for(const token of [...active]){token.pause();}active.clear();}
  function setMuted(value) {
    muted=!!value;
    for(const token of active)token.muted=muted;
  }
  function setPaused(value) {
    paused=!!value;
    if(context) {
      if(paused)context.suspend().catch(()=>{});
      else context.resume().catch(()=>{});
    }
    // Media sounds are paused via the existing game controls.
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
    console.table(result);
    return result;
  }
  const api={getAsset,getURL,preload,unlock,play,stop,stopAll,setMuted,setPaused,cleanOldCaches,
    isShort:name=>SHORT.has(name), hasBuffer:name=>audioBuffers.has(name), cacheName:CACHE,
    status(){const result={cachedObjectURLs:urls.size,decoded:audioBuffers.size,loaded:completed,failed:failures,active:active.size,muted,paused,contextState:context?.state||'unavailable'};console.table(result);return result;},
    checkCache};
  // Explicit stable debugging API for development console.
  global.AudioManager=api;
  global.FNARAudioDebug={status:()=>api.status(),test:name=>{api.unlock();return api.play(name,.5);},checkCache};
  if(location.protocol!=='file:')cleanOldCaches();
})(window);
