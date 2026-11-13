'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const RULES=require('../fnar-tablet-faults.js');
const AI=require('../fnar-ai.js');
const root=path.join(__dirname,'..');
const tablet=fs.readFileSync(path.join(root,'tablet-os.js'),'utf8');
const css=fs.readFileSync(path.join(root,'tablet-os.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const approx=(x,y,eps=1e-8)=>assert.ok(Math.abs(x-y)<eps,String(x)+' != '+String(y));
test('All nine fault types present with exact advertised weights',()=>{
  assert.deepEqual(RULES.CHANCES,[['usb',15],['reboot',10],['frozen',15],['signal_lost',15],
    ['input_lag',12],['stale',10],['crash',8],['audio_spam',8],['chicken',7]]);
  assert.equal(RULES.CHANCES.reduce((a,b)=>a+b[1],0),100);
  assert.equal(new Set(RULES.CHANCES.map(e=>e[0])).size,9);
  for(const [name] of RULES.CHANCES)assert.ok(RULES.validFault(name));
  assert.equal(RULES.validFault('trojan'),false);
});
test('Weighted picker covers all event bucket boundaries',()=>{
  let total=0;
  for(const [name,pct] of RULES.CHANCES){
    assert.equal(RULES.weightedFault(()=>(total+.5)/100),name);
    total+=pct;
  }
  assert.equal(RULES.weightedFault(()=>0),'usb');
  assert.equal(RULES.weightedFault(()=>.999999),'chicken');
});
test('Ads do not appear on nights 1–3; intervals match nights 4–7',()=>{
  assert.deepEqual(RULES.AD_INTERVALS,{4:[25,40],5:[23,35],6:[20,30],7:[18,27]});
  for(let i=1;i<=3;i++)assert.equal(RULES.nextAdDelay(i),Infinity);
  for(let n=4;n<=7;n++){
    const [lo,hi]=RULES.AD_INTERVALS[n];
    approx(RULES.nextAdDelay(n,()=>0),lo);
    assert.ok(RULES.nextAdDelay(n,()=>.999999)<=hi);
  }
});
test('Temporary fault durations are bounded as specified',()=>{
  assert.deepEqual(RULES.DURATIONS,{
    frozen:[4,7],signal_lost:[5,8],input_lag:[3,5],stale:[5,6],
    audio_spam:[4,6],chicken:[15,20]
  });
  for(const [mode,[min,max]] of Object.entries(RULES.DURATIONS)){
    approx(RULES.faultDuration(mode,()=>0),min);
    assert.ok(RULES.faultDuration(mode,()=>.9999)<max);
  }
});
test('Only target cameras fail; system-wide faults affect all cameras',()=>{
  for(const mode of ['usb','reboot','crash'])
    for(let cam=1;cam<=9;cam++)assert.equal(RULES.isCameraUnavailable(mode,cam),true);
  for(const mode of ['frozen','signal_lost','stale'])
    for(let cam=1;cam<=9;cam++)assert.equal(RULES.isCameraUnavailable(mode,cam,8),cam===8);
  for(const mode of ['input_lag','audio_spam','chicken','idle'])
    assert.equal(RULES.isCameraUnavailable(mode,8),false);
  assert.equal(RULES.safeObservation('idle',8,0,true),false);
  assert.equal(RULES.safeObservation('input_lag',8,0,false),true);
});
test('Unavailable CAM08 pauses C3 anger but active observation calms him',()=>{
  for(const night of [2,4,7]){
    const g=AI.createNight(night,()=>.5);
    const c3=g.enemies[2];g.enemies.splice(0,g.enemies.length,c3);
    for(let i=0;i<200;i++)AI.tick(g,.05,{});
    const before=c3.anger;
    for(let i=0;i<2000;i++)AI.tick(g,.05,{c3Protected:true,cameraOpen:false,camera:1});
    approx(c3.anger,before);assert.equal(c3.phase,AI.PHASES.WATCH);
    for(let i=0;i<60;i++)AI.tick(g,.05,{cameraOpen:true,camera:8});
    assert.ok(c3.anger<before,'C3 should calm again after recovery');
  }
});
test('Already rushing C3 ignores camera failure protection',()=>{
  const g=AI.createNight(7,()=>.5),e=g.enemies[2];
  g.enemies.splice(0,g.enemies.length,e);e.anger=1;e.phase=AI.PHASES.RUSH;e.nextMove=.2;
  const before=e.step;
  for(let i=0;i<50;i++)AI.tick(g,.05,{c3Protected:true,cameraOpen:true,camera:8,rightClosed:false});
  assert.ok(e.step>before||e.phase===AI.PHASES.DOOR);
  assert.equal(e.anger,1);
});
test('Tablet controller has a single event manager tied to active game time',()=>{
  assert.match(tablet,/function triggerFault\(mode,duration\)/);
  assert.match(tablet,/state\.mode!=='idle'/);
  assert.match(tablet,/FAULTS\.weightedFault\(\)/);
  assert.match(tablet,/const dt=Math\.max\(0,gs\.nightElapsed-/);
  assert.match(tablet,/if\(game\.cameraOpen && state\.cooldown<=0\)/);
  assert.match(tablet,/state\.cooldown=random\(8,12\)/);
  assert.match(tablet,/game\.chooseCamera\(target\)/);
  assert.doesNotMatch(tablet,/setInterval\s*\(/);
  assert.match(html,/src="fnar-tablet-faults\.js"/);
  assert.match(app,/c3Protected/);
});
test('Net Video can be relaunched and overlays remain a harmless browser UI',()=>{
  assert.match(tablet,/state\.crashStep='desktop'/);
  assert.match(tablet,/state\.crashStep='launch';state\.faultRemaining=random\(2,3\)/);
  assert.match(tablet,/errorClose\.addEventListener/);
  assert.match(tablet,/relaunch\.addEventListener/);
  assert.match(css,/tablet-crash-screen/);
  assert.match(css,/tablet-fault-frame/);
  assert.match(css,/tablet-chicken-layer/);
  assert.match(tablet,/imageHistory\.length>75/);
  assert.match(tablet,/clearChicken\(\)/);
  assert.doesNotMatch(tablet,/(?:fetch|XMLHttpRequest|eval)\s*\(/);
});
test('Audio, pause and reset use only existing game resources',()=>{
  const sounds=fs.readdirSync(path.join(root,'assets','sound'));
  for(const s of ['os_info','os_balloon','beep','blip','os_usb_remove','os_usb_connect','os_startup','os_shutdown'])
    assert.ok(sounds.includes(s+'.mp3'),s);
  for(const img of ['boot','shutdown','desktop','netvideo'])
    assert.ok(fs.existsSync(path.join(root,'assets','ui','tablet',img+'.webp')));
  assert.match(tablet,/const frozen=gs\.paused\|\|game\.phoneState\?\.status==='talking'/);
  assert.match(tablet,/spamAudio\.pause/);
  assert.match(tablet,/stopSound\(\);spamAudio=null;pausedAudio=false/);
  assert.match(tablet,/state\.night!==game\.currentNight/);
});
test('All new UI events support Russian and Japanese',()=>{
  for(const key of ['frozen','signal','lag','stale','crashTitle','crashBody','close','launch','audio','chickenTitle','chickenBody','chickenWatch']){
    const occur=(tablet.match(new RegExp('\\b'+key+':','g'))||[]).length;
    assert.ok(occur>=2,key+' missing bilingual UI');
  }
});
