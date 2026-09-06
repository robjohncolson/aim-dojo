"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { extractFunction, normalize } = require("./chip-graph.js");

// These mocks verify ownership, scheduling inputs and failure recovery. Oscillator retention
// is measured by the native browser/CDP probe, never inferred from this object graph.
function contextCfg() {
  const declaration = /^const CFG = (\{[\s\S]*?^\});/m.exec(main);
  assert.ok(declaration, "the complete shipped CFG literal is available");
  return vm.runInNewContext(`(${declaration[1]})`, {
    localStorage: { getItem: () => null }, SIDEREAL_RUNTIME: {},
    DEFAULT_SKY_SUPABASE_URL: "https://example.test", DEFAULT_SKY_SUPABASE_ANON_KEY: "test-key",
  });
}

function contextHarness({ piano = true, enabled = true, lazy = false } = {}) {
  const events = [], natives = [], contexts = [], instruments = [], notes = [];
  const control = { fail: null };
  const oldNative = { state: "running", currentTime: 7, resume: () => Promise.resolve() };
  const previous = {
    rawContext: oldNative, latencyHint: "interactive", sampleRate: 48000,
    lookAhead: .1, updateInterval: .05, clockSource: "worker",
    transport: { bpm: { value: 28 }, ticks: 0, PPQ: 192, state: "stopped" },
    draw: { owner: "old" }, destination: { owner: "old" }, listener: { owner: "old" },
    dispose() { events.push(["old.dispose"]); if (control.fail === "old.dispose") throw new Error("old.dispose failed"); },
  };
  let current = previous;
  const NativeContext = function (options) {
    this.options = normalize(options); this.state = "running"; this.currentTime = 100;
    this.closeCount = 0; this.resumeCount = 0;
    this.close = () => { this.closeCount++; return Promise.resolve(); };
    this.resume = () => { this.resumeCount++; this.state = "running"; return Promise.resolve(); };
    natives.push(this); events.push(["native.construct"]);
  };
  const Context = function (options) {
    events.push(["context.construct"]);
    if (control.fail === "construct") throw new Error("construct failed");
    Object.assign(this, options, { rawContext: options.context, disposeCount: 0 });
    const transport = { bpm: { value: 120 }, ticks: 0, PPQ: 192, state: "stopped" };
    Object.defineProperty(this, "transport", { get: () => {
      if (control.fail === "transport") throw new Error("transport failed");
      return transport;
    } });
    this.draw = { owner: this }; this.destination = { owner: this }; this.listener = { owner: this };
    this.dispose = () => { this.disposeCount++; this.rawContext.close(); };
    contexts.push(this);
  };
  const library = {
    Context,
    getContext: () => current, getTransport: () => current.transport,
    getDraw: () => current.draw, getDestination: () => current.destination, getListener: () => current.listener,
    setContext(candidate) {
      events.push(["setContext", candidate]);
      if (control.fail === "setContext") throw new Error("setContext failed");
      current = candidate;
    },
    start() {
      events.push(["start", current]);
      if (control.fail === "start-once") { control.fail = null; throw new Error("start failed"); }
    },
    now: () => current.rawContext.currentTime + current.lookAhead,
    immediate: () => current.rawContext.currentTime,
    Time: value => ({ toSeconds: () => typeof value === "number" ? value : 240 / (current.transport.bpm.value * Number(value.slice(0, -1))) }),
    Frequency: value => ({ transpose: semitones => ({ toFrequency: () => value * 2 ** (semitones / 12) }) }),
  };
  for (const name of ["Volume", "Filter", "Synth", "NoiseSynth", "FMSynth", "PolySynth"]) {
    library[name] = function (...args) {
      this.context = current; this.name = name; this.args = args;
      this.connect = target => { this.target = target; return this; };
      this.toDestination = () => this.connect(current.destination);
      this.triggerAttackRelease = (...values) => notes.push({ context: this.context, values });
      instruments.push(this);
    };
  }
  // Model Tone 14's original exported singleton snapshots separately from its public current-context getters.
  const exports = { Transport: previous.transport, Draw: previous.draw, Destination: previous.destination,
    Master: previous.destination, Listener: previous.listener, context: previous };
  Object.assign(library, exports);
  Object.freeze(library);
  const cfg = contextCfg(); cfg.pianoNativeContext = enabled ? 1 : 0; cfg.chorus.on = false;
  const c = vm.createContext({
    window: { Tone: lazy ? undefined : library, AudioContext: NativeContext }, Proxy, Math, Number,
    CFG: cfg, PIANO: piano, LOW: false, CHIP_BASS: true, audioInit: false, toneReady: false, rawCtx: null,
    state: { running: false, bpm: 28, streak: 2 }, listener: { context: { owner: "sphere" } }, reverbInput: {},
    ensureListener: () => {}, scheduleReverbBuild: () => {}, buildReverb: () => {}, applyAudioState: () => {},
    loadToneOnce: () => { events.push(["loadToneOnce"]); return Promise.resolve(); },
    ML_DOOR_CROSS: false, DOOR_WHOOSH_DB: -26,
    pianoSfx: null, synthHit: null, synthLow: null, synthLvl: null, noiseFire: null, chordSynth: null,
    arcWhoosh: null, doorWhoosh: null, fireMuzzle: null, firePluck: null,
    soundOn: true, PENTA: [110, 132, 165], lead: null,
  });
  const facadeDeclaration = main.match(/^const Tone=new Proxy\(\{\}, \{get:pianoToneFacadeGet\}\);/m);
  assert.ok(facadeDeclaration, "the runtime installs the tested lexical facade");
  const helpers = ["pianoToneFacadeGet", "pianoContextAlign", "pianoPatch", "initAudio", "beatSnap", "pianoBass", "bassNote", "bassOut", "pianoDur", "playHit"];
  vm.runInContext(`let _pianoContext=null;\n${helpers.map(name => extractFunction(main, name)).join("\n")}\n${facadeDeclaration[0]}\nvar facade=Tone;`, c);
  return { c, library, exports, previous, natives, contexts, instruments, notes, events, control,
    current: () => current, latched: () => vm.runInContext("_pianoContext", c) };
}

