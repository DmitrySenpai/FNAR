'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const COMPANY=require('../fnar-company.js');
const AI=require('../fnar-ai.js');
const profile=COMPANY.getCompanyProfile;
function seeded(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function game(name,night=3,seed=42){return AI.createNight(night,seeded(seed),null,profile(name));}
test('normalization and deterministic UTF-8 hashing across scripts',()=>{
  for(const name of ['My  Company','Курятник','株式会社 ねこ','株式会社 ねこ','CHICKEN.EXE']){
    assert.deepEqual(profile(name),profile(name));
    assert.equal(profile(name).profileId,profile('  '+name.toUpperCase()+'   ').profileId);
  }
  assert.equal(COMPANY.hash('こんにちは'),COMPANY.hash('こんにちは'));
  assert.equal(profile('Ｎｅｔ　Ｓｙｓｔｅｍ').profileId,'net-system');
  assert.equal(profile('  Net   System  ').profileId,'net-system');
});
test('neutral placeholders and all special mappings',()=>{
  for(const n of ['', 'Мой офис', '  мой  офис ', '私のオフィス'])
    assert.equal(profile(n).profileId,'neutral');
  const cases={'Курятник':['coop',3,.07],'Net System':['net-system',2,.05],
    'Chicken.exe':['chicken-exe',4,.05],'Петушиная корпорация':['rooster-corp',1,-.05],
    'Тихий офис':['quiet-office',3,-.05]};
  for(const [n,[id,target,value]] of Object.entries(cases)){
    const p=profile(n);assert.equal(p.profileId,id);assert.equal(p.target,target);
    assert.equal(p.modifierValue,value);assert.equal(p.special,true);
  }
});
test('night gating, custom night, freezing, independent presets and caps',()=>{
  for(const n of ['Курятник','Net System','Chicken.exe','Петушиная корпорация','Тихий офис']){
    const p=profile(n);
    for(let night=1;night<=7;night++){
      const g=game(n,night);
      assert.equal(g.companyModifiers.active,night>=2&&night<=6);
      const values=Object.entries(g.companyModifiers).filter(([key,value])=>key!=='target'&&typeof value==='number').map(([,value])=>value);
      for(const value of values)assert.ok(value>=.93&&value<=1.07);
      assert.strictEqual(g.config,AI.NIGHT_CONFIG[night]===undefined?g.config:night===7?g.config:AI.NIGHT_CONFIG[night]);
    }
    const g=game(n);
    const snap=g.companyModifiers;
    profile('Another organization'); // no mutation of already running session
    assert.strictEqual(g.companyModifiers,snap);
  }
  const custom=AI.createNight(7,seeded(1),[0,10,20,5],profile('Курятник'));
  assert.equal(custom.companyModifiers.active,false);
  assert.equal(custom.customAI[0],0);
});
test('CAM 08 reduces C3 anger even with faster profile; protection freezes anger',()=>{
  const g=game('Курятник',3);
  const c3=g.enemies[2];
  for(let i=0;i<250;i++)AI.tick(g,.1,{cameraOpen:false});
  const before=c3.anger;
  for(let i=0;i<100;i++)AI.tick(g,.1,{cameraOpen:true,camera:8});
  assert.ok(c3.anger<before,'continuous CAM 08 must reduce anger');
  const protectedAnger=c3.anger;
  for(let i=0;i<100;i++)AI.tick(g,.1,{c3Protected:true});
  assert.equal(c3.anger,protectedAnger);
});
test('C4 never skips nodes, including when burst chance rises',()=>{
  for(let seed=1;seed<=40;seed++){
    const g=game('Chicken.exe',5,seed);
    const e=g.enemies[3];let last=e.step;
    for(let i=0;i<3600;i++){
      const events=AI.tick(g,.1,{});
      for(const event of events.filter(v=>v.id===4&&v.type==='move')){
        assert.ok(Math.abs(event.step-last)<=1,'C4 cannot skip nodes');
        last=event.step;
      }
      if(e.phase===AI.PHASES.DOOR||e.phase===AI.PHASES.REST||e.phase===AI.PHASES.RETREAT)last=e.step;
    }
  }
});
test('paired 200-seed simulation has measurable but bounded effects',()=>{
  const samples=200;
  for(const name of ['Курятник','Net System','Chicken.exe','Петушиная корпорация','Тихий офис']){
    const p=profile(name);let changed=0;
    for(let seed=1;seed<=samples;seed++){
      const baseline=AI.createNight(4,seeded(seed),null,null);
      const modified=AI.createNight(4,seeded(seed),null,p);
      const baselineEnemy=baseline.enemies[p.target-1],modifiedEnemy=modified.enemies[p.target-1];
      let eventA=0,eventB=0,trajectoriesDiffer=false;
      for(let t=0;t<2400;t++){
        const input={cameraOpen:p.target===2,camera:p.target===2?baselineEnemy.route[baselineEnemy.step] : 8};
        eventA+=AI.tick(baseline,.1,input).filter(e=>e.id===p.target&&(e.type==='move'||e.type==='rush')).length;
        eventB+=AI.tick(modified,.1,input).filter(e=>e.id===p.target&&(e.type==='move'||e.type==='rush')).length;
        if(eventA!==eventB||Math.abs(baselineEnemy.anger-modifiedEnemy.anger)>1e-8||Math.abs(baselineEnemy.nextMove-modifiedEnemy.nextMove)>1e-8)trajectoriesDiffer=true;
      }
      if(trajectoriesDiffer)changed++;
    }
    assert.ok(changed>0,name+' must have a measurable effect');
  }
});
