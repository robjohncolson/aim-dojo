"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const testsDir = __dirname;
const { extractFunction, normalize, pianoDefaults } = require(path.join(testsDir, "chip-graph.js"));
const { main } = require("./source.js");
const before = fs.readFileSync(path.join(__dirname, "fixtures/piano-sfx-off.js"), "utf8");
const hashes = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/piano-sfx-off.hashes.json"), "utf8"));
const roots = ["pianoSfx", "synthHit", "synthLow", "synthLvl", "noiseFire", "chordSynth", "arcWhoosh", "doorWhoosh", "fireMuzzle", "firePluck"];
const silent = ["synthLow", "synthLvl", "noiseFire", "arcWhoosh", "doorWhoosh", "fireMuzzle", "firePluck"];
const patch = {
  harmonicity: 3, modulationIndex: 2.2, oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 1.1, sustain: 0.04, release: 0.55 },
  modulation: { type: "sine" }, modulationEnvelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.18 }
};

function audio(source, { piano = false, door = true, running = true, temple = false, sound = true, chorus = true } = {}) {
  const events = [], calls = [], nodes = [], edges = [];
  const destination = { id: "Destination", mute: false };
  const raw = { state: "running", resume() { calls.push(["resume"]); return Promise.resolve(); } };
  const Tone = { Destination: destination, now: () => 10, start() { calls.push(["Tone.start"]); }, getContext: () => ({ rawContext: raw }) };
  function instrument(id) {
    return {
      id,
      triggerAttackRelease(...args) { calls.push(["note", id, ...normalize(args)]); },
      frequency: {
        cancelScheduledValues(...args) { calls.push(["cancel", id, ...normalize(args)]); },
        setValueAtTime(...args) { calls.push(["set", id, ...normalize(args)]); },
        linearRampToValueAtTime(...args) { calls.push(["ramp", id, ...normalize(args)]); }
      }
    };
  }
  for (const name of ["Volume", "Filter", "Synth", "NoiseSynth", "FMSynth", "PolySynth"]) {
    const ctor = function (...args) {
      Object.assign(this, instrument(`n${nodes.length}`));
      this.name = name;
      nodes.push({ id: this.id, name, args: normalize(args) });
      events.push({ op: "construct", ...nodes.at(-1) });
    };
    ctor.toneName = name;
    ctor.prototype.connect = function (to) {
      assert.ok(to && to.id, `${name} connects to a captured node`);
      const edge = { from: this.id, to: to.id }; edges.push(edge); events.push({ op: "connect", ...edge }); return this;
    };
    ctor.prototype.toDestination = function () { return this.connect(destination); };
    Tone[name] = ctor;
  }
  const c = vm.createContext({
    Tone, window: { Tone }, Math, Number, PIANO: piano, CHIP_FIELD: false, CHIP_PAD: false,
    CFG: {
      piano: { ...pianoDefaults }, chorus: { on: chorus }, tank: { fillOnly: true },
      tide: { on: true, riseBars: 6, peakBars: 2, mercyBars: 1, padPeakVel: 0.12 },
      flickBonus: { streakGate: 5, cooldown: 2, graceMisses: 1, baseBeats: 4 }, grooveGroove: true, hitTrauma: 0.4
    },
    state: { running, streak: 6, t: 20, bpm: 30 }, templeActive: temple, soundOn: sound,
    listener: { setMasterVolume(v) { calls.push(["master", v]); } }, reverbInput: running ? {} : null,
    rawCtx: null, audioInit: false, toneReady: false, drumBus: { mute: false },
    ML_DOOR_CROSS: door, DOOR_WHOOSH_DB: -26, DOOR_WHOOSH_SEC: 0.22, DOOR_WHOOSH_HZ: [520, 140], ML_ARCH_EVERY: 4,
    ensureListener() { calls.push(["ensureListener"]); }, buildReverb() { calls.push(["buildReverb"]); }, scheduleReverbBuild() { calls.push(["scheduleReverbBuild"]); },
    loadToneOnce() { calls.push(["loadToneOnce"]); return Promise.resolve(); },
    chorusSaltRefresh() { calls.push(["chorusSaltRefresh"]); }, chorusEnsure() { calls.push(["chorusEnsure"]); },
    beatSnap: () => 10.25, PENTA: [110, 132, 165, 220, 264, 330, 440], CHORD_TRIAD: [[110, 132, 165]],
    lead: instrument("lead"), pad: instrument("pad"), shotCue: piano ? null : instrument("shotCue"),
    GH_RECORD: true, ghostRecordTargetOutcome(tg, value) { calls.push(["record", tg.id, value]); },
    removeTarget(tg) { calls.push(["remove", tg.id]); }, pushEvent(ok) { calls.push(["grade", ok]); },
    showTiming(...args) { calls.push(["timing", ...args]); }, T: (_key, value) => value,
    missGrooveDuck(strong) { calls.push(["duck", strong]); }, addTrauma(n) { calls.push(["trauma", n]); },
    trainMode: false, reduceMotion: false, roadLive: () => true,
    _wallCross: { value: -1e9 }, _roadTide0: { m: 0, i: 1 }, _roadTideR: { m: 0, i: 1 },
    roadMat: { uniforms: { uNow: { value: 32 }, uPulse: { value: 132 } } },
    _bonusLast: 0, bonusActive: false, _bonusResolving: false, _bonusJustArmed: false,
    bonusLocks: [], _bonusGrace: 0, _bonusEntryBeat: 0, bonusEndsBeat: 0,
    updatePocketMisses() { calls.push(["updatePocketMisses"]); }, currentRawBeat: () => 12
  });
  for (const name of roots) c[name] = null;
  c.padChord = (...args) => c.pad.triggerAttackRelease(...args);
  const names = ["applyAudioState", "initAudio", "sfx", "playClankSfx", "playWhiffSfx", "onExpire", "playFireLaunch", "chordHit", "maybeArmFlickBonus", "roadTideAt", "doorCross"];
  if (source.includes("function pianoPatch(")) names.unshift("pianoPatch");
  vm.runInContext(names.map(n => extractFunction(source, n)).join("\n"), c);
  c.initAudio();
  assert.equal(c.toneReady, true, "initAudio must complete; a swallowed VM dependency error is not silence");
  assert.equal(c.audioInit, true);
  function route(node) {
    if (!node) return null;
    if (node.id === destination.id) return [{ name: "Destination", args: [] }];
    const def = nodes.find(n => n.id === node.id), out = edges.filter(e => e.from === node.id);
    assert.equal(out.length, 1, `${node.id} owns exactly one output`);
    return [{ name: def.name, args: def.args }, ...route({ id: out[0].to })];
  }
  const routes = Object.fromEntries(roots.map(name => [name, route(c[name])]));
  return { c, Tone, raw, events, calls, nodes, edges, routes, instrument, notes: () => calls.filter(e => e[0] === "note"), clear: () => { calls.length = 0; } };
}

