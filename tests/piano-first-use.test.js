"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { extractFunction } = require("./chip-graph.js");
const body = name => extractFunction(main, name).replace(/\r\n/g, "\n");
const digest = source => createHash("sha256").update(source).digest("hex");

function warmPoolHarness({ cap = 32, existing = 0, active = 0 } = {}) {
  const created = [], events = [], control = { failAt: Infinity, emptyAt: Infinity, gcThrows: false };
  const poly = { maxPolyphony: cap, activeVoices: active, _availableVoices: [], _gcTimeout: 17 };
  let calls = 0;
  const make = () => {
    const voice = { id: created.length, triggerAttack: () => assert.fail("warm must not attack"), triggerAttackRelease: () => assert.fail("warm must not schedule") };
    created.push(voice); return voice;
  };
  for (let i = 0; i < existing; i++) poly._availableVoices.push(make());
  poly._getNextAvailableVoice = () => {
    calls++; events.push(["borrow", calls]);
    if (calls === control.failAt) throw new Error("pool construction failed");
    if (calls === control.emptyAt) return null;
    return poly._availableVoices.shift() || make();
  };
  poly._availableVoices.push = (...voices) => {
    events.push(["return", ...voices]); return Array.prototype.push.apply(poly._availableVoices, voices);
  };
  poly.context = { clearInterval(id) {
    events.push(["clearInterval", id]);
    if (control.gcThrows) throw new Error("GC cancellation failed");
  } };
  const c = vm.createContext({ WeakSet, Math });
  vm.runInContext(`var _pianoWarmPools=null;\n${body("pianoWarmPool")}`, c);
  return { poly, created, events, control, c, calls: () => calls, warm: count => c.pianoWarmPool(poly, count) };
}

function warmGraphHarness() {
  const events = [], pending = [], control = { fieldFails: false, chorusFails: false };
  const pools = Object.fromEntries(["tick", "lead", "pad", "chordSynth"].map(name => [name, warmPoolHarness({ cap: name === "tick" || name === "lead" ? 4 : 32 })]));
  const forbidden = new Proxy({}, { get(_target, key) { assert.fail(`warm entered unrelated gameplay/clock ${String(key)}`); } });
  const math = Object.create(Math); math.random = () => assert.fail("warm consumed Math.random");
  const c = vm.createContext({
    Math: math, WeakSet, Promise, PIANO: true, LOW: true, toneReady: true,
    CFG: { pianoFirstUse: 1, chorus: { on: true }, piano: { hums: true } },
    navigator: { userActivation: { hasBeenActive: true } },
    rawCtx: { state: "running" }, listener: { context: { state: "running" } },
    _humField: { voices: null }, state: forbidden, targets: forbidden, Tone: forbidden, rnd: () => assert.fail("warm consumed rnd"),
    ...Object.fromEntries(Object.entries(pools).map(([name, h]) => [name, h.poly])),
    buildDrums: () => events.push("buildDrums"), chorusEnsure: () => { events.push("chorusEnsure"); return control.chorusFails ? null : {}; },
    pianoFieldBuild(F, ctx) {
      events.push("pianoFieldBuild");
      if (control.fieldFails) return false;
      F.ctx = ctx; F.voices = [{ key: 0 }, { key: 1 }]; return true;
    },
  });
  for (const [name, ctx] of [["raw", c.rawCtx], ["listener", c.listener.context]]) ctx.resume = () => {
    events.push(`${name}.resume`);
    return new Promise((resolve, reject) => pending.push({ name, resolve: () => { ctx.state = "running"; resolve(); }, reject }));
  };
  vm.runInContext(`var _pianoWarmPools=null, _pianoWarmPending=false, _pianoGraphWarm=false;\n${["pianoWarmPool", "pianoWarmGraph", "pianoWarmAfterUnlock"].map(body).join("\n")}`, c);
  return { c, pools, events, pending, control, flush: async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); } };
}

