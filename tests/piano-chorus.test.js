"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { extractFunction, normalize, pianoDefaults } = require("./chip-graph.js");
const fixture = require("./fixtures/piano-chorus-off.json");
const before = Object.values(fixture.functions).join("\n");
const patch = {
  harmonicity: 3, modulationIndex: 2.2, oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 1.1, sustain: 0.04, release: 0.55 },
  modulation: { type: "sine" }, modulationEnvelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.18 }
};

function captureChorus(source, { piano = false, maxStems = 8, ready = true, pianoOptions = {}, poolApi = true } = {}) {
  const events = [], nodes = [], edges = [], borrowed = [];
  const destination = { id: "Destination" };
  let ctx;
  const Tone = {};
  for (const name of ["Volume", "Filter", "Synth", "FMSynth", "PolySynth"]) {
    const ctor = function (...args) {
      this.id = `n${nodes.length}`;
      nodes.push({ id: this.id, name, args: normalize(args) });
      events.push({ op: "construct", ...nodes.at(-1) });
      if (name === "Volume") {
        let muted = false;
        Object.defineProperty(this, "mute", { get: () => muted, set: value => { muted = value; events.push({ op: "mute", id: this.id, value }); } });
      }
      if (name === "PolySynth") {
        let cap;
        Object.defineProperty(this, "maxPolyphony", { get: () => cap, set: value => { cap = value; events.push({ op: "cap", id: this.id, value }); } });
        this.activeVoices = 0;
        this._availableVoices = [];
        this._availableVoices.push = (...voices) => {
          for (const voice of voices) events.push({ op: "return", id: voice.id });
          return Array.prototype.push.apply(this._availableVoices, voices);
        };
        if (poolApi) this._getNextAvailableVoice = () => {
          assert.equal(ctx.chorusVol.mute, true, "pool construction happens behind the birth mute");
          assert.equal(cap, ctx.chorusCap(), "the ceiling is assigned before warming");
          assert.ok(borrowed.length < cap, "warming cannot exceed the actual ceiling");
          const voice = { id: `${this.id}/v${borrowed.length}`, ctor: args[0].toneName };
          borrowed.push(voice); events.push({ op: "borrow", id: voice.id }); return voice;
        };
        this._gcTimeout = 7;
        this.context = { clearInterval: id => events.push({ op: "clearInterval", id }) };
        this.triggerAttack = this.triggerAttackRelease = () => assert.fail("warming must not attack or schedule a note");
      }
    };
    ctor.toneName = name;
    ctor.prototype.connect = function (to) {
      assert.ok(to && to.id);
      const edge = { from: this.id, to: to.id }; edges.push(edge); events.push({ op: "connect", ...edge }); return this;
    };
    ctor.prototype.toDestination = function () { return this.connect(destination); };
    Tone[name] = ctor;
  }
  const forbidden = new Proxy({}, { get(_target, key) { assert.fail(`chorus construction touched gameplay ${String(key)}`); } });
  ctx = vm.createContext({
    PIANO: piano, Tone, toneReady: ready, chorusVoice: null, chorusVol: null,
    CFG: { chorus: { maxStems }, piano: { ...pianoDefaults, ...pianoOptions } },
    CHORUS_VOL_DB: -16, CHORUS_REL_SEC: 2.2, _CHORUS_MAX: 16,
    Math, state: forbidden, targets: forbidden
  });
  const names = ["chorusCap", "chorusWarm", "chorusEnsure"];
  if (source.includes("function pianoPatch(")) names.unshift("pianoPatch");
  vm.runInContext(names.map(name => extractFunction(source, name)).join("\n"), ctx);
  const voice = ctx.chorusEnsure();
  if (ready) assert.ok(voice && ctx.chorusVol, "construction must not hide a stub failure in its catch");
  return { ctx, voice, events, nodes, edges, borrowed, trace: () => normalize({ events, nodes, edges, borrowed, cap: voice?.maxPolyphony, muted: ctx.chorusVol?.mute, active: voice?.activeVoices, available: voice?._availableVoices, gc: voice?._gcTimeout }) };
}

test("Piano chorus fixture authenticates all thirty chorus functions and preserves every scheduling and fence function", () => {
  assert.equal(createHash("sha256").update(JSON.stringify(fixture.functions)).digest("hex"), "23d8ce70d03f3d32d9338431a85ce64c695a7279692fae06f32e733eb2dac4c2");
  assert.equal(Object.keys(fixture.functions).length, 30);
  for (const [name, original] of Object.entries(fixture.functions)) {
    if (name === "chorusEnsure" || name === "chorusCut") continue;
    assert.equal(extractFunction(main, name).replace(/\r\n/g, "\n"), original, `${name}: pitch, stem choice, timing, combat mute and the fence remain exact`);
  }
});