function legacySchedule(source) {
  const h = audio(source); h.clear();
  for (const kind of ["hit", "whiff", "offbeat", "expire", "levelUp", "levelDown", "unknown"]) h.c.sfx(kind);
  h.c.playClankSfx(); h.c.playWhiffSfx(); h.c.onExpire({ id: "ordinary", kind: 0, fill16: -1 });
  for (const ft of [0, 0.05, 0.6, 4]) h.c.playFireLaunch(ft);
  for (const streak of [0, 3, 99]) h.c.chordHit(streak);
  h.c.state.streak = 6;
  h.c.maybeArmFlickBonus();
  for (const bar of [0, 5, 6, 7, 8, 9, 17]) h.c.doorCross(bar);
  return { calls: h.calls, state: normalize(h.c.state), bonus: [h.c.bonusActive, h.c._bonusEntryBeat, h.c.bonusEndsBeat], wall: h.c._wallCross.value };
}

function assertPianoSfx(source) {
  const h = audio(source, { piano: true });
  for (const [kind, pitch] of [["whiff", 165], ["offbeat", 220], ["expire", 110]]) {
    h.clear(); h.c.sfx(kind);
    assert.deepEqual(h.notes(), [["note", h.c.pianoSfx.id, pitch, h.c.CFG.piano.shortSec, 10, 0.35]], kind);
  }
}

function assertPianoDoor(source) {
  const h = audio(source, { piano: true }); h.clear();
  for (const bar of [6, 7, 8]) h.c.doorCross(bar);
  assert.equal(h.c._wallCross.value, 32, "visual crossing stamp survives the silent whoosh");
  assert.deepEqual(h.notes(), [["note", "pad", 110, "16n", 10.25, 0.12]], "mercy tonic survives a null whoosh voice exactly once");
  assert.equal(h.calls.some(c => ["cancel", "set", "ramp"].includes(c[0])), false);
}

