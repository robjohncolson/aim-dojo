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
 const audio=[],visual=[],c=vm.createContext({Math,Number,Set,console});
 const voice=name=>({triggerAttackRelease:(...args)=>audio.push({source:name,args})});
 Object.assign(c,{
  PIANO:piano,trainMode:true,trainPhase:phase,trainWasd:0,TRAIN_NEED_WASD:3,
  state:{running:true,t:0,bpm},templeActive:false,rhythmGeneration:1,grid8:0,
  CHORD_ROOT:[69.30,55,82.41,61.74],CHORD_TRIAD:[[103.83,138.59,164.81],[110,138.59,164.81],[103.83,123.47,164.81],[92.5,123.47,155.56]],
  PENTA:[277.18,329.63,369.99,415.30,493.88,554.37,659.25,739.99],activeTheme:{name:'MOONLIGHT'},
  tick:voice('tick'),tapSynth:voice('tapSynth'),lead:voice('lead'),pianoSfx:voice('pianoSfx'),
  kick:piano?null:voice('kick'),bass:voice('bass'),pad:voice('pad'),hat:piano?null:voice('hat'),arp:voice('arp'),
  CFG:{patternConcurrency:0,wasdRhythm:true,wasdNoteDivs:[2,4,8],wasdNoteT:[.75,1.01],minBpm:20,maxBpm:60,wasdWindow:.16,wasdWindowFrac:.4,grooveGroove:true,grooveFreezePhase:.5,groovePocket:true},
  bonusActive:false,activeTargetCount:()=>0,cd:99,restSlots:0,CHIP_FIELD:false,
  bowTouch:()=>{},_bow:{stage:0},BOW:{LAST:2},MOBILE:false,GH_CHALK:false,GH_RECORD:false,
  soundOn:true,toneReady:true,reduceMotion:true,FLOCK:{rainbowCombo:8},
  _combo:[0,1,2,3,0,1,2,3],_resolved:new Set(),_resolvedNd:null,_pocketResolvedMains:new Set(),
  _curCi:-1,_curMain:true,_spoilNote:-1,_hitNote:-1,_wasdCombo:0,_baseMul:1,
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
 return {c,audio,visual,step,press};
}
const tickEvents=h=>h.audio.filter(x=>x.source==='tick');
const tapEvents=h=>h.audio.filter(x=>x.source==='tapSynth');
for(const bpm of [28,60])for(const phase of [0,1,2]){
 test('piano whole-beat clock '+bpm+'/'+phase,()=>{
  const h=harness(true,phase,bpm);for(let i=0;i<8;i++)h.step(i);
  const expected=[0,2,4,6].map(i=>({source:'tick',args:[i===0?2093:1568,'32n',100+i*.5*60/bpm,.55]}));
  assert.deepEqual(tickEvents(h),expected);assert.equal(h.c.grid8,8);
 });
 test('legacy exact audio and visual schedule '+bpm+'/'+phase,()=>{
  const now=harness(false,phase,bpm),old=harness(false,phase,bpm,legacyGrid);
  for(let i=0;i<8;i++){now.step(i);old.step(i);}
  assert.deepEqual(now.audio,old.audio);assert.deepEqual(now.visual,old.visual);
  assert.deepEqual(tickEvents(now).map(x=>x.args),[
   [2093,'32n',100,.55],
   ...[1,3,5,7].map(i=>[i===1?1760:1480,'32n',100+i*.5*60/bpm,phase===0?.95:.7])
  ]);
 });
 test('every lesson offbeat has one lane note, with duplicate and wrong silent '+bpm+'/'+phase,()=>{
  for(const i of [1,3,5,7]){
   const h=harness(true,phase,bpm),silent=harness(true,phase,bpm);h.step(i);silent.step(i);
   const ci=Math.round(h.c.wasdBeats()*h.c.wasdNoteDiv()),k=h.c._combo[ci%h.c._combo.length];
   const beforePress=h.audio.length;h.press(k);
   const added=h.audio.slice(beforePress);assert.deepEqual(added,[{source:'tapSynth',args:[h.c.PENTA[k*2],'16n',h.c.now,.42]}]);
   assert.deepEqual(tickEvents(h),tickEvents(silent));assert.equal(tickEvents(h).length,0);
   assert.equal(h.c._tapAcc,100);assert.equal(h.c._tapOffN,1);assert.equal(h.c._baseMul,0);
   assert.equal(h.c.trainWasd,phase===0?1:0);
   h.press(k);assert.equal(h.audio.length,beforePress+1,'duplicate note is silent');
   const wrong=harness(true,phase,bpm);wrong.step(i);const n=wrong.audio.length;wrong.press((k+1)%4);
   assert.equal(wrong.audio.length,n,'wrong key is silent');wrong.press(k);assert.equal(wrong.audio.length,n,'wrong key resolves the note; retry does not sound');
  }
 });
}
test('PIANO lesson retains every non-tick schedule from baseline',()=>{
 for(const bpm of [28,60])for(const phase of [0,1,2]){
  const now=harness(true,phase,bpm),old=harness(true,phase,bpm,legacyGrid);
  for(let i=0;i<8;i++){now.step(i);old.step(i);}
  assert.deepEqual(now.audio.filter(x=>x.source!=='tick'),old.audio.filter(x=>x.source!=='tick'));
  assert.deepEqual(now.visual,old.visual);
 }
});
