"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),path=require('node:path'),crypto=require('node:crypto');
const {makeTrace}=require('./hum-field-trace.js');
const {main}=require('./source.js');
const {extractFunction}=require('./chip-graph.js');
const {pianoIntroOff}=require('./piano-intro-source.js');
const fieldNames=['humFieldLive','humFieldBeat','humFieldNativeTime','humFieldQuiet','humFieldRetireLegacy','humFieldBuild','humFieldEligible','humFieldMove','humFieldSelect','humFieldPitch','humFieldRemember','humFieldDue','humFieldApply','humFieldBind','humFieldStrike','humFieldSpawn','humFieldGrid','humFieldDrain','humFieldUpdate','humFieldStop'];
const declaration=main.match(/let _humField=CHIP_FIELD\?[^;\n]+;/);
assert.ok(declaration,'field state is allocated only for the enabled arm');
const source=declaration[0]+'\n'+fieldNames.map(name=>extractFunction(main,name)).join('\n');
const offFixture=JSON.parse(fs.readFileSync(path.join(__dirname,'chip-hum-field-off.fixture.json'),'utf8'));
function harness({enabled=true,beat=0,raw=100,native=200}={}){
  const trace=makeTrace({rawTime:raw,nativeTime:native}),targets=[],touched=[];
  const deny=()=>{touched.push('forbidden');throw Error('field cannot touch grading, transport mutation, storage, RNG or old voices');};
  const math=Object.create(Math);math.random=deny;
  const state=new Proxy({running:true},{get(t,k){if(k==='t')return trace.rawCtx.currentTime-raw;if(k!=='running')return deny();return t[k];},set:deny});
  let wave;
  const c=vm.createContext({PIANO:false,CHIP_FIELD:enabled,soundOn:true,toneReady:true,state,trainMode:false,templeActive:false,_bow:{stage:0},BOW:{LAST:3},
    listener:trace.listener,rawCtx:trace.rawCtx,THREE:trace.THREE,TARGET_AUDIO_STEP:.05,quietAudioMatrixUpdates(){},pulseWave(ctx){return wave||(wave=ctx.createPeriodicWave(new Float32Array(2),new Float32Array([0,1]),{}));},
    CFG:{chip:{humHarmony:true,humGain:.22,humOctave:-1},sing:{on:true,degSpan:5}},CHORD_TRIAD:[[220,275,330],[196,245,294],[261.63,327.04,392.44]],PENTA:[110,137.5,165,220,275,330,440],
    singDegree:k=>({2:6,4:5,6:4,8:3,12:2})[k]??2,targets,Math:math,
    Tone:{Transport:{PPQ:192,getTicksAtTime:t=>(beat+t-raw)*192,start:deny,stop:deny,cancel:deny},Draw:trace.Draw},
    rnd:deny,pushEvent:deny,spawnTarget:deny,localStorage:new Proxy({},{get:deny}),fetch:deny,
  });
  vm.runInContext(source+'\n'+extractFunction(main,'stopTargetSound')+'\nthis.field=()=>_humField;',c);
  function target(name,k=2,extra={}){
    const mesh={position:{x:1,y:4,z:-15},children:[],add(pa){if(pa.parent)pa.parent.remove(pa);this.children.push(pa);pa.parent=this;},remove(pa){this.children=this.children.filter(p=>p!==pa);pa.parent=null;}};
    const tg={name,idx:targets.length,mesh,bowK:k,kind:0,fill16:-1,dead:false,expireAt:20,born:0,...extra};targets.push(tg);return tg;
  }
  const pitches=()=>trace.events.filter(e=>e.op==='setValueAtTime'&&e.id.endsWith('.frequency'));
  return {c,trace,targets,target,touched,pitches};
}

