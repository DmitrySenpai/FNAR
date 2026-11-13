'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const AUDIO=require('../fnar-audio-settings.js');
const ATMOS=require('../fnar-atmosphere.js');
const AI=require('../fnar-ai.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function storage(){
  const map=new Map();
  return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),map};
}
function media(){
  const listeners=new Map();
  return {volume:1,muted:false,addEventListener:(k,f)=>listeners.set(k,f),
    removeEventListener:(k,f)=>{if(listeners.get(k)===f)listeners.delete(k);},
    end:()=>listeners.get('ended')?.()};
}
const context=(extra={})=>({active:true,paused:false,phone:false,jumpscare:false,
  victory:false,blackout:false,tabletBusy:false,danger:false,cameraOpen:false,camera:1,...extra});
function seeded(seed){
  let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};
}
test('one master setting loads, clamps and migrates legacy category values safely',()=>{
  const store=storage(),manager=AUDIO.createManager(store);
  assert.deepEqual(manager.get(),{master:100});
  assert.deepEqual(AUDIO.DEFAULTS,{master:100});
  assert.deepEqual([...AUDIO.CATEGORIES],['master']);
  manager.set('master',70);
  assert.deepEqual(manager.get(),{master:70});
  assert.deepEqual(JSON.parse(store.map.get(AUDIO.STORAGE_KEY)),{master:70});
  assert.equal(store.map.has('kokhinhin_unlocked'),false);

  store.setItem(AUDIO.STORAGE_KEY,JSON.stringify({
    master:60,effects:0,ambience:12,phone:25,tablet:0
  }));
  assert.deepEqual(AUDIO.createManager(store).get(),{master:60});
  store.setItem(AUDIO.STORAGE_KEY,'{"master":-100,"effects":20}');
  assert.deepEqual(AUDIO.createManager(store).get(),{master:0});
  store.setItem(AUDIO.STORAGE_KEY,'{"master":150}');
  assert.deepEqual(AUDIO.createManager(store).get(),{master:100});
  for(const invalid of ['{invalid','null','{"master":"oops"}','{"master":null}']){
    store.setItem(AUDIO.STORAGE_KEY,invalid);
    assert.deepEqual(AUDIO.createManager(store).get(),{master:100});
  }
  assert.throws(()=>manager.set('effects',50),/master/);
});
test('master affects effects, ambience, phone and tablet equally without compounded gain',()=>{
  const store=storage(),mixer=AUDIO.createManager(store);
  const effects=media(),ambience=media(),phone=media(),tablet=media();
  mixer.register(effects,'effects',.45);
  mixer.register(ambience,'ambience',.18);
  mixer.register(phone,'phone',.88);
  mixer.register(tablet,'tablet',.65);
  mixer.set('master',80);
  assert.ok(Math.abs(effects.volume-.36)<1e-12);
  assert.ok(Math.abs(ambience.volume-.144)<1e-12);
  assert.ok(Math.abs(phone.volume-.704)<1e-12);
  assert.ok(Math.abs(tablet.volume-.52)<1e-12);
  mixer.set('master',50);mixer.set('master',50);
  assert.ok(Math.abs(effects.volume-.225)<1e-12,'base gain must not compound');
  mixer.set('master',0);
  for(const el of [effects,ambience,phone,tablet])assert.equal(el.volume,0);
  mixer.set('master',100);
  assert.equal(effects.volume,.45);
  assert.equal(ambience.volume,.18);
  assert.equal(phone.volume,.88);
  assert.equal(tablet.volume,.65);
  assert.equal(mixer.trackedCount(),4);
  effects.end();assert.equal(mixer.trackedCount(),3);
});
test('mute does not change master position and restores live gain',()=>{
  const mixer=AUDIO.createManager(storage()),sfx=media();
  mixer.register(sfx,'effects',.5);
  mixer.set('master',70);
  const base=sfx.volume;
  mixer.setMuted(true);
  assert.equal(sfx.muted,true);
  assert.equal(sfx.volume,base);
  assert.equal(mixer.get().master,70);
  mixer.setMuted(false);
  assert.equal(sfx.muted,false);
  assert.equal(sfx.volume,base);
});
test('obsoleted category values never multiply audio gain',()=>{
  const store=storage();
  store.setItem(AUDIO.STORAGE_KEY,JSON.stringify({
    master:80,effects:10,ambience:0,phone:0,tablet:0
  }));
  const mixer=AUDIO.createManager(store);
  for(const category of ['effects','ambience','phone','tablet']){
    const el=media();mixer.register(el,category,.5);
    assert.equal(el.volume,.4,category+' must ignore old category multipliers');
  }
  mixer.set('master',90);
  assert.deepEqual(JSON.parse(store.map.get(AUDIO.STORAGE_KEY)),{master:90});
});
test('all six atmosphere types exist with exact nightly caps',()=>{
  assert.deepEqual([...ATMOS.TYPES],['light_flicker','distant_creak','camera_static',
    'shadow','ventilation','camera_anomaly']);
  assert.deepEqual(ATMOS.LIMITS,{1:1,2:2,3:2,4:3,5:3,6:3,7:2});
  const system=ATMOS.createSystem();
  for(let night=1;night<=7;night++){
    system.reset(night);assert.equal(system.status().max,ATMOS.LIMITS[night]);
  }
});
test('unsafe situations always block new events and immediately stop existing events',()=>{
  for(const flag of ['paused','phone','jumpscare','victory','blackout','tabletBusy','danger']){
    const sys=ATMOS.createSystem({rng:()=>.5});
    sys.reset(5);
    assert.equal(sys.trigger('shadow',context({[flag]:true})),false,flag);
    assert.equal(sys.trigger('shadow',context()),true);
    if(flag==='paused'||flag==='phone'){
      const old=sys.status().active.elapsed;
      sys.tick(5,context({[flag]:true}));
      assert.equal(sys.status().active.elapsed,old,'gameplay time must freeze on '+flag);
    }else{
      sys.tick(.1,context({[flag]:true}));
      assert.equal(sys.status().active,null,flag);
    }
    sys.clear();assert.equal(sys.status().active,null);
  }
});
test('camera effects never appear on CAM08, and never replace or block camera actions',()=>{
  const system=ATMOS.createSystem({rng:()=>.5});
  assert.equal(system.trigger('camera_static',context()),false);
  assert.equal(system.trigger('camera_static',context({cameraOpen:true,camera:8})),false);
  assert.equal(system.trigger('camera_static',context({cameraOpen:true,camera:7})),true);
  const before=system.status().active;
  system.tick(.05,context({cameraOpen:true,camera:8}));
  assert.equal(system.status().active.type,'camera_static'); // hidden by renderer on CAM08
  assert.ok(system.status().active.elapsed>before.elapsed);
  for(const unsafe of ['blackout','danger','tabletBusy']){
    assert.equal(ATMOS.safe(context({[unsafe]:true})),false);
  }
  const css=read('style.css');
  assert.match(css,/.atmosphere-overlay\s*\{[^}]*pointer-events:none!important/s);
  assert.ok(!read('fnar-atmosphere.js').includes('chooseCamera('));
});
test('random events never occur before 45s or within 60s of prior completion',()=>{
  const sys=ATMOS.createSystem({rng:()=>0});
  sys.reset(6);
  for(let i=0;i<44;i++)sys.tick(1,context());
  assert.equal(sys.status().count,0);
  sys.tick(1,context());assert.equal(sys.status().count,1);
  while(sys.status().active)sys.tick(.1,context());
  const last=sys.status().lastEnd;
  while(sys.status().elapsed-last<59)sys.tick(.1,context());
  assert.equal(sys.status().count,1);
  sys.tick(1.1,context());assert.equal(sys.status().count,2);
  for(let i=0;i<1000;i++)sys.tick(.1,context());
  assert.ok(sys.status().count<=3);
});
test('400 paired full-shift simulations preserve AI and power when ambience differs',()=>{
  for(let seed=1;seed<=400;seed++){
    const a=AI.createNight(3,seeded(seed)),b=AI.createNight(3,seeded(seed));
    const atmosphere=ATMOS.createSystem({rng:seeded(seed+1000)});
    atmosphere.reset(3);
    for(let i=0;i<3600;i++){
      const input={camera:8,cameraOpen:i%100<40,leftClosed:true,rightClosed:true};
      const evA=AI.tick(a,.1,input),evB=AI.tick(b,.1,input);
      assert.deepEqual(evA,evB,'AI event stream must be identical');
      atmosphere.tick(.1,context({danger:a.enemies.some(e=>e.phase===AI.PHASES.DOOR)}));
    }
    assert.deepEqual(a.enemies,b.enemies);
    assert.ok(atmosphere.status().count<=2);
  }
});
test('compact pause menu has only one master volume control and no nested panel',()=>{
  const html=read('index.html'),app=read('app.js'),css=read('style.css'),tablet=read('tablet-os.js');
  assert.ok(html.includes('id="audioVolumeMaster"'));
  assert.ok(html.includes('id="audioVolumeMasterValue"'));
  assert.equal((html.match(/type="range"/g)||[]).filter(Boolean).length>0,true);
  for(const id of ['pauseAudioSettings','audioSettingsPanel','audioSettingsBack',
    'audioVolumeEffects','audioVolumeAmbience','audioVolumePhone','audioVolumeTablet'])
    assert.ok(!html.includes('id="'+id+'"'),'obsolete element: '+id);
  const pauseMarkup=html.split('id="pauseScreen"')[1].split('</section>')[0];
  assert.equal((pauseMarkup.match(/type="range"/g)||[]).length,1);
  assert.ok(pauseMarkup.indexOf('id="pauseMenu"')<pauseMarkup.indexOf('class="pause-volume"'));
  assert.ok(pauseMarkup.indexOf('class="pause-volume"')<pauseMarkup.indexOf('class="pause-utilities"'));
  for(const id of ['pauseResume','pauseRestart','pauseMenu','muteBtn','settingsBtn','fullscreenBtn'])
    assert.ok(pauseMarkup.includes('id="'+id+'"'),id);
  assert.ok(!/overflow-y:\s*auto/.test(css.slice(css.indexOf('/* Compact single volume slider'),css.indexOf('/* Harmless visual ambience'))));
  assert.ok(!css.includes('.audio-settings-panel'));
  assert.match(css,/#pauseScreen \.pause-card\s*\{[^}]*overflow:visible/s);
  assert.ok(html.includes('style.css?v=057'));
  assert.ok(html.includes('src="fnar-audio-settings.js?v=054"'));
  assert.ok(html.indexOf('fnar-audio-settings.js?v=054')<html.indexOf('src="app.js?v=058"'));
  assert.ok(html.indexOf('src="fnar-atmosphere.js"')<html.indexOf('src="app.js?v=058"'));
  assert.ok(app.includes("AUDIO_SETTINGS.set('master',event.currentTarget.value)"));
  assert.ok(app.includes("AUDIO_SETTINGS.register(voice,'phone',.88)"));
  assert.ok(app.includes("atmosphere.tick(passed,atmosphereContext())"));
  assert.ok(tablet.includes('window.AudioManager?.play('));
  assert.ok(read('fnar-audio.js').includes('mixer?.register(handle'));
  assert.ok(tablet.includes('FNAR_SOUND_URL'));
  for(const id of ['atmosphereOffice','atmosphereCamera'])
    assert.ok(html.includes('id="'+id+'"'));
  for(const text of ["audioVolume:'ГРОМКОСТЬ'","audioVolume:'VOLUME'","audioVolume:'音量'"])
    assert.ok(app.includes(text));
  assert.ok(app.includes("toggleMute();e.preventDefault()"));
  assert.ok(!read('fnar-audio-settings.js').includes('fetch('));
  assert.ok(!read('fnar-atmosphere.js').includes('fetch('));
});
