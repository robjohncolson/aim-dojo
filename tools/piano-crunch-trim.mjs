#!/usr/bin/env node
// Standalone Node diagnostic; run only while GPU capture is idle.
// node tools/piano-crunch-trim.mjs --root <checkout> [--source <runtime-snapshot>]
//   [--fast 0|1] [--runs 7] [--warm 1] [--out artifacts/performance/piano-crunch-p3/r2-run]
// Extracts current pure functions as tests/night-ghosts.test.js does. Retains P0 fixture bytes.
// Never loads the page, finalizer, storage adapter, network code or user state.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

const ORACLE_COMMIT='912961aff89748596a6d7d8c3e60b00e1d13898c';
// Byte hashes recorded by the original P0 benchmark on ORACLE_COMMIT.
// These make preservation independent of the oracle implementation below.
const ORACLE_HASHES={
  'quiet-shaped-10min':{input:'89c9a71ec248b0d259abe3b99cad0c79d8b3e6b1c453a8b5510d8a9f60d4d875',output:'89c9a71ec248b0d259abe3b99cad0c79d8b3e6b1c453a8b5510d8a9f60d4d875'},
  'busy-shaped-10min':{input:'07288ef35ed9f8701a5d63eef1fa6ede6474b7e50107e2c1fa656bee1d997d0a',output:'07288ef35ed9f8701a5d63eef1fa6ede6474b7e50107e2c1fa656bee1d997d0a'},
  'fully-capped-2h':{input:'cea53379da35f1d402da9864ce11a7074361e0dbc5020fc3ea2550920a369731',output:'2c6ef1777a34a7dfa2bb32db0c75634a73f992980248f41abd596ff0315ea365'},
  'fully-capped-with-mail-and-ties':{input:'38f35d30199bc2585ccf5c8f4f05359e46938210d5a9829db2b914632b3a9786',output:'87e34a503e4244a5b787dd541c047c7fde2a23aa9b37edd8b807c073a8cd935e'},
};
const toolFile=fileURLToPath(import.meta.url);
const workspace=path.resolve(path.dirname(toolFile),'..');
const artifactRoot=path.join(workspace,'artifacts','performance');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const options={root:null,source:null,fast:1,out:path.join(artifactRoot,'piano-crunch-p3',`r2-${stamp}`),runs:7,warm:1};
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i].replace(/^--/,'');
  if(!Object.hasOwn(options,key)||!process.argv[i+1]||process.argv[i+1].startsWith('--')) throw Error(`Invalid argument ${process.argv[i]}`);
  options[key]=process.argv[++i];
}
if(!options.root) throw Error('Pass --root <checkout>. Run while GPU measurement is idle.');
options.fast=Number(options.fast);
assert.ok(options.fast===0||options.fast===1,'--fast accepts numeric 0 or 1.');
for(const key of ['runs','warm']){
  options[key]=Number(options[key]);
  if(!Number.isSafeInteger(options[key])||options[key]<(key==='runs'?1:0)||options[key]>100) throw Error(`Invalid ${key}`);
}
options.root=path.resolve(options.root); options.out=path.resolve(options.out);
const relativeOut=path.relative(artifactRoot,options.out);
if(!relativeOut||relativeOut.startsWith('..')||path.isAbsolute(relativeOut)||relativeOut.split(path.sep).some(p=>p.toLowerCase()==='state')){
  throw Error('Output must be a new subdirectory of this workspace artifacts/performance, outside state/.');
}
assert.ok(!fs.existsSync(options.out),'Output directory must not already exist; preserve previous artifacts.');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const sourceFile=options.source?path.resolve(options.source):path.join(options.root,'aim-dojo-main.js');
assert.ok(!sourceFile.split(path.sep).some(p=>p.toLowerCase()==='state'),'Runtime must be outside state/.');
const sourceBytes=fs.readFileSync(sourceFile);
const source=sourceBytes.toString('utf8');
const git=(...args)=>execFileSync('git',['-C',options.root,...args],{maxBuffer:8*1024*1024});
const commit=git('rev-parse','HEAD').toString().trim();
const headRuntimeSha256=hash(git('show',`${commit}:aim-dojo-main.js`));