test('field disabled performs no allocation, scheduling or gameplay access',()=>{
  const h=harness({enabled:false}),t=h.target('one');h.c.humFieldSpawn(t);h.c.humFieldGrid(101,1,3,0);h.c.humFieldUpdate();h.c.humFieldStop();
  assert.equal(h.c.field(),null);assert.deepEqual(h.trace.events,[]);assert.deepEqual(h.trace.draws,[]);assert.deepEqual(h.touched,[]);
});

test('next-arrival selection excludes dead, stale, decoy and drum-fill targets using deterministic authored tie order',()=>{
  const h=harness({beat:.1});
  const a=h.target('a',12,{expireAt:8,born:1}),b=h.target('b',2,{expireAt:6,born:2}),c=h.target('c',4,{expireAt:6,born:1});
  h.target('fill',2,{fill16:0,expireAt:1});h.target('decoy',2,{kind:2,expireAt:1});h.target('dead',2,{dead:true,expireAt:1});h.target('expired',2,{expireAt:0});
  const snapshot=JSON.stringify(h.targets.map(t=>({...t,mesh:null})));
  assert.deepEqual(Array.from(h.c.humFieldSelect(.1),t=>t.name),['c','b']);
  assert.deepEqual(Array.from(h.c.humFieldSelect(.8),t=>t.name),['b','c']);
  assert.equal(h.c.humFieldEligible({...a}),false,'array identity rejects a stale or pooled record');
  assert.equal(JSON.stringify(h.targets.map(t=>({...t,mesh:null}))),snapshot);assert.deepEqual(h.touched,[]);
});

test('the ordered five-rung pitch ladder stays inside the supplied chord and leaves every k distinct',()=>{
  const h=harness(),ks=[2,4,6,8,12],t=h.target('one');
  for(const [ci,expected]of [[0,[550,440,330,275,220]],[1,[490,392,294,245,196]]]){
    const actual=ks.map(k=>{t.bowK=k;return h.c.humFieldPitch(t,ci);});assert.deepEqual(actual,expected);assert.equal(new Set(actual).size,5);
  }
  assert.equal(h.c.humFieldPitch(t,99),0);
  h.c.CFG.sing.on=false;assert.equal(h.c.humFieldPitch(t,0),220,'the sing kill switch rests on the bottom chord rung');
});

test('tier-zero spawn calls use only two persistent dry carriers with finite zero-ending notes',()=>{
  const h=harness(),a=h.target('a',2),b=h.target('b',4),c=h.target('c',6,{expireAt:30});
  h.c.humFieldSpawn(a);h.c.humFieldSpawn(b);const first=h.pitches().length;h.c.humFieldSpawn(c);
  assert.equal(h.pitches().length,first,'unselected third target cannot announce through a third route');
  assert.equal(h.trace.nodes.filter(n=>n.name==='Oscillator').length,2);assert.equal(h.trace.nodes.filter(n=>n.name==='Gain').length,2);assert.equal(h.trace.nodes.filter(n=>n.name==='Panner').length,2);
  assert.equal(h.trace.nodes.filter(n=>n.name==='PositionalAudio').length,0,'native panners consume no Object3D UUID randomness');
  const field=h.c.field();assert.equal(field.voices.length,2);
  for(const voice of field.voices){const ramp=h.trace.events.filter(e=>e.op==='linearRampToValueAtTime'&&e.id===voice.gain.gain.id).at(-1);assert.equal(ramp.value,0);assert.equal(ramp.at,200.12);}
  const count=h.trace.nodes.length;h.trace.advance(100.2);a.dead=true;h.c.humFieldSpawn(c);assert.equal(h.trace.nodes.length,count);assert.deepEqual(h.touched,[]);
});