test("Piano SFX fixture authenticates all frozen construction, event and isolation seams", () => {
  for (const [name, expected] of Object.entries(hashes)) {
    assert.equal(crypto.createHash("sha256").update(extractFunction(before, name).replace(/\r\n/g, "\n")).digest("hex"), expected, name);
  }
});

test("Piano SFX off constructs the exact as-found graph and initialization order", () => {
  for (const door of [false, true]) for (const running of [false, true]) for (const chorus of [false, true]) {
    const opts = { door, running, chorus }, old = audio(before, opts), now = audio(main, opts);
    assert.deepEqual(now.events, old.events); assert.deepEqual(now.routes, old.routes); assert.deepEqual(now.calls, old.calls);
    assert.equal(now.nodes.some(n => n.name === "FMSynth"), false);
  }
});

test("Piano SFX uses one FM miss voice plus a polyphonic FM chord with no legacy orphan nodes", () => {
  const h = audio(main, { piano: true });
  assert.deepEqual(h.routes.pianoSfx, [{ name: "FMSynth", args: [patch] }, { name: "Volume", args: [-12] }, { name: "Destination", args: [] }]);
  assert.deepEqual(h.routes.chordSynth, [{ name: "PolySynth", args: [{ constructor: "FMSynth" }, patch] }, { name: "Volume", args: [-13] }, { name: "Destination", args: [] }]);
  assert.equal(h.c.synthHit, h.c.pianoSfx, "lead-failure fallback is the existing shared FM voice, not another graph");
  for (const name of silent) assert.equal(h.c[name], null, `${name} is not built`);
  assert.equal(h.nodes.length, 4, "two voices and their two trims, without muted legacy instruments or the old shared -6 dB trim");
  const count = h.events.length; h.c.initAudio(); assert.equal(h.events.length, count, "initialization does not build twice");
});

test("Piano miss pitches are one short low note and hit/level/unknown cannot double-strike", () => {
  assertPianoSfx(main);
  const h = audio(main, { piano: true }); h.clear();
  for (const kind of ["hit", "levelUp", "levelDown", "unknown"]) h.c.sfx(kind);
  assert.deepEqual(h.notes(), []);
  h.c.CFG.piano.shortSec = 0.11; h.c.sfx("whiff"); assert.equal(h.notes()[0][3], 0.11, "duration follows the authored key-length knob");
});

test("Piano clank and whiff bypass wrappers dispatch one note without legacy layers or lead stealing", () => {
  const h = audio(main, { piano: true }); h.clear();
  h.c.playClankSfx(); h.c.playWhiffSfx();
  assert.deepEqual(h.notes(), [["note", h.c.pianoSfx.id, 220, 0.07, 10, 0.35], ["note", h.c.pianoSfx.id, 165, 0.07, 10, 0.35]]);
  for (const key of ["soundOn", "toneReady"]) {
    h.clear(); h.c[key] = false; h.c.sfx("expire"); h.c.playClankSfx(); h.c.playWhiffSfx(); h.c.playFireLaunch(1); assert.deepEqual(h.notes(), [], key); h.c[key] = true;
  }
});

test("Piano expiry is 110 Hz while neutral decoys and unfinished fills remain silent and ungraded", () => {
  const h = audio(main, { piano: true }); h.clear();
  h.c.onExpire({ id: "ordinary", kind: 0, fill16: -1 });
  assert.deepEqual(h.notes(), [["note", h.c.pianoSfx.id, 110, 0.07, 10, 0.35]]);
  assert.deepEqual(h.calls.filter(e => e[0] !== "note"), [["record", "ordinary", 0], ["remove", "ordinary"], ["grade", false], ["timing", "FADED", "listen for the next", "off"], ["duck", false], ["trauma", 0.4 * 0.14]]);
  for (const tg of [{ id: "decoy", kind: 2, fill16: -1 }, { id: "fill", kind: 0, fill16: 6 }]) {
    h.clear(); h.c.state.streak = 7; h.c.onExpire(tg);
    assert.deepEqual(h.calls, [["record", tg.id, 0], ["remove", tg.id]]); assert.equal(h.c.state.streak, 7);
  }
});

