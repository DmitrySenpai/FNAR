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
      this.currentSrc=this.src;this.complete=true;this.naturalWidth=960;this.naturalHeight=540;this.listeners=new Map();
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
    addEventListener(type,fn){
      if(!this.listeners.has(type))this.listeners.set(type,[]);
      this.listeners.get(type).push(fn);
    }
    fire(type){
      const evt={stopPropagation(){},preventDefault(){},stopImmediatePropagation(){},target:this};
      for(const handler of this.listeners.get(type)||[])handler(evt);
    }
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
  const effect=v.chicken.querySelector('.tablet-chicken-effect');
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
  const effect=v.chicken.querySelector('.tablet-chicken-effect');
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

test('No duplicate Net Video icon is rendered: only a transparent hotspot over the art',()=>{
  const v=fixture({night:4});
  const crash=v.overlay('tablet-crash-screen');
  assert.ok(crash);
  assert.doesNotMatch(crash.innerHTML,/tablet-crash-shortcut/);
  assert.doesNotMatch(crash.innerHTML,/<strong>Net Video 3\.0<\/strong>/);
  assert.match(crash.innerHTML,/class="tablet-crash-hotspot hidden" aria-label="Net Video 3\.0"/);
  assert.match(tabletCSS,/\.tablet-crash-hotspot\{/);
  assert.doesNotMatch(tabletCSS,/\.tablet-crash-shortcut/);
  assert.match(tabletCSS,/background:#111 url\('assets\/ui\/tablet\/desktop\.webp'\) center\/contain no-repeat/);
});
test('Contain image geometry centers the original desktop and maintains icon alignment',()=>{
  const v=fixture({night:4});
  const calc=v.debug.desktopShortcutGeometry;
  const original={x:9,y:156,w:82,h:74};
  for(const [viewportW,viewportH] of [[960,540],[1280,720],[1024,768],[390,844],[844,390],[320,568]]){
    const bounds=calc(viewportW,viewportH,960,540);
    const scale=Math.min(viewportW/960,viewportH/540);
    const x0=(viewportW-960*scale)/2;
    const y0=(viewportH-540*scale)/2;
    assert.ok(Math.abs(bounds.left-(x0+original.x*scale))<.001);
    assert.ok(Math.abs(bounds.top-(y0+original.y*scale))<.001);
    assert.ok(bounds.width>=32&&bounds.height>=28);
    // Door Player ends above the Net Video region in the 960x540 wallpaper.
    assert.ok(bounds.top>y0+145*scale);
    // Clicking the icon does not cover the image's far edge or letterbox.
    assert.ok(bounds.left+bounds.width<=x0+110*scale+12);
    assert.ok(bounds.top+bounds.height<=y0+255*scale);
  }
  assert.equal(calc(0,720,960,540),null);
  assert.equal(calc(1280,0,960,540),null);
});
test('Crash: close error, click existing Net Video artwork and restore CCTV after 2–3s',()=>{
  const v=fixture({night:4});
  v.game.setCameraOpen(true);
  v.frame(0); // Initialize the regular night-4 tablet event loop.
  assert.equal(v.debug.triggerFault('crash'),true);
  assert.equal(v.debug.status.crashStep,'error');
  const crash=v.overlay('tablet-crash-screen');
  const dismiss=crash.querySelector('.tablet-crash-dismiss');
  const icon=crash.querySelector('.tablet-crash-hotspot');
  assert.equal(icon.classList.contains('hidden'),true);
  dismiss.fire('click');
  assert.equal(v.debug.status.crashStep,'desktop');
  assert.equal(icon.classList.contains('hidden'),false);
  assert.ok(Number.parseFloat(icon.style.width)>30);
  assert.ok(Number.parseFloat(icon.style.height)>25);
  assert.equal(icon.textContent,'','hotspot must have no added icon or caption');
  icon.fire('click');
  assert.equal(v.debug.status.crashStep,'launch');
  assert.equal(icon.classList.contains('hidden'),true);
  assert.equal(crash.querySelector('.tablet-crash-launch').classList.contains('hidden'),false);
  const countdown=v.debug.status.faultRemaining;
  assert.ok(countdown>=2&&countdown<=3);
  v.frame(countdown+.01);
  assert.equal(v.debug.status.mode,'idle');
  assert.equal(crash.classList.contains('hidden'),true);
  assert.equal(v.game.cameraOpen,true,'CCTV should return after relaunch');
});
test('Favicon is linked and both icon sizes are valid PNG/ICO files',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/rel="icon" href="favicon\.ico\?v=0504"/);
  assert.match(html,/href="favicon-32\.png\?v=0504"/);
  const ico=fs.readFileSync(path.join(root,'favicon.ico'));
  const png=fs.readFileSync(path.join(root,'favicon-32.png'));
  assert.equal(ico.subarray(0,4).toString('hex'),'00000100');
  assert.equal(ico.readUInt16LE(4),2);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),32);
  assert.equal(png.readUInt32BE(20),32);
});
