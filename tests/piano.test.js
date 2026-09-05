"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { captureGraph, chipDefaults, pianoDefaults, extractFunction, normalize } = require("./chip-graph.js");

const beforePiano = fs.readFileSync(path.join(__dirname, "fixtures/piano-off.js"), "utf8");
const frozenHashes = {
  dutyToWidth: "c177fee22e4f742023fe55bb5045307fd91e8a1ab46e3bf3c416a76082668c2e",
  buildDrums: "0d5395bda96826dee3a468c13003ca0bce13ab7e35389721f714a0662b811cf3",
  initAudio: "445fd5351d8e14578bfd2a253ae9b70d446d67541ba4217f8592fdd169ba017f",
  sfx: "4aee30931e5ea1ba5c77998e581c7baee056c7565743256542d791cd04b1e031",
  playHit: "c98093d5cce094a682aa135e18664f033e637c7e99297b0adba07cf3a0ddb9cf",
  playFireLaunch: "835871984de83d85ff46f6a4a03816eb27cabca50d0eb2bc81f0900b6e1a06da"
};
const chipNames = ["lead", "dry", "bass", "hums", "pad", "tune", "drums"];
const chipCombinations = Array.from({ length: 128 }, (_, mask) => Object.fromEntries(chipNames.map((name, i) => [name, !!(mask & (1 << i))])));
const expectedPatch = {
  harmonicity: 3, modulationIndex: 2.2,
  oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 1.1, sustain: 0.04, release: 0.55 },
  modulation: { type: "sine" },
  modulationEnvelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.18 }
};

test("Piano frozen fixture authenticates the as-found chip graph and later SFX seams", () => {
  for (const [name, hash] of Object.entries(frozenHashes)) {
    const body = extractFunction(beforePiano, name).replace(/\r\n/g, "\n");
    assert.equal(createHash("sha256").update(body).digest("hex"), hash, name);
  }
  assert.equal(extractFunction(main, "dutyToWidth"), extractFunction(beforePiano, "dutyToWidth"));
});

