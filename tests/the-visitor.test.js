"use strict";
// These tests use only in-memory relay responses. No request can reach production.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const ROOT=path.resolve(__dirname,'..');
const {sourceFor,html}=require('./source.js');
const source=sourceFor('ghostToken');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'ghost-relay-core.fixture.json'),'utf8'));

function closeBrace(s,at){
  let depth=0,quote='',line=false,block=false;
  for(let i=at;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return i;
  }
  throw Error('unclosed function');
}
function extract(s,name){
  const m=new RegExp(`\\b(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(s);
  assert.ok(m,`${name} is present`);
  const open=s.indexOf('{',m.index+m[0].length);
  return s.slice(m.index,closeBrace(s,open)+1);
}
function realCivilDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const y=+value.slice(0,4),m=+value.slice(5,7),d=+value.slice(8,10),date=new Date(y,m-1,d);
  return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;
}
function artifact(overrides={}){return {v:1,date:'2026-08-22',moonBucket:4,bpm0:60,dur:60,bpmCurve:[[0,60]],targets:[],taps:[],fires:[],...overrides};}
function response(value,{declared,chunkSize=32768,stall=false,reads}={}){
  const bytes=new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));let offset=0;
  return {ok:true,headers:{get:()=>declared===undefined?null:String(declared)},body:{getReader:()=>({
    read(){if(reads)reads.count++;if(stall)return new Promise(()=>{});if(offset>=bytes.length)return Promise.resolve({done:true});const value=bytes.slice(offset,offset+chunkSize);offset+=value.length;return Promise.resolve({done:false,value});},
    cancel(){return Promise.resolve();}
  })}};
}
function core(s=source,{share=true,record=false,extra={},functions=[]}={}){
  const start=s.indexOf('const GH_RECORD=!!CFG.ghostRecord;'),end=s.indexOf('let _ghostRecord=',start);
  assert.ok(start>=0&&end>start,'ghost constants remain independently extractable');
  const ctx=vm.createContext({Math,Number,JSON,Promise,Date,Set,Uint8Array,Uint16Array,Float32Array,TextDecoder,AbortController,GH_CHALK:false,
    CFG:{ghostRecord:+record,ghostShare:+share,ghostChalk:0,skyDay:{api:'https://relay.example'}},LOW:false,WEAK:false,PITCH_LIMIT:88*Math.PI/180,
    _ghostToken:'',_ghostShareEpoch:4,_ghostShareSentEpoch:-1,_ghostVisitors:[],_ghostOwn:null,_ghostMailRows:[],_ghostMailSpoken:false,_ghostLocalMailCount:0,_ghostLocalMailSpoken:false,
    realCivilDate,localStorage:{getItem:()=>null,setItem(){}},setTimeout,clearTimeout,
    fetch(){throw Error('test must provide a scratch relay response');},...extra});
  vm.runInContext(s.slice(start,end)+'\n'+[...new Set([...Object.keys(fixture.functions),...functions])].map(n=>extract(s,n)).join('\n'),ctx);
  return ctx;
}

test('C1 relay and artifact core remains byte-identical to ad8a9a9',()=>{
  for(const [name,body]of Object.entries(fixture.functions))assert.equal(extract(source,name),body,`${name} survivor changed`);
});

test('the bearer is minted once, reused, fail-soft, and timezone buckets stay coarse',()=>{
  let stored='invalid',reads=0,writes=0;
  const c=core(source,{extra:{crypto:{getRandomValues(b){b.forEach((_,i)=>b[i]=i);return b;}},localStorage:{getItem(){reads++;return stored;},setItem(_k,v){writes++;stored=v;}}}});
  assert.equal(c.ghostToken(),'000102030405060708090a0b0c0d0e0f');assert.equal(c.ghostToken(),stored);assert.equal(reads,1);assert.equal(writes,1);
  assert.deepEqual([-330,210,-840].map(c.ghostLonBucket),[18,9,2]);
  for(const bad of ['',null,123,'z'.repeat(32),'a'.repeat(31),'a'.repeat(33)])assert.equal(c.ghostTokenValid(bad),false);
  const denied=core(source,{extra:{localStorage:{getItem(){throw Error('disabled');},setItem(){throw Error('must not write');}}}});
  assert.equal(denied.ghostToken(),'');
});

test('share zero cannot mint, store, fetch, start a timeout, upload, or send mail',async()=>{
  const counts={storage:0,fetch:0,timer:0};
  const c=core(source,{share:false,extra:{localStorage:{getItem(){counts.storage++;},setItem(){counts.storage++;}},fetch(){counts.fetch++;return Promise.resolve({ok:false});},setTimeout(){counts.timer++;},clearTimeout(){}}});
  assert.equal(c.ghostToken(),'');assert.equal(c.ghostRelayUrl('/api/ghosts'),'');
  assert.equal(await c.ghostRelayFetch('/api/ghosts',{}),null);
  c.ghostShareUpload(artifact());await c.ghostMailAttempt('a'.repeat(32),'b'.repeat(32),[[1,0]]);
  assert.deepEqual(counts,{storage:0,fetch:0,timer:0});
});

test('upload and mail POST wire shapes keep bearer only in headers',async()=>{
  const requests=[],c=core(source,{extra:{fetch(url,init){requests.push({url,init});return Promise.resolve({ok:true});}}});
  const night=artifact();
  await c.ghostUploadAttempt('a'.repeat(32),18,night);
  await c.ghostMailAttempt('b'.repeat(32),'c'.repeat(32),[[8,1],[9,3]]);
  assert.deepEqual(requests.map(r=>r.url),['https://relay.example/api/ghost','https://relay.example/api/ghost-mail']);
  assert.deepEqual(JSON.parse(requests[0].init.body),{lonBucket:18,artifact:night});
  assert.deepEqual(JSON.parse(requests[1].init.body),{toId:'c'.repeat(32),catches:[[8,1],[9,3]]});
  for(let i=0;i<requests.length;i++){
    assert.equal(requests[i].init.method,'POST');assert.equal(requests[i].init.headers['X-Ghost-Token'],'ab'[i].repeat(32));
    assert.equal(requests[i].init.headers['Content-Type'],'application/json');
    assert.doesNotMatch(requests[i].url,/[a-f0-9]{32}/);assert.doesNotMatch(requests[i].init.body,/"token"\s*:/);
  }
});

test('courtesy upload keeps artifact identity, never waits, and retries once after thirty seconds',async()=>{
  const calls=[],timers=[],c=core(source,{extra:{setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){}}});
  c._ghostToken='a'.repeat(32);c.ghostLonBucket=()=>7;c.ghostUploadAttempt=(...args)=>{calls.push(args);return Promise.resolve(false);};
  const night=artifact();assert.equal(c.ghostShareUpload(night),undefined);
  await new Promise(setImmediate);
  assert.equal(calls.length,1);assert.equal(calls[0][2],night);assert.equal(calls[0][3],false);
  assert.equal(timers.length,1);assert.equal(timers[0].ms,30000);timers[0].fn();await new Promise(setImmediate);
  assert.equal(calls.length,2);assert.equal(calls[1][2],night);assert.equal(calls[1][3],undefined);assert.equal(timers.length,1);
  const finalize=extract(source,'ghostRecordFinalize');
  assert.match(finalize,/localStorage\.setItem\(GH_STORE_KEY,json\);[\s\S]*if\(GH_SHARE\) ghostShareUpload\(r,pageExit===true\);/);
});

test('keepalive is opt-in only for a page-exit UTF-8 envelope at or below 65536 bytes',async()=>{
  const atSize=n=>{const padding='🌕';const base=Buffer.byteLength(JSON.stringify({lonBucket:7,artifact:{padding}}));return {padding:padding+'x'.repeat(n-base)};};
  const requests=[],c=core(source,{extra:{fetch(url,init){requests.push({url,init});return Promise.resolve({ok:true});}}});
  await c.ghostUploadAttempt('a'.repeat(32),7,atSize(65536),true);await c.ghostUploadAttempt('a'.repeat(32),7,atSize(65537),true);await c.ghostUploadAttempt('a'.repeat(32),7,atSize(65536));
  assert.deepEqual(requests.map(r=>Buffer.byteLength(r.init.body)),[65536,65537,65536]);
  assert.deepEqual(requests.map(r=>r.init.keepalive),[true,undefined,undefined]);
});

test('relay JSON limits the declared size and actual streamed bytes independently',async()=>{
  const declaredReads={count:0},streamedReads={count:0};
  const responses=[response({},{declared:100001,reads:declaredReads}),response(' '.repeat(100001)+'{}',{declared:2,chunkSize:60000,reads:streamedReads})];
  const c=core(source,{extra:{fetch:()=>Promise.resolve(responses.shift())}});
  assert.equal(await c.ghostRelayJson('/api/ghost-mail',{}),null);assert.equal(await c.ghostRelayJson('/api/ghost-mail',{}),null);
  assert.equal(declaredReads.count,0);assert.ok(streamedReads.count>=2);
});

test('relay JSON rejects malformed bodies and admits only the explicit larger visitor envelope',async()=>{
  const data={ghosts:[],padding:'x'.repeat(110000)},responses=[response('{'),response(data),response(data)];
  const c=core(source,{extra:{fetch:()=>Promise.resolve(responses.shift())}});
  assert.equal(await c.ghostRelayJson('/api/ghost-mail',{}),null);
  assert.equal(await c.ghostRelayJson('/api/ghost-mail',{}),null);
  const value=await c.ghostRelayJson('/api/ghosts?lon=8&n=4',{},404096);assert.equal(value.padding.length,110000);
});

test('the four-second relay timeout remains armed through stalled body consumption',async()=>{
  const timers=[];let signal;
  const c=core(source,{extra:{fetch(_url,init){signal=init.signal;return Promise.resolve(response('{}',{stall:true}));},setTimeout(fn,ms){const t={fn,ms,active:true};timers.push(t);return t;},clearTimeout(t){if(t)t.active=false;}}});
  const pending=c.ghostRelayJson('/api/ghost-mail',{});await new Promise(setImmediate);
  assert.equal(timers.length,1);assert.equal(timers[0].ms,4000);assert.equal(timers[0].active,true);
  timers[0].fn();assert.equal(await pending,null);assert.equal(signal.aborted,true);assert.equal(timers[0].active,false);
});

test('artifact validation still rejects malformed transport keys, times, slots, rows and aim',()=>{
  const c=core(),base=artifact();assert.equal(c.ghostArtifactValid(base),base);
  const bads=[
    {v:2},{date:'2026-02-31'},{extra:1},{dur:44},{moonBucket:8},{bpm0:0},
    {targets:Array.from({length:1201},(_,i)=>[0,0,i,1,0,null])},
    {targets:[[0,0,7,2,0,null],[1,1,7,3,0,null]]},
    {targets:[[0,0,Number.MAX_SAFE_INTEGER+1,2,0,null]]},{targets:[[0,0,0,2,1,3]]},
    {targets:[[0,0,0,1,1,null]]},{targets:[[0,0,0,1,0,0.5]]},
    {fires:[[1,Math.PI+.01,0,0]]},{fires:[[1,0,c.PITCH_LIMIT+.01,0]]},
    {taps:[[2,0,90],[1,1,90]]},{taps:[[1,4,90]]},{taps:[[1,1,101]]},
    {bpmCurve:[[2,60],[1,60]]}
  ];
  for(const bad of bads)assert.equal(c.ghostArtifactValid({...base,...bad}),null,JSON.stringify(bad).slice(0,120));
});

test('legacy wrappers and two-column outgoing mail remain transport-compatible',()=>{
  const c=core(),night=artifact(),mail=[[0,0],[60,3]],wrapper={ghost:night,mail};
  assert.equal(c.ghostWrapperValid(wrapper),wrapper);assert.equal(c.ghostMailValid(mail,60),mail);
  for(const bad of [null,{},[[0,4]],[[61,0]],[[2,0],[1,1]],[[0,0,2]],Array.from({length:65},()=>[0,0])])assert.equal(c.ghostMailValid(bad,60),null);
  for(const bad of [{...wrapper,extra:1},{ghost:{...night,extra:1},mail},{ghost:night,mail:[[61,0]]}])assert.equal(c.ghostWrapperValid(bad),null);
});

test('moon identity remains an eight-item sigil with no id fallback',()=>{
  const c=core();assert.deepEqual(Array.from({length:8},(_,i)=>c.ghostMoonSigil(i)),Array.from('🌑🌒🌓🌔🌕🌖🌗🌘'));
  for(const value of [-1,8,1.5,'4',NaN,null])assert.equal(c.ghostMoonSigil(value),'');
});

const DATA_FUNCTIONS=['ghostVisitorStore','ghostVisitorFetch','ghostMailRowsValid','ghostMailFetch','ghostVisitorLine','ghostVisitorMailLine'];
function data(extra={},options={}){
  return core(source,{...options,functions:DATA_FUNCTIONS,extra:{
    state:new Proxy({running:true,bpm:60,streak:3},{set(){throw Error('ghost data cannot write gameplay');},get(o,k){if(k==='t')throw Error('ghost data cannot read the gameplay clock');return o[k];}}),
    rnd(){throw Error('ghost data cannot advance gameplay RNG');},
    THREE:new Proxy({},{get(){throw Error('C1 data cannot build any scene object');}}),
    TF:(_key,text,values={})=>text.replace(/\{(\w+)\}/g,(_m,k)=>String(values[k])),GH_CHALK:true,...extra
  }});
}

test('plain doors (ghostChalk:0) speak no chalk sentence even with strangers seated',async()=>{
  const item={id:'b'.repeat(32),artifact:artifact({moonBucket:7}),reachedBack:true};
  const c=data({GH_CHALK:false,fetch:()=>Promise.resolve(response({ghosts:[item]}))});await c.ghostVisitorFetch(4,'a'.repeat(32),8);
  assert.equal(c._ghostVisitors.length,1);assert.equal(c.ghostVisitorLine(),'');
});

test('C1 stores three validated strangers without geometry and ignores a fourth visual source',async()=>{
  const ghosts=[0,3,7,4].map((moonBucket,i)=>({id:'bcde'[i].repeat(32),artifact:artifact({moonBucket}),reachedBack:i===1}));
  const requests=[],c=data({fetch(url,init){requests.push({url,init});return Promise.resolve(response({ghosts}));}});
  await c.ghostVisitorFetch(4,'a'.repeat(32),8);
  assert.equal(requests.length,1);assert.equal(requests[0].url,'https://relay.example/api/ghosts?lon=8&n=4');
  assert.equal(requests[0].init.headers['X-Ghost-Token'],'a'.repeat(32));assert.equal(requests[0].init.body,undefined);
  assert.equal(c._ghostVisitors.length,3);assert.deepEqual(Array.from(c._ghostVisitors,v=>v.id),ghosts.slice(0,3).map(v=>v.id));
  assert.deepEqual(Array.from(c._ghostVisitors,v=>v.back),[false,true,false]);
  assert.deepEqual(Array.from(c._ghostVisitors,v=>v.sig),[0,3,7]);
  assert.equal(c.ghostVisitorLine(),'chalk from 3 strangers is on the doors tonight · 🌔\u2009🌑\u2009🌘');assert.equal(c.ghostVisitorLine(),'');
});

test('C1 reachedBack accepts only true boolean and preserves anonymous singular copy',async()=>{
  for(const [field,expected]of [[undefined,false],[null,false],['true',false],[1,false],[false,false],[true,true]]){
    const item={id:'b'.repeat(32),artifact:artifact({moonBucket:7})};if(field!==undefined)item.reachedBack=field;
    const c=data({fetch:()=>Promise.resolve(response({ghosts:[item]}))});await c.ghostVisitorFetch(4,'a'.repeat(32),8);
    assert.equal(c._ghostVisitors[0].back,expected);
    assert.equal(c.ghostVisitorLine(),expected?'a stranger who reached back has chalked the doors · 🌘':"a stranger's chalk is on the doors tonight · 🌘");
  }
});

test('C3 accepted strangers refresh marks after admission while rejected, disabled and failed paints stay isolated',()=>{
  const lengths=[];let c;
  c=data({GH_CHALK:true,ghostChalkInstall(){lengths.push(c._ghostVisitors.length);}});
  const record=artifact();
  assert.equal(c.ghostVisitorStore(3,'b'.repeat(32),record,false),false);
  assert.equal(c.ghostVisitorStore(4,'invalid',record,false),false);
  assert.equal(c.ghostVisitorStore(4,'b'.repeat(32),{...record,extra:true},false),false);
  assert.deepEqual(lengths,[]);
  for(const id of ['b','c','d'])assert.equal(c.ghostVisitorStore(4,id.repeat(32),record,false),true);
  assert.equal(c.ghostVisitorStore(4,'b'.repeat(32),record,false),false);
  assert.equal(c.ghostVisitorStore(4,'e'.repeat(32),record,false),false);
  assert.deepEqual(lengths,[1,2,3], 'each accepted record exists before its one refresh');
  let calls=0;
  const off=data({GH_CHALK:false,ghostChalkInstall(){calls++;}});
  assert.equal(off.ghostVisitorStore(4,'b'.repeat(32),record,false),true);assert.equal(calls,0);
  const failed=data({GH_CHALK:true,ghostChalkInstall(){throw Error('quiet painting failure');}});
  assert.equal(failed.ghostVisitorStore(4,'b'.repeat(32),record,false),true);assert.equal(failed._ghostVisitors.length,1);
});

test('C1 rejects duplicate ids, stale responses and over-budget artifacts before validation',async()=>{
  const night=artifact();let release;
  const c=data({fetch:()=>new Promise(resolve=>release=resolve)});
  const pending=c.ghostVisitorFetch(4,'a'.repeat(32),8);c._ghostShareEpoch=5;release(response({ghosts:[{id:'b'.repeat(32),artifact:night}]}));await pending;
  assert.equal(c._ghostVisitors.length,0);
  const dup=data();assert.equal(dup.ghostVisitorStore(4,'b'.repeat(32),night,false),true);assert.equal(dup.ghostVisitorStore(4,'b'.repeat(32),night,true),false);assert.equal(dup._ghostVisitors.length,1);
  const large=artifact({targets:Array.from({length:1200},(_,i)=>[i/37,i%4,i,i/37+20.123456789,0,null]),fires:Array.from({length:1200},(_,i)=>[i/37,0.1234567890123,0.2345678901234,0])});
  assert.ok(Buffer.byteLength(JSON.stringify(large))>100000);
  const guarded=data();let validations=0;const validate=guarded.ghostArtifactValid;guarded.ghostArtifactValid=v=>{validations++;return validate(v);};
  guarded.ghostRelayJson=()=>Promise.resolve({ghosts:[{id:'b'.repeat(32),artifact:large}]});await guarded.ghostVisitorFetch(4,'a'.repeat(32),8);
  assert.equal(validations,0);assert.equal(guarded._ghostVisitors.length,0);
});

test('C1 four-record aggregate may exceed 100 KB while each retained artifact remains below it',async()=>{
  const night=artifact({targets:Array.from({length:650},(_,i)=>[i/37,i%4,i,i/37+20.123456789,0,null]),fires:Array.from({length:650},(_,i)=>[i/37,0.1234567890123,0.2345678901234,0])});
  const ghosts='bcde'.split('').map(n=>({id:n.repeat(32),artifact:night})),body={ghosts};
  assert.ok(Buffer.byteLength(JSON.stringify(night))<100000);assert.ok(Buffer.byteLength(JSON.stringify(body))>100000);
  const c=data({fetch:()=>Promise.resolve(response(body,{declared:Buffer.byteLength(JSON.stringify(body))}))});
  await c.ghostVisitorFetch(4,'a'.repeat(32),8);assert.equal(c._ghostVisitors.length,3);
});

test('C1 read-once mail stores validated rows without a replay clock, scene or local cache',async()=>{
  let storage=0;const requests=[],rows=[[8,0,1],[2,3,7]];
  const c=data({localStorage:{getItem(){storage++;return null;},setItem(){storage++;}},fetch(url,init){requests.push({url,init});return Promise.resolve(response({catches:rows}));}});
  await c.ghostMailFetch(4,'a'.repeat(32));
  assert.equal(requests.length,1);assert.equal(requests[0].url,'https://relay.example/api/ghost-mail');assert.equal(requests[0].init.method,undefined);assert.equal(requests[0].init.headers['X-Ghost-Token'],'a'.repeat(32));
  assert.equal(storage,0);assert.deepEqual(JSON.parse(JSON.stringify(c._ghostMailRows)),rows);
  assert.equal(c.ghostVisitorMailLine(),'strangers left marks at your door · 🌒\u2009🌘');assert.equal(c.ghostVisitorMailLine(),'');
  assert.match(extract(source,'ghostMailFetch'),/Read-once|read-once/);
});

test('C1 mail validates exactly the deployed triple shape and fails stale or malformed responses closed',async()=>{
  const c=data(),good=[[0,0,0],[100000,3,7]];assert.equal(c.ghostMailRowsValid(good),good);
  for(const bad of [null,{},[[0,0]],[[0,0,0,1]],[[-1,0,0]],[[0,4,0]],[[0,0,8]],[[0,0,'1']],Array.from({length:257},()=>[0,0,0])])assert.equal(c.ghostMailRowsValid(bad),null);
  const stale=data({fetch:()=>Promise.resolve(response({catches:[[1,0,0]]}))});stale._ghostShareEpoch=5;await stale.ghostMailFetch(4,'a'.repeat(32));assert.equal(stale._ghostMailRows.length,0);
  const invalid=data({fetch:()=>Promise.resolve(response({catches:[[1,4,0]]}))});await invalid.ghostMailFetch(4,'a'.repeat(32));assert.equal(invalid._ghostMailRows.length,0);
});

test('C1 own-night loading keeps both raw v1 and existing wrapped artifacts without rewriting storage',()=>{
  const night=artifact();
  for(const value of [night,{ghost:night,mail:[[2,0],[3,1]]}]){
    let writes=0;const c=core(source,{record:true,functions:['ghostOwnLoad','ghostLocalMailLine','ghostVisitorMailLine'],extra:{
      TF:(_key,text,values={})=>text.replace(/\{(\w+)\}/g,(_m,k)=>String(values[k])),
      localStorage:{getItem:()=>JSON.stringify(value),setItem(){writes++;}}
    }});
    const loaded=c.ghostOwnLoad();
    assert.deepEqual(JSON.parse(JSON.stringify(loaded)),night);assert.equal(c._ghostOwn,loaded);assert.equal(writes,0);
    assert.equal(c.ghostLocalMailLine(),value.mail?'you reached back · 2 notes caught':'');assert.equal(c.ghostLocalMailLine(),'');
    c.ghostOwnLoad();c._ghostMailRows=[[1,0,1],[2,1,1]];
    assert.equal(c.ghostLocalMailLine(),'someone left a mark at your door · 🌒');assert.equal(c.ghostLocalMailLine(),'');
  }
  for(const raw of ['{',' '.repeat(100001),JSON.stringify({...night,date:'2026-99-99'}),JSON.stringify({ghost:night,mail:[[61,0]]})]){
    const c=core(source,{record:true,functions:['ghostOwnLoad'],extra:{localStorage:{getItem:()=>raw}}});
    c._ghostOwn=night;c._ghostLocalMailCount=3;c._ghostLocalMailSpoken=true;
    assert.equal(c.ghostOwnLoad(),null);assert.equal(c._ghostOwn,null);assert.equal(c._ghostLocalMailCount,0);assert.equal(c._ghostLocalMailSpoken,false);
  }
  const unavailable=core(source,{record:true,functions:['ghostOwnLoad'],extra:{localStorage:{getItem(){throw Error('storage unavailable');}}}});
  assert.equal(unavailable.ghostOwnLoad(),null);
});

test('C1 session entry stays silent in lessons and Temple and arms own, relay, recorder in order',async()=>{
  for(const low of [false,true])for(const record of [false,true])for(const share of [false,true]){
    const calls=[],requests=[],timers=[];let storage=0;
    const c=core(source,{record,share,functions:[...DATA_FUNCTIONS,'ghostOwnLoad','ghostShareReset','ghostSessionStart'],extra:{
      LOW:low,WEAK:low,trainMode:true,templeActive:false,
      THREE:new Proxy({},{get(){throw Error('session entry cannot build a scene');}}),
      localStorage:{getItem(){storage++;return JSON.stringify(artifact());},setItem(){throw Error('session start cannot rewrite the stored night');}},
      ghostRoadReset(){calls.push('road');},ghostRecordArm(){calls.push('record');},
      setTimeout(fn,ms){const t={fn,ms,active:true};timers.push(t);return t;},clearTimeout(t){t.active=false;},
      fetch(url,init){requests.push({url,init});return Promise.resolve(response(url.includes('/api/ghosts')?{ghosts:[]}:{catches:[]}));}
    }});
    c._ghostToken='a'.repeat(32);
    const ownLoad=c.ghostOwnLoad,shareReset=c.ghostShareReset;
    c.ghostOwnLoad=()=>{calls.push('own');return ownLoad();};c.ghostShareReset=()=>{calls.push('share');return shareReset();};
    c.ghostSessionStart();c.trainMode=false;c.templeActive=true;c.ghostSessionStart();
    assert.deepEqual({calls,requests,timers,storage},{calls:[],requests:[],timers:[],storage:0});
    c._ghostVisitors=[{id:'b'.repeat(32)}];c._ghostMailRows=[[1,0,0]];c._ghostMailSpoken=true;c._ghostShareSentEpoch=4;
    c.templeActive=false;c.ghostSessionStart();await new Promise(setImmediate);
    assert.deepEqual(calls,[...(record?['own']:[]),...(share?['share','road']:[]),...(record?['record']:[])]);
    assert.equal(storage,+record);assert.equal(requests.length,share?2:0);assert.equal(timers.length,share?2:0);
    if(share){
      assert.match(requests[0].url,/\/api\/ghosts\?lon=\d+&n=4$/);assert.equal(requests[1].url,'https://relay.example/api/ghost-mail');
      for(const request of requests){assert.equal(request.init.method,undefined);assert.equal(request.init.headers['X-Ghost-Token'],'a'.repeat(32));assert.equal(request.init.body,undefined);}
      assert.ok(timers.every(t=>t.ms===4000&&!t.active));
      assert.equal(c._ghostShareEpoch,5);assert.equal(c._ghostShareSentEpoch,-1);assert.equal(c._ghostVisitors.length,0);assert.equal(c._ghostMailRows.length,0);assert.equal(c._ghostMailSpoken,false);
    }
  }
  const phase=extract(source,'setTrainPhase');
  assert.ok(phase.indexOf('moonlineGraduate();')>=0&&phase.indexOf('ghostSessionStart();')>phase.indexOf('moonlineGraduate();'));
  assert.match(extract(source,'resetSession'),/ghostSessionStart\(\);/);
});

test('C4 Bow mail boundary attempts each shown visitor once per epoch and isolates failures',async()=>{
  const sends=[],rows=[[7,0],[9,2]],c=core(source,{functions:['ghostShareFinalize'],extra:{GH_CHALK:true,_ghostMarksOut:rows}});c._ghostToken='d'.repeat(32);
  c._ghostVisitors=[{id:'a'.repeat(32),shown:true},{id:'b'.repeat(32),shown:false},{id:'c'.repeat(32),shown:true}];
  c.ghostMailAttempt=(token,toId,catches)=>{sends.push({token,toId,catches});return toId[0]==='a'?Promise.reject(Error('quiet sibling failure')):Promise.resolve(true);};
  c.ghostShareFinalize();c.ghostShareFinalize();await new Promise(setImmediate);
  assert.deepEqual(sends.map(send=>JSON.parse(JSON.stringify(send))),[{token:'d'.repeat(32),toId:'a'.repeat(32),catches:rows},{token:'d'.repeat(32),toId:'c'.repeat(32),catches:rows}]);
  c._ghostShareEpoch++;c.ghostShareFinalize();await new Promise(setImmediate);assert.equal(sends.length,4);
  c._ghostShareEpoch++;c._ghostVisitors=[];c.ghostShareFinalize();assert.equal(sends.length,4);
  const off=core(source,{share:false,functions:['ghostShareFinalize'],extra:{GH_CHALK:true,_ghostMarksOut:rows,ghostMailAttempt(){throw Error('share zero cannot send');},localStorage:{getItem(){throw Error('share zero cannot read a token');}}}});
  off._ghostVisitors=[{id:'b'.repeat(32),shown:true}];off.ghostShareFinalize();
  assert.match(extract(source,'bowFinish'),/if\(GH_SHARE\) ghostShareFinalize\(\);/);
});

test('C1 threshold renders one line in comeback, mail, visitor, deal order without consuming lower lines',()=>{
  for(const entry of [
    "ghostGiftMail:'きみは 手をのばした · {n}この音を つかまえた'",
    "ghostVisitorMail:'だれかがあなたの戸口にしるしを残した · {sigil}'",
    "ghostVisitorsMail:'旅人たちがあなたの戸口にしるしを残した · {sigils}'",
    "ghostVisitorBack:'手をのばしてくれた旅人が戸口にしるしを残した · {sigil}'",
    "ghostVisitorLine:'今夜の戸口には旅人のしるしがある · {sigil}'",
    "ghostVisitorsLine:'今夜の戸口には{n}人の旅人のしるしがある · {sigils}'"
  ])assert.ok(html.includes(entry),`the Japanese threshold retains its contracted form: ${entry}`);
  for(let bits=0;bits<32;bits++){
    const lines={comeback:bits&1?'comeback':'',mail:bits&2?'mail':'',local:bits&4?'local-mail':'',visitor:bits&8?'visitor':'',deal:bits&16?'deal':''};
    const calls=[];let rendered='',breaths=0;
    const take=kind=>{calls.push(kind);return lines[kind];};
    const c=vm.createContext({CFG:{remember:{on:true},deal:{on:true}},GH_SHARE:true,GH_RECORD:true,GH_CHALK:true,
      el:{dojoFlash:{classList:{remove(){},add(){}},offsetWidth:100}},activeTheme:{name:'MOONLIGHT'},
      applyMoodLook(){},rememberLine:()=>take('comeback'),ghostVisitorMailLine:()=>take('mail'),ghostLocalMailLine:()=>take('local'),ghostVisitorLine:()=>take('visitor'),dealLine:()=>take('deal'),songDisplay:n=>n,
      setText(_el,s){rendered=s;},themeBreath(){breaths++;}});
    vm.runInContext(extract(source,'flashTheme')+';flashTheme();',c);
    assert.equal(rendered,lines.comeback||lines.mail||lines.local||lines.visitor||lines.deal||'♪ MOONLIGHT');assert.equal(breaths,1);
    if(lines.comeback)assert.deepEqual(calls,['comeback']);
    if(lines.comeback||lines.mail||lines.local)assert.equal(calls.includes('visitor'),false);
    if(lines.comeback||lines.mail||lines.local||lines.visitor)assert.equal(calls.includes('deal'),false);
  }
});

test('C1 surviving data and relay helpers cannot read gameplay time or mutate gameplay/RNG',()=>{
  for(const name of [...Object.keys(fixture.functions),...DATA_FUNCTIONS,'ghostOwnLoad','ghostShareReset','ghostShareFinalize']){
    const body=extract(source,name);
    assert.doesNotMatch(body,/state\.t|state\.(?:streak|bpm|hits|shots)\s*[+\-*/]?=|\bpushEvent\s*\(|\brnd\s*\(|Math\.random\s*\(/,name);
  }
  const allowlist={ghostRelayFetch:['ghostRelayJson','ghostUploadAttempt','ghostMailAttempt'],ghostRelayJson:['ghostVisitorFetch','ghostMailFetch'],ghostVisitorFetch:['ghostShareReset'],ghostMailFetch:['ghostShareReset'],ghostUploadAttempt:['ghostUploadRetry','ghostShareUpload'],ghostMailAttempt:['ghostShareFinalize'],ghostShareUpload:['ghostRecordFinalize'],ghostShareReset:['ghostSessionStart'],ghostShareFinalize:['bowFinish'],ghostSessionStart:['setTrainPhase','resetSession']};
  for(const [callee,callers]of Object.entries(allowlist)){
    assert.equal((source.match(new RegExp(`\\b${callee}\\s*\\(`,'g'))||[]).length,callers.length+1,`${callee} only runs at sanctioned boundaries`);
    for(const caller of callers)assert.match(extract(source,caller),new RegExp(`\\b${callee}\\s*\\(`));
  }
});

test('C1 deleted seat, gift and returning-star runtime symbols cannot regrow',()=>{
  const runtime=source.replaceAll("'ghostGiftMail'",''); // the existing translation key is inert compatibility data, not the removed gift mechanism
  assert.doesNotMatch(runtime,/\b(?:GH_SEAT\w*|GH_VISITOR_X\w*|GH_SILHOUETTE\w*|GH_RETURN\w*|GH_GIFT\w*|GH_PHASE\w*|GH_(?:LOW_|HIGH_)?(?:TARGET|BURST)_MAX|ghostSeat\w*|ghostSeats\w*|ghostGift\w*|ghostReturn\w*|ghostSilhouette\w*|ghostPhase\w*|_ghostSeat\w*|_ghostVisitorSeats|_ghostOwnSeat|_ghostReturn\w*|_ghostGift\w*)\b/);
});

module.exports={core,extract,artifact,response,source};