// Delimiter scanner follows tests/night-ghosts.test.js:14-36. The fixed list
// below contains ordinary functions without template interpolation/regex braces.
function extractFunction(text,name){
  const match=new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(text);
  assert.ok(match,`Missing accepted helper ${name}`);
  const start=text.indexOf('{',match.index+match[0].length);
  let depth=0,quote='',line=false,block=false;
  for(let i=start;i<text.length;i++){
    const c=text[i],next=text[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&next==='/'){block=false;i++;}continue;}
    if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
    if(c==='/'&&next==='/'){line=true;i++;continue;}
    if(c==='/'&&next==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0) return {text:text.slice(match.index,i+1),line:text.slice(0,match.index).split('\n').length};
  }
  throw Error(`Unclosed helper ${name}`);
}

const names=['ghostRecordTrim','ghostArtifactValid','ghostMailValid','ghostWrapperValid','realCivilDate','ghostTime','ghostAimYaw','ghostAimPitch'];
const extracted=Object.fromEntries(names.map(name=>[name,extractFunction(source,name)]));
const numericNames=['GH_VERSION','GH_WORTHY_DUR','GH_CAP_BPM','GH_CAP_TARGETS','GH_CAP_TAPS','GH_CAP_FIRES','GH_CAP_MAIL','GH_MAX_BYTES'];
const constants={};
for(const name of numericNames){
  const match=source.match(new RegExp(`\\b${name}\\s*=\\s*(\\d+)\\b`));
  assert.ok(match,`Missing numeric constant ${name}`); constants[name]=Number(match[1]);
}
const declarations=['GH_V1_KEYS','GH_WRAPPER_KEYS','PHASES_DATE_RE'].map(name=>{
  const match=source.match(new RegExp(`const ${name}=[^;\\n]+;`));
  assert.ok(match,`Missing declaration ${name}`); return match[0];
});
const pitch=source.match(/const PITCH_LIMIT\s*=\s*THREE\.MathUtils\.degToRad\((\d+)\);/);
assert.ok(pitch,'Accepted pitch bound is extractable.');
const program=[
  `const CFG={ghostTrimFast:${options.fast}}, GH_FAST_TRIM=CFG.ghostTrimFast!==0;`,
  ...Object.entries(constants).map(([key,value])=>`const ${key}=${value};`),
  `const GH_AIM_YAW_MAX=Math.PI, GH_AIM_PITCH_MAX=${pitch[1]}*Math.PI/180;`,
  ...declarations,...names.map(name=>extracted[name].text),
  `globalThis.helpers={${names.join(',')}};`,
].join('\n');

function loadHelpers(countStringify=false){
  const counts={calls:0,totalCodeUnits:0,firstCodeUnits:null,lastCodeUnits:null,
    wrapper:{calls:0,totalCodeUnits:0},row:{calls:0,totalCodeUnits:0},other:{calls:0,totalCodeUnits:0}};
  const json=countStringify?{parse:JSON.parse,stringify(...args){
    const result=JSON.stringify(...args); counts.calls++; counts.totalCodeUnits+=result.length;
    const value=args[0],kind=Array.isArray(value)?'row':value&&Object.hasOwn(value,'ghost')&&Object.hasOwn(value,'mail')?'wrapper':'other';
    counts[kind].calls++; counts[kind].totalCodeUnits+=result.length;
    if(counts.firstCodeUnits===null)counts.firstCodeUnits=result.length;
    counts.lastCodeUnits=result.length; return result;
  }}:JSON;
  const context=vm.createContext({JSON:json});
  new vm.Script(program,{filename:'current-ghost-trim.vm.js'}).runInContext(context);
  return {helpers:context.helpers,counts};
}

const {helpers}=loadHelpers();
const families=['bpmCurve','targets','taps','fires'];
const caps={bpmCurve:constants.GH_CAP_BPM,targets:constants.GH_CAP_TARGETS,taps:constants.GH_CAP_TAPS,fires:constants.GH_CAP_FIRES};
const countsOf=record=>Object.fromEntries(families.map(name=>[name,record[name].length]));