function warmInitHarness({ enabled = true, piano = true, low = true } = {}) {
  const calls = [], raw = { state: "running", resume: () => Promise.resolve() };
  const Tone = { start: () => calls.push("start"), getContext: () => ({ rawContext: raw }) };
  for (const name of ["Volume", "Filter", "Synth", "NoiseSynth", "FMSynth", "PolySynth"]) Tone[name] = function () {
    this.connect = () => this; this.toDestination = () => this;
  };
  const c = vm.createContext({
    Tone, window: { Tone }, PIANO: piano, LOW: low, toneReady: false, audioInit: false, rawCtx: null,
    CFG: { pianoFirstUse: enabled ? 1 : 0, chorus: { on: false } },
    listener: { context: raw }, reverbInput: {}, state: { running: false }, ML_DOOR_CROSS: false,
    ensureListener() {}, scheduleReverbBuild() {}, applyAudioState() {}, pianoPatch: () => ({}),
    pianoWarmAfterUnlock: () => calls.push("warmAfterUnlock"), loadToneOnce: () => Promise.resolve(),
  });
  vm.runInContext(body("initAudio"), c);
  return { c, calls };
}

function warmShaderHarness({ compileMs = 5, throwOn = null, enabled = true, piano = true, low = true } = {}) {
  const created = [], released = [], compiles = [], pending = [], events = [];
  const scene = { children: [] }, camera = {}, lightA = { name: "ambient", isLight: true }, lightB = { name: "sun", isLight: true };
  scene.children.push(lightA, lightB);
  const add = name => { const o = { name, visible: true, parent: scene }; scene.children.push(o); return o; };
  const child = (name, parent) => ({ name, parent, visible: true });
  const decorative = add("decorative"), road = add("road"), wall = add("wall"), arches = add("arches"), vault = add("vault");
  const all = scene.children, representatives = {};
  let now = 0, c;
  const release = (name, o) => {
    events.push(`release:${name}`); released.push(name);
    const index = all.indexOf(o); if (index >= 0) all.splice(index, 1);
    o.parent = null; o.visible = false;
  };
  const math = Object.create(Math); math.random = () => assert.fail("shader warm consumed Math.random directly");
  c = vm.createContext({
    CFG: { pianoFirstUse: enabled ? 1 : 0, shards: 4 }, PIANO: piano, LOW: low, TOXIC: 1,
    scene, camera, state: { started: false, running: false }, Math: math, Set, rnd: () => assert.fail("shader warm consumed rnd"),
    roadMesh: road, roadWall: wall, roadWallAccent: child("wallAccent", wall), roadWallVeil: child("wallVeil", wall),
    roadVault: vault, roadDust: null, roadArch: arches, roadArchAccent: child("archAccent", arches), roadNaveVeil: null,
    performance: { now: () => now },
    renderer: { compile(sc, cam) {
      assert.equal(cam, camera); assert.equal(sc, scene);
      const root = sc.children.at(-1); events.push(`compile:${root.name}`);
      compiles.push({ root, lights: sc.children.slice(0, -1) }); now += compileMs;
      if (root.name === throwOn) throw new Error("driver rejected representative");
    } },
    runIdle: fn => { assert.equal(scene.children, all); events.push("idle"); pending.push(fn); },
    ensureArcObjs() {
      created.push("arc"); const group = add("arc");
      for (const name of ["arcRibbon", "arcLand", "arcPulseA", "arcPulseB", "arcApex"]) c[name] = child(name, group);
    },
    hideArc: () => created.push("hideArc"),
    ensureStarTethers() { created.push("tethers"); c._tethMesh = add("tethers"); },
    ensureTargetMark() { created.push("mark"); const group = add("mark"); return { ring: child("ring", group), drop: child("drop", group) }; },
    acquireTargetMesh() { created.push("target"); return representatives.target = add("target"); },
    releaseTargetMesh: o => release("target", o),
    acquireShards() { created.push("shards"); return { pts: representatives.shards = add("shards") }; },
    releaseShards: o => release("shards", o.pts),
    acquireFlash() { created.push("flash"); return representatives.flash = add("flash"); },
    releaseFlash: o => release("flash", o),
  });
  vm.runInContext(`const WARM_SLICE_MS=40;\n${body("pianoWarmShadersStart")}\n${body("warmShadersStart")}`, c);
  return { c, all, created, released, compiles, events, pending, decorative, representatives,
    start: () => c.warmShadersStart(),
    drain: () => { let n = 0; while (pending.length) { assert.ok(++n < 50, "idle warm remains bounded"); pending.shift()(); assert.equal(scene.children, all); } },
    reacquire: () => { for (const o of Object.values(representatives)) { o.parent = scene; o.visible = true; all.push(o); } },
  };
}