test("Piano authored defaults make the keyboard and soft calls the night, with URL-only escapes", () => {
  const declaration = main.match(/^\s+piano:(\{[^\n]+\}),\s*\/\//m);
  assert.ok(declaration, "CFG owns the one piano patch and key-length controls");
  assert.deepEqual(normalize(vm.runInNewContext(`(${declaration[1]})`)), pianoDefaults);
  assert.equal(pianoDefaults.on, true);
  assert.equal(pianoDefaults.hums, true);
  const ctx = vm.createContext({});
  vm.runInContext(extractFunction(main, "resolvePiano"), ctx);
  for (const search of ["", "?chip=lead,bass,pad", "?pianoHums=0"]) assert.equal(ctx.resolvePiano(search, pianoDefaults), true, search);
  assert.equal(ctx.resolvePiano("?piano=0", pianoDefaults), false);
  assert.match(main, /const PIANO=resolvePiano\(location\.search\+location\.hash,CFG\.piano\)/);
});

test("Piano resolver covers explicit booleans, hashes, encoded values, unknowns and first occurrence", () => {
  const ctx = vm.createContext({});
  vm.runInContext(extractFunction(main, "resolvePiano"), ctx);
  for (const authored of [false, true]) {
    const cfg = Object.freeze({ on: authored });
    for (const search of ["", "?chip=all", "?notpiano=1", "?piano=maybe", "?piano=2", "?piano=%20on%20", "?Piano=1"]) {
      assert.equal(ctx.resolvePiano(search, cfg), authored, `${search} retains ${authored}`);
    }
    for (const value of ["1", "true", "on", "all", "TRUE", "%6fn"]) {
      for (const prefix of ["piano=", "?piano=", "#piano=", "?hi&piano="]) {
        assert.equal(ctx.resolvePiano(prefix + value, cfg), true, prefix + value);
      }
    }
    for (const value of ["", "0", "false", "off", "OFF", "%6fff", "%E0%A4%A"]) {
      assert.equal(ctx.resolvePiano("?piano=" + value, cfg), false, `explicit off ${value}`);
    }
    assert.equal(ctx.resolvePiano("?piano=off#piano=on", cfg), false);
    assert.equal(ctx.resolvePiano("?piano=on&piano=off", cfg), true);
    assert.equal(ctx.resolvePiano("?piano=unknown#piano=on", cfg), authored);
  }
  assert.equal(ctx.resolvePiano("", { on: 1 }), false, "authored fallback requires literal true");
});

test("Piano patch returns fresh pure FM options without constructing nodes or reading gameplay", () => {
  const forbidden = new Proxy({}, { get(_target, key) { assert.fail(`patch touched ${String(key)}`); } });
  const cfg = Object.freeze({ piano: Object.freeze({ ...pianoDefaults }) });
  const ctx = vm.createContext({ CFG: cfg, Tone: forbidden, state: forbidden, Math: forbidden });
  vm.runInContext('"use strict";\n' + extractFunction(main, "pianoPatch"), ctx);
  const first = ctx.pianoPatch(), second = ctx.pianoPatch();
  assert.deepEqual(normalize(first), expectedPatch);
  assert.deepEqual(normalize(second), expectedPatch);
  for (const key of ["oscillator", "envelope", "modulation", "modulationEnvelope"]) assert.notEqual(first[key], second[key], key);
  first.envelope.decay = 999;
  first.oscillator.type = "square";
  assert.deepEqual(normalize(ctx.pianoPatch()), expectedPatch);
  assert.equal(cfg.piano.decay, 1.1);

  ctx.CFG = { piano: { ...pianoDefaults, harm: 2, mod: 1.25, attack: 0.003, decay: 0.8, sustain: 0.02, release: 0.4 } };
  const custom = ctx.pianoPatch();
  assert.equal(custom.harmonicity, 2);
  assert.equal(custom.modulationIndex, 1.25);
  assert.deepEqual(normalize(custom.envelope), { attack: 0.003, decay: 0.8, sustain: 0.02, release: 0.4 });
  assert.deepEqual(normalize(custom.modulationEnvelope), expectedPatch.modulationEnvelope);
});

test("Piano key length clamps tightness and reads authored bounds without changing timing", () => {
  const ctx = vm.createContext({ CFG: { piano: { ...pianoDefaults } }, Math });
  vm.runInContext(extractFunction(main, "pianoDur"), ctx);
  for (const [q, expected] of [[-5, 0.07], [0, 0.07], [0.5, 0.245], [1, 0.42], [5, 0.42]]) {
    assert.ok(Math.abs(ctx.pianoDur(q) - expected) < 1e-12, `tightness ${q}`);
  }
  ctx.CFG.piano.shortSec = "0.1";
  ctx.CFG.piano.longSec = "0.3";
  assert.equal(ctx.pianoDur(0), 0.1);
  assert.equal(ctx.pianoDur(0.5), 0.2);
  assert.equal(ctx.pianoDur(1), 0.3);
  ctx.CFG.piano.shortSec = 0;
  ctx.CFG.piano.longSec = undefined;
  assert.equal(ctx.pianoDur(0), 0.07);
  assert.equal(ctx.pianoDur(1), 0.42);
});

test("Piano bass helper leaves off-arm values untouched and transposes exactly once when enabled", () => {
  const calls = [];
  const ctx = vm.createContext({ PIANO: false, Tone: { Frequency(note) {
    calls.push(["Frequency", note]);
    return { transpose(semitones) { calls.push(["transpose", semitones]); return { toFrequency() { calls.push(["toFrequency"]); return 440; } }; } };
  } } });
  vm.runInContext(extractFunction(main, "pianoBass"), ctx);
  const note = { fixture: "identity" };
  assert.equal(ctx.pianoBass(note), note);
  assert.equal(ctx.pianoBass("A2"), "A2");
  assert.deepEqual(calls, []);
  ctx.PIANO = true;
  assert.equal(ctx.pianoBass("A3"), 440);
  assert.deepEqual(calls, [["Frequency", "A3"], ["transpose", 12], ["toFrequency"]]);
});

test("Piano off preserves all 128 as-found chip node graphs, options and connection order", () => {
  for (const flags of chipCombinations) {
    const expected = captureGraph(beforePiano, flags);
    const actual = captureGraph(main, { ...flags, piano: false }, {}, { on: true, harm: 99 });
    assert.deepEqual(actual, expected, JSON.stringify(flags));
    assert.equal(actual.nodes.some(node => node.name === "FMSynth"), false);
  }
});

test("Piano graph is six shared-patch keyboard voices, the exact woodblock and no percussion", () => {
  const graph = captureGraph(main, { piano: true });
  const node = (name, ...args) => ({ name, args });
  const bus = [node("Volume", -5), node("Destination")];
  const fm = node("FMSynth", expectedPatch);
  const lp = node("Filter", 4200, "lowpass");
  const expected = {
    drumBus: bus, kick: null, snare: null, hat: null, shotCue: null,
    tick: [node("Synth", { oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } }), node("Volume", 3), ...bus],
    bass: [fm, node("Volume", -8), ...bus],
    arp: [fm, lp, node("FeedbackDelay", { delayTime: "8n", feedback: 0.2, wet: 0.28 }), node("Volume", -9), ...bus],
    tapSynth: [fm, lp, node("Volume", -11), ...bus],
    pad: [node("PolySynth", { constructor: "FMSynth" }, expectedPatch), lp, node("Volume", -17), ...bus],
    lead: [fm, lp, node("FeedbackDelay", { delayTime: "8n", feedback: 0.18, wet: 0.2 }), node("Volume", -8), ...bus],
    leadLp: [lp, node("FeedbackDelay", { delayTime: "8n", feedback: 0.18, wet: 0.2 }), node("Volume", -8), ...bus],
    tune: [fm, lp, node("FeedbackDelay", { delayTime: "8n", feedback: 0.12, wet: 0.15 }), node("Volume", -5), ...bus]
  };
  assert.deepEqual(graph.routes, expected);
  assert.equal(graph.nodes.length, 23);
  assert.equal(graph.nodes.filter(n => n.name === "FMSynth").length, 5);
  assert.equal(graph.nodes.filter(n => n.name === "PolySynth").length, 1);
  assert.equal(graph.nodes.filter(n => n.name === "Synth").length, 1, "only the woodblock remains a basic Synth");
  assert.equal(graph.nodes.some(n => ["NoiseSynth", "MembraneSynth"].includes(n.name)), false);
  assert.deepEqual(graph.routes.tick, captureGraph(beforePiano).routes.tick);
});

