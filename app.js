(() => {
'use strict';
const $ = id => document.getElementById(id);
const stage = $('stage'), canvas = $('scene'), ctx2 = document.createElement('canvas').getContext('2d');
const drawCanvas = ctx2.canvas;
const names = [
  'main.png','corridor_left.png','corridor_right.png','corridor_l_left.png','corridor_l_right.png',
  'door_left.png','door_right.png','bt_door_left.png','bt_door_right.png','bt_light_left.png','bt_light_right.png',
  'left_c1.png','left_c4.png','right_c2.png','right_c3.png'
];
const src = f => window.KONS_EMBEDDED_ASSETS?.[f] || getCachedAssetURL('assets/room/'+f);
// Preload before the first night so all effects and camera frames are local when played.
const PRELOAD_CACHE_NAME='fnar-game-assets-v055'; // Managed by fnar-audio.js
const cachedAssetURLs=new Map();
function getCachedAssetURL(path){return cachedAssetURLs.get(path)||path;}
const PRELOAD_SOUND_NAMES=["ambience","ambient_room","beep","blip","chimes","door","hang-up","knock-2","knock-3","knock","light","open-camera","os_balloon","os_info","os_shutdown","os_startup","os_usb_connect","os_usb_remove","phone-line","phone","phone_01","phone_02","phone_03","phone_04","phone_05","power-outage","running-fast","running","scream","static-bm"];
const PRELOAD_CAMERA_NAMES=["cam01.webp","cam01_c2.webp","cam02.webp","cam02_c4.webp","cam03.webp","cam03_c2.webp","cam03_c2_c3.webp","cam03_c3.webp","cam04.webp","cam04_c1.webp","cam04_c1_c4.webp","cam04_c4.webp","cam05.webp","cam05_c1.webp","cam05_c4.webp","cam05_c4_c1.webp","cam06.webp","cam06_c1.webp","cam06_c1_c4.webp","cam06_c4.webp","cam07.webp","cam07_c1.webp","cam07_c1_c4.webp","cam07_c4.webp","cam08.webp","cam08_c2.webp","cam08_c2_c3.webp","cam08_c3.webp","cam09.webp","cam09_c2.webp","cam09_c2_c3.webp","cam09_c3.webp"];
let preloadBusy=false;
function preloadProgress(completed,total){
  const percentage=total?Math.floor(completed*100/total):100;
  $('preloadProgressFill').style.width=percentage+'%';
  $('preloadProgress').setAttribute('aria-valuenow',String(percentage));
  $('preloadStatus').textContent=t('preloadStatus',{n:completed,total,percent:percentage});
}
async function preloadAllGameAssets(){
  if(preloadBusy || window.__KONS_VIEW_READY)return;
  window.AudioManager?.unlock();
  preloadBusy=true;
  $('preloadRetry').classList.add('hidden');
  $('preloadScreen').classList.remove('hidden');
  const paths=[...names.map(n=>'assets/room/'+n),
    ...PRELOAD_CAMERA_NAMES.map(n=>'assets/cameras/'+n),
    ...PRELOAD_SOUND_NAMES.map(n=>'assets/sound/'+n+'.mp3'),
    ...[1,2,3,4].map(n=>'assets/screamers/rooster_'+n+'_scream.webm'),
    'assets/sound/static-bm.webm', 'assets/menu/rooster_menu.webp', 'assets/ui/today_news.webp',
    ...[1,2,3,4].map(n=>'assets/ui/custom/c'+n+'.png'), 'assets/ui/director_signature.svg', 'assets/ui/tablet/shutdown.webp', 'assets/ui/tablet/desktop.webp', 'assets/ui/tablet/netvideo.webp', 'assets/ui/tablet/boot.webp'];
  let done=0;preloadProgress(done,paths.length);
  // file:// cannot use CacheStorage/fetch; standalone files embed their game art and audio.
  if(location.protocol==='file:'){
    staticVideo.src=staticVideoURL();setMenuBackdrop();setDocumentBackdrop();loadImages();preloadBusy=false;return;
  }
  let next=0;const failed=[],optionalAudioFailures=[];
  async function worker(){
    while(next<paths.length){
      const path=paths[next++];
      try{
        if(!cachedAssetURLs.has(path)){
          const completeURL=await window.AudioManager.getURL(path);
          cachedAssetURLs.set(path,completeURL);
          if(path.startsWith('assets/sound/')&&path.endsWith('.mp3')){
            const name=path.slice('assets/sound/'.length,-4);
            if(window.AudioManager.isShort(name)){
              try{await window.AudioManager.preload(name);}
              catch(error){console.warn('Web Audio decode unavailable, will use preloaded media:',name,error);}
            }
          }
        }
      }catch(error){
        // Broken visual and screamer assets must block startup. Optional sounds
        // are played by native browser audio using the original URL if necessary.
        if(path.startsWith('assets/sound/')&&path.endsWith('.mp3')){
          optionalAudioFailures.push(path);
          console.warn('Optional audio not cached:',path,error);
        }else{
          failed.push(path);console.warn('Critical asset failed:',path,error);
        }
      }
      done++;preloadProgress(done,paths.length);
    }
  }
  await Promise.all(Array.from({length:5},worker));
  if(optionalAudioFailures.length)console.warn('Audio fallback count:',optionalAudioFailures.length);
  preloadBusy=false;
  if(failed.length){
    $('preloadStatus').textContent=t('preloadError')+' ('+failed.length+')';
    $('preloadRetry').classList.remove('hidden');return;
  }
  staticVideo.src=staticVideoURL();
  setMenuBackdrop();
  setDocumentBackdrop();
  loadImages();
}
$('preloadRetry').addEventListener('click',preloadAllGameAssets);
function setMenuBackdrop(){
  const url=getCachedAssetURL('assets/menu/rooster_menu.webp');
  $('menuBackdrop').style.backgroundImage='linear-gradient(90deg,rgba(0,0,0,.74) 0%,rgba(0,0,0,.50) 30%,rgba(0,0,0,.07) 56%,rgba(0,0,0,0) 100%),url("'+url+'")';
}
function setDocumentBackdrop(){
  $('newspaperPaper').style.backgroundImage='url("'+getCachedAssetURL('assets/ui/today_news.webp')+'")';
}
function syncMenuStatic(){
  const el=$('menuStaticVideo');
  if($('welcome').classList.contains('hidden')){el.pause();return;}
  el.muted=true;el.loop=true;
  el.play().catch(()=>{}); // muted autoplay may still be limited by browser settings
}

const rects = {
  'light-left':  [48,361,145,468], 'door-left':  [48,448,145,552],
  'light-right': [1550,360,1647,466], 'door-right': [1550,444,1647,551],
  'phone': [508,512,632,606]
};
const labels = {'light-left':'leftLight','light-right':'rightLight','door-left':'leftDoorLabel','door-right':'rightDoorLabel','phone':'phoneLabel'};
const state={started:false,loaded:0,active:false,paused:false,night:1,yaw:0,target:0,angle:1,fish:.60,smooth:.70,
  leftDoor:false,rightDoor:false,leftLight:false,rightLight:false,leftDoorPos:0,rightDoorPos:0,
  dragging:false,dragX:0,dragY:0,dragYaw:0,dragMoved:false,leftKey:false,rightKey:false,
  qHeld:false,eHeld:false,pressAction:null,pressPointerId:null,last:performance.now(),frames:0,mobile:matchMedia('(pointer:coarse)').matches,
  doorTravelLeft:0,doorTravelRight:0,power:100,nightElapsed:0,gameOver:false};
const images = {};
const toastEl = $('toast');let toastTimer=null,gl=null,glProgram=null,texture=null,uYaw=null,uFish=null,glAvailable=false,ctxScreen=null,needsComposing=true;
function clamp(x,min,max){return Math.min(max,Math.max(min,x));}
function safeStore(name,value){try{localStorage.setItem(name,value)}catch(_){}}
function safeRead(name){try{return localStorage.getItem(name)}catch(_){return null}}
// Cookie is canonical on http(s); local fallback is needed for file:// Standalone HTML.
function readSave(key){
  try{const entry=document.cookie.split('; ').find(x=>x.startsWith(encodeURIComponent(key)+'='));
    if(entry)return decodeURIComponent(entry.slice(entry.indexOf('=')+1));}catch(_){}
  return safeRead(key);
}
function writeSave(key,value){
  const v=String(value);
  try{document.cookie=encodeURIComponent(key)+'='+encodeURIComponent(v)+'; max-age=31536000; path=/; SameSite=Lax';}catch(_){}
  safeStore(key,v);
}
const L10N={
en:{audioVolume:'VOLUME',holdAction:'HOLD: {action}',pressAction:'PRESS: {action}',hoverHint:'Point at the door controls',imageLoadError:'Could not load {name}. Check the assets/room folder.',
  chooseLanguage:'SELECT LANGUAGE',languagePrompt:'Game Language',langRu:'Русский',langEn:'English',langJa:'日本語',
  warningHeading:'WARNING',warningBody:'This game contains sudden loud noises, jumpscares, flashing images and intense scenes. Keep your volume at a moderate level.',warningAccept:'I UNDERSTAND · CONTINUE',
  preloadTitle:'PREPARING GAME',preloadStatus:'Loading assets: {n} / {total} ({percent}%)',preloadRetry:'RETRY LOADING',preloadError:'Some resources could not be loaded. Check your connection and try again.',
  skipPhone:'SKIP CALL',skipConversation:'SKIP CONVERSATION',
  officeLabel:'OFFICE NAME',officePlaceholder:'My Office',start:'NEW GAME · NIGHT 1',continue:'CONTINUE · NIGHT {night}',loading:'Loading {n} / {total}',
  titleNight:'Night {night}',pause:'PAUSE',pauseTitle:'PAUSED',pauseResume:'RESUME GAME',pauseRestart:'RESTART NIGHT',pauseMenu:'MAIN MENU',pauseHint:'Press Esc or P to resume',
  winTitle:'6:00 AM',winText:'You survived Night {night}! The roosters never made it into the security office before dawn.',
  allNightsTitle:'ALL 7 NIGHTS COMPLETE',allNightsText:'You survived all seven night shifts. The office is still standing!',
  loseTitle:'GAME OVER',startNextDay:'START NEXT DAY',nextNight:'NEXT NIGHT · {night}',retryNight:'RETRY',backMenu:'MAIN MENU',
  doorDeath:'Rooster C{id} entered the security office through the {side} door.',leftDoor:'left',rightDoor:'right',
  outageDeath:'After the power went out, rooster C{id} reached the security office.',testDeath:'Test jumpscare: rooster C{id}.',
  ringing:'☎ INCOMING CALL / LINE OPEN',hangup:'HANG UP',
  settingsTitle:'View Settings',settingsAngle:'Turn Range',settingsFish:'Fisheye Effect',settingsSmooth:'Smoothing',settingsResume:'CONTINUE',
  settingsInstructions:'Look around: mouse, ← → or A / D. Doors: 1 / 2. Hold Q / E for lights. Cameras: C or the bottom button, then 1–9. Pause: Esc / P. Phone: click the lit handset when it rings.',
  cameras:'CAMERAS',mapTitle:'FACILITY / CAMERAS',power:'Power:',usage:'Usage:',camLive:'● LIVE',cameraEmpty:'NO CAMERA FEED',cameraDev:'AREA GRAPHICS UNDER DEVELOPMENT',
  camNames:['North Area','Corridor','Right Corridor','Reception','Open Space','Left Corridor','Left Exit',"Director's Office",'Right Exit'],
  leftLight:'Left Light',rightLight:'Right Light',leftDoorLabel:'Left Door',rightDoorLabel:'Right Door',phoneLabel:'Desk Phone',
  openCamera:'Open security cameras',closeCamera:'Close security cameras',
  mute:'Mute sound',unmute:'Unmute sound',viewCenter:'LOOK STRAIGHT AHEAD',viewLeft:'LOOK LEFT',viewRight:'LOOK RIGHT',
  newspaperHeadline:'{office} urgently seeks a night guard',newspaperShift:'Working hours: midnight to 6:00 AM.',newspaperDuty:'Duties: monitor the office during the night.',newspaperPay:'Pay: 250 dollars per week.',
  nightSelectTitle:'NIGHT SELECTION',night6:'NIGHT 6',night:'Night {night}',custom:'CUSTOM NIGHT',startNight:'START',
  customDifficulty:'(0–2) EASY   (3–6) MED   (7–12) HARD   (13–20) EXTREME',
  back:'BACK',locked:'LOCKED',aiLevel:'AI: {level}',payrollTitle:'SALARY PAYMENT NOTICE',
  bonusTitle:'ADDITIONAL PAYMENT NOTICE',dismissalTitle:'NOTICE OF TERMINATION',
  company:'Company: {office}',signature:'Company Management / Signature: __________',overtime:'OVERTIME SHIFT',dismissed:'TERMINATED'
 },
 ru:{audioVolume:'ГРОМКОСТЬ',holdAction:'УДЕРЖИВАТЬ: {action}',pressAction:'НАЖАТЬ: {action}',hoverHint:'Наведите курсор на кнопки у дверей',imageLoadError:'Ошибка загрузки {name}. Проверьте папку assets/room.',chooseLanguage:'ВЫБЕРИТЕ ЯЗЫК',languagePrompt:'Язык игры',langRu:'Русский',langEn:'English',langJa:'日本語',
  warningHeading:'ПРЕДУПРЕЖДЕНИЕ',warningBody:'В игре присутствуют внезапные громкие звуки, скримеры, мигающие изображения и напряжённые сцены. Рекомендуется умеренная громкость.',warningAccept:'ПОНИМАЮ · ПРОДОЛЖИТЬ',preloadTitle:'ПОДГОТОВКА ИГРЫ',preloadStatus:'Загрузка ресурсов: {n} / {total} ({percent}%)',preloadRetry:'ПОВТОРИТЬ ЗАГРУЗКУ',preloadError:'Не удалось загрузить ресурсы. Проверьте интернет и повторите попытку.',skipPhone:'ПРОПУСТИТЬ ЗВОНОК',skipConversation:'ПРОПУСТИТЬ РАЗГОВОР',
  officeLabel:'НАЗВАНИЕ ОФИСА',officePlaceholder:'Мой офис',start:'НОВАЯ ИГРА · НОЧЬ 1',continue:'ПРОДОЛЖИТЬ · НОЧЬ {night}',loading:'Загрузка {n} / {total}',
  titleNight:'Ночь {night}',pause:'ПАУЗА',pauseTitle:'ПАУЗА',pauseResume:'ВЕРНУТЬСЯ В ИГРУ',pauseRestart:'ПЕРЕЗАПУСТИТЬ НОЧЬ',pauseMenu:'В ГЛАВНОЕ МЕНЮ',pauseHint:'Esc или P — продолжить',
  winTitle:'6:00 AM',winText:'Вы пережили ночь {night}! До рассвета петухи не смогли попасть в комнату охраны.',
  allNightsTitle:'ВСЕ 7 НОЧЕЙ ПРОЙДЕНЫ',allNightsText:'Все семь ночных смен пройдены. Офис выжил!',
  loseTitle:'НОЧЬ ОКОНЧЕНА',startNextDay:'НАЧАТЬ СЛЕДУЮЩИЙ ДЕНЬ',nextNight:'СЛЕДУЮЩАЯ НОЧЬ · {night}',retryNight:'ПОВТОРИТЬ',backMenu:'ГЛАВНОЕ МЕНЮ',
  doorDeath:'Петух C{id} проник в комнату охраны через {side} дверь.',leftDoor:'левую',rightDoor:'правую',
  outageDeath:'После отключения электричества петух C{id} добрался до комнаты охраны.',testDeath:'Тестовый скример петуха C{id}.',
  ringing:'☎ ВХОДЯЩИЙ ЗВОНОК / ЛИНИЯ ОТКРЫТА',hangup:'ПОЛОЖИТЬ ТРУБКУ',
  settingsTitle:'Настройки обзора',settingsAngle:'Амплитуда поворота',settingsFish:'«Рыбий глаз»',settingsSmooth:'Плавность',settingsResume:'ПРОДОЛЖИТЬ',
  settingsInstructions:'Поворот: мышь, стрелки ← → или A / D. Двери: 1 / 2. Свет: удерживайте Q / E. Камеры: C или нижняя кнопка, переключение 1–9. Пауза: Esc / P. Телефон: клик по подсвеченному аппарату во время звонка.',
  cameras:'КАМЕРЫ',mapTitle:'ОБЪЕКТ / КАМЕРЫ',power:'Энергия:',usage:'Расход:',camLive:'● LIVE',cameraEmpty:'ИЗОБРАЖЕНИЕ НЕ ПОДКЛЮЧЕНО',cameraDev:'ГРАФИКА ПОМЕЩЕНИЯ В РАЗРАБОТКЕ',
  camNames:['Северная','Коридор','Правый коридор','Ресепшен','Опен-спейс','Левый коридор','Левый выход','Кабинет директора','Правый выход'],
  leftLight:'Свет слева',rightLight:'Свет справа',leftDoorLabel:'Дверь слева',rightDoorLabel:'Дверь справа',phoneLabel:'Телефон на столе',
  openCamera:'Открыть камеры наблюдения',closeCamera:'Закрыть камеры наблюдения',
  mute:'Выключить звук',unmute:'Включить звук',viewCenter:'ВЗГЛЯД ПО ЦЕНТРУ',viewLeft:'СМОТРИТЕ ВЛЕВО',viewRight:'СМОТРИТЕ ВПРАВО',newspaperHeadline:'{office} срочно ищет ночного охранника',newspaperShift:'График работы: с 00:00 до 06:00.',newspaperDuty:'Обязанности: наблюдение за офисом в ночное время.',newspaperPay:'Зарплата: 250 долларов в неделю.',nightSelectTitle:'ВЫБОР НОЧИ',night6:'6 НОЧЬ',night:'Ночь {night}',custom:'CUSTOM',startNight:'НАЧАТЬ',customDifficulty:'(0–2) EASY   (3–6) MED   (7–12) HARD   (13–20) EXTREME',back:'НАЗАД',locked:'ЗАБЛОКИРОВАНО',aiLevel:'AI: {level}',payrollTitle:'УВЕДОМЛЕНИЕ О ВЫПЛАТЕ ЗАРАБОТНОЙ ПЛАТЫ',bonusTitle:'УВЕДОМЛЕНИЕ О ДОПОЛНИТЕЛЬНОЙ ВЫПЛАТЕ',dismissalTitle:'УВЕДОМЛЕНИЕ ОБ УВОЛЬНЕНИИ',company:'Компания: {office}',signature:'Администрация компании  /  Подпись: __________',overtime:'СВЕРХУРОЧНАЯ СМЕНА',dismissed:'УВОЛЕН'},
 ja:{audioVolume:'音量',holdAction:'長押し：{action}',pressAction:'押す：{action}',hoverHint:'ドアのボタンにカーソルを合わせてください',imageLoadError:'{name} の読み込みに失敗しました。assets/room を確認してください。',chooseLanguage:'言語を選択',languagePrompt:'ゲームの言語',langRu:'Русский',langEn:'English',langJa:'日本語',
  warningHeading:'ご注意',warningBody:'このゲームには突然の大きな音、ジャンプスケア、点滅する映像、恐怖を感じる場面が含まれています。音量を控えめにしてプレイしてください。',warningAccept:'確認しました · 続ける',preloadTitle:'ゲームデータを準備中',preloadStatus:'データ読み込み: {n} / {total} ({percent}%)',preloadRetry:'再試行',preloadError:'データの読み込みに失敗しました。通信を確認して再試行してください。',skipPhone:'着信を無視',skipConversation:'通話をスキップ',
  officeLabel:'オフィス名',officePlaceholder:'私のオフィス',start:'ニューゲーム · 第1夜',continue:'続きから · 第{night}夜',loading:'読み込み中 {n} / {total}',
  titleNight:'第{night}夜',pause:'一時停止',pauseTitle:'一時停止',pauseResume:'ゲームを再開',pauseRestart:'この夜をやり直す',pauseMenu:'メインメニューへ',pauseHint:'Esc または P で再開',
  winTitle:'午前6:00',winText:'第{night}夜を生き延びました！ 夜明けまでニワトリの侵入を阻止しました。',
  allNightsTitle:'全7夜クリア',allNightsText:'7夜すべての勤務を生き延びました。オフィスは無事です！',
  loseTitle:'ゲームオーバー',startNextDay:'次の日を始める',nextNight:'次の夜 · 第{night}夜',retryNight:'リトライ',backMenu:'メインメニューへ',
  doorDeath:'ニワトリC{id}が{side}ドアから警備室に侵入しました。',leftDoor:'左',rightDoor:'右',
  outageDeath:'停電後、ニワトリC{id}が警備室に到達しました。',testDeath:'ニワトリC{id}のジャンプスケアテスト。',
  ringing:'☎ 着信 / 通話中',hangup:'電話を切る',
  settingsTitle:'視点設定',settingsAngle:'回転範囲',settingsFish:'魚眼効果',settingsSmooth:'滑らかさ',settingsResume:'続ける',
  settingsInstructions:'視点操作：マウス、← → または A / D。ドア：1 / 2。ライト：Q / E を長押し。カメラ：C または下部ボタン、1～9で切替。一時停止：Esc / P。着信中は机の光る電話をクリックしてください。',
  cameras:'カメラ',mapTitle:'施設 / カメラ',power:'残り電力:',usage:'使用量:',camLive:'● 接続中',cameraEmpty:'映像を受信できません',cameraDev:'カメラ映像は準備中です',
  camNames:['北エリア','廊下','右の廊下','受付','オープンスペース','左の廊下','左の出口','社長室','右の出口'],
  leftLight:'左のライト',rightLight:'右のライト',leftDoorLabel:'左のドア',rightDoorLabel:'右のドア',phoneLabel:'机の電話',
  openCamera:'監視カメラを開く',closeCamera:'監視カメラを閉じる',
  mute:'消音',unmute:'音声をオン',viewCenter:'正面',viewLeft:'左を見る',viewRight:'右を見る',newspaperHeadline:'{office} が夜勤警備員を緊急募集',newspaperShift:'勤務時間: 00:00 から 06:00。',newspaperDuty:'業務内容: 夜間のオフィス監視。',newspaperPay:'給与: 週 250 ドル。',nightSelectTitle:'夜の選択',night6:'第6夜',night:'第{night}夜',custom:'カスタム',startNight:'開始',customDifficulty:'(0–2) やさしい   (3–6) 普通   (7–12) 難しい   (13–20) 最高難度',back:'戻る',locked:'ロック中',aiLevel:'AI: {level}',payrollTitle:'給与支払通知書',bonusTitle:'追加手当支給通知書',dismissalTitle:'解雇通知書',company:'会社名：{office}',signature:'会社管理部  /  署名：__________',overtime:'時間外勤務',dismissed:'解雇'}
};
let gameLanguage='ru',currentNight=1,unlockedNight=Math.max(1,Math.min(7,Number(readSave('kokhinhin_unlocked'))||1));
let sevenNightsComplete=readSave('kokhinhin_complete')==='1';
let customCompleted=sevenNightsComplete||readSave('kokhinhin_custom_complete')==='1';
if(customCompleted)unlockedNight=Math.max(7,unlockedNight);
let customMaxCompleted=readSave('kokhinhin_custom_20202020')==='1';
const EXTRA_SHIFT_PAY=50; // USD: adjust overtime pay here without changing the documents.
function readCustomAI(){
  try{const levels=JSON.parse(readSave('kokhinhin_custom_ai')||'null');
    return window.FNAR_AI.normalizeAILevels(levels);}catch(_){return [10,10,10,10];}
}
let customAI=readCustomAI();
function t(key,vars={}){
  let val=L10N[gameLanguage]?.[key]??L10N.ru[key]??key;
  return String(val).replace(/\{(\w+)\}/g,(_,k)=>String(vars[k]??''));
}
function updateSaveProgress(){
  writeSave('kokhinhin_unlocked',unlockedNight);
  writeSave('kokhinhin_complete',sevenNightsComplete?'1':'0');
  writeSave('kokhinhin_custom_complete',customCompleted?'1':'0');
  writeSave('kokhinhin_custom_20202020',customMaxCompleted?'1':'0');
  updateContinueButton();
}
function updateContinueButton(){
  const ready=state.loaded===names.length;
  const b=$('continueBtn');
  b.disabled=!ready||unlockedNight<=1;
  b.textContent=t('continue').replace(/\s*[·・]\s*(?:НОЧЬ|NIGHT|第).*$/i,'').trim();
  const night6=$('night6Btn'),custom=$('customBtn');
  night6.classList.toggle('hidden',unlockedNight<6);
  night6.disabled=!ready||unlockedNight<6;
  night6.textContent=t('night6');
  custom.classList.toggle('hidden',unlockedNight<6);
  custom.disabled=!ready||unlockedNight<7;
  custom.textContent=t('custom')+(unlockedNight<7?' · '+t('locked'):'')+(customMaxCompleted?' ★':'');
}
function canStartNight(night){
  if(!Number.isInteger(night)||night<1||night>7)return false;
  return night===1||(night<=5&&unlockedNight>=night)||(night>=6&&unlockedNight>=night);
}
function closeNightMenus(){
  $('nightSelectScreen').classList.add('hidden');
  $('customScreen').classList.add('hidden');
}
function showNightSelect(){
  if(state.active)return;
  closeNightMenus();
  const list=$('nightSelectList');list.replaceChildren();
  for(let night=2;night<=5;night++){
    const button=document.createElement('button');
    button.type='button';button.className='secondary-action';
    button.disabled=night>unlockedNight||state.loaded!==names.length;
    button.textContent=t('night',{night})+(night>unlockedNight?' · '+t('locked'):'');
    button.addEventListener('click',()=>{if(canStartNight(night))transitionToNight(night);});
    list.appendChild(button);
  }
  $('nightSelectScreen').classList.remove('hidden');
}
// Build portraits once per visit. Changing AI updates only the number and arrows.
function renderCustomAI(){
  const grid=$('customAIGrid');grid.replaceChildren();
  customAI.forEach((initial,i)=>{
    const cell=document.createElement('div');cell.className='custom-ai-row';
    const picture=document.createElement('img');picture.className='custom-ai-portrait';
    picture.src=getCachedAssetURL('assets/ui/custom/c'+(i+1)+'.png');picture.alt='';picture.draggable=false;
    const label=document.createElement('span');label.className='custom-ai-label';label.textContent='A.I. Level';
    const controls=document.createElement('div');controls.className='custom-ai-controls';
    const down=document.createElement('button');down.type='button';down.textContent='◀';
    down.setAttribute('aria-label','C'+(i+1)+' −');
    const value=document.createElement('output');value.className='custom-ai-value';
    value.setAttribute('aria-label','C'+(i+1)+' AI');
    const up=document.createElement('button');up.type='button';up.textContent='▶';
    up.setAttribute('aria-label','C'+(i+1)+' +');
    const update=()=>{
      value.textContent=String(customAI[i]);
      down.disabled=customAI[i]===0;up.disabled=customAI[i]===20;
    };
    for(const [button,delta] of [[down,-1],[up,1]])button.addEventListener('click',()=>{
      customAI[i]=clamp(customAI[i]+delta,0,20);
      writeSave('kokhinhin_custom_ai',JSON.stringify(customAI));
      update();
    });
    update();controls.append(down,value,up);
    cell.append(picture,label,controls);grid.appendChild(cell);
  });
}
function showCustomNight(debugPreview=false){
  if(state.active)return;
  closeNightMenus();
  if(unlockedNight<7&&!debugPreview)return;
  renderCustomAI();$('customScreen').classList.remove('hidden');
}
$('nightSelectBack').addEventListener('click',closeNightMenus);
$('customBack').addEventListener('click',closeNightMenus);
$('customStart').addEventListener('click',()=>{if(canStartNight(7))transitionToNight(7);});
$('night6Btn').addEventListener('click',()=>{if(canStartNight(6))transitionToNight(6);});
$('customBtn').addEventListener('click',()=>showCustomNight());


// A single guarded fade controller for all main scene changes.
// Gameplay is prepared under full black and activated only after fade-in.
const screenTransition=$('screenTransition');
let transitionBusy=false;
const prefersReducedTransitions=window.matchMedia('(prefers-reduced-motion: reduce)');
function fadeScreen(toBlack,milliseconds){
  return new Promise(resolve=>{
    const duration=prefersReducedTransitions.matches?0:milliseconds;
    let settled=false,timer=null;
    const onEnd=event=>{
      if(event.target===screenTransition&&event.propertyName==='opacity')finish();
    };
    const finish=()=>{
      if(settled)return;
      settled=true;
      if(timer!==null)clearTimeout(timer);
      screenTransition.removeEventListener('transitionend',onEnd);
      resolve();
    };
    screenTransition.addEventListener('transitionend',onEnd);
    screenTransition.style.transitionDuration=duration+'ms';
    void screenTransition.offsetWidth;
    screenTransition.style.opacity=toBlack?'1':'0';
    if(duration===0){finish();return;}
    // Fallback for hidden tabs, interrupted CSS transitions and browser quirks.
    timer=setTimeout(finish,duration+120);
  });
}
async function sceneTransition(swapScene,{activateNight=false}={}){
  if(transitionBusy)return false;
  transitionBusy=true;
  const priorPause=state.paused,priorActive=state.active;
  if(state.active){state.paused=true;clearHeldActions();atmosphere.clear();AUDIO_SETTINGS.stopAtmosphere();window.AudioManager.setPaused(true);}
  screenTransition.classList.add('is-transitioning');
  let successful=false;
  try{
    await fadeScreen(true,700);
    const result=await swapScene();
    if(result===false)throw new Error('Screen preparation was rejected');
    await fadeScreen(false,800);
    if(activateNight){
      state.active=true;state.paused=false;state.last=performance.now();AUDIO_SETTINGS.pauseAtmosphere(false);window.AudioManager.setPaused(false);
      startAudioLoop('ambient_room',.18);startAudioLoop('ambience',.065);
    }
    successful=true;
    return true;
  }catch(error){
    console.error('FNAR screen transition failed',error);
    try{goMenuInstant();}catch(_){}
    return false;
  }finally{
    if(!successful)await fadeScreen(false,800);
    if(priorActive&&state.active&&!activateNight)state.paused=priorPause;
    screenTransition.classList.remove('is-transitioning');
    screenTransition.style.opacity='0';transitionBusy=false;
  }
}
function transitionToNight(night,{intro=false,fromNewspaper=false}={}){
  window.AudioManager.unlock();
  if(transitionBusy||state.loaded!==names.length||!canStartNight(Number(night)))return false;
  return sceneTransition(()=>{
    if(intro){showNewspaperIntro(night);return true;}
    if(fromNewspaper)clearNewspaperIntro();
    return start(night,{force:true,deferActive:true,suppressIntro:true});
  },{activateNight:!intro});
}

const NEWSPAPER_SHOW_MS=5000,NEWSPAPER_FADE_MS=900;
let newspaperStartTimer=null,newspaperHideTimer=null,newspaperWelcomeTimer=null;
function officeNameValue(){
  return $('officeInput').value.trim().slice(0,44)||(gameLanguage==='ja'?'私のオフィス':gameLanguage==='en'?'My Office':'Мой офис');
}
function persistOfficeName(){
  const office=officeNameValue();
  $('officeInput').value=office;
  writeSave('kokhinhin_office',office);safeStore('kons-new-office',office);
  return office;
}
function clearNewspaperIntro(){
  if(newspaperStartTimer!==null){clearTimeout(newspaperStartTimer);newspaperStartTimer=null;}
  if(newspaperHideTimer!==null){clearTimeout(newspaperHideTimer);newspaperHideTimer=null;}
  if(newspaperWelcomeTimer!==null){clearTimeout(newspaperWelcomeTimer);newspaperWelcomeTimer=null;}
  const scr=$('newspaperIntro');
  scr.classList.add('hidden');
  scr.classList.remove('is-visible','is-leaving');
}
function fillNewspaperIntro(){
  const office=persistOfficeName();
  $('newspaperHeadline').textContent=t('newspaperHeadline',{office});
  $('newspaperShift').textContent=t('newspaperShift');
  $('newspaperDuty').textContent=t('newspaperDuty');
  $('newspaperPay').textContent=t('newspaperPay');
}
// Scale the newspaper as one unchanging layout, instead of responsively
// reflowing the article over the underlying image at every viewport size.
function updateNewspaperScale(){
  const paper=$('newspaperPaper');
  if(!paper)return;
  const w=stage.clientWidth, h=stage.clientHeight;
  if(!w||!h)return;
  const scale=Math.min((w*.92)/1007,(h*.92)/854);
  paper.style.setProperty('--newspaper-scale',String(scale));
}
function showNewspaperIntro(night){
  clearNewspaperIntro();
  fillNewspaperIntro();
  updateNewspaperScale();
  const scr=$('newspaperIntro');
  // Keep the menu visible underneath until the newspaper fully fades in.
  // This prevents the security room canvas from flashing for one frame.
  scr.classList.remove('hidden');
  void scr.offsetWidth;
  scr.classList.add('is-visible');
  newspaperWelcomeTimer=setTimeout(()=>{
    newspaperWelcomeTimer=null;
    $('welcome').classList.add('hidden');
    syncMenuStatic();
  },NEWSPAPER_FADE_MS+80);
  newspaperStartTimer=setTimeout(()=>{
    newspaperStartTimer=null;
    transitionToNight(night,{fromNewspaper:true});
  },NEWSPAPER_SHOW_MS);
}
function applyTranslations(){
  document.documentElement.lang=gameLanguage;
  document.querySelectorAll('[data-i18n]').forEach(node=>{node.textContent=t(node.dataset.i18n);});
  $('officeInput').placeholder=t('officePlaceholder');
  $('startBtn').textContent=t('start');
  updateContinueButton();
  if(!$('nightSelectScreen').classList.contains('hidden'))showNightSelect();
  if(!$('customScreen').classList.contains('hidden'))renderCustomAI();
  $('loadingStatus').textContent=state.loaded===names.length?'':t('loading',{n:state.loaded,total:names.length});
  $('cameraNightLabel').textContent=t('titleNight',{night:currentNight});
  if(typeof updateMuteUI==='function')updateMuteUI();
  if(typeof updateStatus==='function')updateStatus();
  if(typeof chooseCamera==='function')chooseCamera(currentCamera);
  if(typeof updatePauseButton==='function')updatePauseButton();
  if(typeof updatePhoneUI==='function')updatePhoneUI();
  if(typeof updateAudioSettingsUI==='function')updateAudioSettingsUI();
}
function chooseLanguage(lang){
  gameLanguage=['ru','en','ja'].includes(lang)?lang:'ru';writeSave('kokhinhin_lang',gameLanguage);
  applyTranslations();$('languageScreen').classList.add('hidden');$('warningScreen').classList.remove('hidden');
}
$('languageRu').addEventListener('click',()=>chooseLanguage('ru'));
$('languageJa').addEventListener('click',()=>chooseLanguage('ja'));
$('languageEn').addEventListener('click',()=>chooseLanguage('en'));
$('warningAccept').addEventListener('click',()=>{AUDIO_SETTINGS.unlockAtmosphere();$('warningScreen').classList.add('hidden');$('preloadScreen').classList.remove('hidden');preloadAllGameAssets();});

// Audio: original supplied MP3 effects, all optional if browser audio is blocked.
const SOUND_PATH='assets/sound/';
const soundURL=name=>window.KONS_EMBEDDED_SOUNDS?.[name] ||
  ((window.KONS_STANDALONE || location.protocol==='file:') && /^phone_\d\d$/.test(name)
    ? 'https://dmitrysenpai.github.io/FNAR/assets/sound/'+name+'.mp3'
    : getCachedAssetURL(SOUND_PATH+name+'.mp3'));
const screamerURL=id=>window.KONS_EMBEDDED_SCREAMERS?.[id]||getCachedAssetURL('assets/screamers/rooster_'+id+'_scream.webm');
const staticVideoURL=()=>window.KONS_EMBEDDED_STATIC_VIDEO||getCachedAssetURL('assets/sound/static-bm.webm');
const AUDIO_SETTINGS=window.FNAR_AUDIO_SETTINGS;
if(!AUDIO_SETTINGS)throw new Error('fnar-audio-settings.js must load before app.js');
window.FNAR_SOUND_URL=soundURL; // Tablet reuses preloaded blob URLs; no duplicate MP3 fetch.
const audioLoops=new Map();
let soundMuted=safeRead('kons-muted')==='1';
let phoneRingAudio=null,phoneVoiceAudio=null,deathStaticAudio=null;
const activeOneShots=new Set();
function updateMuteUI(){
  const b=$('muteBtn');b.textContent=soundMuted?'🔇':'🔊';
  b.title=(soundMuted?t('unmute'):t('mute'))+' (M)';
  b.setAttribute('aria-label',b.title);
  for(const a of audioLoops.values())a.muted=soundMuted;
  if(phoneRingAudio)phoneRingAudio.muted=soundMuted;
  if(phoneVoiceAudio)phoneVoiceAudio.muted=soundMuted;
  if(deathStaticAudio)deathStaticAudio.muted=soundMuted;
  for(const a of activeOneShots)a.muted=soundMuted;
  AUDIO_SETTINGS.setMuted(soundMuted);
  window.AudioManager.setMuted(soundMuted);
}
function playSfx(name,volume=.45){
  if(soundMuted)return;
  try{
    // Predecoded sounds use AudioBuffers; the manager supplies a safe media
    // fallback if Web Audio or a particular buffer is unavailable.
    const a=window.AudioManager.play(name,volume,{url:soundURL(name)});
    if(!a)return null;
    activeOneShots.add(a);
    const cleanup=()=>{activeOneShots.delete(a);window.AudioManager.release(a);};
    a.onended=cleanup;a.onerror=cleanup;
    return a;
  }catch(error){console.warn('SFX error:',name,error);return null;}
}
function startAudioLoop(name,volume=.15){
  let a=audioLoops.get(name);
  if(!a){a=new Audio(soundURL(name));a.loop=true;a.preload='auto';audioLoops.set(name,a);}
  AUDIO_SETTINGS.register(a,['ambience','ambient_room','light'].includes(name)?'ambience':name==='phone-line'?'phone':'effects',volume);
  a.play().catch(()=>{});
}
function stopAudioLoop(name){const a=audioLoops.get(name);if(a){a.pause();a.currentTime=0;}}
function stopAudioLoops(){for(const name of audioLoops.keys())stopAudioLoop(name);}
function toggleMute(){soundMuted=!soundMuted;safeStore('kons-muted',soundMuted?'1':'0');updateMuteUI();}
$('muteBtn').addEventListener('click',toggleMute);updateMuteUI();
// A single always-visible master control in the pause menu.
function updateAudioSettingsUI(){
  const value=AUDIO_SETTINGS.get().master;
  const slider=$('audioVolumeMaster');
  slider.value=String(value);
  $('audioVolumeMasterValue').textContent=value+'%';
  slider.setAttribute('aria-valuetext',value+'%');
}
$('audioVolumeMaster').addEventListener('input',event=>{
  AUDIO_SETTINGS.set('master',event.currentTarget.value);
});
AUDIO_SETTINGS.subscribe(updateAudioSettingsUI);
updateAudioSettingsUI();
const ATMOSPHERE=window.FNAR_ATMOSPHERE;
if(!ATMOSPHERE)throw new Error('fnar-atmosphere.js must load before app.js');
const atmosphereView=ATMOSPHERE.createRenderer({
  office:$('atmosphereOffice'),camera:$('atmosphereCamera'),audio:AUDIO_SETTINGS,
  reducedMotion:()=>window.matchMedia('(prefers-reduced-motion:reduce)').matches
});
const atmosphere=ATMOSPHERE.createSystem({
  onStart:atmosphereView.onStart,onFrame:atmosphereView.onFrame,onEnd:atmosphereView.onEnd
});
function atmosphereContext(){
  const tablet=window.FNARTabletDebug?.status;
  return {
    active:state.active,paused:state.paused,
    phone:phoneState.status==='talking',
    jumpscare:!$('jumpscare').classList.contains('hidden'),
    victory:state.gameOver||!$('victoryScreen').classList.contains('hidden'),
    blackout:powerFailure.active,
    tabletBusy:Boolean(tablet&&(tablet.mode!=='idle'||tablet.adVisible)),
    danger:ENEMIES.some(e=>e.phase===AI.PHASES.DOOR||e.phase===AI.PHASES.RUSH||
      (e.phase===AI.PHASES.APPROACH&&e.step>=e.route.length-2)),
    cameraOpen,camera:currentCamera
  };
}
window.FNARAtmosphereDebug=Object.freeze({
  status:()=>atmosphere.status(),
  trigger:type=>atmosphere.trigger(type,atmosphereContext()),
  clear:()=>atmosphere.clear()
});

// Transparent VP9 WebM is composited directly over the live office scene.
const jumpOverlay=$('jumpscare'),jumpVideo=$('jumpscareVideo');
let jumpTimer=0,jumpEpoch=0;
const deathStatic=$('deathStatic'),staticVideo=$('staticVideo');
staticVideo.muted=true;staticVideo.loop=true;
function clearDeathStaticAudio(){
  if(deathStaticAudio){window.AudioManager.release(deathStaticAudio);deathStaticAudio=null;}
}
function resetJumpscare(){
  ++jumpEpoch;clearTimeout(jumpTimer);clearDeathStaticAudio();
  jumpVideo.pause();jumpVideo.onended=null;jumpVideo.onerror=null;
  jumpVideo.removeAttribute('src');jumpVideo.load();
  jumpOverlay.classList.add('hidden');jumpOverlay.setAttribute('aria-hidden','true');
  staticVideo.pause();try{staticVideo.currentTime=0;}catch(_){}
  deathStatic.classList.add('hidden');deathStatic.setAttribute('aria-hidden','true');
}
function playJumpscare(id,onComplete){
  const epoch=++jumpEpoch;
  jumpOverlay.classList.remove('hidden');jumpOverlay.setAttribute('aria-hidden','false');
  deathStatic.classList.add('hidden');deathStatic.setAttribute('aria-hidden','true');
  jumpVideo.pause();jumpVideo.src=screamerURL(id);jumpVideo.muted=true;
  try{jumpVideo.currentTime=0;}catch(_){}
  playSfx('scream',.84);
  let videoFinished=false;
  const afterVideo=()=>{
    if(videoFinished||epoch!==jumpEpoch)return;
    videoFinished=true;clearTimeout(jumpTimer);jumpVideo.pause();
    jumpOverlay.classList.add('hidden');jumpOverlay.setAttribute('aria-hidden','true');
    deathStatic.classList.remove('hidden');deathStatic.setAttribute('aria-hidden','false');
    // Keep the ACTUAL static-bm.webm playing behind the loss window until restart.
    staticVideo.muted=true;staticVideo.loop=true;
    try{staticVideo.currentTime=0;}catch(_){}
    staticVideo.play().catch(()=>{});
    // Separate short sound played ONCE, no loop; never use the WebM audio track.
    clearDeathStaticAudio();
    deathStaticAudio=playSfx('static-bm',.64)||null;
    jumpTimer=setTimeout(()=>{if(epoch===jumpEpoch)onComplete();},1500);
  };
  jumpVideo.onended=afterVideo;jumpVideo.onerror=afterVideo;
  jumpTimer=setTimeout(afterVideo,id===1?4900:4300);
  const p=jumpVideo.play();if(p?.catch)p.catch(afterVideo);
}

function alphaBounds(img){
  const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
  const cx=c.getContext('2d');cx.drawImage(img,0,0);const data=cx.getImageData(0,0,c.width,c.height).data;
  let minX=c.width,minY=c.height,maxX=-1,maxY=-1;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(data[(y*c.width+x)*4+3]>8){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
  return maxX<0?null:{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};
}
const lastName=readSave('kokhinhin_office')||safeRead('kons-new-office');if(lastName)$('officeInput').value=lastName;

function loadImages(){
  names.forEach(name=>{
    const img=new Image();images[name]=img;
    img.onload=()=>{
      state.loaded++;$('loadingStatus').textContent=t('loading',{n:state.loaded,total:names.length});
      if(state.loaded===names.length){
        drawCanvas.width=images['main.png'].naturalWidth;drawCanvas.height=images['main.png'].naturalHeight;
        const leftBounds=alphaBounds(images['door_left.png']);
        const rightBounds=alphaBounds(images['door_right.png']);
        state.doorTravelLeft=leftBounds?leftBounds.maxY+6:drawCanvas.height;
        state.doorTravelRight=rightBounds?rightBounds.maxY+6:drawCanvas.height;
        composite();$('startBtn').disabled=false;$('startBtn').textContent=t('start');
        $('loadingStatus').textContent='';updateContinueButton();
        window.__KONS_VIEW_READY=true;
        $('preloadScreen').classList.add('hidden');$('welcome').classList.remove('hidden');syncMenuStatic();
      }
    };
    img.onerror=()=>{$('loadingStatus').textContent=t('imageLoadError',{name});console.error('Image load failed',src(name));};
    img.src=src(name);
  });
}
function drawDoor(name,pos,travel){
  if(pos<=0.001)return;
  ctx2.save();
  ctx2.drawImage(images[name],0,-travel*(1-pos));
  ctx2.restore();
}
function composite(){
  if(state.loaded!==names.length)return;
  const w=drawCanvas.width,h=drawCanvas.height;
  ctx2.clearRect(0,0,w,h);
  ctx2.fillStyle='#060708';ctx2.fillRect(0,0,w,h);
  ctx2.drawImage(images[state.leftLight?'corridor_l_left.png':'corridor_left.png'],0,0);
  ctx2.drawImage(images[state.rightLight?'corridor_l_right.png':'corridor_right.png'],0,0);
  // Петухи у входов появляются только при удержании света и открытой двери.
  // Слои нарисованы в координатах оригинальной комнаты, позади стены и двери.
  if(state.leftLight && state.leftDoorPos<.93){
    const visible=ENEMIES.find(e=>e.side==='left' && e.step===e.route.length);
    if(visible)ctx2.drawImage(images['left_c'+visible.id+'.png'],0,0);
  }
  if(state.rightLight && state.rightDoorPos<.93){
    const visible=ENEMIES.find(e=>e.side==='right' && e.step===e.route.length);
    if(visible)ctx2.drawImage(images['right_c'+visible.id+'.png'],0,0);
  }
  // Двери физически находятся за основной стеной и дверными рамами.
  drawDoor('door_left.png',state.leftDoorPos,state.doorTravelLeft);
  drawDoor('door_right.png',state.rightDoorPos,state.doorTravelRight);
  ctx2.drawImage(images['main.png'],0,0);
  if(typeof phoneState!=='undefined' && phoneState.status==='ringing'){
    ctx2.save();
    const x=520,y=513,w=109,h=91,r=12;
    ctx2.beginPath();ctx2.moveTo(x+r,y);ctx2.lineTo(x+w-r,y);
    ctx2.quadraticCurveTo(x+w,y,x+w,y+r);ctx2.lineTo(x+w,y+h-r);
    ctx2.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx2.lineTo(x+r,y+h);
    ctx2.quadraticCurveTo(x,y+h,x,y+h-r);ctx2.lineTo(x,y+r);
    ctx2.quadraticCurveTo(x,y,x+r,y);ctx2.closePath();
    ctx2.strokeStyle='#fff0a0';ctx2.lineWidth=3;ctx2.shadowColor='#ffbc42';ctx2.shadowBlur=22;ctx2.stroke();
    ctx2.restore();
  }
  if(state.leftLight)ctx2.drawImage(images['bt_light_left.png'],0,0);
  if(state.rightLight)ctx2.drawImage(images['bt_light_right.png'],0,0);
  if(state.leftDoor)ctx2.drawImage(images['bt_door_left.png'],0,0);
  if(state.rightDoor)ctx2.drawImage(images['bt_door_right.png'],0,0);
  if(glAvailable){gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,drawCanvas);}
  needsComposing=false;
}
function initCanvas(){
  try{
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,stencil:false,depth:false,powerPreference:'low-power'});
    if(!gl)throw Error('WebGL not supported');
    const vs=`attribute vec2 xy;varying vec2 v;void main(){v=xy*.5+.5;gl_Position=vec4(xy,0.0,1.0);}`;
    const fs=`precision highp float;varying vec2 v;uniform sampler2D tex;uniform float yaw;uniform float fish;
    void main(){vec2 ndc=v*2.0-1.0;
    float warped=atan(ndc.x*1.45)/atan(1.45);
    float xp=mix(ndc.x,warped,fish);
    vec2 uv=vec2(.5+yaw*.16+xp*.36,.5+ndc.y*.36);
    uv=clamp(uv,vec2(.001),vec2(.999));
    vec3 c=texture2D(tex,uv).rgb;
    float corners=smoothstep(.56,1.3,length(ndc*vec2(.94,.86)));c*=1.0-corners*.11;
    gl_FragColor=vec4(c,1.0);}`;
    function sh(type,code){let s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const sv=sh(gl.VERTEX_SHADER,vs),sf=sh(gl.FRAGMENT_SHADER,fs);
    glProgram=gl.createProgram();gl.attachShader(glProgram,sv);gl.attachShader(glProgram,sf);gl.linkProgram(glProgram);
    if(!gl.getProgramParameter(glProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(glProgram));
    gl.deleteShader(sv);gl.deleteShader(sf);gl.useProgram(glProgram);
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(glProgram,'xy');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
    uYaw=gl.getUniformLocation(glProgram,'yaw');uFish=gl.getUniformLocation(glProgram,'fish');gl.uniform1i(gl.getUniformLocation(glProgram,'tex'),0);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    glAvailable=true;
  }catch(e){console.warn('Canvas2D fallback:',e);gl=null;ctxScreen=canvas.getContext('2d',{alpha:false});}
}
function resize(){
  const r=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(w<1||h<1)return;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;if(glAvailable)gl.viewport(0,0,w,h);}
}
function draw(){
  if(state.loaded!==names.length)return;
  if(needsComposing)composite();
  if(glAvailable){gl.useProgram(glProgram);gl.uniform1f(uYaw,state.yaw*state.angle);gl.uniform1f(uFish,state.fish);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
  else if(ctxScreen){
    const w=canvas.width,h=canvas.height;const sw=drawCanvas.width*.72,sh=drawCanvas.height*.72;
    const cx=drawCanvas.width*.5+state.yaw*state.angle*drawCanvas.width*.16;
    const sx=clamp(cx-sw*.5,0,drawCanvas.width-sw);
    ctxScreen.drawImage(drawCanvas,sx,drawCanvas.height*.14,sw,sh,0,0,w,h);
  }
  state.frames++;
}
function imagePos(clientX,clientY){
  const r=canvas.getBoundingClientRect(), px=clamp((clientX-r.left)/Math.max(1,r.width),0,1),py=clamp((clientY-r.top)/Math.max(1,r.height),0,1);
  const nx=px*2-1,warped=Math.atan(nx*1.45)/Math.atan(1.45);
  const x=.5+state.yaw*state.angle*.16+(nx*(1-state.fish)+warped*state.fish)*.36;
  const y=.5+(py*2-1)*.36;
  return [x*drawCanvas.width,y*drawCanvas.height];
}
function findHit(clientX,clientY){
  if(!drawCanvas.width)return null;
  const [x,y]=imagePos(clientX,clientY);
  if(typeof phoneState!=='undefined' && phoneState.status==='ringing'){
    const r=rects.phone;if(x>=r[0]&&x<=r[2]&&y>=r[1]&&y<=r[3])return 'phone';
  }
  for(const [act,rect] of Object.entries(rects))if(act!=='phone'&&x>=rect[0]&&x<=rect[2]&&y>=rect[1]&&y<=rect[3])return act;
  return null;
}
function updateStatus(){
  $('statusLeft').textContent=t('leftDoorLabel');
  $('statusRight').textContent=t('rightDoorLabel');
  updateOfficePower();
}
function powerControls(){
  return {cameraOpen,leftDoor:state.leftDoor,rightDoor:state.rightDoor,leftLight:state.leftLight,rightLight:state.rightLight};
}
function getPowerDrain(){return POWER.getPowerDrain(powerControls());}
function currentUsage(){return state.power<=0?0:POWER.getUsageLevel(powerControls());}
function updateOfficePower(){
  const power=Math.max(0,Math.ceil(state.power))+'%';
  $('officePowerValue').textContent=power;
  $('cameraPowerValue').textContent=power;
  for(const id of ['officeUsageBars','cameraUsageBars']){
    const bars=[...$(id).querySelectorAll('.bar')];
    bars.forEach((bar,i)=>bar.classList.toggle('on',i<currentUsage()));
  }
}
function showToast(message){ return; }
function setLight(side,on){
  if(on && (!state.active||state.paused||phoneState.status==='talking'||state.power<=0||powerFailure.active))return;
  const prop=side+'Light';
  if(state[prop]===on)return;
  state[prop]=on;
  if(state.leftLight||state.rightLight)startAudioLoop('light',.17);
  else stopAudioLoop('light');
  needsComposing=true;updateStatus();
}
function toggleDoor(side){
  if(!state.active || state.paused || phoneState.status==='talking' || state.power<=0 || powerFailure.active)return;
  const prop=side+'Door';state[prop]=!state[prop];playSfx('door',.52);needsComposing=true;updateStatus();showToast(`${side==='left'?'Левая':'Правая'} дверь: ${state[prop]?'закрывается':'открывается'}`);
}
function viewFromMouse(e){
  const r=canvas.getBoundingClientRect(),v=clamp(((e.clientX-r.left)/Math.max(1,r.width))*2-1,-1,1);
  state.target=Math.sign(v)*Math.pow(clamp((Math.abs(v)-.12)/.88,0,1),1.08);
}
function clearHeldActions(){
  if(state.leftLight)setLight('left',false);
  if(state.rightLight)setLight('right',false);
  state.qHeld=false;state.eHeld=false;state.pressAction=null;state.pressPointerId=null;
}

// Complete night: 9 cameras, 4 independently moving enemies, 2 defended entrances.
const CAMS = [
  ['Северная','cam01','45,57,63'],
  ['Коридор','cam02','48,59,68'],
  ['Правый коридор','cam03','46,56,64'],
  ['Ресепшен','cam04','55,56,55'],
  ['Опен-спейс','cam05','51,61,60'],
  ['Левый коридор','cam06','48,60,61'],
  ['Левый выход','cam07','39,48,52'],
  ['Кабинет директора','cam08','50,57,67'],
  ['Правый выход','cam09','47,51,64']
];
// Pure night and enemy tuning lives in fnar-ai.js; keep its array identity for debug.
const AI=window.FNAR_AI;
if(!AI)throw new Error('fnar-ai.js must load before app.js');
const POWER=window.FNAR_POWER;
if(!POWER || POWER.NIGHT_LENGTH!==AI.NIGHT_LENGTH)throw new Error('FNAR power config must load and agree with AI night duration');
const NIGHT_LENGTH=AI.NIGHT_LENGTH;
const NIGHT_CONFIG=AI.NIGHT_CONFIG;
const aiSession=AI.createNight(1);
const ENEMIES=aiSession.enemies;
const cameraScreen=$('cameraScreen'),cameraToggle=$('cameraToggle'),cameraFeed=$('cameraFeed');
const cameraNodes=[...document.querySelectorAll('.cam-node')];
const CAM_PICTURE=$('cameraPicture'),CAM_EMPTY=$('feedEmpty');
const cameraCache=new Map();const cameraUnavailable=new Set();
const CAMERA_VARIANTS=new Set(["cam01.webp", "cam01_c2.webp", "cam02.webp", "cam02_c4.webp", "cam03.webp", "cam03_c2.webp", "cam03_c2_c3.webp", "cam03_c3.webp", "cam04.webp", "cam04_c1.webp", "cam04_c1_c4.webp", "cam04_c4.webp", "cam05.webp", "cam05_c1.webp", "cam05_c4.webp", "cam05_c4_c1.webp", "cam06.webp", "cam06_c1.webp", "cam06_c1_c4.webp", "cam06_c4.webp", "cam07.webp", "cam07_c1.webp", "cam07_c1_c4.webp", "cam07_c4.webp", "cam08.webp", "cam08_c2.webp", "cam08_c2_c3.webp", "cam08_c3.webp", "cam09.webp", "cam09_c2.webp", "cam09_c2_c3.webp", "cam09_c3.webp"]);
let cameraOpen=false,currentCamera=1,cameraFlashTimer=0,shownCameraFile='';
function randomBetween(min,max){return min+Math.random()*(max-min);}
function resetEnemies(){
  AI.resetNight(aiSession,currentNight,undefined,currentNight===7?customAI:null);
  enemySoundLast.clear();
  shownCameraFile='';
}
function cameraImageURL(file){return window.KONS_EMBEDDED_CAMERAS?.[file] || getCachedAssetURL('assets/cameras/'+file);}
function cameraFile(){
  const code='cam'+String(currentCamera).padStart(2,'0');
  const current=AI.visibleIds(aiSession,currentCamera);
  const full=code+current.map(id=>'_c'+id).join('')+'.webp';
  if(CAMERA_VARIANTS.has(full))return full;
  // Original image set also has a few reversed-order combinations.
  const alt=code+[...current].reverse().map(id=>'_c'+id).join('')+'.webp';
  if(CAMERA_VARIANTS.has(alt))return alt;
  for(const id of current){
    const only=code+'_c'+id+'.webp';if(CAMERA_VARIANTS.has(only))return only;
  }
  return code+'.webp';
}
function showCameraFlash(){
 const el=$('cameraSwitchFlash');el.classList.remove('burst');void el.offsetWidth;el.classList.add('burst');
 clearTimeout(cameraFlashTimer);cameraFlashTimer=setTimeout(()=>el.classList.remove('burst'),240);
}
function updateCameraScene(){
  if(!state.loaded)return;
  const file=cameraFile();
  if(shownCameraFile===file)return;
  shownCameraFile=file;
  const setImg=()=>{
    CAM_PICTURE.src=cameraImageURL(file);
    CAM_PICTURE.classList.remove('hidden');CAM_EMPTY.classList.add('hidden');
  };
  if(cameraCache.has(file)){setImg();return;}
  CAM_PICTURE.classList.add('hidden');CAM_EMPTY.classList.remove('hidden');
  if(cameraUnavailable.has(file))return;
  const pending=new Image();
  pending.onload=()=>{cameraCache.set(file,true);if(shownCameraFile===file)setImg();};
  pending.onerror=()=>{cameraUnavailable.add(file);console.warn('Missing camera asset',file);};
  pending.src=cameraImageURL(file);
}
function chooseCamera(id){
 if(id<1||id>CAMS.length)return;
 const changed=currentCamera!==id;
 currentCamera=id;
 const [title,code,tint]=CAMS[id-1];
 $('cameraName').textContent=L10N[gameLanguage].camNames[id-1];$('cameraCode').textContent='CAM '+String(id).padStart(2,'0');
 cameraFeed.dataset.camera=String(id).padStart(2,'0');cameraFeed.style.setProperty('--feed-accent',tint);
 cameraNodes.forEach(b=>{const active=Number(b.dataset.camera)===id;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 updateCameraScene();
 if(cameraOpen && changed){showCameraFlash();playSfx('blip',.26);}
}
function setCameraOpen(open){
 if(!state.active || state.paused || phoneState.status==='talking' || powerFailure.active || !$('settings').classList.contains('hidden'))return;
 if(cameraOpen===open)return;
 cameraOpen=open;
 if(open){clearHeldActions();state.leftKey=false;state.rightKey=false;state.dragging=false;canvas.style.cursor='url("arrow.cur") 0 0, auto';}
 cameraScreen.classList.toggle('is-open',open);
 cameraScreen.setAttribute('aria-hidden',String(!open));
 cameraToggle.setAttribute('aria-expanded',String(open));
 cameraToggle.setAttribute('aria-label',open?t('closeCamera'):t('openCamera'));
 updateOfficePower();
 playSfx('open-camera',.37);
 if(open){updateCameraScene();showCameraFlash();}
 // CCTV picture interference is visual only; static-bm plays once after a jumpscare.
}
function toggleCamera(){setCameraOpen(!cameraOpen);}
function preloadFutureCameras(){
  // Only the 9 empty views are eagerly preloaded; variants load on demand.
  CAMS.forEach((cam,i)=>{
    const file='cam'+String(i+1).padStart(2,'0')+'.webp';
    const im=new Image();
    im.onload=()=>cameraCache.set(file,true);
    im.onerror=()=>cameraUnavailable.add(file);
    im.src=cameraImageURL(file);
  });
}
function updateClock(){
  const hour=Math.min(6,Math.floor(state.nightElapsed/60));
  const display=hour===0?'12 AM':hour+' AM';
  $('camClock').textContent=display;
  $('hudClock').textContent=display;
  $('cameraNightLabel').textContent=t('titleNight',{night:currentNight});
}
// During a call the game world is frozen, but voice/subtitle playback continues.
// Nights 1–5 use user-provided phone_01…phone_05.mp3 and bilingual transcripts.
// On nights 6–7 the phone never rings.
const PHONE_RING_SECONDS=13.35;
const phoneState={status:'idle',nextRingAt:7,ringEndsAt:0,dialogEndsAt:0,subtitleIndex:-1};
const phoneDialog=$('phoneDialog'),phoneSubtitle=$('phoneSubtitle');
let phoneEpoch=0;
let phoneParagraphs=[];
function updatePhoneUI(){
  phoneDialog.classList.toggle('hidden',phoneState.status!=='talking');
  const skip=$('skipPhoneBtn');
  const canSkip=phoneState.status==='ringing'||phoneState.status==='talking';
  skip.classList.toggle('hidden',!canSkip);skip.disabled=!canSkip;
  skip.textContent=t(phoneState.status==='talking'?'skipConversation':'skipPhone');
  skip.setAttribute('aria-label',skip.textContent);
  needsComposing=true;
}
function stopRingtone(){
  if(phoneRingAudio){phoneRingAudio.pause();phoneRingAudio.currentTime=0;
    phoneRingAudio.onended=null;phoneRingAudio.onerror=null;AUDIO_SETTINGS.forget(phoneRingAudio);phoneRingAudio=null;}
}
function stopPhoneVoice(){
  if(!phoneVoiceAudio)return;
  phoneVoiceAudio.onended=null;phoneVoiceAudio.onerror=null;
  phoneVoiceAudio.pause();try{phoneVoiceAudio.currentTime=0;}catch(_){ }
  pausedAudio.delete(phoneVoiceAudio);
  AUDIO_SETTINGS.forget(phoneVoiceAudio);
  phoneVoiceAudio=null;
}
function resetPhone(){
  ++phoneEpoch;stopRingtone();stopPhoneVoice();stopAudioLoop('phone-line');
  phoneState.status=currentNight>=6?'disabled':'idle';phoneState.nextRingAt=7;
  phoneState.ringEndsAt=0;phoneState.dialogEndsAt=0;phoneState.subtitleIndex=-1;
  phoneParagraphs=[];phoneSubtitle.textContent='';
  updatePhoneUI();
}
$('skipPhoneBtn').addEventListener('click',()=>{if(phoneState.status==='ringing')missPhone();else if(phoneState.status==='talking')hangUpPhone();});
function missPhone(){
  if(phoneState.status!=='ringing')return;
  stopRingtone();phoneState.status='missed';updatePhoneUI();
}
function startRinging(){
  if(!state.active||state.paused||currentNight>=6||powerFailure.active||phoneState.status!=='idle')return;
  const epoch=phoneEpoch;
  phoneState.status='ringing';phoneState.ringEndsAt=state.nightElapsed+PHONE_RING_SECONDS;
  updatePhoneUI();
  const audio=new Audio(soundURL('phone'));AUDIO_SETTINGS.register(audio,'phone',.52);
  audio.preload='auto';audio.loop=false;phoneRingAudio=audio;
  audio.onended=()=>{if(epoch===phoneEpoch)missPhone();};
  audio.play().catch(()=>{});
}
function currentPhoneParagraphs(){
  const all=window.KOKHINHIN_PHONE_TEXTS || {};
  const locale=all[gameLanguage] || all.ru || {};
  const paragraphs=locale[String(currentNight)] || ['...'];
  const office=readSave('kokhinhin_office') || $('officeInput').value.trim() || t('officePlaceholder');
  return paragraphs.map(line=>line.replace(/\[НАЗВАНИЕ ОФИСА\]/g,office));
}
function updatePhoneCaption(){
  if(phoneState.status!=='talking'||!phoneVoiceAudio)return;
  const duration=Number.isFinite(phoneVoiceAudio.duration)&&phoneVoiceAudio.duration>0?phoneVoiceAudio.duration:0;
  if(!duration)return;
  // Match complete transcript to the audio duration without inventing speech timestamps.
  // Keep English captions aligned with the original Russian audio's phrase pacing.
  // Timing follows currentTime/duration; no artificial English voice files are requested.
  const timingText=gameLanguage==='en'?(window.KOKHINHIN_PHONE_TEXTS?.ru?.[String(currentNight)]||phoneParagraphs):phoneParagraphs;
  const weights=phoneParagraphs.map((txt,i)=>Math.max(4,Array.from(timingText[Math.min(i,timingText.length-1)]||txt).length));
  const total=weights.reduce((a,b)=>a+b,0);
  const elapsed=Math.max(0,Math.min(duration-.001,phoneVoiceAudio.currentTime));
  const point=total*elapsed/duration;
  let count=0,i=0;
  for(;i<weights.length-1;i++){count+=weights[i];if(point<count)break;}
  if(i!==phoneState.subtitleIndex){phoneState.subtitleIndex=i;phoneSubtitle.textContent=phoneParagraphs[i] || '...';}
}
function answerPhone(){
  if(!state.active||state.paused||powerFailure.active||phoneState.status!=='ringing')return;
  if(state.nightElapsed>=phoneState.ringEndsAt){missPhone();return;}
  stopRingtone();
  phoneState.status='talking';phoneState.subtitleIndex=-1;
  AUDIO_SETTINGS.pauseAtmosphere(true);
  state.last=performance.now(); // No catch-up of world time while dialogue audio is playing.
  phoneParagraphs=currentPhoneParagraphs();
  phoneSubtitle.textContent=phoneParagraphs[0] || '...';
  phoneState.subtitleIndex=0;
  // Remove held inputs immediately: talking pauses power, AI and time.
  clearHeldActions();
  if(cameraOpen){
    cameraOpen=false;cameraScreen.classList.remove('is-open');
    cameraScreen.setAttribute('aria-hidden','true');cameraToggle.setAttribute('aria-expanded','false');
  }
  const epoch=phoneEpoch;
  const voice=new Audio(soundURL('phone_'+String(currentNight).padStart(2,'0')));
  phoneVoiceAudio=voice;voice.preload='auto';voice.loop=false;AUDIO_SETTINGS.register(voice,'phone',.88);
  voice.onended=()=>{if(phoneEpoch===epoch && phoneVoiceAudio===voice)hangUpPhone();};
  voice.onerror=()=>{if(phoneEpoch===epoch && phoneVoiceAudio===voice){
    console.warn('Phone audio unavailable:',voice.src);hangUpPhone();
  }};
  voice.play().catch(err=>{if(phoneEpoch===epoch && phoneVoiceAudio===voice){
    console.warn('Unable to play phone dialogue:',err);hangUpPhone();
  }});
  updatePhoneUI();
}
function hangUpPhone(){
  if(phoneState.status!=='talking')return;
  stopPhoneVoice();stopAudioLoop('phone-line');playSfx('hang-up',.24);
  phoneState.status='completed';AUDIO_SETTINGS.pauseAtmosphere(false);state.last=performance.now();updatePhoneUI();
}
function updatePhone(){
  if(!state.active||powerFailure.active||currentNight>=6)return;
  if(phoneState.status==='idle'&&state.nightElapsed>=phoneState.nextRingAt)startRinging();
  if(phoneState.status==='ringing'&&state.nightElapsed>=phoneState.ringEndsAt)missPhone();
}
updatePhoneUI();

// The electrical failure is NOT instant defeat: the clock keeps running.
// Sequence: running-fast (2.30s) -> 1s silence -> running (2.64s)
// -> random delay 1, 3, 2.5, 1.3 or 5 seconds -> nearest rooster attacks.
const BLACKOUT_WAIT=[1,3,2.5,1.3,5];
const FAST_STEP_DURATION=2.30,SLOW_STEP_DURATION=2.64;
const blackout=$('blackout');
const powerFailure={active:false,phase:'idle',phaseEndAt:0,attackerId:0,randomDelay:0,audio:null};
function stopPowerFailureAudio(){
  if(powerFailure.audio){powerFailure.audio.pause();powerFailure.audio.currentTime=0;powerFailure.audio=null;}
}
function resetPowerFailure(){
  stopPowerFailureAudio();powerFailure.active=false;powerFailure.phase='idle';
  powerFailure.phaseEndAt=0;powerFailure.attackerId=0;powerFailure.randomDelay=0;
  blackout.classList.add('hidden');blackout.setAttribute('aria-hidden','true');
}
function startPowerFailure(){
  if(!state.active||powerFailure.active)return;
  powerFailure.active=true;powerFailure.phase='outage';
  powerFailure.phaseEndAt=state.nightElapsed+6;
  // Pick the nearest rooster from the actual current route position.
  // A zero-level rooster must never become the scripted blackout attacker.
  const attackers=ENEMIES.filter(e=>!aiSession.customAI||aiSession.customAI[e.id-1]>0);
  const closest=attackers.sort((a,b)=>{
    const distanceA=Math.max(0,a.route.length-a.step);
    const distanceB=Math.max(0,b.route.length-b.step);
    return distanceA-distanceB || a.id-b.id;
  })[0];
  powerFailure.attackerId=closest?.id||0;
  powerFailure.randomDelay=BLACKOUT_WAIT[Math.floor(Math.random()*BLACKOUT_WAIT.length)];
  if(cameraOpen){cameraOpen=false;cameraScreen.classList.remove('is-open');cameraScreen.setAttribute('aria-hidden','true');cameraToggle.setAttribute('aria-expanded','false');}
  if(phoneState.status==='ringing')missPhone();
  if(phoneState.status==='talking')hangUpPhone();
  phoneState.status='missed';updatePhoneUI();
  state.leftLight=state.rightLight=false;
  state.leftDoor=state.rightDoor=false;
  state.leftDoorPos=state.rightDoorPos=0;
  needsComposing=true;
  cameraToggle.classList.add('hidden');
  stopAudioLoops();
  blackout.classList.remove('hidden');blackout.setAttribute('aria-hidden','false');
  powerFailure.audio=playSfx('power-outage',.78)||null;
  updateStatus();
}
function updatePowerFailure(){
  if(!powerFailure.active||!state.active)return;
  // Use absolute game timestamps so a slow frame never delays the victory clock.
  while(powerFailure.active && state.nightElapsed>=powerFailure.phaseEndAt){
    const boundary=powerFailure.phaseEndAt;
    stopPowerFailureAudio();
    if(powerFailure.phase==='outage'){
      powerFailure.phase='fast';powerFailure.phaseEndAt=boundary+FAST_STEP_DURATION;
      powerFailure.audio=playSfx('running-fast',.78)||null;
    }else if(powerFailure.phase==='fast'){
      powerFailure.phase='pause';powerFailure.phaseEndAt=boundary+1;
    }else if(powerFailure.phase==='pause'){
      powerFailure.phase='slow';powerFailure.phaseEndAt=boundary+SLOW_STEP_DURATION;
      powerFailure.audio=playSfx('running',.70)||null;
    }else if(powerFailure.phase==='slow'){
      powerFailure.phase='wait';powerFailure.phaseEndAt=boundary+powerFailure.randomDelay;
    }else if(powerFailure.phase==='wait'){
      powerFailure.active=false;
      finishNight(false,t('outageDeath',{id:powerFailure.attackerId}),powerFailure.attackerId);
    }else break;
  }
}

// A separate black 6 AM screen, with cleanup of any unfinished button timer.
let victoryButtonTimer=null;
let resignationFadeTimer=null;
function clearResignation(){
  if(resignationFadeTimer!==null){clearTimeout(resignationFadeTimer);resignationFadeTimer=null;}
  const screen=$('resignationScreen');
  screen.classList.add('hidden');screen.classList.remove('is-visible');
}
function showCompanyDocument(night){
  const model=window.FNAR_ENDINGS?.getDocument(night,gameLanguage,officeNameValue(),EXTRA_SHIFT_PAY);
  if(!model)return false;
  clearResignation();
  $('documentTitle').textContent=model.title;
  $('documentOffice').textContent=model.company;
  const body=$('documentBody');body.replaceChildren();
  for(const line of model.lines){
    const p=document.createElement('p');
    if(line.strong){const strong=document.createElement('strong');strong.textContent=line.text;p.appendChild(strong);}
    else p.textContent=line.text;
    body.appendChild(p);
  }
  $('documentSigner').textContent=model.signer;
  $('documentSignatureLabel').textContent=model.signatureLabel;
  const stamp=$('documentStamp');stamp.textContent=model.stamp;
  stamp.classList.toggle('hidden',!model.stamp);
  stamp.classList.toggle('dismissal-stamp',night===7);
  const screen=$('resignationScreen');
  $('resignationMenuBtn').textContent=t('backMenu');
  screen.classList.remove('hidden');
  void screen.offsetWidth;
  screen.classList.add('is-visible');
  resignationFadeTimer=setTimeout(()=>{
    resignationFadeTimer=null;
    $('victoryScreen').classList.add('hidden');
  },950);
  return true;
}
function clearVictorySequence(){
  if(victoryButtonTimer!==null){clearTimeout(victoryButtonTimer);victoryButtonTimer=null;}
  $('victoryScreen').classList.add('hidden');
  $('victoryScreen').classList.remove('is-playing');
  $('victoryNextBtn').classList.add('hidden');
}
function showVictorySequence(){
  clearVictorySequence();
  const screen=$('victoryScreen');
  const button=$('victoryNextBtn');
  button.textContent=t('startNextDay');
  screen.classList.remove('hidden');
  void $('victoryReel').offsetWidth;
  screen.classList.add('is-playing');
  victoryButtonTimer=setTimeout(()=>{
    victoryButtonTimer=null;
    if(!screen.classList.contains('hidden')){
      if(currentNight>=5)showCompanyDocument(currentNight);
      else button.classList.remove('hidden');
    }
  },7200); // 1.2s dissolve + 4s number roll + 2s pause.
}
function finishNight(success,message,attackerId=0){
  if(!state.active)return;
  atmosphere.clear();AUDIO_SETTINGS.stopAtmosphere();
  clearVictorySequence();
  // Hold the current camera frame during the dissolve to 6 AM.
  if(cameraOpen&&!success)setCameraOpen(false);
  state.active=false;state.gameOver=true;
  stopPowerFailureAudio();powerFailure.active=false;
  if(success)blackout.classList.add('hidden');
  resetPhone();
  state.leftLight=false;state.rightLight=false;needsComposing=true;
  $('pauseBtn').classList.add('hidden');
  cameraToggle.classList.add('hidden');
  stopAudioLoops();
  if(success){
    if(currentNight===7){
      sevenNightsComplete=true;customCompleted=true;
      if(customAI.every(level=>level===20))customMaxCompleted=true;
    }
    unlockedNight=Math.max(unlockedNight,Math.min(7,currentNight+1));
    updateSaveProgress();
  }
  $('ending').dataset.success=String(success);
  $('endingTitle').textContent=success?(currentNight===7?t('allNightsTitle'):t('winTitle')):t('loseTitle');
  // No cause-of-death text is shown on the defeat screen.
  $('endingText').textContent=success?(currentNight===7?t('allNightsText'):t('winText',{night:currentNight})):'';
  $('endingText').classList.toggle('hidden',!success);
  $('endingNightLabel').textContent=t('titleNight',{night:currentNight});
  $('restartBtn').textContent=success?(currentNight===7?t('backMenu'):t('nextNight',{night:currentNight+1})):t('retryNight',{night:currentNight});
  $('endingMenuBtn').classList.toggle('hidden',success&&currentNight===7);
  const reveal=()=>{$('ending').classList.remove('hidden');};
  if(success){
    $('hud').classList.add('hidden');
    $('pauseBtn').classList.add('hidden');
    $('ending').classList.add('hidden');
    playSfx('chimes',.65);
    showVictorySequence();
  }else if(attackerId>=1 && attackerId<=4){playJumpscare(attackerId,reveal);}
  else reveal();
  updateStatus();
}
// Sounds are emitted for nearby moves, never for every distant camera change.
const enemySoundLast=new Map();
function enemySound(e,kind,fast=false){
  if(powerFailure.active || !state.active)return;
  const now=state.nightElapsed;
  const type=kind==='knock'?'knock':kind==='anger'?'anger':kind==='warn'?'warning':'steps';
  const gap={knock:2.8,anger:5.0,warning:1.5,steps:1.4}[type];
  const last=enemySoundLast.get(type)??-999;
  if(now-last<gap)return;
  enemySoundLast.set(type,now);
  if(type==='knock')playSfx(['knock','knock-2','knock-3'][(e.id+e.cycles)%3],.49);
  else if(type==='anger')playSfx('running',.18);
  else if(type==='warning')playSfx(e.id===2?'knock-2':e.id===4?'running-fast':e.id===3?'running-fast':'running',.47);
  else if(fast)playSfx('running-fast',.37);
  else playSfx('running',.24);
}
function moveEnemies(dt){
  if(!state.active||powerFailure.active)return;
  // Only a genuinely live, unobscured frame counts as active watching.
  // Forced CAM 08 faults temporarily protect C3 from accumulating unfair anger.
  const tabletDebug=window.FNARTabletDebug;
  const actuallyWatching=cameraOpen&&
    (!tabletDebug || tabletDebug.canObserveCamera(currentCamera));
  const c3Protected=Boolean(tabletDebug&&tabletDebug.c3Protected);
  const events=AI.tick(aiSession,dt,{
    cameraOpen:actuallyWatching,
    c3Protected,
    camera:currentCamera,
    leftClosed:state.leftDoorPos>.88,
    rightClosed:state.rightDoorPos>.88
  });
  let changed=false;
  for(const event of events){
    const e=ENEMIES.find(item=>item.id===event.id);
    if(!e)continue;
    if(['wake','move','warning','retreat','rest','resume','rush'].includes(event.type))changed=true;
    if(event.type==='move'){
      if((event.step>=e.route.length-2 || event.fast) && !event.back)
        enemySound(e,'steps',Boolean(event.fast));
    }else if(event.type==='warning'){
      // The attack countdown starts only now, with at least three seconds of reaction time.
      enemySound(e,'warn');
    }else if(event.type==='knock'){
      enemySound(e,'knock');
    }else if(event.type==='anger'){
      enemySound(e,'anger');
    }else if(event.type==='rush'){
      enemySound(e,'steps',true);
    }else if(event.type==='retreat'){
      enemySound(e,'steps',false);
    }else if(event.type==='attack'){
      finishNight(false,t('doorDeath',{id:e.id,side:t(e.side==='left'?'leftDoor':'rightDoor')}),e.id);
      return;
    }
  }
  if(changed){needsComposing=true;updateCameraScene();}
}
cameraToggle.addEventListener('click',toggleCamera);
cameraNodes.forEach(b=>b.addEventListener('click',()=>chooseCamera(Number(b.dataset.camera))));
function goMenuInstant(){
  atmosphere.clear();AUDIO_SETTINGS.stopAtmosphere();AUDIO_SETTINGS.pauseAtmosphere(false);
  clearVictorySequence();
  clearResignation();
  clearNewspaperIntro();
  closeNightMenus();
  if(state.active){state.active=false;clearHeldActions();stopAudioLoops();stopRingtone();stopPowerFailureAudio();}
  for(const a of activeOneShots)window.AudioManager.release(a);
  activeOneShots.clear();window.AudioManager.stopAll();
  state.paused=false;pausedAudio.clear();resetJumpscare();resetPowerFailure();resetPhone();
  $('pauseScreen').classList.add('hidden');$('ending').classList.add('hidden');
  if(cameraOpen){cameraOpen=false;cameraScreen.classList.remove('is-open');cameraScreen.setAttribute('aria-hidden','true');cameraToggle.setAttribute('aria-expanded','false');}
  cameraToggle.classList.add('hidden');$('hud').classList.add('hidden');
  $('welcome').classList.remove('hidden');updateContinueButton();syncMenuStatic();
  $('pauseBtn').classList.add('hidden');
}
function goMenu(){return sceneTransition(()=>{goMenuInstant();return true;});}
$('restartBtn').addEventListener('click',()=>{
  if($('ending').dataset.success==='true'&&currentNight===7){goMenu();return;}
  transitionToNight($('ending').dataset.success==='true'?currentNight+1:currentNight);
});
$('endingMenuBtn').addEventListener('click',goMenu);
$('victoryNextBtn').addEventListener('click',()=>{if(currentNight<=4)transitionToNight(currentNight+1);else goMenu();});
$('resignationMenuBtn').addEventListener('click',goMenu);
const pausedAudio=new Set();
function pauseGameAudio(){
  window.AudioManager.setPaused(true);
  for(const a of [...audioLoops.values(),...activeOneShots,phoneRingAudio,phoneVoiceAudio,powerFailure.audio].filter(Boolean)){
    if(!a.paused){pausedAudio.add(a);a.pause();}
  }
}
function resumeGameAudio(){
  window.AudioManager.setPaused(false);
  for(const a of pausedAudio){if(a && state.active)a.play().catch(()=>{});}
  pausedAudio.clear();
}
function updatePauseButton(){
  $('pauseBtn').textContent='Ⅱ';$('pauseBtn').title=t('pause')+' (Esc / P)';
}
function togglePause(force){
  if(!state.active)return;
  const next=typeof force==='boolean'?force:!state.paused;
  if(state.paused===next)return;
  state.paused=next;clearHeldActions();state.dragging=false;state.leftKey=false;state.rightKey=false;
  $('pauseScreen').classList.toggle('hidden',!next);
  if(!next)$('settings').classList.add('hidden');
  state.last=performance.now();
  AUDIO_SETTINGS.pauseAtmosphere(next||phoneState.status==='talking');
  if(next)pauseGameAudio();else resumeGameAudio();
}
$('pauseBtn').addEventListener('click',()=>togglePause());
$('pauseResume').addEventListener('click',()=>togglePause(false));
$('pauseRestart').addEventListener('click',()=>{transitionToNight(currentNight);});
$('pauseMenu').addEventListener('click',goMenu);
resetEnemies();chooseCamera(1);preloadFutureCameras();

canvas.addEventListener('pointerdown',e=>{
  if(!state.active||state.paused||phoneState.status==='talking'||powerFailure.active||cameraOpen||!$('settings').classList.contains('hidden'))return;
  const hit=findHit(e.clientX,e.clientY);
  if(hit){
    state.pressAction=hit;state.pressPointerId=e.pointerId;state.dragging=false;state.dragMoved=false;
    if(hit==='light-left')setLight('left',true);
    else if(hit==='light-right')setLight('right',true);
    if(e.pointerType==='touch'||e.pointerType==='pen'||e.pointerType==='mouse'){try{canvas.setPointerCapture(e.pointerId)}catch(_){}}
    return;
  }
  state.dragging=true;state.dragX=e.clientX;state.dragY=e.clientY;state.dragYaw=state.target;state.dragMoved=false;
  if(e.pointerType==='touch'||e.pointerType==='pen'){try{canvas.setPointerCapture(e.pointerId)}catch(_){}}
});
canvas.addEventListener('pointermove',e=>{
  if(!state.active||state.paused||phoneState.status==='talking'||powerFailure.active||cameraOpen||!$('settings').classList.contains('hidden'))return;
  if(state.pressPointerId===e.pointerId&&state.pressAction&&state.pressAction.startsWith('light-')){
    const hit=findHit(e.clientX,e.clientY);
    if(state.pressAction==='light-left')setLight('left',hit==='light-left');
    if(state.pressAction==='light-right')setLight('right',hit==='light-right');
  } else if(state.dragging&&(e.pointerType==='touch'||e.pointerType==='pen')){
    const dx=e.clientX-state.dragX,dy=e.clientY-state.dragY;
    if(Math.abs(dx)>9||Math.abs(dy)>9)state.dragMoved=true;
    if(state.dragMoved){const w=canvas.getBoundingClientRect().width;state.target=clamp(state.dragYaw-dx/Math.max(1,w*.45),-1,1);e.preventDefault();}
  } else if(e.pointerType==='mouse')viewFromMouse(e);
  const target=findHit(e.clientX,e.clientY);
  canvas.style.cursor='url("arrow.cur") 0 0, auto';
  $('hoverAction').textContent=target?t(target.startsWith('light-')?'holdAction':'pressAction',{action:t(labels[target])}):t('hoverHint');
});
canvas.addEventListener('pointerup',e=>{
  if(!state.active||state.paused||phoneState.status==='talking'||powerFailure.active)return;
  if(state.pressPointerId===e.pointerId&&state.pressAction){
    const action=state.pressAction;
    if(action==='light-left')setLight('left',false);
    else if(action==='light-right')setLight('right',false);
    else if(!state.dragMoved){const hit=findHit(e.clientX,e.clientY);
      if(hit===action){if(action==='phone')answerPhone();else toggleDoor(action.endsWith('left')?'left':'right');}}
    try{canvas.releasePointerCapture(e.pointerId)}catch(_){ }
    state.pressAction=null;state.pressPointerId=null;return;
  }
  if(e.pointerType==='touch'||e.pointerType==='pen')try{canvas.releasePointerCapture(e.pointerId)}catch(_){ }
  state.dragging=false;
});
canvas.addEventListener('pointercancel',()=>{clearHeldActions();state.dragging=false;});
canvas.addEventListener('pointerleave',()=>{canvas.style.cursor='url("arrow.cur") 0 0, auto';if(!state.dragging&&state.pressAction?.startsWith('light-'))clearHeldActions();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement && !(e.target.type==='range'&&e.key.toLowerCase()==='m'))return;
  if(state.paused && !$('settings').classList.contains('hidden') && e.key==='Escape'){
    $('settings').classList.add('hidden');e.preventDefault();return;
  }
  if(state.paused && (e.key==='Escape'||e.key.toLowerCase()==='p')){togglePause(false);e.preventDefault();return;}
  if(e.key==='Escape'){
    if(cameraOpen){setCameraOpen(false);e.preventDefault();return;}
    if(!$('settings').classList.contains('hidden')){$('settings').classList.add('hidden');return;}
    if(state.active){togglePause(true);e.preventDefault();return;}
  }
  if(e.key.toLowerCase()==='p'&&state.active&&!e.repeat){togglePause(true);e.preventDefault();return;}
  if(e.key.toLowerCase()==='m'&&!e.repeat){toggleMute();e.preventDefault();return;}
  if(!state.active||state.paused||phoneState.status==='talking'||powerFailure.active||!$('settings').classList.contains('hidden'))return;
  const key=e.key.toLowerCase();
  if((key==='c'||key===' ')&&!e.repeat){toggleCamera();e.preventDefault();return;}
  if(cameraOpen){
    if(/^[1-9]$/.test(key)){chooseCamera(Number(key));e.preventDefault();}
    if(key==='f'&&!e.repeat)toggleFullscreen();
    return;
  }
  if(['a','arrowleft'].includes(key)){state.leftKey=true;e.preventDefault();}
  if(['d','arrowright'].includes(key)){state.rightKey=true;e.preventDefault();}
  if(key==='1'&&!e.repeat)toggleDoor('left');
  if(key==='2'&&!e.repeat)toggleDoor('right');
  if(key==='q'){state.qHeld=true;setLight('left',true);e.preventDefault();}
  if(key==='e'){state.eHeld=true;setLight('right',true);e.preventDefault();}
  if(key==='r'){state.target=0;state.yaw=0;}
  if(key==='f'&&!e.repeat)toggleFullscreen();
  if(key==='h'&&!e.repeat)toggleSettings();
});
window.addEventListener('keyup',e=>{
  const key=e.key.toLowerCase();
  if(['a','arrowleft'].includes(key))state.leftKey=false;
  if(['d','arrowright'].includes(key))state.rightKey=false;
  if(key==='q'){state.qHeld=false;setLight('left',false);}
  if(key==='e'){state.eHeld=false;setLight('right',false);}
});
window.addEventListener('blur',()=>{state.leftKey=state.rightKey=state.dragging=false;clearHeldActions();});
// A suspended background tab must not skip unseen enemy warnings or silently drain power.
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && state.active && !state.paused)togglePause(true);
  state.last=performance.now();
});
// The clock, AI and power all consume the SAME unclamped wall-frame elapsed time,
// partitioned into 50 ms simulation steps. One frame at 5 FPS therefore simulates
// the full 200 ms, instead of incorrectly counting only 60 ms.
function advanceGameStep(dt){
  if(state.active&&!cameraOpen&&$('settings').classList.contains('hidden')){
    if(state.leftKey||state.rightKey)
      state.target=clamp(state.target+((state.rightKey?1:0)-(state.leftKey?1:0))*dt*1.22,-1,1);
    const k=3.6+state.smooth*10;
    state.yaw+=(state.target-state.yaw)*(1-Math.exp(-k*dt));
    if(Math.abs(state.yaw-state.target)<.00002)state.yaw=state.target;
  }
  const prevLeft=state.leftDoorPos, prevRight=state.rightDoorPos;
  const doorSpeed=7.2;
  state.leftDoorPos=clamp(state.leftDoorPos+(state.leftDoor?1:-1)*doorSpeed*dt,0,1);
  state.rightDoorPos=clamp(state.rightDoorPos+(state.rightDoor?1:-1)*doorSpeed*dt,0,1);
  if(Math.abs(prevLeft-state.leftDoorPos)>.0001||Math.abs(prevRight-state.rightDoorPos)>.0001)
    needsComposing=true;
  if(!state.active||!$('settings').classList.contains('hidden')||state.paused||phoneState.status==='talking')
    return;
  const passed=POWER.advanceClock(state,dt);
  if(state.nightElapsed>=NIGHT_LENGTH){
    updateClock();
    finishNight(true,t('winText',{night:currentNight}));
    return;
  }
  if(powerFailure.active){
    updatePowerFailure();
  }else{
    moveEnemies(passed);
    if(state.active){
      updatePhone();
      POWER.spendPower(state,passed,powerControls());
      if(state.power<=0)startPowerFailure();
    }
  }
  if(state.active)atmosphere.tick(passed,atmosphereContext());
  updateOfficePower();
  updateClock();
}
function loop(timestamp){
  const realElapsed=Math.max(0,(timestamp-state.last)/1000);
  state.last=timestamp;
  if(state.paused){draw();requestAnimationFrame(loop);return;}
  if(state.active && phoneState.status==='talking'){
    updatePhoneCaption();draw();requestAnimationFrame(loop);return;
  }
  if(state.active){
    POWER.forEachStep(realElapsed,dt=>{
      if(!state.active||state.paused||phoneState.status==='talking')return false;
      advanceGameStep(dt);
      return state.active;
    });
  }else{
    // Keep menu transitions responsive without running AI or clock simulations.
    advanceGameStep(Math.min(realElapsed,POWER.SIMULATION_STEP));
  }
  $('turnPin').style.left=(50+state.yaw*state.angle*45)+'%';
  $('directionLabel').textContent=t(state.yaw<-.23?'viewLeft':state.yaw>.23?'viewRight':'viewCenter');
  draw();requestAnimationFrame(loop);
}
function start(night=1,options={}){
  if(state.loaded!==names.length||!canStartNight(Number(night)))return;
  if(state.active&&!options.force)return;
  closeNightMenus();
  if(options && options.intro){return transitionToNight(night,{intro:true});}
  clearVictorySequence();
  clearResignation();
  currentNight=clamp(Number(night)||1,1,7);state.night=currentNight;
  atmosphere.reset(currentNight);AUDIO_SETTINGS.stopAtmosphere();AUDIO_SETTINGS.pauseAtmosphere(false);
  persistOfficeName();
  $('officeInput').blur();
  state.paused=false;resumeGameAudio();$('pauseScreen').classList.add('hidden');$('pauseBtn').classList.remove('hidden');
  $('settings').classList.add('hidden');$('cameraNightLabel').textContent=t('titleNight',{night:currentNight});
  resetJumpscare();resetPowerFailure();resetPhone();stopAudioLoops();
  state.started=true;state.active=!options.deferActive;state.gameOver=false;
  if(state.active){startAudioLoop('ambient_room',.18);startAudioLoop('ambience',.065);}
  $('welcome').classList.add('hidden');syncMenuStatic();$('hud').classList.remove('hidden');$('ending').classList.add('hidden');cameraToggle.classList.remove('hidden');
  state.target=state.yaw=0;POWER.resetNight(state);state.last=performance.now();
  state.leftDoor=state.rightDoor=state.leftLight=state.rightLight=false;
  state.leftDoorPos=state.rightDoorPos=0;
  resetEnemies();needsComposing=true;
  if(cameraOpen){cameraOpen=false;cameraScreen.classList.remove('is-open');cameraScreen.setAttribute('aria-hidden','true');cameraToggle.setAttribute('aria-expanded','false');}
  shownCameraFile='';chooseCamera(1);updateClock();updateStatus();
  return true;
}
function setSliders(){
  for(const [key,property,scale] of [['turnAmount','angle',100],['fishAmount','fish',100],['smoothAmount','smooth',100]]){
    const slider=$(key);state[property]=Number(slider.value)/scale;$(key+'Text').textContent=slider.value+'%';
  }
}
function toggleSettings(){if(!state.active)return;if(cameraOpen)setCameraOpen(false);clearHeldActions();$('settings').classList.toggle('hidden');}
async function toggleFullscreen(){try{if(!document.fullscreenElement){await stage.requestFullscreen();try{await screen.orientation?.lock?.('landscape')}catch(_) {}}else await document.exitFullscreen();}catch(e){showToast('Полный экран недоступен');}}
$('startBtn').addEventListener('click',()=>transitionToNight(1,{intro:true}));$('continueBtn').addEventListener('click',()=>{if(unlockedNight>1)showNightSelect();});$('officeInput').addEventListener('keydown',e=>{if(e.key==='Enter')transitionToNight(1,{intro:true});});
$('settingsBtn').addEventListener('click',toggleSettings);
$('closeSettings').addEventListener('click',toggleSettings);$('closeSettingsPrimary').addEventListener('click',toggleSettings);
$('fullscreenBtn').addEventListener('click',toggleFullscreen);
for(const s of ['turnAmount','fishAmount','smoothAmount'])$(s).addEventListener('input',setSliders);
window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
window.addEventListener('resize',updateNewspaperScale);
if(window.ResizeObserver)new ResizeObserver(updateNewspaperScale).observe(stage);
if(window.ResizeObserver)new ResizeObserver(resize).observe(stage);
// In-browser testing helpers: 12 AM..6 AM, without advancing the real wall clock.
function debugFinishDay(){
  if(!state.active){console.warn('Start a night before using finishDay()');return false;}
  state.paused=false;$('pauseScreen').classList.add('hidden');$('settings').classList.add('hidden');
  pausedAudio.clear();state.nightElapsed=NIGHT_LENGTH;
  updateClock();finishNight(true,t('winText',{night:currentNight}));
  return true;
}
function debugSetTime(hourOrText,minutes=0){
  if(!state.active){console.warn('Start a night before using setTime()');return false;}
  let hour=hourOrText;
  if(typeof hourOrText==='string'){
    const m=hourOrText.trim().match(/^(12|[0-6])(?::([0-5]\d))?(?:\s*AM)?$/i);
    if(!m)throw new RangeError('Use setTime(5,30) or setTime("5:30 AM") between 12 AM and 6 AM');
    hour=Number(m[1]);minutes=m[2]===undefined?0:Number(m[2]);
  }
  if(!Number.isInteger(hour)||!Number.isInteger(minutes)||hour<0||hour>12||minutes<0||minutes>59 || (hour>6&&hour!==12) || (hour===6&&minutes!==0))
    throw new RangeError('Valid game time is 12:00 AM or 1:00 AM through 6:00 AM');
  const elapsed=(hour===12?0:hour)*60+minutes;
  if(elapsed===NIGHT_LENGTH)return debugFinishDay();
  state.nightElapsed=elapsed;updateClock();updateOfficePower();
  console.info('Game time set to',hour===0||hour===12?'12:'+String(minutes).padStart(2,'0')+' AM':String(hour)+':'+String(minutes).padStart(2,'0')+' AM');
  return state.nightElapsed;
}
window.KokhinhinDebug={state,toggleDoor,setLight,findHit,imagePos,setView(v){state.target=state.yaw=clamp(v,-1,1);},get frames(){return state.frames;},get assets(){return state.loaded;},toggleCamera,setCameraOpen,chooseCamera,get currentCamera(){return currentCamera;},get cameraOpen(){return cameraOpen;},
  enemies:ENEMIES,resetEnemies,NIGHT_CONFIG,AI,
  POWER_CONFIG:POWER.POWER_CONFIG,getPowerDrain,getPowerUsageLevel:currentUsage,
  getPowerSnapshot(){return {power:state.power,elapsed:state.nightElapsed,drain:getPowerDrain(),usage:currentUsage(),controls:powerControls()};},
  setEnemyStep(id,step){const e=ENEMIES.find(e=>e.id===id);if(!e)return;
    e.step=clamp(step,0,e.route.length);e.phase=e.step===e.route.length?AI.PHASES.DOOR:AI.PHASES.APPROACH;
    e.attack=0;e.blocked=0;e.knocks=0;e.nextMove=5;e.burst=0;needsComposing=true;updateCameraScene();},
  setPower(value){state.power=clamp(value,0,100);updateOfficePower();},
  startPowerFailure, powerFailure, setNightElapsed(value){state.nightElapsed=clamp(value,0,NIGHT_LENGTH);updateClock();},
  finishNight:finishNight,setTime:debugSetTime,finishDay:debugFinishDay,winNight:debugFinishDay,triggerScreamer(id){if(state.active)finishNight(false,'Тестовый скример петуха C'+id+'.',Number(id));},
  phoneState,forcePhoneRing(){if(state.active && currentNight<=5){resetPhone();startRinging();}},answerPhone,hangUpPhone,
  get phoneVoice(){return phoneVoiceAudio;}, get phoneSubtitle(){return phoneSubtitle.textContent;},
  toggleMute,togglePause,get currentNight(){return currentNight;},get unlockedNight(){return unlockedNight;},
  setLanguage:chooseLanguage,goMenu,updateSaveProgress,
  showNightSelect,showCustomNight:()=>showCustomNight(true),showEnding:showCompanyDocument,
  get customAI(){return [...customAI];},get customCompleted(){return customCompleted;},
  get customMaxCompleted(){return customMaxCompleted;}};
window.FNARDebug=window.KokhinhinDebug;
const savedLanguage=readSave('kokhinhin_lang');
gameLanguage=['ru','en','ja'].includes(savedLanguage)?savedLanguage:'ru';
applyTranslations();
initCanvas();setSliders();updateStatus();resize();requestAnimationFrame(loop);
})();
