"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { main } = require("./source.js");
const { extractFunction, pianoDefaults } = require("./chip-graph.js");
const reference = { playHit: fs.readFileSync(path.join(__dirname, "fixtures/piano-off.js"), "utf8") };

function pianoHit(source, piano, chip, q, options = {}) {
  const calls = [], writes = [];
  const voice = { oscillator: { width: { set value(v) { writes.push(["width", v]); } } }, triggerAttackRelease(...args) { calls.push(args); } };
  const voiceCfg = vm.runInNewContext(`({${main.match(/\bvoice:\{([^}]+)\}/)[1]}})`);
  const ctx = vm.createContext({
    PIANO: piano, CHIP_LEAD: chip, CFG: { piano: pianoDefaults, chip: { dutyFull: .5, dutyEdge: .125 }, voice: { ...voiceCfg, on: options.shaped !== false } },
    lead: options.fallback ? null : voice, synthHit: voice, leadLp: { frequency: { set value(v) { writes.push(["cutoff", v]); } } },
    soundOn: options.sound !== false, toneReady: options.ready !== false,
    voiceLive: () => options.live !== false, voiceMuted: () => !!options.muted, voiceQ: () => q, beatSnap: () => 4,
    state: { streak: 2 }, PENTA: [277.18, 329.63, 369.99], _voiceStack: options.stack || 0,
  });
  vm.runInContext([extractFunction(main, "dutyToWidth"), extractFunction(main, "pianoDur"), "function voiceBreak(){ _voiceStack=0; }", extractFunction(source, "playHit")].join("\n"), ctx);
  ctx.playHit(options.grade ?? 1);
  return { calls, writes, stack: ctx._voiceStack, voiceCfg };
}

test("piano tightness changes key length and velocity without width or cutoff writes", () => {
  for (const chip of [false, true]) for (const q of [0, .5, 1]) {
    const result = pianoHit(main, true, chip, q), V = result.voiceCfg;
    assert.deepEqual(result.writes, []);
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0][1], .07 + (.42 - .07) * q);
    assert.equal(result.calls[0][2], 4);
    assert.equal(result.calls[0][3], V.breathyVel + (V.fullVel - V.breathyVel) * q);
  }
});

test("piano retains grace spacing, clank silence and unshaped trainer or Temple behavior", () => {
  for (const q of [0, .5, 1]) for (const options of [{ grade: 0 }, { grade: 0, stack: 2 }, { muted: true }, { shaped: false }, { live: false }, { sound: false }, { ready: false }, { fallback: true }]) {
    const actual = pianoHit(main, true, true, q, options), old = pianoHit(reference.playHit, false, true, q, options);
    assert.deepEqual(actual.writes, []);
    assert.equal(actual.stack, old.stack);
    if (options.shaped === false || options.live === false) assert.deepEqual(actual.calls, old.calls);
    else {
      assert.equal(actual.calls.length, old.calls.length);
      assert.deepEqual(actual.calls.slice(1), old.calls.slice(1));
      if (actual.calls.length) assert.deepEqual([actual.calls[0][0], ...actual.calls[0].slice(2)], [old.calls[0][0], ...old.calls[0].slice(2)]);
    }
    if (options.muted || options.sound === false || options.ready === false) assert.equal(actual.calls.length, 0);
  }
});

test("piano off preserves every chip and analog kill outcome from the as-found runtime", () => {
  for (const chip of [false, true]) for (const q of [0, .5, 1]) for (const options of [{}, { grade: 0 }, { grade: 0, stack: 2 }, { muted: true }, { shaped: false }, { live: false }, { fallback: true }, { sound: false }, { ready: false }]) {
    const current = pianoHit(main, false, chip, q, options), old = pianoHit(reference.playHit, false, chip, q, options);
    assert.deepEqual(current.calls, old.calls);
    assert.deepEqual(current.writes, old.writes);
    assert.equal(current.stack, old.stack);
  }
});
