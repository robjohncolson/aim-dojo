// OPTIONAL DIAGNOSTIC ONLY. Append inside the served accepted-runtime closure;
// never load this file from index.html or include it in a release.
//
// Assisted mouse input exercises the existing fire -> projectile -> collision ->
// grading path. It never grants hits, creates targets, alters physics/tempo,
// moves the camera directly, or changes the random stream deliberately. Existing
// computeShotPlan/simShotHits supply the launch and steering hints. Their shared
// scratch values are restored after reads so the normal preview owns its output.
//
// LIMITATIONS: this adds planning work and changes viewpoint/input/workload, so
// use it for separate first-hit/audio/lifecycle diagnostics, not minimal frame
// benchmarks or claims about human input latency. Prediction assumes the target
// keeps its current velocity for <= 3 s; normal Brownian motion, juke, growth,
// variable simulation dt, recoil, intervening targets and tempo changes can make
// a real shot miss. No failure is converted to a hit. The real collision radius
// is used for arrival prediction (the scope's extra 0.12 m halo is insufficient).
// The returned computeShotPlan T is ground/lifetime time, NOT target-hit time.
// Non-decoy single-hit targets only; tanks and bonus mode retain normal behavior
// and are not assisted. Main night and lesson phases 1/2 are supported; phase 0
// still requires ordinary WASD input. No input is sent while paused or in Temple.
// Logs are bounded; outcome deltas are observations, and cannot attribute a
// simultaneous externally driven hit without a recorded-night fire marker.
window.__pcAim = (() => {
  const STEP_MS=50, MAX_TARGETS=64, MAX_LOG=12000, MAX_PREDICT_SECONDS=3;
  const MAX_RUN_MS=10*60*1000, MAX_LAUNCHES=256, TURN_LIMIT=0.16;
  const M=new THREE.Vector3(), V=new THREE.Vector3(), forward=new THREE.Vector3();
  const savedDir=new THREE.Vector3(), savedPos=new THREE.Vector3(), savedVel=new THREE.Vector3();
  const savedImpact=new THREE.Vector3(), savedRight=new THREE.Vector3();
  const predictedMiss={x:0,y:0,z:0,h2:Infinity};
  const log=[], identities=new WeakMap();
  let enabled=false, raf=null, startedAt=0, endedAt=null, lastTick=-Infinity;
  let target=null, targetBorn=null, targetId=null, nextId=0, pending=null;
  let launched=0, attempts=0, dropped=0, planningMs=0, maxPlanningMs=0;
  let lastFire=-Infinity, lastWait=-Infinity, lastWaitReason='', lastHits=0;

  const append=(kind,data={})=>{
    if(log.length<MAX_LOG)log.push({...data,kind,at:performance.now(),gameTime:state.t});
    else dropped++;
  };
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const eligible=tg=>!!(tg&&!tg.dead&&tg.mesh&&tg.kind!==2&&tg.hpMax<=1);
  const identify=tg=>{
    let row=identities.get(tg);
    if(!row||row.born!==tg.born||row.mesh!==tg.mesh){
      row={id:++nextId,born:tg.born,mesh:tg.mesh};identities.set(tg,row);
    }
    return row.id;
  };
  const waitReason=reason=>{
    const now=performance.now();
    if(reason!==lastWaitReason||now-lastWait>=1000){append('wait',{reason,targetId});lastWait=now;lastWaitReason=reason;}
  };
  const move=(dy,dp,reason)=>{
    dy=clamp(wrap(dy),-TURN_LIMIT,TURN_LIMIT);dp=clamp(dp,-TURN_LIMIT,TURN_LIMIT);
    if(!Number.isFinite(dy)||!Number.isFinite(dp)||!(radPerPx>0))return false;
    const beforeYaw=yaw,beforePitch=pitch;
    document.dispatchEvent(new MouseEvent('mousemove',{
      bubbles:true,movementX:-dy/radPerPx,movementY:-dp/radPerPx
    }));
    append('aim',{targetId,reason,deltaYaw:dy,deltaPitch:dp,
      appliedYaw:yaw-beforeYaw,appliedPitch:pitch-beforePitch});
    return Math.abs(yaw-beforeYaw)+Math.abs(pitch-beforePitch)>1e-8;
  };
  const choose=()=>{
    if(eligible(target)&&target.born===targetBorn&&targets.includes(target))return false;
    target=null;targetBorn=null;targetId=null;
    let best=Infinity;
    for(let i=0;i<Math.min(MAX_TARGETS,targets.length);i++){
      const tg=targets[i];if(!eligible(tg))continue;
      const p=tg.mesh.position,dx=p.x-PLAYER_POS.x,dy=p.y-PLAYER_POS.y,dz=p.z-PLAYER_POS.z;
      const d2=dx*dx+dy*dy+dz*dz;if(d2<best){best=d2;target=tg;}
    }
    if(target){targetBorn=target.born;targetId=identify(target);append('target',{targetId,born:targetBorn,orbKind:target.kind});}
    return !!target;
  };
  const plan=()=>{
    // Both existing helpers write shared preview scratch. Restore it even if a
    // changed runtime throws; M/V are private reusable diagnostic vectors.
    savedDir.copy(_arcDir);savedPos.copy(_arcPos);savedVel.copy(_arcVel);
    savedImpact.copy(_arcI);savedRight.copy(_arcRight);
    const landed=_planLanded,vmiss=_scVMiss,missx=_scMissX,missz=_scMissZ,on=_scVMissOn;
    try{
      const groundT=computeShotPlan(M,V),locked=simShotHits(M,V,groundT,target);
      return {groundT,locked,vertical:_scVMiss,x:_scMissX,z:_scMissZ,hints:_scVMissOn};
    }finally{
      _arcDir.copy(savedDir);_arcPos.copy(savedPos);_arcVel.copy(savedVel);
      _arcI.copy(savedImpact);_arcRight.copy(savedRight);_planLanded=landed;
      _scVMiss=vmiss;_scMissX=missx;_scMissZ=missz;_scVMissOn=on;
    }
  };
  const impactTime=groundT=>{
    const step=1/90,limit=Math.min(MAX_PREDICT_SECONDS,groundT+0.15,CFG.projLife);
    const p=target.mesh.position,tv=target.vel,rr=target.radius*target.sc+CFG.projRadius;
    let px=M.x,py=M.y,pz=M.z,vx=V.x,vy=V.y,vz=V.z;
    predictedMiss.x=0;predictedMiss.y=0;predictedMiss.z=0;predictedMiss.h2=Infinity;
    // Relative segment/sphere intersection gives first contact, rather than
    // mistaking the scope's closest horizontal pass or ground time for arrival.
    for(let t=0;t<limit;t+=step){
      const dt=Math.min(step,limit-t),ax=px-(p.x+tv.x*t),ay=py-(p.y+tv.y*t),az=pz-(p.z+tv.z*t);
      vx+=windX*dt;vy-=CFG.projGravity*dt;vz+=windZ*dt;
      px+=vx*dt;py+=vy*dt;pz+=vz*dt;
      const bx=px-(p.x+tv.x*(t+dt)),by=py-(p.y+tv.y*(t+dt)),bz=pz-(p.z+tv.z*(t+dt));
      const h2=bx*bx+bz*bz;
      if(h2<predictedMiss.h2){predictedMiss.h2=h2;predictedMiss.x=bx;predictedMiss.y=by;predictedMiss.z=bz;}
      const dx=bx-ax,dy=by-ay,dz=bz-az,a=dx*dx+dy*dy+dz*dz;
      const b=2*(ax*dx+ay*dy+az*dz),c=ax*ax+ay*ay+az*az-rr*rr;
      if(c<=0)return t;
      const disc=b*b-4*a*c;
      if(a>1e-12&&disc>=0){const f=(-b-Math.sqrt(disc))/(2*a);if(f>=0&&f<=1)return t+f*dt;}
      if(py<=0.04||Math.abs(px)>ROOM_HALF_W||Math.abs(pz)>ROOM_HALF_D)return null;
    }
    return null;
  };
  const observe=()=>{
    if(!pending||projectiles.includes(pending.projectile))return;
    const marked=pending.fireRow?pending.fireRow[3]===1:null;
    append('outcome',{fireId:pending.id,targetId:pending.targetId,
      recorderHit:marked,hitsDelta:state.hits-pending.hits,shotsDelta:state.shots-pending.shots,
      targetRetired:!eligible(pending.target)||pending.target.born!==pending.born,
      outcome:marked===true?'recorded-hit':state.hits>pending.hits?'score-increased':'retired-without-score',
      elapsedSec:(performance.now()-pending.at)/1000});
    pending=null;
  };
  const assist=now=>{
    observe();
    if(!state.running||templeActive||(trainMode&&trainPhase===0)||_bow.stage>=BOW.LAST||bonusActive){waitReason('scene-gate');return;}
    if(!toneReady||!soundOn||Tone.Transport.state!=='started'){waitReason('clock-gate');return;}
    if(pending||projectiles.length){waitReason('projectile-in-flight');return;}
    const acquired=choose();if(!target){waitReason('no-eligible-target');return;}
    const p=target.mesh.position,dx=p.x-PLAYER_POS.x,dy=p.y-PLAYER_POS.y,dz=p.z-PLAYER_POS.z;
    const horizontal=Math.max(0.1,Math.hypot(dx,dz));
    const wantYaw=Math.atan2(-dx,-dz),wantPitch=Math.atan2(dy,horizontal);
    if(acquired||Math.abs(wrap(wantYaw-camera.rotation.y))>0.45){
      move(wrap(wantYaw-camera.rotation.y),wantPitch-camera.rotation.x,'acquire');return;
    }
    const shot=plan();
    camera.getWorldDirection(forward);const fl=Math.hypot(forward.x,forward.z)||1;
    const lateral=shot.x*(-forward.z/fl)+shot.z*(forward.x/fl);
    if(!shot.locked){
      if(shot.hints)move(Math.atan2(lateral,horizontal),-Math.atan2(shot.vertical,horizontal),'scope-correction');
      else waitReason('no-plan-hints');
      return;
    }
    const contact=impactTime(shot.groundT);
    if(contact===null){
      // The scope halo can claim lock where the real sphere does not intersect.
      // Our stricter predictor retains its miss after simShotHits has zeroed
      // the scope hints, so steering can leave that halo without a fake hit.
      const lat=predictedMiss.x*(-forward.z/fl)+predictedMiss.z*(forward.x/fl);
      if(Number.isFinite(predictedMiss.h2))move(Math.atan2(lat,horizontal),-Math.atan2(predictedMiss.y,horizontal),'scope-halo-only');
      else waitReason('no-real-intersection');
      return;
    }
    const spb=60/Math.max(20,state.bpm),rawBeat=Tone.Transport.ticks/Tone.Transport.PPQ;
    const heardArrival=rawBeat+(contact-audioLat())/spb;
    const early=clamp(CFG.grooveFireEarlyBeat==null?0:CFG.grooveFireEarlyBeat,0,0.45);
    const ideal=Math.round(heardArrival+early)-early,offsetSec=(heardArrival-ideal)*spb;
    const win=CFG.grooveOpenSec[0]+(CFG.grooveOpenSec[1]-CFG.grooveOpenSec[0])*diffT();
    const safeWindow=Math.min(0.055,Math.max(0,win*0.4));
    if(Math.abs(offsetSec)>safeWindow){waitReason('arrival-window');return;}
    if(now-lastFire<350){waitReason('driver-fire-spacing');return;}
    // Let the actual canvas handler own relock attempts and its fallback. A
    // synthetic driver's extra relock guard would prevent the click that clears it.
    if(_skySelectHeld||_templeChatOpen||_templeFreeMouse){waitReason('mouse-owner');return;}
    const beforeCount=projectiles.length,beforeHits=state.hits,beforeShots=state.shots;
    const fireId=++attempts;lastFire=now;
    append('fire-intent',{fireId,targetId,bpm:state.bpm,rawBeat,contactSec:contact,
      groundSec:shot.groundT,heardArrival,idealBeat:ideal,offsetSec,safeWindow,
      muzzle:[M.x,M.y,M.z],velocity:[V.x,V.y,V.z],targetPosition:[p.x,p.y,p.z],
      targetVelocity:[target.vel.x,target.vel.y,target.vel.z],yaw,pitch});
    canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,buttons:1,bubbles:true}));
    canvas.dispatchEvent(new MouseEvent('mouseup',{button:0,buttons:0,bubbles:true}));
    if(projectiles.length>beforeCount){
      launched++;const projectile=projectiles[projectiles.length-1];
      pending={id:fireId,projectile,fireRow:projectile.fireRow,target,born:targetBorn,targetId,
        at:performance.now(),hits:beforeHits,shots:beforeShots};
      append('launched',{fireId,targetId,projectiles:projectiles.length});
    }else append('input-rejected',{fireId,targetId,fireGrid:_fireGrid});
  };
  const tick=now=>{
    raf=null;if(!enabled)return;
    if(now-startedAt>=MAX_RUN_MS||launched>=MAX_LAUNCHES){stop('budget');return;}
    if(now-lastTick>=STEP_MS){
      lastTick=now;const began=performance.now();
      try{assist(now);}catch(e){append('error',{message:String(e.stack||e)});stop('error');return;}
      const cost=performance.now()-began;planningMs+=cost;maxPlanningMs=Math.max(maxPlanningMs,cost);
    }
    if(enabled)raf=requestAnimationFrame(tick);
  };
  const result=()=>({enabled,startedAt,endedAt,attempts,launched,dropped,
    observedHitsDelta:state.hits-lastHits,planningMs,maxPlanningMs,
    pending:pending?{fireId:pending.id,targetId:pending.targetId}:null,
    limits:{stepMs:STEP_MS,targets:MAX_TARGETS,log:MAX_LOG,predictSeconds:MAX_PREDICT_SECONDS,
      runMs:MAX_RUN_MS,launches:MAX_LAUNCHES},events:log.slice()});
  const stop=(reason='requested')=>{
    observe();if(enabled)append('stop',{reason});enabled=false;endedAt=performance.now();
    if(raf!==null){cancelAnimationFrame(raf);raf=null;}return result();
  };
  const start=()=>{
    if(enabled)return result();
    log.length=0;dropped=0;attempts=0;launched=0;planningMs=0;maxPlanningMs=0;
    target=null;targetBorn=null;targetId=null;pending=null;
    startedAt=performance.now();endedAt=null;lastTick=-Infinity;lastFire=-Infinity;
    lastWait=-Infinity;lastWaitReason='';lastHits=state.hits;enabled=true;
    append('start',{bpm:state.bpm,trainMode,trainPhase});raf=requestAnimationFrame(tick);return result();
  };
  return {start,stop,result};
})();
