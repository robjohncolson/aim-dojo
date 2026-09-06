'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm');
const budget=require('../device-budget.js');
const {main,html}=require('./source.js');
const {extractFunction}=require('./chip-graph.js');

test('phones and modest hardware get bounded resources without changing the art or audio',()=>{
  for(const hints of [{mobile:true},{weak:true},{cores:4},{memory:4},{saveData:true}]){
    const b=budget.resolve(hints);
    assert.equal(b.textureTier,'compact'); assert.equal(b.renderFps,60); assert.equal(b.panningModel,'HRTF');
  }
  const strong=budget.resolve({cores:16,memory:8});
  assert.equal(strong.textureTier,'full'); assert.equal(strong.renderFps,0);
  for(const hints of [{},{cores:0,memory:0},{cores:undefined,memory:undefined}]) assert.equal(budget.resolve(hints).lean,false);
  for(const low of [true,false]){
    const b=budget.resolve({preference:'lean'}), r=budget.dprBounds({low,budget:b,deviceDpr:3});
    assert.equal(r.start,low?0.4:0.8);
    assert.ok(r.min<=r.start&&r.start<=r.max);
  }
});

test('explicit overrides and saved settings have predictable independent precedence',()=>{
  const full=budget.resolve({mobile:true,weak:true,preference:'lean',search:'?performance=full&renderfps=60'});
  assert.equal(full.mode,'full'); assert.equal(full.textureTier,'full'); assert.equal(full.renderFps,60);
  assert.equal(budget.resolve({mobile:true,framePreference:'native'}).renderFps,0);
  assert.equal(budget.resolve({framePreference:'native',search:'?renderfps=60'}).renderFps,60);
  assert.equal(budget.resolve({preference:'lean',search:'?performance=invalid'}).mode,'lean');
  assert.equal(budget.resolve({preference:'invalid',search:'?performance=invalid'}).mode,'auto');
  assert.equal(budget.resolve({search:'?panning=equalpower'}).panningModel,'equalpower');
  assert.equal(budget.resolve({search:'?panning=garbage'}).panningModel,'HRTF');
  assert.equal(budget.resolve({search:'?hi'}).mode,'auto');
});

test('60 FPS gate keeps cadence at 60/90/120/144/240 Hz and never caps simulation callbacks',()=>{
  for(const hz of [30,60,90,120,144,240]){
    const gate=budget.createRenderGate(60); let updates=0,draws=0;
    for(let i=0;i<hz*10;i++){ updates++; if(gate.due(1000+i*1000/hz)) draws++; }
    assert.equal(updates,hz*10);
    assert.equal(draws,Math.min(hz,60)*10,String(hz));
    gate.setFps(0);
    for(let i=0;i<100;i++) assert.equal(gate.due(12000+i),true);
  }
});

test('render ceiling tolerates timestamp jitter, long stalls and live setting changes',()=>{
  const gate=budget.createRenderGate(60); let count=0;
  for(let i=0;i<1200;i++) if(gate.due(1000+i*1000/120+(i%3-1)*.1)) count++;
  assert.ok(count>=599&&count<=601,String(count));
  assert.equal(gate.due(100000),true); assert.equal(gate.due(100001),false);
  gate.reset(); assert.equal(gate.due(100002),true);
  gate.setFps(0); assert.equal(gate.due(100003),true);
  gate.setFps(60); assert.equal(gate.due(100004),true); assert.equal(gate.due(100005),false);
});

test('sustained slow play changes the buffer only at pause and never below its floor',()=>{
  const monitor=budget.createQualityMonitor({min:.35,max:.5});
  for(let i=0;i<300;i++) assert.equal(monitor.sample(1/30,true,.5),null);
  assert.equal(monitor.pending,.4);
  assert.equal(monitor.sample(1/60,false,.5),.4);
  assert.equal(monitor.sample(1/60,false,.4),null);
  for(let i=0;i<300;i++) monitor.sample(1/30,true,.4);
  assert.equal(monitor.sample(1/60,false,.4),.35);
  for(let i=0;i<300;i++) monitor.sample(1/30,true,.35);
  assert.equal(monitor.pending,null);
});

test('warm-up spikes, a short hitch and normal high-refresh play do not lower quality',()=>{
  for(const hz of [60,90,120,144]){
    const monitor=budget.createQualityMonitor({min:.35,max:.5});
    for(let i=0;i<30;i++) monitor.sample(1/30,true,.5);
    for(let i=0;i<hz*20;i++) monitor.sample(i===hz*10?.1:1/hz,true,.5);
    assert.equal(monitor.pending,null,String(hz));
  }
});

test('runtime quality transition resizes exactly once after slow play pauses',()=>{
  const applied=[], monitor=budget.createQualityMonitor({min:.35,max:.5});
  const c=vm.createContext({renderQuality:monitor,state:{running:true},renderDpr:.5,setRenderDpr:n=>applied.push(n)});
  vm.runInContext(extractFunction(main,'updateRenderQuality'),c);
  for(let i=0;i<300;i++) c.updateRenderQuality(1/30);
  assert.deepEqual(applied,[]);
  c.state.running=false;c.updateRenderQuality(1/60);c.updateRenderQuality(1/60);
  assert.deepEqual(applied,[.4]);
});

test('only drawing is gated in the game loop; the budget module loads before the runtime',()=>{
  assert.ok(html.indexOf('src="device-budget.js"')<html.indexOf('defer src="aim-dojo-main.js"'));
  const animate=extractFunction(main,'animate');
  assert.match(animate,/if\(renderFrameDue\)\{ if\(reflectionPending\) renderReflection\(\); renderer\.render\(scene,camera\);/);
  assert.doesNotMatch(animate,/if\(!renderFrameDue\)\s*(?:\{\s*)?return/);
  for(const required of ['_audioFrame++','pollGamepad(dt)','camera.updateMatrixWorld()','updateProjectiles(dt)','updateWasdCursor()']) assert.ok(animate.includes(required),required);
  assert.match(animate,/if\(renderFrameDue\) drawWasdLane\(\)/);
  assert.match(extractFunction(main,'renderReflection'),/if\(!renderFrameDue\)\{ reflectionPending=true; return; \}/);
});
