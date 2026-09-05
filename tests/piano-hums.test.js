"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),test=require("node:test");
const ROOT=path.resolve(__dirname,"..");
const {sourceFor}=require(path.join(ROOT,"tests/source.js"));
const {extractFunction,chipDefaults}=require(path.join(ROOT,"tests/chip-graph.js"));
const {makeTrace}=require(path.join(ROOT,"tests/hum-field-trace.js"));
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
function field({piano=false,hums=false,enabled=true}={}){
 const fieldNames=Function("return "+fieldTest.match(/const fieldNames=(\[[^;]+\]);/)[1])();
 const source=main.match(/let _humField=CHIP_FIELD\?[^;\n]+;/)[0]+"\n"+fieldNames.map(n=>extractFunction(main,n)).join("\n");
 const harness=Function("vm","makeTrace","main","source","extractFunction",recorderFunction(fieldTest,"harness")+"\nreturn harness;")(vmWithFlags(piano,hums),makeTrace,main,source,extractFunction);
 return harness({enabled});
}
function json(value){return JSON.parse(JSON.stringify(value));}
function finishTargets(h){for(let i=0;i<h.sounds.length;i++){for(const k of [2,4,6])h.ctx.singTargetSound(h.sounds[i],i,k,true);h.ctx.stopTargetSound(h.sounds[i]);h.ctx.stopTargetSound(h.sounds[i]);}return h;}
function timing(h){
 const ids=new Map();for(let i=0;i<h.sounds.length;i++)for(const [key,node]of Object.entries(h.sounds[i]))if(node&&node.id)ids.set(node.id,"s"+i+"."+key);
 const rename=id=>{if(!id)return id;const dot=id.indexOf("."),root=dot<0?id:id.slice(0,dot);return (ids.get(root)||root)+(dot<0?"":id.slice(dot));};
 return json(h.events.filter(e=>e.id&&(/\.frequency$/.test(e.id)||h.sounds.some(s=>s.gateGain&&e.id===s.gateGain.gain.id||s.outGain&&e.id===s.outGain.gain.id)||["start","stop","setRefDistance","setRolloffFactor","setDistanceModel","setMaxDistance"].includes(e.op))).map(e=>({...e,id:rename(e.id)})));
}
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

test("piano hum calls use native sine carriers, authored gain, and no send on either per-target arm",()=>{
 for(const chip of [false,true]){const h=perTarget({chip,piano:true,hums:true});assert.equal(h.waves.length,0);for(const s of h.sounds){assert.equal(s.osc.type,"sine");assert.equal(s.ampGain.gain.value,chipDefaults.humGain);assert.equal(s.send,null);assert.ok(h.events.some(e=>e.op==="connect"&&e.from===s.osc.id&&e.to===s.ampGain.id));assert.ok(h.events.some(e=>e.op==="setNodeSource"&&e.source===s.outGain.id&&e.id===s.pa.id));}assert.ok(!h.events.some(e=>e.op==="connect"&&e.to==="reverbInput"));assert.ok(h.nodes.every(n=>["Oscillator","Gain","BiquadFilter","PositionalAudio"].includes(n.name)));}
});

test("piano waveform choice preserves k pitch, pickup timing, gates, position settings, cleanup, and RNG draws",()=>{
 for(const chip of [false,true]){const expected=finishTargets(perTarget({chip})),actual=finishTargets(perTarget({chip,piano:true,hums:true}));assert.deepEqual(timing(actual),timing(expected));assert.deepEqual(actual.draws,expected.draws);assert.equal(actual.draws.filter(e=>e.op==="random").length,chip?1:6);assert.equal(actual.draws.filter(e=>e.op==="pickPenta").length,5);}
});

