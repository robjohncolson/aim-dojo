"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { ROOT, main, sourceFor } = require("./source.js");
const { baselineSource, extractFunction, checkOffGraph, checkLeadGraph, checkDryGraph, checkBassGraph } = require("./chip-graph.js");
const baseline = baselineSource(ROOT);

test("chip bass raises Hz and named notes one octave and is a strict identity when off", () => {
  const calls = [];
  const ctx = vm.createContext({ CHIP_BASS: false, Tone: { Frequency(n) {
    calls.push(n);
    let hz = typeof n === "number" ? n : ({ C1: 32.70319566257483, A1: 55, A2: 110 })[n];
    return { transpose(semitones) { assert.equal(semitones, 12); hz *= 2 ** (semitones / 12); return this; }, toFrequency() { return hz; } };
  } } });
  vm.runInContext(extractFunction(sourceFor("bassNote"), "bassNote"), ctx);
  for (const note of [55, 43.65, "C1", "A1", undefined, { hz: 55 }]) assert.strictEqual(ctx.bassNote(note), note);
  assert.equal(calls.length, 0, "disabled arm never allocates a Tone frequency object");
  ctx.CHIP_BASS = true;
  for (const note of [41.2, 43.65, 49, 55, 69.3, 73.42, 82.41]) assert.equal(ctx.bassNote(note), note * 2);
  assert.equal(ctx.bassNote("C1"), 65.40639132514966);
  assert.equal(ctx.bassNote("A1"), 110);
  assert.equal(ctx.bassNote("A2"), 220);
});

test("every bass trigger uses the octave helper without changing its schedule or velocity", () => {
  const lines = main.split("\n").filter(line => line.includes("bass.triggerAttackRelease("));
  const oldLines = baseline.split("\n").filter(line => line.includes("bass.triggerAttackRelease("));
  assert.equal(lines.length, 6);
  assert.equal(lines.length, oldLines.length);
  lines.forEach((line, i) => {
    assert.match(line, /bass\.triggerAttackRelease\(bassNote\(/);
    const oldArgs = oldLines[i].slice(oldLines[i].indexOf("bass.triggerAttackRelease(") + 26).split(",");
    const newArgs = line.slice(line.indexOf("bass.triggerAttackRelease(") + 26).split(",");
    assert.deepEqual(newArgs.slice(1), oldArgs.slice(1));
  });
});

test("chip bass changes only waveform, filter removal and trim in the voice graph", () => {
  checkBassGraph(main, checkOffGraph(main, ROOT));
});

test("dry chip removes exactly three delay nodes and preserves every other voice route", () => {
  checkDryGraph(main, checkOffGraph(main, ROOT));
});

test("chip URL selects exactly the audition voices without persistence", () => {
  const ctx = vm.createContext({});
  vm.runInContext(extractFunction(sourceFor("resolveChip"), "resolveChip"), ctx);
  const cfg = { lead: true, dry: false, bass: false, hums: false, pad: false };
  const flags = search => Array.from(ctx.resolveChip(search, cfg));
  assert.deepEqual(flags(""), [true, false, false, false, false]);
  assert.deepEqual(flags("?hi"), [true, false, false, false, false]);
  for (const query of ["?chip=0", "?chip=", "?chip=unknown", "?chip=%broken"]) assert.deepEqual(flags(query), Array(5).fill(false));
  assert.deepEqual(flags("?chip=lead,dry"), [true, true, false, false, false]);
  assert.deepEqual(flags("?low&chip=bass%2Chums#other"), [false, false, true, true, false]);
  assert.deepEqual(flags("#chip=all"), Array(5).fill(true));
  assert.deepEqual(flags("?chip=lead,pad"), [true, false, false, false, true]);
  assert.deepEqual(flags(""), [true, false, false, false, false], "a URL audition never changes CFG defaults");
});

test("pulse width expresses HIGH duty with correct sign, clamp and monotonicity", () => {
  const ctx = vm.createContext({});
  vm.runInContext(extractFunction(sourceFor("dutyToWidth"), "dutyToWidth"), ctx);
  const f = ctx.dutyToWidth;
  for (const [d, w] of [[-1, -.9], [0, -.9], [.05, -.9], [.125, -.75], [.25, -.5], [.5, 0], [1, 0]]) assert.ok(Math.abs(f(d) - w) < 1e-12);
  for (let i = 1; i <= 450; i++) assert.ok(f(.05 + i / 1000) > f(.05 + (i - 1) / 1000));
  for (const d of [.05, .125, .25, .5]) {
    let high = 0;
    for (let i = 0; i < 100000; i++) if (1 - 4 * Math.abs((i + .5) / 100000 - .5) + f(d) > 0) high++;
    assert.ok(Math.abs(high / 100000 - d) <= 1e-5, "Tone's triangle-plus-width threshold spends the requested fraction HIGH");
  }
});

test("disabled chip graph exactly matches the 589c3db constructor and edge fixture", () => {
  checkOffGraph(main, ROOT);
});

test("pulse lead changes only lead waveform and fixed safety cutoff", () => {
  checkLeadGraph(main, checkOffGraph(main, ROOT));
});

function hit(source, chip, q, options = {}) {
  const calls = [], oscillator = { width: { value: 0 } }, leadLp = { frequency: { value: chip ? 9000 : 3800 } };
  const voice = { oscillator, triggerAttackRelease(...args) { calls.push(args); } };
  const cfgVoice = vm.runInNewContext(`({${main.match(/\bvoice:\{([^}]+)\}/)[1]}})`);
  const ctx = vm.createContext({
    CHIP_LEAD: chip, CFG: { chip: { dutyFull: .5, dutyEdge: .125 }, voice: { ...cfgVoice, on: options.shaped !== false } },
    lead: options.fallback ? null : voice, synthHit: voice, leadLp, soundOn: true, toneReady: true,
    voiceLive: () => true, voiceMuted: () => !!options.muted, voiceQ: () => q, beatSnap: () => 4,
    state: { streak: 2 }, PENTA: [277.18, 329.63, 369.99], _voiceStack: options.stack || 0,
  });
  const duty = source.includes("function dutyToWidth(") ? extractFunction(source, "dutyToWidth") : "";
  vm.runInContext(`${duty}\nfunction voiceBreak(){ _voiceStack=0; }\n${extractFunction(source, "playHit")}\nplayHit(${options.grade ?? 1});`, ctx);
  return { calls, width: oscillator.width.value, cutoff: leadLp.frequency.value, stack: ctx._voiceStack };
}

test("chip tightness writes duty while preserving velocities, grace notes and clank silence", () => {
  const tightness = extractFunction(main, "playHit");
  assert.match(tightness, /if\(CHIP_LEAD\)[\s\S]*lead\.oscillator\.width\.value=dutyToWidth/);
  assert.match(tightness, /else if\(leadLp\) leadLp\.frequency\.value=V\.dullHz/);
  for (const q of [0, .5, 1]) for (const options of [{}, { grade: 0, stack: 0 }, { grade: 0, stack: 2 }, { muted: true }, { shaped: false }, { fallback: true }]) {
    const original = hit(baseline, false, q, options), off = hit(main, false, q, options), on = hit(main, true, q, options);
    assert.deepEqual(off, original, "off arm preserves the baseline hit outcome");
    assert.deepEqual(on.calls, original.calls, "chip duty must not change note scheduling, velocity or clank silence");
    assert.equal(on.stack, original.stack);
    assert.equal(on.cutoff, 9000);
    if (!options.muted && options.shaped !== false && !options.fallback) assert.equal(on.width, -.75 + .75 * q);
  }
});