test("first-use gates preserve the complete original shader warm and legacy schedule", () => {
  assert.match(main, /\bpianoFirstUse:1\b/);
  const guard = "  if(CFG.pianoFirstUse && PIANO && LOW){ pianoWarmShadersStart(); return; }\n";
  assert.equal(body("warmShadersStart").split(guard).length, 2);
  assert.equal(digest(body("warmShadersStart").replace(guard, "")), "d79fd4587879081b3f1beeaca193f28ab63f8e79c9ff4a38e87d95023efdb2e1");
  assert.equal(digest(body("warmShaders")), "f99d9ac5af183426a660b58ee7f3c2d834ac5c1468569858c0e47133ed1c2355");
  assert.ok(main.includes("if(CFG.gateFirst) afterGate(warmShadersStart,300,2000); else runIdle(warmShaders,900,4000);"));
});

test("pool warm borrows the requested existing-cap count silently, returns every voice and latches once", () => {
  for (const [cap, count, expected] of [[4, 4, 4], [32, 8, 8], [32, 4, 4], [3, 8, 3]]) {
    const h = warmPoolHarness({ cap, existing: 2 });
    assert.equal(h.warm(count), true); assert.equal(h.created.length, expected);
    assert.equal(h.poly.maxPolyphony, cap); assert.equal(h.poly.activeVoices, 0);
    assert.equal(new Set(h.poly._availableVoices).size, expected);
    assert.ok(h.created.every(v => h.poly._availableVoices.includes(v)));
    assert.equal(h.poly._gcTimeout, -1);
    assert.equal(h.events.at(-1)[0], "clearInterval", "GC stops only after all voices are returned");
    const calls = h.calls(); h.poly.activeVoices = 1;
    assert.equal(h.warm(count), true); assert.equal(h.calls(), calls, "a completed pool is never borrowed again");
  }
});

test("pool warm leaves live or incompatible pools alone and returns partial borrows on failure", () => {
  for (const change of [h => { h.poly.activeVoices = 1; }, h => { delete h.poly._getNextAvailableVoice; }, h => { h.poly._availableVoices = null; }]) {
    const h = warmPoolHarness(); change(h); assert.equal(h.warm(4), false); assert.equal(h.calls(), 0); assert.equal(h.poly._gcTimeout, 17);
  }
  for (const failure of ["failAt", "emptyAt"]) {
    const h = warmPoolHarness(); h.control[failure] = 3;
    assert.equal(h.warm(4), false); assert.equal(h.created.length, 2);
    assert.equal(h.poly._availableVoices.length, 2); assert.equal(h.poly._gcTimeout, 17);
    assert.equal(h.events.some(e => e[0] === "clearInterval"), false);
    h.control[failure] = Infinity;
    assert.equal(h.warm(4), true); assert.equal(h.created.length, 4); assert.equal(h.poly._availableVoices.length, 4);
  }
  const h = warmPoolHarness(); h.control.gcThrows = true;
  assert.equal(h.warm(4), false); assert.equal(h.poly._availableVoices.length, 4); assert.equal(h.poly._gcTimeout, 17);
  h.control.gcThrows = false; assert.equal(h.warm(4), true); assert.equal(h.created.length, 4);
});

test("graph warm requires the accepted gate and both native contexts running", () => {
  for (const change of [h => { h.c.CFG.pianoFirstUse = 0; }, h => { h.c.PIANO = false; }, h => { h.c.LOW = false; },
    h => { h.c.toneReady = false; }, h => { h.c.rawCtx = null; }, h => { h.c.rawCtx.state = "suspended"; },
    h => { h.c.listener = null; }, h => { h.c.listener.context = null; }, h => { h.c.listener.context.state = "suspended"; }]) {
    const h = warmGraphHarness(); change(h);
    assert.equal(h.c.pianoWarmGraph(), false); assert.deepEqual(h.events, []);
    assert.ok(Object.values(h.pools).every(pool => pool.calls() === 0));
  }
});