test("Piano outranks every chip voicing combination while the existing dry switch alone chooses delay topology", () => {
  const wet = captureGraph(main, { piano: true }), dry = captureGraph(main, { piano: true, dry: true });
  for (const flags of chipCombinations) {
    assert.deepEqual(captureGraph(main, { ...flags, piano: true }), flags.dry ? dry : wet, JSON.stringify(flags));
  }
  assert.deepEqual(captureGraph(main, { ...chipDefaults, piano: true }), dry, "the authored chip defaults also select the dry piano graph");
  const routesWithoutDelay = Object.fromEntries(Object.entries(wet.routes).map(([name, route]) => [name, route && route.filter(node => node.name !== "FeedbackDelay")]));
  assert.deepEqual(dry.routes, routesWithoutDelay);
  assert.equal(dry.nodes.filter(n => n.name === "FeedbackDelay").length, 0, "dry constructs no dormant delays");
  assert.equal(wet.nodes.length - dry.nodes.length, 3);
});

test("Piano patch controls reach all six voices and the five safety filters without chip overrides", () => {
  const graph = captureGraph(main, { ...chipDefaults, piano: true }, { leadLpHz: 12345, bassDb: -30 }, { harm: 2, mod: 1.5, lpHz: 3600, bassDb: -10 });
  for (const voice of ["bass", "arp", "tapSynth", "pad", "lead", "tune"]) {
    const args = graph.routes[voice][0].args;
    const patch = args[voice === "pad" ? 1 : 0];
    assert.equal(patch.harmonicity, 2, voice);
    assert.equal(patch.modulationIndex, 1.5, voice);
    assert.deepEqual(patch.oscillator, { type: "sine" }, voice);
  }
  const filters = graph.nodes.filter(node => node.name === "Filter");
  assert.equal(filters.length, 5);
  for (const filter of filters) assert.deepEqual(filter.args, [3600, "lowpass"]);
  assert.equal(graph.routes.bass[1].name, "Volume");
  assert.equal(graph.routes.bass[1].args[0], -10);
});

test("Piano pad forwards whole chords and exact caller arguments even with chip pad on, with no mono cleanup", () => {
  for (const chipPad of [false, true]) {
    const calls = [], token = {};
    const forbidden = new Proxy({}, { get(_target, key) { assert.fail(`poly pad entered mono ${String(key)}`); } });
    const pad = { triggerAttackRelease(...args) { calls.push(args); return token; } };
    const ctx = vm.createContext({ PIANO: true, CHIP_PAD: chipPad, pad, Tone: forbidden, CFG: forbidden });
    vm.runInContext(["padChord", "padChipStop"].map(name => extractFunction(main, name)).join("\n"), ctx);
    const chord = [220, 275, 330];
    assert.equal(ctx.padChord(chord, "2n", 4, 0.2), token);
    assert.equal(calls[0][0], chord, "the original chord array is forwarded by identity");
    assert.deepEqual(calls[0], [chord, "2n", 4, 0.2]);
    assert.equal(ctx.padChord("A3", 0.42, undefined, undefined), token);
    assert.deepEqual(calls[1], ["A3", 0.42, undefined, undefined]);
    ctx.padChipStop();
    ctx.padChipStop(10);
    assert.equal(calls.length, 2, "cleanup adds no trigger, release, oscillator or frequency calls");
  }
});