function makeFixture(label,duration,counts,mailCount=0,tied=false){
  // Synthetic row shapes use recorder quantizers and the exact property order
  // asserted in tests/night-ghosts.test.js. No natural-play rate is claimed.
  const time=(i,n)=>helpers.ghostTime(tied?Math.floor(i/2)*duration/(n+1):(i+1)*(duration-5)/(n+1));
  const ghost={v:constants.GH_VERSION,date:'2026-09-05',moonBucket:4,bpm0:28,dur:duration,bpmCurve:[],targets:[],taps:[],fires:[]};
  for(let i=0;i<counts.bpmCurve;i++)ghost.bpmCurve.push([time(i,counts.bpmCurve),28+(i%13)*2.5]);
  for(let i=0;i<counts.targets;i++){
    const t=time(i,counts.targets),hit=i%5!==0;
    ghost.targets.push([t,i%4,10000+i,helpers.ghostTime(t+3),hit?1:0,hit?helpers.ghostTime(t+2.125):null]);
  }
  for(let i=0;i<counts.taps;i++)ghost.taps.push([time(i,counts.taps),i%4,[-1,56,78,100][i%4]]);
  for(let i=0;i<counts.fires;i++)ghost.fires.push([
    time(i,counts.fires),helpers.ghostAimYaw(Math.sin(i*0.173)*Math.PI),helpers.ghostAimPitch(Math.cos(i*0.239)*0.91),i%5?1:0,
  ]);
  const mail=Array.from({length:mailCount},(_,i)=>[helpers.ghostTime((i+1)*duration/(mailCount+1)),i%4]);
  const wrapper={ghost,mail};
  assert.ok(helpers.ghostWrapperValid(wrapper),`${label}: synthetic input passes accepted artifact/mail validators`);
  return {label,wrapper};
}

// Independent oracle: sort all removable rows once by timestamp/family/index,
// then account for their exact serialized sizes. It neither calls the accepted
// trim function nor repeatedly serializes the shrinking wrapper.
function preservationOracle(wrapper,limit){
  const original=JSON.stringify(wrapper),removed=Object.fromEntries(families.map(name=>[name,0]));
  const rows=families.flatMap((family,priority)=>wrapper.ghost[family].map((row,index)=>({family,priority,row,index})));
  rows.sort((a,b)=>a.row[0]-b.row[0]||a.priority-b.priority||a.index-b.index);
  let length=original.length;
  const removalOrder=[];
  for(const item of rows){
    if(length<=limit)break;
    const remaining=wrapper.ghost[item.family].length-removed[item.family];
    length-=JSON.stringify(item.row).length+(remaining>1?1:0);
    removed[item.family]++; removalOrder.push({family:item.family,index:item.index,time:item.row[0]});
  }
  const expected=JSON.parse(original);
  for(const family of families)expected.ghost[family]=expected.ghost[family].slice(removed[family]);
  const json=JSON.stringify(expected);
  assert.equal(json.length,length,'Oracle exact size accounting agrees with final serialization.');
  return {json,removed,removalOrder};
}

function checkResult(label,input,json,expected,mutated){
  assert.equal(json,expected.json,`${label}: complete JSON preserves fields, row contents, suffix order and tie order`);
  assert.equal(JSON.stringify(mutated),json,`${label}: returned JSON is the mutated wrapper`);
  assert.ok(helpers.ghostWrapperValid(JSON.parse(json)),`${label}: trimmed wrapper remains valid`);
  assert.ok(json.length<=constants.GH_MAX_BYTES,`${label}: local serialized-length budget holds`);
  assert.equal(JSON.stringify(mutated.mail),JSON.stringify(input.mail),`${label}: mail is unchanged`);
  for(const family of families){
    assert.equal(JSON.stringify(mutated.ghost[family]),JSON.stringify(input.ghost[family].slice(expected.removed[family])),`${label}: ${family} is an unchanged suffix`);
  }
}

