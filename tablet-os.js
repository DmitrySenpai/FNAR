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
      ["ВЫ ВЫИГРАЛИ!","Вы стали 47-м посетителем сайта! Получить бесплатный кулер для охранника?"],
      ["АНТИ-ПЕТУХ PRO","Новая защита от внезапных криков и перьев. Активировать пробную версию?"],
      ["СВЕРХСКОРОСТЬ","Ускорьте все девять камер в сто раз! Разрешить экспериментальную оптимизацию?"],
      ["ПРОВЕРКА СИСТЕМЫ","Обнаружено 47 подозрительных перьев. Удалить их автоматически?"],
      ["ПОДАРОК ДНЯ","Вам положен мешок элитного зерна. Подтвердить получение?"],
      ["ВАЖНОЕ ОБНОВЛЕНИЕ","Ваша версия Net Video устарела на 29 лет. Установить обновление?"],
      ["НОЧНОЙ БОНУС","Хотите получать двойную зарплату, не выходя из кресла? Подписаться?"],
      ["ОЧИСТКА ПАМЯТИ","Видеопамять переполнена кадрами куриц. Начать мгновенную очистку?"],
      ["АКЦИЯ: КОФЕ","Один бесплатный кофе за каждые шесть часов наблюдения. Забрать сейчас?"],
      ["СРОЧНОЕ СООБЩЕНИЕ","На вашем компьютере обнаружено критическое отсутствие печенья. Исправить?"],
      ["НАЙДЕН ВИРУС","Угроза Chicken.exe просит доступ к вашим камерам. Разрешить?"],
      ["ПОГОДА В ОФИСЕ","С вероятностью 99% сегодня ожидается дождь из перьев. Включить прогноз?"],
      ["NET SYSTEM PLUS","Дополнительная камера для наблюдения за самим охранником. Подключить?"],
      ["БЕЗОПАСНАЯ НОЧЬ","Автоматический помощник обещает закрывать двери за вас. Установить?"],
      ["СЧАСТЛИВЫЙ НОМЕР","Ваш монитор выбран для участия в лотерее «Золотой гребень». Принять участие?"],
      ["СИСТЕМНЫЙ СОВЕТ","Рекомендуем отключить лишние фонарики для экономии энергии. Применить?"],
      ["ОФИСНЫЕ НОВОСТИ","Всем сотрудникам разрешено смотреть камеры с закрытыми глазами. Подробнее?"],
      ["РАСШИРЕНИЕ БРАУЗЕРА","Переводчик языка петухов доступен бесплатно. Установить расширение?"],
      ["ПРЕМИУМ-ПОДПИСКА","Уберите рекламу навсегда всего за 250 долларов в неделю. Оформить?"],
      ["ЦИФРОВАЯ УБОРКА","В папке «Корзина» найдены 128 виртуальных скорлупок. Очистить?"],
      ["СЕКРЕТНОЕ ПРЕДЛОЖЕНИЕ","Защитите офис при помощи инновационной шапочки из фольги. Заказать?"],
      ["ЗАПРОС ДОСТУПА","Приложение Rooster Assistant хочет управлять вашим USB-хабом. Разрешить?"],
      ["ОБНАРУЖЕН ПРИНТЕР","Ваш принтер печатает загадочные следы лап. Запустить диагностику?"],
      ["НЕТ СОЕДИНЕНИЯ?","Наш мастер восстановит интернет за три хлопка крыльями. Вызвать мастера?"],
      ["ПОДТВЕРДИТЕ ВОЗРАСТ","Для просмотра опасных куриных мемов подтвердите, что вам уже 18 лет."],
      ["ОФИСНЫЙ РАДАР","Выявлено необычное движение в коридоре. Запустить платный анализ?"],
      ["ПЕРСОНАЛЬНАЯ СКИДКА","Только сегодня: 90% на годовой запас батареек. Получить купон?"],
      ["РОЗЫГРЫШ СРЕДИ ОХРАННИКОВ","Приз — выходной после седьмой смены. Подать заявку?"]
    ]
  };
  const ja={
    windowTitle:'Net System — お知らせ',accept:'承諾',cancel:'キャンセル',
    usbHeader:'カメラに接続できません',usbBody:'すべてのカメラが使用できません。カメラの切り替えは可能です。USBの再接続を待機中…',
    shutdown:'シャットダウンしています…',biosTitle:'NET SYSTEM BIOS v3.0',biosText:'メモリのチェック... OK\nデバイスの確認... OK\nDoor XP を起動中...',
    welcome:'ようこそ',booting:'システムを起動中…',startVideo:'Net Video 3.0 を起動中…',
    ads:[
      ["当選のお知らせ","あなたは本日47番目の訪問者です！警備員用の冷水機を無料で受け取りますか？"],
      ["ANTI-ROOSTER PRO","突然の鳴き声や羽から守る最新サービス。お試し版を有効にしますか？"],
      ["超高速モード","9台の監視カメラを100倍高速化！実験的な最適化を許可しますか？"],
      ["システム検査","不審な羽を47枚検出しました。自動的に削除しますか？"],
      ["本日のプレゼント","高級飼料を一袋プレゼント！今すぐ受け取りますか？"],
      ["重要な更新","Net Videoは29年間更新されていません。今すぐ更新しますか？"],
      ["夜勤ボーナス","椅子に座ったまま給料が2倍になるサービスに登録しますか？"],
      ["メモリの最適化","監視映像のニワトリでメモリがいっぱいです。今すぐ整理しますか？"],
      ["コーヒー特典","監視6時間につきコーヒー1杯無料！今すぐ受け取りますか？"],
      ["緊急通知","コンピューターにクッキーが足りません。問題を修復しますか？"],
      ["ウイルスを検出","Chicken.exeがカメラへのアクセスを要求しています。許可しますか？"],
      ["オフィスの天気","今夜は99％の確率で羽が降る見込みです。予報を表示しますか？"],
      ["NET SYSTEM PLUS","警備員自身を監視する追加カメラを接続しますか？"],
      ["安全な夜","AIが自動的にドアを閉めます。今すぐインストールしますか？"],
      ["ラッキーナンバー","「黄金のトサカ」抽選会への参加権を獲得しました。応募しますか？"],
      ["システムのおすすめ","節電のために余分なライトを消しますか？"],
      ["オフィスニュース","全社員が目を閉じたままカメラを見られるようになりました。詳細を見る？"],
      ["ブラウザー拡張機能","ニワトリ語の翻訳ツールが無料で使えます。インストールしますか？"],
      ["プレミアム会員","広告を永久に非表示！週250ドルで申し込みますか？"],
      ["デジタル清掃","ごみ箱から仮想の卵殻を128個検出しました。削除しますか？"],
      ["極秘セール","アルミホイル製の帽子でオフィスを守りましょう。注文しますか？"],
      ["アクセス許可","Rooster AssistantがUSBハブの操作を要求しています。許可しますか？"],
      ["プリンターを検出","プリンターが謎の足跡を印刷しています。診断しますか？"],
      ["接続できませんか？","羽ばたき3回でインターネットを修復！技術者を呼びますか？"],
      ["年齢確認","危険なニワトリのミームを見るには18歳以上であることを確認してください。"],
      ["オフィスレーダー","廊下で不審な動きを検知しました。有料解析を開始しますか？"],
      ["あなただけの割引","本日限定！一年分の電池が90％オフ。クーポンを受け取りますか？"],
      ["警備員限定の抽選","景品は7日目の勤務後の休日です。応募しますか？"]
    ]
  };
  const FAULTS=window.FNAR_TABLET_FAULTS;
  if(!FAULTS)throw new Error('fnar-tablet-faults.js must load before tablet-os.js');
  const uiText={
    ru:{
      frozen:'WARNING: VIDEO FEED FROZEN',stale:'PLAYBACK DELAY DETECTED',signal:'NO SIGNAL',
      lag:'Видеосистема обрабатывает запрос…',
      crashTitle:'Net Video 3.0 — Application Error',
      crashBody:'Программа Net Video 3.0 обнаружила критическую ошибку и будет закрыта.',
      crashCode:'Код ошибки: 0xC0000005',close:'Закрыть',launch:'Запустить Net Video 3.0',
      audio:'NET SYSTEM — Воспроизведение рекламы',chickenTitle:'Chicken.exe — Установка завершена',
      chickenBody:'Поздравляем! Ваш компьютер теперь находится под защитой куриных технологий!',
      chickenWatch:'CHICKEN.EXE IS WATCHING YOU',chickenAlert:'Ваша куриная защита работает исправно!',
      chickenEgg:'Система обнаружила 47 куриных следов.',chickenUpdate:'Chicken.exe обновляет клюв…',
      chickenSystemTitle:'Chicken.exe — System Warning',
      chickenSystemBody:'Обнаружено несанкционированное перемещение перьев в оперативной памяти.'
    },
    ja:{
      frozen:'WARNING: VIDEO FEED FROZEN',stale:'PLAYBACK DELAY DETECTED',signal:'NO SIGNAL',
      lag:'映像システムが応答しています…',
      crashTitle:'Net Video 3.0 — アプリケーション エラー',
      crashBody:'Net Video 3.0で重大なエラーが発生したため終了します。',
      crashCode:'エラーコード: 0xC0000005',close:'閉じる',launch:'Net Video 3.0 を起動',
      audio:'NET SYSTEM — 広告を再生中',chickenTitle:'Chicken.exe — インストール完了',
      chickenBody:'おめでとうございます！お使いのPCはニワトリ技術によって保護されています！',
      chickenWatch:'CHICKEN.EXE IS WATCHING YOU',chickenAlert:'ニワトリの保護機能は正常に動作しています！',
      chickenEgg:'47個のニワトリの足跡を検出しました。',chickenUpdate:'Chicken.exeがクチバシを更新中…',
      chickenSystemTitle:'Chicken.exe — システム警告',
      chickenSystemBody:'メモリ内で許可されていない羽の移動が検出されました。'
    }
  };
  const faultText=()=>uiText[lang()];
  const safeRead=key=>{try{return localStorage.getItem(key)}catch(_){return null}};
  const lang=()=>document.documentElement.lang==='ja'||safeRead('kokhinhin_lang')==='ja'?'ja':'ru';
  const tr=()=>lang()==='ja'?ja:ru;
  const random=(a,b)=>a+Math.random()*(b-a);
  const choose=(a)=>a[Math.floor(Math.random()*a.length)];
  // The ad countdown is consumed only while CCTV is open and fully operational.
  function nextAdDelay(){return FAULTS.nextAdDelay(game.currentNight);}
  const media=name=>`assets/ui/tablet/${name}.webp${name==='boot'?'?v=049':''}`;
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
  const popupDialog=ad.querySelector('.tablet-popup-dialog');
  let lastAdIndex=-1;
  let adMoving=false;
  function placeAdWindow(){
    if(!state.adVisible || !game.cameraOpen || ad.classList.contains('hidden'))return;
    const containerWidth=ad.clientWidth,containerHeight=ad.clientHeight;
    if(!containerWidth||!containerHeight)return;
    const popupWidth=popupDialog.offsetWidth,popupHeight=popupDialog.offsetHeight;
    const wiggle=adMoving?Math.min(16,containerWidth*.015,containerHeight*.03):0;
    const margin=8+wiggle;
    const xLow=popupWidth/2+margin,xHigh=containerWidth-popupWidth/2-margin;
    const yLow=popupHeight/2+margin,yHigh=containerHeight-popupHeight/2-margin;
    if(xHigh<=xLow || yHigh<=yLow)adMoving=false;
    const x=xHigh>xLow?random(xLow,xHigh):containerWidth/2;
    const y=yHigh>yLow?random(yLow,yHigh):containerHeight/2;
    popupDialog.style.setProperty('--ad-x',x+'px');
    popupDialog.style.setProperty('--ad-y',y+'px');
    popupDialog.style.setProperty('--ad-wiggle',wiggle+'px');
    popupDialog.style.setProperty('--ad-float-time',random(5,10).toFixed(2)+'s');
    popupDialog.classList.toggle('is-floating',adMoving);
  }
  window.addEventListener('resize',()=>{if(state.adVisible)requestAnimationFrame(placeAdWindow)});
  if(window.ResizeObserver)new ResizeObserver(()=>{if(state.adVisible)requestAnimationFrame(placeAdWindow)}).observe(tablet);
  // Independent camera-picture overlay: AI and real camera assets keep updating below it.
  const faultFrame=html('div','tablet-fault-frame hidden',feed);
  faultFrame.innerHTML='<span class="tablet-fault-label"></span><span class="tablet-fault-time"></span><span class="tablet-fault-spinner hidden">◌</span>';
  const faultLabel=faultFrame.querySelector('.tablet-fault-label');
  const faultTime=faultFrame.querySelector('.tablet-fault-time');
  const faultSpinner=faultFrame.querySelector('.tablet-fault-spinner');
  // Desktop for a failed Net Video process (this is only a simulated webpage window).
  const crash=html('div','tablet-crash-screen hidden',tablet);
  crash.innerHTML='<div class="tablet-crash-error"><div class="tablet-crash-title"></div><div class="tablet-crash-content"><span class="tablet-crash-symbol">×</span><div><p></p><small></small></div></div><button type="button" class="tablet-crash-dismiss"></button></div><button type="button" class="tablet-crash-shortcut hidden"><span>▣</span><strong>Net Video 3.0</strong></button><div class="tablet-crash-launch hidden"></div>';
  const errorTitle=crash.querySelector('.tablet-crash-title');
  const errorBody=crash.querySelector('.tablet-crash-content p');
  const errorCode=crash.querySelector('.tablet-crash-content small');
  const errorClose=crash.querySelector('.tablet-crash-dismiss');
  const relaunch=crash.querySelector('.tablet-crash-shortcut');
  const relaunchSplash=crash.querySelector('.tablet-crash-launch');
  const chickenLayer=html('div','tablet-chicken-layer hidden',tablet);
  chickenLayer.innerHTML='<div class="tablet-chicken-noise"></div><div class="tablet-chicken-effect"></div><div class="tablet-chicken-cursor hidden">🐓</div><div class="tablet-chicken-trails"></div>';
  const chickenEffect=chickenLayer.querySelector('.tablet-chicken-effect');
  const chickenCursor=chickenLayer.querySelector('.tablet-chicken-cursor');
  const chickenTrails=chickenLayer.querySelector('.tablet-chicken-trails');
  const chickenGhosts=Array.from({length:3},()=>html('span','tablet-chicken-cursor-ghost',chickenTrails));
  let cursorPoints=[];
  const imageHistory=[];
  let historyCurrent='',historyCamera=0,historyStart=0;
  const usb=html('div','tablet-usb-failure hidden',feed);
  usb.innerHTML=`<div class="tablet-usb-inner"><div class="tablet-usb-icon">▣</div><strong></strong><p></p></div>`;
  const usbHeading=usb.querySelector('strong'),usbBody=usb.querySelector('p');
  const activeAudio=new Set();
  const audioSound=(name,volume=.65,loop=false)=>{
    if(safeRead('kons-muted')==='1')return;
    const a=new Audio('assets/sound/'+name+'.mp3');
    a.preload='auto';a.volume=Math.min(.65,Math.max(0,volume));a.loop=loop;activeAudio.add(a);
    a.onended=()=>activeAudio.delete(a);a.onerror=()=>activeAudio.delete(a);
    a.play().catch(()=>activeAudio.delete(a));return a;
  };
  function stopSound(){for(const a of activeAudio){a.pause();try{a.currentTime=0}catch(_){}}activeAudio.clear();}
  let pausedAudio=false;
  function freezeSound(freeze){
    if(freeze===pausedAudio)return;pausedAudio=freeze;
    for(const a of activeAudio){if(freeze||safeRead('kons-muted')==='1')a.pause();else a.play().catch(()=>{});}
  }
  const rebootStages=[
    {id:'shutdown',sec:4,sound:'os_shutdown'},
    {id:'black',sec:1},
    {id:'bios',sec:1.45},
    {id:'boot',sec:2.4},
    {id:'welcome',sec:1.2,sound:'os_startup'},
    {id:'desktop',sec:1},
    {id:'netvideo',sec:2}
  ];
  const state={night:null,mode:'idle',adVisible:false,adCountdown:0,
    stageIndex:-1,stageRemaining:0,usbRemaining:0,shown:0,accepted:0,declined:0,
    faultRemaining:0,faultCamera:0,faultFrame:'',faultClock:0,
    pendingCamera:0,pendingDelay:0,crashStep:'error',
    chickenNext:0,chickenEffectSeconds:0,chickenType:'',chickenTypes:[],
    chickenIntensity:1.5,debugOverride:false,c3GraceUntil:0,
    cooldown:0,faultHistory:[]};
  const faultSoundNames=['os_balloon','beep','blip','os_info'];
  let spamAudio=null;
  function captureCameraHistory(){
    if(!game.cameraOpen||state.adVisible||!['idle','input_lag','audio_spam','chicken'].includes(state.mode))return;
    const cam=game.currentCamera,img=document.getElementById('cameraPicture');
    if(!img || img.classList.contains('hidden') || !img.complete || !img.naturalWidth)return;
    const src=img.currentSrc||img.src;
    if(!src)return;
    if(src!==historyCurrent || cam!==historyCamera){
      historyCurrent=src;historyCamera=cam;historyStart=game.state.nightElapsed;
      imageHistory.push({camera:cam,src,time:historyStart});
      if(imageHistory.length>75)imageHistory.splice(0,imageHistory.length-75);
    }
  }
  function selectedImage(){
    const img=document.getElementById('cameraPicture');
    return img && !img.classList.contains('hidden') ? (img.currentSrc||img.src) : '';
  }
  function stamp(t){
    return new Date(Math.max(0,t)*1000).toISOString().slice(14,19);
  }
  function setFrame(mode,src,camera){
    state.faultCamera=camera;
    state.faultFrame=src||'';
    state.faultClock=game.state.nightElapsed;
    faultFrame.className='tablet-fault-frame';
    faultFrame.classList.add('is-'+mode);
    faultFrame.style.backgroundImage=src?'url("'+src.replaceAll('"','%22')+'")':'none';
    faultLabel.textContent=mode==='signal_lost'?faultText().signal:mode==='stale'?faultText().stale:faultText().frozen;
    faultTime.textContent='CAM '+String(camera).padStart(2,'0')+'  '+stamp(state.faultClock);
    faultSpinner.classList.add('hidden');
  }
  const CHICKEN_EFFECTS=Object.freeze(['glitch','paw','cursor','shortcut','balloon','watched','all']);
  const CHICKEN_ERRORS=Object.freeze([
    'ERROR: CHICKEN OVERFLOW','ROOSTER ACCESS GRANTED',
    '47 SUSPICIOUS FEATHERS DETECTED','NET VIDEO MEMORY CORRUPTED',
    'CHICKEN.EXE IS WATCHING YOU'
  ]);
  // The whole effect is a non-interactive DOM layer; never move real buttons.
  function clearChicken(){
    chickenEffect.replaceChildren();
    cursorPoints=[];chickenCursor.classList.add('hidden');
    chickenLayer.classList.add('hidden');
    chickenLayer.classList.remove('is-cursor','is-paused');
    chickenTrails.classList.add('hidden');
    chickenGhosts.forEach(g=>{g.style.opacity='0';});
    tablet.style.removeProperty('cursor');
    state.chickenType='';state.chickenTypes=[];
  }
  const addChicken=(tag,cls,parent=chickenEffect)=>{
    const el=html(tag,cls,parent);return el;
  };
  function footPrint(parent,i,total){
    const mark=addChicken('span','tablet-chicken-print',parent);
    // Three forward toes and one rear toe, all drawn as a vector silhouette.
    mark.innerHTML='<svg viewBox="0 0 64 76" aria-hidden="true"><path d="M32 58 L32 37 M32 37 L9 14 M32 37 L32 6 M32 37 L55 14 M32 58 L20 71" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="32" cy="39" r="7" fill="currentColor"/></svg>';
    const x=Math.min(84,Math.max(10,16+i*9+random(-5,5)));
    const y=Math.min(77,Math.max(8,18+i*5+random(-7,7)));
    mark.style.left=x+'%';mark.style.top=y+'%';
    mark.style.setProperty('--foot-rotation',random(-36,36)+'deg');
    mark.style.setProperty('--foot-delay',(i*.16).toFixed(2)+'s');
    mark.style.setProperty('--foot-size',random(1.0,1.45).toFixed(2));
    return mark;
  }
  function chickenPaws(parent){
    const n=Math.min(8,Math.max(4,Math.round(random(4,8.99))));
    for(let i=0;i<n;i++)footPrint(parent,i,n);
  }
  function chickenGlitch(parent){
    const intensity=state.chickenIntensity;
    const group=addChicken('div','tablet-chicken-glitch-field',parent);
    const duration=random(.4,.9);
    group.style.setProperty('--glitch-duration',duration.toFixed(3)+'s');
    const n=Math.round(5+intensity*5);
    const image=selectedImage(); // reuse the existing image; never generate new bitmap data
    for(let i=0;i<n;i++){
      const band=addChicken('div','tablet-chicken-glitch-band',group);
      const w=random(30,Math.min(94,54+intensity*18));
      band.style.left=random(0,Math.max(0,100-w))+'%';
      band.style.width=w+'%';
      band.style.top=random(2,95)+'%';
      band.style.height=random(.9,2+intensity*5)+'%';
      band.style.setProperty('--band-shift',random(-26,26).toFixed(1)+'px');
      band.style.setProperty('--band-hue',Math.round(random(-65,65))+'deg');
      band.style.setProperty('--band-opacity',random(.45,.88).toFixed(2));
      if(i%3===0&&image)band.style.backgroundImage='url("'+image.replaceAll('"','%22')+'")';
    }
    const segments=Math.round(2+intensity*2);
    for(let i=0;i<segments;i++){
      const slice=addChicken('div','tablet-chicken-rgb-slice',group);
      const width=random(26,Math.min(90,42+intensity*18));
      slice.style.left=random(0,100-width)+'%';
      slice.style.width=width+'%';
      slice.style.top=random(3,91)+'%';
      slice.style.height=random(4,5+intensity*9)+'%';
      slice.style.setProperty('--rgb-offset',random(6,16)*intensity+'px');
      if(image)slice.style.backgroundImage='url("'+image.replaceAll('"','%22')+'")';
    }
    const blocks=Math.round(intensity*7);
    for(let i=0;i<blocks;i++){
      const pixel=addChicken('div','tablet-chicken-pixel',group);
      pixel.style.left=random(4,94)+'%';pixel.style.top=random(4,91)+'%';
      pixel.style.width=random(.6,3.8*intensity)+'%';
      pixel.style.height=random(1.1,5.5*intensity)+'%';
      pixel.style.opacity=random(.35,.82).toFixed(2);
    }
    const tear=addChicken('div','tablet-chicken-tear',group);
    tear.style.top=random(28,72)+'%';
    tear.style.setProperty('--tear-shift',random(-22,22)+'px');
    const corrupt=addChicken('div','tablet-chicken-corrupt',group);
    corrupt.textContent=choose(['N3T V!DEO 3.0','DOOR XP [ERR?R]','CHICKEN_OV3RFLOW','NET SYSTEM #?!']);
    corrupt.style.top=random(7,72)+'%';corrupt.style.left=random(7,26)+'%';
    for(let i=0;i<2;i++){
      const echo=addChicken('div','tablet-chicken-ghost-button',group);
      echo.textContent=choose(['CAM 08','CANCEL','NET VIDEO','OK']);
      echo.style.left=random(16,72)+'%';echo.style.top=random(20,74)+'%';
    }
    return group;
  }
  function chickenSystemNotice(parent){
    const panel=addChicken('div','tablet-chicken-error-window',parent);
    const title=addChicken('div','tablet-chicken-error-title',panel);
    title.textContent=faultText().chickenSystemTitle;
    const body=addChicken('div','tablet-chicken-error-body',panel);
    body.textContent=choose([faultText().chickenSystemBody,...CHICKEN_ERRORS,
      faultText().chickenAlert,faultText().chickenEgg]);
    panel.style.left=random(7,42)+'%';panel.style.top=random(12,58)+'%';
    return panel;
  }
  function renderChickenPart(type,parent){
    if(type==='glitch'){chickenGlitch(parent);return;}
    if(type==='paw'){chickenPaws(parent);return;}
    if(type==='cursor'){
      chickenCursor.classList.remove('hidden');
      chickenTrails.classList.remove('hidden');
      chickenLayer.classList.add('is-cursor');
      if(window.matchMedia?.('(pointer:fine)').matches)tablet.style.cursor='none';
      return;
    }
    if(type==='shortcut'){
      const item=addChicken('div','tablet-chicken-shortcut',parent);
      item.textContent='🐓  Chicken.exe';
    }else if(type==='balloon'){
      chickenSystemNotice(parent);
    }else if(type==='watched'){
      const item=addChicken('div','tablet-chicken-watch',parent);
      item.textContent=faultText().chickenWatch;
    }
  }
  function chickenVisual(requested='random'){
    if(state.mode!=='chicken')return false;
    if(requested!=='random'&&!CHICKEN_EFFECTS.includes(requested))return false;
    // Clear only the earlier visual wave; the infection and game clock continue.
    chickenEffect.replaceChildren();
    chickenCursor.classList.add('hidden');
    chickenTrails.classList.add('hidden');
    chickenLayer.classList.remove('is-cursor');
    cursorPoints=[];tablet.style.removeProperty('cursor');
    const main=requested==='all'?'glitch':
      requested==='random'?choose(['glitch','glitch','paw','balloon','shortcut','watched','cursor']):requested;
    let secondary=null;
    if(requested==='all')secondary='paw';
    else if(requested==='random'&&Math.random()<.65){
      const alternatives=['paw','balloon','cursor','watched','shortcut'].filter(x=>x!==main);
      secondary=choose(alternatives);
    }
    const parts=[main,...(secondary?[secondary]:[])];
    const primary=addChicken('div','tablet-chicken-primary');
    renderChickenPart(main,primary);
    if(secondary){
      const second=addChicken('div','tablet-chicken-secondary');
      renderChickenPart(secondary,second);
    }
    state.chickenType=main;state.chickenTypes=parts;
    state.chickenEffectSeconds=3;
    chickenLayer.classList.remove('hidden');
    return parts;
  }
  tablet.addEventListener('pointermove',e=>{
    if(state.mode!=='chicken'||!state.chickenTypes.includes('cursor'))return;
    const r=tablet.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    if(cursorPoints.length===0)cursorPoints=[{x,y},{x,y},{x,y}];
    else cursorPoints=[{x,y},...cursorPoints].slice(0,4);
    chickenCursor.style.left=x+'px';chickenCursor.style.top=y+'px';
    chickenGhosts.forEach((g,i)=>{
      const point=cursorPoints[i+1]||{x,y};
      g.textContent='🐓';g.style.left=point.x+'px';g.style.top=point.y+'px';
      g.style.opacity=String(.25/(i+1));
    });
  },{passive:true});
  // Input lag applies ONLY to CCTV selectors, never doors, lights or pause.
  tablet.addEventListener('click',e=>{
    if(state.mode!=='input_lag'||!game.cameraOpen||game.state.paused)return;
    const node=e.target.closest?.('.cam-node');
    if(!node||!tablet.contains(node))return;
    const number=Number(node.dataset.camera);
    if(!Number.isInteger(number)||number<1||number>9)return;
    e.preventDefault();e.stopImmediatePropagation();
    state.pendingCamera=number;
    state.pendingDelay=random(.3,.6); // overwrite the earlier request, never queue clicks
    faultSpinner.classList.remove('hidden');
    faultFrame.classList.remove('hidden');
  },true);
  errorClose.addEventListener('click',e=>{
    e.stopPropagation();
    if(game.state.paused||state.mode!=='crash'||state.crashStep!=='error')return;
    state.crashStep='desktop';
    errorClose.blur();ui();
  });
  relaunch.addEventListener('click',e=>{
    e.stopPropagation();
    if(game.state.paused||state.mode!=='crash'||state.crashStep!=='desktop')return;
    state.crashStep='launch';state.faultRemaining=random(2,3);ui();
  });
  let previousElapsed=null,previousActive=false,wallTime=performance.now();
  function updateLocalization(){
    usbHeading.textContent=tr().usbHeader;usbBody.textContent=tr().usbBody;
  }
  function reset(){
    state.mode='idle';state.adVisible=false;state.adCountdown=nextAdDelay();state.stageIndex=-1;
    state.stageRemaining=0;state.usbRemaining=0;state.faultRemaining=0;
    state.faultCamera=0;state.faultFrame='';state.pendingCamera=0;state.pendingDelay=0;
    state.c3GraceUntil=0;state.crashStep='error';state.chickenNext=0;state.chickenEffectSeconds=0;
    state.chickenIntensity=1.5;state.debugOverride=false;
    state.cooldown=0;state.faultHistory=[];imageHistory.length=0;historyCurrent='';historyCamera=0;
    previousElapsed=null;ad.classList.add('hidden');
    popupDialog.classList.remove('is-floating','is-paused');adMoving=false;
    os.classList.add('hidden');usb.classList.add('hidden');crash.classList.add('hidden');
    faultFrame.classList.add('hidden');clearChicken();
    stopSound();spamAudio=null;pausedAudio=false;
  }
  function displayStage(stage){
    os.dataset.phase=stage.id;
    pic.style.backgroundImage='none';splash.classList.add('hidden');
    title.textContent='';subtitle.textContent='';bios.querySelector('strong').textContent='';bios.querySelector('pre').textContent='';
    if(stage.id==='shutdown'){pic.style.backgroundImage=`url("${media('shutdown')}")`;title.textContent=tr().shutdown;}
    else if(stage.id==='bios'){bios.querySelector('strong').textContent=tr().biosTitle;bios.querySelector('pre').textContent=tr().biosText;}
    else if(stage.id==='boot'){pic.style.backgroundImage=`url("${media('boot')}")`;}
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
  function complete(){
    const previouslyBlocked=FAULTS.isCameraUnavailable(state.mode,8,state.faultCamera);
    if(previouslyBlocked)state.c3GraceUntil=game.state.nightElapsed+3;
    if(spamAudio){spamAudio.pause();spamAudio=null;}
    state.mode='idle';state.stageIndex=-1;state.faultRemaining=0;state.usbRemaining=0;
    state.pendingCamera=0;state.pendingDelay=0;state.crashStep='error';
    state.faultCamera=0;state.faultFrame='';state.chickenNext=0;
    state.adCountdown=nextAdDelay();state.cooldown=random(8,12);
    os.classList.add('hidden');usb.classList.add('hidden');
    crash.classList.add('hidden');faultFrame.classList.add('hidden');clearChicken();
    stopSound();
  }
  function reboot(){return triggerFault('reboot');}
  function disconnectUSB(duration){return triggerFault('usb',duration);}
  function finishUSB(){
    if(state.mode!=='usb')return;
    complete();audioSound('os_usb_connect',.40);
  }
  function triggerFault(mode,duration){
    const debug=Boolean(arguments[2]); // preserve the legacy two-argument signature
    if(!game.state.active || (game.currentNight<4&&!debug&&!state.debugOverride) ||
       !FAULTS.validFault(mode) || state.mode!=='idle')return false;
    if(debug)state.debugOverride=true;
    // Clear the previous ad sound; there is only one active fault at a time.
    state.adVisible=false;ad.classList.add('hidden');stopSound();
    state.mode=mode;state.faultRemaining=duration??FAULTS.faultDuration(mode);
    state.faultCamera=0;state.pendingCamera=0;state.pendingDelay=0;
    state.faultHistory.push(mode);
    if(mode==='reboot'){
      clearChicken();os.classList.remove('hidden');startStage(0);
    }else if(mode==='usb'){
      state.usbRemaining=duration??choose([3,5,2,7]);
      updateLocalization();usb.classList.remove('hidden');audioSound('os_usb_remove',.46);
    }else if(mode==='frozen'||mode==='stale'){
      const cam=game.currentCamera;
      const current=selectedImage()||[...imageHistory].reverse().find(v=>v.camera===cam)?.src||'';
      const old=imageHistory.filter(v=>v.camera===cam && v.time<=game.state.nightElapsed-1.4);
      const previous=old.length?old[old.length-1].src:'';
      // Fallback to a genuine frozen frame if there isn't a prior capture.
      const stale=mode==='stale'&&previous&&previous!==current;
      setFrame(stale?'stale':'frozen',stale?previous:current,cam);
    }else if(mode==='signal_lost'){
      const cam=1+Math.floor(Math.random()*9);
      setFrame('signal_lost','',cam);
    }else if(mode==='input_lag'){
      faultFrame.className='tablet-fault-frame is-lag';
      faultFrame.style.backgroundImage='none';
      faultLabel.textContent=faultText().lag;faultTime.textContent='';
      faultSpinner.classList.add('hidden');
    }else if(mode==='crash'){
      state.crashStep='error';
    }else if(mode==='audio_spam'){
      const sound=choose(faultSoundNames);
      spamAudio=audioSound(sound,.23,true);
    }else if(mode==='chicken'){
      state.chickenNext=random(1.1,1.7);
      clearChicken();chickenLayer.classList.remove('hidden');
      const welcome=addChicken('div','tablet-chicken-balloon');
      welcome.textContent=faultText().chickenTitle+' — '+faultText().chickenBody;
    }
    ui();return true;
  }
  function dismiss(accepted){
    if(!state.adVisible)return;
    state.adVisible=false;ad.classList.add('hidden');
    popupDialog.classList.remove('is-floating','is-paused');
    if(accepted){
      state.accepted++;
      triggerFault(FAULTS.weightedFault());
    }else{
      state.declined++;
      state.adCountdown=nextAdDelay();
    }
  }
  function showAd(options={}){
    const force=Boolean(options.force);
    if(!game.state.active || (game.currentNight<4&&!force&&!state.debugOverride) ||
       state.mode!=='idle'||state.adVisible)return false;
    const adTexts=tr().ads;
    const specified=Object.prototype.hasOwnProperty.call(options,'index');
    if(specified && (!Number.isInteger(options.index) || options.index<0 || options.index>=adTexts.length)){
      console.warn('[FNAR Tablet] Invalid advertising index:',options.index,'expected 0–'+(adTexts.length-1));
      return false;
    }
    state.adVisible=true;state.shown++;
    let index=specified?options.index:Math.floor(Math.random()*adTexts.length);
    if(!specified && adTexts.length>1 && index===lastAdIndex)
      index=(index+1+Math.floor(Math.random()*(adTexts.length-1)))%adTexts.length;
    lastAdIndex=index;
    const [h,txt]=adTexts[index];
    popupHeading.textContent=tr().windowTitle;popupTitle.textContent=h;popupText.textContent=txt;
    adMoving=Math.random()<.5;
    popupDialog.classList.remove('is-floating','is-paused');
    buttons.replaceChildren();
    const order=Math.random()<.5?['accept','cancel']:['cancel','accept'];
    order.forEach(kind=>{
      const button=document.createElement('button');button.type='button';button.textContent=tr()[kind];button.className='tablet-popup-action '+kind;
      button.addEventListener('click',e=>{e.stopPropagation();dismiss(kind==='accept');});buttons.appendChild(button);
    });
    audioSound('os_info');
    ad.classList.toggle('hidden',!game.cameraOpen);
    if(game.cameraOpen)requestAnimationFrame(placeAdWindow);
    return true;
  }
  function ui(){
    const canShow=game.state.active&&game.cameraOpen&&
      (game.currentNight>=4||state.debugOverride);
    ad.classList.toggle('hidden',!canShow||!state.adVisible);
    os.classList.toggle('hidden',!canShow||state.mode!=='reboot');
    usb.classList.toggle('hidden',!canShow||state.mode!=='usb');
    const view=canShow&&(state.mode==='frozen'||state.mode==='stale'||state.mode==='signal_lost')&&
      game.currentCamera===state.faultCamera;
    const lag=canShow&&state.mode==='input_lag'&&state.pendingCamera>0;
    faultFrame.classList.toggle('hidden',!(view||lag));
    crash.classList.toggle('hidden',!canShow||state.mode!=='crash');
    if(canShow&&state.mode==='crash'){
      errorTitle.textContent=faultText().crashTitle;
      errorBody.textContent=faultText().crashBody;errorCode.textContent=faultText().crashCode;
      errorClose.textContent=faultText().close;relaunch.querySelector('strong').textContent=faultText().launch;
      crash.querySelector('.tablet-crash-error').classList.toggle('hidden',state.crashStep!=='error');
      relaunch.classList.toggle('hidden',state.crashStep!=='desktop');
      relaunchSplash.classList.toggle('hidden',state.crashStep!=='launch');
    }
    chickenLayer.classList.toggle('hidden',!canShow||state.mode!=='chicken');
  }
  function step(){
    const now=performance.now();wallTime=now;
    const gs=game.state;
    const active=gs.active&&(game.currentNight>=4||state.debugOverride);
    if(!active){
      if(previousActive||state.mode!=='idle'||state.adVisible)reset();
      previousActive=false;requestAnimationFrame(step);return;
    }
    if(!previousActive||state.night!==game.currentNight||
       (previousElapsed!==null&&gs.nightElapsed+1<previousElapsed)){
      reset();state.night=game.currentNight;previousElapsed=gs.nightElapsed;
    }
    previousActive=true;
    // Derive fault timers from exactly the same game clock the AI and electricity use.
    const dt=Math.max(0,gs.nightElapsed-(previousElapsed??gs.nightElapsed));
    previousElapsed=gs.nightElapsed;
    const frozen=gs.paused||game.phoneState?.status==='talking';
    freezeSound(frozen);
    if(spamAudio && !frozen && safeRead('kons-muted')==='1')spamAudio.pause();
    else if(spamAudio && !frozen && spamAudio.paused && safeRead('kons-muted')!=='1')spamAudio.play().catch(()=>{});
    popupDialog.classList.toggle('is-paused',frozen);
    chickenLayer.classList.toggle('is-paused',frozen);
    if(!frozen && dt>0){
      captureCameraHistory();
      if(state.mode==='reboot'){
        state.stageRemaining-=dt;
        while(state.mode==='reboot'&&state.stageRemaining<=0){
          const overdue=-state.stageRemaining;
          startStage(state.stageIndex+1);
          state.stageRemaining-=overdue;
        }
      }else if(state.mode==='usb'){
        state.usbRemaining-=dt;
        if(state.usbRemaining<=0)finishUSB();
      }else if(state.mode==='crash'){
        if(state.crashStep==='launch'){
          state.faultRemaining-=dt;
          if(state.faultRemaining<=0)complete();
        }
      }else if(state.mode!=='idle'){
        state.faultRemaining-=dt;
        if(state.mode==='input_lag'&&state.pendingCamera){
          state.pendingDelay-=dt;
          if(state.pendingDelay<=0){
            const target=state.pendingCamera;
            state.pendingCamera=0;state.pendingDelay=0;
            if(game.cameraOpen)game.chooseCamera(target);
          }
        }
        if(state.mode==='chicken'){
          state.chickenNext-=dt;state.chickenEffectSeconds-=dt;
          if(state.chickenNext<=0){
            chickenVisual();state.chickenNext=random(2,3);
          }
        }
        if(state.faultRemaining<=0)complete();
      }else if(!state.adVisible){
        state.cooldown=Math.max(0,state.cooldown-dt);
        if(game.cameraOpen && state.cooldown<=0){
          state.adCountdown-=dt;
          if(state.adCountdown<=0)showAd();
        }
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
  // Developer-only helpers never alter the underlying guard AI, clock, power or saves.
  function ensureDebugTablet(){
    if(!game.state.active){console.warn('[FNAR Tablet] Start a night before using debug commands.');return false;}
    if(game.state.paused||game.phoneState?.status==='talking'){
      console.warn('[FNAR Tablet] Resume the game/finish the telephone call before testing.');return false;
    }
    if(!game.cameraOpen)game.setCameraOpen(true);
    if(!game.cameraOpen){
      console.warn('[FNAR Tablet] CCTV could not be opened (possibly power outage).');return false;
    }
    state.debugOverride=true;
    // The first debug invocation on nights 1–3 must not be erased by the next RAF.
    state.night=game.currentNight;
    previousActive=true;previousElapsed=game.state.nightElapsed;
    return true;
  }
  function clearFault(){
    if(state.mode!=='idle')complete();
    state.adVisible=false;
    ad.classList.add('hidden');
    popupDialog.classList.remove('is-floating','is-paused');
    faultFrame.classList.add('hidden');
    crash.classList.add('hidden');usb.classList.add('hidden');os.classList.add('hidden');
    clearChicken();
    state.pendingCamera=0;state.pendingDelay=0;state.chickenNext=0;
    state.chickenEffectSeconds=0;state.faultRemaining=0;
    state.adCountdown=nextAdDelay();
    state.cooldown=random(8,12);
    stopSound();spamAudio=null;
    state.debugOverride=false;ui();
    return true;
  }
  function forceAd(options={}){
    if(!options||typeof options!=='object'||Array.isArray(options)){
      console.warn('[FNAR Tablet] forceAd expects {index?: number}.');return false;
    }
    if(Object.prototype.hasOwnProperty.call(options,'index') &&
      (!Number.isInteger(options.index)||options.index<0||options.index>=tr().ads.length)){
      console.warn('[FNAR Tablet] Advertising index must be 0–'+(tr().ads.length-1));return false;
    }
    if(!ensureDebugTablet())return false;
    if(state.adVisible)return false; // Never stack two advert windows.
    if(state.mode!=='idle')clearFault();
    state.debugOverride=true;
    const created=showAd({...options,force:true});
    ui();return created;
  }
  function forceChicken(options={}){
    if(!options||typeof options!=='object'||Array.isArray(options)){
      console.warn('[FNAR Tablet] forceChicken expects {duration?: number}.');return false;
    }
    let duration=options.duration??20;
    if(typeof duration!=='number'||!Number.isFinite(duration)||duration<1||duration>60){
      console.warn('[FNAR Tablet] Chicken duration must be between 1 and 60 seconds.');return false;
    }
    if(!ensureDebugTablet())return false;
    clearFault();
    state.debugOverride=true;
    if(!triggerFault('chicken',duration,true))return false;
    chickenVisual('all');state.chickenNext=random(2,3);
    ui();return true;
  }
  function forceChickenEffect(type){
    if(!CHICKEN_EFFECTS.includes(type)){
      console.warn('[FNAR Tablet] Invalid Chicken effect:',type,'valid:',CHICKEN_EFFECTS.join(', '));
      return false;
    }
    if(!ensureDebugTablet())return false;
    if(state.mode!=='chicken' && !forceChicken({duration:20}))return false;
    const shown=chickenVisual(type);
    state.chickenNext=random(2,3);
    ui();return shown;
  }
  function setChickenIntensity(value){
    if(typeof value!=='number'||!Number.isFinite(value)||value<.5||value>2){
      console.warn('[FNAR Tablet] Intensity must be a number from 0.5 to 2.0.');return false;
    }
    state.chickenIntensity=value;
    return value;
  }
  function help(){
    const commands=[
      'FNARTabletDebug.help()',
      'FNARTabletDebug.forceAd()',
      'FNARTabletDebug.forceAd({ index: 10 })',
      'FNARTabletDebug.forceChicken()',
      'FNARTabletDebug.forceChicken({ duration: 20 })',
      "FNARTabletDebug.forceChickenEffect('glitch')",
      "FNARTabletDebug.forceChickenEffect('paw')",
      "FNARTabletDebug.forceChickenEffect('cursor')",
      "FNARTabletDebug.forceChickenEffect('shortcut')",
      "FNARTabletDebug.forceChickenEffect('balloon')",
      "FNARTabletDebug.forceChickenEffect('watched')",
      "FNARTabletDebug.forceChickenEffect('all')",
      'FNARTabletDebug.setChickenIntensity(1.5)',
      'FNARTabletDebug.clearFault()',
      "FNARTabletDebug.triggerFault('frozen')",
      'FNARTabletDebug.showAd()',
      'FNARTabletDebug.reset()'
    ];
    console.info('[FNAR Tablet Debug]\n'+commands.join('\n'));
    return commands;
  }
  window.FNARTabletDebug={
    get status(){return {...state,camera08Unavailable:this.isCameraUnavailable(8)};},
    get weights(){return FAULTS.CHANCES;},
    showAd,reboot,disconnectUSB,triggerFault,reset,
    forceAd,forceChicken,forceChickenEffect,setChickenIntensity,clearFault,help,
    isCameraUnavailable(camera){
      return FAULTS.isCameraUnavailable(state.mode,camera,state.faultCamera);
    },
    canObserveCamera(camera){
      return game.cameraOpen && FAULTS.safeObservation(state.mode,camera,state.faultCamera,state.adVisible);
    },
    get c3Protected(){
      return this.isCameraUnavailable(8) || game.state.nightElapsed<state.c3GraceUntil;
    },
    get history(){return [...imageHistory];}
  };
  updateLocalization();reset();requestAnimationFrame(step);
})();