test('future chord callbacks do not retune before due and an exact-boundary spawn survives later tier-zero Draw',()=>{
  const h=harness({beat:3.9}),a=h.target('a');h.c.humFieldSpawn(a);
  h.c.humFieldGrid(100.1,1,0,0);const before=h.pitches().length;
  h.trace.advance(100.05);h.c.humFieldSpawn(a);assert.equal(h.pitches().at(-1).value,550);assert.ok(h.pitches().length>before);
  h.trace.advance(100.1);h.c.humFieldSpawn(a);assert.equal(h.pitches().at(-1).value,490);
  const last=h.pitches().length,voice=h.c.field().voices.find(v=>v.target===a),until=voice.until;
  h.trace.drain(100.1);assert.equal(h.pitches().length,last);assert.equal(voice.until,until,'boundary cleanup must preserve a note already voiced in that chord');
  assert.ok(h.pitches().every(e=>e.at>=e.now));
});

test('existing groove tier controls recurrence without extra clocks or offbeat notes',()=>{
  for(const [tier,expected]of [[0,0],[1,2],[2,2],[3,4]]){
    const h=harness(),a=h.target('a');h.c.humFieldSpawn(a);const start=h.pitches().length;
    for(let i=0;i<8;i++)h.c.humFieldGrid(100+i*.5,0,tier,i);
    assert.equal(h.trace.draws.length,8);assert.equal(h.pitches().length,start);
    for(let i=0;i<8;i++)h.trace.drain(100+i*.5);
    assert.equal(h.pitches().length-start,expected,'one audible target receives only the authored pulse positions');assert.deepEqual(h.touched,[]);
  }
});

test('pool life tags, removal and reset silence carriers and fence every stale Draw callback',()=>{
  const h=harness(),a=h.target('a'),b=h.target('b',4);h.c.humFieldSpawn(a);h.c.humFieldSpawn(b);
  h.c.humFieldGrid(100.2,1,3,0);const field=h.c.field(),serial=field.tags.get(a);
  h.c.humFieldSpawn(a);assert.ok(field.tags.get(a)>serial);assert.equal(field.voices.filter(v=>v.target===a).length,1);
  a.dead=true;h.c.humFieldUpdate();assert.equal(field.voices.some(v=>v.target===a),false);
  const count=h.trace.nodes.length;h.c.humFieldStop();const stopped=h.trace.events.length;h.trace.drain(100.3);
  assert.equal(h.trace.events.length,stopped);assert.ok(field.voices.every(v=>v.target===null));assert.equal(field.harmony.length,0);
  h.c.humFieldSpawn(b);assert.equal(h.trace.nodes.length,count,'resume reuses the same two native carriers');
  h.c.templeActive=true;h.c.humFieldUpdate();assert.ok(field.voices.every(v=>v.target===null));assert.deepEqual(h.touched,[]);
});

module.exports={harness};

test('an early Draw only arms the event, never changing harmony or pitch before audio time',()=>{
  const h=harness({beat:3.9}),a=h.target('a');h.c.humFieldSpawn(a);h.c.humFieldGrid(100.1,1,3,0);
  h.trace.advance(100.095);const draw=h.trace.draws.shift(),before=h.trace.events.length;draw.fn();
  assert.equal(h.trace.events.length,before);assert.equal(h.c.field().ci,0);
  h.c.humFieldUpdate();assert.equal(h.c.field().ci,0);assert.equal(h.pitches().at(-1).value,550);
  h.trace.advance(100.1);h.c.humFieldUpdate();assert.equal(h.c.field().ci,1);assert.equal(h.pitches().at(-1).value,490);
  assert.ok(h.pitches().every(e=>e.at>=e.now));
});

test('spatial writes are bounded to sounding changed positions and stopping repeatedly is inert',()=>{
  const h=harness(),a=h.target('a');h.c.humFieldSpawn(a);
  const spatial=()=>h.trace.events.filter(e=>/\.position[XYZ]$/.test(e.id||''));
  const first=spatial().length;a.mesh.position.x=3;h.trace.advance(100.01);h.c.humFieldUpdate();assert.equal(spatial().length,first);
  h.trace.advance(100.051);h.c.humFieldUpdate();assert.equal(spatial().length,first+3);
  h.trace.advance(100.102);h.c.humFieldUpdate();assert.equal(spatial().length,first+3,'unchanged coordinates need no automation');
  a.mesh.position.x=9;h.trace.advance(100.2);h.c.humFieldUpdate();assert.equal(spatial().length,first+3,'the fully released voice has no spatial work');
  h.c.humFieldStop();const end=h.trace.events.length;h.c.humFieldStop();h.c.humFieldStop();assert.equal(h.trace.events.length,end);
});

