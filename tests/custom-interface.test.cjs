'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
const DOC=require('../fnar-endings.js');

test('Payroll wording and signer metadata in both languages',()=>{
  const pay=DOC.getDocument(5,'ru','Example');
  assert.ok(pay.lines.some(x=>x.text.includes('250 долларов.')));
  assert.ok(pay.lines.every(x=>!x.text.includes('долларов США')));
  for(const n of [5,6,7])for(const language of ['ru','ja']){
    const model=DOC.getDocument(n,language,'Example');
    assert.ok(model.signer);
    assert.ok(model.signatureLabel);
  }
  assert.equal(DOC.getDocument(6,'ru','Example').lines.some(x=>x.text.includes('300')),true);
});
test('Signature is vector drawing, not a font or preprinted text',()=>{
  const html=source('index.html');
  const svg=source('assets/ui/director_signature.svg');
  assert.match(svg,/<path/);
  assert.match(svg,/stroke="#1a2948"/);
  assert.doesNotMatch(svg,/<text|<font/i);
  assert.match(html,/id="directorSignatureImage"/);
  assert.match(html,/id="documentSigner"/);
  assert.match(source('app.js'),/model\.signatureLabel/);
});
test('Retro Custom Night uses four stable images and local per-AI updates',()=>{
  const app=source('app.js'),html=source('index.html'),css=source('style.css');
  assert.ok(app.includes("picture.src=getCachedAssetURL('assets/ui/custom/c'"));
  assert.match(app,/picture\.className='custom-ai-portrait'/);
  assert.match(app,/customAI\[i\]=clamp\(customAI\[i\]\+delta,0,20\)/);
  assert.match(app,/writeSave\('kokhinhin_custom_ai'/);
  assert.match(app,/writeSave\('kokhinhin_custom_ai'[\s\S]{0,140}update\(\)/);
  assert.match(app,/startNight:'НАЧАТЬ'/);
  assert.match(app,/startNight:'開始'/);
  assert.match(html,/id="customDifficultyHint"/);
  assert.match(css,/#customScreen \.custom-ai-grid\{display:grid;grid-template-columns:repeat\(4/);
  assert.doesNotMatch(html,/id="customAIGrid"[^]*?id="customStart"[^]*?C1/);
});
test('All main entry points use the guarded fade and active game is deferred',()=>{
  const app=source('app.js'),html=source('index.html'),css=source('style.css');
  assert.match(html,/id="screenTransition"/);
  assert.match(css,/\.screen-transition\.is-transitioning\{pointer-events:all\}/);
  assert.match(app,/if\(transitionBusy\)return false/);
  assert.match(app,/await fadeScreen\(true,700\)/);
  assert.match(app,/await fadeScreen\(false,800\)/);
  assert.match(app,/state\.active=!options\.deferActive/);
  assert.match(app,/state\.active=true;state\.paused=false;state\.last=performance\.now\(\)/);
  assert.match(app,/transitionToNight\(night,\{fromNewspaper:true\}\)/);
  assert.match(app,/function goMenu\(\)\{return sceneTransition/);
  assert.match(app,/transitionToNight\(currentNight\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('All four Custom Night portraits remain original 1152×1536, never thumbnails',()=>{
  for(let i=1;i<=4;i++){
    const file=fs.readFileSync(path.join(root,'assets','ui','custom','c'+i+'.png'));
    assert.ok(file.length>500_000,'portrait must contain full resolution image data: C'+i);
    assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a','true PNG file C'+i);
    const width=file.readUInt32BE(16),height=file.readUInt32BE(20);
    assert.ok(width>=512 && height>=512,'reject thumbnail portrait C'+i);
    assert.equal(width,1152,'original C'+i+' width');
    assert.equal(height,1536,'original C'+i+' height');
  }
});
test('Custom portraits use natural interpolation and new FNAR asset cache',()=>{
  const app=source('app.js'),css=source('style.css');
  assert.match(app,/PRELOAD_CACHE_NAME='fnar-game-assets-v050'/);
  assert.match(css,/#customScreen \.custom-ai-portrait\{[^}]*image-rendering:auto;filter:none;/);
  assert.match(css,/#customScreen \.custom-ai-portrait\{[^}]*object-position:center top;/);
  assert.doesNotMatch(css,/image-rendering:\s*(?:pixelated|crisp-edges)/);
});
