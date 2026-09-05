"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { extractFunction } = require("./chip-graph.js");
const fixture = require("./fixtures/piano-arrangement-off.json");

test("Piano arrangement fixture authenticates the pre-Piano clock and musical call sites", () => {
  assert.equal(createHash("sha256").update(JSON.stringify(fixture.functions)).digest("hex"), "00e02e89a2df95d7eea5db60babef0d9c7806400b58fb22ae73ce99999b84d11");
  assert.deepEqual(Object.keys(fixture.functions), ["onGrid", "themeBreath", "wasdLanePress", "volleyNote", "bowEnterHold"]);
});

test("Piano bass routing preserves off-arm note identity and raises exactly one octave for all four flag combinations", () => {
  for (const piano of [false, true]) for (const chipBass of [false, true]) {
    const calls = [];
    const ctx = vm.createContext({ PIANO: piano, CHIP_BASS: chipBass, Tone: { Frequency(note) {
      calls.push(["Frequency", note]);
      const hz = typeof note === "number" ? note : { A2: 110, "C#3": 138.59131548843604 }[note];
      assert.ok(hz > 0, "fixture knows the selected note");
      return { transpose(semitones) {
        calls.push(["transpose", semitones]);
        return { toFrequency() { calls.push(["toFrequency"]); return hz * 2 ** (semitones / 12); } };
      } };
    } } });
    vm.runInContext(["bassNote", "pianoBass", "bassOut"].map(name => extractFunction(main, name)).join("\n"), ctx);
    for (const note of [110, "A2", 138.59131548843604, "C#3"]) {
      calls.length = 0;
      const output = ctx.bassOut(note);
      if (!piano && !chipBass) {
        assert.equal(output, note, "the original value and string/number type survive unchanged");
        assert.equal(typeof output, typeof note);
        assert.deepEqual(calls, [], "the off route never enters Tone.Frequency");
      } else {
        const hz = typeof note === "number" ? note : { A2: 110, "C#3": 138.59131548843604 }[note];
        assert.equal(output, hz * 2);
        assert.deepEqual(calls, [["Frequency", note], ["transpose", 12], ["toFrequency"]], `PIANO=${piano}, CHIP_BASS=${chipBass}: never two octave shifts`);
      }
    }
  }
});

test("Piano changes only the bass wrapper at all six sites, preserving the full grid clock and opening breath", () => {
  let sites = 0;
  for (const [name, expectedSites] of [["onGrid", 5], ["themeBreath", 1]]) {
    const current = extractFunction(main, name).replace(/\r\n/g, "\n");
    const before = fixture.functions[name];
    assert.equal((current.match(/bass\.triggerAttackRelease\(bassOut\(/g) || []).length, expectedSites, name);
    assert.equal((before.match(/bass\.triggerAttackRelease\(bassNote\(/g) || []).length, expectedSites, name);
    assert.equal(current.includes("bassNote("), false, `${name} has no bypass of the selector`);
    assert.equal(current.replace(/\bbassOut\(/g, "bassNote("), before, `${name}: note expressions, durations, time, velocities, guards, tick steps, RNG and field hooks stay exact`);
    assert.doesNotMatch(current, /new\s+Tone\./, "the clock never constructs an instrument");
    sites += expectedSites;
  }
  assert.equal(sites, 6);
  assert.equal((main.match(/bass\.triggerAttackRelease\(/g) || []).length, 6, "no unexamined bass trigger appeared elsewhere");
});

test("Piano keeps WASD notes, volley chords and the Bow resolution unchanged", () => {
  for (const name of ["wasdLanePress", "volleyNote", "bowEnterHold"]) {
    const current = extractFunction(main, name).replace(/\r\n/g, "\n");
    assert.equal(current, fixture.functions[name], `${name}: original grading, notes, schedules and velocities`);
    assert.doesNotMatch(current, /new\s+Tone\./, `${name} reuses the built voices`);
  }
  assert.equal((fixture.functions.volleyNote.match(/padChord\(/g) || []).length, 2);
  assert.equal((fixture.functions.bowEnterHold.match(/padChord\(/g) || []).length, 1);
  // P4 can add a quiet-door guard. Its existing chord arguments remain musical truth.
  assert.ok(extractFunction(main, "doorCross").includes("padChord(tonic,'16n',at,Math.max(0,+TD.padPeakVel||0))"));
});