test("piano context facade tolerates lazy Tone arrival and keeps original exports before alignment", () => {
  const h = contextHarness({ lazy: true });
  assert.equal(h.c.facade.Transport, undefined);
  assert.equal(h.c.facade.FMSynth, undefined);
  h.c.initAudio();
  assert.equal(h.c.audioInit, false); assert.equal(h.c.toneReady, false);
  assert.equal(h.natives.length, 0); assert.equal(h.events[0][0], "loadToneOnce");
  h.c.window.Tone = h.library;
  for (const [key, value] of Object.entries(h.exports)) assert.equal(h.c.facade[key], value, key);
  assert.equal(h.c.facade.now, h.library.now);
  assert.equal(h.c.facade.FMSynth, h.library.FMSynth);
  h.c.initAudio();
  assert.equal(h.c.audioInit, true); assert.equal(h.c.toneReady, true);
  assert.equal(h.natives.length, 1);
});

test("piano context off switch and legacy mode preserve singleton identity and original instrument ownership", () => {
  for (const options of [{ piano: false, enabled: true }, { piano: true, enabled: false }]) {
    const h = contextHarness(options); h.c.initAudio();
    assert.equal(h.c.audioInit, true); assert.equal(h.c.toneReady, true);
    assert.equal(h.latched(), null); assert.equal(h.natives.length, 0);
    assert.equal(h.current(), h.previous); assert.equal(h.c.rawCtx, h.previous.rawContext);
    for (const [key, value] of Object.entries(h.exports)) assert.equal(h.c.facade[key], value, key);
    assert.ok(h.instruments.length > 0 && h.instruments.every(node => node.context === h.previous));
    assert.equal(h.events.filter(e => e[0] === "old.dispose").length, 0);
  }
});

test("piano context alignment makes every app alias and new instrument coherent without rewriting library exports", () => {
  const h = contextHarness(); h.c.initAudio();
  const owned = h.current();
  assert.notEqual(owned, h.previous); assert.equal(h.latched(), owned);
  const expected = { Transport: owned.transport, Draw: owned.draw, Destination: owned.destination,
    Master: owned.destination, Listener: owned.listener, context: owned };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(h.c.facade[key], value, key);
    assert.equal(h.library[key], h.exports[key], `${key} library export remains unchanged`);
  }
  assert.equal(h.c.window.Tone, h.library); assert.equal(Object.isFrozen(h.library), true);
  assert.equal(h.c.facade.getContext, h.library.getContext);
  assert.equal(h.c.facade.FMSynth, h.library.FMSynth);
  assert.equal(h.c.rawCtx, owned.rawContext);
  assert.ok(h.instruments.length > 0 && h.instruments.every(node => node.context === owned));
  assert.equal(h.events.filter(e => e[0] === "old.dispose").length, 1);
});

test("piano musical context preserves worker scheduling, native options and BPM without starting Transport or notes", () => {
  const h = contextHarness(); const owned = h.c.pianoContextAlign();
  assert.deepEqual(h.natives[0].options, { latencyHint: "interactive", sampleRate: 48000 });
  assert.equal(owned.lookAhead, .1); assert.equal(owned.updateInterval, .05); assert.equal(owned.clockSource, "worker");
  assert.equal(owned.transport.bpm.value, 28); assert.equal(owned.transport.state, "stopped");
  assert.notEqual(owned.rawContext, h.c.listener.context, "the sphere's zero-look-ahead context is separate");
  assert.equal(h.c.facade.now(), 100.1); assert.equal(h.c.facade.immediate(), 100);
  assert.equal(h.c.facade.Time("8n").toSeconds(), 60 / 28 / 2);
  owned.transport.bpm.value = 60;
  assert.equal(h.c.facade.Time("8n").toSeconds(), .5, "musical durations follow the owned Transport");
  assert.equal(h.instruments.length, 0); assert.equal(h.notes.length, 0);
  assert.equal(h.events.some(e => e[0] === "start"), false);
});

