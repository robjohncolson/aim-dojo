#!/usr/bin/env node
// Bounded R4 observer; serialize with other browser/capture/benchmark jobs.
// --source accepts secured baseline bytes; --root supplies unchanged page/assets.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

function installPianoReverbObserver(){
  const events=[],frames=[],stack=[],contexts=new WeakMap();let nextContext=0,dropped=0,last=null,runningAt=null;
  const MAX=12000;
  const phase=()=>{try{return window.__reverbState?.()||{running:false,phase:'boot'};}catch{return {running:false,phase:'boot'};}};
  const record=row=>{if(events.length<MAX)events.push(row);else dropped++;};
  const contextId=context=>{if(!contexts.has(context))contexts.set(context,++nextContext);return contexts.get(context);};
  const wrap=(name,fn)=>function(...args){
    const at=performance.now(),before=phase(),parents=stack.slice();let error=null;
    stack.push(name);
    try{return Reflect.apply(fn,this,args);}catch(e){error=String(e);throw e;}
    finally{stack.pop();record({kind:'call',name,at,duration:performance.now()-at,parents,...before,error,args:args.filter(v=>typeof v==='number'||typeof v==='boolean')});}
  };
  // These inherited Web Audio factory methods are public APIs. Preserve this,
  // arguments, return values and exceptions, and do not retain returned nodes.
  for(const name of ['createBuffer','createConvolver','createGain']){
    let owner=window.BaseAudioContext?.prototype||window.AudioContext?.prototype;
    while(owner&&!Object.hasOwn(owner,name))owner=Object.getPrototypeOf(owner);
    if(!owner||typeof owner[name]!=='function')continue;
    const original=owner[name];
    owner[name]=function(...args){
      const at=performance.now(),parents=stack.slice(),before=phase();let error=null;
      try{return Reflect.apply(original,this,args);}catch(e){error=String(e);throw e;}
      finally{record({kind:'native',name,at,duration:performance.now()-at,parents,...before,error,contextId:contextId(this),contextState:this.state,contextRate:this.sampleRate,
        ...(name==='createBuffer'?{channels:args[0],length:args[1],sampleRate:args[2],ir22:args[0]===2&&args[1]===Math.max(1,Math.floor(args[2]*2.2))}:{})});}
    };
  }
  const gate={enabledAt:null,playInputAt:null};
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('beginTrain');if(!button)return;
    const check=()=>{if(!button.disabled&&gate.enabledAt===null)gate.enabledAt=performance.now();};
    new MutationObserver(check).observe(button,{attributes:true,attributeFilter:['disabled']});check();
    button.addEventListener('pointerdown',()=>{if(gate.playInputAt===null)gate.playInputAt=performance.now();},{capture:true});
  });
  const frame=at=>{const state=phase();if(state.running&&runningAt===null)runningAt=at;if(last!==null&&frames.length<MAX)frames.push([at,at-last,!!state.running]);last=at;requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
  window.__reverb={wrap,mark:name=>record({kind:'mark',name,at:performance.now(),...phase()}),data:()=>({events,frames,gate,runningAt,dropped})};
}