test("piano native calls retain the existing non-chip gold twin and kind modulation",()=>{
 for(const chip of [false,true]){const h=perTarget({chip,piano:true,hums:true}),gold=h.sounds[1];assert.equal(!!gold.osc2,!chip);if(gold.osc2){assert.equal(gold.osc2.type,"sine");assert.ok(Math.abs(gold.osc2.frequency.value/gold.osc.frequency.value-1.004)<1e-12);}for(const s of h.sounds)assert.equal(!!s.lfo,!chip);assert.ok(h.sounds[4].lfo2);assert.equal(!!h.sounds[3].lfo2,chip);}
});

test("piano hums false leaves the shared pulse graph and event stream exact",()=>{
 const expected=exerciseField(field());for(const flags of [{piano:false,hums:true},{piano:true,hums:false}]){const h=exerciseField(field(flags));assert.deepEqual(h.trace.events,expected.trace.events);assert.equal(h.trace.waves.length,1);assert.deepEqual(h.touched,[]);}
});

test("piano shared field uses two reusable sine carriers without a wave, FM voice, send or extra random draw",()=>{
 const h=field({piano:true,hums:true}),a=h.target("a"),b=h.target("b",4);h.c.humFieldSpawn(a);h.c.humFieldSpawn(b);const nodes=h.trace.nodes.length;h.c.humFieldSpawn(h.target("c",6));assert.equal(h.trace.nodes.length,nodes);assert.equal(h.trace.nodes.filter(n=>n.name==="Oscillator").length,2);assert.equal(h.trace.nodes.filter(n=>n.name==="Panner").length,2);assert.equal(h.trace.waves.length,0);assert.ok(h.c.field().voices.every(v=>v.osc.type==="sine"));assert.ok(h.trace.nodes.every(n=>["Oscillator","Gain","Panner"].includes(n.name)));assert.deepEqual(h.touched,[]);
});

test("piano shared waveform preserves chord boundaries, frequency, density, envelopes, native clocks and stopping",()=>{
 const expected=exerciseField(field()),actual=exerciseField(field({piano:true,hums:true}));assert.deepEqual(actual.trace.events,expected.trace.events.filter(e=>e.op!=="wave"));assert.deepEqual(actual.pitches(),expected.pitches());assert.deepEqual(actual.touched,[]);assert.equal(actual.trace.draws.length,0);
});

test("piano hums does not enable the shared field or allocate nodes when CHIP_FIELD is false",()=>{
 const h=field({piano:true,hums:true,enabled:false}),a=h.target("a");h.c.humFieldSpawn(a);h.c.humFieldGrid(100.1,1,3,0);h.c.humFieldUpdate();h.c.humFieldStop();assert.equal(h.c.field(),null);assert.deepEqual(h.trace.events,[]);assert.deepEqual(h.trace.draws,[]);assert.deepEqual(h.touched,[]);
});

