'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const AUDIO=require('../fnar-audio-settings.js');
const SOURCE=fs.readFileSync(path.join(__dirname,'../fnar-audio.js'),'utf8');
function sandboxWith(fetchImpl,{cacheAvailable=true,quotaError=false,decoded=false}={}){
  const store=new Map();
  const metrics={network:[],putStatuses:[],decodeCalls:0};
  const cache={
    async match(key){return store.get(String(key))?.clone()||null;},
    async put(key,response){metrics.putStatuses.push(response.status);
      if(quotaError)throw Error('QuotaExceededError');store.set(String(key),response.clone());},
    async delete(key){return store.delete(String(key));},
    async keys(){return [...store.keys()].map(url=>({url}));}
  };
  const caches={
    async open(){return cache;},
    async keys(){return ['fnar-game-assets-v050','fnar-game-assets-v055'];},
    async delete(){return true;}
  };
  class FakeAudioContext{
    constructor(){this.state='running';this.currentTime=0;this.destination={};}
    resume(){this.state='running';return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    decodeAudioData(buffer){metrics.decodeCalls++;
      return Promise.resolve({duration:1,byteLength:buffer.byteLength});}
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
    createBufferSource(){return {buffer:null,loop:false,connect(){},start(){},stop(){},disconnect(){},onended:null};}
  }
  const storage={getItem(){return null;},setItem(){}};
  const global={location:{protocol:'https:'},localStorage:storage,
    AudioContext:decoded?FakeAudioContext:undefined,
    FNAR_AUDIO_SETTINGS:AUDIO.createManager(storage),
    URL:{createObjectURL:()=> 'blob:mock'}};
  if(cacheAvailable)global.caches=caches;
  const fakeRequest=function(url,options={}){return {url:String(url),headers:new Headers(options.headers),cache:options.cache};};
  const ctx={window:global,caches:global.caches,fetch:async(req,options)=>{
    const out=await fetchImpl(req,options);metrics.network.push({request:req,options,status:out.status});return out;
  },Request:fakeRequest,Response,Headers,URL:global.URL,Blob,console,
    module:{exports:{}},Uint8Array,ArrayBuffer,Math,Promise};
  vm.runInNewContext(SOURCE,ctx,{filename:'fnar-audio.js'});
  return {api:global.AudioManager,store,metrics,cache,mixer:global.FNAR_AUDIO_SETTINGS};
}
function headers(start,end,total){return {'Content-Range':'bytes '+start+'-'+end+'/'+total,'Content-Type':'audio/mpeg',
  'Content-Length':String(end-start+1)};}
test('HTTP 206 assembles a full verified 200 and saves only whole resources',async()=>{
  const source=Uint8Array.from({length:1048615},(_,i)=>i%251);
  const fixture=sandboxWith(async(request,options)=>{
    const range=options?.headers?.Range;
    if(!range)return new Response(source.subarray(0,256),{status:206,headers:headers(0,255,source.length)});
    const m=range.match(/^bytes=(\d+)-(\d+)$/);
    assert.ok(m);
    const start=Number(m[1]),end=Math.min(Number(m[2]),source.length-1);
    return new Response(source.subarray(start,end+1),{status:206,headers:headers(start,end,source.length)});
  });
  const blob=await fixture.api.getAsset('assets/sound/beep.mp3');
  assert.equal(blob.size,source.length);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  assert.equal(Buffer.compare(bytes,source),0);
  assert.deepEqual(fixture.metrics.putStatuses,[200]);
  assert.equal((await fixture.cache.match('assets/sound/beep.mp3')).status,200);
  const fetched=fixture.metrics.network.length;
  await fixture.api.getAsset('assets/sound/beep.mp3');
  assert.equal(fixture.metrics.network.length,fetched,'warm in-memory asset must not refetch');
});
test('HTTP 206 with missing bytes is rejected and never persisted as complete',async()=>{
  const fx=sandboxWith(async(_request,options)=>{
    if(!options?.headers?.Range)
      return new Response('abcd',{status:206,headers:headers(0,3,12)});
    return new Response('ab',{status:206,headers:headers(0,3,12)});
  });
  await assert.rejects(()=>fx.api.getAsset('assets/sound/door.mp3'),/Truncated range/);
  assert.equal(fx.metrics.putStatuses.length,0);
});
test('HTTP 200 with incorrect declared Content-Length must not be cached',async()=>{
  const fx=sandboxWith(async()=>new Response('abcd',{status:200,headers:{'Content-Length':'15'}}));
  await assert.rejects(()=>fx.api.getAsset('assets/sound/door.mp3'),/Incomplete HTTP 200/);
  assert.equal(fx.metrics.putStatuses.length,0);
});
test('compressed HTTP 200 uses decoded response bytes rather than compressed wire length',async()=>{
  // Fetch presents decompressed bytes to JS but often leaves transfer length header.
  const fx=sandboxWith(async()=>new Response('decoded svg body',{
    status:200,headers:{'Content-Length':'5','Content-Encoding':'gzip','Content-Type':'image/svg+xml'}
  }));
  const blob=await fx.api.getAsset('assets/ui/director_signature.svg');
  assert.equal(blob.size,16);
  assert.deepEqual(fx.metrics.putStatuses,[200]);
  const cached=await fx.cache.match('assets/ui/director_signature.svg');
  assert.equal(cached.headers.get('Content-Encoding'),null,'synthetic 200 must not keep stale encoding');
});
test('CacheStorage quota refusal does not prevent complete audio from loading',async()=>{
  const fx=sandboxWith(async()=>new Response('complete sound',{status:200}),{quotaError:true});
  const blob=await fx.api.getAsset('assets/sound/beep.mp3');
  assert.equal(blob.size,14);
  assert.deepEqual(fx.metrics.putStatuses,[200]);
});
test('No CacheStorage still accepts complete HTTP 200 content',async()=>{
  const fx=sandboxWith(async()=>new Response('complete sound',{status:200}),{cacheAvailable:false});
  const blob=await fx.api.getAsset('assets/sound/beep.mp3');
  assert.equal(blob.size,14);
  assert.equal(fx.metrics.putStatuses.length,0);
});
test('predecoded WebAudio effect follows only master volume, including mute/pause',async()=>{
  const fx=sandboxWith(async()=>new Response('audio buffer content',{status:200}),{decoded:true});
  await fx.api.preload('beep');
  assert.equal(fx.metrics.decodeCalls,1);
  const token=fx.api.play('beep',.5);
  assert.equal(token.__webAudio,true);
  fx.mixer.set('master',20);
  assert.equal(token.volume,.1);
  fx.mixer.setMuted(true);
  assert.equal(token.muted,true);
  fx.mixer.setMuted(false);
  assert.equal(token.muted,false);
  token.pause();assert.equal(token.paused,true);
  await token.play();assert.equal(token.paused,false);
  fx.api.release(token);
  assert.equal(fx.mixer.trackedCount(),0);
  await fx.api.preload('beep');
  assert.equal(fx.metrics.decodeCalls,1);
});

test('flashlight loop is routed through a decoded WebAudio buffer when available',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  assert.match(app,/name==='light'&&window\.AudioManager\.hasBuffer\(name\)/);
  assert.match(app,/window\.AudioManager\.play\(name,volume,\{loop:true,url:soundURL\(name\)\}\)/);
  assert.match(app,/window\.AudioManager\.release\(a\);audioLoops\.delete\(name\)/);
});
