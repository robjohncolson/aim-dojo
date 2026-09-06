#!/usr/bin/env node
// Functional DOM/rendering fixtures in isolated browser contexts. This is not a
// GPU benchmark or an end-to-end timing/audio audition on a physical device.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const bridge=`
window.__streakGraceSmoke={
  prepare:()=>{
    state.running=true;state.started=true;state.t=100;state.bpm=28;
    trainMode=false;templeActive=false;bonusActive=false;soundOn=false;
    CFG.streakFlow=true;CFG.streakGrace=true;CFG.streakMissLimit=2;
    CFG.wasdRhythm=true;CFG.grooveGroove=true;CFG.grooveVuln=true;CFG.wasdHud=true;
    _wasdCombo=0;_pipSetN=0;_pipSetFlashT=-999;resetWasdStreakNotice();resetStreakFlow();
    overlay.classList.add('hidden');document.body.classList.remove('overlay-paused');
    if(window.Tone){toneReady=true;Tone.Transport.start();}
    showWasdGlyph(0,false,true,false,-1);
    return window.__streakGraceSmoke.paint();
  },
  credit:(n)=>{for(let i=0;i<n;i++)_wasdResolve(0,true,.2);return window.__streakGraceSmoke.paint();},
  miss:()=>{wasdStreakMiss();return window.__streakGraceSmoke.paint();},
  elapsed:(seconds)=>{state.t+=seconds;return window.__streakGraceSmoke.paint();},
  hud:(enabled)=>{CFG.wasdHud=enabled;return window.__streakGraceSmoke.paint();},
  mode:(name,enabled)=>{
    if(name==='pause')state.running=!enabled;
    if(name==='temple')templeActive=enabled;
    if(name==='bonus')bonusActive=enabled;
    if(name==='lesson')trainMode=enabled;
    return window.__streakGraceSmoke.paint();
  },
  paint:()=>{
    updateStreakFlow(.1);updateWasdStreakNotice();drawWasdLane();renderPrimary(false,false);
    return window.__streakGraceSmoke.sample();
  },
  sample:()=>{
    const el=document.getElementById('streakNotice'),rect=el.getBoundingClientRect(),style=getComputedStyle(el);
    const glyph=document.getElementById('wasdGlyph'),gr=glyph?.getBoundingClientRect();
    return {combo:_wasdCombo,sets:_pipSetN,notice:{..._streakNotice},flow:streakFlowLevel(),open:streakFlowOpen(),
      glow:_flowGlow.value,low:LOW,mobile:MOBILE,reduced:reduceMotion,hud:CFG.wasdHud,
      shown:el.classList.contains('on'),title:document.getElementById('streakNoticeTitle').textContent,
      count:document.getElementById('streakNoticeCount').textContent,hint:document.getElementById('streakNoticeHint').textContent,
      box:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height},
      viewport:{width:innerWidth,height:innerHeight},visibility:style.visibility,opacity:style.opacity,
      glyph:gr?{left:gr.left,right:gr.right,top:gr.top,bottom:gr.bottom}:null,
      center:{x:innerWidth/2,y:innerHeight/2},transition:style.transitionDuration};
  }
};
`;

async function run(){
  const options={root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out:null,
    modules:process.env.COLDLOAD_MODULES||'C:/Users/rober/AppData/Local/Temp/aim-dojo-parcel-e-puppeteer/node_modules',
    chrome:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'};
  for(let i=2;i<process.argv.length;i++){
    const key=process.argv[i].replace(/^--/,'');
    if(!Object.hasOwn(options,key)||!process.argv[i+1])throw Error('Unknown or incomplete option: '+process.argv[i]);
    options[key]=process.argv[++i];
  }
  options.root=path.resolve(options.root);
  if(!options.out)throw Error('Pass a new --out directory');
  options.out=path.resolve(options.out);
  if(fs.existsSync(options.out)||options.out.split(path.sep).some(part=>part.toLowerCase()==='state'))throw Error('Output must be new and outside state/');
  const files=Object.fromEntries(['index.html','aim-dojo-main.js','device-budget.js'].map(file=>[file,fs.readFileSync(path.join(options.root,file))]));
  const source=files['aim-dojo-main.js'].toString('utf8'),boundary=source.indexOf('if(CFG.gateFirst) afterGate(warmShadersStart');
  if(boundary<0)throw Error('Runtime bootstrap boundary changed');
  const served=source.slice(0,boundary)+bridge+'\n'+source.slice(boundary);
  new vm.Script(served,{filename:'streak-grace-smoke-runtime.js'});
  fs.mkdirSync(options.out,{recursive:true});
  const save=(name,value)=>fs.writeFileSync(path.join(options.out,name),JSON.stringify(value,null,2)+'\n');
  const manifest={started:new Date().toISOString(),sourceHashes:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,hash(bytes)])),
    bridgeSha256:hash(bridge),harnessSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),
    classification:'Real DOM and WebGL rendering with in-memory grading fixtures; no phone/GPU performance claims.',
    limits:['Fresh isolated browser contexts; no user profile or state/ reads. Account and API requests blocked.',
      'Animation-frame scheduling is stopped before runtime boot. The bridge calls actual grading, Flow, HUD and renderer functions with controlled gameplay state.',
      'The mobile profile is a responsive layout check of a synthetically earned WASD streak, not a claim about touch input or physical-device performance.']};
  const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.css':'text/css'};
  const server=http.createServer((request,response)=>{
    const relative=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname).replace(/^\//,'')||'index.html';
    const file=path.resolve(options.root,relative);
    if(!['GET','HEAD'].includes(request.method)||!file.startsWith(options.root+path.sep)||!(relative==='index.html'||/^[\w-]+\.js$/.test(relative)||/^(assets|fixtures|data)\//.test(relative))){response.writeHead(404).end();return;}
    const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'};
    if(relative==='aim-dojo-main.js'){response.writeHead(200,headers).end(served);return;}
    if(files[relative]){response.writeHead(200,headers).end(files[relative]);return;}
    fs.readFile(file,(error,bytes)=>{if(error)response.writeHead(404).end();else response.writeHead(200,headers).end(bytes);});
  });
  const profiles=[
    {name:'low',query:'?low',width:1280,height:800},
    {name:'high',query:'?hi',width:1280,height:800},
    {name:'reduced',query:'?low',width:1100,height:720,reduced:true},
    {name:'narrow',query:'?low',width:320,height:568},
    {name:'landscape',query:'?low',width:568,height:320},
    {name:'mobile',query:'?performance=lean',width:390,height:844,mobile:true},
  ];
  let browser;const captures=[];
  const visibleNotice=sample=>{
    assert.equal(sample.shown,true);assert.equal(sample.visibility,'visible');
    assert(sample.box.width>100&&sample.box.height>40,'Notice needs a readable surface');
    assert(sample.box.left>=0&&sample.box.right<=sample.viewport.width,'Notice extends horizontally beyond the viewport');
    assert(sample.box.top>=0&&sample.box.bottom<=sample.viewport.height,'Notice extends vertically beyond the viewport');
    assert(sample.box.bottom<sample.center.y-46,'Warning covers the central hit circle or aiming letter');
  };
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const puppeteer=createRequire(path.join(path.resolve(options.modules),'package.json'))('puppeteer-core');
    browser=await puppeteer.launch({executablePath:options.chrome,headless:true,args:['--no-first-run','--disable-background-networking','--autoplay-policy=no-user-gesture-required']});
    manifest.browser=await browser.version();
    for(const profile of profiles){
      const context=await browser.createBrowserContext(),page=await context.newPage();
      const capture={profile,pageErrors:[],consoleErrors:[],denied:[]};captures.push(capture);
      await page.setViewport({width:profile.width,height:profile.height,deviceScaleFactor:profile.mobile?3:1,isMobile:!!profile.mobile,hasTouch:!!profile.mobile});
      if(profile.reduced)await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
      await page.evaluateOnNewDocument(()=>{
        window.requestAnimationFrame=callback=>{window.__streakScheduledFrame=callback;return 1;};
        Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});
        Object.defineProperty(navigator,'deviceMemory',{get:()=>4});
      });
      page.on('pageerror',error=>capture.pageErrors.push(String(error.stack||error)));
      page.on('console',message=>{if(message.type()==='error')capture.consoleErrors.push(message.text());});
      await page.setRequestInterception(true);
      const external=new Set(['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js']);
      page.on('request',request=>{
        const url=new URL(request.url());
        if(['GET','HEAD'].includes(request.method())&&(url.origin===origin||external.has(request.url())||['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)||url.protocol==='data:'))return request.continue();
        capture.denied.push({method:request.method(),origin:url.origin,path:url.pathname});
        return request.respond({status:404,headers:{'access-control-allow-origin':'*'},body:''});
      });
      await page.goto(origin+'/'+profile.query,{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>window.__streakGraceSmoke&&window.Tone,{timeout:60000});
      capture.initial=await page.evaluate(()=>window.__streakGraceSmoke.prepare());
      assert.equal(capture.initial.shown,false);
      assert.equal(capture.initial.low,profile.name!=='high');
      assert.equal(capture.initial.mobile,!!profile.mobile);
      if(profile.reduced)assert.equal(capture.initial.reduced,true);
      capture.earned=await page.evaluate(()=>window.__streakGraceSmoke.credit(16));
      assert.equal(capture.earned.combo,16);assert.equal(capture.earned.flow,1);assert.equal(capture.earned.open,true);
      capture.warning=await page.evaluate(()=>window.__streakGraceSmoke.miss());
      visibleNotice(capture.warning);
      assert.equal(capture.warning.title,'STREAK AT RISK');assert.equal(capture.warning.count,'1 / 2');
      assert.equal(capture.warning.combo,16);assert.equal(capture.warning.open,true);assert.equal(capture.warning.notice.misses,1);
      if(profile.reduced)assert.equal(capture.warning.transition,'0s');
      await page.screenshot({path:path.join(options.out,profile.name+'-warning.png')});
      capture.recovered=await page.evaluate(()=>window.__streakGraceSmoke.credit(1));
      assert.equal(capture.recovered.combo,17);assert.equal(capture.recovered.shown,false);assert.equal(capture.recovered.notice.misses,0);
      await page.evaluate(()=>window.__streakGraceSmoke.credit(15));
      capture.warning32=await page.evaluate(()=>window.__streakGraceSmoke.miss());
      assert.equal(capture.warning32.combo,32);assert.equal(capture.warning32.notice.hits,32);
      capture.hiddenHud=await page.evaluate(()=>window.__streakGraceSmoke.hud(false));
      visibleNotice(capture.hiddenHud);assert.equal(capture.hiddenHud.hud,false);
      capture.modes=[];
      for(const name of ['pause','temple','bonus','lesson']){
        const hidden=await page.evaluate(name=>window.__streakGraceSmoke.mode(name,true),name);
        assert.equal(hidden.shown,false,name+' must hide warnings');
        assert.equal(hidden.notice.misses,1,name+' must not spend a warning');
        const restored=await page.evaluate(name=>window.__streakGraceSmoke.mode(name,false),name);
        visibleNotice(restored);assert.equal(restored.notice.misses,1);
        capture.modes.push({name,hidden,restored});
      }
      await page.evaluate(()=>window.__streakGraceSmoke.hud(true));
      capture.ended=await page.evaluate(()=>window.__streakGraceSmoke.miss());
      visibleNotice(capture.ended);
      assert.equal(capture.ended.combo,0);assert.equal(capture.ended.sets,0);
      assert.equal(capture.ended.title,'STREAK ENDED');assert.equal(capture.ended.count,'32');assert.equal(capture.ended.hint,'CORRECT HITS');
      assert.equal(capture.ended.open,true,'The existing quarter-beat launch grace starts on the terminal miss');
      await page.screenshot({path:path.join(options.out,profile.name+'-ended.png')});
      capture.newRing=await page.evaluate(()=>window.__streakGraceSmoke.credit(1));
      assert.equal(capture.newRing.combo,1);assert.equal(capture.newRing.count,'32');assert.equal(capture.newRing.notice.hits,32);
      capture.expired=await page.evaluate(()=>window.__streakGraceSmoke.elapsed(2.401));
      assert.equal(capture.expired.shown,false);assert.equal(capture.expired.open,false);
      assert.deepEqual(capture.pageErrors,[]);
      assert(!capture.consoleErrors.some(error=>/shader error|validate_status|referenceerror|typeerror|syntaxerror/i.test(error)));
      save(profile.name+'.json',capture);await context.close();console.log(profile.name+': passed');
    }
    manifest.status='passed';manifest.completed=new Date().toISOString();
  }catch(error){manifest.status='failed';manifest.failure=String(error.stack||error);throw error;}
  finally{save('manifest.json',manifest);save('captures.json',captures);if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
  console.log('Saved streak browser checks to '+options.out);
}

await run();
