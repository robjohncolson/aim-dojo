"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { sourceFor } = require("./source.js");
const { extractFunction } = require("./chip-graph.js");
const main = sourceFor("padChord");
const declaration = main.split("\n").find(line => line.startsWith("let _chipPadAt="));
assert.ok(declaration, "production owns the chip-only pending descriptors");
const source = declaration + "\n" + ["pianoHold", "padChord", "padChipSchedule", "padChipStop"].map(name => extractFunction(main, name)).join("\n");

function harness(on = true, bpm = 60) {
  let nativeNow=0;
  const calls = { triggers: [], attacks: [], releases: [], frequency: [], cancellations: [], stops: [] };
  const pitch = [], envelope = [], states = [];
  const removeAt = (events, at) => { for (let i = events.length - 1; i >= 0; i--) if (events[i].at >= at) events.splice(i, 1); };
  function hz(note) {
    if (typeof note === "number") return note;
    const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
    assert.ok(match, `fixture knows ${note}`);
    const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[match[1]] + (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0);
    return 440 * 2 ** ((semis + (Number(match[3]) - 4) * 12) / 12);
  }
  function seconds(value) {
    if (value === undefined) return 0;
    if (typeof value === "number") return value;
    if (/^\d+n$/.test(value)) return 4 / parseInt(value, 10) * 60 / bpm;
    if (value.startsWith("+")) return Number(value.slice(1));
    throw new Error(`unknown fixture time: ${value}`);
  }
  const frequency = {
    setValueAtTime(value, at) {
      calls.frequency.push([value, at]);
      for (let i = pitch.length - 1; i >= 0; i--) if (pitch[i].at === at) pitch.splice(i, 1);
      pitch.push({ value, at }); pitch.sort((a, b) => a.at - b.at);
      return this;
    },
    cancelScheduledValues(at) { calls.cancellations.push(at); removeAt(pitch, at); return this; }
  };
  const oscillator = {
    frequency,
    start(at) {
      const state = [...states].sort((a, b) => a.at - b.at).filter(e => e.at <= at).at(-1);
      if (state?.value === "started") assert.ok(at > state.at, "Start time must be strictly greater than previous start time");
      removeAt(states, at); states.push({ value: "started", at });
    },
    stop(at) { calls.stops.push(at); removeAt(states, at); states.push({ value: "stopped", at }); }
  };
  const pad = {
    oscillator, frequency,
    envelope: { cancel(at) { removeAt(envelope, at); } },
    triggerAttack(note, at, vel) {
      calls.attacks.push([note, at, vel]);
      // Tone Synth -> Envelope.triggerAttack replaces future amplitude events;
      // Source.start restarts an existing oscillator but rejects equal times.
      removeAt(envelope, at); envelope.push({ value: "attack", at });
      oscillator.start(at);
      frequency.setValueAtTime(hz(note), at);
    },
    triggerRelease(at) {
      calls.releases.push(at); removeAt(envelope, at); envelope.push({ value: "release", at });
      oscillator.stop(at + 0.8);
    },
    triggerAttackRelease(...args) {
      calls.triggers.push(args);
      if (!on) return this;
      const [note, duration, at, vel] = args;
      this.triggerAttack(note, at, vel); this.triggerRelease(at + seconds(duration)); return this;
    }
  };
  const ctx = vm.createContext({ pad, PIANO: false, CHIP_PAD: on, CFG: { chip: { arpHz: 30 } }, Tone: { Time: value => ({ toSeconds: () => seconds(value) }), Frequency: value => ({ toFrequency: () => hz(value) }), now: () => nativeNow+0.1, immediate: () => nativeNow }, Math, Number, Array });
  vm.runInContext(source, ctx);
  return { ctx, calls, pitch, envelope, states, pad, advance: value=>nativeNow=value, tempo: value=>bpm=value };
}

test("chip pad off forwards the original values and array without automation or cleanup", () => {
  const h = harness(false), notes = [220, 275, 330];
  h.ctx.padChord(notes, "2n", 4, 0.2); h.ctx.padChipStop(4.5);
  assert.equal(h.calls.triggers.length, 1);
  assert.equal(h.calls.triggers[0][0], notes);
  assert.deepEqual(h.calls.triggers[0], [notes, "2n", 4, 0.2]);
  assert.equal(h.calls.frequency.length, 0);
  assert.equal(h.calls.cancellations.length, 0);
  assert.equal(h.calls.stops.length, 0);
});

test("chip pad single note uses exactly one original trigger with original timing and velocity", () => {
  const h = harness(); h.ctx.padChord("A3", "4n", 5, 0.14);
  assert.deepEqual(h.calls.triggers, [["A3", "4n", 5, 0.14]]);
  assert.deepEqual(h.calls.frequency, [[220, 5]]);
  assert.deepEqual(h.calls.releases, [6]);
});

test("chip pad triad gets one envelope and exactly 60 cyclic pitches for two seconds at 30 Hz", () => {
  const h = harness(); h.ctx.padChord([220, 275, 330], "2n", 4, 0.2);
  assert.deepEqual(h.calls.attacks, [[220, 4, 0.2]]);
  assert.deepEqual(h.calls.releases, [6]);
  assert.equal(h.calls.triggers.length, 0);
  assert.equal(h.calls.frequency.length, 60);
  h.calls.frequency.forEach(([f, at], i) => { assert.equal(f, [220, 275, 330][i % 3]); assert.ok(Math.abs(at - (4 + i / 30)) < 1e-12); });
});

test("chip pad holds the final pitch until release and resolves duration at trigger-time BPM", () => {
  const h = harness(true, 28); h.ctx.padChord([220, 330], "2n", 4, 0.2);
  assert.equal(h.calls.frequency.length, Math.ceil((120 / 28) * 30));
  assert.equal(h.calls.releases[0], 4 + 120 / 28);
  assert.ok(h.calls.frequency.at(-1)[1] < h.calls.releases[0]);
});