test('stealing a carrier cancels old position ramps even when its new owner matches the cached endpoint',()=>{
  const h=harness(),a=h.target('a',2,{expireAt:20}),b=h.target('b',2,{expireAt:6});h.c.humFieldSpawn(a);h.c.humFieldSpawn(b);
  a.mesh.position.x=3;h.trace.advance(100.051);h.c.humFieldUpdate();
  const old=h.c.field().voices.find(v=>v.target===a),id=old.panner.id;
  assert.ok(h.trace.events.some(e=>e.id===id+'.positionX'&&e.op==='linearRampToValueAtTime'&&e.at>h.trace.native.currentTime));
  h.trace.advance(100.07);const fresh=h.target('fresh',2,{expireAt:1});fresh.mesh.position.x=3;
  const start=h.trace.events.length;h.c.humFieldSpawn(fresh);assert.equal(h.c.field().voices.find(v=>v.target===fresh),old);
  const writes=h.trace.events.slice(start);
  for(const axis of ['X','Y','Z']){
    const pid=id+'.position'+axis;
    assert.ok(writes.some(e=>e.id===pid&&e.op==='cancelScheduledValues'&&e.at===h.trace.native.currentTime));
    assert.ok(writes.some(e=>e.id===pid&&e.op==='setValueAtTime'&&e.at===h.trace.native.currentTime));
  }
});

test('late Draw drops missed pulses and bounded harmony history never changes pitch early',()=>{
  const h=harness(),a=h.target('a');h.c.humFieldSpawn(a);
  h.c.humFieldGrid(100.1,1,3,0);const count=h.pitches().length;h.trace.drain(100.16);
  assert.equal(h.pitches().length,count,'a pulse over50ms late is not replayed');assert.equal(h.c.field().ci,1);
  assert.ok(h.c.field().voices.every(v=>v.until<=h.trace.native.currentTime),'the old chord tails still stop');
  for(let i=1;i<=20;i++)h.c.humFieldGrid(101+i,2,3,0);
  assert.ok(h.c.field().harmony.length<=8);assert.equal(h.c.field().ci,1);assert.equal(h.pitches().length,count);
});

test('old-chord notes end at native boundary time and sub20ms pickups are skipped',()=>{
  const h=harness(),a=h.target('a');h.c.humFieldSpawn(a);h.c.humFieldGrid(100.1,1,0,0);
  const v=h.c.field().voices.find(v=>v.target===a);
  assert.ok(h.trace.events.some(e=>e.id===v.gain.gain.id&&e.op==='linearRampToValueAtTime'&&e.value===0&&Math.abs(e.at-200.1)<1e-9),'the old tail ends even if the next render frame stalls');
  h.trace.advance(100.06);h.c.humFieldSpawn(a);assert.equal(h.pitches().at(-1).value,550);assert.ok(Math.abs(v.until-200.1)<1e-9);
  const count=h.pitches().length;h.trace.advance(100.09);h.c.humFieldSpawn(a);assert.equal(h.pitches().length,count);
  h.trace.drain(100.1);assert.equal(h.c.field().ci,1);
});

function humRecorder(){
  const c=vm.createContext({require:id=>id==='node:test'?(()=>{}):require(id)});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'chip-hums.test.js'),'utf8')+'\nthis.capture=captureHums;',c);
  return c.capture;
}

