'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CAMERA=require('../fnar-camera-transition.js');
const read=pathName=>fs.readFileSync(path.join(__dirname,'..',pathName),'utf8');
const candidate={
  previousCamera:3,currentCamera:3,previousIds:[2],nextIds:[2,3],
  previousFile:'cam03_c2.webp',nextFile:'cam03_c2_c3.webp',eligible:true
};
function fakeTimers(){
  let now=0,serial=0;const pending=new Map();
  return {
    schedule(fn,ms){const id=++serial;pending.set(id,{fn,at:now+ms});return id;},
    unschedule(id){pending.delete(id);},
    advance(ms){const end=now+ms;for(;;){
      let first=null;
      for(const [id,item] of pending){
        if(item.at<=end&&(!first||item.at<first.item.at))first={id,item};
      }
      if(!first)break;
      now=first.item.at;pending.delete(first.id);first.item.fn();
    }
    now=end;},
    get time(){return now;},get count(){return pending.size;}
  };
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('a second rooster entering the already-open feed is the only supported trigger',()=>{
  assert.equal(CAMERA.DURATION_MS,500);
  assert.ok(CAMERA.REVEAL_MS>=400&&CAMERA.REVEAL_MS<500);
  assert.equal(CAMERA.secondRoosterArrives(candidate),true);
  const denied=[
    {...candidate,eligible:false}, // closed, paused, faulted or unobserved
    {...candidate,previousCamera:2}, // changed camera
    {...candidate,currentCamera:4}, // switched while viewed
    {...candidate,previousIds:[]}, // first bird arriving
    {...candidate,previousIds:[2,3]}, // two already present
    {...candidate,nextIds:[2]}, // no newcomer
    {...candidate,nextIds:[3,4]}, // the prior bird left; not a newcomer
    {...candidate,previousFile:candidate.nextFile},
    {...candidate,nextFile:'cam03_c2.webp'} // no visible two-rooster variant
  ];
  for(const item of denied)assert.equal(CAMERA.secondRoosterArrives(item),false,JSON.stringify(item));
});
test('a complete, prewarmed replacement stays hidden until 420ms and finishes at 500ms',async()=>{
  const timers=fakeTimers(),events=[];
  const state={camera:3,file:candidate.nextFile,open:true,fault:false};
  const target={camera:3,file:candidate.nextFile};
  const controller=CAMERA.createController({
    warm:file=>{events.push(['warm',file,timers.time]);return Promise.resolve();},
    allowed:job=>state.open&&!state.fault&&job.camera===state.camera&&job.file===state.file,
    onStart:()=>events.push(['noise',null,timers.time]),
    onReveal:()=>events.push(['reveal',null,timers.time]),
    onFinish:(_job,reason)=>events.push([reason,null,timers.time]),
    schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
  });
  assert.equal(controller.start(target),true);
  assert.equal(controller.start(target),false,'repeated AI ticks cannot restart pending effect');
  await flush();
  assert.deepEqual(events.map(x=>x[0]),['warm','noise']);
  timers.advance(419);
  assert.equal(events.some(x=>x[0]==='reveal'),false);
  timers.advance(1);
  assert.ok(events.some(x=>x[0]==='reveal'));
  timers.advance(79);
  assert.ok(controller.status());
  timers.advance(1);
  assert.equal(controller.status(),null);
  assert.deepEqual(events.map(x=>x[0]),['warm','noise','reveal','completed']);
  assert.equal(timers.count,0,'no repeated timers');
});
test('camera switching or a tablet fault cancels pending noise without a frame swap',async()=>{
  for(const interrupt of ['camera','fault','close']){
    const timers=fakeTimers(),events=[],state={camera:3,file:candidate.nextFile,open:true,fault:false};
    const controller=CAMERA.createController({
      warm:()=>Promise.resolve(),
      allowed:job=>state.open&&!state.fault&&state.camera===job.camera&&state.file===job.file,
      onStart:()=>events.push('noise'),
      onReveal:()=>events.push('reveal'),
      onFinish:(_job,reason)=>events.push(reason),
      schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
    });
    assert.equal(controller.start({camera:3,file:candidate.nextFile}),true);
    await flush();
    if(interrupt==='camera')state.camera=4;
    if(interrupt==='fault')state.fault=true;
    if(interrupt==='close')state.open=false;
    timers.advance(420);
    assert.equal(controller.status(),null,interrupt);
    assert.deepEqual(events,['noise','cancelled']);
    assert.equal(timers.count,0);
  }
});
test('an unloaded target never creates signal noise; cancellation clears pending timers',async()=>{
  const timers=fakeTimers(),events=[];
  const ctrl=CAMERA.createController({
    warm:()=>Promise.reject(Error('missing camera image')),
    allowed:()=>true,onStart:()=>events.push('noise'),
    onReveal:()=>events.push('reveal'),
    onFinish:(_job,why)=>events.push(why),
    schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
  });
  ctrl.start({camera:3,file:candidate.nextFile});await flush();
  assert.deepEqual(events,['load-error']);
  assert.equal(ctrl.status(),null);
  assert.equal(timers.count,0);
});
test('UI uses a lighter map surface and overlays only the camera feed, with cached versioned files',()=>{
  const html=read('index.html'),css=read('style.css'),app=read('app.js');
  const map=css.match(/\.camera-map\{([^}]+)\}/)?.[1];
  assert.ok(map);
  assert.match(map,/background:rgba\(5,11,14,\.35\)/);
  assert.match(map,/backdrop-filter:none/);
  assert.match(css,/@media \(pointer:coarse\)\{[^\n]*\.camera-map\{[^}]*width:27%;height:37%/);
  assert.match(css,/\.camera-rooster-signal\{[^}]*pointer-events:none!important/s);
  assert.match(css,/\.camera-rooster-signal\.is-active\{[^}]*500ms/s);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\.camera-rooster-signal\.is-active\{animation:none;opacity:\.14\}/);
  const feed=html.split('id="cameraFeed"')[1].split('</div>\n    <div class="cctv-noise"')[0];
  assert.ok(feed.includes('id="cameraRoosterSignal"'));
  assert.ok(!html.split('class="camera-map"')[1].split('</section>')[0].includes('cameraRoosterSignal'));
  assert.ok(html.includes('style.css?v=056'));
  assert.ok(html.includes('src="fnar-camera-transition.js?v=056"'));
  assert.ok(html.indexOf('src="fnar-camera-transition.js?v=056"')<html.indexOf('src="app.js?v=056"'));
  assert.match(app,/updateCameraScene\(\{allowRoosterTransition:true\}\)/);
  assert.match(app,/if\(changed\)cameraCompositionTransition\.cancel\(\)/);
  assert.match(app,/if\(next\)\{cameraCompositionTransition\.cancel\(\);updateCameraScene\(\);\}/);
  assert.match(app,/cameraCompositionTransition\.start\(\{camera:currentCamera,file\}\)/);
  assert.ok(!read('fnar-ai.js').includes('fnar-camera-transition'));
});
