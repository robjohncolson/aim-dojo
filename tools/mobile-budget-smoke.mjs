#!/usr/bin/env node
// Real browser integration check. Capability hints and synthetic frame times are
// fixtures; no result here measures a physical phone's GPU, battery, or thermals.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');

const bridge = `
window.__mobileBudgetSmoke={
  token:Math.random().toString(36),
  sample:()=>({budget:DEVICE_BUDGET,bounds:DPR_BOUNDS,dpr:renderDpr,buffer:[canvas.width,canvas.height],view:[viewW,viewH],
    weak:WEAK,mobile:MOBILE,low:LOW,running:state.running,renderFps,panning:PIANO_PANNING,milkyReady:_milkyReady,
    deviceDpr:DEVICE_DPR,cores:navigator.hardwareConcurrency,memory:navigator.deviceMemory,
    renderer:renderer.getContext().getParameter(renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||renderer.getContext().RENDERER),
    settings:{performance:gid('performanceSelect').value,frames:gid('renderFpsSelect').value},
    image:milkyShell?.material?.map?.image?{width:milkyShell.material.map.image.width,height:milkyShell.material.map.image.height}:null}),
  loadBodies:async()=>Promise.all(['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'].map(id=>new Promise((resolve,reject)=>{
    const url=SKY_MAPS.mapForBody(id,{venusMap:CFG.skyMaps.venusMap,textureTier:DEVICE_BUDGET.textureTier});
    loadSkyTexture(url,tex=>resolve({id,url,width:tex.image.width,height:tex.image.height}),()=>reject(Error('Texture failed: '+url)));
  }))),
  slowThenPause:()=>{
    const before=renderDpr,wasRunning=state.running;state.running=true;
    for(let i=0;i<160;i++)updateRenderQuality(.05);
    const during=renderDpr,pending=renderQuality.pending;state.running=false;updateRenderQuality(.016);
    const after=renderDpr;state.running=wasRunning;return {before,during,pending,after,buffer:[canvas.width,canvas.height]};
  },
  pauseCard:()=>{state.started=true;soundOn=false;exitRunning();},
  drive:(fps)=>{
    const original={raf:window.requestAnimationFrame,delta:clock.getDelta,render:renderer.render,poll:pollGamepad,projectiles:updateProjectiles,hum:humFieldUpdate,
      camera:camera.updateMatrixWorld,draw:drawWasdLane,running:state.running,sound:soundOn,frames:renderFps};
    const count={render:0,reflection:0,input:0,projectiles:0,hum:0,camera:0,hud:0},audioBefore=_audioFrame,timeBefore=state.t;
    try{
      window.requestAnimationFrame=()=>0;clock.getDelta=()=>1/120;
      renderer.render=function(s,c){if(c===camera)count.render++;if(c===mirrorCam)count.reflection++;};
      pollGamepad=function(...a){count.input++;return original.poll(...a);};
      updateProjectiles=function(...a){count.projectiles++;return original.projectiles(...a);};
      humFieldUpdate=function(...a){count.hum++;return original.hum(...a);};
      camera.updateMatrixWorld=function(...a){count.camera++;return original.camera.apply(this,a);};
      drawWasdLane=function(...a){count.hud++;return original.draw(...a);};
      state.running=true;soundOn=false;renderFps=fps;renderGate.setFps(fps);
      if(!LOW){renderFrameDue=false;lastReflT=-999;renderReflection();count.reflectionQueued=reflectionPending;}
      for(let i=0;i<120;i++){animate(100000+i*1000/120);if(!i&&!LOW)count.firstDrawFlushedReflection=!reflectionPending;}
      return {...count,audioFrames:_audioFrame-audioBefore,simulationSeconds:state.t-timeBefore,fps,callbacks:120};
    }finally{
      window.requestAnimationFrame=original.raf;clock.getDelta=original.delta;renderer.render=original.render;
      pollGamepad=original.poll;updateProjectiles=original.projectiles;humFieldUpdate=original.hum;
      camera.updateMatrixWorld=original.camera;drawWasdLane=original.draw;state.running=original.running;soundOn=original.sound;
      renderFps=original.frames;renderGate.setFps(renderFps);
    }
  }
};
`;

