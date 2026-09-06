#!/usr/bin/env node
// R3 cold first-use diagnostic. Run only with the capture/benchmark owner idle.
// node tools/piano-crunch-cold.mjs --root <checkout> --out <new-directory> [--trace]
// --check parses the served instrumentation without launching a browser.
// One fresh profile, one PLAY, bounded 60 BPM/high-groove fixture and real DOM input.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

function installPianoColdObserver(){
  const MAX=24000,events=[],frames=[],longTasks=[],stack=[],proxyCache=new WeakMap();
  let dropped=0,nextId=0,lastFrame=null,runningAt=null,enabled=true,namespace;
  const objectIds=new WeakMap();
  const id=value=>{if(!value||(typeof value!=='object'&&typeof value!=='function'))return null;if(!objectIds.has(value))objectIds.set(value,++nextId);return objectIds.get(value);};
  const phase=()=>{try{return window.__coldState?window.__coldState():{running:false,phase:'boot'};}catch{return {running:false,phase:'boot'};}};
  const record=row=>{if(events.length<MAX)events.push(row);else dropped++;};
  const wrap=(name,fn,detail)=>function(...args){
    const at=performance.now(),before=phase(),parents=stack.slice();let error=null;
    const countRng=/warm/i.test(name)||name==='renderer.compile';
    let randomCalls=0,rndCalls=null;const originalRandom=Math.random;
    const finishRnd=countRng&&window.__coldBeginRndCount?window.__coldBeginRndCount():null;
    if(countRng)Math.random=(...values)=>{randomCalls++;return Reflect.apply(originalRandom,Math,values);};
    stack.push(name);
    try{return Reflect.apply(fn,this,args);}catch(e){error=String(e);throw e;}
    finally{const end=performance.now();stack.pop();if(countRng)Math.random=originalRandom;if(finishRnd)rndCalls=finishRnd();if(name!=='renderer.render'||end-at>=20||!before.running)record({kind:'call',name,at,duration:end-at,parents,...before,detail:detail?detail(args):undefined,randomCalls:countRng?randomCalls:undefined,rndCalls,error});}
  };
  const exported=(key,value)=>{
    if(!['FMSynth','PolySynth'].includes(key)||typeof value!=='function')return value;
    if(proxyCache.has(value))return proxyCache.get(value);
    const proxy=new Proxy(value,{construct(target,args,newTarget){
      const at=performance.now(),before=phase(),parents=stack.slice();let result,error=null;
      stack.push('new '+key);
      try{result=Reflect.construct(target,args,newTarget);return result;}catch(e){error=String(e);throw e;}
      finally{const end=performance.now();stack.pop();record({kind:'construct',name:key,at,duration:end-at,parents,...before,id:id(result),error,stack:new Error().stack});}
    }});
    proxyCache.set(value,proxy);return proxy;
  };
  // The pinned namespace has immutable accessor exports. Proxying the namespace
  // in this diagnostic intercepts constructors without editing library internals.
  Object.defineProperty(window,'Tone',{configurable:true,enumerable:true,get:()=>namespace,set(value){
    namespace=new Proxy(value,{get:(target,key)=>exported(key,Reflect.get(target,key,target))});
    record({kind:'library',name:'Tone assigned',at:performance.now(),version:value.version});
  }});
  for(const klass of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
    if(!klass)continue;
    for(const name of ['compileShader','linkProgram','getProgramParameter','getShaderParameter']){
      if(!Object.hasOwn(klass.prototype,name))continue;
      const original=klass.prototype[name];
      if(typeof original!=='function')continue;
      klass.prototype[name]=wrap('WebGL.'+name,original,args=>({object:id(args[0]),parameter:typeof args[1]==='number'?args[1]:null}));
    }
  }
  try{new PerformanceObserver(list=>{for(const entry of list.getEntries())if(longTasks.length<2000)longTasks.push({at:entry.startTime,duration:entry.duration,name:entry.name});}).observe({type:'longtask',buffered:true});}catch{}
  const frame=at=>{
    if(!enabled)return;
    const state=phase();
    if(state.running&&runningAt===null){runningAt=at;record({kind:'milestone',name:'first-running-raf',at,...state});}
    if(lastFrame!==null&&frames.length<MAX)frames.push([at,at-lastFrame,!!state.running]);lastFrame=at;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const gate={enabledAt:null,playInputAt:null};
  const watch=()=>{const button=document.getElementById('beginTrain');if(!button)return;
    const check=()=>{if(!button.disabled&&gate.enabledAt===null){gate.enabledAt=performance.now();record({kind:'milestone',name:'play-enabled',at:gate.enabledAt});}};
    new MutationObserver(check).observe(button,{attributes:true,attributeFilter:['disabled']});check();};
  document.addEventListener('DOMContentLoaded',watch,{once:true});
  document.addEventListener('pointerdown',event=>{if(event.target?.closest?.('#beginTrain')){gate.playInputAt=performance.now();record({kind:'milestone',name:'play-pointerdown',at:gate.playInputAt});}},true);
  window.__cold={wrap,record,id,gate,mark(name,detail){record({kind:'milestone',name,at:performance.now(),...phase(),detail});},
    data:()=>({events,frames,longTasks,dropped,gate,runningAt}),stop:()=>{enabled=false;}};
}

async function runPianoColdCapture(){
  const here=path.dirname(fileURLToPath(import.meta.url));
  const options={root:path.resolve(here,'..'),out:null,seconds:110,bpm:60,trace:false,check:false,
    modules:process.env.COLDLOAD_MODULES||'C:/Users/rober/AppData/Local/Temp/aim-dojo-parcel-e-puppeteer/node_modules',
    chrome:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'};
  for(let i=2;i<process.argv.length;i++){
    const name=process.argv[i].replace(/^--/,'');
    if(['check','trace'].includes(name))options[name]=true;
    else if(Object.hasOwn(options,name)&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'))options[name]=process.argv[++i];
    else throw Error('Invalid option '+process.argv[i]);
  }
  options.root=path.resolve(options.root);options.seconds=Number(options.seconds);options.bpm=Number(options.bpm);
  if(!Number.isFinite(options.seconds)||options.seconds<60||options.seconds>180||options.bpm!==60)throw Error('Use 60 BPM and a bounded 60–180 second duration');
  if(!options.check&&!options.out)throw Error('Pass --out <new artifact directory>');
  if(options.out){options.out=path.resolve(options.out);if(fs.existsSync(options.out)||options.out.split(path.sep).some(p=>p.toLowerCase()==='state'))throw Error('Output must be new and outside state/');}
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const original=fs.readFileSync(path.join(options.root,'aim-dojo-main.js'));
  const aimFile=path.join(here,'piano-crunch-aim-probe.js'),aim=fs.readFileSync(aimFile,'utf8');
  const names=['initAudio','pianoContextAlign','buildDrums','chorusEnsure','chorusWarm','pianoFieldBuild','startRun','enterRunning','ensureRhythm','playHit','chorusMercy','doorCross','warmShadersStart','warmShaders','buildReverb','spawnRhythmOrb','pianoWarmPool','pianoWarmGraph','pianoWarmAfterUnlock','pianoWarmShadersStart','pianoWarmStartRun'];
  const bridge=`
// DIAGNOSTIC ONLY: wrappers preserve argument/return/exception behavior and consume no RNG.
window.__coldState=()=>({running:!!state.running,phase:templeActive?'temple':trainMode?'lesson-'+trainPhase:_bow.stage?'bow-'+_bow.stage:'main',bpm:state.bpm,hits:state.hits,shots:state.shots});
window.__coldBeginRndCount=()=>{const originalRnd=rnd;let calls=0;rnd=function(...args){calls++;return Reflect.apply(originalRnd,this,args);};return()=>{rnd=originalRnd;return calls;};};
${names.map(name=>`if(typeof ${name}==='function')${name}=window.__cold.wrap('${name}',${name});`).join('\n')}
renderer.compile=window.__cold.wrap('renderer.compile',renderer.compile,args=>({children:args[0]?.children?.map(o=>({id:o.id,name:o.name,type:o.type}))||[],programs:renderer.info.programs.length}));
renderer.render=window.__cold.wrap('renderer.render',renderer.render);
window.__cold.mark('bridge-installed');
window.__coldBridge=(()=>{
  let driving=false,lastNote=-1,raf=null;const inputs=[],samples=[];
  const sample=()=>({at:performance.now(),...window.__coldState(),transportBpm:toneReady?Tone.Transport.bpm.value:null,groove:grooveI,mercy:tideMercy,targets:targets.length,spheres:_humField?.voices?.length||0,programs:renderer.info.programs.length});
  const drive=at=>{
    if(!driving)return;
    if(state.running&&!trainMode&&!templeActive&&_bow.stage<BOW.LAST)grooveI=3;
    if(state.running&&!templeActive&&_bow.stage<BOW.LAST){
      const secondsPerBeat=60/Math.max(20,state.bpm),div=wasdNoteDiv(),heard=wasdBeats()-audioLat()/secondsPerBeat;
      const note=Math.round(heard*div),offset=(heard-note/div)*secondsPerBeat;
      if(Math.abs(offset)<.020&&note!==lastNote){lastNote=note;const lane=_combo[((note%_combo.length)+_combo.length)%_combo.length];
        const key=['w','a','s','d'][lane],code=['KeyW','KeyA','KeyS','KeyD'][lane];
        document.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true}));document.dispatchEvent(new KeyboardEvent('keyup',{key,code,bubbles:true}));
        if(inputs.length<1000)inputs.push({at,code,beat:heard,offset});
      }
    }
    raf=requestAnimationFrame(drive);
  };
  return {sample,configure(){setTrainPhase(3);state.bpm=${options.bpm};Tone.Transport.bpm.value=${options.bpm};CFG.bpmUp=0;CFG.bpmDown=0;grooveI=3;window.__cold.mark('forced-main-60-high-groove');},
    start(){driving=true;raf=requestAnimationFrame(drive);},point(){const s=sample();samples.push(s);return s;},
    stop(){driving=false;if(raf!==null)cancelAnimationFrame(raf);},
    settings(){const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {piano:PIANO,pianoConfig:CFG.piano,pianoNativeContext:CFG.pianoNativeContext,low:LOW,glow:GLOW,weak:WEAK,deviceDpr:devicePixelRatio,buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],viewport:[innerWidth,innerHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),toneVersion:Tone.version,threeVersion:THREE.REVISION,soundOn,theme:activeTheme?.name,lookAhead:Tone.getContext().lookAhead,clockSource:Tone.getContext().clockSource,sampleRate:Tone.getContext().sampleRate};},
    data:()=>({inputs,samples,final:sample()})};
})();
${aim}
`;
  const source=original.toString('utf8'),insert=source.indexOf('if(CFG.gateFirst) afterGate(warmShadersStart');
  if(insert<0)throw Error('Warm scheduling boundary changed; review bridge placement before capture');
  // Bind the observers before warm callbacks are handed to runIdle/afterGate.
  // Appending at IIFE end would leave already captured callback references unobserved.
  const served=source.slice(0,insert)+bridge+'\n'+source.slice(insert);
  new vm.Script(served,{filename:'served-piano-cold-runtime.js'});
  new vm.Script('('+installPianoColdObserver.toString()+')',{filename:'cold-observer.js'});
  const manifest={options,commit:execFileSync('git',['-C',options.root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),runtimeSha256:hash(original),servedSha256:hash(served),bridgeSha256:hash(bridge),observerSha256:hash(installPianoColdObserver.toString()),aimSha256:hash(aim),harnessSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),started:new Date().toISOString(),
    instrumentation:'Fresh-profile local page. Constructor namespace proxy, synchronous app/renderer/WebGL timing wrappers, longtask observer, rAF intervals, in-IIFE clock bridge, bounded assisted real input.',
    fixture:'Cold PLAY as soon as enabled, then explicit main phase/60 BPM/high groove and synthetic WASD/assisted real shots; no fake hits or star/storage fixture.',
    limits:['rAF is not GPU presentation; synchronous driver API times are not total GPU execution.','Wrapping constructors and calls adds diagnostic overhead; one unseeded run per arm is not a deterministic performance experiment.','No constructor options, note arguments, renderer arguments, shader strings or RNG return values/draw counts are changed. Warm/compile RNG counters call the original functions once and restore them on return.','RNG counts and parent scopes are synchronous and inclusive; asynchronous continuation executes outside a returned parent scope.','No game storage is imported. The game may write its own fresh disposable profile. All external writes and API/account traffic are blocked.','Desktop genuine mouse PLAY only; this run does not establish mobile or denied-audio fallback behavior.']};
  if(options.check){console.log(JSON.stringify({checked:true,browserLaunched:false,runtimeSha256:manifest.runtimeSha256,bridgeSha256:manifest.bridgeSha256},null,2));return;}
  fs.mkdirSync(options.out,{recursive:true});
  const save=(name,value)=>fs.writeFileSync(path.join(options.out,name),JSON.stringify(value,null,2)+'\n');
  save('manifest.json',manifest);fs.writeFileSync(path.join(options.out,'bridge.js.txt'),bridge);fs.writeFileSync(path.join(options.out,'observer.js.txt'),installPianoColdObserver.toString());fs.writeFileSync(path.join(options.out,'harness.mjs.txt'),fs.readFileSync(fileURLToPath(import.meta.url)));
  const denied=[],errors=[],warnings=[];let browser,page,failure=null,tracing=false;
  const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css'};
  const server=http.createServer((request,response)=>{
    const route=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname),relative=route==='/'?'index.html':route.slice(1),file=path.resolve(options.root,relative);
    if(!['GET','HEAD'].includes(request.method)||!file.startsWith(options.root+path.sep)||!(relative==='index.html'||/^[\w-]+\.js$/.test(relative)||/^(assets|fixtures)\//.test(relative))){response.writeHead(404).end();return;}
    if(relative==='aim-dojo-main.js'){response.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'}).end(served);return;}
    fs.readFile(file,(error,bytes)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);});
  });
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const origin='http://127.0.0.1:'+server.address().port,profile=fs.mkdtempSync(path.join(os.tmpdir(),'aim-dojo-r3-cold-'));
    manifest.origin=origin;manifest.profile=profile;
    const puppeteer=createRequire(path.join(options.modules,'package.json'))('puppeteer-core');
    browser=await puppeteer.launch({executablePath:options.chrome,userDataDir:profile,headless:false,defaultViewport:null,args:['--window-size=1920,1200','--no-first-run','--disable-background-networking']});
    manifest.browserVersion=await browser.version();manifest.launchArgs=browser.process()?.spawnargs;
    page=(await browser.pages())[0];const cdp=await page.createCDPSession();
    const bounds=await cdp.send('Browser.getWindowForTarget');await cdp.send('Browser.setWindowBounds',{windowId:bounds.windowId,bounds:{windowState:'maximized'}});
    page.on('pageerror',error=>errors.push({kind:'pageerror',message:String(error.stack||error)}));
    page.on('console',message=>{if(message.type()==='error')errors.push({kind:'console',message:message.text()});if(message.type()==='warn')warnings.push(message.text());});
    await page.setRequestInterception(true);
    const external=new Set(['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js']);
    page.on('request',request=>{const url=new URL(request.url());if(['GET','HEAD'].includes(request.method())&&(url.origin===origin||external.has(request.url())||['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)))return request.continue();denied.push({method:request.method(),origin:url.origin,path:url.pathname});return request.respond({status:404,headers:{'access-control-allow-origin':'*'},body:''});});
    await page.evaluateOnNewDocument(installPianoColdObserver);
    if(options.trace){await page.tracing.start({path:path.join(options.out,'trace.json'),categories:['devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing','gpu','cc','toplevel']});tracing=true;}
    await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:60000});await page.bringToFront();
    await page.waitForFunction(()=>window.__coldBridge&&!document.getElementById('beginTrain').disabled,{timeout:60000,polling:25});
    await page.click('#beginTrain');
    await page.waitForFunction(()=>window.__coldBridge.sample().running,{timeout:20000});
    const settings=await page.evaluate(()=>window.__coldBridge.settings());save('settings.json',settings);
    if(/swiftshader|llvmpipe|software/i.test(settings.renderer))throw Error('Real-GPU capture required; software renderer reported');
    await page.evaluate(()=>{window.__coldBridge.configure();window.__coldBridge.start();window.__pcAim.start();});
    for(let elapsed=0;elapsed<options.seconds;elapsed+=5){
      await new Promise(resolve=>setTimeout(resolve,Math.min(5,options.seconds-elapsed)*1000));
      const point=await page.evaluate(()=>window.__coldBridge.point());
      if(elapsed===0)await page.screenshot({path:path.join(options.out,'first-use.png')});
      if(elapsed%20===0)console.log(JSON.stringify({elapsed:Math.min(elapsed+5,options.seconds),...point}));
    }
    await page.evaluate(()=>{window.__coldBridge.stop();window.__pcAim.stop();});
    const result=await page.evaluate(()=>({observer:window.__cold.data(),application:window.__coldBridge.data(),aim:window.__pcAim.result()}));
    save('capture.json',result);await page.screenshot({path:path.join(options.out,'end.png')});
    const observed=result.observer.events;
    const firstHit=observed.find(event=>event.kind==='call'&&event.name==='playHit');
    const firstMercy=observed.find(event=>event.kind==='call'&&event.name==='chorusMercy');
    const sphereBuild=observed.find(event=>event.kind==='call'&&event.name==='pianoFieldBuild');
    const constructions=observed.filter(event=>event.kind==='construct');
    const summary={gate:result.observer.gate,runningAt:result.observer.runningAt,firstHit:firstHit||null,firstMercy:firstMercy||null,sphereBuild:sphereBuild||null,
      constructorCounts:Object.fromEntries(['FMSynth','PolySynth'].map(name=>[name,constructions.filter(event=>event.name===name).length])),
      constructionsInHit:constructions.filter(event=>event.parents.includes('playHit')),constructionsInMercy:constructions.filter(event=>event.parents.includes('chorusMercy')),
      constructionsAfterRunning:constructions.filter(event=>event.running),compileCalls:observed.filter(event=>event.name==='renderer.compile'),
      coverage:{realHits:result.application.final.hits,realShots:result.application.final.shots,hitCallback:!!firstHit,mercyCallback:!!firstMercy,sphereConstruction:!!sphereBuild,droppedEvents:result.observer.dropped},
      note:'Construction parent scopes cover synchronous calls. Later Tone-scheduled construction also appears in constructionsAfterRunning with timestamps/stacks; it must not be misclassified as absent just because its hit parent returned.'};
    save('summary.json',summary);
    if(!firstHit||!firstMercy||!sphereBuild||result.observer.dropped)throw Error('Cold coverage incomplete; retain capture and review before claiming first-use acceptance');
    manifest.status='completed';manifest.completed=new Date().toISOString();
  }catch(error){failure=error;manifest.status='failed';manifest.failure=String(error.stack||error);if(page)try{save('partial.json',await page.evaluate(()=>({observer:window.__cold?.data(),application:window.__coldBridge?.data(),aim:window.__pcAim?.result()})));}catch{}}
  finally{if(tracing&&page)await page.tracing.stop().catch(()=>{});save('manifest.json',manifest);save('console.json',{errors,warnings});save('denied-network.json',denied);if(browser)await browser.close().catch(()=>{});if(server.listening)await new Promise(resolve=>server.close(resolve));}
  if(failure)throw failure;
  console.log('Saved cold first-use capture to '+options.out);
}

await runPianoColdCapture();
