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
const PRELOAD_CACHE_NAME='fnar-game-assets-v038';
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
  preloadBusy=true;
  $('preloadRetry').classList.add('hidden');
  $('preloadScreen').classList.remove('hidden');
  const paths=[...names.map(n=>'assets/room/'+n),
    ...PRELOAD_CAMERA_NAMES.map(n=>'assets/cameras/'+n),
    ...PRELOAD_SOUND_NAMES.map(n=>'assets/sound/'+n+'.mp3'),
    ...[1,2,3,4].map(n=>'assets/screamers/rooster_'+n+'_scream.webm'),
    'assets/sound/static-bm.webm'];
  let done=0;preloadProgress(done,paths.length);
  // file:// cannot use CacheStorage/fetch; standalone files embed their game art and audio.
  if(location.protocol==='file:'){
    staticVideo.src=staticVideoURL();loadImages();preloadBusy=false;return;
  }
  let cache=null;
  try{if('caches' in window)cache=await caches.open(PRELOAD_CACHE_NAME);}catch(e){console.warn('Persistent cache unavailable',e);}
  let next=0;const failed=[];
  async function worker(){
    while(next<paths.length){
      const path=paths[next++];
      try{
        if(!cachedAssetURLs.has(path)){
          let response=cache?await cache.match(path):null;
          if(!response){
            response=await fetch(path,{cache:'no-cache'});
            if(!response.ok)throw Error('HTTP '+response.status+' '+path);
            if(cache)try{await cache.put(path,response.clone());}catch(e){console.warn('Unable to persist cache entry',path,e);}
          }
          const blob=await response.blob();
          cachedAssetURLs.set(path,URL.createObjectURL(blob));
        }
      }catch(e){failed.push(path);console.warn('Asset preload failed',path,e);}
      done++;preloadProgress(done,paths.length);
    }
  }
  await Promise.all(Array.from({length:5},worker));
  preloadBusy=false;
  if(failed.length){
    $('preloadStatus').textContent=t('preloadError')+' ('+failed.length+')';
    $('preloadRetry').classList.remove('hidden');return;
  }
  staticVideo.src=staticVideoURL();
  loadImages();
}
$('preloadRetry').addEventListener('click',preloadAllGameAssets);

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
 ru:{chooseLanguage:'ВЫБЕРИТЕ ЯЗЫК',languagePrompt:'Язык игры',langRu:'Русский',langJa:'日本語',
  warningHeading:'ПРЕДУПРЕЖДЕНИЕ',warningBody:'В игре присутствуют внезапные громкие звуки, скримеры, мигающие изображения и напряжённые сцены. Рекомендуется умеренная громкость.',warningAccept:'ПОНИМАЮ · ПРОДОЛЖИТЬ',preloadTitle:'ПОДГОТОВКА ИГРЫ',preloadStatus:'Загрузка ресурсов: {n} / {total} ({percent}%)',preloadRetry:'ПОВТОРИТЬ ЗАГРУЗКУ',preloadError:'Не удалось загрузить ресурсы. Проверьте интернет и повторите попытку.',skipPhone:'ПРОПУСТИТЬ ЗВОНОК',
  menuDesc:'Выживите до 6:00. Четыре петуха патрулируют девять камер. Следите за дверями, светом и расходом электричества.',officeLabel:'НАЗВАНИЕ ОФИСА',officePlaceholder:'Мой офис',start:'НОВАЯ ИГРА · НОЧЬ 1',continue:'ПРОДОЛЖИТЬ · НОЧЬ {night}',loading:'Загрузка {n} / {total}',
  titleNight:'Ночь {night}',pause:'ПАУЗА',pauseTitle:'ПАУЗА',pauseResume:'ВЕРНУТЬСЯ В ИГРУ',pauseRestart:'ПЕРЕЗАПУСТИТЬ НОЧЬ',pauseMenu:'В ГЛАВНОЕ МЕНЮ',pauseHint:'Esc или P — продолжить',
  winTitle:'6:00 AM',winText:'Вы пережили ночь {night}! До рассвета петухи не смогли попасть в комнату охраны.',
  allNightsTitle:'ВСЕ 7 НОЧЕЙ ПРОЙДЕНЫ',allNightsText:'Все семь ночных смен пройдены. Офис выжил!',
  loseTitle:'НОЧЬ ОКОНЧЕНА',nextNight:'СЛЕДУЮЩАЯ НОЧЬ · {night}',retryNight:'ПОВТОРИТЬ НОЧЬ {night}',backMenu:'ГЛАВНОЕ МЕНЮ',
  doorDeath:'Петух C{id} проник в комнату охраны через {side} дверь.',leftDoor:'левую',rightDoor:'правую',
  outageDeath:'После отключения электричества петух C{id} добрался до комнаты охраны.',testDeath:'Тестовый скример петуха C{id}.',
  ringing:'☎ ВХОДЯЩИЙ ЗВОНОК / ЛИНИЯ ОТКРЫТА',hangup:'ПОЛОЖИТЬ ТРУБКУ',
  settingsTitle:'Настройки обзора',settingsAngle:'Амплитуда поворота',settingsFish:'«Рыбий глаз»',settingsSmooth:'Плавность',settingsResume:'ПРОДОЛЖИТЬ',
  settingsInstructions:'Поворот: мышь, стрелки ← → или A / D. Двери: 1 / 2. Свет: удерживайте Q / E. Камеры: C или нижняя кнопка, переключение 1–9. Пауза: Esc / P. Телефон: клик по подсвеченному аппарату во время звонка.',
  cameras:'КАМЕРЫ',mapTitle:'ОБЪЕКТ / КАМЕРЫ',power:'Энергия:',usage:'Расход:',camLive:'● LIVE',cameraEmpty:'ИЗОБРАЖЕНИЕ НЕ ПОДКЛЮЧЕНО',cameraDev:'ГРАФИКА ПОМЕЩЕНИЯ В РАЗРАБОТКЕ',
  camNames:['Северная','Коридор','Правый коридор','Ресепшен','Опен-спейс','Левый коридор','Левый выход','Кабинет директора','Правый выход'],
  leftLight:'Свет слева',rightLight:'Свет справа',leftDoorLabel:'Дверь слева',rightDoorLabel:'Дверь справа',phoneLabel:'Телефон на столе',
  openCamera:'Открыть камеры наблюдения',closeCamera:'Закрыть камеры наблюдения',
  mute:'Выключить звук',unmute:'Включить звук',viewCenter:'ВЗГЛЯД ПО ЦЕНТРУ',viewLeft:'СМОТРИТЕ ВЛЕВО',viewRight:'СМОТРИТЕ ВПРАВО'},
 ja:{chooseLanguage:'言語を選択',languagePrompt:'ゲームの言語',langRu:'Русский',langJa:'日本語',
  warningHeading:'ご注意',warningBody:'このゲームには突然の大きな音、ジャンプスケア、点滅する映像、恐怖を感じる場面が含まれています。音量を控えめにしてプレイしてください。',warningAccept:'確認しました · 続ける',preloadTitle:'ゲームデータを準備中',preloadStatus:'データ読み込み: {n} / {total} ({percent}%)',preloadRetry:'再試行',preloadError:'データの読み込みに失敗しました。通信を確認して再試行してください。',skipPhone:'着信を無視',
  menuDesc:'午前6時まで生き残ろう。4羽のニワトリが9台のカメラの間を巡回します。ドアとライト、残り電力に注意してください。',officeLabel:'オフィス名',officePlaceholder:'私のオフィス',start:'ニューゲーム · 第1夜',continue:'続きから · 第{night}夜',loading:'読み込み中 {n} / {total}',
  titleNight:'第{night}夜',pause:'一時停止',pauseTitle:'一時停止',pauseResume:'ゲームを再開',pauseRestart:'この夜をやり直す',pauseMenu:'メインメニューへ',pauseHint:'Esc または P で再開',
  winTitle:'午前6:00',winText:'第{night}夜を生き延びました！ 夜明けまでニワトリの侵入を阻止しました。',
  allNightsTitle:'全7夜クリア',allNightsText:'7夜すべての勤務を生き延びました。オフィスは無事です！',
  loseTitle:'ゲームオーバー',nextNight:'次の夜 · 第{night}夜',retryNight:'第{night}夜をやり直す',backMenu:'メインメニューへ',
  doorDeath:'ニワトリC{id}が{side}ドアから警備室に侵入しました。',leftDoor:'左',rightDoor:'右',
  outageDeath:'停電後、ニワトリC{id}が警備室に到達しました。',testDeath:'ニワトリC{id}のジャンプスケアテスト。',
  ringing:'☎ 着信 / 通話中',hangup:'電話を切る',
  settingsTitle:'視点設定',settingsAngle:'回転範囲',settingsFish:'魚眼効果',settingsSmooth:'滑らかさ',settingsResume:'続ける',
  settingsInstructions:'視点操作：マウス、← → または A / D。ドア：1 / 2。ライト：Q / E を長押し。カメラ：C または下部ボタン、1～9で切替。一時停止：Esc / P。着信中は机の光る電話をクリックしてください。',
  cameras:'カメラ',mapTitle:'施設 / カメラ',power:'残り電力:',usage:'使用量:',camLive:'● 接続中',cameraEmpty:'映像を受信できません',cameraDev:'カメラ映像は準備中です',
  camNames:['北エリア','廊下','右の廊下','受付','オープンスペース','左の廊下','左の出口','社長室','右の出口'],
  leftLight:'左のライト',rightLight:'右のライト',leftDoorLabel:'左のドア',rightDoorLabel:'右のドア',phoneLabel:'机の電話',
  openCamera:'監視カメラを開く',closeCamera:'監視カメラを閉じる',
  mute:'消音',unmute:'音声をオン',viewCenter:'正面',viewLeft:'左を見る',viewRight:'右を見る'}
};
let gameLanguage='ru',currentNight=1,unlockedNight=Math.max(1,Math.min(7,Number(readSave('kokhinhin_unlocked'))||1));
let sevenNightsComplete=readSave('kokhinhin_complete')==='1';
function t(key,vars={}){
  let val=L10N[gameLanguage][key]??L10N.ru[key]??key;
  return String(val).replace(/\{(\w+)\}/g,(_,k)=>String(vars[k]??''));
}
function updateSaveProgress(){writeSave('kokhinhin_unlocked',unlockedNight);writeSave('kokhinhin_complete',sevenNightsComplete?'1':'0');updateContinueButton();}
function updateContinueButton(){
  const b=$('continueBtn');b.disabled=state.loaded!==names.length||unlockedNight<=1;
  b.textContent=t('continue',{night:unlockedNight});
}
function applyTranslations(){
  document.documentElement.lang=gameLanguage;
  document.querySelectorAll('[data-i18n]').forEach(node=>{node.textContent=t(node.dataset.i18n);});
  $('officeInput').placeholder=t('officePlaceholder');
  $('startBtn').textContent=t('start');
  $('continueBtn').textContent=t('continue',{night:unlockedNight});
  $('loadingStatus').textContent=state.loaded===names.length?'':t('loading',{n:state.loaded,total:names.length});
  $('cameraNightLabel').textContent=t('titleNight',{night:currentNight});
  if(typeof updateMuteUI==='function')updateMuteUI();
  if(typeof updateStatus==='function')updateStatus();
  if(typeof chooseCamera==='function')chooseCamera(currentCamera);
  if(typeof updatePauseButton==='function')updatePauseButton();
}
function chooseLanguage(lang){
  gameLanguage=lang==='ja'?'ja':'ru';writeSave('kokhinhin_lang',gameLanguage);
  applyTranslations();$('languageScreen').classList.add('hidden');$('warningScreen').classList.remove('hidden');
}
$('languageRu').addEventListener('click',()=>chooseLanguage('ru'));
$('languageJa').addEventListener('click',()=>chooseLanguage('ja'));
$('warningAccept').addEventListener('click',()=>{$('warningScreen').classList.add('hidden');$('preloadScreen').classList.remove('hidden');preloadAllGameAssets();});

