"use strict";
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const {main:source}=require('./source.js');
const {extractFunction}=require('./chip-graph.js');
const {pianoIntroOff}=require('./piano-intro-source.js');
const legacyGrid=extractFunction(pianoIntroOff(source),'onGrid');
// Actual source functions below; only audio, rendering, spawning, latency and UI are stubs.
function harness(piano,phase,bpm,gridBody=extractFunction(source,'onGrid')){
 const audio=[],visual=[],harmony=[],c=vm.createContext({Math,Number,Set,console});
 const voice=name=>({triggerAttackRelease:(...args)=>audio.push({source:name,args})});
 // Take each phase's timing directly from production; full-mode windows would hide the lesson's legal main-note edges.
 const phaseWindows=[...extractFunction(source,'setTrainPhase').matchAll(/CFG\.wasdWindow=([\d.]+);\s*CFG\.wasdWindowFrac=([\d.]+);/g)];
 assert.equal(phaseWindows.length,3,'each lesson phase supplies its own timing window');
 const [,wasdWindow,wasdWindowFrac]=phaseWindows[phase];
 Object.assign(c,{
  PIANO:piano,trainMode:true,trainPhase:phase,trainWasd:0,TRAIN_NEED_WASD:3,
  state:{running:true,t:0,bpm},templeActive:false,rhythmGeneration:1,grid8:0,
  CHORD_ROOT:[69.30,55,82.41,61.74],CHORD_TRIAD:[[103.83,138.59,164.81],[110,138.59,164.81],[103.83,123.47,164.81],[92.5,123.47,155.56]],
  PENTA:[277.18,329.63,369.99,415.30,493.88,554.37,659.25,739.99],activeTheme:{name:'MOONLIGHT'},
  tick:voice('tick'),tapSynth:voice('tapSynth'),lead:voice('lead'),pianoSfx:voice('pianoSfx'),
  kick:piano?null:voice('kick'),bass:voice('bass'),pad:voice('pad'),hat:piano?null:voice('hat'),arp:voice('arp'),
  CFG:{piano:{hums:true},patternConcurrency:0,wasdRhythm:true,wasdNoteDivs:[2,4,8],wasdNoteT:[1.01,1.02],wasdPipN:16,minBpm:20,maxBpm:60,wasdWindow:Number(wasdWindow),wasdWindowFrac:Number(wasdWindowFrac),grooveGroove:true,grooveFreezePhase:.5,groovePocket:true},
  humFieldGrid:(...args)=>harmony.push(args),
  bonusActive:false,activeTargetCount:()=>0,cd:99,restSlots:0,CHIP_FIELD:false,
  bowTouch:()=>{},_bow:{stage:0},BOW:{LAST:2},MOBILE:false,GH_CHALK:false,GH_RECORD:false,
  soundOn:true,toneReady:true,reduceMotion:true,FLOCK:{rainbowCombo:8},
  _combo:[0,1,2,3,0,1,2,3],_resolved:new Set(),_resolvedNd:null,_pocketResolvedMains:new Set(),
  _curCi:-1,_curMain:true,_spoilNote:-1,_hitNote:-1,_wasdCombo:0,_baseMul:1,_pipSetN:0,_pipSetFlashT:-999,
  _tapOffSum:0,_tapOffN:0,_tapAcc:0,_tapShowT:0,_noteFlashT:0,_noteFlashHit:false,
  audioLat:()=>0,now:100,
  TF:(key,fallback,values)=>({key,values}),showTrainCoach:()=>{},setTrainPhase:next=>visual.push({source:'phase',next}),
  pulseBeat:strong=>visual.push({source:'pulseBeat',strong}),
 });
 c.beatSnap=()=>c.now;
 c.bassOut=f=>f;c.kickHit=(...args)=>c.kick.triggerAttackRelease(...args);c.padChord=(...args)=>c.pad.triggerAttackRelease(...args);
 c.Tone={Transport:{ticks:0,PPQ:192},now:()=>c.now,Draw:{schedule:(fn,time)=>visual.push({source:'Draw',time})}};
 const names=['wasdBeats','wasdNoteDiv','diffT','syncWasdResolutionGrid','remapWasdNoteIndex','pocketLive','pocketClaimIdeals','claimWasdNote','wasdTapAccuracy','_wasdResolve','noteTrainWasd','wasdLanePress'];
 vm.runInContext(names.map(name=>extractFunction(source,name)).join('\n')+'\n'+gridBody,c);
 function step(i){c.grid8=i;c.now=100+i*.5*60/bpm;c.state.t=c.now-100;c.Tone.Transport.ticks=i*.5*192;c.onGrid(c.now);}
 function press(k){c.wasdLanePress(k);}
 return {c,audio,visual,harmony,step,press};
}
const tickEvents=h=>h.audio.filter(x=>x.source==='tick');
const tapEvents=h=>h.audio.filter(x=>x.source==='tapSynth');
for(const bpm of [28,60])for(const phase of [0,1,2]){
 test('piano whole-beat clock '+bpm+'/'+phase,()=>{
  const h=harness(true,phase,bpm);for(let i=0;i<8;i++)h.step(i);
  const expected=[0,2,4,6].map(i=>({source:'tick',args:[i===0?2093:1568,'32n',100+i*.5*60/bpm,.55]}));
  assert.deepEqual(tickEvents(h),expected);assert.equal(h.c.grid8,8);assert.deepEqual(h.harmony,Array.from({length:8},(_,i)=>[100+i*.5*60/bpm,0,0,i]),"lesson shares only chord history at tier zero");
 });
 test('legacy exact audio and visual schedule '+bpm+'/'+phase,()=>{
  const now=harness(false,phase,bpm),old=harness(false,phase,bpm,legacyGrid);
  for(let i=0;i<8;i++){now.step(i);old.step(i);}
  assert.deepEqual(now.audio,old.audio);assert.deepEqual(now.visual,old.visual);assert.deepEqual(now.harmony,[],"legacy lesson never enters the piano field clock");
  assert.deepEqual(tickEvents(now).map(x=>x.args),[
   [2093,'32n',100,.55],
   ...[1,3,5,7].map(i=>[i===1?1760:1480,'32n',100+i*.5*60/bpm,phase===0?.95:.7])
  ]);
 });
 test('every required lesson beat has one lane note, with duplicate and wrong silent '+bpm+'/'+phase,()=>{
  for(const i of [1,3,5,7]){
   const h=harness(true,phase,bpm),silent=harness(true,phase,bpm);h.step(i);silent.step(i);
   assert.equal(h.c.wasdNoteDiv(),1,'the live trainer has no optional subdivisions');
   const ci=Math.round(h.c.wasdBeats()*h.c.wasdNoteDiv()),k=h.c._combo[ci%h.c._combo.length];
   assert.equal(k,(i-1)/2,'lesson mains retain the W/A/S/D sequence at both tempos');
   const beforePress=h.audio.length;h.press(k);
   const added=h.audio.slice(beforePress);assert.deepEqual(added,[{source:'tapSynth',args:[h.c.PENTA[k*2],'16n',h.c.now,.42]}]);
   assert.deepEqual(tickEvents(h),tickEvents(silent));assert.equal(tickEvents(h).length,0);
   assert.equal(h.c._tapAcc,100);assert.equal(h.c._tapOffN,1);assert.equal(h.c._baseMul,0);
   assert.equal(h.c.trainWasd,phase===0?1:0);
   assert.equal(h.c._wasdCombo,0,'credited lesson mains never fill streak pips');
   assert.equal(h.c._pipSetN,0);assert.equal(h.c._pipSetFlashT,-999,'lesson credit never starts a set flash');
   h.press(k);assert.equal(h.audio.length,beforePress+1,'duplicate note is silent');
   const wrong=harness(true,phase,bpm);wrong.step(i);const n=wrong.audio.length;wrong.press((k+1)%4);
   assert.equal(wrong.audio.length,n,'wrong key is silent');wrong.press(k);assert.equal(wrong.audio.length,n,'wrong key resolves the note; retry does not sound');
  }
 });
 test('lesson midpoints cannot earn streak credit or progress '+bpm+'/'+phase,()=>{
  for(const i of [2,4,6]){
   const h=harness(true,phase,bpm);
   h.step(i);const before=h.audio.length;
   const nd=h.c.wasdNoteDiv(),bps=60/Math.max(20,bpm),full=bps/nd;
   const w=Math.min(full*.5,Math.max(h.c.CFG.wasdWindow,full*h.c.CFG.wasdWindowFrac));
   const claim=h.c.claimWasdNote(h.c.wasdBeats(),nd,bps,w);
   assert.equal(nd,1,'all lesson notes remain mains');
   if(phase<2){
    assert.ok(claim&&claim.main,'the forgiving window includes the edge of an existing main');
    assert.equal(Math.abs(claim.offBeats),.5);
    const k=h.c._combo[claim.ci%h.c._combo.length];h.press(k);
    assert.equal(h.c._tapOffN,1,'the existing main edge is graded');
    assert.equal(h.c._tapAcc,0,'the midpoint earns zero main accuracy');
    assert.deepEqual(h.audio.slice(before),[{source:'tapSynth',args:[h.c.PENTA[k*2],'16n',h.c.now,.42]}],'a correct edge main retains its existing tap sound');
   }else{
    assert.equal(claim,null,'phase two closes its main windows before the midpoint');
    for(const k of [0,1,2,3])h.press(k);
    assert.equal(h.c._tapOffN,0);assert.equal(h.audio.length,before);
   }
   assert.equal(h.c._wasdCombo,0,'an edge main never earns streak credit');
   assert.equal(h.c._pipSetN,0);assert.equal(h.c._pipSetFlashT,-999,'a midpoint cannot flash a completed set');
   assert.equal(h.c.trainWasd,0,'zero-accuracy edge attempts never advance lesson progress');
   assert.deepEqual(h.visual.filter(x=>x.source==='phase'),[],'midpoint attempts cannot advance the lesson');
  }
 });
}
test('phase zero still requires three correct lesson mains to progress',()=>{
 for(const bpm of [28,60]){
  const h=harness(true,0,bpm);
  for(const [i,k] of [[1,0],[3,1],[5,2]]){
   h.step(i);h.press(k);h.press(k);
   assert.equal(h.c.trainWasd,k+1,'one credited main per lesson beat despite duplicate presses');
  }
  assert.deepEqual(h.visual.filter(x=>x.source==='phase'),[{source:'phase',next:1}]);
  assert.equal(h.c._wasdCombo,0,'required lesson notes never become streak rewards');
  assert.equal(h.c._pipSetN,0);assert.equal(h.c._pipSetFlashT,-999);
 }
});