test('disabled harmony retains the authenticated H2 native graph through retuning and repeated cleanup',()=>{
  assert.equal(offFixture.baseline,'d503ab15f0972ce828d4934964d4cf3ed57d83b5');
  const capture=humRecorder();
  for(const enabled of [false,true]){
    const run=capture(main,enabled);
    for(let i=0;i<run.sounds.length;i++){
      for(const k of [2,4,6])run.ctx.singTargetSound(run.sounds[i],i,k,true);
      run.ctx.stopTargetSound(run.sounds[i]);run.ctx.stopTargetSound(run.sounds[i]);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(run.events)),offFixture.graphs[enabled?'chip':'sine']);
  }
});

test('new field hooks preserve the old spawn, grading, chord arrangement and per-target audio bodies',()=>{
  const hooks={
    makeTargetSound:'  if(CHIP_FIELD && !trainMode){ try{ THREE.MathUtils.generateUUID(); pickPenta(); }catch(e){} return null; }',
    voiceTargetSound:'  if(CHIP_FIELD && !trainMode){ if(listener && soundOn && kind===3) Math.random(); return; }',
    onGrid:'  if(CHIP_FIELD) try{ humFieldGrid(time,ci,tier,i); }catch(e){}',
    teardownTransport:'  if(CHIP_FIELD) try{ humFieldStop(); }catch(e){}',
    applyAudioState:'  if(CHIP_FIELD && !(state.running && !templeActive && soundOn)) try{ humFieldStop(); }catch(e){}',
    spawnTarget:'  if(CHIP_FIELD) try{ humFieldSpawn(tg); }catch(e){}',
  };
  for(const [name,original]of Object.entries(offFixture.functions)){
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'),offFixture.hashes[name]);
    let current=extractFunction(main,name);
    if(name==='onGrid') current=pianoIntroOff(current);
    if(name==='makeTargetSound') current=current.replace("  if(PIANO && CFG.piano.hums){ try{ THREE.MathUtils.generateUUID(); pickPenta(); if(!CHIP_HUMS) Math.random(); }catch(e){} return null; }   // retain the old audio-only draws while the shared piano owns every lesson and main-mode call\n", '').replace("if(PIANO && CFG.piano.hums) osc.type='sine'; else ", '').replace('(PIANO && CFG.piano.hums)||CHIP_HUMS?', 'CHIP_HUMS?').replace('!(PIANO && CFG.piano.hums) && !CHIP_HUMS', '!CHIP_HUMS');
    if(name==='voiceTargetSound') current=current.replace("  if(PIANO && CFG.piano.hums){ if(listener && soundOn && kind===3) Math.random(); return; }   // all sphere colours use one keyboard, without legacy vibrato or detuned twins\n", '');
    if(hooks[name]){const lines=current.split('\n').filter(line=>line.startsWith(hooks[name]));assert.equal(lines.length,1,name);current=current.replace(lines[0]+'\n','');}
    if(name==='onGrid') current=current.replaceAll('bassOut(', 'bassNote(');
    assert.equal(current,original,name+' retains its complete non-field body');
  }
  assert.ok(main.includes(offFixture.targetFrame));
  assert.equal(crypto.createHash('sha256').update(offFixture.targetFrame).digest('hex'),offFixture.targetFrameHash);
  const spawn=extractFunction(main,'spawnTarget');assert.ok(spawn.indexOf('humFieldSpawn(tg)')>spawn.indexOf('targets.push(tg)'));assert.ok(spawn.indexOf('humFieldSpawn(tg)')>spawn.indexOf('tg.bowK=_beatSpawnK'));
});

