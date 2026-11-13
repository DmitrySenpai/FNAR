/* Five Nights at Rooster's: deterministic, frame-rate independent enemy AI.
   Browser: window.FNAR_AI; Node tests: require('./fnar-ai.js').
   No DOM, audio, game-loop or asset dependencies. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.FNAR_AI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PHASES=Object.freeze({
    DORMANT:'DORMANT',PATROL:'PATROL',APPROACH:'APPROACH',DOOR:'DOOR',
    RETREAT:'RETREAT',REST:'REST',WATCH:'WATCH',ANGRY:'ANGRY',RUSH:'RUSH'
  });
  const NIGHT_LENGTH=360;
  function nightConfig(movementScale,c3Threshold,attackWindow,closedWait,restMin,restMax,awake,c2WatchRatio,c2Hold,c4Burst,c4Hold,dangerCap){
    return Object.freeze({movementScale,c3Threshold,attackWindow,closedWait,restMin,restMax,
      awake:Object.freeze(awake),c2WatchRatio,c2Hold,c4Burst,c4Hold,dangerCap});
  }
  const NIGHT_CONFIG=Object.freeze({
    1:nightConfig(1.20,Infinity,6.0,5.7,27,30,{1:8,2:65,3:0,4:205},.52,.48,0,.29,1),
    2:nightConfig(1.00,45,5.5,5.5,24,29,{1:5,2:42,3:0,4:74},.55,.43,.035,.26,1),
    3:nightConfig(.90,37,5.0,5.2,21,27,{1:4,2:25,3:0,4:36},.60,.38,.17,.23,1),
    4:nightConfig(.80,30,4.5,5.0,19,25,{1:3,2:17,3:0,4:23},.65,.32,.23,.19,2),
    5:nightConfig(.70,26,4.0,4.8,17,23,{1:2,2:11,3:0,4:13},.71,.25,.30,.17,2),
    6:nightConfig(.60,22,3.6,4.5,15,20,{1:1,2:7,3:0,4:8},.78,.20,.39,.13,2),
    7:nightConfig(.50,18,3.2,4.2,15,18,{1:1,2:4,3:0,4:5},.84,.15,.45,.11,2)
  });
  const ENEMY_DEFS=Object.freeze([
    Object.freeze({id:1,side:'left',route:Object.freeze([5,4,6,7]),min:10,max:17,back:.11}),
    Object.freeze({id:2,side:'right',route:Object.freeze([1,8,3,9]),min:14,max:23,back:.18}),
    Object.freeze({id:3,side:'right',route:Object.freeze([8,3,9]),min:17,max:27,back:0}),
    Object.freeze({id:4,side:'left',route:Object.freeze([2,5,4,6,7]),min:13,max:22,back:.20})
  ]);
  const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
  function rand(g,min,max){return min+(max-min)*clamp(g.rng(),0,0.999999999999);}
  function movementDelay(g,e){return rand(g,e.min,e.max)*g.config.movementScale;}
  function makeEnemy(def){
    return {id:def.id,side:def.side,route:[...def.route],min:def.min,max:def.max,
      step:0,phase:PHASES.DORMANT,nextMove:0,attack:0,blocked:0,knocks:0,
      cycles:0,retreatTo:0,anger:0,watchTime:0,angerThreshold:Infinity,burst:0,holds:0};
  }
  function createNight(night=1,rng=Math.random){
    const g={night:1,config:NIGHT_CONFIG[1],enemies:ENEMY_DEFS.map(makeEnemy),
      elapsed:0,rng,events:[]};
    return resetNight(g,night,rng);
  }
  function resetNight(g,night,rng){
    if(!Number.isInteger(night)||!NIGHT_CONFIG[night])throw new RangeError('Night must be 1–7');
    g.night=night;g.config=NIGHT_CONFIG[night];g.elapsed=0;
    if(typeof rng==='function')g.rng=rng;
    if(typeof g.rng!=='function')g.rng=Math.random;
    if(!Array.isArray(g.enemies))g.enemies=[];
    g.enemies.splice(0,g.enemies.length,...ENEMY_DEFS.map(def=>{
      const e=makeEnemy(def);
      e.phase=e.id===3?PHASES.WATCH:PHASES.DORMANT;
      e.nextMove=e.id===3?0:g.config.awake[e.id];
      e.angerThreshold=g.config.c3Threshold;
      return e;
    }));
    g.events=[];return g;
  }
  function isDanger(e){
    return e.phase!==PHASES.DORMANT && e.phase!==PHASES.REST &&
      e.step>=e.route.length-2;
  }
  function canAdvance(g,e,step){
    if(step<e.route.length-2)return true;
    const busy=g.enemies.filter(other=>other!==e && isDanger(other));
    return busy.length<g.config.dangerCap && !busy.some(other=>other.side===e.side);
  }
  function emit(events,type,e,extra={}){
    events.push({type,id:e.id,side:e.side,step:e.step,
      camera:e.step<e.route.length?e.route[e.step]:null,...extra});
  }
  function beginRetreat(g,e,events){
    e.phase=PHASES.RETREAT;e.attack=0;e.blocked=0;e.knocks=0;e.burst=0;e.holds=0;
    e.cycles++;e.nextMove=rand(g,1.15,2.30);emit(events,'retreat',e);
  }
  function enterDoor(g,e,events){
    e.phase=PHASES.DOOR;e.step=e.route.length;
    e.attack=0;e.blocked=0;e.knocks=0;e.burst=0;e.nextMove=0;
    emit(events,'warning',e,{reactionSeconds:g.config.attackWindow});
  }
  function attemptStep(g,e,events,fast=false){
    const next=e.step+1;
    if(!canAdvance(g,e,next)){
      // No jumping past a crowded final corridor; retry without piling up at the door.
      e.nextMove=rand(g,2.5,5.5);e.burst=0;
      if(e.step>0 && e.phase!==PHASES.RUSH && g.rng()<.22){
        e.step--;e.phase=PHASES.PATROL;emit(events,'move',e,{back:true,fast:false});
      }
      return false;
    }
    if(next>=e.route.length){enterDoor(g,e,events);return true;}
    e.step=next;
    if(e.phase!==PHASES.RUSH)
      e.phase=next>=e.route.length-2?PHASES.APPROACH:PHASES.PATROL;
    emit(events,'move',e,{back:false,fast});
    return true;
  }
  function updateC3(g,e,dt,observing,events){
    if(!Number.isFinite(g.config.c3Threshold))return; // Night one: visible, harmless.
    e.watchTime=observing?Math.min(10,e.watchTime+dt):0;
    // The 1.4s requirement is continuous; a quick camera tap gives no relief.
    const delta=e.watchTime>=1.4?-dt*2.4:dt;
    e.anger=clamp(e.anger+delta/g.config.c3Threshold,0,1);
    if(e.anger>=1){
      e.anger=1;e.phase=PHASES.RUSH;e.watchTime=0;
      e.nextMove=rand(g,.75,1.15);emit(events,'rush',e);
    }else if(e.anger>=.58){
      if(e.phase!==PHASES.ANGRY){e.phase=PHASES.ANGRY;emit(events,'anger',e);}
    }else{
      e.phase=PHASES.WATCH;
    }
  }
  function tick(g,dt,input={}){
    const events=[];
    if(!Number.isFinite(dt)||dt<=0)return events;
    // One logical transition per frame, even after a temporary browser stall.
    dt=Math.min(dt,.1);g.elapsed+=dt;
    const seeing=Number(input.camera)||0;
    for(const e of g.enemies){
      if(e.phase===PHASES.DORMANT){
        e.nextMove=Math.max(0,e.nextMove-dt);
        if(e.nextMove===0){
          e.phase=PHASES.PATROL;
          e.nextMove=movementDelay(g,e);
          emit(events,'wake',e);
        }
        continue;
      }
      if(e.id===3 && (e.phase===PHASES.WATCH||e.phase===PHASES.ANGRY)){
        if(input.c3Protected){
          // Technical inability to watch CAM 08: freeze anger without calming it.
          // An already rushing C3 never enters this branch.
          e.watchTime=0;
          continue;
        }
        updateC3(g,e,dt,Boolean(input.cameraOpen && seeing===8),events);
        continue;
      }
      if(e.phase===PHASES.DOOR){
        const shut=e.side==='left'?Boolean(input.leftClosed):Boolean(input.rightClosed);
        if(shut){
          e.attack=0;e.blocked+=dt;
          if(!e.knocks){e.knocks=1;emit(events,'knock',e);}
          if(e.blocked>=g.config.closedWait)beginRetreat(g,e,events);
        }else{
          e.blocked=0;e.knocks=0;e.attack+=dt;
          if(e.attack>=g.config.attackWindow){
            e.attack=g.config.attackWindow;
            emit(events,'attack',e);
            // The hosting game ends the night on this event.
            e.phase=PHASES.REST;
            e.nextMove=Number.POSITIVE_INFINITY;
          }
        }
        continue;
      }
      if(e.phase===PHASES.RETREAT){
        e.nextMove=Math.max(0,e.nextMove-dt);
        if(e.nextMove>0)continue;
        const prev=e.step;
        e.step=Math.max(0,e.step-1);
        if(e.step!==prev)emit(events,'move',e,{back:true,fast:e.id===3||e.id===4});
        if(e.step===0){
          e.phase=PHASES.REST;e.nextMove=rand(g,g.config.restMin,g.config.restMax);
          if(e.id===4)e.nextMove*=.78;
          if(e.id===3){e.anger=0;e.watchTime=0;}
          emit(events,'rest',e);
        }else{
          e.nextMove=rand(g,e.id===3?1.2:1.8,e.id===3?2.0:3.7);
        }
        continue;
      }
      if(e.phase===PHASES.REST){
        e.nextMove=Math.max(0,e.nextMove-dt);
        if(e.nextMove===0){
          e.phase=e.id===3?PHASES.WATCH:PHASES.PATROL;
          e.nextMove=e.id===3?0:movementDelay(g,e);
          emit(events,'resume',e);
        }
        continue;
      }
      const observed=Boolean(input.cameraOpen&&seeing===e.route[e.step]);
      // C2 is delayed, never permanently immobilized, by camera observation.
      const watchRatio=e.id===2&&observed?g.config.c2WatchRatio:1;
      e.nextMove=Math.max(0,e.nextMove-dt*watchRatio);
      if(e.nextMove>0)continue;
      if(e.phase===PHASES.RUSH){
        if(attemptStep(g,e,events,true) && e.phase===PHASES.RUSH)
          e.nextMove=rand(g,.8,1.4);
        continue;
      }
      if(e.id===2 && observed && e.holds<2 && g.rng()<g.config.c2Hold){
        e.holds++;e.nextMove=movementDelay(g,e)*.45;
        continue;
      }
      if(e.id===4 && e.burst===0 && e.holds<1 && g.rng()<g.config.c4Hold){
        e.holds++;e.nextMove=movementDelay(g,e)*rand(g,1.15,1.9);
        continue;
      }
      const consecutive=e.burst>0;
      e.burst=0;e.holds=0;
      const backChance=e.id===1?.11:e.id===2?.18:e.id===4?.20:0;
      if(!consecutive && e.step>0 && e.step<e.route.length-2 && g.rng()<backChance){
        e.step--;e.phase=PHASES.PATROL;
        emit(events,'move',e,{back:true,fast:false});
        e.nextMove=movementDelay(g,e)*.85;
        continue;
      }
      const moved=attemptStep(g,e,events,consecutive);
      if(!moved||e.phase===PHASES.DOOR)continue;
      if(e.id===4 && !consecutive && g.rng()<g.config.c4Burst){
        // Two actual single-node transitions, separated by a noticeable delay.
        e.burst=1;e.nextMove=rand(g,.62,1.08);
      }else{
        e.nextMove=movementDelay(g,e);
      }
    }
    g.events=events;return events;
  }
  function visibleIds(g,camera){
    return g.enemies.filter(e=>e.phase!==PHASES.DORMANT &&
      e.step<e.route.length && e.route[e.step]===camera)
      .map(e=>e.id).sort((a,b)=>a-b);
  }
  return Object.freeze({PHASES,NIGHT_LENGTH,NIGHT_CONFIG,ENEMY_DEFS,
    createNight,resetNight,tick,visibleIds,isDanger,canAdvance});
});
