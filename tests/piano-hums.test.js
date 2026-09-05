"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),test=require("node:test");
const ROOT=path.resolve(__dirname,"..");
const {sourceFor}=require(path.join(ROOT,"tests/source.js"));
const {extractFunction,chipDefaults}=require(path.join(ROOT,"tests/chip-graph.js"));
const {pianoFieldHarness}=require("./piano-field-harness.js");
const main=sourceFor("makeTargetSound");
const humTest=fs.readFileSync(path.join(ROOT,"tests/chip-hums.test.js"),"utf8"),fieldTest=fs.readFileSync(path.join(ROOT,"tests/chip-hum-field.test.js"),"utf8");
// Reuse the existing recorders without registering their test cases a second time.
function recorderFunction(body,name){const start=body.indexOf("function "+name+"("),end=body.indexOf("\ntest(",start);assert.ok(start>=0&&end>start);return body.slice(start,end);}
function vmWithFlags(piano,hums,draws){
 const out=Object.create(vm);out.createContext=values=>{
  values.PIANO=piano;values.CFG={...values.CFG,piano:{hums}};
  if(values.Math&&draws){const original=values.Math.random;values.Math.random=()=>{const value=original();draws.push({op:"random",value});return value;};}
  if(values.pickPenta&&draws){const original=values.pickPenta;values.pickPenta=()=>{const value=original();draws.push({op:"pickPenta",value});return value;};}
  return vm.createContext(values);
 };return out;
}
function perTarget({piano=false,hums=false,chip=false,kinds=[0,1,2,3,4]}={}){
 const draws=[];
 const capture=Function("vm","assert","chipDefaults","extractFunction",extractFunction(humTest,"humFunctions")+"\n"+recorderFunction(humTest,"captureHums")+"\nreturn captureHums;")(vmWithFlags(piano,hums,draws),assert,chipDefaults,extractFunction);
 const h=capture(main,chip,kinds);h.draws=draws;return h;
}
function field(flags={}){return pianoFieldHarness({piano:false,hums:false,...flags});}
function json(value){return JSON.parse(JSON.stringify(value));}
function finishTargets(h){for(let i=0;i<h.sounds.length;i++){for(const k of [2,4,6])h.ctx.singTargetSound(h.sounds[i],i,k,true);h.ctx.stopTargetSound(h.sounds[i]);h.ctx.stopTargetSound(h.sounds[i]);}return h;}
function exerciseField(h){
 const a=h.target("a",2),b=h.target("b",4);h.c.humFieldSpawn(a);h.c.humFieldSpawn(b);h.c.humFieldGrid(100.1,1,3,0);h.trace.advance(100.06);h.c.humFieldSpawn(a);h.trace.drain(100.1);a.mesh.position.x=9;h.trace.advance(100.16);h.c.humFieldUpdate();h.c.humFieldStop();h.trace.drain(100.5);return h;
}

