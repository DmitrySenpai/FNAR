/* Five Nights at Rooster's — Night 4+ tablet advertisements and OS faults.
   Separate module: leaves existing patrol, clock, power and phone systems intact. */
(() => {
  'use strict';
  const game=window.KokhinhinDebug;
  const tablet=document.getElementById('cameraScreen');
  const feed=document.getElementById('cameraFeed');
  if(!game || !tablet || !feed){console.warn('FNAR tablet module: game not ready');return;}
  const ru={
    windowTitle:'Net System — Информация',accept:'Принять',cancel:'Отмена',
    usbHeader:'УСТРОЙСТВА НЕ НАЙДЕНЫ',usbBody:'Нет связи ни с одной камерой. Переключение камер доступно. Ожидание восстановления USB…',
    shutdown:'Завершение работы...',biosTitle:'NET SYSTEM BIOS v3.0',biosText:'Проверка памяти... OK\nОбнаружение устройств... OK\nЗагрузка Door XP...',
    welcome:'Добро пожаловать',booting:'Загрузка системы…',startVideo:'Запуск Net Video 3.0…',
    ads:[
      ['ПОЗДРАВЛЯЕМ!','Ваш компьютер выбран для бесплатного обновления охранной системы. Установить сейчас?'],
      ['СРОЧНАЯ РЕКЛАМА','Подписка «Анти-Петух PRO» обещает защиту от внезапных криков. Активировать?'],
      ['ИНТЕРНЕТ-ПРОВАЙДЕР','Ускорьте все девять камер в 100 раз! Применить экспериментальную оптимизацию?'],
      ['ПРОВЕРКА СИСТЕМЫ','Найдено 47 подозрительных перьев. Запустить автоматическую очистку?'],
      ['СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ','Зерно премиум-класса теперь доступно онлайн. Получить подарок?'],
      ['ОБНОВЛЕНИЕ СЛУЖБЫ','Установлена устаревшая версия Net Video. Перейти на новую прямо сейчас?']
    ]
  };
  const ja={
    windowTitle:'Net System — お知らせ',accept:'承諾',cancel:'キャンセル',
    usbHeader:'カメラに接続できません',usbBody:'すべてのカメラが使用できません。カメラの切り替えは可能です。USBの再接続を待機中…',
    shutdown:'シャットダウンしています…',biosTitle:'NET SYSTEM BIOS v3.0',biosText:'メモリのチェック... OK\nデバイスの確認... OK\nDoor XP を起動中...',
    welcome:'ようこそ',booting:'システムを起動中…',startVideo:'Net Video 3.0 を起動中…',
    ads:[
      ['おめでとうございます！','セキュリティシステムの無料アップグレードに当選しました。インストールしますか？'],
      ['特別なお知らせ','突然のニワトリの叫び声から守る「Anti-Rooster PRO」を有効にしますか？'],
      ['インターネット接続','9台の監視カメラを100倍高速化！実験的な最適化を適用しますか？'],
      ['システム警告','47枚の不審な羽を発見しました。自動クリーニングしますか？'],
      ['今だけ限定','プレミアム飼料の特典を受け取りますか？'],
      ['更新の確認','Net Video は旧バージョンです。今すぐアップデートしますか？']
    ]
  };
  const safeRead=key=>{try{return localStorage.getItem(key)}catch(_){return null}};
  const lang=()=>document.documentElement.lang==='ja'||safeRead('kokhinhin_lang')==='ja'?'ja':'ru';
  const tr=()=>lang()==='ja'?ja:ru;
  const random=(a,b)=>a+Math.random()*(b-a);
  const choose=(a)=>a[Math.floor(Math.random()*a.length)];
  // Ads are frequent only while a camera tablet is open, from night 4 onward.
  // Shorten the delay slightly on nights 5–7.
  function nextAdDelay(extra=0){
    const factor=Math.max(.7,1-Math.max(0,game.currentNight-4)*.085);
    return random(10,18)*factor+extra;
  }
  const media=name=>`assets/ui/tablet/${name}.webp`;
  const html=(tag,cls,where)=>{const e=document.createElement(tag);e.className=cls;where.appendChild(e);return e;};
  const os=html('div','tablet-os-layer hidden',tablet);
  os.setAttribute('aria-live','polite');
  os.innerHTML=`<div class="tablet-os-picture"></div><div class="tablet-os-splash hidden" aria-hidden="true"></div><div class="tablet-os-center"><div class="tablet-os-title"></div><div class="tablet-os-subtitle"></div></div><div class="tablet-os-bios"><strong></strong><pre></pre></div>`;
  const splash=os.querySelector('.tablet-os-splash');
  const pic=os.querySelector('.tablet-os-picture'),title=os.querySelector('.tablet-os-title'),subtitle=os.querySelector('.tablet-os-subtitle'),bios=os.querySelector('.tablet-os-bios');
  const ad=html('section','tablet-popup hidden',tablet);
  ad.setAttribute('role','dialog');ad.setAttribute('aria-modal','true');
  ad.innerHTML=`<div class="tablet-popup-dialog"><div class="tablet-popup-head"><span>●</span><strong></strong><span class="tablet-popup-close" aria-hidden="true">×</span></div><div class="tablet-popup-message"><span class="tablet-popup-symbol">i</span><div><h3></h3><p></p></div></div><div class="tablet-popup-buttons"></div></div>`;
  const popupHeading=ad.querySelector('.tablet-popup-head strong'), popupTitle=ad.querySelector('h3'), popupText=ad.querySelector('p'), buttons=ad.querySelector('.tablet-popup-buttons');
  const usb=html('div','tablet-usb-failure hidden',feed);
  usb.innerHTML=`<div class="tablet-usb-inner"><div class="tablet-usb-icon">▣</div><strong></strong><p></p></div>`;
  const usbHeading=usb.querySelector('strong'),usbBody=usb.querySelector('p');
  const activeAudio=new Set();
  const audioSound=name=>{
    if(safeRead('kons-muted')==='1')return;
    const a=new Audio('assets/sound/'+name+'.mp3');
    a.preload='auto';a.volume=.65;activeAudio.add(a);
    a.onended=()=>activeAudio.delete(a);a.onerror=()=>activeAudio.delete(a);
    a.play().catch(()=>activeAudio.delete(a));return a;
  };
  function stopSound(){for(const a of activeAudio){a.pause();try{a.currentTime=0}catch(_){}}activeAudio.clear();}
  let pausedAudio=false;
  function freezeSound(freeze){
    if(freeze===pausedAudio)return;pausedAudio=freeze;
    for(const a of activeAudio){if(freeze) a.pause();else if(!safeRead('kons-muted')||safeRead('kons-muted')!=='1')a.play().catch(()=>{});}
  }
  const rebootStages=[
    {id:'shutdown',sec:4,sound:'os_shutdown'},
    {id:'black',sec:1},
    {id:'bios',sec:1.45},
    {id:'boot',sec:2.4,sound:'os_startup'},
    {id:'welcome',sec:1.2},
    {id:'desktop',sec:1},
    {id:'netvideo',sec:2}
  ];
  const state={night:null,mode:'idle',adVisible:false,adCountdown:0,stageIndex:-1,stageRemaining:0,usbRemaining:0,shown:0,accepted:0,declined:0};
  let previousElapsed=null,previousActive=false,wallTime=performance.now();
  function updateLocalization(){
    usbHeading.textContent=tr().usbHeader;usbBody.textContent=tr().usbBody;
  }
  function reset(){
    state.mode='idle';state.adVisible=false;state.adCountdown=nextAdDelay();state.stageIndex=-1;state.stageRemaining=0;state.usbRemaining=0;
    previousElapsed=null;ad.classList.add('hidden');os.classList.add('hidden');usb.classList.add('hidden');stopSound();pausedAudio=false;
  }
  function displayStage(stage){
    os.dataset.phase=stage.id;
    pic.style.backgroundImage='none';splash.classList.add('hidden');
    title.textContent='';subtitle.textContent='';bios.querySelector('strong').textContent='';bios.querySelector('pre').textContent='';
    if(stage.id==='shutdown'){pic.style.backgroundImage=`url("${media('shutdown')}")`;title.textContent=tr().shutdown;}
    else if(stage.id==='bios'){bios.querySelector('strong').textContent=tr().biosTitle;bios.querySelector('pre').textContent=tr().biosText;}
    else if(stage.id==='boot'){pic.style.backgroundImage=`url("${media('boot')}")`;subtitle.textContent=tr().booting;}
    else if(stage.id==='welcome'){pic.style.backgroundImage=`url("${media('shutdown')}")`;title.textContent=tr().welcome;}
    else if(stage.id==='desktop'){pic.style.backgroundImage=`url("${media('desktop')}")`;}
    else if(stage.id==='netvideo'){pic.style.backgroundImage=`url("${media('desktop')}")`;splash.style.backgroundImage=`url("${media('netvideo')}")`;splash.classList.remove('hidden');subtitle.textContent=tr().startVideo;}
    if(stage.sound)audioSound(stage.sound);
  }
  function startStage(index){
    state.stageIndex=index;
    const stage=rebootStages[index];
    if(!stage){complete();return;}
    state.stageRemaining=stage.sec;
    displayStage(stage);
  }
  function complete(){state.mode='idle';state.stageIndex=-1;os.classList.add('hidden');usb.classList.add('hidden');state.adCountdown=nextAdDelay(3);}
  function reboot(){
    if(!game.state.active)return;
    state.adVisible=false;ad.classList.add('hidden');state.mode='reboot';os.classList.remove('hidden');
    startStage(0);
  }
  function disconnectUSB(duration){
    if(!game.state.active)return;
    state.adVisible=false;ad.classList.add('hidden');state.mode='usb';state.usbRemaining=duration??choose([3,5,2,7]);
    updateLocalization();usb.classList.remove('hidden');audioSound('os_usb_remove');
  }
  function finishUSB(){
    state.mode='idle';state.usbRemaining=0;usb.classList.add('hidden');audioSound('os_usb_connect');state.adCountdown=nextAdDelay(3);
  }
  function dismiss(accepted){
    if(!state.adVisible)return;
    state.adVisible=false;ad.classList.add('hidden');
    if(accepted){state.accepted++;if(Math.random()<.5)reboot();else disconnectUSB();}
    else {state.declined++;state.adCountdown=nextAdDelay();}
  }
  function showAd(){
    if(!game.state.active||game.currentNight<4||state.mode!=='idle'||state.adVisible)return false;
    state.adVisible=true;state.shown++;
    const [h,txt]=choose(tr().ads);popupHeading.textContent=tr().windowTitle;popupTitle.textContent=h;popupText.textContent=txt;
    buttons.replaceChildren();
    const order=Math.random()<.5?['accept','cancel']:['cancel','accept'];
    order.forEach(kind=>{
      const button=document.createElement('button');button.type='button';button.textContent=tr()[kind];button.className='tablet-popup-action '+kind;
      button.addEventListener('click',e=>{e.stopPropagation();dismiss(kind==='accept');});buttons.appendChild(button);
    });
    audioSound('os_info');
    ad.classList.toggle('hidden',!game.cameraOpen);
    return true;
  }
  function ui(){
    const canShow=game.state.active&&game.currentNight>=4&&game.cameraOpen;
    ad.classList.toggle('hidden',!canShow||!state.adVisible);
    os.classList.toggle('hidden',!canShow||state.mode!=='reboot');
    usb.classList.toggle('hidden',!canShow||state.mode!=='usb');
  }
  function step(){
    const now=performance.now();wallTime=now;
    const gs=game.state;
    const active=gs.active&&game.currentNight>=4;
    if(!active){if(previousActive||state.mode!=='idle'||state.adVisible)reset();previousActive=false;requestAnimationFrame(step);return;}
    if(!previousActive || state.night!==game.currentNight || (previousElapsed!==null&&gs.nightElapsed+1<previousElapsed)){
      reset();state.night=game.currentNight;previousElapsed=gs.nightElapsed;
    }
    previousActive=true;
    const dt=Math.max(0,Math.min(15,gs.nightElapsed-(previousElapsed??gs.nightElapsed)));
    previousElapsed=gs.nightElapsed;
    const frozen=gs.paused||game.phoneState?.status==='talking';
    freezeSound(frozen);
    if(!frozen&&dt>0){
      if(state.mode==='reboot'){
        state.stageRemaining-=dt;
        while(state.mode==='reboot'&&state.stageRemaining<=0){const overdue=-state.stageRemaining;startStage(state.stageIndex+1);state.stageRemaining-=overdue;}
      }else if(state.mode==='usb'){
        state.usbRemaining-=dt;if(state.usbRemaining<=0)finishUSB();
      }else if(!state.adVisible && game.cameraOpen){
        state.adCountdown-=dt;
        if(state.adCountdown<=0)showAd();
      }
    }
    ui();requestAnimationFrame(step);
  }
  document.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key==='Escape')&&state.adVisible&&game.cameraOpen){
      // Escape always safely cancels, never blindly accepts a swapped button.
      if(e.key==='Escape'){dismiss(false);e.preventDefault();e.stopImmediatePropagation();}
    }
  },true);
  window.FNARTabletDebug={get status(){return {...state}},showAd,reboot,disconnectUSB,reset};
  updateLocalization();reset();requestAnimationFrame(step);
})();
