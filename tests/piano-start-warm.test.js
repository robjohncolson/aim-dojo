"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { extractFunction } = require("./chip-graph.js");

// Actual startRun, enterRunning, warming helpers and input/modal guard. Only native resume,
// construction, DOM and timers are controlled; these tests never run a real clock or profile.
function startWarmHarness({ mobile = true, rawState = "running", listenerState = "suspended", poolApi = true } = {}) {
  const events = [], requests = [], timers = new Map(), timerHistory = new Map();
  const control = { throwResume: null };
  let now = 0, timerId = 0, c;
  const native = name => ({ state: name === "raw" ? rawState : listenerState, resume() {
    events.push(`${name}.resume`);
    if (control.throwResume === name) throw new Error("resume threw");
    let resolvePromise, rejectPromise;
    const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
    const request = { name, settled: false,
      resolve: (running = true) => { if (running) this.state = "running"; request.settled = true; resolvePromise(); },
      reject: () => { request.settled = true; rejectPromise(new Error("resume denied")); },
    };
    requests.push(request);
    if (this.state === "running") request.resolve();
    return promise;
  } });
  const rawCtx = native("raw"), listenerContext = native("listener");
  const pool = cap => {
    const poly = { maxPolyphony: cap, activeVoices: 0, _availableVoices: [], _gcTimeout: -1 };
    if (poolApi) poly._getNextAvailableVoice = () => poly._availableVoices.shift() || { silent: true };
    return poly;
  };
  const document = { hidden: false, activeElement: null, body: { classList: { remove: () => events.push("unpauseDOM") } } };
  c = vm.createContext({
    Promise, WeakSet, Math, document, window: { Tone: {} }, navigator: { userActivation: { hasBeenActive: true } },
    CFG: { pianoFirstUse: 1, chorus: { on: false }, piano: { hums: true } },
    PIANO: true, LOW: true, MOBILE: mobile, toneReady: true, rawCtx, listener: { context: listenerContext },
    state: { started: false, needsReset: true, running: false }, templeActive: false,
    _runNeedsRelock: true, _lockReqPending: false, _themeReveal: false, _templeResumeWanted: false,
    trainMode: false, trainCoachEl: null, _humField: { voices: null },
    tick: pool(4), lead: pool(4), pad: pool(32), chordSynth: pool(32),
    buildDrums: () => events.push("buildDrums"), chorusEnsure: () => ({}),
    pianoFieldBuild(F, ctx) { events.push("sphereWarm"); F.ctx = ctx; F.voices = [{}, {}]; return true; },
    initAudio: () => events.push("initAudio"), loadToneOnce: () => Promise.resolve(),
    showToneBlock: reason => events.push(`block:${reason}`), cancelLockRetry: () => events.push("cancelLockRetry"),
    canvas: {}, performance: { now: () => now },
    setTimeout(fn, delay) { const id = ++timerId, timer = { fn, at: now + delay, delay }; timers.set(id, timer); timerHistory.set(id, timer); return id; },
    clearTimeout: id => timers.delete(id),
    gid: () => null, settingsBox: { style: { display: "none" } },
    resetSession: () => events.push(`reset:${vm.runInContext("_pianoGraphWarm", c)}`), clearTempleResume() {},
    localStorage: { setItem: () => events.push("seen") }, closeTransitEssayReader() {},
    overlay: { classList: { add: () => events.push("hideOverlay") } },
    clock: { getDelta: () => events.push("clock") }, applyAudioState() {},
    syncTransport: () => events.push(`transport:${vm.runInContext("_pianoGraphWarm", c)}`),
    pocketLive: () => false, reconcileTargetSounds: () => events.push("reconcile"),
    touchUI: { classList: { add: () => events.push("touchUI") } },
  });
  const warmState = main.match(/^let _pianoWarmPools=[^\n]+;/m);
  assert.ok(warmState, "the runtime declares all warm/pending/token state together");
  const names = ["pianoWarmPool", "pianoWarmGraph", "pianoWarmStartRun", "padBeginBlocked", "startRun", "enterRunning"];
  vm.runInContext(`${warmState[0]}\n${names.map(name => extractFunction(main, name)).join("\n")}`, c);
  return { c, events, requests, timers, timerHistory, control,
    read: expression => vm.runInContext(expression, c),
    start: viaPad => c.startRun(viaPad),
    resolve: (name, index = 0, running = true) => requests.filter(request => request.name === name)[index].resolve(running),
    flush: async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); },
    advance: ms => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } },
  };
}

test("mobile, no-pointer-lock and pad starts wait for listener resume before reset or Transport", async () => {
  for (const [mobile, viaPad] of [[true, false], [false, false], [false, true]]) {
    const h = startWarmHarness({ mobile });
    h.start(viaPad); h.start(viaPad);
    assert.equal(h.c.state.started, false); assert.equal(h.c.state.running, false);
    assert.equal(h.events.some(event => event.startsWith("reset:") || event.startsWith("transport:")), false);
    assert.equal(h.events.includes("sphereWarm"), false);
    assert.equal(h.requests.filter(request => request.name === "listener").length, 1, "duplicate presses share the pending attempt");
    assert.equal(h.read("_pianoWarmRunPending"), true);
    h.resolve("listener"); await h.flush();
    assert.equal(h.c.state.running, true); assert.equal(h.c.state.started, true);
    assert.equal(h.events.filter(event => event === "reset:true").length, 1);
    assert.equal(h.events.filter(event => event === "transport:true").length, 1);
    assert.ok(h.events.indexOf("sphereWarm") < h.events.indexOf("reset:true"));
    assert.ok(h.events.indexOf("reset:true") < h.events.indexOf("transport:true"));
    assert.equal(h.timers.size, 0); assert.equal(h.read("_pianoWarmRunPending"), false);
  }
});