function summary(samples){
  const sorted=[...samples].sort((a,b)=>a-b),n=sorted.length;
  return {samplesMs:samples,medianMs:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,p95Ms:sorted[Math.ceil(n*0.95)-1],minMs:sorted[0],maxMs:sorted[n-1]};
}

const fixtures=[
  makeFixture('quiet-shaped-10min',600,{bpmCurve:20,targets:72,taps:280,fires:100}),
  makeFixture('busy-shaped-10min',600,{bpmCurve:24,targets:160,taps:580,fires:240}),
  makeFixture('fully-capped-2h',7200,caps),
  makeFixture('fully-capped-with-mail-and-ties',7200,caps,constants.GH_CAP_MAIL,true),
];

// An explicit tiny oracle test makes family tie priority reviewable. This runs
// the unmodified trim function in a separate VM with only the test limit changed;
// it is a correctness fixture and is excluded from all benchmark timings.
const tieInput=makeFixture('tie-order-oracle',60,{bpmCurve:2,targets:2,taps:2,fires:2},0,true).wrapper;
const tieOriginal=JSON.stringify(tieInput);
const tieContext=vm.createContext({GH_MAX_BYTES:tieOriginal.length-1,JSON,CFG:{ghostTrimFast:options.fast},GH_FAST_TRIM:options.fast!==0});
vm.runInContext(extracted.ghostRecordTrim.text,tieContext);
const tieExpected=preservationOracle(tieInput,tieOriginal.length-1);
assert.deepEqual(tieExpected.removalOrder,[{family:'bpmCurve',index:0,time:0}]);
const tieClone=JSON.parse(tieOriginal);
assert.equal(tieContext.ghostRecordTrim(tieClone.ghost,tieClone.mail),tieExpected.json,'Equal-time removal begins with BPM family.');

const results=[],files=[];
for(const fixture of fixtures){
  const inputJson=JSON.stringify(fixture.wrapper),inputHash=hash(inputJson);
  assert.equal(inputHash,ORACLE_HASHES[fixture.label].input,'Synthetic fixture bytes still match the saved P0 input.');
  const expected=preservationOracle(fixture.wrapper,constants.GH_MAX_BYTES);
  const diagnostic=loadHelpers(true),diagnosticInput=JSON.parse(inputJson);
  const output=diagnostic.helpers.ghostRecordTrim(diagnosticInput.ghost,diagnosticInput.mail);
  checkResult(fixture.label,fixture.wrapper,output,expected,diagnosticInput);
  assert.equal(hash(output),ORACLE_HASHES[fixture.label].output,'Trim output bytes match the saved P0 oracle.');
  const removedCount=Object.values(expected.removed).reduce((a,b)=>a+b,0);
  const fastApplies=options.fast!==0&&/\bGH_FAST_TRIM\b|\bCFG\.ghostTrimFast\b/.test(extracted.ghostRecordTrim.text);
  if(!fastApplies){
    assert.equal(diagnostic.counts.wrapper.calls,1+removedCount,'Legacy serializes the wrapper initially and after each removal.');
    assert.equal(diagnostic.counts.row.calls,0,'Legacy does not serialize individual rows.');
  }else{
    assert.ok(diagnostic.counts.wrapper.calls<=2,'Fast trim serializes the whole wrapper at most twice.');
  }
  assert.equal(diagnostic.counts.other.calls,0,'Serialization accounting classifies every call as wrapper or row.');
  if(fixture.label.startsWith('fully-capped'))assert.ok(removedCount>0,'Fully capped fixture must exercise repeated serialization.');
  for(let i=0;i<options.warm;i++){
    const clone=JSON.parse(inputJson);
    assert.equal(helpers.ghostRecordTrim(clone.ghost,clone.mail),expected.json);
  }
  const samples=[];
  for(let i=0;i<options.runs;i++){
    const clone=JSON.parse(inputJson); // cloning is deliberately outside timing
    const t0=performance.now();
    const json=helpers.ghostRecordTrim(clone.ghost,clone.mail);
    const elapsed=performance.now()-t0;
    samples.push(elapsed);
    assert.equal(json,expected.json,`${fixture.label}: timed result remains exact`);
  }
  assert.equal(hash(JSON.stringify(fixture.wrapper)),inputHash,'Original fixture remains unchanged by every diagnostic/repetition.');
  const result={label:fixture.label,evidence:'measured in Node on deterministic synthetic data; not a browser frame result',
    durationSec:fixture.wrapper.ghost.dur,input:{sha256:inputHash,codeUnits:inputJson.length,utf8Bytes:Buffer.byteLength(inputJson),rows:countsOf(fixture.wrapper.ghost),mail:fixture.wrapper.mail.length},
    output:{sha256:hash(output),codeUnits:output.length,utf8Bytes:Buffer.byteLength(output),rows:countsOf(diagnosticInput.ghost),mail:diagnosticInput.mail.length},
    removedRows:expected.removed,removedCount,stringifyDiagnostic:diagnostic.counts,
    removalOrderFile:`${fixture.label}.removals.json`,timing:summary(samples),
    validation:{acceptedInput:true,acceptedOutput:true,exactIndependentOracle:true,exactSavedP0InputHash:true,exactSavedP0OutputHash:true,unchangedRetainedSuffixes:true,unchangedMail:true,originalInputPreserved:true},
  };
  results.push(result);
  files.push([`${fixture.label}.input.json`,inputJson],[`${fixture.label}.trimmed.json`,output],[result.removalOrderFile,JSON.stringify(expected.removalOrder,null,2)]);
}

