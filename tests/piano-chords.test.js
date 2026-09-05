"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { captureGraph, extractFunction, pianoDefaults } = require("./chip-graph.js");
const { pianoIntroOff } = require("./piano-intro-source.js");
const fixture = require("./fixtures/piano-chords-off.json");

test("Piano chord fixture authenticates all ten callers and preserves their notes, onsets and velocities exactly", () => {
  assert.equal(createHash("sha256").update(JSON.stringify(fixture.functions)).digest("hex"), "890c64cedec1ab85c0c1db7a6dadf9807662924b514bde15ce52866f767f1fbe");
  assert.equal(fixture.committedOnGridRef, "3a17ff8");
  assert.equal(createHash("sha256").update(fixture.committedOnGrid).digest("hex"), "28ade9178108a8681167546e95e373aaaf1d069bfea117b3e70bdd1830596d3c");
  let count = 0;
  for (const name of ["doorCross", "themeBreath", "volleyNote", "bowEnterHold", "onGrid"]) {
    const body = extractFunction(main, name).replace(/\r\n/g, "\n");
    const current = name === "onGrid" ? pianoIntroOff(body) : body;
    if (name === "onGrid") {
      assert.ok(current === fixture.functions.onGrid || current === fixture.committedOnGrid, "onGrid matches exactly one authenticated authored body; only the pending chip kick callee differs");
    } else {
      assert.equal(current, fixture.functions[name], `${name}: the duration cap belongs inside padChord, leaving the caller exact`);
    }
    count += (current.match(/\bpadChord\(/g) || []).length;
  }
  assert.equal(count, 10);
  assert.equal((main.match(/\bpadChord\(/g) || []).length - 1, count, "no unexamined pad caller was added");
});

test("Piano chord hold is strict identity when off, before any Tone, config or math access", () => {
  const touched = [];
  const forbidden = new Proxy({}, { get(_target, key) { touched.push(key); throw new Error(`off hold read ${String(key)}`); } });
  const ctx = vm.createContext({ PIANO: false, Tone: forbidden, CFG: forbidden, Math: forbidden });
  vm.runInContext(extractFunction(main, "pianoHold"), ctx);
  const token = { toString() { assert.fail("off hold coerced the duration"); } };
  for (const duration of ["1n", "2n", "4n", "16n", 0.07, 0, -1, undefined, token]) {
    assert.equal(ctx.pianoHold(duration), duration);
  }
  assert.deepEqual(touched, []);
});

test("Piano chords cap whole and half notes at 0.84 seconds at 28 BPM while retaining already short gates", () => {
  const calls = [];
  const seconds = value => typeof value === "number" ? value : 240 / (28 * Number(value.slice(0, -1)));
  const ctx = vm.createContext({ PIANO: true, CFG: { piano: { ...pianoDefaults } }, Math, Tone: { Time(value) { calls.push(value); return { toSeconds: () => seconds(value) }; } } });
  vm.runInContext(extractFunction(main, "pianoHold"), ctx);
  assert.ok(Math.abs(seconds("1n") - 60 / 28 * 4) < 1e-12, "a whole-note gate is about 8.57 seconds at 28 BPM");
  for (const duration of ["1n", "2n", "4n"]) {
    assert.equal(ctx.pianoHold(duration), 0.84);
    assert.ok(ctx.pianoHold(duration) < seconds(duration));
  }
  for (const duration of ["16n", "32n", 0.12, 0]) assert.equal(ctx.pianoHold(duration), seconds(duration));
  assert.equal(ctx.pianoHold(-2), 0);
  for (const [longSec, cap] of [[0.2, 0.84], [0, 0.84], [undefined, 0.84], [0.7, 1.4], [1.1, 2.2]]) {
    ctx.CFG.piano.longSec = longSec;
    assert.equal(ctx.pianoHold("1n"), cap, `longSec=${longSec}`);
  }
  assert.ok(calls.every(value => typeof value === "number" || /n$/.test(value)), "the helper converts only the caller's duration, never an onset");
});

test("Piano-off poly pad receives the original duration value and chord reference for every musical note length", () => {
  const calls = [], token = {};
  const forbidden = new Proxy({}, { get(_target, key) { assert.fail(`off poly pad touched ${String(key)}`); } });
  const ctx = vm.createContext({ PIANO: false, CHIP_PAD: false, Tone: forbidden, CFG: forbidden,
    pad: { triggerAttackRelease(...args) { calls.push(args); return token; } }
  });
  vm.runInContext(["pianoHold", "padChord"].map(name => extractFunction(main, name)).join("\n"), ctx);
  const notes = [220, 275, 330];
  for (const duration of ["1n", "2n", "4n", "16n", 0.35]) {
    assert.equal(ctx.padChord(notes, duration, 4.25, 0.17), token);
    assert.equal(calls.at(-1)[0], notes);
    assert.deepEqual(calls.at(-1), [notes, duration, 4.25, 0.17]);
  }
});

test("Piano lead assigns four FM voices so the unchanged three-key grace gesture can overlap its held root", () => {
  const graph = captureGraph(main, { piano: true, lead: true, dry: true });
  assert.equal(graph.routes.lead[0].name, "PolySynth");
  assert.deepEqual(graph.routes.lead[0].args[0], { constructor: "FMSynth" });
  assert.equal(graph.polyphony.lead, 4);
  assert.deepEqual(captureGraph(main, { piano: false, lead: true }).polyphony, {}, "the chip lead does not acquire a piano voice cap");
  assert.equal(extractFunction(main, "playHit").replace(/\r\n/g, "\n"), fixture.functions.playHit, "the instrument changes; the root, graces and their event order remain the same");

  const calls = [], keys = [], unexpected = [];
  // Record the separate key obligations of the actual playHit calls. Native Tone
  // rendering independently checks that PolySynth keeps their envelopes separate.
  const lead = new Proxy({ triggerAttackRelease(note, duration, at, velocity) {
    calls.push([note, duration, at, velocity]);
    assert.ok(keys.filter(key => key.end > at).length < graph.polyphony.lead);
    keys.push(Object.freeze({ note, at, end: at + duration, velocity }));
  } }, { get(target, key) { if (key in target) return target[key]; unexpected.push(key); return undefined; } });
  const voiceCfg = vm.runInNewContext(`({${main.match(/\bvoice:\{([^}]+)\}/)[1]}})`);
  const ctx = vm.createContext({
    PIANO: true, CHIP_LEAD: true, CFG: { piano: pianoDefaults, voice: { ...voiceCfg, on: true } },
    lead, synthHit: null, leadLp: new Proxy({}, { get(_target, key) { unexpected.push(`leadLp.${String(key)}`); return undefined; } }),
    soundOn: true, toneReady: true, voiceLive: () => true, voiceMuted: () => false, voiceQ: () => 1, beatSnap: () => 4,
    _voiceStack: 2, state: Object.freeze({ streak: 0 }), PENTA: Object.freeze([220, 275, 330]), Math
  });
  vm.runInContext(["pianoDur", "voiceBreak", "playHit"].map(name => extractFunction(main, name)).join("\n"), ctx);
  ctx.playHit(0);
  assert.deepEqual(calls.map(call => call.slice(0, 3)), [[220, 0.42, 4], [330, 0.08, 4.05], [440, 0.08, 4.1]]);
  assert.ok(Math.abs(calls[0][3] - voiceCfg.fullVel) < 1e-12);
  assert.deepEqual(calls.slice(1).map(call => call[3]), [0.5, 0.45]);
  assert.deepEqual(unexpected, [], "no mono width, release, stop or filter operation can cancel the root");
  assert.equal(keys[0].end, 4.42);
  assert.equal(keys.filter(key => key.at <= 4.11 && key.end > 4.11).length, 3, "all three distinct keys overlap while the original root stays held");
  assert.equal(new Set(keys.map(key => key.note)).size, 3);
});