test("Piano chorus off preserves the complete triangle graph and mute/cap/warm event order", () => {
  for (const maxStems of [-2, 0, 1, 2.8, 8, 16, 99]) {
    const old = captureChorus(before, { maxStems }), now = captureChorus(main, { maxStems, piano: false });
    assert.deepEqual(now.trace(), old.trace(), `maxStems=${maxStems}`);
    assert.equal(now.borrowed.length, Math.max(1, Math.min(16, maxStems | 0)));
    assert.equal(now.nodes.some(node => node.name === "FMSynth"), false);
    assert.ok(now.borrowed.every(voice => voice.ctor === "Synth"));
  }
  const original = fixture.functions.chorusEnsure.match(/chorusVoice=new Tone\.PolySynth[^\n]+?;/)[0];
  assert.ok(extractFunction(main, "chorusEnsure").includes(original), "the exact original triangle construction remains on the off arm");
});

test("Piano chorus is the shared FM patch through its safety filter, born muted and fully warmed to the unchanged cap", () => {
  const h = captureChorus(main, { piano: true });
  assert.deepEqual(h.nodes, [
    { id: "n0", name: "Volume", args: [-16] },
    { id: "n1", name: "PolySynth", args: [{ constructor: "FMSynth" }, patch] },
    { id: "n2", name: "Filter", args: [4200, "lowpass"] }
  ]);
  assert.deepEqual(h.edges, [{ from: "n0", to: "Destination" }, { from: "n2", to: "n0" }, { from: "n1", to: "n2" }]);
  assert.equal(h.ctx.chorusVol.mute, true);
  assert.equal(h.voice.maxPolyphony, 8);
  assert.equal(h.voice.maxPolyphony, h.ctx.chorusCap());
  assert.equal(h.voice.activeVoices, 0);
  assert.equal(h.borrowed.length, 8);
  assert.ok(h.borrowed.every(voice => voice.ctor === "FMSynth"));
  assert.deepEqual(Array.from(h.voice._availableVoices), h.borrowed, "every borrowed voice is returned without being attacked");
  assert.equal(h.voice._gcTimeout, -1);
  assert.deepEqual(h.events.filter(e => e.op === "clearInterval"), [{ op: "clearInterval", id: 7 }]);
  const offEvents = captureChorus(before).events;
  const expected = structuredClone(offEvents);
  expected.find(e => e.op === "construct" && e.name === "PolySynth").args = [{ constructor: "FMSynth" }, patch];
  expected.find(e => e.op === "construct" && e.name === "Filter").args = [4200, "lowpass"];
  assert.deepEqual(h.events, expected, "only the voice patch and cutoff change; graph and warm sequencing stay exact");
  assert.match(extractFunction(main, "chorusEnsure"), /new Tone\.PolySynth\(Tone\.FMSynth,pianoPatch\(\)\)/);
  const custom = captureChorus(main, { piano: true, maxStems: 3, pianoOptions: { harm: 2, release: 0.4, lpHz: 3600 } });
  assert.equal(custom.nodes[1].args[1].harmonicity, 2);
  assert.equal(custom.nodes[1].args[1].envelope.release, 0.4);
  assert.deepEqual(custom.nodes[2].args, [3600, "lowpass"]);
  assert.equal(custom.borrowed.length, 3);
});

test("Piano chorus retains the not-ready and already-built guards and tolerates unavailable private warming APIs", () => {
  for (const piano of [false, true]) {
    const notReady = captureChorus(main, { piano, ready: false });
    assert.equal(notReady.voice, null); assert.deepEqual(notReady.events, []);
    const h = captureChorus(main, { piano }), first = h.trace();
    assert.equal(h.ctx.chorusEnsure(), h.voice);
    assert.deepEqual(h.trace(), first, "a second ensure neither constructs nor warms again");
    const noPrivate = captureChorus(main, { piano, poolApi: false });
    assert.equal(noPrivate.ctx.chorusVol.mute, true);
    assert.equal(noPrivate.voice.maxPolyphony, 8);
    assert.equal(noPrivate.voice.activeVoices, 0);
    assert.equal(noPrivate.borrowed.length, 0, "a renamed Tone private API fails soft without changing the graph");
  }
});

test("Piano chorus cleanup borrows the original short release then restores the selected instrument release", () => {
  for (const piano of [false, true]) for (const pianoRelease of [0.55, 0.4]) {
    const calls = [];
    let release = piano ? pianoRelease : 2.2;
    const ctx = vm.createContext({
      PIANO: piano, CFG: { piano: { release: pianoRelease } }, CHORUS_CUT_SEC: 0.06, CHORUS_REL_SEC: 2.2,
      chorusVoice: { set(options) { release = options.envelope.release; calls.push(["set", release]); }, releaseAll() { calls.push(["releaseAll", release]); } }
    });
    vm.runInContext(extractFunction(main, "chorusCut"), ctx);
    ctx.chorusCut();
    assert.deepEqual(calls, [["set", 0.06], ["releaseAll", 0.06], ["set", piano ? pianoRelease : 2.2]]);
    assert.equal(release, piano ? pianoRelease : 2.2, "a handover must not turn the FM patch back into the old 2.2-second choir");
    if (!piano) {
      calls.length = 0;
      vm.runInContext(fixture.functions.chorusCut, ctx); ctx.chorusCut();
      assert.deepEqual(calls, [["set", 0.06], ["releaseAll", 0.06], ["set", 2.2]], "off cleanup remains exact");
    }
    calls.length = 0; ctx.chorusVoice = null; ctx.chorusCut(); assert.deepEqual(calls, []);
  }
});