async function runPianoReverbProbe(){
  const here=path.dirname(fileURLToPath(import.meta.url));
  const options={root:path.resolve(here,'..'),source:null,out:null,query:'',seconds:10,check:false,profile:false,
    modules:process.env.COLDLOAD_MODULES||'C:/Users/rober/AppData/Local/Temp/aim-dojo-parcel-e-puppeteer/node_modules',
    chrome:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'};
  for(let i=2;i<process.argv.length;i++){
    const key=process.argv[i].replace(/^--/,'');
    if(['check','profile'].includes(key))options[key]=true;
    else if(Object.hasOwn(options,key)&&process.argv[i+1]!==undefined)options[key]=process.argv[++i];
    else throw Error('Invalid option '+process.argv[i]);
  }
  options.root=path.resolve(options.root);options.seconds=Number(options.seconds);
  if(!['','?piano=0'].includes(options.query)||!Number.isFinite(options.seconds)||options.seconds<5||options.seconds>15)throw Error('Use default piano or exact ?piano=0, and 5-15 running seconds');
  if(options.source)options.source=path.resolve(options.source);
  if(!options.check&&!options.out)throw Error('Pass a new --out directory');
  if(options.out){options.out=path.resolve(options.out);if(fs.existsSync(options.out)||options.out.split(path.sep).some(p=>p.toLowerCase()==='state'))throw Error('Output must be new and outside state/');}
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const original=fs.readFileSync(options.source||path.join(options.root,'aim-dojo-main.js'));
  const names=['initAudio','exitRunning','enterRunning','startRun','buildReverb','scheduleReverbBuild','makeIR'];
  const bridge=`
// Diagnostic only: timing wrappers preserve calls and never draw RNG.
window.__reverbState=()=>({running:!!state.running,phase:templeActive?'temple':trainMode?'lesson-'+trainPhase:'main',piano:PIANO});
${names.map(name=>`if(typeof ${name}==='function')${name}=window.__reverb.wrap('${name}',${name});`).join('\n')}
window.__reverbBridge={
  sample:()=>({at:performance.now(),...window.__reverbState(),bpm:state.bpm,beat:toneReady?roadBeatNow():null,transportState:toneReady?Tone.Transport.state:null,soundOn,
    reverbInput:!!reverbInput,reverbQueued:!!reverbQueued,nativePianoContext:typeof _pianoContext!=='undefined'&&!!_pianoContext,
    tone:rawCtx?{state:rawCtx.state,time:rawCtx.currentTime,sampleRate:rawCtx.sampleRate}:null,
    listener:listener?{state:listener.context.state,time:listener.context.currentTime,sampleRate:listener.context.sampleRate}:null}),
  settings:()=>{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {piano:PIANO,low:LOW,glow:GLOW,weak:WEAK,buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),toneVersion:Tone.version,threeVersion:THREE.REVISION};},
  pause:()=>{window.__reverb.mark('diagnostic-pause');exitRunning();},
  resume:()=>{window.__reverb.mark('diagnostic-resume-viaPad');startRun(true);}
};
`;
  const source=original.toString('utf8'),insert=source.indexOf('if(CFG.gateFirst) afterGate(warmShadersStart');
  if(insert<0)throw Error('Warm scheduling boundary changed');
  const served=source.slice(0,insert)+bridge+'\n'+source.slice(insert);
  new vm.Script(served,{filename:'served-reverb-probe.js'});new vm.Script('('+installPianoReverbObserver.toString()+')');
  const manifest={options,commit:execFileSync('git',['-C',options.root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),runtimeSha256:hash(original),servedSha256:hash(served),bridgeSha256:hash(bridge),observerSha256:hash(installPianoReverbObserver.toString()),harnessSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),started:new Date().toISOString(),
    fixture:'Fresh profile; genuine mouse PLAY; natural lesson entry; no shots, WASD, fixture storage or tempo/groove overrides. After running sample, direct actual exitRunning; wait 1.8 seconds; actual startRun(true); wait 2 seconds; final actual exitRunning and wait 1.8 seconds.',
    limits:['Synchronous observer and optional V8 profile add overhead; single cold runs are not a general startup speed experiment.','Native createBuffer matches exact stereo floor(sampleRate*2.2) dimensions and builder parent scope; no dummy RNG draws.','No imported profile, state access, external writes or account/API traffic. No audio recording or subjective listening check.']};
  if(options.check){console.log(JSON.stringify({checked:true,browserLaunched:false,runtimeSha256:manifest.runtimeSha256}));return;}
  fs.mkdirSync(options.out,{recursive:true});
  const save=(file,data)=>fs.writeFileSync(path.join(options.out,file),JSON.stringify(data,null,2)+'\n');
  save('manifest.json',manifest);fs.writeFileSync(path.join(options.out,'runtime.js.txt'),original);fs.writeFileSync(path.join(options.out,'bridge.js.txt'),bridge);fs.writeFileSync(path.join(options.out,'observer.js.txt'),installPianoReverbObserver.toString());fs.writeFileSync(path.join(options.out,'harness.mjs.txt'),fs.readFileSync(fileURLToPath(import.meta.url)));
  const errors=[],warnings=[],denied=[],nativeEvents=[],contexts=new Map();let browser,page,cdp,failure=null,profiling=false;
  const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css'};
  const server=http.createServer((request,response)=>{
    const route=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname),relative=route==='/'?'index.html':route.slice(1),file=path.resolve(options.root,relative);
    if(!['GET','HEAD'].includes(request.method)||!file.startsWith(options.root+path.sep)||!(relative==='index.html'||/^[\w-]+\.js$/.test(relative)||/^(assets|fixtures)\//.test(relative))){response.writeHead(404).end();return;}
    if(relative==='aim-dojo-main.js'){response.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'}).end(served);return;}
    fs.readFile(file,(error,bytes)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);});
  });
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const origin='http://127.0.0.1:'+server.address().port,profile=fs.mkdtempSync(path.join(os.tmpdir(),'aim-dojo-r4-reverb-'));
    manifest.url=origin+'/'+options.query;manifest.profile=profile;
    const puppeteer=createRequire(path.join(options.modules,'package.json'))('puppeteer-core');
    browser=await puppeteer.launch({executablePath:options.chrome,userDataDir:profile,headless:false,defaultViewport:null,args:['--window-size=1920,1200','--no-first-run','--disable-background-networking']});
    manifest.browserVersion=await browser.version();page=(await browser.pages())[0];cdp=await page.createCDPSession();
    const bounds=await cdp.send('Browser.getWindowForTarget');await cdp.send('Browser.setWindowBounds',{windowId:bounds.windowId,bounds:{windowState:'maximized'}});
    for(const kind of ['contextCreated','contextChanged','contextWillBeDestroyed','audioNodeCreated','audioNodeWillBeDestroyed'])cdp.on('WebAudio.'+kind,event=>{nativeEvents.push({kind,...event});if(kind==='contextCreated'||kind==='contextChanged')contexts.set(event.context.contextId,event.context);if(kind==='contextWillBeDestroyed')contexts.delete(event.contextId);});
    await cdp.send('WebAudio.enable');
    page.on('pageerror',error=>errors.push({kind:'pageerror',message:String(error.stack||error)}));page.on('console',message=>{if(message.type()==='error')errors.push({kind:'console',message:message.text()});if(message.type()==='warn')warnings.push(message.text());});
    await page.setRequestInterception(true);
    const external=new Set(['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js']);
    page.on('request',request=>{const url=new URL(request.url());if(['GET','HEAD'].includes(request.method())&&(url.origin===origin||external.has(request.url())||['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)))return request.continue();denied.push({method:request.method(),origin:url.origin,path:url.pathname});return request.respond({status:404,headers:{'access-control-allow-origin':'*'},body:''});});
    await page.evaluateOnNewDocument(installPianoReverbObserver);
    if(options.profile){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');profiling=true;}
    await page.goto(manifest.url,{waitUntil:'domcontentloaded',timeout:60000});await page.bringToFront();
    await page.waitForFunction(()=>window.__reverbBridge&&!document.getElementById('beginTrain').disabled,{timeout:60000,polling:25});
    await page.click('#beginTrain');await page.waitForFunction(()=>window.__reverbBridge.sample().running,{timeout:20000});
    const settings=await page.evaluate(()=>window.__reverbBridge.settings());save('settings.json',settings);
    if(/swiftshader|llvmpipe|software/i.test(settings.renderer))throw Error('Real GPU required');
    const checkpoints=[{label:'after-play',sample:await page.evaluate(()=>window.__reverbBridge.sample())}];
    await new Promise(resolve=>setTimeout(resolve,options.seconds*1000));checkpoints.push({label:'running',sample:await page.evaluate(()=>window.__reverbBridge.sample())});
    await page.screenshot({path:path.join(options.out,'running.png')});
    await page.evaluate(()=>window.__reverbBridge.pause());await new Promise(resolve=>setTimeout(resolve,1800));checkpoints.push({label:'paused',sample:await page.evaluate(()=>window.__reverbBridge.sample())});
    await page.evaluate(()=>window.__reverbBridge.resume());await page.waitForFunction(()=>window.__reverbBridge.sample().running,{timeout:5000});await new Promise(resolve=>setTimeout(resolve,2000));checkpoints.push({label:'resumed',sample:await page.evaluate(()=>window.__reverbBridge.sample())});
    await page.evaluate(()=>window.__reverbBridge.pause());await new Promise(resolve=>setTimeout(resolve,1800));checkpoints.push({label:'final-exit',sample:await page.evaluate(()=>window.__reverbBridge.sample())});
    const observer=await page.evaluate(()=>window.__reverb.data());
    const result={checkpoints,observer,contexts:[...contexts.values()]};save('capture.json',result);save('native-events.json',nativeEvents);
    const events=observer.events,native=events.filter(event=>event.kind==='native'),calls=events.filter(event=>event.kind==='call');
    const summary={query:options.query,piano:settings.piano,runtimeSha256:manifest.runtimeSha256,gate:observer.gate,firstRunningRaf:observer.runningAt,
      counts:Object.fromEntries(['createBuffer','createConvolver','createGain'].map(name=>[name,native.filter(event=>event.name===name).length])),
      stereo22Buffers:native.filter(event=>event.ir22),reverbNative:native.filter(event=>event.parents.includes('buildReverb')),
      builderCalls:calls.filter(event=>['initAudio','exitRunning','buildReverb','scheduleReverbBuild','makeIR'].includes(event.name)),checkpoints,dropped:observer.dropped,errors:errors.length};
    save('summary.json',summary);
    if(observer.dropped||!checkpoints[0].sample.running||!checkpoints[1].sample.running||checkpoints[2].sample.running||!checkpoints[3].sample.running||checkpoints[4].sample.running)throw Error('Required boot/pause/resume/exit coverage incomplete');
    manifest.status='completed';manifest.completed=new Date().toISOString();
  }catch(error){failure=error;manifest.status='failed';manifest.failure=String(error.stack||error);if(page)try{save('partial.json',await page.evaluate(()=>({observer:window.__reverb?.data(),sample:window.__reverbBridge?.sample()})));}catch{}}
  finally{
    try{
      if(profiling&&cdp)try{const profile=await cdp.send('Profiler.stop');save('cpu-profile.json',profile.profile);}catch{}
      save('manifest.json',manifest);save('console.json',{errors,warnings});save('denied-network.json',denied);
    }catch(error){if(!failure)failure=error;}
    finally{if(browser)await browser.close().catch(()=>{});if(server.listening)await new Promise(resolve=>server.close(resolve));}
  }
  if(failure)throw failure;
  console.log('Saved reverb probe to '+options.out);
}

await runPianoReverbProbe();