function bootHumFlags(search){
 const cfg={};for(const key of ["piano","chip"]){const literal=main.match(new RegExp("^\\s*"+key+":\\s*(\\{[^\\n]+?\\})","m"));assert.ok(literal,"the authored "+key+" config is present");cfg[key]=vm.runInNewContext("("+literal[1]+")");}
 const hashAt=search.indexOf("#"),location={search:hashAt<0?search:search.slice(0,hashAt),hash:hashAt<0?"":search.slice(hashAt)};
 const boot=[/^const PIANO=resolvePiano\([^\n]+/m,/^if\(PIANO\) resolvePianoHums\([^\n]+/m,/^resolveHum\([^\n]+/m,/^const \[CHIP_LEAD[^\n]+/m,/^const CHIP_FIELD=[^\n]+/m].map(pattern=>{const match=main.match(pattern);assert.ok(match,"the real boot statement is present: "+pattern);return match[0];});
 const c=vm.createContext({CFG:cfg,location});
 vm.runInContext([...["resolvePiano","resolvePianoHums","resolveHum","resolveChip"].map(name=>extractFunction(main,name)),...boot,"globalThis.flags={piano:PIANO,hums:CFG.piano.hums,chip:CHIP_HUMS,enabled:CHIP_FIELD,cfg:CFG};"].join("\n"),c);
 return json(c.flags);
}

test("piano authored boot selects two native sine field carriers and explicit escapes restore the live pulse graph",()=>{
 const defaults=bootHumFlags("");assert.deepEqual({piano:defaults.piano,hums:defaults.hums,chip:defaults.chip,enabled:defaults.enabled},{piano:true,hums:true,chip:true,enabled:true});
 const h=field(defaults);h.c.CFG.chip=defaults.cfg.chip;h.c.CFG.piano=defaults.cfg.piano;exerciseField(h);
 assert.equal(h.trace.nodes.filter(n=>n.name==="Oscillator").length,2);assert.equal(h.trace.nodes.filter(n=>n.name==="Panner").length,2);assert.equal(h.trace.waves.length,0);
 assert.ok(h.c.field().voices.every(v=>v.osc.type==="sine"));assert.ok(h.trace.nodes.every(n=>["Oscillator","Gain","Panner"].includes(n.name)));assert.deepEqual(h.touched,[]);
 const legacy=exerciseField(field());
 for(const search of ["?pianoHums=0","#pianoHums=0","?piano=0","?piano=0&pianoHums=0"]){
  const flags=bootHumFlags(search);assert.equal(flags.chip,true,search);assert.equal(flags.enabled,true,search);
  if(search.startsWith("?piano=0")){assert.equal(flags.piano,false);assert.equal(flags.hums,true,"pianoHums overrides are not applied on a piano-off boot");}else{assert.equal(flags.piano,true);assert.equal(flags.hums,false);}
  const control=field(flags);control.c.CFG.chip=flags.cfg.chip;control.c.CFG.piano=flags.cfg.piano;exerciseField(control);
  assert.deepEqual(control.trace.events,legacy.trace.events,search+" restores the prior graph and schedule");assert.equal(control.trace.waves.length,1);assert.equal(control.trace.nodes.filter(n=>n.name==="Oscillator").length,2,"the escape restores carriers rather than silencing them");assert.deepEqual(control.touched,[]);
 }
});

test("piano boot keeps chip-list selection and humHarmony independent, routing excluded fields through native per-target calls",()=>{
 for(const [search,piano,chip]of [["?chip=lead,bass,pad",true,false],["?humHarmony=0",true,true],["?piano=0&chip=lead,bass,pad",false,false],["?pianoHums=0&chip=lead,bass,pad",true,false]]){
  const flags=bootHumFlags(search);assert.equal(flags.piano,piano,search);assert.equal(flags.chip,chip,search);assert.equal(flags.enabled,false,search);
  // The reused per-target recorder constructs immediately; verify its native
  // tuning inputs equal the authored boot values before comparing that graph.
  for(const key of ["humDuty","humOctave","humGain","humHarmonics"])assert.equal(flags.cfg.chip[key],chipDefaults[key],key);
  const h=finishTargets(perTarget(flags));
  assert.equal(h.sounds.length,5);assert.ok(h.nodes.every(n=>["Oscillator","Gain","BiquadFilter","PositionalAudio"].includes(n.name)),"every per-target voice remains native, with no FM instrument");
  if(flags.piano&&flags.hums){assert.equal(h.waves.length,0);for(const s of h.sounds){assert.equal(s.osc.type,"sine");assert.equal(s.ampGain.gain.value,flags.cfg.chip.humGain);assert.equal(s.send,null);}}
  else{const legacy=finishTargets(perTarget({chip}));assert.deepEqual(h.events,legacy.events,search);assert.deepEqual(h.draws,legacy.draws,search);}
  const disabled=field(flags),target=disabled.target("no-field");disabled.c.humFieldSpawn(target);disabled.c.humFieldUpdate();assert.equal(disabled.c.field(),null);assert.deepEqual(disabled.trace.events,[],"per-target selection never allocates the shared two-carrier pool");
 }
});
