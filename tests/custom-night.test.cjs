'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const AI=require('../fnar-ai.js');
const DOCS=require('../fnar-endings.js');

function rng(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function simulate(g,seconds,inputs=()=>({})){
  const events=[];
  for(let i=0;i<seconds*10;i++)events.push(...AI.tick(g,.1,inputs(g)));
  return events;
}
test('AI 0 disables every rooster even for a full custom night',()=>{
  const g=AI.createNight(7,rng(8),[0,0,0,0]);
  assert.deepEqual(g.customAI,[0,0,0,0]);
  assert.equal(g.config.c3Threshold,Infinity);
  assert.deepEqual(g.enemies.map(e=>e.phase),Array(4).fill(AI.PHASES.DORMANT));
  const events=simulate(g,360);
  assert.equal(events.filter(e=>['wake','move','rush','warning','attack'].includes(e.type)).length,0);
  assert.equal(AI.visibleIds(g,8).length,0);
});
test('AI levels clamp to 0..20 and defaults to 10',()=>{
  assert.deepEqual(AI.normalizeAILevels([-10,5.6,500,NaN]),[0,6,20,10]);
  assert.deepEqual(AI.normalizeAILevels(null),[10,10,10,10]);
  const levels=[10,10,10,10],g=AI.createNight(7,rng(42),levels);
  levels[0]=0;assert.equal(g.customAI[0],10);
});
test('Each custom level affects its own rooster, not fixed story presets',()=>{
  const original=AI.NIGHT_CONFIG[7];
  const low=AI.createNight(7,rng(1),[1,1,1,1]);
  const high=AI.createNight(7,rng(1),[20,20,20,20]);
  assert.ok(high.enemies[0].nextMove<low.enemies[0].nextMove,'C1 wake delay');
  assert.ok(high.enemies[1].nextMove<low.enemies[1].nextMove,'C2 wake delay');
  assert.ok(high.config.c3Threshold<low.config.c3Threshold,'C3 anger accumulation');
  assert.ok(high.enemies[3].nextMove<low.enemies[3].nextMove,'C4 wake delay');
  assert.ok(high.config.c2WatchRatio>low.config.c2WatchRatio,'high C2 resists camera observation');
  assert.ok(high.config.c4Burst>low.config.c4Burst,'high C4 uses rush bursts');
  assert.ok(high.config.attackWindow>=3,'player retains reaction time');
  assert.equal(AI.NIGHT_CONFIG[7],original);
  assert.equal(original.movementScale,.50);
  assert.ok(Object.isFrozen(original));
});
test('Custom level 0 does not disable another rooster',()=>{
  for(let i=0;i<4;i++){
    const levels=[10,10,10,10];levels[i]=0;
    const g=AI.createNight(7,rng(12+i),levels);
    assert.equal(g.enemies[i].phase,AI.PHASES.DORMANT);
    assert.equal(g.enemies[i].nextMove,Infinity);
    assert.equal(g.enemies.filter((e,j)=>j!==i&&e.nextMove!==Infinity).length,3);
  }
});
test('Four maximum-level roosters still obey one threat per side and no skipped camera nodes',()=>{
  const g=AI.createNight(7,rng(2026),[20,20,20,20]);
  let last=Object.fromEntries(g.enemies.map(e=>[e.id,e.step]));
  for(let i=0;i<3600;i++){
    const input={leftClosed:g.enemies.some(e=>e.side==='left'&&e.phase===AI.PHASES.DOOR),
      rightClosed:g.enemies.some(e=>e.side==='right'&&e.phase===AI.PHASES.DOOR),
      cameraOpen:i%70<28,camera:8};
    for(const event of AI.tick(g,.1,input)){
      if(event.type==='move')assert.ok(Math.abs(event.step-last[event.id])<=1);
      if(event.type==='warning')assert.ok(event.reactionSeconds>=3);
    }
    for(const enemy of g.enemies)last[enemy.id]=enemy.step;
    const danger=g.enemies.filter(AI.isDanger);
    assert.ok(danger.length<=2);
    assert.ok(danger.filter(e=>e.side==='left').length<=1);
    assert.ok(danger.filter(e=>e.side==='right').length<=1);
  }
  assert.ok(g.elapsed>=359.9);
});
test('Resetting custom night maintains array identity, restores chosen levels',()=>{
  const g=AI.createNight(6,rng(6)),before=g.enemies;
  AI.resetNight(g,7,rng(9),[0,5,16,20]);
  assert.equal(g.enemies,before);
  assert.deepEqual(g.customAI,[0,5,16,20]);
  AI.resetNight(g,6,rng(6));
  assert.equal(g.customAI,null);
  assert.equal(g.config,AI.NIGHT_CONFIG[6]);
});
test('Company documents are localized, numerical and never employee resignations',()=>{
  for(const lang of ['ru','ja']){
    const pay=DOCS.getDocument(5,lang,'Example Office');
    const bonus=DOCS.getDocument(6,lang,'Example Office',50);
    const fired=DOCS.getDocument(7,lang,'Example Office');
    assert.ok(pay.company.includes('Example Office'));
    assert.ok(pay.lines.some(line=>line.text.includes('250')));
    assert.ok(bonus.lines.some(line=>line.text.includes('300')));
    assert.ok(bonus.lines.some(line=>line.text.includes('50')));
    assert.ok(!fired.lines.some(line=>/собственному желанию|一身上の都合/.test(line.text)));
    assert.ok(fired.stamp);
    assert.ok(fired.lines.some(line=>line.strong));
  }
  assert.equal(DOCS.getDocument(4),null);
});
test('Night choice and endings screens are present without replacing Door XP',()=>{
  const root=path.join(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  for(const id of ['nightSelectScreen','nightSelectList','night6Btn','customBtn','customAIGrid',
    'customStart','documentTitle','documentBody','documentStamp']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/src="fnar-endings\.js"/);
  assert.match(app,/window\.FNARDebug=window\.KokhinhinDebug/);
  assert.match(app,/showEnding:showCompanyDocument/);
  assert.doesNotMatch(app,/Прошу вас уволить меня по собственному желанию/);
  assert.ok(fs.existsSync(path.join(root,'tablet-os.js')));
});