test("chip pad snapshots a reused volley array into native automation immediately", () => {
  const h = harness(), notes = [220, 330]; h.ctx.padChord(notes, 0.2, 4, 0.2);
  notes[0] = 999; notes[1] = 999;
  assert.deepEqual(h.calls.frequency.map(e => e[0]), [220, 330, 220, 330, 220, 330]);
});

test("chip pad a later volley replaces a long bar's future pitch events and release", () => {
  const h = harness(); h.ctx.padChord([220, 330], 4, 4, 0.2); h.ctx.padChord([275, 330, 440], 1, 5, 0.3);
  const replacement = h.pitch.filter(e => e.at >= 5);
  assert.equal(replacement.length, 30);
  replacement.forEach((e, i) => assert.equal(e.value, [275, 330, 440][i % 3]));
  assert.deepEqual(h.envelope, [{ value: "attack", at: 4 }, { value: "attack", at: 5 }, { value: "release", at: 6 }]);
  assert.equal(h.states.some(e => e.at === 8.8), false, "old oscillator stop was cancelled by restart");
});

test("chip pad same-at dyad to triad replaces the planned attack without a Tone start assertion", () => {
  const h = harness(); h.ctx.padChord([220, 330], 1, 4, 0.2); h.ctx.padChord([220, 275, 330], 2, 4, 0.3);
  assert.equal(h.calls.stops.includes(4), true);
  assert.equal(h.pitch.length, 60);
  h.pitch.forEach((e, i) => assert.equal(e.value, [220, 275, 330][i % 3]));
  assert.deepEqual(h.envelope, [{ value: "attack", at: 4 }, { value: "release", at: 6 }]);
});

test("chip pad earlier clock event preserves the pending later volley in chronological order", () => {
  const h = harness(); h.ctx.padChord([220, 330], 4, 5, 0.2); h.ctx.padChord([275, 330, 440], 0.5, 4.9, 0.3);
  assert.equal(h.pitch.filter(e=>e.at>=5).length,120);
  assert.equal(h.pitch.find(e=>e.at===5).value,220);
  assert.equal(h.pitch.at(-1).value,330);
  assert.equal(h.calls.stops.includes(4.9), true);
  assert.deepEqual(h.envelope, [{ value: "attack", at: 4.9 }, { value: "attack", at: 5 }, { value: "release", at: 9 }]);
});

test("chip pad a single grace steals the channel and removes a previous chord's pitch sweep", () => {
  const h = harness(); h.ctx.padChord([220, 330], 4, 4, 0.2); h.ctx.padChord(275, 0.1, 5, 0.3);
  assert.deepEqual(h.pitch.filter(e => e.at >= 5), [{ value: 275, at: 5 }]);
  assert.deepEqual(h.calls.triggers, [[275, 0.1, 5, 0.3]]);
});

test("chip pad cleanup cancels native automation and oscillator past a silent boundary, then allows reuse", () => {
  const h = harness(); h.ctx.padChord([220, 330], 4, 4, 0.2); h.ctx.padChipStop(5);
  assert.equal(h.pitch.some(e => e.at >= 5), false);
  assert.equal(h.states.some(e => e.at > 5), false);
  assert.deepEqual(h.states.at(-1), { value: "stopped", at: 5 });
  h.ctx.padChord(275, 0.1, 5.1, 0.3);
  assert.deepEqual(h.calls.triggers, [[275, 0.1, 5.1, 0.3]]);
});

test("chip pad future replay preserves its original duration if tempo changes", () => {
  const h=harness();
  h.ctx.padChord(330,'2n',5,0.2);
  h.tempo(30);
  h.ctx.padChord(220,0.5,4.9,0.3);
  assert.deepEqual(h.calls.triggers,[[330,'2n',5,0.2],[220,0.5,4.9,0.3],[330,2,5,0.2]]);
  assert.equal(h.calls.releases.at(-1),7);
});

test("chip pad replays multiple pending onsets and prunes already-heard descriptors", () => {
  const h=harness();
  h.ctx.padChord(330,1,5.1,0.2);
  h.ctx.padChord(440,1,5.2,0.2);
  h.ctx.padChord(220,1,5,0.2);
  assert.deepEqual(h.envelope,[{value:'attack',at:5},{value:'attack',at:5.1},{value:'attack',at:5.2},{value:'release',at:6.2}]);
  h.advance(5.21);
  h.ctx.padChord(275,1,5.3,0.2);
  assert.equal(vm.runInContext('_chipPadPending.length',h.ctx),1);
});

test("chip pad pause erases pending future onsets so a resumed note never replays them", () => {
  const h=harness();
  h.ctx.padChord(330,1,5,0.2);
  h.ctx.padChord(440,1,5.1,0.2);
  h.ctx.padChipStop(4.95);
  h.advance(4.96);
  h.ctx.padChord(220,0.1,4.99,0.2);
  assert.equal(h.pitch.some(e=>e.value===330||e.value===440),false);
  assert.equal(h.calls.triggers.length,3);
  assert.equal(vm.runInContext('_chipPadPending.length',h.ctx),1);
});

test("chip pad default cleanup uses native now and cancels inside Tone's lookahead", () => {
  const h=harness();
  h.advance(5);
  h.ctx.padChord(330,1,5.05,0.2);
  h.ctx.padChipStop();
  assert.equal(h.calls.cancellations.at(-1),5);
  assert.equal(h.calls.stops.at(-1),5);
  assert.equal(h.pitch.length,0);
  assert.equal(vm.runInContext('_chipPadPending.length',h.ctx),0);
});