test("Piano launch returns before every trigger even if legacy voices are present", () => {
  const h = audio(main, { piano: true }); h.clear();
  for (const name of ["fireMuzzle", "firePluck", "arcWhoosh"]) h.c[name] = h.instrument(name);
  for (const ft of [0, 0.1, 1, 9]) h.c.playFireLaunch(ft);
  assert.deepEqual(h.calls, []);
  const body = extractFunction(main, "playFireLaunch");
  assert.ok(body.indexOf("if(PIANO) return;") >= 0 && body.indexOf("if(PIANO) return;") < body.indexOf("fireMuzzle.triggerAttackRelease"));
});

test("Piano off preserves all existing SFX pitches, layering, scheduling and related event state", () => {
  const old = legacySchedule(before), now = legacySchedule(main);
  assert.ok(old.calls.filter(c => c[0] === "note").length > 20, "the oracle must exercise audible branches");
  assert.deepEqual(now, old);
});

test("Piano doorway preserves the mercy tonic, visual stamp and existing training/Temple gates", () => {
  assertPianoDoor(main);
  const reduced = audio(main, { piano: true }); reduced.clear(); reduced.c.reduceMotion = true; reduced.c.doorCross(8);
  assert.equal(reduced.c._wallCross.value, 132); assert.equal(reduced.notes().length, 1);
  for (const key of ["trainMode", "templeActive"]) {
    const h = audio(main, { piano: true }); h.clear(); h.c[key] = true; h.c.doorCross(8);
    assert.equal(h.c._wallCross.value, -1e9); assert.deepEqual(h.calls, [], key);
  }
  for (const key of ["soundOn", "toneReady"]) {
    const h = audio(main, { piano: true }); h.clear(); h.c[key] = false; h.c.doorCross(8);
    assert.equal(h.c._wallCross.value, 32); assert.deepEqual(h.calls, [], key);
  }
});

test("Piano chordHit and bonus retain their existing polyphonic notes and schedules", () => {
  for (const name of ["chordHit", "maybeArmFlickBonus"]) assert.equal(extractFunction(main, name), extractFunction(before, name), name);
  const h = audio(main, { piano: true }); h.clear(); h.c.chordHit(3); h.c.maybeArmFlickBonus();
  assert.deepEqual(h.notes(), [
    ["note", h.c.chordSynth.id, [220, 330, 440, 660], "8n", 10.5, 0.45],
    ["note", "lead", 264, "8n", 10.25, 0.7], ["note", "lead", 440, "8n", 10.31, 0.6],
    ["note", h.c.chordSynth.id, [110, 165, 264], "4n", 10.25, 0.4]
  ]);
  assert.equal(h.c.bonusActive, true); assert.equal(h.c._bonusEntryBeat, 12); assert.equal(h.c.bonusEndsBeat, 16);
});

test("Piano direct SFX remain behind existing Destination mute and preserve standing chorus initialization", () => {
  // piano-chorus.test.js authenticates the off graph and both instruments' cap, birth mute and warm sequence.
  assert.equal(extractFunction(main, "applyAudioState"), extractFunction(before, "applyAudioState"));
  for (const piano of [false, true]) for (const temple of [false, true]) for (const sound of [false, true]) {
    const h = audio(main, { piano, temple, sound });
    assert.equal(h.Tone.Destination.mute, temple || !sound);
    assert.deepEqual(h.calls.filter(e => e[0] === "master"), [["master", !temple && sound ? 1 : 0]]);
    assert.deepEqual(h.calls.filter(e => e[0].startsWith("chorus")), [["chorusSaltRefresh"], ["chorusEnsure"]]);
  }
});

test("Piano SFX assertions reject legacy-fallthrough and the null-whoosh swallowed-tonic regression", () => {
  const badSfx = main.replace(extractFunction(main, "sfx"), extractFunction(before, "sfx"));
  const badDoor = main.replace(extractFunction(main, "doorCross"), extractFunction(before, "doorCross"));
  assert.notEqual(badSfx, main); assert.notEqual(badDoor, main);
  assert.throws(() => assertPianoSfx(badSfx), assert.AssertionError);
  assert.throws(() => assertPianoDoor(badDoor), assert.AssertionError);
});