test('each fixed lesson phase keeps its streak and set-flash latches empty through thirty-two credited mains',()=>{
 for(const bpm of [28,60])for(const phase of [0,1,2]){
  const h=harness(true,phase,bpm);
  // The phase transition is observed, not applied, so every phase's local credit path
  // is checked past both free-play set boundaries without changing lesson grading.
  for(let beat=0;beat<32;beat++){
   h.step(beat*2+1);h.press(h.c._combo[beat%h.c._combo.length]);
   assert.equal(h.c._tapAcc,100);assert.equal(h.c._tapOffN,beat+1);
   assert.equal(h.c._wasdCombo,0);assert.equal(h.c._pipSetN,0);assert.equal(h.c._pipSetFlashT,-999);
  }
  assert.equal(tapEvents(h).length,32,'every credited lesson main retains its existing tap sound');
 }
});
test('PIANO lesson retains every non-tick schedule from baseline',()=>{
 for(const bpm of [28,60])for(const phase of [0,1,2]){
  const now=harness(true,phase,bpm),old=harness(true,phase,bpm,legacyGrid);
  for(let i=0;i<8;i++){now.step(i);old.step(i);}
  assert.deepEqual(now.audio.filter(x=>x.source!=='tick'),old.audio.filter(x=>x.source!=='tick'));
  assert.deepEqual(now.visual,old.visual);
 }
});
