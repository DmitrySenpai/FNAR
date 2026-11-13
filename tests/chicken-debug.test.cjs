'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const tabletSource=fs.readFileSync(path.join(root,'tablet-os.js'),'utf8');
const tabletCSS=fs.readFileSync(path.join(root,'tablet-os.css'),'utf8');
const RULES=require('../fnar-tablet-faults.js');

function fixture({night=1,language='ru'}={}){
  const frames=[],warnings=[],infos=[],sounds=[];
  class Node {
    constructor(cls=''){
      this.className=cls;this.children=[];this.selectors=new Map();this.dataset={};
      this.clientWidth=1280;this.clientHeight=720;this.offsetWidth=360;this.offsetHeight=200;
      this.textContent='';this.src='assets/cameras/cam08_c3.webp';
      this.currentSrc=this.src;this.complete=true;this.naturalWidth=1280;
      this.style={setProperty(key,val){this[key]=val;},removeProperty(key){delete this[key];}};
      this.classList={
        contains:(name)=>this.className.split(/\s+/).includes(name),
        add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/),...names].filter(Boolean))].join(' ');},
        remove:(...names)=>{this.className=this.className.split(/\s+/).filter(n=>!names.includes(n)).join(' ');},
        toggle:(name,force)=>{
          const has=this.classList.contains(name);
          const next=force===undefined?!has:Boolean(force);
          if(next)this.classList.add(name);else this.classList.remove(name);
          return next;
        }
      };
    }
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...items){this.children=items;}
    setAttribute(key,value){this[key]=value;}
    querySelector(selector){
      if(!this.selectors.has(selector))this.selectors.set(selector,new Node());
      return this.selectors.get(selector);
    }
    addEventListener(){}
    blur(){}
    contains(){return true;}
    getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
  }
  const nodes={
    cameraScreen:new Node('camera-screen'),
    cameraFeed:new Node('camera-feed'),
    cameraPicture:new Node('camera-picture')
  };
  const document={
    documentElement:{lang:language},
    createElement:()=>new Node(),
    getElementById:id=>nodes[id]||(nodes[id]=new Node()),
    addEventListener(){}
  };
  let cameraOpen=false;
  const game={
    state:{active:true,paused:false,nightElapsed:0,power:84},
    currentNight:night,
    currentCamera:8,
    phoneState:{status:'idle'},
    get cameraOpen(){return cameraOpen;},
    setCameraOpen(open){
      if(this.state.active&&!this.state.paused)cameraOpen=open;
    },
    chooseCamera(id){this.currentCamera=id;}
  };
  class AudioMock{
    constructor(src){this.src=src;this.paused=true;this.volume=0;sounds.push(this);}
    play(){this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
  }
  const localStorage={getItem(){return null;}};
  const window={
    KokhinhinDebug:game,
    FNAR_TABLET_FAULTS:RULES,
    addEventListener(){},
    matchMedia:()=>({matches:true})
  };
  const context={
    window,document,localStorage,Audio:AudioMock,
    performance:{now:()=>0},requestAnimationFrame:cb=>frames.push(cb),
    matchMedia:window.matchMedia,
    console:{warn:(...x)=>warnings.push(x),info:(...x)=>infos.push(x)}
  };
  vm.runInNewContext(tabletSource,context,{filename:'tablet-os.js'});
  const debug=window.FNARTabletDebug;
  assert.ok(debug,'Tablet module did not initialize');
  function frame(dt=0){
    if(dt>0)game.state.nightElapsed+=dt;
    const cb=frames.shift();assert.equal(typeof cb,'function');
    cb();
  }
  function overlay(className){
    return nodes.cameraScreen.children.find(x=>x.className.split(/\s+/).includes(className));
  }
  const desc=overlay('tablet-popup');
  const chicken=overlay('tablet-chicken-layer');
  return {debug,game,window,frame,overlay,desc,chicken,nodes,warnings,infos,sounds,Node};
}
test('forceAd opens CCTV and displays advertisement immediately on night 1',()=>{
  const v=fixture({night:1});
  assert.equal(v.game.cameraOpen,false);
  assert.equal(v.debug.forceAd(),true);
  assert.equal(v.game.cameraOpen,true);
  assert.equal(v.debug.status.adVisible,true);
  assert.equal(v.debug.status.shown,1);
  assert.equal(v.debug.forceAd(),false,'must not create second ad');
  assert.equal(v.debug.status.shown,1);
  v.frame(.1);
  assert.equal(v.debug.status.adVisible,true,'night 1 debug overlay must survive RAF');
});
test('forceAd({index:10}) selects the existing Chicken ad and respects RU / JA',()=>{
  for(const [lang,title] of [['ru','НАЙДЕН ВИРУС'],['ja','ウイルスを検出']]){
    const v=fixture({language:lang,night:2});
    assert.equal(v.debug.forceAd({index:10}),true);
    assert.equal(v.desc.querySelector('h3').textContent,title);
    assert.equal(v.debug.forceAd({index:999}),false);
    assert.ok(v.warnings.some(x=>String(x).includes('Advertising index')));
  }
});
test('forceChicken launches exactly one real fault, with a 20s debug duration',()=>{
  const v=fixture({night:1});
  const before={...v.game.state};
  assert.equal(v.debug.forceChicken(),true);
  assert.equal(v.debug.status.mode,'chicken');
  assert.equal(v.debug.status.faultRemaining,20);
  assert.deepEqual([...v.debug.status.chickenTypes],['glitch','paw']);
  assert.equal(v.game.cameraOpen,true);
  assert.deepEqual(v.game.state,before,'debug visuals must not modify game state');
  assert.equal(v.debug.status.faultHistory.length,1);
  v.frame(.1);
  assert.equal(v.debug.status.mode,'chicken');
});
test('Each Chicken effect and all is accessible independently, preserving a max of two layers',()=>{
  const v=fixture({night:3});
  for(const kind of ['glitch','paw','cursor','shortcut','balloon','watched','all']){
    const shown=v.debug.forceChickenEffect(kind);
    assert.ok(shown,'failed '+kind);
    const types=[...v.debug.status.chickenTypes];
    assert.ok(types.length>=1&&types.length<=2);
    assert.ok(kind==='all'?types.includes('glitch')&&types.includes('paw'):types.includes(kind));
  }
  assert.equal(v.debug.forceChickenEffect('invalid'),false);
  assert.equal(v.debug.status.mode,'chicken');
});
test('Paw marks are SVG, large, distinct and between 4 and 8 per wave',()=>{
  const v=fixture();
  v.debug.forceChickenEffect('paw');
  const effect=v.chicken.children.find(x=>x.className==='tablet-chicken-effect');
  assert.ok(effect);
  const primary=effect.children.find(x=>x.className==='tablet-chicken-primary');
  const marks=primary.children.filter(x=>x.className==='tablet-chicken-print');
  assert.ok(marks.length>=4&&marks.length<=8);
  for(const m of marks)assert.match(m.innerHTML,/viewBox="0 0 64 76"/);
  assert.ok(new Set(marks.map(m=>m.style.left)).size>1);
});
test('Glitch is a brief multi-segment visual burst and intensity increases density',()=>{
  const v=fixture();
  assert.equal(v.debug.setChickenIntensity(2),2);
  v.debug.forceChickenEffect('glitch');
  const effect=v.chicken.children.find(x=>x.className==='tablet-chicken-effect');
  const primary=effect.children.find(x=>x.className==='tablet-chicken-primary');
  const field=primary.children.find(x=>x.className==='tablet-chicken-glitch-field');
  assert.ok(field,'missing layered RGB glitch');
  assert.ok(field.children.filter(x=>x.className==='tablet-chicken-glitch-band').length>=12);
  assert.ok(field.children.filter(x=>x.className==='tablet-chicken-rgb-slice').length>=4);
  assert.ok(field.children.filter(x=>x.className==='tablet-chicken-pixel').length>=10);
  assert.ok(field.children.some(x=>x.className==='tablet-chicken-ghost-button'));
  assert.match(String(field.style['--glitch-duration']),/^0\.[4-9]/);
  assert.equal(v.debug.setChickenIntensity(5),false);
  assert.ok(v.warnings.length>0);
});
test('clearFault restores overlay, audio, pointer and camera controls without resetting progress',()=>{
  const v=fixture({night:4}),state={...v.game.state};
  v.debug.forceChickenEffect('cursor');
  assert.equal(v.debug.status.mode,'chicken');
  assert.equal(v.nodes.cameraScreen.style.cursor,'none');
  assert.equal(v.debug.clearFault(),true);
  assert.equal(v.debug.status.mode,'idle');
  assert.equal(v.debug.status.adVisible,false);
  assert.equal(v.chicken.classList.contains('hidden'),true);
  assert.equal(v.nodes.cameraScreen.style.cursor,undefined);
  assert.deepEqual(v.game.state,state);
  v.debug.forceAd();
  assert.equal(v.debug.clearFault(),true);
  assert.equal(v.debug.status.adVisible,false);
});
test('Pause freezes visual animation and fault countdown; ending game cleans up',()=>{
  const v=fixture({night:5});
  v.debug.forceChicken({duration:20});
  v.frame(1);
  const remaining=v.debug.status.faultRemaining;
  v.game.state.paused=true;
  v.frame(0);
  assert.equal(v.debug.status.faultRemaining,remaining);
  assert.equal(v.chicken.classList.contains('is-paused'),true);
  v.game.state.paused=false;v.frame(2);
  assert.ok(v.debug.status.faultRemaining<remaining);
  v.game.state.active=false;v.frame(0);
  assert.equal(v.debug.status.mode,'idle');
  assert.equal(v.chicken.classList.contains('hidden'),true);
});
test('Help and legacy commands remain available; no dependencies on system executables',()=>{
  const v=fixture();
  const commands=v.debug.help();
  assert.ok(commands.some(x=>x.includes('forceAd({ index: 10 })')));
  assert.ok(commands.some(x=>x.includes("forceChickenEffect('all')")));
  assert.ok(v.infos.length>0);
  for(const old of ['showAd','triggerFault','reboot','disconnectUSB','reset']){
    assert.equal(typeof v.debug[old],'function',old);
  }
  for(const name of ['forceAd','forceChicken','forceChickenEffect','clearFault','setChickenIntensity','help'])
    assert.equal(typeof v.debug[name],'function');
  assert.doesNotMatch(tabletSource,/\b(?:eval|Function|spawn|execFile|XMLHttpRequest)\s*\(/);
});
test('Static CSS ensures pointer safety, reduced motion, lightweight effects and localized errors',()=>{
  assert.match(tabletCSS,/\.tablet-chicken-layer.*pointer-events:none/s);
  assert.match(tabletCSS,/\.tablet-chicken-layer\.is-paused/);
  assert.match(tabletCSS,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(tabletCSS,/fnar-chicken-burst/);
  assert.match(tabletSource,/chickenSystemBody:'Обнаружено/);
  assert.match(tabletSource,/chickenSystemBody:'メモリ内/);
  assert.doesNotMatch(tabletSource,/<iframe|\.exe\?download=/);
});
