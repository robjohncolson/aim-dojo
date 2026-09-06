'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {main,html}=require('./source.js');
const {extractFunction}=require('./chip-graph.js');

function noticeSandbox(){
  const classes=new Set(),writes=[];
  const element={classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}};
  const title={textContent:''},count={textContent:''},hint={textContent:''};
  const c=vm.createContext({Math,Number,IS_JA:false,
    CFG:{streakGrace:true,streakFlow:true,wasdRhythm:true,grooveGroove:true,grooveVuln:true,streakMissLimit:2,wasdHud:false},
    state:{running:true,t:10},trainMode:false,templeActive:false,bonusActive:false,
    _streakNotice:{misses:1,kind:'warning',at:10,hits:32},_streakNoticeKey:'',
    streakNoticeEl:element,streakNoticeTitle:title,streakNoticeCount:count,streakNoticeHint:hint,
    streakFlowLevel:()=>1,setText(el,text){writes.push(text);el.textContent=text;},
  });
  vm.runInContext(extractFunction(main,'updateWasdStreakNotice'),c);
  return {c,classes,writes,title,count,hint};
}

test('a warned streak shows a distinct readable count even when the optional beat circle is hidden',()=>{
  const h=noticeSandbox();h.c.updateWasdStreakNotice();
  assert.ok(h.classes.has('on'));assert.ok(!h.classes.has('ended'));
  assert.equal(h.title.textContent,'STREAK AT RISK');assert.equal(h.count.textContent,'1 / 2');
  assert.match(h.hint.textContent,/next note.*recover/);
  const writes=h.writes.length;
  for(let i=0;i<120;i++)h.c.updateWasdStreakNotice();
  assert.equal(h.writes.length,writes,'stable warning causes no repeated DOM text writes');
  h.c._streakNotice.kind='';h.c._streakNotice.misses=0;h.c.updateWasdStreakNotice();
  assert.ok(!h.classes.has('on'),'recovery clears the visible warning');
});

test('terminal feedback displays the frozen exact hit total then expires without changing gameplay',()=>{
  const h=noticeSandbox();Object.assign(h.c._streakNotice,{misses:0,kind:'ended',hits:37});
  h.c.streakFlowLevel=()=>0;h.c.updateWasdStreakNotice();
  assert.ok(h.classes.has('ended'));assert.equal(h.title.textContent,'STREAK ENDED');
  assert.equal(h.count.textContent,'37');assert.equal(h.hint.textContent,'CORRECT HITS');
  h.c._wasdCombo=1;h.c.state.t=12.399;h.c.updateWasdStreakNotice();
  assert.ok(h.classes.has('on'));assert.equal(h.count.textContent,'37');
  h.c.state.t=12.401;h.c.updateWasdStreakNotice();
  assert.ok(!h.classes.has('on'));assert.equal(h.c._wasdCombo,1);
});

test('lessons, paused play, Temple, bonus and disabled rewards suppress notices without erasing the miss chain',()=>{
  for(const change of [c=>c.trainMode=true,c=>c.templeActive=true,c=>c.bonusActive=true,c=>c.state.running=false,
    c=>c.CFG.streakGrace=false,c=>c.CFG.streakFlow=false,c=>c.CFG.wasdRhythm=false,c=>c.CFG.grooveGroove=false,c=>c.CFG.grooveVuln=false]){
    const h=noticeSandbox();h.c.updateWasdStreakNotice();change(h.c);h.c.updateWasdStreakNotice();
    assert.ok(!h.classes.has('on'));assert.equal(h.c._streakNotice.misses,1);
  }
});

test('notice supports the three-miss tuning, Japanese copy and a static accessible overlay',()=>{
  const h=noticeSandbox();h.c.CFG.streakMissLimit=3;h.c._streakNotice.misses=2;h.c.IS_JA=true;h.c.updateWasdStreakNotice();
  assert.equal(h.count.textContent,'2 / 3');assert.equal(h.title.textContent,'ストリーク注意');
  assert.match(html,/id="streakNotice" role="status" aria-live="polite" aria-atomic="true"/);
  const style=html.match(/#streakNotice\{([^}]+)\}/)[1];
  assert.match(style,/pointer-events:none/);assert.match(style,/max-width:calc\(100vw - 28px\)/);
  assert.doesNotMatch(style,/animation:|backdrop-filter:|filter:/);
  assert.match(extractFunction(main,'animate'),/updateWasdStreakNotice\(\);/);
});