async function run() {
  const options = {root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out: null,
    modules: process.env.COLDLOAD_MODULES || 'C:/Users/rober/AppData/Local/Temp/aim-dojo-parcel-e-puppeteer/node_modules',
    chrome: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i].replace(/^--/, '');
    if (!Object.hasOwn(options, key) || !process.argv[i + 1]) throw Error('Unknown or incomplete option: ' + process.argv[i]);
    options[key] = process.argv[++i];
  }
  options.root = path.resolve(options.root);
  if (!options.out) throw Error('Pass a new --out directory');
  options.out = path.resolve(options.out);
  if (fs.existsSync(options.out) || options.out.split(path.sep).some(part => part.toLowerCase() === 'state')) throw Error('Output must be new and outside state/');
  const files = Object.fromEntries(['index.html','aim-dojo-main.js','device-budget.js','sky-maps.js'].map(file => [file, fs.readFileSync(path.join(options.root,file))]));
  const source = files['aim-dojo-main.js'].toString('utf8'), boundary = source.indexOf('if(CFG.gateFirst) afterGate(warmShadersStart');
  if (boundary < 0) throw Error('Runtime bootstrap boundary changed');
  const served = source.slice(0,boundary)+bridge+'\n'+source.slice(boundary);
  new vm.Script(served, {filename:'mobile-budget-smoke-runtime.js'});
  const manifest = {started:new Date().toISOString(),sourceHashes:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,hash(bytes)])),
    bridgeSha256:hash(bridge),harnessSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),
    classification:'Functional browser integration with simulated capability hints, no mobile or GPU performance claims.',
    limits:['Fresh isolated browser contexts; no user profile or state/ access. External account/API requests blocked.',
      'Synthetic 120 Hz exercise calls actual animate with a fixed clock and sound off; only the renderer submission is counted instead of executed. Real rendering is separately checked at boot and pause.',
      'Slow-frame samples are injected into the actual quality monitor. They establish pause-only buffer changes, not a device performance measurement.']};
  fs.mkdirSync(options.out,{recursive:true});
  const save=(name,value)=>fs.writeFileSync(path.join(options.out,name),JSON.stringify(value,null,2)+'\n');
  save('manifest.json',manifest);
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
  let browser;
  const profiles=[
    {name:'desktop',query:'',mobile:false,cores:16,memory:16},
    {name:'coarse-phone',query:'',mobile:true,cores:4,memory:4},
    {name:'narrow-phone',query:'',mobile:true,cores:4,memory:4,width:320},
    {name:'manual-lean',query:'?performance=lean',mobile:false,cores:16,memory:16},
    {name:'full',query:'?performance=full',mobile:true,cores:4,memory:4},
    {name:'smooth-lean',query:'?hi&performance=lean&renderfps=60',mobile:false,cores:16,memory:16},
  ],captures=[];
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const puppeteer=createRequire(path.join(path.resolve(options.modules),'package.json'))('puppeteer-core');
    browser=await puppeteer.launch({executablePath:options.chrome,headless:true,args:['--no-first-run','--disable-background-networking','--autoplay-policy=no-user-gesture-required']});
    manifest.browser=await browser.version();
    for(const profile of profiles){
      const context=await browser.createBrowserContext(),page=await context.newPage();
      const capture={profile,pageErrors:[],consoleErrors:[],denied:[],requested:[],failed:[],httpErrors:[]};captures.push(capture);
      await page.setViewport(profile.mobile?{width:profile.width||390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true}:{width:1100,height:720,deviceScaleFactor:1});
      await page.evaluateOnNewDocument(({cores,memory})=>{
        Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>cores});
        Object.defineProperty(navigator,'deviceMemory',{get:()=>memory});
      },profile);
      page.on('pageerror',error=>capture.pageErrors.push(String(error.stack||error)));
      page.on('console',message=>{if(message.type()==='error')capture.consoleErrors.push(message.text());});
      page.on('requestfailed',request=>capture.failed.push({url:request.url(),error:request.failure()?.errorText}));
      page.on('response',response=>{if(response.status()>=400)capture.httpErrors.push({url:response.url(),status:response.status()});});
      await page.setRequestInterception(true);
      const external=new Set(['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js']);
      page.on('request',request=>{
        const url=new URL(request.url());
        if(url.origin===origin)capture.requested.push(url.pathname);
        if(['GET','HEAD'].includes(request.method())&&(url.origin===origin||external.has(request.url())||['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)||url.protocol==='data:'))return request.continue();
        capture.denied.push({method:request.method(),origin:url.origin,path:url.pathname});
        return request.respond({status:404,headers:{'access-control-allow-origin':'*'},body:''});
      });
      await page.goto(origin+'/'+profile.query,{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>window.__mobileBudgetSmoke&&window.__mobileBudgetSmoke.sample().milkyReady,{timeout:60000});
      capture.boot=await page.evaluate(()=>window.__mobileBudgetSmoke.sample());
      const expectedCompact=profile.query.includes('lean')||(profile.name!=='full'&&(profile.mobile||capture.boot.weak));
      assert.equal(capture.boot.budget.textureTier,expectedCompact?'compact':'full');
      assert.equal(capture.boot.mobile,profile.mobile);
      assert.equal(capture.boot.low,profile.name!=='smooth-lean');
      assert.equal(capture.boot.dpr,capture.boot.bounds.start);
      assert.equal(capture.boot.buffer[0],Math.floor(capture.boot.view[0]*capture.boot.dpr));
      assert.equal(capture.boot.buffer[1],Math.floor(capture.boot.view[1]*capture.boot.dpr));
      assert.equal(capture.boot.image.width,expectedCompact?1024:3072);
      capture.bodies=await page.evaluate(()=>window.__mobileBudgetSmoke.loadBodies());
      assert(capture.bodies.every(body=>body.url.includes('/compact/')===expectedCompact));
      assert(capture.bodies.every(body=>body.width===(expectedCompact?512:2048)));
      const skyRequests=capture.requested.filter(url=>url.startsWith('/assets/sky/')&&/\.jpg$/.test(url)&&!url.includes('/zodiac/'));
      assert(skyRequests.length>=11,'Expected Milky Way and all ten body image requests');
      assert(skyRequests.every(url=>url.includes('/compact/')===expectedCompact),'Mixed compact/full resident sky assets');
      await page.screenshot({path:path.join(options.out,profile.name+'-boot.png')});
      capture.quality=await page.evaluate(()=>window.__mobileBudgetSmoke.slowThenPause());
      assert.equal(capture.quality.during,capture.quality.before,'Resolution changed during play');
      assert(capture.quality.after<=capture.quality.before);
      if(capture.boot.dpr>capture.boot.bounds.min+.01)assert(capture.quality.after<capture.quality.before,'Slow evidence did not reduce DPR on pause');
      assert.equal(capture.quality.buffer[0],Math.floor(capture.boot.view[0]*capture.quality.after));
      await page.evaluate(()=>window.__mobileBudgetSmoke.pauseCard());
      await page.waitForSelector('#renderFpsSelect',{visible:true});
      const token=await page.evaluate(()=>window.__mobileBudgetSmoke.token);
      await page.select('#renderFpsSelect','60');
      assert.equal(await page.evaluate(()=>window.__mobileBudgetSmoke.sample().renderFps),60);
      await page.select('#renderFpsSelect','native');
      assert.equal(await page.evaluate(()=>window.__mobileBudgetSmoke.sample().renderFps),0);
      assert.equal(await page.evaluate(()=>window.__mobileBudgetSmoke.token),token,'Frame-rate setting unexpectedly reloaded');
      assert.equal(await page.evaluate(()=>localStorage.getItem('aimdojo.renderFps')),'native');
      capture.liveSettings=await page.evaluate(()=>window.__mobileBudgetSmoke.sample());
      capture.controls=await page.evaluate(()=>['performanceSelect','renderFpsSelect'].map(id=>{
        const element=document.getElementById(id),r=element.getBoundingClientRect(),row=element.parentElement.getBoundingClientRect();
        return {id,left:r.left,right:r.right,width:r.width,height:r.height,rowLeft:row.left,rowRight:row.right,viewport:innerWidth};
      }));
      assert(capture.controls.every(control=>control.width>100&&control.height>=30&&control.left>=control.rowLeft-1&&control.right<=control.rowRight+1&&control.right<=control.viewport));
      if(profile.name==='desktop'||profile.name==='smooth-lean'){
        capture.synthetic=[];
        for(const fps of [60,0]){
          const sample=await page.evaluate(value=>window.__mobileBudgetSmoke.drive(value),fps);capture.synthetic.push(sample);
          assert.equal(sample.render,fps===60?60:120);assert.equal(sample.hud,sample.render);
          assert.equal(sample.input,120);assert.equal(sample.projectiles,120);assert.equal(sample.audioFrames,120);
          assert.equal(sample.hum,120);assert(sample.camera>=120);assert(Math.abs(sample.simulationSeconds-1)<1e-8);
          if(profile.name==='smooth-lean'){assert(sample.reflectionQueued);assert(sample.firstDrawFlushedReflection);assert(sample.reflection>=1);}
        }
      }
      await page.screenshot({path:path.join(options.out,profile.name+'-pause.png')});
      const next=profile.name==='manual-lean'?'full':'lean';
      await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:60000}),page.select('#performanceSelect',next)]);
      await page.waitForFunction(()=>window.__mobileBudgetSmoke&&window.__mobileBudgetSmoke.sample().milkyReady,{timeout:60000});
      capture.reloaded=await page.evaluate(()=>({sample:window.__mobileBudgetSmoke.sample(),token:window.__mobileBudgetSmoke.token,pref:localStorage.getItem('aimdojo.performance')}));
      assert.notEqual(capture.reloaded.token,token);assert.equal(capture.reloaded.pref,next);assert.equal(capture.reloaded.sample.budget.mode,next);
      assert.equal(capture.reloaded.sample.renderFps,0,'Live frame choice did not persist across reload');
      assert.equal(capture.reloaded.sample.budget.textureTier,next==='lean'?'compact':'full');
      await page.evaluate(()=>window.__mobileBudgetSmoke.pauseCard());
      await page.waitForSelector('#renderFpsSelect',{visible:true});
      capture.reloadedVisible=await page.evaluate(()=>window.__mobileBudgetSmoke.sample());
      assert.equal(capture.reloadedVisible.settings.performance,next,'Visible budget selector disagrees after reload');
      assert.equal(capture.reloadedVisible.settings.frames,'native','Visible frame selector disagrees after reload');
      assert.deepEqual(capture.pageErrors,[]);
      assert(!capture.consoleErrors.some(error=>/shader error|validate_status|referenceerror|typeerror|syntaxerror/i.test(error)));
      assert(!capture.httpErrors.some(error=>new URL(error.url).origin===origin&&/\/assets\/sky\/.*\.jpg$/.test(new URL(error.url).pathname)&&!error.url.includes('/zodiac/')),'A required sky image failed');
      save(profile.name+'.json',capture);
      await context.close();
      console.log(profile.name+': passed');
    }
    manifest.status='passed';manifest.completed=new Date().toISOString();
  }catch(error){manifest.status='failed';manifest.failure=String(error.stack||error);throw error;}
  finally{
    save('manifest.json',manifest);save('captures.json',captures);
    if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
  console.log('Saved browser integration checks to '+options.out);
}

await run();