assert.equal(hash(fs.readFileSync(sourceFile)),hash(sourceBytes),'Measured source snapshot remains unchanged.');
const report={schema:2,createdAt:new Date().toISOString(),reference:{commit,runtimeSha256:hash(sourceBytes),headRuntimeSha256,runtimeMatchesHead:hash(sourceBytes)===headRuntimeSha256,runtime:sourceFile,checkout:options.root,oracleCommit:ORACLE_COMMIT},
  diagnostic:{toolSha256:hash(fs.readFileSync(toolFile)),helpers:Object.fromEntries(names.map(name=>[name,{line:extracted[name].line,sha256:hash(extracted[name].text)}])),constants,
    ghostTrimFast:options.fast,flagBinding:'CFG.ghostTrimFast and GH_FAST_TRIM=(CFG.ghostTrimFast!==0) are provided to the extracted function.',
    runs:options.runs,warm:options.warm,timing:'Only extracted current ghostRecordTrim with native JSON is timed. Input parse/clone, validation, hashing, VM setup, output writes and stringify instrumentation are excluded; GC occurring during the timed call is not excluded.',
    scope:'Node CPU microbenchmark using synthetic valid row shapes; not natural-play frequency, localStorage timing, finalizer timing, browser performance or GPU/presentation evidence.',
    fixtureOrigin:'Generated synthetic data only; no recorded user night, storage adapter, finalizer, page, network or state/ access.',
    relatedTests:['tests/night-ghosts.test.js: delimiter extraction and locked v1 bounded-artifact checks','tests/doors-remember.test.js: retained target-row ordering'],
    tieOrderSanity:{passed:true,method:'Accepted trim with diagnostic-only tiny size budget; BPM precedes equal-time target/tap/fire rows. Excluded from timings.'}},
  environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,osRelease:os.release(),cpuModel:os.cpus()[0]?.model??null,logicalCpus:os.cpus().length},results};
fs.mkdirSync(options.out,{recursive:true});
for(const [name,data] of files)fs.writeFileSync(path.join(options.out,name),data,{flag:'wx'});
fs.writeFileSync(path.join(options.out,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({out:options.out,results:results.map(r=>({case:r.label,input:r.input.codeUnits,output:r.output.codeUnits,wrapperStringifies:r.stringifyDiagnostic.wrapper.calls,rowStringifies:r.stringifyDiagnostic.row.calls,outputSha256:r.output.sha256,medianMs:r.timing.medianMs,maxMs:r.timing.maxMs}))},null,2));
