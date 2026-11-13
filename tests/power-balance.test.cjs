'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const POWER=require('../fnar-power.js');
const AI=require('../fnar-ai.js');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const nearly=(actual,expect,tolerance=.10)=>assert.ok(Math.abs(actual-expect)<=tolerance,
  'expected '+expect.toFixed(3)+', actual '+actual.toFixed(3));
function seedRng(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function timedSession(frameSeconds,optionsAtTime){
  const state={power:100,nightElapsed:0};
  let remaining=360;
  while(remaining>1e-8){
    const frame=Math.min(remaining,frameSeconds);
    POWER.forEachStep(frame,dt=>{
      const controls=optionsAtTime(state.nightElapsed);
      const passed=POWER.advanceClock(state,dt);
      POWER.spendPower(state,passed,controls);
    });
    remaining-=frame;
  }
  return state;
}
test('A: all seven idle nights consume the same amount, never exhaust power',()=>{
  for(let n=1;n<=7;n++){
    assert.equal(AI.NIGHT_CONFIG[n]!==undefined,true);
    const result=timedSession(1/30,()=>({}));
    nearly(result.nightElapsed,360,1e-8);
    nearly(result.power,65.8,.02);
  }
  assert.deepEqual(POWER.POWER_CONFIG,{base:.095,camera:.07,door:.18,light:.14});
});
test('B: 60% camera + 35% door + 15% light time leaves about 20% at night 4',()=>{
  const game=timedSession(1/12,t=>{
    // Non-overlapping door windows: their total time is 35% of the night.
    // Non-overlapping light windows: their total time is 15% of the night.
    return {
      cameraOpen:t<216,
      leftDoor:t<63,
      rightDoor:t>=63 && t<126,
      leftLight:t<27,
      rightLight:t>=27 && t<54
    };
  });
  nearly(game.power,20.44,.1);
});
test('C: full 360s AI and energy sessions on seven nights with timely doors are survivable',()=>{
  for(let night=1;night<=7;night++)for(const seed of [12,53,2026]){
    const ai=AI.createNight(night,seedRng(night*257+seed));
    const s={power:100,nightElapsed:0};
    let threats=0,attacks=0,zeroAt=null;
    POWER.forEachStep(360,dt=>{
      const t=s.nightElapsed;
      // 60% tablet viewing; regular small flashlight checks; both doors only
      // during actual threats. This reproduces a reactive, not perfect playstyle.
      const controls={
        cameraOpen:t%10<6,
        leftDoor:ai.enemies.some(e=>e.side==='left' && e.phase===AI.PHASES.DOOR),
        rightDoor:ai.enemies.some(e=>e.side==='right' && e.phase===AI.PHASES.DOOR),
        leftLight:t%20<2,
        rightLight:t%20>=2 && t%20<3
      };
      const passed=POWER.advanceClock(s,dt);
      const events=AI.tick(ai,passed,{
        cameraOpen:controls.cameraOpen,camera:8,
        leftClosed:controls.leftDoor,rightClosed:controls.rightDoor
      });
      threats+=events.filter(e=>e.type==='warning').length;
      attacks+=events.filter(e=>e.type==='attack').length;
      POWER.spendPower(s,passed,controls);
      if(!zeroAt && s.power<=0)zeroAt=s.nightElapsed;
    });
    nearly(s.nightElapsed,360,1e-8);
    assert.equal(attacks,0,'night '+night+' seed '+seed+' had an unavoidable attack');
    assert.ok(threats>0,'night '+night+' seed '+seed+' had no warnings');
    assert.equal(zeroAt,null,'night '+night+' seed '+seed+' lost power before 6AM');
    if(night===4)assert.ok(s.power>=12,'night 4 seed '+seed+' excessively expensive');
  }
});
test('D: holding both doors shut all night always exhausts power well before 6AM',()=>{
  const result=timedSession(.2,()=>({leftDoor:true,rightDoor:true}));
  assert.equal(result.power,0);
  const seconds=100/POWER.getPowerDrain({leftDoor:true,rightDoor:true});
  assert.ok(seconds<240&&seconds>200,'depletion should occur near 3m40s');
});
test('E: pause/phone freeze clock and power with explicit frozen flag',()=>{
  const state={power:65,nightElapsed:132};
  const both={cameraOpen:true,leftDoor:true,rightDoor:true,leftLight:true};
  for(const reason of ['pause','phone']){
    nearly(POWER.advanceClock(state,15,true),0,0);
    POWER.spendPower(state,15,both,true);
    nearly(state.power,65,0);nearly(state.nightElapsed,132,0);
  }
  assert.match(app,/if\(state\.paused\)\{draw\(\);requestAnimationFrame\(loop\);return;\}/);
  assert.match(app,/if\(state\.active && phoneState\.status==='talking'\)/);
  assert.match(app,/state\.last=performance\.now\(\); \/\/ No catch-up of world time while dialogue audio is playing\./);
});
test('F: 1, 5, 12, 30 and 60 FPS yield nearly equal clock and power',()=>{
  const options=t=>({
    cameraOpen:t%10<6,
    leftDoor:t%37<7,
    rightDoor:t%37>=7&&t%37<12,
    leftLight:t%23<2,
    rightLight:t%23>=2&&t%23<3
  });
  const sixty=timedSession(1/60,options);
  for(const fps of [1,5,12,30]){
    const result=timedSession(1/fps,options);
    nearly(result.nightElapsed,sixty.nightElapsed,.00001);
    nearly(result.power,sixty.power,.12);
  }
  // A browser stall of five seconds must not silently discard 4.94 seconds.
  const stalled={power:100,nightElapsed:100};
  POWER.forEachStep(5,dt=>{
    POWER.spendPower(stalled,POWER.advanceClock(stalled,dt),{leftDoor:true});
  });
  nearly(stalled.nightElapsed,105,1e-8);
  nearly(stalled.power,100-5*(.095+.18),.002);
  assert.match(app,/POWER\.forEachStep\(realElapsed/);
  assert.doesNotMatch(app,/Math\.min\(\.06,\s*Math\.max\(0,\s*\(timestamp-state\.last\)/);
});
test('G: restarting the night resets power and clock; game also resets outage and AI',()=>{
  const state={nightElapsed:333,power:4};
  POWER.resetNight(state);
  assert.deepEqual(state,{nightElapsed:0,power:100});
  assert.match(app,/resetJumpscare\(\);resetPowerFailure\(\);resetPhone\(\);stopAudioLoops\(\);/);
  assert.match(app,/POWER\.resetNight\(state\);state\.last=performance\.now\(\);/);
  assert.match(app,/resetEnemies\(\);needsComposing=true;/);
});
test('Usage bars reflect real load, including both doors',()=>{
  const base={},camera={cameraOpen:true},left={leftDoor:true},
    two={leftDoor:true,rightDoor:true},
    full={cameraOpen:true,leftDoor:true,rightDoor:true,leftLight:true,rightLight:true};
  assert.deepEqual([base,camera,left,two,full].map(POWER.getUsageLevel),[1,2,2,3,4]);
  assert.ok(POWER.getPowerDrain(left)>POWER.getPowerDrain(camera));
  assert.ok(POWER.getPowerDrain(two)>POWER.getPowerDrain(left));
  assert.ok(POWER.getPowerDrain(full)>POWER.getPowerDrain(two));
  assert.match(app,/POWER\.getUsageLevel\(powerControls\(\)\)/);
  assert.match(app,/getPowerSnapshot\(\)/);
});
test('Clock power and blackout behavior are shared and no longer night-multiplied',()=>{
  assert.equal(POWER.NIGHT_LENGTH,AI.NIGHT_LENGTH);
  const s={nightElapsed:359.8,power:20};
  nearly(POWER.advanceClock(s,20),.2,.00001);
  nearly(s.nightElapsed,360,.00001);
  assert.doesNotMatch(app,/\.12\+\(currentNight-1\)\*\.015/);
  assert.match(app,/POWER\.spendPower\(state,passed,powerControls\(\)\)/);
  assert.match(app,/if\(state\.power<=0\)startPowerFailure\(\)/);
  assert.match(app,/updatePowerFailure\(\)/);
  assert.match(app,/finishNight\(true,t\('winText'/);
});
