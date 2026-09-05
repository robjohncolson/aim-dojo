"use strict";
const assert=require("node:assert/strict"),vm=require("node:vm");
const {main}=require("./source.js");
const {extractFunction}=require("./chip-graph.js");
const {makeTrace}=require("./hum-field-trace.js");

// Command recorder only: native browser rendering separately checks actual FM sound.
function pianoFieldHarness({piano=true,hums=true,enabled=true,train=false,beat=0,raw=100,native=200}={}){
 const trace=makeTrace({rawTime:raw,nativeTime:native}),targets=[],touched=[],instruments=[],contexts=[],clockListeners=[];
 const deny=()=>{touched.push("forbidden");throw Error("audio field touched gameplay, RNG, transport mutation or storage");};
 const math=Object.create(Math);math.random=deny;
 function param(id){return {id,cancelScheduledValues(at){trace.events.push({op:"cancelScheduledValues",id,at});},setValueAtTime(value,at){trace.events.push({op:"setValueAtTime",id,value,at});}};}
 const globalContext={on(name,fn){clockListeners.push({name,fn});},off(name,fn){const i=clockListeners.findIndex(x=>x.name===name&&x.fn===fn);if(i>=0)clockListeners.splice(i,1);}};
 function Context(options){this.options=options;this.rawContext=options.context;this.emit=name=>trace.events.push({op:"contextEmit",name});this.dispose=()=>{this.disposed=true;};contexts.push(this);}
 function FMSynth(options){
  this.id="fm"+instruments.length;this.name="FMSynth";this.options=options;this.frequency=param(this.id+".frequency");this.last=-Infinity;instruments.push(this);
  this.connect=node=>{trace.events.push({op:"connect",from:this.id,to:node.id});return this;};
  this.triggerAttackRelease=(hz,duration,at,velocity)=>{assert.ok(Number.isFinite(hz)&&hz>0&&Number.isFinite(at));assert.ok(at>this.last,"FM onsets must increase on each reused voice");this.last=at;trace.events.push({op:"pianoAttack",id:this.id,hz,duration,at,velocity});return this;};
  this.triggerRelease=at=>{trace.events.push({op:"pianoRelease",id:this.id,at});return this;};
  this.disconnect=()=>{trace.events.push({op:"disconnect",id:this.id});};this.dispose=()=>{this.disposed=true;};
 }
 let wave;
 const cfg={};for(const key of ["piano","chip"])cfg[key]=vm.runInNewContext("("+main.match(new RegExp("^\\s*"+key+":\\s*(\\{[^\\n]+?\\})","m"))[1]+")");
 cfg.piano.hums=hums;cfg.sing={on:true,degSpan:5};
 const state=new Proxy({running:true},{get(t,k){if(k==="t")return trace.rawCtx.currentTime-raw;if(k!=="running")return deny();return t[k];},set(t,k,v){if(k!=="running")return deny();t[k]=v;return true;}});
 const c=vm.createContext({PIANO:piano,CHIP_FIELD:enabled,soundOn:true,toneReady:true,state,trainMode:train,templeActive:false,_bow:{stage:0},BOW:{LAST:3},
  listener:trace.listener,rawCtx:trace.rawCtx,THREE:trace.THREE,TARGET_AUDIO_STEP:.05,quietAudioMatrixUpdates(){},pulseWave(ctx){return wave||(wave=ctx.createPeriodicWave(new Float32Array(2),new Float32Array([0,1]),{}));},
  CFG:cfg,CHORD_TRIAD:[[220,275,330],[196,245,294],[261.63,327.04,392.44]],PENTA:[110,137.5,165,220,275,330,440],singDegree:k=>({2:6,4:5,6:4,8:3,12:2})[k]??2,targets,Math:math,
  Tone:{Context,FMSynth,getContext:()=>globalContext,Transport:{PPQ:192,getTicksAtTime:t=>(beat+t-raw)*192,start:deny,stop:deny,cancel:deny},Draw:trace.Draw},rnd:deny,pushEvent:deny,spawnTarget:deny,localStorage:new Proxy({},{get:deny}),fetch:deny});
 const names=[...main.matchAll(/^function ((?:humField|pianoField)\w+)\(/gm)].map(m=>m[1]);
 vm.runInContext(main.match(/^let _humField=.*$/m)[0]+"\n"+[...names,"pianoPatch","stopTargetSound"].map(n=>extractFunction(main,n)).join("\n")+"\nthis.field=()=>_humField;",c);
 function target(name,k=2,extra={}){
  const mesh={position:{x:1,y:4,z:-15},children:[],add(pa){if(pa.parent)pa.parent.remove(pa);this.children.push(pa);pa.parent=this;},remove(pa){this.children=this.children.filter(p=>p!==pa);pa.parent=null;}};
  const tg={name,idx:targets.length,mesh,bowK:k,kind:0,fill16:-1,dead:false,expireAt:20,born:0,...extra};targets.push(tg);return tg;
 }
 return {c,trace,targets,target,touched,instruments,contexts,clockListeners,attacks:()=>trace.events.filter(e=>e.op==="pianoAttack"),pitches:()=>trace.events.filter(e=>e.op==="setValueAtTime"&&e.id.endsWith(".frequency"))};
}
module.exports={pianoFieldHarness};