test("graph warm fills four authored pools and exactly two sphere keys without raising caps or repeating work", () => {
  const h = warmGraphHarness(); assert.equal(h.c.pianoWarmGraph(), true);
  assert.deepEqual(h.events, ["buildDrums", "chorusEnsure", "pianoFieldBuild"]);
  assert.deepEqual(Object.values(h.pools).map(pool => pool.created.length), [4, 4, 8, 4]);
  assert.deepEqual(Object.values(h.pools).map(pool => pool.poly.maxPolyphony), [4, 4, 32, 32]);
  assert.equal(h.c._humField.voices.length, 2); assert.equal(h.c._humField.ctx, h.c.listener.context);
  const voices = h.c._humField.voices;
  assert.equal(h.c.pianoWarmGraph(), true); assert.equal(h.events.length, 3); assert.equal(h.c._humField.voices, voices);
});

test("graph warm retries incomplete pools or sphere construction and preserves preexisting sphere voices", () => {
  const h = warmGraphHarness(); h.pools.pad.control.emptyAt = 1;
  assert.equal(h.c.pianoWarmGraph(), false); assert.equal(h.c._pianoGraphWarm, false);
  const field = h.c._humField.voices, tickBorrows = h.pools.tick.calls();
  h.pools.pad.control.emptyAt = Infinity; assert.equal(h.c.pianoWarmGraph(), true);
  assert.equal(h.c._humField.voices, field); assert.equal(h.pools.tick.calls(), tickBorrows);
  const failed = warmGraphHarness(); failed.control.fieldFails = true;
  assert.equal(failed.c.pianoWarmGraph(), false); failed.control.fieldFails = false; assert.equal(failed.c.pianoWarmGraph(), true);
  const failedChorus = warmGraphHarness(); failedChorus.control.chorusFails = true;
  assert.equal(failedChorus.c.pianoWarmGraph(), false); assert.equal(failedChorus.c._pianoGraphWarm, false);
  failedChorus.control.chorusFails = false; assert.equal(failedChorus.c.pianoWarmGraph(), true);
  assert.equal(failedChorus.events.filter(event => event === "chorusEnsure").length, 2, "failed chorus construction keeps the graph retry open");
  for (const enabled of [false, true]) {
    const existing = warmGraphHarness(), voices = [{ held: true }, { held: true }];
    existing.c._humField.voices = voices; existing.c.CFG.piano.hums = enabled; existing.c.CFG.chorus.on = false;
    assert.equal(existing.c.pianoWarmGraph(), true); assert.equal(existing.c._humField.voices, voices);
    assert.deepEqual(existing.events, ["buildDrums"]);
  }
});

test("unlock warming requires prior activation and waits for both resumes with one pending request", async () => {
  const denied = warmGraphHarness(); denied.c.navigator.userActivation.hasBeenActive = false;
  denied.c.pianoWarmAfterUnlock(); assert.deepEqual(denied.events, []);
  const ready = warmGraphHarness(); ready.c.pianoWarmAfterUnlock(); assert.equal(ready.c._pianoGraphWarm, true); assert.equal(ready.pending.length, 0);
  const h = warmGraphHarness(); h.c.rawCtx.state = "suspended"; h.c.listener.context.state = "suspended";
  h.c.pianoWarmAfterUnlock(); h.c.pianoWarmAfterUnlock();
  assert.equal(h.pending.length, 2); assert.equal(h.c._pianoWarmPending, true); assert.equal(h.c._pianoGraphWarm, false);
  h.pending[0].resolve(); await h.flush(); assert.equal(h.c._pianoGraphWarm, false);
  h.pending[1].resolve(); await h.flush(); assert.equal(h.c._pianoGraphWarm, true); assert.equal(h.c._pianoWarmPending, false);
  assert.deepEqual(h.events, ["raw.resume", "listener.resume", "buildDrums", "chorusEnsure", "pianoFieldBuild"]);
});

