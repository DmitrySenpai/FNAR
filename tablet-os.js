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
    {id:'boot',sec:2.4},
    {id:'welcome',sec:1.2,sound:'os_startup'},
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
    previousElapsed=null;ad.classList.add('hidden');popupDialog.classList.remove('is-floating','is-paused');adMoving=false;os.classList.add('hidden');usb.classList.add('hidden');stopSound();pausedAudio=false;
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
    state.adVisible=false;ad.classList.add('hidden');popupDialog.classList.remove('is-floating','is-paused');
    if(accepted){state.accepted++;if(Math.random()<.5)reboot();else disconnectUSB();}
    else {state.declined++;state.adCountdown=nextAdDelay();}
  }
  function showAd(){
    if(!game.state.active||game.currentNight<4||state.mode!=='idle'||state.adVisible)return false;
    state.adVisible=true;state.shown++;
    const adTexts=tr().ads;
    let index=Math.floor(Math.random()*adTexts.length);
    if(adTexts.length>1 && index===lastAdIndex)index=(index+1+Math.floor(Math.random()*(adTexts.length-1)))%adTexts.length;
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
    popupDialog.classList.toggle('is-paused',frozen);
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
