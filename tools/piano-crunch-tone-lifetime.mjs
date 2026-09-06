#!/usr/bin/env node
// R1 actual-helper source-lifetime regression. Never loads the game or its data.
// Run only after other browser/performance captures have finished.
// COLDLOAD_MODULES may point at an existing node_modules containing puppeteer-core.
// node tools/piano-crunch-tone-lifetime.mjs --root <checkout> --native 1 --out <new-directory>
// --native 0 --skip-retention-assert records the expected failing bundled-context control.
// --check extracts and parses the page without launching a browser or writing artifacts.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

function extractLifetimeApp(root){
  const runtimeFile=path.join(root,'aim-dojo-main.js'),bytes=fs.readFileSync(runtimeFile),source=bytes.toString('utf8');
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const extractorFile=path.join(root,'tests','chip-graph.js');
  const {extractFunction}=createRequire(import.meta.url)(extractorFile);
  const names=['pianoToneFacadeGet','pianoContextAlign','pianoPatch'];
  const helpers=Object.fromEntries(names.map(name=>{
    const text=extractFunction(source,name),offset=source.indexOf(text);
    return [name,{text,line:source.slice(0,offset).split('\n').length,sha256:hash(text)}];
  }));
  const contextDeclaration=source.match(/^let _pianoContext=[^\r\n]+/m)?.[0];
  const facadeDeclaration=source.match(/^const Tone=new Proxy\([^\r\n]+/m)?.[0];
  const pianoDeclaration=source.match(/^\s+piano:(\{[^\r\n]+?\}),\s*\/\//m)?.[1];
  const nativeDefault=source.match(/^\s+pianoNativeContext:\s*([01])\s*,/m)?.[1];
  const initAudio=extractFunction(source,'initAudio');
  const alignmentGate=initAudio.match(/if\s*\(PIANO\s*&&\s*CFG\.pianoNativeContext\)\s*pianoContextAlign\(\);/)?.[0];
  const sphereBuild=extractFunction(source,'pianoFieldBuild');
  if(!contextDeclaration||!facadeDeclaration||!pianoDeclaration||nativeDefault===undefined||!alignmentGate)throw Error('Actual runtime alignment declarations/gate could not be extracted; do not substitute a handwritten implementation');
  if(!/new Tone\.Context\(\{context:ctx,clockSource:'offline',lookAhead:0\}\)/.test(sphereBuild)||!sphereBuild.includes("Tone.getContext().on('tick',F.pianoTick)"))throw Error('Sphere context arrangement changed; review the supplied-native comparator');
  const patchConfig=vm.runInNewContext('('+pianoDeclaration+')',Object.create(null),{timeout:100});
  const patchScope=vm.createContext({CFG:{piano:patchConfig}});
  const patch=new vm.Script(helpers.pianoPatch.text+'\npianoPatch();').runInContext(patchScope,{timeout:100});
  const program=[contextDeclaration,helpers.pianoToneFacadeGet.text,facadeDeclaration,helpers.pianoContextAlign.text,helpers.pianoPatch.text].join('\n');
  new vm.Script(program,{filename:'extracted-piano-context.js'});
  const commit=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
  const committed=execFileSync('git',['-C',root,'show','HEAD:aim-dojo-main.js'],{maxBuffer:8*1024*1024,windowsHide:true});
  return {program,patch,patchConfig,alignmentGate,metadata:{runtimeFile,commit,runtimeSha256:hash(bytes),committedRuntimeSha256:hash(committed),
    runtimeDiffersFromCommit:hash(bytes)!==hash(committed),nativeDefault:Number(nativeDefault),helpers,
    contextDeclaration,facadeDeclaration,alignmentGate,initAudioSha256:hash(initAudio),sphereBuildSha256:hash(sphereBuild),
    extractorFile,extractorSha256:hash(fs.readFileSync(extractorFile)),programSha256:hash(program)}};
}

async function runToneLifetime(){
  const options={
    root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native:1,
    modules:process.env.COLDLOAD_MODULES||'C:/Users/rober/AppData/Local/Temp/aim-dojo-parcel-e-puppeteer/node_modules',
    tone:'C:/Users/rober/AppData/Local/Temp/aim-dojo-chip-test-draft/Tone-14.8.49.js',
    chrome:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    out:path.join('artifacts/performance/piano-crunch-p3','tone-lifetime-'+new Date().toISOString().replace(/[:.]/g,'-')),
    notes:24,spacing:0.9,headless:false,check:false,'skip-retention-assert':false
  };
  for(let i=2;i<process.argv.length;i++){
    const key=process.argv[i].replace(/^--/,'');
    if(['headless','check','skip-retention-assert'].includes(key)) options[key]=true;
    else if(Object.hasOwn(options,key)&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')) options[key]=process.argv[++i];
    else throw Error('Unknown or incomplete argument: '+process.argv[i]);
  }
  options.notes=Number(options.notes);options.spacing=Number(options.spacing);options.native=Number(options.native);
  if(![0,1].includes(options.native))throw Error('--native must be 0 or 1');
  if(!Number.isInteger(options.notes)||options.notes<1||options.notes>200) throw Error('--notes must be an integer from 1 through 200');
  if(options.notes<24&&!options['skip-retention-assert'])throw Error('The enforced regression requires at least 24 notes; short readiness probes must use --skip-retention-assert');
  if(!Number.isFinite(options.spacing)||options.spacing<0.8||options.spacing>10) throw Error('--spacing must be 0.8 through 10 seconds');
  options.root=path.resolve(options.root);options.out=path.resolve(options.out);options.tone=path.resolve(options.tone);options.modules=path.resolve(options.modules);
  if(options.out.split(path.sep).some(part=>part.toLowerCase()==='state'))throw Error('Output cannot be inside state/');
  if(fs.existsSync(options.out)) throw Error('Refusing to overwrite an existing output directory: '+options.out);
  const toneBytes=fs.readFileSync(options.tone),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  const expectedToneHash='1261cdd3331d826237e7b0b954b5ed7d2381c8df4331d2018acea8c7a64a9a7b';
  if(hash(toneBytes)!==expectedToneHash) throw Error('Pinned Tone 14.8.49 bytes do not match the inspected source hash');
  const app=extractLifetimeApp(options.root);
  const settings={
    sourceCommit:app.metadata.commit,nativeEnabled:!!options.native,toneVersion:'14.8.49',patch:app.patch,
    notesPerInstrument:options.notes,spacingSec:options.spacing,holdSec:0.1,pitchHz:440,velocity:0.65,outputGain:0.002,
    tailAndIdleWaitSec:2,gcIdleWaitSec:1,ordinaryOscillatorLimitAfterGc:2,
    contextA:options.native?'Actual application pianoContextAlign/facade; separate supplied-native musical Context':'Actual application facade with CFG.pianoNativeContext=0; bundled default Context',
    contextB:'Native AudioContext supplied to Tone.Context with offline clockSource, lookAhead 0, forwarded current musical Tone tick',
    classification:'Source-retention diagnostic. Native creation/destruction accounting is not running-source count or audio/GPU performance.',
    limits:['Identical ordinary piano envelopes in both contexts; the longer sphere envelope is deliberately not selected.',
      'Only extracted context helper, facade, pianoPatch and its CFG are executed; no game scene, saved preferences, user profile or external service is loaded.',
      'Transport stays stopped; explicit numeric note times remain immediate()+.01 as in P0. Musical lookAhead and singleton identities are checked separately.',
      'Both instruments play paired, nonoverlapping notes; no PolySynth allocator or voice stealing is exercised.',
      'CDP inspection and explicit garbage collection may affect cleanup; use separate no-inspector controls for attribution.']
  };
  const pageScript=`
'use strict';
(function(){
const settings=${JSON.stringify(settings)};
const CFG={piano:${JSON.stringify(app.patchConfig)},pianoNativeContext:${options.native}},PIANO=true;
${app.program}
let ordinary=null,native=null,wrapped=null,previous=null,ordinarySynth=null,wrappedSynth=null,ordinaryGain=null,wrappedGain=null,forwardTick=null;
const silence={ordinary:0,wrapped:0},attacks=[];
const preparation={alignmentRandomCalls:0,idempotentRandomCalls:0};
let setupState='waiting',setupError=null,disposed=false,closed=false;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
document.getElementById('prepare').addEventListener('click',async()=>{
  if(setupState!=='waiting')return;setupState='preparing';
  try{
    if(Tone.version!==settings.toneVersion)throw Error('Unexpected Tone version '+Tone.version);
    previous=window.Tone.getContext();
    preparation.before={sampleRate:previous.sampleRate,lookAhead:previous.lookAhead,updateInterval:previous.updateInterval,clockSource:previous.clockSource,latencyHint:previous.latencyHint,bpm:previous.transport.bpm.value};
    const originalRandom=Math.random;
    Math.random=(...args)=>{preparation.alignmentRandomCalls++;return originalRandom(...args);};
    try{${app.alignmentGate}}finally{Math.random=originalRandom;}
    ordinary=Tone.getContext();
    if(settings.nativeEnabled){
      Math.random=(...args)=>{preparation.idempotentRandomCalls++;return originalRandom(...args);};
      try{if(pianoContextAlign()!==ordinary)throw Error('Alignment retry changed context ownership');}finally{Math.random=originalRandom;}
    }
    preparation.aligned=ordinary!==previous;
    preparation.ordinaryUsesNativeContext=ordinary.rawContext instanceof (window.AudioContext||window.webkitAudioContext);
    preparation.aliases={transport:Tone.Transport===Tone.getTransport(),draw:Tone.Draw===Tone.getDraw(),destination:Tone.Destination===Tone.getDestination(),master:Tone.Master===Tone.getDestination(),listener:Tone.Listener===Tone.getListener(),context:Tone.context===ordinary};
    preparation.libraryExportsUnchanged=window.Tone.Transport===previous.transport&&window.Tone.Destination===previous.destination;
    preparation.patch=pianoPatch();
    if(preparation.aligned!==settings.nativeEnabled||!Object.values(preparation.aliases).every(Boolean)||!preparation.libraryExportsUnchanged)throw Error('Actual app facade/context ownership mismatch');
    if(preparation.ordinaryUsesNativeContext!==settings.nativeEnabled)throw Error('Ordinary rawContext is not the requested native/bundled path');
    for(const key of ['sampleRate','lookAhead','updateInterval','clockSource'])if(ordinary[key]!==preparation.before[key])throw Error('Musical '+key+' changed');
    if(ordinary.lookAhead!==.1||Tone.Transport.state!=='stopped'||Tone.Transport.bpm.value!==preparation.before.bpm)throw Error('Musical clock defaults or stopped Transport changed');
    if(preparation.alignmentRandomCalls||preparation.idempotentRandomCalls)throw Error('Context alignment consumed Math.random draws');
    if(JSON.stringify(preparation.patch)!==JSON.stringify(settings.patch))throw Error('Extracted piano patch disagrees between Node and browser');
    native=new (window.AudioContext||window.webkitAudioContext)({sampleRate:ordinary.sampleRate});
    const unlock=[Tone.start(),native.resume()];
    wrapped=new Tone.Context({context:native,clockSource:'offline',lookAhead:0});
    forwardTick=()=>wrapped.emit('tick');ordinary.on('tick',forwardTick);
    ordinaryGain=new Tone.Gain(settings.outputGain).toDestination();
    wrappedGain=native.createGain();wrappedGain.gain.value=settings.outputGain;wrappedGain.connect(native.destination);
    ordinarySynth=new Tone.FMSynth({...pianoPatch(),onsilence:()=>{silence.ordinary++;}}).connect(ordinaryGain);
    wrappedSynth=new Tone.FMSynth({...pianoPatch(),context:wrapped,onsilence:()=>{silence.wrapped++;}}).connect(wrappedGain);
    if(ordinarySynth.context!==ordinary||ordinaryGain.context!==ordinary||Tone.Destination.context!==ordinary)throw Error('New ordinary nodes and facade Destination do not share the app musical context');
    await Promise.all(unlock);
    if(ordinary.state!=='running'||native.state!=='running')throw Error('Both contexts must be running after the gesture');
    setupState='ready';document.getElementById('status').textContent='Prepared; waiting for harness.';
  }catch(error){setupError=String(error.stack||error);setupState='failed';}
},{once:true});
window.lifetime={
  status:()=>({setupState,setupError}),
  snapshot:()=>({at:performance.now(),setupState,setupError,disposed,closed,silence:{...silence},attackPairs:attacks.length,
    preparation,previous:previous?{state:previous.state,disposed:previous.disposed}:null,
    ordinary:ordinary?{state:ordinary.state,currentTime:ordinary.immediate(),sampleRate:ordinary.sampleRate,
      lookAhead:ordinary.lookAhead,updateInterval:ordinary.updateInterval,clockSource:ordinary.clockSource,isOffline:ordinary.isOffline,
      transportState:Tone.Transport.state,latencyHint:ordinary.latencyHint,baseLatency:ordinary.rawContext.baseLatency,outputLatency:ordinary.rawContext.outputLatency,
      instrumentState:ordinarySynth?ordinarySynth.oscillator.state:null,level:ordinarySynth?ordinarySynth.getLevelAtTime(ordinary.immediate()):null}:null,
    wrapped:wrapped?{state:wrapped.state,currentTime:wrapped.immediate(),sampleRate:wrapped.sampleRate,
      lookAhead:wrapped.lookAhead,clockSource:wrapped.clockSource,isOffline:wrapped.isOffline,
      instrumentState:wrappedSynth?wrappedSynth.oscillator.state:null,level:wrappedSynth?wrappedSynth.getLevelAtTime(wrapped.immediate()):null}:null}),
  run:async()=>{
    if(setupState!=='ready')throw Error('Audio setup is incomplete');
    let lastOrdinary=-Infinity,lastWrapped=-Infinity;
    for(let i=0;i<settings.notesPerInstrument;i++){
      const timeout=performance.now()+30000;
      while(ordinary.immediate()<lastOrdinary+settings.spacingSec||wrapped.immediate()<lastWrapped+settings.spacingSec){
        if(performance.now()>timeout)throw Error('Audio clock stopped advancing');
        await pause(20);
      }
      if(ordinary.state!=='running'||wrapped.state!=='running')throw Error('A context stopped during attacks');
      if(ordinarySynth.oscillator.state!=='stopped'||wrappedSynth.oscillator.state!=='stopped')throw Error('A previous instrument envelope has not stopped before the next attack');
      if(Tone.Transport.state!=='stopped')throw Error('The standalone fixture must not start Transport');
      const atOrdinary=ordinary.immediate()+0.01,atWrapped=wrapped.immediate()+0.01;
      const gapOrdinary=i?atOrdinary-lastOrdinary:null,gapWrapped=i?atWrapped-lastWrapped:null;
      if(i&&(gapOrdinary<0.8||gapWrapped<0.8))throw Error('An attack would violate minimum spacing');
      ordinarySynth.triggerAttackRelease(settings.pitchHz,settings.holdSec,atOrdinary,settings.velocity);
      wrappedSynth.triggerAttackRelease(settings.pitchHz,settings.holdSec,atWrapped,settings.velocity);
      attacks.push({index:i,at:performance.now(),ordinaryAt:atOrdinary,wrappedAt:atWrapped,gapOrdinary,gapWrapped});
      lastOrdinary=atOrdinary;lastWrapped=atWrapped;
    }
    await pause(settings.tailAndIdleWaitSec*1000);
    document.getElementById('status').textContent='Attacks complete; tails and initial idle wait elapsed.';
    return {attacks,silence:{...silence}};
  },
  disposeSynths:()=>{
    if(ordinarySynth)ordinarySynth.dispose();if(wrappedSynth)wrappedSynth.dispose();
    ordinarySynth=null;wrappedSynth=null;
    if(ordinaryGain)ordinaryGain.dispose();if(wrappedGain)wrappedGain.disconnect();
    ordinaryGain=null;wrappedGain=null;disposed=true;
  },
  close:async()=>{
    if(forwardTick){ordinary.off('tick',forwardTick);forwardTick=null;}
    wrapped.dispose();ordinary.dispose();
    const deadline=performance.now()+10000;
    while(ordinary.state!=='closed'||wrapped.state!=='closed'){
      if(performance.now()>deadline)throw Error('Public Context.dispose did not close the owned diagnostic contexts');
      await pause(20);
    }
    wrapped=null;ordinary=null;native=null;closed=true;
    document.getElementById('status').textContent='Disposed and closed.';
  }
};
})();`;
  new vm.Script(pageScript,{filename:'actual-piano-lifetime-page.js'});
  const html=`<!doctype html><meta charset="utf-8"><title>Tone lifetime diagnostic</title>
<style>body{font:16px system-ui;margin:3rem;background:#101826;color:#e4ecf7}button{font:inherit;padding:1rem}</style>
<h1>Local Tone source-lifetime diagnostic</h1><p>Actual application context helper; two quiet instruments. No game or saved data.</p>
<button id="prepare">Prepare audio</button><pre id="status">Waiting for a browser gesture.</pre>
<script src="/Tone-14.8.49.js"></script><script>${pageScript}</script>`;
  if(options.check){
    console.log(JSON.stringify({checked:true,browserLaunched:false,artifactsWritten:false,source:app.metadata,settings},null,2));
    return;
  }
  const requireModules=createRequire(path.join(options.modules,'package.json'));
  const puppeteer=requireModules('puppeteer-core');
  fs.mkdirSync(options.out,{recursive:true});
  const write=(name,value)=>fs.writeFileSync(path.join(options.out,name),JSON.stringify(value,null,2)+'\n');
  const harnessBytes=fs.readFileSync(fileURLToPath(import.meta.url));
  fs.writeFileSync(path.join(options.out,'harness.mjs.txt'),harnessBytes);
  fs.writeFileSync(path.join(options.out,'page.html.txt'),html);
  fs.writeFileSync(path.join(options.out,'application-helpers.js.txt'),app.program);
  write('application-source.json',app.metadata);
  const manifest={options,settings,toneSha256:hash(toneBytes),pageSha256:hash(html),harnessSha256:hash(harnessBytes),
    application:app.metadata,
    nodeVersion:process.version,puppeteerVersion:requireModules('puppeteer-core/package.json').version,
    started:new Date().toISOString(),classification:settings.classification};
  write('manifest.json',manifest);
  const denied=[],events=[],snapshots=[],errors=[],warnings=[],createdNodes=new Map(),liveNodes=new Map(),contexts=new Map();
  const server=http.createServer((request,response)=>{
    if(request.method==='GET'&&request.url==='/'){
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(html);
    }else if(request.method==='GET'&&request.url==='/Tone-14.8.49.js'){
      response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});response.end(toneBytes);
    }else{
      denied.push({at:Date.now(),layer:'server',method:request.method,url:request.url});response.writeHead(403);response.end('Local diagnostic route denied');
    }
  });
  let browser,page,cdp,failure=null;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const origin='http://127.0.0.1:'+server.address().port;
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aim-dojo-tone-lifetime-'));
    manifest.origin=origin;manifest.profile=profile;
    browser=await puppeteer.launch({executablePath:options.chrome,userDataDir:profile,headless:options.headless,defaultViewport:{width:900,height:500},
      args:['--no-first-run','--disable-background-networking','--window-size=900,650']});
    manifest.browserVersion=await browser.version();manifest.launchArgs=browser.process()?.spawnargs||[];
    page=(await browser.pages())[0];
    page.on('pageerror',error=>errors.push({at:Date.now(),message:String(error.stack||error)}));
    page.on('console',message=>{if(message.type()==='error')errors.push({at:Date.now(),message:message.text()});if(message.type()==='warn')warnings.push({at:Date.now(),message:message.text()});});
    await page.setRequestInterception(true);
    page.on('request',request=>{
      if(request.method()==='GET'&&(request.url()===origin+'/'||request.url()===origin+'/Tone-14.8.49.js')) void request.continue();
      else{denied.push({at:Date.now(),layer:'browser',method:request.method(),url:request.url()});void request.abort('blockedbyclient');}
    });
    cdp=await page.createCDPSession();
    await cdp.send('Performance.enable');
    for(const kind of ['contextCreated','contextChanged','contextWillBeDestroyed','audioNodeCreated','audioNodeWillBeDestroyed']){
      cdp.on('WebAudio.'+kind,event=>{
        events.push({at:Date.now(),kind,...event});
        if(kind==='contextCreated'||kind==='contextChanged')contexts.set(event.context.contextId,event.context);
        if(kind==='contextWillBeDestroyed')contexts.delete(event.contextId);
        if(kind==='audioNodeCreated'){createdNodes.set(event.node.nodeId,event.node);liveNodes.set(event.node.nodeId,event.node);}
        if(kind==='audioNodeWillBeDestroyed')liveNodes.delete(event.nodeId);
      });
    }
    await cdp.send('WebAudio.enable');
    await page.goto(origin+'/',{waitUntil:'load',timeout:30000});
    await page.waitForFunction(()=>window.Tone&&window.lifetime,{timeout:15000});
    await pause(250);
    const defaultIds=[...contexts.keys()];
    if(defaultIds.length!==1)throw Error('Expected one default Tone context before native-context preparation; found '+defaultIds.length);
    await page.click('#prepare');
    await page.waitForFunction(()=>['ready','failed'].includes(window.lifetime.status().setupState),{timeout:15000});
    const setup=await page.evaluate(()=>window.lifetime.status());
    if(setup.setupState!=='ready')throw Error(setup.setupError||'Audio setup failed');
    await pause(1000);
    // contextWillBeDestroyed can lag close, so a closed library default can remain
    // visible in CDP. Assign owners from the observed creation sequence, not map size.
    const newIds=[...new Set(events.filter(event=>event.kind==='contextCreated').map(event=>event.context.contextId))].filter(id=>!defaultIds.includes(id));
    const expectedNew=options.native?2:1;
    if(newIds.length!==expectedNew)throw Error('Expected '+expectedNew+' new contexts in the documented creation order; found '+newIds.length);
    manifest.contextIds={originalLibraryDefault:defaultIds[0],ordinary:options.native?newIds[0]:defaultIds[0],wrappedNative:newIds.at(-1)};
    manifest.contextIdEvidence=options.native?'Library default before gesture; actual helper creates ordinary native first and disposes default; comparator native is created second. Closed default records may remain visible.':'Library default before gesture remains ordinary; comparator native is the only newly created context.';
    write('manifest.json',manifest);

    const checkpoint=async label=>{
      const performanceResult=await cdp.send('Performance.getMetrics');
      const metrics=Object.fromEntries(performanceResult.metrics.map(metric=>[metric.name,metric.value]));
      if(!Number.isFinite(metrics.AudioHandlers))throw Error('Performance.AudioHandlers is unavailable; cannot substitute DOM node counts');
      const counts={};
      for(const node of createdNodes.values()){
        const byType=counts[node.contextId]??={};const item=byType[node.nodeType]??={created:0,destroyed:0,eventBalance:0};
        item.created++;if(liveNodes.has(node.nodeId))item.eventBalance++;else item.destroyed++;
      }
      const realtime={};
      for(const [id,context] of contexts){
        try{realtime[id]=(await cdp.send('WebAudio.getRealtimeData',{contextId:id})).realtimeData;}
        catch(error){realtime[id]={error:String(error.message||error),state:context.contextState};}
      }
      snapshots.push({label,at:Date.now(),page:await page.evaluate(()=>window.lifetime.snapshot()),
        metrics,dom:await cdp.send('Memory.getDOMCounters'),contexts:[...contexts.values()],nodesByContext:counts,realtime,
        eventCount:events.length,trackedNodeEventBalance:liveNodes.size,
        note:'Creation/destruction event balance and AudioHandlers are not running-source counts. Chromium 152.0.7977.65 renderCapacity is a raw fraction: 1 means 100%; it describes the previous callback render duration divided by the observed callback interval, not a sampling-period mean or guaranteed headroom.'});
      write('snapshots.json',snapshots);write('node-events.json',events);
      console.log(label+': AudioHandlers='+metrics.AudioHandlers+', tracked node balance='+liveNodes.size);
    };
    await checkpoint('baseline-prepared-no-notes');
    const prepared=snapshots.at(-1).page;
    if(options.native&&(!prepared.previous.disposed||prepared.previous.state!=='closed'))throw Error('Actual helper did not retire its unused bundled default Context');
    const attacks=await page.evaluate(()=>window.lifetime.run());
    write('attacks.json',attacks);
    if(attacks.attacks.length!==options.notes)throw Error('Unexpected note-pair count');
    if(attacks.silence.ordinary!==options.notes||attacks.silence.wrapped!==options.notes)throw Error('Expected one carrier silence callback per note in both contexts; inspect attacks.json');
    await checkpoint('after-attacks-tails-and-idle');
    await cdp.send('HeapProfiler.collectGarbage');await pause(settings.gcIdleWaitSec*1000);
    await checkpoint('after-forced-gc');
    const countsAfterGc=snapshots.at(-1).nodesByContext;
    const ordinaryOscillators=countsAfterGc[manifest.contextIds.ordinary]?.Oscillator?.eventBalance||0;
    const wrappedOscillators=countsAfterGc[manifest.contextIds.wrappedNative]?.Oscillator?.eventBalance||0;
    manifest.retention={ordinaryOscillators,wrappedOscillators,ordinaryLimit:settings.ordinaryOscillatorLimitAfterGc,
      ordinaryBounded:ordinaryOscillators<=settings.ordinaryOscillatorLimitAfterGc,wrappedBounded:wrappedOscillators<=2,
      enforced:!options['skip-retention-assert'],nativeEnabled:!!options.native,
      scope:'One owned mono FMSynth per context, 24 by default. This bounds post-GC CDP source accounting, not running voices or a game-frame performance result.'};
    write('retention.json',manifest.retention);
    await page.evaluate(()=>window.lifetime.disposeSynths());await pause(2000);
    await cdp.send('HeapProfiler.collectGarbage');await pause(settings.gcIdleWaitSec*1000);
    await checkpoint('after-synth-dispose-and-gc');
    await page.evaluate(()=>window.lifetime.close());await pause(2000);
    await cdp.send('HeapProfiler.collectGarbage');await pause(settings.gcIdleWaitSec*1000);
    await checkpoint('after-context-close-and-gc');
    if(manifest.retention.enforced&&(!manifest.retention.ordinaryBounded||!manifest.retention.wrappedBounded))throw Error('Source-retention regression: after GC ordinary='+ordinaryOscillators+' (limit '+settings.ordinaryOscillatorLimitAfterGc+'), comparator='+wrappedOscillators+' (limit 2); use --skip-retention-assert only for the expected failing control');
    manifest.completed=new Date().toISOString();manifest.status='completed';
  }catch(error){
    failure=error;manifest.status='failed';manifest.failure=String(error.stack||error);manifest.failed=new Date().toISOString();
  }finally{
    write('manifest.json',manifest);write('node-events.json',events);write('snapshots.json',snapshots);
    write('console.json',{errors,warnings});write('denied-network.json',denied);
    if(browser)await browser.close().catch(error=>{console.error('Browser cleanup: '+error.message);});
    if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
  if(failure)throw failure;
  console.log('Saved source-lifetime diagnostic to '+options.out);
}

await runToneLifetime();