test("unlock rejection and synchronous resume failure clear the pending latch for a later gesture", async () => {
  const h = warmGraphHarness(); h.c.rawCtx.state = "suspended";
  h.c.pianoWarmAfterUnlock(); h.pending[0].reject(new Error("autoplay")); h.pending[1].resolve(); await h.flush();
  assert.equal(h.c._pianoWarmPending, false); assert.equal(h.c._pianoGraphWarm, false);
  h.c.pianoWarmAfterUnlock(); assert.equal(h.pending.length, 4);
  h.pending[2].resolve(); h.pending[3].resolve(); await h.flush(); assert.equal(h.c._pianoGraphWarm, true);
  const throwing = warmGraphHarness(); throwing.c.rawCtx.state = "suspended";
  throwing.c.rawCtx.resume = () => { throw new Error("closed context"); };
  throwing.c.pianoWarmAfterUnlock(); assert.equal(throwing.c._pianoWarmPending, false); assert.equal(throwing.c._pianoGraphWarm, false);
});

test("actual initAudio invokes warming after construction and on retries only for the accepted gate", () => {
  for (const options of [{}, { enabled: false }, { piano: false }, { low: false }]) {
    const h = warmInitHarness(options); h.c.initAudio(); h.c.initAudio();
    assert.equal(h.c.audioInit, true); assert.equal(h.c.toneReady, true);
    assert.equal(h.calls.filter(call => call === "start").length, 1);
    assert.equal(h.calls.filter(call => call === "warmAfterUnlock").length, Object.keys(options).length ? 0 : 2);
    if (!Object.keys(options).length) assert.deepEqual(h.calls, ["start", "warmAfterUnlock", "warmAfterUnlock"]);
  }
});

test("shader warm preserves representative creation order, releases pools first, prioritizes night roots and restores the scene", () => {
  const h = warmShaderHarness(); h.start(); h.drain();
  assert.deepEqual(h.created, ["arc", "hideArc", "tethers", "mark", "target", "shards", "flash"]);
  assert.deepEqual(h.released, ["target", "shards", "flash"]);
  assert.deepEqual(h.events.slice(0, 3), ["release:target", "release:shards", "release:flash"]);
  assert.deepEqual(h.compiles.map(item => item.root.name), ["road", "wall", "arches", "vault", "arc", "tethers", "mark", "target", "shards", "flash", "decorative"]);
  assert.ok(h.compiles.every(item => item.lights.map(light => light.name).join(",") === "ambient,sun"));
  assert.equal(h.c.scene.children, h.all);
});

test("shader warm continues only bounded critical work after PLAY and never re-releases reacquired resources", () => {
  const h = warmShaderHarness({ compileMs: 30 }); h.start();
  assert.equal(h.compiles.length, 2, "30 ms links allow two links before yielding the 40 ms slice");
  assert.equal(h.pending.length, 1); assert.deepEqual(h.released, ["target", "shards", "flash"]);
  h.reacquire(); h.c.state.started = true; h.c.state.running = true; h.drain();
  assert.equal(h.compiles.length, 10); assert.equal(h.compiles.some(item => item.root === h.decorative), false);
  assert.equal(new Set(h.compiles.map(item => item.root)).size, 10, "nested critical meshes share one root compile");
  assert.deepEqual(h.released, ["target", "shards", "flash"]);
  assert.ok(Object.values(h.representatives).every(o => o.visible && o.parent === h.c.scene), "PLAY retains its reacquired visible objects");
  const early = warmShaderHarness(); early.c.state.started = true; early.start(); early.drain();
  assert.equal(early.compiles.length, 10); assert.equal(early.compiles.some(item => item.root === early.decorative), false);
});

test("shader driver failure restores scene children and does not duplicate resource releases", () => {
  const h = warmShaderHarness({ throwOn: "wall", compileMs: 30 }); h.start(); h.drain();
  assert.equal(h.c.scene.children, h.all); assert.equal(h.compiles.length, 11);
  assert.deepEqual(h.released, ["target", "shards", "flash"]);
  for (const options of [{ enabled: false }, { piano: false }, { low: false }]) {
    const off = warmShaderHarness(options); off.c.state.started = true; off.start();
    assert.equal(off.compiles.length, 0, "off paths retain PLAY-cancels-warm");
    assert.deepEqual(off.released, ["target", "shards", "flash"]);
  }
});
