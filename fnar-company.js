/* Deterministic company identity: no browser storage or RNG dependencies. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FNAR_COMPANY=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SPECS=Object.freeze([
    Object.freeze({id:'restless',target:1,type:'movementDelay',value:-.05,special:false}),
    Object.freeze({id:'watched',target:2,type:'observationSlowdown',value:.05,special:false}),
    Object.freeze({id:'director',target:3,type:'angerRate',value:.05,special:false}),
    Object.freeze({id:'chaotic',target:4,type:'burstChance',value:.05,special:false})
  ]);
  const SPECIAL=Object.freeze({
    'курятник':Object.freeze({id:'coop',target:3,type:'angerRate',value:.07,special:true}),
    'net system':Object.freeze({id:'net-system',target:2,type:'observationSlowdown',value:.05,special:true}),
    'chicken.exe':Object.freeze({id:'chicken-exe',target:4,type:'burstChance',value:.05,special:true}),
    'петушиная корпорация':Object.freeze({id:'rooster-corp',target:1,type:'movementDelay',value:-.05,special:true}),
    'тихий офис':Object.freeze({id:'quiet-office',target:3,type:'angerRate',value:-.05,special:true})
  });
  function normalize(name){
    return String(name??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/gu,' ');
  }
  function hash(name){
    // FNV-1a over UTF-8 bytes (TextEncoder-equivalent; stable for Unicode).
    const utf8=unescape(encodeURIComponent(name));
    let h=0x811c9dc5;
    for(let i=0;i<utf8.length;i++){
      h^=utf8.charCodeAt(i);
      h=Math.imul(h,0x01000193)>>>0;
    }
    return h>>>0;
  }
  function getCompanyProfile(name){
    const companyName=String(name??''),normalizedName=normalize(companyName);
    const neutral=normalizedName===''||normalizedName==='мой офис'||normalizedName==='私のオフィス';
    const spec=neutral?{id:'neutral',target:null,type:null,value:0,special:false}:
      (SPECIAL[normalizedName]||SPECS[hash(normalizedName)%4]);
    return Object.freeze({companyName,normalizedName,profileId:spec.id,
      target:spec.target,modifierType:spec.type,modifierValue:spec.value,
      special:spec.special,hash:neutral?null:hash(normalizedName)});
  }
  function applyCompanyProfile(base,profile,night){
    if(!Number.isInteger(night)||night<2||night>6||!profile||!profile.target)
      return Object.freeze({active:false,target:null,movementFactor:1,backFactor:1,
        c2WatchFactor:1,c2HoldFactor:1,c3AngerFactor:1,c4BurstFactor:1});
    const value=Math.max(-.07,Math.min(.07,Number(profile.modifierValue)||0));
    const result={active:true,target:profile.target,movementFactor:1,backFactor:1,
      c2WatchFactor:1,c2HoldFactor:1,c3AngerFactor:1,c4BurstFactor:1};
    if(profile.modifierType==='movementDelay'&&profile.target===1){
      result.movementFactor=1+value;result.backFactor=1+value;
    }else if(profile.modifierType==='observationSlowdown'&&profile.target===2){
      result.c2WatchFactor=1-Math.abs(value);result.c2HoldFactor=1+Math.abs(value);
    }else if(profile.modifierType==='angerRate'&&profile.target===3){
      result.c3AngerFactor=1+value;
    }else if(profile.modifierType==='burstChance'&&profile.target===4){
      result.c4BurstFactor=1+Math.abs(value);
    }else result.active=false;
    return Object.freeze(result);
  }
  return Object.freeze({normalize,hash,getCompanyProfile,applyCompanyProfile});
});
