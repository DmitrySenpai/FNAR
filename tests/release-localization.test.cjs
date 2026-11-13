'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
function dictionary(){
  const source=read('app.js');
  const start=source.indexOf('const L10N=');
  const end=source.indexOf('let gameLanguage=',start);
  return vm.runInNewContext(source.slice(start,end)+'\nL10N');
}
function tabletLocales(){
  const source=read('tablet-os.js');
  const end=source.indexOf('  const FAULTS=');
  return vm.runInNewContext(source.slice(source.indexOf('  const ru='),end)+'\n({ru,en,ja})');
}
function tabletFaults(){
  const source=read('tablet-os.js');
  const start=source.indexOf('  const uiText=');
  const end=source.indexOf('  const faultText=',start);
  return vm.runInNewContext(source.slice(start,end)+'\nuiText');
}
test('full translation key parity for main game, including all nine cameras',()=>{
  const locale=dictionary();
  const keys=Object.keys(locale.ru).sort();
  for(const lang of ['ru','en','ja']){
    assert.deepEqual(Object.keys(locale[lang]).sort(),keys);
    for(const key of keys) {
      const value=locale[lang][key];
      if(Array.isArray(value)){assert.equal(value.length,9);for(const item of value)assert.ok(item);}
      else assert.ok(typeof value==='string'&&value.length>0,lang+' '+key);
    }
  }
  assert.deepEqual([...locale.en.camNames],['North Area','Corridor','Right Corridor','Reception','Open Space','Left Corridor','Left Exit',"Director's Office",'Right Exit']);
  assert.equal(locale.ru.retryNight,'ПОВТОРИТЬ');
  assert.equal(locale.en.retryNight,'RETRY');
  assert.equal(locale.ja.retryNight,'リトライ');
});
test('tablet has fully translated 28 adverts and all fault messages',()=>{
  const d=tabletLocales(), ui=tabletFaults();
  for(const lang of ['ru','en','ja']){
    assert.equal(d[lang].ads.length,28);
    for(const [head,body] of d[lang].ads){assert.ok(head.length>0);assert.ok(body.length>0);}
    assert.deepEqual(Object.keys(ui[lang]).sort(),Object.keys(ui.ru).sort());
    for(const v of Object.values(ui[lang]))assert.ok(typeof v==='string'&&v.length>0);
  }
  assert.equal(d.en.accept,'Accept');assert.equal(d.en.cancel,'Cancel');
  assert.match(ui.en.crashBody,/encountered a critical error/);
});
test('phone dialogues have all nights, translated, no fake English voice path',()=>{
  const context={window:{}};
  vm.runInNewContext(read('phone-dialogues.js'),context);
  const d=context.window.KOKHINHIN_PHONE_TEXTS;
  for(let night=1;night<=5;night++){
    const k=String(night);
    assert.ok(Array.isArray(d.en[k])&&d.en[k].length);
    assert.equal(d.en[k].length,d.ru[k].length,'English must align with existing Russian call segments');
    assert.equal(d.en[k].length===1,d.ru[k].length===1);
  }
  assert.ok(d.en['1'].some(line=>line.includes('[НАЗВАНИЕ ОФИСА]')));
  assert.ok(!read('app.js').includes("soundURL('phone_en_"));
  assert.match(read('app.js'),/phoneVoiceAudio\.currentTime/);
});
test('all three English documents preserve payment amounts, stamps and office name',()=>{
  const docs=require('../fnar-endings.js');
  for(const lang of ['ru','en','ja'])for(const n of [5,6,7]){
    const doc=docs.getDocument(n,lang,'ABC株式会社',50);
    assert.equal(doc.company.includes('ABC株式会社'),true);
    assert.ok(doc.lines.length>=5);
  }
  assert.equal(docs.getDocument(5,'en','Test').title,'SALARY PAYMENT NOTICE');
  assert.equal(docs.getDocument(6,'en','Test').title,'ADDITIONAL PAYMENT NOTICE');
  assert.equal(docs.getDocument(7,'en','Test').title,'NOTICE OF TERMINATION');
  assert.ok(docs.getDocument(6,'en','X',50).lines.some(x=>x.text.includes('300 dollars')));
});
test('language menu, selection safety and old save key preserved',()=>{
  const html=read('index.html'),app=read('app.js'),css=read('style.css');
  for(const id of ['languageRu','languageEn','languageJa']) assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/data-i18n="chooseLanguage"/);
  assert.match(css,/#languageScreen \.language-buttons\s*\{[^}]*flex-direction:column/s);
  assert.match(css,/#officeInput[^}]*user-select:text/s);
  assert.match(css,/#app, #stage, #stage \*/);
  assert.match(app,/writeSave\('kokhinhin_lang',gameLanguage\)/);
  assert.match(app,/const savedLanguage=readSave\('kokhinhin_lang'\)/);
  assert.match(app,/document\.documentElement\.lang=gameLanguage/);
  assert.ok(!app.includes("localStorage.clear()"));
});