test('the healthy chip spawn stream spends UUID, pitch and speed-modulation draws at their old sites',()=>{
  const capture=humRecorder(),original=['pulseCoefficients','pulseWave'].map(name=>extractFunction(main,name)).join('\n')+'\n'+Object.values(offFixture.functions).join('\n');
  function run(body,field){
    const c=capture(body,true,[]).ctx,trace=[];let seed=1234567,phase='';
    c.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=seed/4294967296;trace.push({phase,value});return value;};
    const uuid=()=>{for(let i=0;i<4;i++)c.Math.random();return 'recorded-native-wrapper-uuid';};
    const positional=c.THREE.PositionalAudio;c.THREE.PositionalAudio=function(owner){uuid();return positional(owner);};c.THREE.MathUtils={generateUUID:uuid};
    c.CHIP_FIELD=field;c.trainMode=false;vm.runInContext(extractFunction(main,'pickPenta'),c);
    for(const kind of [0,1,3,4]){phase='construct';const sound=c.makeTargetSound({add(){}});phase='kind';c.Math.random();phase='voice';c.voiceTargetSound(sound,kind);if(field)assert.equal(sound,null);else assert.ok(sound);}
    return trace;
  }
  const baseline=run(original,false),off=run(main,false),on=run(main,true);
  assert.deepEqual(off,baseline);assert.deepEqual(on,baseline);assert.equal(on.length,25);
  assert.deepEqual(on.filter(e=>e.phase==='voice').length,1,'only SPEED spends its existing modulation draw');
});

test('harmony is a literal boot audition and hums remains opt-in with an H2 restoration path',()=>{
  const c=vm.createContext({});vm.runInContext(extractFunction(main,'resolveHum'),c);
  for(const value of ['0','1','true','false','2','01','', '%31']){const cfg={humHarmony:true};c.resolveHum('?humHarmony='+value,cfg);assert.equal(cfg.humHarmony,value!=='0');}
  const cfg={humHarmony:false};c.resolveHum('#humHarmony=1',cfg);assert.equal(cfg.humHarmony,true);
  assert.match(main,/const CHIP_FIELD=\(PIANO && CFG\.piano\.hums\) \|\| \(CHIP_HUMS && CFG\.chip\.humHarmony===true\);/);
  const defaults=vm.runInNewContext('('+main.match(/\bchip:(\{[^\n]+?\})/)[1]+')');assert.equal(defaults.hums,true);assert.equal(defaults.humHarmony,true);
});

test('graduation retires old per-target hums at exact zero before either shared carrier attacks',()=>{
  const h=harness(),a=h.target('trainer');
  const oldNodes=Object.fromEntries(['osc','lfo','osc2','lfo2'].map(name=>[name,h.trace.native.createOscillator()])),oldOut=h.trace.native.createGain();oldOut.gain.value=.8;
  const oldSound={...oldNodes,outGain:oldOut,stopped:false};a.snd=oldSound;
  const guarded=new Proxy(a,{set(t,k,value){assert.equal(k,'snd','migration writes only the audio handle');t[k]=value;return true;}});h.targets[0]=guarded;
  const before=h.trace.events.length;h.c.humFieldSpawn(guarded);
  assert.equal(a.snd,null);assert.equal(oldSound.stopped,true);
  const events=h.trace.events.slice(before),zero=events.findIndex(e=>e.id===oldOut.gain.id&&e.op==='setValueAtTime'&&e.value===0),attack=events.findIndex(e=>e.op==='linearRampToValueAtTime'&&e.value>0&&e.id!==oldOut.gain.id);
  assert.ok(zero>=0&&attack>zero);assert.ok(events.slice(0,zero).some(e=>e.id===oldOut.gain.id&&e.op==='cancelScheduledValues'&&e.at===h.trace.native.currentTime));
  for(const node of Object.values(oldNodes)){
    const stops=events.filter(e=>e.id===node.id&&e.op==='stop');
    assert.deepEqual(stops.map(e=>e.at),[h.trace.native.currentTime+.09,h.trace.native.currentTime],'immediate retirement overrides the legacy future stop');
    assert.ok(events.indexOf(stops.at(-1))<attack,'every old oscillator stops before a shared carrier attacks');
  }
  assert.equal(h.c.field().voices.length,2);assert.deepEqual(h.touched,[]);
});
