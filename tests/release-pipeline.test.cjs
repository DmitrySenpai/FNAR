'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('GitHub Pages deploy job depends on required release checks',()=>{
  const deploy=read('.github/workflows/static.yml');
  const regression=read('.github/workflows/ai-regression.yml');
  assert.match(deploy,/jobs:\s*\n\s*checks:\s*\n\s*uses:\s*\.\/\.github\/workflows\/ai-regression\.yml/);
  assert.match(deploy,/deploy:\s*\n\s*needs:\s*checks/);
  assert.match(deploy,/if:\s*github\.ref\s*==\s*'refs\/heads\/main'/);
  assert.match(deploy,/actions\/upload-pages-artifact/);
  assert.match(deploy,/actions\/deploy-pages/);
  assert.match(regression,/workflow_call:/);
  assert.match(regression,/pull_request:/);
  assert.match(regression,/node --check "\$file"/);
  assert.match(regression,/fnar-audio\.js/);
  assert.match(regression,/node --test tests\/\*\.test\.cjs/);
  assert.ok(!/deploy-pages/.test(regression),'Pull-request check workflow must never deploy');
});
test('critical assets stay eager and Custom Night portraits complete before first display',()=>{
  const source=read('app.js');
  const block=source.slice(source.indexOf('const paths=['),source.indexOf('let done=0;'));
  for(const snippet of ['assets/room/','assets/cameras/','assets/sound/','assets/screamers/'])
    assert.ok(block.includes(snippet),'Mandatory list should include '+snippet);
  assert.ok(!block.includes("'assets/ui/custom/c'"),'Custom portraits must be deferred');
  assert.match(source,/const DEFERRED_CUSTOM_ASSETS=\[1,2,3,4\]/);
  assert.match(source,/async function ensureCustomPortraits\(/);
  assert.match(source,/await ensureCustomPortraits\(\)/);
  assert.ok(source.indexOf('await ensureCustomPortraits()')<source.indexOf("renderCustomAI();$('customScreen').classList.remove('hidden')"));
});
test('game progression and media rights are not silently declared complete',()=>{
  const readme=read('README.md'),changelog=read('CHANGELOG.md'),rights=read('ASSET_RIGHTS.md');
  assert.match(readme,/Five Nights at Rooster/);
  assert.doesNotMatch(readme,/LICENSE|licen[sc]e|лицензи|ライセンス/i);
  assert.match(readme,/<img src="assets\/branding\/fnar-logo\.webp"/);
  for(const text of ['<a id="japanese">','<a id="russian">','<a id="english">'])assert.ok(readme.includes(text));
  assert.ok(fs.existsSync(path.join(root,'assets/branding/fnar-logo.webp')),'README banner asset missing');
  assert.match(readme,/dmitrysenpai\.github\.io\/FNAR\/index\.html/);
  const logo=fs.readFileSync(path.join(root,'assets/branding/fnar-logo.webp'));
  assert.ok(logo.length>2000,'README logo must contain image data');
  assert.equal(logo.subarray(0,4).toString(),'RIFF');
  assert.equal(logo.subarray(8,12).toString(),'WEBP');
  assert.match(changelog,/Release candidate/);
  assert.match(rights,/Статус: открытый аудит/);
  assert.match(read('app.js'),/readSave\('kokhinhin_unlocked'/);
  assert.ok(!read('app.js').includes('localStorage.clear()'));
  assert.ok(!read('fnar-audio.js').includes('localStorage.clear()'));
});
