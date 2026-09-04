"use strict";

// THE GATE FIRST (SPEC_THE_INVITATION parcel C, load scheduling): PLAY lights as soon as Tone is fetchable; the shader
// warm is chunked into idle slices; every heavy boot job queues behind the gate. gateFirst:0 keeps the wave-18 order.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function extract(re, what) { const m = html.match(re); assert.ok(m, what + " is extractable"); return m[0]; }

test("Tone is preloaded from the head with the exact URL loadScriptOnce will request", () => {
  const toneUrl = extract(/const TONE_JS='([^']+)';/, "TONE_JS").match(/'([^']+)'/)[1];
  const head = html.slice(0, html.indexOf("</head>"));
  assert.ok(head.includes(`<link rel="preload" as="script" href="${toneUrl}">`), "one preload link, same URL, no crossorigin (the script tag has none either)");
});

test("every heavy boot job queues behind the gate; the gate resolves once, on the first ready", () => {
  for (const site of [
    "else afterGate(()=>{ loadSticks().then(c=>{",
    "if(SKY_MODE!=='decorative') afterGate(()=>{ loadSkyGlossary(); },140,1600);",
    "if(SKY_MODE!=='decorative') afterGate(()=>{ loadSkyDay().then(p=>{",
    "afterGate(()=>{ initSaveMySky(); },320,2400);",
    "if(SKY_MODE==='clocked_chart') afterGate(()=>{ loadSkypack().then(p=>{",
    "afterGate(()=>{ setTimeout(()=>{ loadDojoBoard(); renderDojoBests(); loadRealtimeClient(); }, 1100); },0,0);",
    "if(CFG.gateFirst) afterGate(warmShadersStart,300,2000); else runIdle(warmShaders,900,4000);",
  ]) assert.ok(html.includes(site), "boot site is gate-sequenced: " + site.slice(0, 60));
  assert.match(html, /const afterGate=\(fn,delay,timeout\)=>\{ if\(!CFG\.gateFirst\)\{ runIdle\(fn,delay,timeout\); return; \} _gateReady\.then/, "afterGate's off arm is runIdle verbatim");
  const gate = extract(/function setGateReady\(ready\)\{[\s\S]*?\n\}/, "setGateReady");
  assert.match(gate, /if\(ready && _gateReadyResolve\)\{ const r=_gateReadyResolve; _gateReadyResolve=null;/, "resolve-once");
  assert.match(gate, /beginTrainBtn\.disabled=!ready;/, "the button law is untouched");
});

test("the chunked warm links every top-level child once, lights riding along, restores the scene, and stops when PLAY beats it", () => {
  const WARM = extract(/const WARM_SLICE_MS=40;[^\n]*\n/, "WARM_SLICE_MS") + extract(/function warmShadersStart\(\)\{[\s\S]*?\n\}/, "warmShadersStart");
  const run = ({ compileMs, playAfterSlice = Infinity, throwOn = null }) => {
    const log = { compiles: [], released: [], idle: 0, restored: [] };
    const lights = [{ isLight: true, name: "amb" }, { isLight: true, name: "sun" }];
    const kids = ["road", "walls", "arches", "dome", "floor"].map((name) => ({ name }));
    const all = lights.concat(kids);
    let now = 0, slices = 0;
    const ctx = vm.createContext({
      log, TOXIC: 1, CFG: { shards: 4 }, state: { started: false, running: false }, camera: {},
      scene: { children: all },
      performance: { now: () => now },
      renderer: { compile: (sc) => { const names = sc.children.map((o) => o.name); if (throwOn && names.includes(throwOn)) throw new Error("driver"); log.compiles.push(names); now += compileMs; } },
      runIdle: (fn) => { log.idle++; slices++; if (slices >= playAfterSlice) ctx.state.started = true; fn(); },
      ensureArcObjs() {}, hideArc() {}, ensureStarTethers() {}, ensureTargetMark: () => ({ ring: {}, drop: {} }),
      acquireTargetMesh: () => ({}), releaseTargetMesh: () => log.released.push("target"),
      acquireShards: () => ({ pts: {} }), releaseShards: () => log.released.push("shards"),
      acquireFlash: () => ({}), releaseFlash: () => log.released.push("flash"),
    });
    new vm.Script(WARM + "\nwarmShadersStart(); log.final=scene.children;").runInContext(ctx);
    return { ...log, all };
  };
  const fast = run({ compileMs: 5 });
  assert.equal(fast.compiles.length, 5, "each non-light child compiled exactly once");
  assert.ok(fast.compiles.every((c) => c[0] === "amb" && c[1] === "sun" && c.length === 3), "every chunk is lights + one child");
  assert.equal(fast.idle, 0, "5 ms links fit one 40 ms slice");
  assert.deepEqual(fast.released, ["target", "shards", "flash"], "parked kinds released once, at the end");
  assert.equal(fast.final, fast.all, "the scene's own children array is back");
  const slow = run({ compileMs: 30 });
  assert.equal(slow.compiles.length, 5);
  assert.equal(slow.idle, 2, "30 ms links → two per slice → two yields");
  const interrupted = run({ compileMs: 30, playAfterSlice: 1 });
  assert.equal(interrupted.compiles.length, 2, "PLAY after the first slice: the rest is never linked");
  assert.deepEqual(interrupted.released, ["target", "shards", "flash"], "and the parked kinds are released immediately");
  assert.equal(interrupted.final, interrupted.all);
  const thrown = run({ compileMs: 5, throwOn: "arches" });
  assert.equal(thrown.compiles.length, 4, "a throwing family is skipped");
  assert.equal(thrown.final, thrown.all, "the children array is restored even when the driver throws");
  assert.deepEqual(thrown.released, ["target", "shards", "flash"]);
});

test("gateFirst:0 keeps the wave-18 warm verbatim", () => {
  const warm = extract(/function warmShaders\(\)\{[\s\S]*?\n\}/, "warmShaders");
  assert.match(warm, /renderer\.compile\(scene, camera\)/, "one synchronous whole-scene compile still exists for the off arm");
  assert.ok(html.includes("else runIdle(warmShaders,900,4000);"), "and is scheduled exactly as before");
});