test("piano init repeats, resume and post-alignment retries reuse exactly one owned context", () => {
  const h = contextHarness(); h.control.fail = "start-once";
  h.c.initAudio();
  assert.equal(h.c.audioInit, false); assert.equal(h.c.toneReady, false);
  const owned = h.latched(); assert.ok(owned); assert.equal(h.instruments.length, 0);
  h.c.initAudio(); const count = h.instruments.length;
  assert.equal(h.c.audioInit, true); assert.equal(h.c.toneReady, true);
  owned.rawContext.state = "suspended"; h.c.initAudio(); h.c.initAudio();
  assert.equal(owned.rawContext.resumeCount, 1);
  assert.equal(h.natives.length, 1); assert.equal(h.contexts.length, 1);
  assert.equal(h.instruments.length, count); assert.equal(h.c.pianoContextAlign(), owned);
  assert.equal(h.events.filter(e => e[0] === "old.dispose").length, 1);
});

test("piano context failures clean candidates, leave the old context current and allow a later retry", () => {
  for (const stage of ["construct", "transport", "setContext"]) {
    const h = contextHarness(); h.control.fail = stage;
    assert.throws(() => h.c.pianoContextAlign(), new RegExp(`${stage} failed`));
    assert.equal(h.current(), h.previous); assert.equal(h.latched(), null);
    assert.equal(h.natives.length, 1); assert.equal(h.natives[0].closeCount, 1, stage);
    if (h.contexts.length) assert.equal(h.contexts[0].disposeCount, 1, stage);
    assert.equal(h.events.filter(e => e[0] === "old.dispose").length, 0);
    for (const [key, value] of Object.entries(h.exports)) assert.equal(h.c.facade[key], value);
    h.control.fail = null; const owned = h.c.pianoContextAlign();
    assert.notEqual(owned, h.previous); assert.equal(h.current(), owned); assert.equal(h.latched(), owned);
    assert.equal(h.natives.length, 2); assert.equal(h.natives[1].closeCount, 0);
    assert.equal(h.events.filter(e => e[0] === "old.dispose").length, 1);
  }
});

test("failure while disposing the unused old context does not undo or rebuild the owned context", () => {
  const h = contextHarness(); h.control.fail = "old.dispose";
  const owned = h.c.pianoContextAlign();
  assert.equal(h.current(), owned); assert.equal(h.latched(), owned);
  assert.equal(h.c.pianoContextAlign(), owned); assert.equal(h.c.facade.Transport, owned.transport);
  assert.equal(h.natives.length, 1); assert.equal(owned.disposeCount, 0);
  assert.equal(h.events.filter(e => e[0] === "old.dispose").length, 1);
});

test("actual bass and hit helpers preserve note identity and grace offsets on the coherent musical clock", () => {
  for (const enabled of [false, true]) {
    const h = contextHarness({ enabled }); h.c.initAudio();
    h.c.CFG.voice.on = false;
    h.c.lead = new h.c.facade.FMSynth();
    h.c.facade.Transport.ticks = .24 * h.c.facade.Transport.PPQ;
    assert.equal(h.c.bassOut(110), 220);
    const now = h.c.facade.now(); h.c.playHit(0);
    assert.equal(h.notes.length, 2);
    assert.equal(h.notes[0].context, h.current()); assert.equal(h.notes[1].context, h.current());
    assert.deepEqual(h.notes.map(note => [note.values[0], note.values[1], note.values[3]]), [[165, .16, .95], [330, .08, .5]]);
    assert.ok(Math.abs(h.notes[0].values[2] - now - .01 * 60 / 28) < 1e-12);
    assert.ok(Math.abs(h.notes[1].values[2] - h.notes[0].values[2] - .05) < 1e-12);
  }
});

test("context alignment retains every earlier-bloom knob and the live lesson density branch", () => {
  const cfg = contextCfg();
  assert.deepEqual(Array.from(cfg.wasdNoteT), [0, 1.01]);
  assert.equal(cfg.wasdGrooveGain, .30); assert.equal(cfg.wasdGrooveMax, 2.7);
  assert.equal(cfg.grooveStreakFull, 3); assert.equal(cfg.grooveHitsFull, 12); assert.equal(cfg.grooveAccHi, .8);
  const c = vm.createContext({ CFG: cfg, Number, Math, state: { bpm: 28 }, trainMode: true });
  vm.runInContext(["diffT", "wasdNoteDiv"].map(name => extractFunction(main, name)).join("\n"), c);
  assert.equal(c.wasdNoteDiv(), 1);
  assert.equal(c.wasdNoteDiv(c.diffT()), 2, "explicit density probes retain main-mode access");
  c.trainMode = false;
  for (const bpm of [20, 28, 60]) { c.state.bpm = bpm; assert.equal(c.wasdNoteDiv(), 2); }
});
