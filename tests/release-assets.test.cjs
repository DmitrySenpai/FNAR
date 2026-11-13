'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function literalArray(name){
  const app=read('app.js');
  const match=app.match(new RegExp('const '+name+'\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;'));
  assert.ok(match,'Missing '+name+' asset list');
  return vm.runInNewContext(match[1],Object.create(null));
}
function listedAssets(){
  const rooms=literalArray('names').map(file=>'assets/room/'+file);
  const cameras=literalArray('PRELOAD_CAMERA_NAMES').map(file=>'assets/cameras/'+file);
  const sounds=literalArray('PRELOAD_SOUND_NAMES').map(file=>'assets/sound/'+file+'.mp3');
  return [
    ...rooms,...cameras,...sounds,
    ...[1,2,3,4].map(n=>'assets/screamers/rooster_'+n+'_scream.webm'),
    ...[1,2,3,4].map(n=>'assets/ui/custom/c'+n+'.png'),
    'assets/sound/static-bm.webm','assets/menu/rooster_menu.webp',
    'assets/ui/today_news.webp','assets/ui/director_signature.svg',
    'assets/ui/resignation_letter.webp',
    ...['shutdown','desktop','netvideo','boot'].map(n=>'assets/ui/tablet/'+n+'.webp')
  ];
}
test('all mandatory loader assets exist as nonempty files',()=>{
  const assets=listedAssets();
  assert.ok(assets.length>=85,'Resource list unexpectedly short: '+assets.length);
  for(const file of new Set(assets)){
    const full=path.join(root,file);
    assert.ok(fs.existsSync(full),'Missing resource: '+file);
    assert.ok(fs.statSync(full).size>0,'Empty resource: '+file);
  }
});
test('Custom Night portraits remain full-resolution original PNGs',()=>{
  for(let n=1;n<=4;n++){
    const name='assets/ui/custom/c'+n+'.png',data=fs.readFileSync(path.join(root,name));
    assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name+' PNG signature');
    assert.equal(data.readUInt32BE(16),1152,name+' original width');
    assert.equal(data.readUInt32BE(20),1536,name+' original height');
  }
});
test('essential scripts referenced by HTML exist',()=>{
  const html=read('index.html');
  for(const m of html.matchAll(/<script\s+src="([^"]+)"/g)){
    const file=m[1].split('?')[0];
    assert.ok(fs.existsSync(path.join(root,file)),'Missing referenced script: '+file);
  }
  for(const m of html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)){
    const file=m[1].split('?')[0];
    assert.ok(fs.existsSync(path.join(root,file)),'Missing stylesheet: '+file);
  }
});
