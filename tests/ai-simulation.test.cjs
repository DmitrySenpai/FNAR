'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const AI=require('../fnar-ai.js');
function rng(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function advance(g,seconds,opts=()=>({}),dt=.05){
  const ev=[];for(let i=0;i<Math.ceil(seconds/dt);i++)ev.push(...AI.tick(g,dt,opts(g,i*dt)));
  return ev;
}
test('seven night configs, 360s length, routes and C3 director identity',()=>{
  assert.equal(AI.NIGHT_LENGTH,360);
  assert.deepEqual(AI.ENEMY_DEFS.map(e=>e.route),[[5,4,6,7],[1,8,3,9],[8,3,9],[2,5,4,6,7]]);
  assert.deepEqual(AI.ENEMY_DEFS.map(e=>e.side),['left','right','right','left']);
  assert.deepEqual(Array.from({length:7},(_,i)=>AI.NIGHT_CONFIG[i+1].movementScale),[1.2,1,.9,.8,.7,.6,.5]);
  assert.deepEqual(Array.from({length:7},(_,i)=>AI.NIGHT_CONFIG[i+1].c3Threshold),[Infinity,45,37,30,26,22,18]);
  for(let n=1;n<=7;n++){
    const g=AI.createNight(n,rng(n));
    assert.equal(g.enemies[2].phase,AI.PHASES.WATCH);
    assert.deepEqual(AI.visibleIds(g,8),[3]);
    assert.ok(g.config.attackWindow>=3);
  }
});
test('night one starts C1 first, C4 after halftime and C3 does not attack',()=>{
  const g=AI.createNight(1,rng(13));
  assert.ok(g.enemies[0].nextMove<g.enemies[1].nextMove);
  assert.ok(g.enemies[1].nextMove<g.enemies[3].nextMove);
  assert.ok(g.enemies[3].nextMove>180);
  const events=advance(g,360,()=>({leftClosed:true,rightClosed:true}));
  assert.equal(events.some(e=>e.id===3&&['rush','attack','move'].includes(e.type)),false);
  assert.equal(g.enemies[2].anger,0);
});
test('C3 ignores glances shorter than 1.4s, cools during sustained watch, rush is irreversible',()=>{
  const g=AI.createNight(2,rng(45));
  const c3=g.enemies[2];g.enemies.splice(0,g.enemies.length,c3);
  advance(g,16);const before=c3.anger;
  advance(g,1,()=>({cameraOpen:true,camera:8}));
  assert.ok(c3.anger>before);
  const peak=c3.anger;
  advance(g,3,()=>({cameraOpen:true,camera:8}));
  assert.ok(c3.anger<peak);
  let sawRush=false;
  for(let i=0;i<1600;i++){
    const events=AI.tick(g,.05,{rightClosed:true});
    if(events.some(e=>e.type==='rush')){sawRush=true;break;}
  }
  assert.ok(sawRush);
  const angry=c3.anger;
  advance(g,.4,()=>({cameraOpen:true,camera:8,rightClosed:true}));
  assert.equal(c3.anger,angry);
  assert.notEqual(c3.phase,AI.PHASES.WATCH);
});
test('C2 observing slows but cannot permanently freeze',()=>{
  const measure=watched=>{
    const g=AI.createNight(4,()=>.99);
    const c2=g.enemies[1];g.enemies.splice(0,g.enemies.length,c2);
    c2.phase=AI.PHASES.PATROL;c2.nextMove=10;
    for(let i=0;i<1200;i++){
      AI.tick(g,.05,{cameraOpen:watched,camera:1,rightClosed:true});
      if(c2.step>0)return i*.05;
    }
    return Infinity;
  };
  const free=measure(false),observed=measure(true);
  assert.ok(observed>free);
  assert.ok(observed<60);
});
test('C4 never skips camera nodes during a rush pair',()=>{
  const g=AI.createNight(7,()=>.3);
  const c4=g.enemies[3];g.enemies.splice(0,g.enemies.length,c4);
  c4.phase=AI.PHASES.PATROL;c4.nextMove=.1;
  let prev=c4.step,count=0;
  for(const e of advance(g,80,()=>({leftClosed:true})).filter(x=>x.id===4&&x.type==='move')){
    assert.ok(Math.abs(e.step-prev)<=1);prev=e.step;count++;
  }
  assert.ok(count>=3);
});
test('closed doors retreat; open doors attack after min 3 seconds',()=>{
  for(const n of [1,4,7]){
    const g=AI.createNight(n,rng(5)),e=g.enemies[0];
    g.enemies.splice(0,g.enemies.length,e);e.phase=AI.PHASES.DOOR;e.step=e.route.length;
    assert.equal(advance(g,10,()=>({leftClosed:true})).some(ev=>ev.type==='attack'),false);
    assert.ok([AI.PHASES.RETREAT,AI.PHASES.REST].includes(e.phase));
    const open=AI.createNight(n,rng(5)),o=open.enemies[0];
    open.enemies.splice(0,open.enemies.length,o);o.phase=AI.PHASES.DOOR;o.step=o.route.length;
    assert.equal(advance(open,open.config.attackWindow-.15).some(ev=>ev.type==='attack'),false);
    assert.ok(advance(open,.3).some(ev=>ev.type==='attack'));
  }
});
test('closing a door cancels an attack countdown',()=>{
  const g=AI.createNight(4,rng(1)),e=g.enemies[0];g.enemies.splice(0,g.enemies.length,e);
  e.phase=AI.PHASES.DOOR;e.step=e.route.length;
  advance(g,2);assert.ok(e.attack>1.9);
  advance(g,1,()=>({leftClosed:true}));assert.equal(e.attack,0);
  advance(g,3);assert.equal(e.phase,AI.PHASES.DOOR);
  assert.ok(e.attack<g.config.attackWindow);
});
test('reset clears aggression and all timers while preserving debug array identity',()=>{
  const g=AI.createNight(6,rng(6)),same=g.enemies;
  g.enemies[2].phase=AI.PHASES.RUSH;g.enemies[2].anger=1;
  g.enemies[0].phase=AI.PHASES.DOOR;g.enemies[0].attack=3;g.enemies[0].step=4;
  AI.resetNight(g,6,rng(16));assert.equal(same,g.enemies);
  for(const e of g.enemies){assert.equal(e.attack,0);assert.equal(e.step,0);assert.equal(e.blocked,0);assert.equal(e.burst,0);}
  assert.equal(g.enemies[2].phase,AI.PHASES.WATCH);assert.equal(g.enemies[2].anger,0);
});
test('all shared-camera variants and warning SFX exist',()=>{
  const cameras=new Set(fs.readdirSync(path.join(__dirname,'..','assets','cameras')));
  const sounds=new Set(fs.readdirSync(path.join(__dirname,'..','assets','sound')));
  for(let n=1;n<=9;n++)assert.ok(cameras.has('cam'+String(n).padStart(2,'0')+'.webp'));
  for(const [cam,a,b] of [[4,1,4],[5,1,4],[6,1,4],[7,1,4],[3,2,3],[8,2,3],[9,2,3]]){
    const id='cam'+String(cam).padStart(2,'0');
    assert.ok(cameras.has(id+'_c'+a+'.webp'));
    assert.ok(cameras.has(id+'_c'+b+'.webp'));
    assert.ok(cameras.has(id+'_c'+a+'_c'+b+'.webp')||cameras.has(id+'_c'+b+'_c'+a+'.webp'));
  }
  for(const s of ['running.mp3','running-fast.mp3','knock.mp3','knock-2.mp3','knock-3.mp3'])assert.ok(sounds.has(s),s);
});
test('21 complete 360s runs: no attacks when doors are closed promptly, no side collisions',()=>{
  for(let night=1;night<=7;night++)for(const seed of [11,159,2026]){
    const g=AI.createNight(night,rng(seed+night*167));let attacks=0,warnings=0,power=100;
    let lastStep=Object.fromEntries(g.enemies.map(e=>[e.id,e.step]));
    for(let frame=0;frame<3600;frame++){
      const elapsed=frame*.1;
      const leftClosed=g.enemies.some(e=>e.side==='left'&&e.phase===AI.PHASES.DOOR);
      const rightClosed=g.enemies.some(e=>e.side==='right'&&e.phase===AI.PHASES.DOOR);
      const cameraOpen=night>=2&&elapsed%16<3.2;
      const events=AI.tick(g,.1,{cameraOpen,camera:8,leftClosed,rightClosed});
      for(const e of events){
        if(e.type==='attack')attacks++;
        if(e.type==='warning')warnings++;
        if(e.type==='move')assert.ok(Math.abs(e.step-lastStep[e.id])<=1,'skipped camera');
      }
      for(const e of g.enemies)lastStep[e.id]=e.step;
      const dangerous=g.enemies.filter(e=>AI.isDanger(e));
      assert.ok(dangerous.length<=g.config.dangerCap);
      for(const side of ['left','right'])assert.ok(dangerous.filter(e=>e.side===side).length<=1);
      power-=(.12+(night-1)*.015+(cameraOpen?.10:0)+(leftClosed?.28:0)+(rightClosed?.28:0))*.1;
    }
    assert.equal(attacks,0,'unavoidable attack: night '+night+' seed '+seed);
    assert.ok(warnings>0);
    if(night<=6)assert.ok(power>=-.5,'power balance night '+night+' seed '+seed+' leftover '+power);
  }
});