// Audio: original supplied MP3 effects, all optional if browser audio is blocked.
const SOUND_PATH='assets/sound/';
const soundURL=name=>window.KONS_EMBEDDED_SOUNDS?.[name] ||
  ((window.KONS_STANDALONE || location.protocol==='file:') && /^phone_\d\d$/.test(name)
    ? 'https://dmitrysenpai.github.io/FNAR/assets/sound/'+name+'.mp3'
    : getCachedAssetURL(SOUND_PATH+name+'.mp3'));
const screamerURL=id=>window.KONS_EMBEDDED_SCREAMERS?.[id]||getCachedAssetURL('assets/screamers/rooster_'+id+'_scream.webm');
const staticVideoURL=()=>window.KONS_EMBEDDED_STATIC_VIDEO||getCachedAssetURL('assets/sound/static-bm.webm');
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
}
function playSfx(name,volume=.45){
  if(soundMuted)return;
  try{const a=new Audio(soundURL(name));a.preload='auto';a.volume=clamp(volume,0,1);a.muted=soundMuted;activeOneShots.add(a);
    a.onended=()=>activeOneShots.delete(a);a.onerror=()=>activeOneShots.delete(a);
    a.play().catch(()=>activeOneShots.delete(a));return a;}
  catch(ex){console.warn('SFX error',name,ex);}
}
function startAudioLoop(name,volume=.15){
  let a=audioLoops.get(name);
  if(!a){a=new Audio(soundURL(name));a.loop=true;a.preload='auto';audioLoops.set(name,a);}
  a.volume=clamp(volume,0,1);a.muted=soundMuted;
  a.play().catch(()=>{});
}
function stopAudioLoop(name){const a=audioLoops.get(name);if(a){a.pause();a.currentTime=0;}}
function stopAudioLoops(){for(const name of audioLoops.keys())stopAudioLoop(name);}
function toggleMute(){soundMuted=!soundMuted;safeStore('kons-muted',soundMuted?'1':'0');updateMuteUI();}
$('muteBtn').addEventListener('click',toggleMute);updateMuteUI();
// Transparent VP9 WebM is composited directly over the live office scene.
const jumpOverlay=$('jumpscare'),jumpVideo=$('jumpscareVideo');
let jumpTimer=0,jumpEpoch=0;
const deathStatic=$('deathStatic'),staticVideo=$('staticVideo');
staticVideo.muted=true;staticVideo.loop=true;
function clearDeathStaticAudio(){
  if(deathStaticAudio){deathStaticAudio.pause();deathStaticAudio.currentTime=0;deathStaticAudio=null;}
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
        $('preloadScreen').classList.add('hidden');$('welcome').classList.remove('hidden');
      }
    };
    img.onerror=()=>{$('loadingStatus').textContent=`Ошибка загрузки ${name}. Проверьте папку assets/room.`;console.error('Image load failed',src(name));};
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
function currentUsage(){
  return Math.min(4,1+Number(cameraOpen)+Number(state.leftDoor)+Number(state.rightDoor)+Number(state.leftLight)+Number(state.rightLight));
}
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
const NIGHT_LENGTH=360; // six game hours at 60 seconds/hour
// Camera artwork routes, different wake-up times and different step intervals.
// Only ONE rooster may reach the final two camera nodes / office doors at a time.
const ENEMIES=[
  {id:1,side:'left',route:[5,4,6,7],min:10,max:17,initial:8,roam:.17},
  {id:2,side:'right',route:[1,8,3,9],min:14,max:23,initial:49,roam:.28},
  {id:3,side:'right',route:[8,3,9],min:17,max:27,initial:108,roam:.32},
  {id:4,side:'left',route:[2,5,4,6,7],min:13,max:22,initial:165,roam:.28}
];
const cameraScreen=$('cameraScreen'),cameraToggle=$('cameraToggle'),cameraFeed=$('cameraFeed');
const cameraNodes=[...document.querySelectorAll('.cam-node')];
const CAM_PICTURE=$('cameraPicture'),CAM_EMPTY=$('feedEmpty');
const cameraCache=new Map();const cameraUnavailable=new Set();
const CAMERA_VARIANTS=new Set(["cam01.webp", "cam01_c2.webp", "cam02.webp", "cam02_c4.webp", "cam03.webp", "cam03_c2.webp", "cam03_c2_c3.webp", "cam03_c3.webp", "cam04.webp", "cam04_c1.webp", "cam04_c1_c4.webp", "cam04_c4.webp", "cam05.webp", "cam05_c1.webp", "cam05_c4.webp", "cam05_c4_c1.webp", "cam06.webp", "cam06_c1.webp", "cam06_c1_c4.webp", "cam06_c4.webp", "cam07.webp", "cam07_c1.webp", "cam07_c1_c4.webp", "cam07_c4.webp", "cam08.webp", "cam08_c2.webp", "cam08_c2_c3.webp", "cam08_c3.webp", "cam09.webp", "cam09_c2.webp", "cam09_c2_c3.webp", "cam09_c3.webp"]);
let cameraOpen=false,currentCamera=1,cameraFlashTimer=0,shownCameraFile='';
function randomBetween(min,max){return min+Math.random()*(max-min);}
function imageDelay(e){
  const urgency=clamp(state.nightElapsed/NIGHT_LENGTH,0,1);
  const nightFactor=1-(currentNight-1)*.075;
  return randomBetween(e.min,e.max)*nightFactor*(1-.22*urgency);
}
function resetEnemies(){
  ENEMIES.forEach(e=>{
    e.step=0;e.phase='dormant';e.nextMove=e.initial*(1-(currentNight-1)*.075)+randomBetween(0,9);
    e.attack=0;e.blocked=0;e.knocks=0;e.cycles=0;e.retreatTo=0;
  });
}
function cameraImageURL(file){return window.KONS_EMBEDDED_CAMERAS?.[file] || getCachedAssetURL('assets/cameras/'+file);}
function cameraFile(){
  const code='cam'+String(currentCamera).padStart(2,'0');
  const current=ENEMIES.filter(e=>e.phase!=='dormant' && e.step<e.route.length && e.route[e.step]===currentCamera)
    .map(e=>e.id).sort((a,b)=>a-b);
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
  const skip=$('skipPhoneBtn');skip.classList.toggle('hidden',phoneState.status!=='ringing');skip.disabled=phoneState.status!=='ringing';
  needsComposing=true;
}
function stopRingtone(){
  if(phoneRingAudio){phoneRingAudio.pause();phoneRingAudio.currentTime=0;
    phoneRingAudio.onended=null;phoneRingAudio.onerror=null;phoneRingAudio=null;}
}
function stopPhoneVoice(){
  if(!phoneVoiceAudio)return;
  phoneVoiceAudio.onended=null;phoneVoiceAudio.onerror=null;
  phoneVoiceAudio.pause();try{phoneVoiceAudio.currentTime=0;}catch(_){ }
  pausedAudio.delete(phoneVoiceAudio);
  phoneVoiceAudio=null;
}
function resetPhone(){
  ++phoneEpoch;stopRingtone();stopPhoneVoice();stopAudioLoop('phone-line');
  phoneState.status=currentNight>=6?'disabled':'idle';phoneState.nextRingAt=7;
  phoneState.ringEndsAt=0;phoneState.dialogEndsAt=0;phoneState.subtitleIndex=-1;
  phoneParagraphs=[];phoneSubtitle.textContent='';
  updatePhoneUI();
}
$('skipPhoneBtn').addEventListener('click',()=>{if(phoneState.status==='ringing')missPhone();});
function missPhone(){
  if(phoneState.status!=='ringing')return;
  stopRingtone();phoneState.status='missed';updatePhoneUI();
}
function startRinging(){
  if(!state.active||state.paused||currentNight>=6||powerFailure.active||phoneState.status!=='idle')return;
  const epoch=phoneEpoch;
  phoneState.status='ringing';phoneState.ringEndsAt=state.nightElapsed+PHONE_RING_SECONDS;
  updatePhoneUI();
  const audio=new Audio(soundURL('phone'));audio.volume=.52;audio.muted=soundMuted;
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
  const weights=phoneParagraphs.map(txt=>Math.max(4,Array.from(txt).length));
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
  phoneVoiceAudio=voice;voice.preload='auto';voice.loop=false;voice.volume=.88;voice.muted=soundMuted;
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
  phoneState.status='completed';updatePhoneUI();
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
  const closest=[...ENEMIES].sort((a,b)=>{
    const distanceA=Math.max(0,a.route.length-a.step);
    const distanceB=Math.max(0,b.route.length-b.step);
    return distanceA-distanceB || a.id-b.id;
  })[0];
  powerFailure.attackerId=closest.id;
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

function finishNight(success,message,attackerId=0){
  if(!state.active)return;
  if(cameraOpen)setCameraOpen(false);
  state.active=false;state.gameOver=true;
  stopPowerFailureAudio();powerFailure.active=false;
  if(success)blackout.classList.add('hidden');
  resetPhone();
  state.leftLight=false;state.rightLight=false;needsComposing=true;
  cameraToggle.classList.add('hidden');
  stopAudioLoops();
  if(success){
    if(currentNight===7)sevenNightsComplete=true;
    unlockedNight=Math.max(unlockedNight,Math.min(7,currentNight+1));
    updateSaveProgress();
  }
  $('ending').dataset.success=String(success);
  $('endingTitle').textContent=success?(currentNight===7?t('allNightsTitle'):t('winTitle')):t('loseTitle');
  $('endingText').textContent=success?(currentNight===7?t('allNightsText'):t('winText',{night:currentNight})):message;
  $('endingNightLabel').textContent=t('titleNight',{night:currentNight});
  $('restartBtn').textContent=success?(currentNight===7?t('backMenu'):t('nextNight',{night:currentNight+1})):t('retryNight',{night:currentNight});
  $('endingMenuBtn').classList.toggle('hidden',success&&currentNight===7);
  const reveal=()=>{$('ending').classList.remove('hidden');};
  if(!success && attackerId>=1 && attackerId<=4){playJumpscare(attackerId,reveal);}
  else {if(success)playSfx('chimes',.65);reveal();}
  updateStatus();
}
function nearGuard(e){return e.step>=e.route.length-2;}
function footstep(e,fast=false){
  if(!nearGuard(e)||powerFailure.active)return;
  playSfx(fast?'running-fast':'running',fast?.32:.23);
}
function retreatEnemy(e,fromDoor=true){
  e.phase='retreat';e.attack=0;e.blocked=0;e.knocks=0;
  if(fromDoor)e.cycles++;
  // Two camera positions from the door; another bird can now take a turn.
  e.retreatTo=Math.max(0,e.route.length-3);
  e.nextMove=randomBetween(1,2.4);
}
function isThreatening(e){
  return e.phase!=='dormant' && e.step>=e.route.length-2;
}
function moveEnemies(dt){
  let changed=false;
  for(const e of ENEMIES){
    if(!state.active||powerFailure.active)return;
    if(e.phase==='door'){
      const closed=state[e.side+'DoorPos']>.88;
      if(closed){
        e.attack=0;e.blocked+=dt;
        if(!e.knocks){playSfx(['knock','knock-2','knock-3'][(e.id+e.cycles)%3],.48);e.knocks=1;}
        if(e.blocked>=4.2+Math.max(0,currentNight-1)*.22){retreatEnemy(e,true);changed=true;}
      }else{
        e.blocked=0;e.knocks=0;e.attack+=dt;
        if(e.attack>=7.4+e.id*.45-(currentNight-1)*.5){
          finishNight(false,t('doorDeath',{id:e.id,side:t(e.side==='left'?'leftDoor':'rightDoor')}),e.id);return;
        }
      }
      continue;
    }
    e.nextMove-=dt;
    if(e.nextMove>0)continue;
    if(e.phase==='dormant'){
      e.phase='approach';e.nextMove=imageDelay(e)*.6;changed=true;continue;
    }
    if(e.phase==='rest'){
      e.phase='approach';e.nextMove=imageDelay(e)*.5;continue;
    }
    if(e.phase==='retreat'){
      const previous=e.step;e.step=Math.max(e.retreatTo,e.step-1);
      if(e.step!==previous){changed=true;footstep(e,true);}
      if(e.step<=e.retreatTo){
        e.phase='rest';e.nextMove=(randomBetween(24,39)+e.id*3.5)*(1-(currentNight-1)*.075);
      }else e.nextMove=randomBetween(2.8,5.8);
      continue;
    }
    // A rooster outside the last two camera nodes must wait its turn.
    const enteringDanger=e.step+1>=e.route.length-2;
    const occupied=ENEMIES.some(other=>other!==e && isThreatening(other));
    if(enteringDanger && occupied){
      // Patrol an earlier node instead of waiting in a queue just by the door.
      if(e.step>0&&Math.random()<.42){e.step--;changed=true;}
      e.nextMove=randomBetween(10,20);continue;
    }
    // Nonlinear patrols: birds can step backwards before the final stretch.
    if(!enteringDanger && e.step>0 && Math.random()<e.roam*(1-(currentNight-1)*.07)) {
      e.step--;changed=true;e.nextMove=imageDelay(e)*.7;continue;
    }
    if(e.step>=e.route.length-1){
      e.step=e.route.length;e.phase='door';e.attack=0;e.blocked=0;e.knocks=0;
      e.nextMove=0;changed=true;footstep(e,true);
    }else{
      e.step++;changed=true;footstep(e,false);e.nextMove=imageDelay(e);
    }
  }
  if(changed){needsComposing=true;updateCameraScene();}
}
cameraToggle.addEventListener('click',toggleCamera);
cameraNodes.forEach(b=>b.addEventListener('click',()=>chooseCamera(Number(b.dataset.camera))));
function goMenu(){
  if(state.active){state.active=false;clearHeldActions();stopAudioLoops();stopRingtone();stopPowerFailureAudio();}
  for(const a of activeOneShots){a.pause();try{a.currentTime=0;}catch(_){}}activeOneShots.clear();
  state.paused=false;pausedAudio.clear();resetJumpscare();resetPowerFailure();resetPhone();
  $('pauseScreen').classList.add('hidden');$('ending').classList.add('hidden');
  if(cameraOpen){cameraOpen=false;cameraScreen.classList.remove('is-open');cameraScreen.setAttribute('aria-hidden','true');cameraToggle.setAttribute('aria-expanded','false');}
  cameraToggle.classList.add('hidden');$('hud').classList.add('hidden');
  $('welcome').classList.remove('hidden');updateContinueButton();
  $('pauseBtn').classList.add('hidden');
}
$('restartBtn').addEventListener('click',()=>{
  if($('ending').dataset.success==='true'&&currentNight===7){goMenu();return;}
  start($('ending').dataset.success==='true'?currentNight+1:currentNight);
});
$('endingMenuBtn').addEventListener('click',goMenu);
const pausedAudio=new Set();
function pauseGameAudio(){
  for(const a of [...audioLoops.values(),...activeOneShots,phoneRingAudio,phoneVoiceAudio,powerFailure.audio].filter(Boolean)){
    if(!a.paused){pausedAudio.add(a);a.pause();}
  }
}
function resumeGameAudio(){
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
  if(next)pauseGameAudio();else resumeGameAudio();
}
$('pauseBtn').addEventListener('click',()=>togglePause());
$('pauseResume').addEventListener('click',()=>togglePause(false));
$('pauseRestart').addEventListener('click',()=>{togglePause(false);start(currentNight);});
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
  $('hoverAction').textContent=target?(target.startsWith('light-')?`УДЕРЖИВАТЬ: ${labels[target]}`:`НАЖАТЬ: ${labels[target]}`):'Наведите взгляд на кнопки у дверей';
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
  if(e.target instanceof HTMLInputElement)return;
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
function loop(timestamp){
  const dt=Math.min(.06,Math.max(0,(timestamp-state.last)/1000));state.last=timestamp;
  if(state.paused){draw();requestAnimationFrame(loop);return;}
  if(state.active && phoneState.status==='talking'){
    updatePhoneCaption();draw();requestAnimationFrame(loop);return;
  }
  if(state.active&&!cameraOpen&&$('settings').classList.contains('hidden')){
    if(state.leftKey||state.rightKey){state.target=clamp(state.target+((state.rightKey?1:0)-(state.leftKey?1:0))*dt*1.22,-1,1);}
    const k=3.6+state.smooth*10;state.yaw+=(state.target-state.yaw)*(1-Math.exp(-k*dt));
    if(Math.abs(state.yaw-state.target)<.00002)state.yaw=state.target;
  }
  const prevLeft=state.leftDoorPos, prevRight=state.rightDoorPos;
  const doorSpeed=7.2;
  state.leftDoorPos += (state.leftDoor?1:-1)*doorSpeed*dt;
  state.rightDoorPos += (state.rightDoor?1:-1)*doorSpeed*dt;
  state.leftDoorPos=clamp(state.leftDoorPos,0,1);state.rightDoorPos=clamp(state.rightDoorPos,0,1);
  if(Math.abs(prevLeft-state.leftDoorPos)>0.0001||Math.abs(prevRight-state.rightDoorPos)>0.0001)needsComposing=true;
  if(state.active && $('settings').classList.contains('hidden')){
    state.nightElapsed+=dt;
    if(state.nightElapsed>=NIGHT_LENGTH){
      state.nightElapsed=NIGHT_LENGTH;
      updateClock();finishNight(true,t('winText',{night:currentNight}));
    }else{
      if(powerFailure.active){
        updatePowerFailure();
      }else{
        moveEnemies(dt);
        if(state.active){
          updatePhone();
          const drain=(.12+(currentNight-1)*.015)+(cameraOpen?.10:0)+(state.leftDoor?.28:0)+(state.rightDoor?.28:0)+
            (state.leftLight?.26:0)+(state.rightLight?.26:0);
          state.power=Math.max(0,state.power-dt*drain);
          if(state.power<=0)startPowerFailure();
        }
      }
    }
    updateOfficePower();updateClock();
  }
  $('turnPin').style.left=(50+state.yaw*state.angle*45)+'%';
  $('directionLabel').textContent=t(state.yaw<-.23?'viewLeft':state.yaw>.23?'viewRight':'viewCenter');
  draw();requestAnimationFrame(loop);
}
function start(night=1){
  if(state.loaded!==names.length)return;
  currentNight=clamp(Number(night)||1,1,7);state.night=currentNight;
  const office=$('officeInput').value.trim().slice(0,44)||(gameLanguage==='ja'?'私のオフィス':'Мой офис');
  writeSave('kokhinhin_office',office);safeStore('kons-new-office',office);
  $('officeInput').blur();
  state.paused=false;resumeGameAudio();$('pauseScreen').classList.add('hidden');$('pauseBtn').classList.remove('hidden');
  $('settings').classList.add('hidden');$('cameraNightLabel').textContent=t('titleNight',{night:currentNight});
  resetJumpscare();resetPowerFailure();resetPhone();stopAudioLoops();
  state.started=state.active=true;state.gameOver=false;
  startAudioLoop('ambient_room',.18);startAudioLoop('ambience',.065);
  $('welcome').classList.add('hidden');$('hud').classList.remove('hidden');$('ending').classList.add('hidden');cameraToggle.classList.remove('hidden');
  state.target=state.yaw=0;state.power=100;state.nightElapsed=0;
  state.leftDoor=state.rightDoor=state.leftLight=state.rightLight=false;
  state.leftDoorPos=state.rightDoorPos=0;
  resetEnemies();needsComposing=true;
  if(cameraOpen){cameraOpen=false;cameraScreen.classList.remove('is-open');cameraScreen.setAttribute('aria-hidden','true');cameraToggle.setAttribute('aria-expanded','false');}
  shownCameraFile='';chooseCamera(1);updateClock();updateStatus();
}
function setSliders(){
  for(const [key,property,scale] of [['turnAmount','angle',100],['fishAmount','fish',100],['smoothAmount','smooth',100]]){
    const slider=$(key);state[property]=Number(slider.value)/scale;$(key+'Text').textContent=slider.value+'%';
  }
}
function toggleSettings(){if(!state.active)return;if(cameraOpen)setCameraOpen(false);clearHeldActions();$('settings').classList.toggle('hidden');}
async function toggleFullscreen(){try{if(!document.fullscreenElement){await stage.requestFullscreen();try{await screen.orientation?.lock?.('landscape')}catch(_) {}}else await document.exitFullscreen();}catch(e){showToast('Полный экран недоступен');}}
$('startBtn').addEventListener('click',()=>start(1));$('continueBtn').addEventListener('click',()=>start(unlockedNight));$('officeInput').addEventListener('keydown',e=>{if(e.key==='Enter')start(1);});
$('settingsBtn').addEventListener('click',toggleSettings);
$('closeSettings').addEventListener('click',toggleSettings);$('closeSettingsPrimary').addEventListener('click',toggleSettings);
$('fullscreenBtn').addEventListener('click',toggleFullscreen);
for(const s of ['turnAmount','fishAmount','smoothAmount'])$(s).addEventListener('input',setSliders);
window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
if(window.ResizeObserver)new ResizeObserver(resize).observe(stage);
window.KokhinhinDebug={state,toggleDoor,setLight,findHit,imagePos,setView(v){state.target=state.yaw=clamp(v,-1,1);},get frames(){return state.frames;},get assets(){return state.loaded;},toggleCamera,setCameraOpen,chooseCamera,get currentCamera(){return currentCamera;},get cameraOpen(){return cameraOpen;},
  enemies:ENEMIES,resetEnemies,
  setEnemyStep(id,step){const e=ENEMIES.find(e=>e.id===id);if(!e)return;
    e.step=clamp(step,0,e.route.length);e.phase=e.step===e.route.length?'door':'approach';
    e.attack=0;e.blocked=0;e.knocks=0;e.nextMove=5;needsComposing=true;updateCameraScene();},
  setPower(value){state.power=clamp(value,0,100);updateOfficePower();},
  startPowerFailure, powerFailure, setNightElapsed(value){state.nightElapsed=clamp(value,0,NIGHT_LENGTH);updateClock();},
  finishNight:finishNight,triggerScreamer(id){if(state.active)finishNight(false,'Тестовый скример петуха C'+id+'.',Number(id));},
  phoneState,forcePhoneRing(){if(state.active && currentNight<=5){resetPhone();startRinging();}},answerPhone,hangUpPhone,
  get phoneVoice(){return phoneVoiceAudio;}, get phoneSubtitle(){return phoneSubtitle.textContent;},
  toggleMute,togglePause,get currentNight(){return currentNight;},get unlockedNight(){return unlockedNight;},
  setLanguage:chooseLanguage,goMenu,updateSaveProgress};
initCanvas();setSliders();updateStatus();resize();requestAnimationFrame(loop);
})();
