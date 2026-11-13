'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const AI=require('../fnar-ai.js');
const CAMERA=require('../fnar-camera-transition.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function fakeTimers(){
  let now=0,serial=0;const pending=new Map();
  return {
    schedule(fn,ms){const id=++serial;pending.set(id,{fn,at:now+ms});return id;},
    unschedule(id){pending.delete(id);},
    advance(ms){
      const end=now+ms;
      for(;;){
        let first=null;
        for(const [id,item] of pending)
          if(item.at<=end&&(!first||item.at<first.item.at))first={id,item};
        if(!first)break;
        now=first.item.at;pending.delete(first.id);first.item.fn();
      }
      now=end;
    },
    get time(){return now;},get count(){return pending.size;}
  };
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const sameCamera={previousCamera:3,currentCamera:3,eligible:true};
const change=(prev,next,previousFile,nextFile,extra={})=>CAMERA.cameraRosterChanged({
  ...sameCamera,previousIds:prev,nextIds:next,previousFile,nextFile,...extra
});
test('all actual arrivals, departures, and substitutions trigger on an already watched camera',()=>{
  assert.equal(CAMERA.DURATION_MS,500);
  assert.equal(CAMERA.REVEAL_MS,250);
  const cases=[
    [[],[1],'cam04.webp','cam04_c1.webp'],
    [[1],[],'cam04_c1.webp','cam04.webp'],
    [[1],[1,4],'cam05_c1.webp','cam05_c1_c4.webp'],
    [[1,4],[1],'cam05_c1_c4.webp','cam05_c1.webp'],
    [[1,4],[4],'cam05_c1_c4.webp','cam05_c4.webp'],
    [[2,3],[3],'cam03_c2_c3.webp','cam03_c3.webp'],
    [[2],[3],'cam03_c2.webp','cam03_c3.webp'],
    [[1,4],[],'cam05_c1_c4.webp','cam05.webp'],
    [[2,3],[],'cam09_c2_c3.webp','cam09.webp'],
    [[2],[2,3],'cam08_c2.webp','cam08_c2_c3.webp'],
    [[1],[1,4],'cam06_c1.webp','cam06_c1_c4.webp']
  ];
  for(const [previous,next,oldFile,newFile]of cases)
    assert.equal(change(previous,next,oldFile,newFile),true,oldFile+' => '+newFile);
});
test('no glitch on unchanged roster, camera switching, closed or broken feed, or same displayed file',()=>{
  assert.equal(change([],[],'cam03.webp','cam03.webp'),false);
  assert.equal(change([1],[1],'cam04_c1.webp','cam04_c1.webp'),false);
  assert.equal(change([2,3],[3,2],'cam03_c2_c3.webp','cam03_c2_c3.webp'),false);
  assert.equal(change([2],[3],'cam03_c2.webp','cam03_c2.webp'),false);
  assert.equal(change([2],[3],'cam03_c2.webp','cam03_c3.webp',{eligible:false}),false);
  assert.equal(change([2],[3],'cam03_c2.webp','cam03_c3.webp',{previousCamera:2}),false);
  assert.equal(change([2],[3],'cam03_c2.webp','cam03_c3.webp',{currentCamera:4}),false);
  assert.equal(change([2],[3],'','cam03_c3.webp'),false);
  assert.equal(change([2],[3],'cam03_c2.webp',''),false);
});
test('warm new image first, keep original 249ms, reveal under strong static at 250ms, end at 500ms',async()=>{
  const timers=fakeTimers(),events=[];
  const target={camera:3,file:'cam03_c3.webp',ids:[3],sourceFile:'cam03_c2_c3.webp'};
  const ctrl=CAMERA.createController({
    warm:file=>{events.push(['warm',file,timers.time]);return Promise.resolve();},
    allowed:job=>job.camera===3,
    onStart:()=>events.push(['start',null,timers.time]),
    onReveal:job=>events.push(['reveal',job.file,timers.time]),
    onFinish:(_job,reason)=>events.push([reason,null,timers.time]),
    schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
  });
  assert.equal(ctrl.start(target),true);
  assert.equal(ctrl.start(target),false,'never overlap transitions');
  await flush();
  assert.deepEqual(events.map(e=>e[0]),['warm','start']);
  timers.advance(249);
  assert.equal(events.filter(e=>e[0]==='reveal').length,0);
  timers.advance(1);
  assert.deepEqual(events.filter(e=>e[0]==='reveal'),[['reveal',target.file,250]]);
  timers.advance(249);
  assert.equal(ctrl.status()?.started,true);
  timers.advance(1);
  assert.equal(ctrl.status(),null);
  assert.equal(timers.count,0);
  assert.deepEqual(events.map(e=>e[0]),['warm','start','reveal','completed']);
});
test('two fast consecutive moves BEFORE reveal coalesce into only the last available frame',async()=>{
  const timers=fakeTimers(),events=[];
  const ctrl=CAMERA.createController({
    warm:()=>Promise.resolve(),allowed:job=>job.camera===3,
    onStart:()=>events.push('noise'),
    onReveal:job=>events.push('reveal:'+job.file),
    onFinish:(_job,reason)=>events.push(reason),
    schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
  });
  const first={camera:3,file:'cam03_c3.webp',ids:[3],sourceFile:'cam03_c2_c3.webp'};
  ctrl.start(first);await flush();
  timers.advance(110);
  assert.equal(ctrl.update({camera:3,file:'cam03.webp',ids:[]}),true);
  assert.equal(ctrl.update({camera:3,file:'cam03.webp',ids:[]}),true);
  await flush();
  assert.equal(ctrl.status().file,'cam03.webp');
  assert.equal(timers.count,2,'new movement must not schedule more transitions');
  timers.advance(140); // t250
  assert.deepEqual(events,['noise','reveal:cam03.webp']);
  timers.advance(250); // t500
  assert.deepEqual(events,['noise','reveal:cam03.webp','completed']);
  assert.equal(ctrl.status(),null);
  assert.equal(timers.count,0);
});
test('last movement AFTER first reveal updates within the SAME 500ms effect',async()=>{
  const timers=fakeTimers(),events=[];
  const ctrl=CAMERA.createController({
    warm:()=>Promise.resolve(),allowed:job=>job.camera===3,
    onStart:()=>events.push('noise'),
    onReveal:job=>events.push('reveal:'+job.file+':'+timers.time),
    onFinish:(_job,reason)=>events.push(reason+':'+timers.time),
    schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
  });
  ctrl.start({camera:3,file:'cam03_c3.webp',ids:[3],sourceFile:'cam03_c2_c3.webp'});await flush();
  timers.advance(250);
  assert.deepEqual(events,['noise','reveal:cam03_c3.webp:250']);
  timers.advance(100);
  assert.equal(ctrl.update({camera:3,file:'cam03.webp',ids:[]}),true);
  await flush();
  assert.deepEqual(events,['noise','reveal:cam03_c3.webp:250','reveal:cam03.webp:350']);
  timers.advance(150);
  assert.deepEqual(events,['noise','reveal:cam03_c3.webp:250','reveal:cam03.webp:350','completed:500']);
  assert.equal(ctrl.status(),null);
});
test('latest image arriving after 250ms is revealed as soon as warmed without stale reveal',async()=>{
  const timers=fakeTimers(),events=[],resolveByFile=new Map();
  const ctrl=CAMERA.createController({
    warm:file=>file==='cam03_c3.webp'?Promise.resolve():new Promise(resolve=>resolveByFile.set(file,resolve)),
    allowed:()=>true,onStart:()=>events.push('start'),
    onReveal:job=>events.push('reveal:'+job.file+':'+timers.time),
    onFinish:(_job,reason)=>events.push(reason),
    schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
  });
  ctrl.start({camera:3,file:'cam03_c3.webp',ids:[3],sourceFile:'cam03_c2_c3.webp'});await flush();
  timers.advance(120);
  ctrl.update({camera:3,file:'cam03.webp',ids:[]});await flush();
  timers.advance(130);
  assert.deepEqual(events,['start'],'old frame should remain until latest file is ready');
  timers.advance(65);
  resolveByFile.get('cam03.webp')();await flush();
  assert.deepEqual(events,['start','reveal:cam03.webp:315']);
  timers.advance(185);
  assert.deepEqual(events,['start','reveal:cam03.webp:315','completed']);
});
test('unready latest image finishing at 500ms does not reveal an obsolete image',async()=>{
  const timers=fakeTimers(),events=[],resolveByFile=new Map();
  const ctrl=CAMERA.createController({
    warm:file=>file==='cam03_c3.webp'?Promise.resolve():new Promise(resolve=>resolveByFile.set(file,resolve)),
    allowed:()=>true,onStart:()=>events.push('start'),
    onReveal:job=>events.push('reveal:'+job.file),
    onFinish:(job,why)=>events.push(why+':'+job.latest.file),
    schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
  });
  ctrl.start({camera:3,file:'cam03_c3.webp',ids:[3],sourceFile:'cam03_c2_c3.webp'});await flush();
  ctrl.update({camera:3,file:'cam03.webp',ids:[]});await flush();
  timers.advance(500);
  assert.deepEqual(events,['start','completed:cam03.webp']);
  resolveByFile.get('cam03.webp')();await flush();
  assert.equal(events.length,2,'expired callbacks must not swap stale images');
  assert.equal(timers.count,0);
});
test('camera switch, close, pause and video faults cancel transition with no image reveal',async()=>{
  for(const kind of ['switch','close','pause','frozen','signal_lost','usb','crash','reboot','chicken']){
    const timers=fakeTimers(),events=[],state={camera:3,open:true,paused:false,fault:'idle'};
    const ctrl=CAMERA.createController({
      warm:()=>Promise.resolve(),
      allowed:job=>state.camera===job.camera&&state.open&&!state.paused&&state.fault==='idle',
      onStart:()=>events.push('start'),onReveal:()=>events.push('reveal'),
      onFinish:(_job,reason)=>events.push(reason),
      schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
    });
    ctrl.start({camera:3,file:'cam03_c3.webp',ids:[3]});await flush();
    if(kind==='switch')state.camera=9;
    else if(kind==='close')state.open=false;
    else if(kind==='pause')state.paused=true;
    else state.fault=kind;
    timers.advance(250);
    assert.equal(ctrl.status(),null,kind);
    assert.deepEqual(events,['start','cancelled'],kind);
    assert.equal(timers.count,0);
  }
});
test('when target returns to the original image during preload, cancel without a burst',async()=>{
  const events=[],timers=fakeTimers(),resolveByFile=new Map();
  const ctrl=CAMERA.createController({
    warm:file=>new Promise(resolve=>resolveByFile.set(file,resolve)),
    allowed:()=>true,
    onStart:()=>events.push('start'),onReveal:()=>events.push('reveal'),
    onFinish:(_job,reason)=>events.push(reason),
    schedule:(fn,ms)=>timers.schedule(fn,ms),unschedule:id=>timers.unschedule(id)
  });
  ctrl.start({camera:3,file:'cam03_c3.webp',ids:[3],sourceFile:'cam03_c2_c3.webp'});
  assert.equal(ctrl.update({camera:3,file:'cam03_c2_c3.webp',ids:[2,3]}),false);
  await flush();
  assert.deepEqual(events,['reverted']);
  assert.equal(ctrl.status(),null);
  assert.equal(timers.count,0);
});
test('failed current asset never starts a signal; obsolete failed preloads do not cancel a newer target',async()=>{
  let firstResolve,events=[];
  const ctrl=CAMERA.createController({
    warm:file=>file==='cam03_c3.webp'?new Promise(resolve=>firstResolve=resolve):
      file==='cam03.webp'?Promise.resolve():Promise.reject(Error('unavailable')),
    allowed:()=>true,
    onStart:()=>events.push('start'),onReveal:job=>events.push(job.file),
    onFinish:(_job,reason)=>events.push(reason)
  });
  ctrl.start({camera:3,file:'cam03_c3.webp',ids:[3],sourceFile:'cam03_c2_c3.webp'});await flush();
  ctrl.update({camera:3,file:'cam03.webp',ids:[]});await flush();
  firstResolve();await flush();
  assert.ok(events.includes('start'));
  ctrl.cancel();
  assert.equal(events.at(-1),'cancelled');
  const broken=CAMERA.createController({
    warm:()=>Promise.reject(Error('bad asset')),allowed:()=>true,
    onStart:()=>events.push('bad-start'),onReveal:()=>events.push('bad-reveal'),
    onFinish:(_job,reason)=>events.push(reason)
  });
  broken.start({camera:9,file:'cam09_c2.webp',ids:[2]});await flush();
  assert.equal(events.at(-1),'load-error');
  assert.ok(!events.includes('bad-start'));
});
test('CSS contains high-contrast analog noise and reduced-motion handling; camera map is unchanged',()=>{
  const html=read('index.html'),css=read('style.css'),app=read('app.js');
  const map=css.match(/\.camera-map\{([^}]+)\}/)?.[1];
  assert.ok(map);
  assert.match(map,/background:rgba\(5,11,14,\.35\)/);
  assert.match(map,/backdrop-filter:none/);
  assert.match(css,/@media \(pointer:coarse\)\{[^\n]*\.camera-map\{[^}]*width:27%;height:37%/);
  assert.match(css,/\.camera-rooster-signal\{[^}]*pointer-events:none!important/s);
  assert.match(css,/mix-blend-mode:normal/);
  assert.match(css,/\.camera-rooster-signal::before/);
  assert.match(css,/\.camera-rooster-signal::after/);
  assert.match(css,/rgba\(219,231,229,\.91\)/);
  assert.match(css,/rgba\(7,12,17,\.96\)/);
  assert.match(css,/\.camera-rooster-signal\.is-active\{[^}]*500ms/s);
  assert.match(css,/50%\{opacity:\.84/);
  assert.match(css,/camera-rooster-tear-a/);
  assert.match(css,/camera-rooster-tear-b/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\.camera-rooster-signal\.is-active\{[^}]*animation:none;[^}]*opacity:\.38/s);
  const feed=html.split('id="cameraFeed"')[1].split('</div>\n    <div class="cctv-noise"')[0];
  assert.ok(feed.includes('id="cameraRoosterSignal"'));
  assert.ok(!html.split('class="camera-map"')[1].split('</section>')[0].includes('cameraRoosterSignal'));
  assert.ok(html.includes('style.css?v=057'));
  assert.ok(html.includes('src="fnar-camera-transition.js?v=058"'));
  assert.ok(html.indexOf('src="fnar-camera-transition.js?v=058"')<html.indexOf('src="app.js?v=058"'));
  assert.match(app,/updateCameraScene\(\{allowRoosterTransition:true\}\)/);
  assert.match(app,/if\(changed\)cameraCompositionTransition\.cancel\(\)/);
  assert.match(app,/if\(next\)\{cameraCompositionTransition\.cancel\(\);updateCameraScene\(\{allowRoosterTransition:false\}\);\}/);
  assert.match(app,/cameraCompositionTransition\.update\(\{camera:currentCamera,file,ids\}\)/);
  assert.match(app,/cameraCompositionTransition\.start\(\{[\s\S]*?camera:currentCamera,file,ids,sourceFile:shownCameraFile/);
  assert.ok(!read('fnar-ai.js').includes('fnar-camera-transition'));
});


/* Integration harness: executes REAL app.js cameraFile(), updateCameraScene(),
 * displayCameraFile(), and moveEnemies() against REAL fnar-ai.js AI.tick().
 * Browser-only DOM and timers are mocked, not the gameplay methods themselves. */
function realCameraGameLoop(){
  const app=read('app.js');
  const extract=(start,end)=>{
    const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
    assert.ok(a>=0&&b>a,'Missing actual app.js function: '+start);
    return app.slice(a,b);
  };
  const variants=app.match(/^const CAMERA_VARIANTS=new Set\((.+)\);$/m);
  assert.ok(variants,'Actual camera file variants missing');
  const lines=[
    '(function(){',
    variants[0],
    "let shownCameraFile='',shownCameraIndex=0,shownCameraIds=[];",
    'let cameraOpen=true,currentCamera=7,needsComposing=false;',
    'const state={active:true,loaded:true,paused:false,leftDoorPos:0,rightDoorPos:0};',
    "const phoneState={status:'idle'},powerFailure={active:false};",
    'const aiSession=AI.createNight(6,()=>.5),ENEMIES=aiSession.enemies;',
    'const events=[];',
    'function classes(owner){const set=new Set(owner==="settings"?["hidden"]:[]);return {contains:name=>set.has(name),add(name){if(!set.has(name)){set.add(name);if(owner==="signal"&&name==="is-active")events.push("signal:on");}},remove(name){if(set.delete(name)&&owner==="signal"&&name==="is-active")events.push("signal:off");}};}',
    'const signal={offsetWidth:1,classList:classes("signal")};',
    'function $(id){return id==="cameraRoosterSignal"?signal:{classList:classes(id==="settings"?"settings":"other")};}',
    'const CAM_PICTURE={_src:"",classList:classes("picture"),get src(){return this._src;},set src(file){this._src=file;events.push("frame:"+file);}};',
    'const CAM_EMPTY={classList:classes("empty")};',
    'const cameraCache=new Map([...CAMERA_VARIANTS].map(file=>[file,true]));',
    'const cameraUnavailable=new Set();',
    'function cameraImageURL(file){return file;}',
    'function enemySound(){};function playSfx(){};function t(key){return key;}',
    'function finishNight(){events.push("finishNight");state.active=false;}',
    'const CAMERA_TRANSITION=window.FNAR_CAMERA_TRANSITION;',
    'const roosterSignal=$("cameraRoosterSignal");',
    extract('function cameraFile(){','function showCameraFlash(){'),
    extract('function cameraSignalAllowed(target){','function chooseCamera(id){'),
    extract('function moveEnemies(dt){','// Diagnostic only:'),
    'return {state,aiSession,ENEMIES,events,',
    'setup(camera,ids){cameraCompositionTransition.cancel();currentCamera=camera;cameraOpen=true;state.active=true;window.FNARTabletDebug.status.mode="idle";',
    'for(const enemy of ENEMIES){if(ids.includes(enemy.id)){const at=enemy.route.indexOf(camera);if(at<0)throw Error("Enemy route missing camera");enemy.step=at;enemy.phase=AI.PHASES.APPROACH;enemy.nextMove=Infinity;}else{enemy.step=0;enemy.phase=AI.PHASES.DORMANT;enemy.nextMove=Infinity;}enemy.attack=0;enemy.blocked=0;enemy.knocks=0;enemy.holds=0;enemy.burst=0;}',
    'updateCameraScene({allowRoosterTransition:false});},',
    'enemy:id=>ENEMIES.find(e=>e.id===id),move:moveEnemies,',
    'picture:()=>CAM_PICTURE.src,pending:()=>cameraCompositionTransition.status(),',
    'signal:()=>signal.classList.contains("is-active"),',
    'switchCamera:camera=>{cameraCompositionTransition.cancel();currentCamera=camera;updateCameraScene({allowRoosterTransition:false});},',
    'close:()=>{cameraCompositionTransition.cancel();cameraOpen=false;},',
    'mode:mode=>{window.FNARTabletDebug.status.mode=mode;}',
    '};',
    '})()'
  ];
  const clock=fakeTimers();
  const tablet={status:{mode:'idle',adVisible:false},canObserveCamera:()=>true,c3Protected:false};
  // The controller module was loaded in Node's realm, so its default timer
  // closes over real Node setTimeout. Explicitly inject the same fake clock.
  const timedCamera={...CAMERA,createController:options=>CAMERA.createController({
    ...options,schedule:(fn,ms)=>clock.schedule(fn,ms),
    unschedule:id=>clock.unschedule(id)
  })};
  const game=vm.runInNewContext(lines.join('\n'),{
    AI,window:{FNAR_CAMERA_TRANSITION:timedCamera,FNARTabletDebug:tablet},
    setTimeout:(fn,ms)=>clock.schedule(fn,ms),clearTimeout:id=>clock.unschedule(id),
    Image:class{set src(_file){throw Error('Missing preloaded camera variant in integration test');}},
    console
  },{filename:'fnar-real-camera-game-loop.js'});
  return {game,clock};
}
test('CAM07 C1 and C4 actually advance APPROACH to DOOR in AI.tick with 500ms signal',async()=>{
  for(const id of [1,4]){
    const {game,clock}=realCameraGameLoop();
    game.setup(7,[id]);
    assert.equal(game.picture(),'cam07_c'+id+'.webp');
    game.enemy(id).nextMove=0;
    const elapsedBefore=game.aiSession.elapsed;
    game.move(.05); // Real game moveEnemies() -> real AI.tick().
    assert.equal(game.enemy(id).phase,AI.PHASES.DOOR);
    assert.ok(game.aiSession.elapsed>elapsedBefore,'AI gameplay timer must advance immediately');
    assert.equal(game.pending()?.file,'cam07.webp');
    assert.equal(game.picture(),'cam07_c'+id+'.webp','old feed retained until noise');
    await flush();
    assert.equal(game.signal(),true,'door departure must actually display noise');
    clock.advance(249);
    assert.equal(game.picture(),'cam07_c'+id+'.webp');
    clock.advance(1);
    assert.equal(game.picture(),'cam07.webp','empty image revealed under noise at 250ms');
    const attackBefore=game.enemy(id).attack;
    for(let k=0;k<5;k++)game.move(.05);
    assert.ok(game.enemy(id).attack>attackBefore,'noise must not delay door attack timer');
    clock.advance(250);
    assert.equal(game.pending(),null);
    assert.equal(game.signal(),false);
    assert.equal(game.picture(),'cam07.webp');
    assert.equal(game.events.filter(e=>e==='signal:on').length,1);
  }
});
test('CAM07 last rooster moving BACKWARDS in real AI retreat causes camera noise',async()=>{
  for(const id of [1,4]){
    const {game,clock}=realCameraGameLoop();
    game.setup(7,[id]);
    const e=game.enemy(id);
    e.phase=AI.PHASES.RETREAT;e.nextMove=0;
    game.move(.05);
    assert.equal(e.route[e.step],6);
    assert.equal(game.pending()?.file,'cam07.webp');
    await flush();
    clock.advance(250);
    assert.equal(game.picture(),'cam07.webp');
    clock.advance(250);
    assert.equal(game.signal(),false);
  }
});
test('real simultaneous two-rooster CAM07 retreat coalesces into ONE two-to-empty effect',async()=>{
  const {game,clock}=realCameraGameLoop();
  game.setup(7,[1,4]);
  assert.equal(game.picture(),'cam07_c1_c4.webp');
  for(const id of [1,4]){
    game.enemy(id).phase=AI.PHASES.RETREAT;game.enemy(id).nextMove=0;
  }
  game.move(.05); // two actual back-moves in one AI.tick
  assert.equal(game.pending()?.file,'cam07.webp');
  assert.equal(game.picture(),'cam07_c1_c4.webp');
  await flush();clock.advance(250);
  assert.equal(game.picture(),'cam07.webp');
  clock.advance(250);
  assert.equal(game.events.filter(e=>e==='signal:on').length,1);
  assert.equal(game.pending(),null);
});
test('second departure before 250ms updates the SAME running camera transition',async()=>{
  const {game,clock}=realCameraGameLoop();
  game.setup(7,[1,4]);
  game.enemy(1).phase=AI.PHASES.RETREAT;game.enemy(1).nextMove=0;
  game.move(.05);
  assert.equal(game.pending()?.file,'cam07_c4.webp');
  await flush();clock.advance(125);
  game.enemy(4).phase=AI.PHASES.RETREAT;game.enemy(4).nextMove=0;
  game.move(.05);
  assert.equal(game.pending()?.file,'cam07.webp');
  await flush();clock.advance(125);
  assert.equal(game.picture(),'cam07.webp');
  clock.advance(250);
  assert.equal(game.pending(),null);
  assert.equal(game.events.filter(e=>e==='signal:on').length,1);
});
test('CAM09, CAM06, CAM03 and CAM05 departures use identical real AI-to-camera path',async()=>{
  const cases=[[9,2],[9,3],[6,1],[6,4],[3,2],[3,3],[5,1],[5,4]];
  for(const [camera,id] of cases){
    const {game,clock}=realCameraGameLoop();
    game.setup(camera,[id]);
    const before=game.picture();
    game.enemy(id).nextMove=0;
    game.move(.05);
    assert.notEqual(game.pending(),null,'No transition for CAM '+camera+' / C'+id);
    await flush();
    assert.equal(game.signal(),true);
    assert.equal(game.picture(),before);
    clock.advance(250);
    assert.equal(game.picture(),'cam'+String(camera).padStart(2,'0')+'.webp');
    clock.advance(250);
    assert.equal(game.pending(),null);
  }
});
test('real AI with no roster movement does not trigger a camera glitch, camera switch cancels it',async()=>{
  const {game,clock}=realCameraGameLoop();
  game.setup(7,[1]);game.enemy(1).nextMove=20;
  game.move(.05);
  assert.equal(game.pending(),null);
  game.enemy(1).nextMove=0;game.move(.05);await flush();
  assert.equal(game.signal(),true);
  game.switchCamera(6);
  assert.equal(game.signal(),false);
  assert.equal(game.pending(),null);
  clock.advance(700);
  assert.equal(game.events.filter(e=>e==='signal:on').length,1);
});
test('closed tablet and serious Door XP faults cancel a real AI-driven signal',async()=>{
  for(const mode of ['close','frozen','signal_lost','usb','crash','reboot','chicken']){
    const {game,clock}=realCameraGameLoop();
    game.setup(7,[1]);game.enemy(1).nextMove=0;
    game.move(.05);await flush();
    assert.equal(game.signal(),true);
    if(mode==='close')game.close();
    else{game.mode(mode);game.move(.05);}
    assert.equal(game.signal(),false,mode);
    assert.equal(game.pending(),null,mode);
    clock.advance(700);
    assert.equal(game.pending(),null);
    if(mode!=='close'){
      // Fault recovery must show the CURRENT empty room and never play
      // a deferred queue of old rooster movements.
      game.mode('idle');
      game.move(.05);
      assert.equal(game.picture(),'cam07.webp');
      assert.equal(game.events.filter(e=>e==='signal:on').length,1);
      assert.equal(game.pending(),null);
    }
  }
});
test('an audio-only Door XP event does not hide a visible CAM07 rooster departure',async()=>{
  const {game,clock}=realCameraGameLoop();
  game.setup(7,[4]);
  game.mode('audio_spam');
  game.enemy(4).nextMove=0;
  game.move(.05);
  await flush();
  assert.equal(game.signal(),true);
  clock.advance(250);
  assert.equal(game.picture(),'cam07.webp');
  clock.advance(250);
  assert.equal(game.signal(),false);
});
test('last-departure visual test uses actual displayed file even if remembered roster became stale',()=>{
  assert.equal(CAMERA.cameraRosterChanged({
    previousCamera:7,currentCamera:7,previousIds:[],nextIds:[],
    previousFile:'cam07_c1.webp',nextFile:'cam07.webp',eligible:true
  }),true);
  assert.equal(CAMERA.cameraRosterChanged({
    previousCamera:7,currentCamera:7,previousIds:[4],nextIds:[4],
    previousFile:'cam07_c4.webp',nextFile:'cam07.webp',eligible:true
  }),true);
  assert.equal(JSON.stringify(CAMERA.roosterIdsInFile('cam07_c1_c4.webp')),'[1,4]');
  assert.equal(JSON.stringify(CAMERA.roosterIdsInFile('cam07.webp')),'[]');
});
test('browser debug command invokes real AI.tick without writing persistent progress',()=>{
  const app=read('app.js'),a=app.indexOf('async function debugTestCameraDeparture(');
  const b=app.indexOf("cameraToggle.addEventListener('click',toggleCamera);",a);
  assert.ok(a>=0&&b>a,'Debug departure command missing');
  const method=app.slice(a,b);
  assert.match(method,/moveEnemies\(\.05\)/);
  assert.match(method,/await warmCameraFile\(before\)/);
  assert.doesNotMatch(method,/safeStore|writeSave|localStorage|updateSaveProgress/);
  assert.match(app,/testCameraDeparture:debugTestCameraDeparture/);
  assert.match(app,/setEnemyStep\(id,step,\{animate=false\}=\{\}\)/);
});
