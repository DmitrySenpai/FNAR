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
test('five volume categories default to 100, clamp and persist without affecting legacy saves',()=>{
  const store=storage(),manager=AUDIO.createManager(store);
  assert.deepEqual(manager.get(),AUDIO.DEFAULTS);
  manager.set('master',70);
  manager.set('effects',-10);
  manager.set('phone',300);
  manager.set('tablet',44.7);
  assert.deepEqual(manager.get(),{master:70,effects:0,ambience:100,phone:100,tablet:45});
  assert.deepEqual(AUDIO.createManager(store).get(),manager.get());
  assert.equal(store.map.has('kokhinhin_unlocked'),false);
  store.setItem(AUDIO.STORAGE_KEY,'{"master":"oops","effects":-100,"ambience":180,"phone":null,"tablet":77}');
  const recovered=AUDIO.createManager(store).get();
  assert.equal(recovered.master,100);
  assert.equal(recovered.effects,0);
  assert.equal(recovered.ambience,100);
  assert.equal(recovered.tablet,77);
});
test('live adjustments recalculate from base gain rather than compounding',()=>{
  const mixer=AUDIO.createManager(storage());
  const effects=media(),ambient=media(),phone=media(),tablet=media();
  mixer.register(effects,'effects',.45);
  mixer.register(ambient,'ambience',.18);
  mixer.register(phone,'phone',.88);
  mixer.register(tablet,'tablet',.65);
  mixer.set('master',80);mixer.set('effects',50);
  assert.ok(Math.abs(effects.volume-.18)<1e-12);
  assert.ok(Math.abs(ambient.volume-.144)<1e-12);
  assert.ok(Math.abs(phone.volume-.704)<1e-12);
  mixer.set('effects',50);assert.ok(Math.abs(effects.volume-.18)<1e-12);
  mixer.set('master',20);assert.ok(effects.volume<=.045);
  mixer.set('tablet',0);assert.equal(tablet.volume,0);
  mixer.set('phone',0);assert.equal(phone.volume,0);
  mixer.set('master',100);assert.equal(ambient.volume,.18);
  assert.equal(mixer.trackedCount(),4);
  effects.end();assert.equal(mixer.trackedCount(),3);
});
test('mute never changes slider positions and restores exact adjusted audio levels',()=>{
  const mixer=AUDIO.createManager(storage()),sfx=media();
  mixer.register(sfx,'effects',.5);
  mixer.set('master',70);mixer.set('effects',40);
  const expected=sfx.volume;
  mixer.setMuted(true);
  assert.equal(sfx.muted,true);
  assert.equal(sfx.volume,expected);
  assert.equal(mixer.get().master,70);
  mixer.setMuted(false);
  assert.equal(sfx.muted,false);
  assert.equal(sfx.volume,expected);
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
test('HTML controls and scripts are installed ahead of app, without new MP3 requests',()=>{
  const html=read('index.html'),app=read('app.js'),tablet=read('tablet-os.js');
  for(const id of ['pauseAudioSettings','audioSettingsPanel','audioSettingsBack',
    'audioVolumeMaster','audioVolumeEffects','audioVolumeAmbience','audioVolumePhone',
    'audioVolumeTablet','atmosphereOffice','atmosphereCamera'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.indexOf('src="fnar-audio-settings.js"')<html.indexOf('src="app.js"'));
  assert.ok(html.indexOf('src="fnar-atmosphere.js"')<html.indexOf('src="app.js"'));
  assert.ok(html.includes('style.css?v=053'));
  assert.match(app,/AUDIO_SETTINGS\.register\(a,name==='hang-up'\?'phone':'effects',volume\)/);
  assert.match(app,/AUDIO_SETTINGS\.register\(voice,'phone',\.88\)/);
  assert.match(app,/atmosphere\.tick\(passed,atmosphereContext\(\)\)/);
  assert.match(tablet,/mixer\.register\(a,'tablet'/);
  assert.match(tablet,/FNAR_SOUND_URL/);
  assert.ok(!read('fnar-audio-settings.js').includes('fetch('));
  assert.ok(!read('fnar-atmosphere.js').includes('fetch('));
});
