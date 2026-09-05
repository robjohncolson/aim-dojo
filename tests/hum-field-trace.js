"use strict";
const assert=require('node:assert/strict');

// This records commands and graph ownership only. Audible-envelope assertions
// belong in native OfflineAudioContext; this double does not emulate the DSP.
function makeTrace({rawTime=100,nativeTime=200}={}){
  const events=[],nodes=[],draws=[],waves=[];
  const native={currentTime:nativeTime};
  const rawCtx={currentTime:rawTime};
  function param(id,value){
    let current=value;
    const out={id,get value(){return current;},set value(value){current=value;events.push({op:'value',id,value,now:native.currentTime});}};
    for(const op of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime'])out[op]=(value,at,timeConstant)=>{
      assert.ok(Number.isFinite(value)&&Number.isFinite(at),'audio automation numbers are finite');
      events.push({op,id,value,at,timeConstant,now:native.currentTime});return out;
    };
    for(const op of ['cancelScheduledValues','cancelAndHoldAtTime'])out[op]=at=>{events.push({op,id,at,now:native.currentTime});return out;};
    return out;
  }
  function node(name){
    const n={id:'n'+nodes.length,name}; nodes.push(n);events.push({op:'construct',id:n.id,name});
    n.connect=other=>{assert.ok(other&&other.id,'connection destination is recorded');events.push({op:'connect',from:n.id,to:other.id});return other;};
    n.disconnect=()=>events.push({op:'disconnect',id:n.id});
    n.start=at=>events.push({op:'start',id:n.id,at,now:native.currentTime});
    n.stop=at=>events.push({op:'stop',id:n.id,at,now:native.currentTime});
    if(name==='Oscillator'){n.frequency=param(n.id+'.frequency',440);n.detune=param(n.id+'.detune',0);n.setPeriodicWave=wave=>{assert.ok(waves.includes(wave));events.push({op:'wave',id:n.id,wave:wave.id});};}
    if(name==='Gain')n.gain=param(n.id+'.gain',1);
    if(name==='Panner')for(const axis of ['X','Y','Z'])n['position'+axis]=param(n.id+'.position'+axis,0);
    n.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},copy(p){return this.set(p.x,p.y,p.z);}};
    return n;
  }
  native.createOscillator=()=>node('Oscillator');native.createGain=()=>node('Gain');native.createPanner=()=>node('Panner');
  native.createPeriodicWave=(real,imag,options)=>{const wave={id:'w'+waves.length,real,imag,options};waves.push(wave);return wave;};
  const listener={context:native,getInput:()=>({id:'listenerInput'})};
  function PositionalAudio(owner){
    assert.equal(owner,listener);const n=node('PositionalAudio');
    for(const method of ['setRefDistance','setRolloffFactor','setDistanceModel','setMaxDistance','setVolume'])n[method]=value=>{events.push({op:method,id:n.id,value});return n;};
    n.setNodeSource=source=>{events.push({op:'setNodeSource',id:n.id,from:source.id});return n;};
    n.updateMatrixWorld=()=>{};return n;
  }
  const Draw={schedule(fn,at){draws.push({fn,at});}};
  return {events,nodes,waves,draws,native,rawCtx,listener,THREE:{PositionalAudio},Draw,
    advance(t){const dt=t-rawCtx.currentTime;rawCtx.currentTime=t;native.currentTime+=dt;},
    drain(t){this.advance(t);const due=draws.filter(d=>d.at<=t);for(const draw of due){draws.splice(draws.indexOf(draw),1);draw.fn();}},
  };
}
module.exports={makeTrace};
