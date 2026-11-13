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
  assert.match(app,/picture\.src='assets\/ui\/custom\/c'/);
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
  assert.match(app,/prefers-reduced-motion:reduce/);
});