test("running native contexts warm and enter immediately without a resume promise or timer", () => {
  const h = startWarmHarness({ listenerState: "running" }); h.start(false);
  assert.equal(h.c.state.running, true); assert.equal(h.requests.length, 0); assert.equal(h.timers.size, 0);
  assert.ok(h.events.indexOf("sphereWarm") < h.events.indexOf("reset:true"));
  assert.equal(h.events.filter(event => event === "transport:true").length, 1);
});

test("missing activation, disabled gates and incompatible pools retain the accepted lazy-start fallback", () => {
  for (const change of [h => { h.c.navigator.userActivation.hasBeenActive = false; }, h => { h.c.CFG.pianoFirstUse = 0; },
    h => { h.c.PIANO = false; }, h => { h.c.LOW = false; }, h => { h.c.listener = null; }]) {
    const h = startWarmHarness(); change(h); h.start(false);
    assert.equal(h.c.state.running, true); assert.equal(h.requests.length, 0); assert.equal(h.timers.size, 0);
    assert.equal(h.events.includes("reset:false"), true, "fallback does not require the optional warm latch");
  }
  const incompatible = startWarmHarness({ listenerState: "running", poolApi: false }); incompatible.start(false);
  assert.equal(incompatible.c.state.running, true); assert.equal(incompatible.read("_pianoGraphWarm"), false);
  assert.equal(incompatible.requests.length, 0); assert.equal(incompatible.timers.size, 0);
});

test("denied resume, thrown resume and resolved-but-suspended contexts do not enter or loop", async () => {
  const denied = startWarmHarness(); denied.start(false);
  denied.requests.find(request => request.name === "listener").reject(); await denied.flush();
  assert.equal(denied.c.state.running, false); assert.equal(denied.read("_pianoWarmRunPending"), false);
  assert.equal(denied.timers.size, 0); assert.equal(denied.events.filter(event => event === "block:start").length, 1);
  const suspended = startWarmHarness(); suspended.start(false); suspended.resolve("listener", 0, false); await suspended.flush();
  assert.equal(suspended.c.state.running, false); assert.equal(suspended.requests.length, 2);
  assert.equal(suspended.events.filter(event => event === "block:start").length, 1, "a resolved promise is not proof of a running context");
  const throwing = startWarmHarness(); throwing.control.throwResume = "raw"; throwing.start(false);
  assert.equal(throwing.c.state.running, false); assert.equal(throwing.read("_pianoWarmRunPending"), false);
  assert.equal(throwing.timers.size, 0); assert.equal(throwing.events.filter(event => event === "block:start").length, 1);
});

test("three-second timeout releases the start latch and ignores a later completion", async () => {
  const h = startWarmHarness(); h.start(false);
  assert.equal([...h.timers.values()][0].delay, 3000);
  h.advance(2999); assert.equal(h.read("_pianoWarmRunPending"), true); assert.equal(h.events.includes("block:start"), false);
  h.advance(1); assert.equal(h.read("_pianoWarmRunPending"), false); assert.equal(h.c.state.running, false);
  h.resolve("listener"); await h.flush();
  assert.equal(h.c.state.running, false); assert.equal(h.events.includes("sphereWarm"), false);
  assert.equal(h.events.filter(event => event === "block:start").length, 1);
});

test("an old resume or timeout cannot finish a newer pending start attempt", async () => {
  const h = startWarmHarness(); h.start(true);
  const oldToken = h.read("_pianoWarmRunToken"), oldTimeout = [...h.timerHistory.values()][0].fn;
  h.advance(3000); h.start(true);
  assert.ok(h.read("_pianoWarmRunToken") > oldToken); assert.equal(h.read("_pianoWarmRunPending"), true);
  h.resolve("listener", 0); await h.flush(); oldTimeout();
  assert.equal(h.c.state.running, false); assert.equal(h.read("_pianoWarmRunPending"), true);
  assert.equal(h.events.some(event => event.startsWith("reset:")), false);
  h.resolve("listener", 1); await h.flush();
  assert.equal(h.c.state.running, true); assert.equal(h.events.filter(event => event === "reset:true").length, 1);
  assert.equal(h.events.filter(event => event === "transport:true").length, 1);
});

test("hidden, Temple, already-running and typing guards cancel completion before start or error UI", async () => {
  for (const block of [h => { h.c.document.hidden = true; }, h => { h.c.templeActive = true; },
    h => { h.c.state.running = true; }, h => { h.c.document.activeElement = { tagName: "INPUT" }; }]) {
    for (const success of [false, true]) {
      const h = startWarmHarness(); h.start(true); block(h);
      if (success) h.resolve("listener"); else h.requests.find(request => request.name === "listener").reject();
      await h.flush();
      assert.equal(h.read("_pianoWarmRunPending"), false); assert.equal(h.timers.size, 0);
      assert.equal(h.events.some(event => event.startsWith("reset:") || event.startsWith("transport:") || event.startsWith("block:")), false);
    }
  }
});

test("both suspended contexts must resolve before actual startRun can advance", async () => {
  const h = startWarmHarness({ rawState: "suspended" }); h.start(false);
  h.resolve("listener"); await h.flush(); assert.equal(h.c.state.running, false);
  h.resolve("raw"); await h.flush(); assert.equal(h.c.state.running, true);
  assert.equal(h.events.filter(event => event === "transport:true").length, 1);
});