test("piano hums default on and exact URL switch is applied only on the piano arm",()=>{
 const cfg=Function("return "+main.match(/^\s*piano:\s*(\{[^\n]+?\})/m)[1])();assert.equal(cfg.hums,true);
 const resolve=Function(extractFunction(main,"resolvePianoHums")+"\nreturn resolvePianoHums;")();
 for(const [search,initial,expected]of [["?pianoHums=1",false,true],["#pianoHums=0",true,false],["?x=1&pianoHums=1&x=0",false,true],["?pianoHums=true",false,false],["?pianoHums=10",false,false],["?pianoHums=01",true,true],["?xpianoHums=1",false,false],["?pianoHums=%31",false,false],["",true,true]]){const c={hums:initial,other:7};resolve(search,c);assert.deepEqual(c,{hums:expected,other:7},search);}
 assert.match(main,/if\s*\(PIANO\)\s*resolvePianoHums\(/);
 assert.doesNotMatch(extractFunction(main,"resolvePiano"),/pianoHums|\.hums/);
});

test("piano hums inert flag combinations exactly retain both native per-target graphs",()=>{
 for(const chip of [false,true]){const expected=finishTargets(perTarget({chip}));for(const flags of [{piano:false,hums:true},{piano:true,hums:false}]){const actual=finishTargets(perTarget({chip,...flags}));assert.deepEqual(actual.events,expected.events);assert.deepEqual(actual.draws,expected.draws);}}
});


function bootHumFlags(search){
 const cfg={};for(const key of ["piano","chip"]){const literal=main.match(new RegExp("^\\s*"+key+":\\s*(\\{[^\\n]+?\\})","m"));assert.ok(literal,"the authored "+key+" config is present");cfg[key]=vm.runInNewContext("("+literal[1]+")");}
 const hashAt=search.indexOf("#"),location={search:hashAt<0?search:search.slice(0,hashAt),hash:hashAt<0?"":search.slice(hashAt)};
 const boot=[/^const PIANO=resolvePiano\([^\n]+/m,/^if\(PIANO\) resolvePianoHums\([^\n]+/m,/^resolveHum\([^\n]+/m,/^const \[CHIP_LEAD[^\n]+/m,/^const CHIP_FIELD=[^\n]+/m].map(pattern=>{const match=main.match(pattern);assert.ok(match,"the real boot statement is present: "+pattern);return match[0];});
 const c=vm.createContext({CFG:cfg,location});
 vm.runInContext([...["resolvePiano","resolvePianoHums","resolveHum","resolveChip"].map(name=>extractFunction(main,name)),...boot,"globalThis.flags={piano:PIANO,hums:CFG.piano.hums,chip:CHIP_HUMS,enabled:CHIP_FIELD,cfg:CFG};"].join("\n"),c);
 return json(c.flags);
}

test("piano hums false retains the legacy field graph and event stream exactly",()=>{
 const expected=exerciseField(field());
 for(const flags of [{piano:false,hums:true},{piano:true,hums:false}]){
  const h=exerciseField(field(flags));assert.deepEqual(h.trace.events,expected.trace.events);assert.equal(h.trace.waves.length,1);assert.equal(h.instruments.length,0);assert.equal(h.contexts.length,0);assert.deepEqual(h.touched,[]);
 }
});

test("piano boot owns the field independently of chip selection and exposes exact old-sound escapes",()=>{
 for(const search of ["","?chip=lead,bass,pad","?humHarmony=0","?chip=0&humHarmony=0"]){
  const flags=bootHumFlags(search);assert.equal(flags.piano,true,search);assert.equal(flags.hums,true,search);assert.equal(flags.enabled,true,search);
  const h=field(flags);h.c.humFieldSpawn(h.target("first"));assert.equal(h.instruments.length,2,search);assert.equal(h.trace.waves.length,0);assert.deepEqual(h.touched,[]);
 }
 const legacy=exerciseField(field());
 for(const search of ["?pianoHums=0","#pianoHums=0","?piano=0","?piano=0&pianoHums=0"]){
  const flags=bootHumFlags(search);assert.equal(flags.enabled,true,search);
  const h=exerciseField(field(flags));assert.deepEqual(h.trace.events,legacy.trace.events,search);assert.equal(h.instruments.length,0);assert.equal(h.trace.waves.length,1);
 }
 for(const search of ["?piano=0&chip=lead,bass,pad","?pianoHums=0&chip=lead,bass,pad","?pianoHums=0&humHarmony=0"]){
  const flags=bootHumFlags(search);assert.equal(flags.enabled,false,search);const h=field(flags);h.c.humFieldSpawn(h.target("disabled"));h.c.humFieldUpdate();assert.equal(h.c.field(),null);assert.deepEqual(h.trace.events,[]);assert.equal(h.instruments.length,0);
 }
});

test("piano lessons and main play bypass every legacy target oscillator while retaining authored RNG draws",()=>{
 for(const train of [false,true])for(const chip of [false,true]){
  const h=perTarget({piano:true,hums:true,chip,kinds:[]});h.ctx.CHIP_FIELD=true;h.ctx.trainMode=train;
  let uuids=0;h.ctx.THREE.MathUtils={generateUUID(){uuids++;}};
  for(const kind of [0,1,2,3,4]){const snd=h.ctx.makeTargetSound({add(){assert.fail("legacy positional graph created");}});assert.equal(snd,null);h.ctx.voiceTargetSound(snd,kind);h.ctx.singTargetSound(snd,kind,2,true);}
  assert.equal(uuids,5);assert.equal(h.draws.filter(e=>e.op==="pickPenta").length,5);assert.equal(h.draws.filter(e=>e.op==="random").length,chip?1:6);assert.deepEqual(h.events,[]);assert.equal(h.nodes.length,0);
 }
});

test("piano orb pool is exactly two reusable dry shared-patch FM voices on the listener context",()=>{
 const h=field({piano:true,hums:true}),a=h.target("a"),b=h.target("b",4);h.c.humFieldSpawn(a);h.trace.advance(100.1);h.c.humFieldSpawn(b);
 assert.equal(h.contexts.length,1);assert.equal(h.contexts[0].rawContext,h.trace.native);assert.equal(h.contexts[0].options.clockSource,"offline");assert.equal(h.clockListeners.length,1);
 assert.equal(h.instruments.length,2);assert.equal(h.trace.nodes.filter(n=>n.name==="Gain").length,2);assert.equal(h.trace.nodes.filter(n=>n.name==="Panner").length,2);assert.equal(h.trace.nodes.filter(n=>n.name==="Oscillator").length,0);assert.equal(h.trace.waves.length,0);
 const expected=json(h.c.pianoPatch());for(const v of h.c.field().voices){const {context,...patch}=v.osc.options;assert.equal(context,h.contexts[0]);assert.deepEqual(json(patch),expected);assert.equal(v.piano,true);assert.ok(h.trace.events.some(e=>e.op==="connect"&&e.from===v.osc.id&&e.to===v.gain.id));assert.ok(h.trace.events.some(e=>e.op==="connect"&&e.from===v.panner.id&&e.to==="listenerInput"));}
 h.clockListeners[0].fn();assert.ok(h.trace.events.some(e=>e.op==="contextEmit"&&e.name==="tick"));assert.deepEqual(h.touched,[]);
});

test("intro graduation keeps the same piano pool and main-mode sphere calls remain audible commands",()=>{
 const h=field({piano:true,hums:true,train:true}),a=h.target("lesson");h.c.humFieldSpawn(a);assert.equal(h.attacks().length,1);
 const pool=h.c.field().voices;h.trace.advance(100.3);h.c.trainMode=false;h.c.humFieldUpdate();h.c.humFieldSpawn(h.target("main",4));
 assert.equal(h.attacks().length,2);assert.equal(h.c.field().voices,pool);assert.equal(h.instruments.length,2);assert.equal(h.trace.nodes.length,4);assert.deepEqual(h.touched,[]);
});

test("Moonlight lesson calls use the audible octave and keep at least half their gain across the normal range",()=>{
 const moon=main.slice(main.indexOf("{ name:'MOONLIGHT'")),triad=JSON.parse(moon.match(/^\s+triad:(\[\[[^\n]+\]\]),/m)[1]);
 const h=field({piano:true,hums:true,train:true}),target=h.target("lesson",0);h.c.CHORD_TRIAD=triad;
 const notes=triad.map((_,ci)=>h.c.humFieldPitch(target,ci));assert.deepEqual(notes,[207.66,220,207.66,185]);
 h.c.humFieldSpawn(target);const p=h.c.field().voices[0].panner;assert.equal(p.panningModel,"HRTF");assert.equal(p.distanceModel,"inverse");
 for(const distance of [9,18,28]){const gain=p.refDistance/(p.refDistance+p.rolloffFactor*(Math.max(distance,p.refDistance)-p.refDistance));assert.ok(gain>=0.5&&gain<=1,"sphere stays present at "+distance+"m without amplification");}
 h.c.PIANO=false;assert.deepEqual(triad.map((_,ci)=>h.c.humFieldPitch(target,ci)),[103.83,110,103.83,92.5],"legacy calls retain their exact register");
});

for(const tier of [0,1,2,3])test("piano tier "+tier+" announces an off-grid spawn once, including fill-tagged spheres",()=>{
 const h=field({piano:true,hums:true});h.c.humFieldGrid(100,0,tier,0);h.trace.drain(100);h.trace.advance(100.2);
 const a=h.target("fresh",2,{fill16:3});h.c.humFieldSpawn(a);assert.equal(h.attacks().length,1);assert.equal(h.attacks()[0].hz,1100);assert.ok(h.attacks()[0].duration>0);assert.ok(h.attacks()[0].velocity>0);
 const decoy=h.target("decoy",4,{kind:2}),dead=h.target("dead",4,{dead:true}),expired=h.target("expired",4,{expireAt:0});for(const t of [decoy,dead,expired])h.c.humFieldSpawn(t);assert.equal(h.attacks().length,1);assert.deepEqual(h.touched,[]);
});

test("a dense simultaneous spawn batch announces every sphere through only two FM instruments",()=>{
 const h=field({piano:true,hums:true});for(let i=0;i<8;i++)h.c.humFieldSpawn(h.target("orb"+i,[2,4,6,8,12][i%5]));
 assert.equal(h.attacks().length,8);assert.equal(h.instruments.length,2);assert.equal(h.trace.nodes.length,4);
 for(const instrument of h.instruments){const calls=h.attacks().filter(a=>a.id===instrument.id);for(let i=1;i<calls.length;i++)assert.ok(calls[i].at>calls[i-1].at);}
 assert.deepEqual(h.touched,[]);
});

test("due-grid and spawn callbacks cannot double strike the same sphere",()=>{
 for(const order of ["spawn-first","grid-first"]){
  const h=field({piano:true,hums:true});h.c.humFieldGrid(100,0,3,0);
  if(order==="spawn-first"){h.c.humFieldSpawn(h.target("one"));h.trace.drain(100);}else{h.trace.drain(100);h.c.humFieldSpawn(h.target("one"));}
  assert.equal(h.attacks().length,1,order);h.trace.advance(100.4);h.c.humFieldGrid(100.4,0,3,2);h.trace.drain(100.4);assert.equal(h.attacks().length,2,order+" retains the next recurrence");
 }
});

test("a due recurrence cannot steal a new sphere's voice before its piano attack sounds",()=>{
 const h=field({piano:true,hums:true}),a=h.target("older-a",2,{expireAt:10}),b=h.target("older-b",4,{expireAt:11});h.c.humFieldSpawn(a);h.trace.advance(100.1);h.c.humFieldSpawn(b);
 h.trace.advance(100.2);h.c.humFieldGrid(100.2,0,3,0);const fresh=h.target("new",6,{expireAt:15});h.c.humFieldSpawn(fresh);
 const voice=h.c.field().voices.find(v=>v.target===fresh),attack=h.attacks().at(-1),before=h.trace.events.length;assert.equal(attack.hz,660);
 h.trace.drain(100.2);assert.equal(voice.target,fresh);assert.equal(h.attacks().filter(e=>e.id===voice.osc.id).at(-1),attack);
 assert.ok(!h.trace.events.slice(before).some(e=>e.id===voice.gain.gain.id&&e.op==="cancelScheduledValues"&&e.at<=attack.at),"the announced spawn cannot be muted before its attack");assert.deepEqual(h.touched,[]);
});

test("piano notes follow the due chord without a lookahead retune or RNG draw",()=>{
 const h=field({piano:true,hums:true,beat:3.9}),a=h.target("old",2);h.c.humFieldSpawn(a);assert.equal(h.attacks().at(-1).hz,1100);
 h.c.humFieldGrid(100.1,1,0,0);h.trace.advance(100.05);h.c.humFieldSpawn(h.target("before",4));assert.equal(h.attacks().at(-1).hz,880);
 h.trace.advance(100.1);h.c.humFieldSpawn(h.target("boundary",2));assert.equal(h.attacks().at(-1).hz,980);const count=h.attacks().length;h.trace.drain(100.1);assert.equal(h.attacks().length,count);assert.deepEqual(h.touched,[]);
});

test("a sphere born just before a chord boundary waits briefly and announces the new chord once",()=>{
 const h=field({piano:true,hums:true,beat:3.9});h.c.humFieldGrid(100.1,1,0,0);h.trace.advance(100.09);h.c.humFieldSpawn(h.target("pickup",2));
 assert.equal(h.attacks().length,0,"no microscopic old-chord note");h.trace.drain(100.1);assert.equal(h.attacks().length,0);
 h.trace.drain(100.11);assert.equal(h.attacks().length,1);assert.equal(h.attacks()[0].hz,980);assert.ok(h.attacks()[0].at>=200.1);assert.deepEqual(h.touched,[]);
});

test("deferred boundary calls respect pause, death, target identity, lifetime tags and late-frame fences",()=>{
 for(const reason of ["stop","dead","replaced","respawned","late"]){
  const h=field({piano:true,hums:true,beat:3.9});h.c.humFieldGrid(100.1,1,0,0);h.trace.advance(100.09);const a=h.target("pickup");h.c.humFieldSpawn(a);assert.equal(h.attacks().length,0);
  if(reason==="stop")h.c.humFieldStop();
  if(reason==="dead")a.dead=true;
  if(reason==="replaced")h.targets[a.idx]={...a,name:"other-life"};
  if(reason==="respawned"){h.trace.advance(100.105);h.c.humFieldSpawn(a);assert.equal(h.attacks().length,1);}
  h.trace.drain(reason==="late"?100.17:100.11);assert.equal(h.attacks().length,reason==="respawned"?1:0,reason+" cannot replay the old deferred call");assert.equal(h.instruments.length,2);assert.deepEqual(h.touched,[]);
 }
});

test("piano removal, pause and reset mute native tails and fence stale callbacks without new voices",()=>{
 const h=field({piano:true,hums:true}),a=h.target("a"),b=h.target("b",4);h.c.humFieldSpawn(a);h.c.humFieldSpawn(b);h.c.humFieldGrid(100.2,1,3,0);
 a.dead=true;h.c.humFieldUpdate();assert.equal(h.c.field().voices.some(v=>v.target===a),false);h.c.state.running=false;h.c.humFieldUpdate();
 for(const v of h.c.field().voices){assert.equal(v.target,null);assert.equal(h.trace.events.filter(e=>e.id===v.gain.gain.id&&e.op==="setValueAtTime").at(-1).value,0);}
 const count=h.attacks().length,events=h.trace.events.length;h.trace.drain(100.3);h.c.humFieldStop();assert.equal(h.attacks().length,count);assert.equal(h.trace.events.length,events);
 h.c.state.running=true;h.c.humFieldSpawn(b);assert.equal(h.attacks().length,count+1);assert.equal(h.instruments.length,2);assert.equal(h.contexts.length,1);assert.deepEqual(h.touched,[]);
});
