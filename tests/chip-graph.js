"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const vm = require("node:vm");

function closingDelimiter(source, openAt) {
  let depth = 0, quote = "", lineComment = false, blockComment = false;
  for (let i = openAt; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) return i;
  }
  throw new Error("unclosed function");
}

function extractFunction(source, name) {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} exists as a named function`);
  const start = source.indexOf("{", match.index + match[0].length);
  return source.slice(match.index, closingDelimiter(source, start) + 1);
}

function normalize(value) {
  if (typeof value === "function") return { constructor: value.toneName || value.name };
  if (value === undefined) return { undefined: true };
  if (Array.isArray(value)) return Array.from(value, normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k])]));
  return value;
}

const voices = ["drumBus", "kick", "snare", "hat", "tick", "shotCue", "bass", "arp", "tapSynth", "pad", "lead", "leadLp", "tune"];
const chipDefaults = { lead: true, dry: true, bass: true, hums: true, pad: false, humHarmony: true, dutyFull: 0.5, dutyEdge: 0.125, leadLpHz: 9000, bassDb: -9, humDuty: 0.5, humOctave: -1, humGain: 0.22, humHarmonics: 32, padDuty: 0.25, arpHz: 30 };
const pianoDefaults = { on: true, hums: true, harm: 3, mod: 2.2, attack: 0.002, decay: 1.1, sustain: 0.04, release: 0.55, shortSec: 0.07, longSec: 0.42, lpHz: 4200, bassDb: -8 };

function captureGraph(source, flags = {}, chip = {}, piano = {}) {
  const events = [], nodes = [], edges = [];
  const destination = { id: "destination" };
  const Tone = { Destination: destination };
  for (const name of ["Volume", "Filter", "MembraneSynth", "NoiseSynth", "Synth", "FMSynth", "PolySynth", "FeedbackDelay"]) {
    const ctor = function (...args) {
      this.id = `n${nodes.length}`;
      this.name = name;
      this.args = normalize(args);
      this.oscillator = { width: { value: 0 }, frequency: { value: 440 } };
      this.frequency = { value: name === "Filter" ? args[0] : 440 };
      nodes.push({ id: this.id, name, args: this.args });
      events.push({ op: "construct", id: this.id, name, args: this.args });
    };
    ctor.toneName = name;
    ctor.prototype.connect = function (other) {
      assert.ok(other && other.id, `${name}.connect requires a recorded target`);
      edges.push({ from: this.id, to: other.id });
      events.push({ op: "connect", from: this.id, to: other.id });
      return this;
    };
    ctor.prototype.toDestination = function () { return this.connect(destination); };
    Tone[name] = ctor;
  }
  const ctx = vm.createContext({ Tone, Math, Number, PIANO: !!flags.piano, CFG: { chip: { ...chipDefaults, ...chip }, piano: { ...pianoDefaults, ...piano } }, ...Object.fromEntries(["LEAD", "DRY", "BASS", "HUMS", "PAD"].map(k => [`CHIP_${k}`, !!flags[k.toLowerCase()]])) });
  const helper = ["dutyToWidth", "pianoPatch"].filter(name => source.includes(`function ${name}(`)).map(name => extractFunction(source, name)).join("\n");
  vm.runInContext(`var ${voices.join(",")}, tickVol=null, drumsBuilt=false, toneReady=true, TICK_VOL_DB=3; ${helper}\n${extractFunction(source, "buildDrums")}\nbuildDrums();`, ctx);
  assert.equal(ctx.drumsBuilt, true, "buildDrums completed, rather than swallowing a stub failure");
  for (const voice of voices) {
    if (flags.piano && ["kick", "snare", "hat", "shotCue"].includes(voice)) assert.equal(ctx[voice], null, `${voice} is explicitly absent on Piano`);
    else assert.ok(ctx[voice], `${voice} construction did not swallow an error`);
  }
  const roots = Object.fromEntries(voices.map(k => [k, ctx[k] === null ? null : ctx[k].id]));
  function route(id) {
    if (id === destination.id) return [{ name: "Destination", args: [] }];
    const node = nodes.find(n => n.id === id), targets = edges.filter(e => e.from === id);
    assert.equal(targets.length, 1, `${id} should have one outgoing edge`);
    return [{ name: node.name, args: node.args }, ...route(targets[0].to)];
  }
  return { events, nodes, edges, roots, routes: Object.fromEntries(voices.map(k => [k, roots[k] === null ? null : route(roots[k])])) };
}

function baselineSource(root) { return execFileSync("git", ["show", "589c3db:aim-dojo-main.js"], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }); }

function checkOffGraph(main, root) {
  const reference = captureGraph(baselineSource(root));
  const actual = captureGraph(main);
  assert.deepEqual(actual.events, reference.events, "disabled chip constructs baseline nodes/options/edges in exact sequence");
  return reference;
}

function checkLeadGraph(main, reference) {
  const actual = captureGraph(main, { lead: true });
  const expected = structuredClone(reference.events);
  const osc = expected.find(e => e.op === "construct" && e.id === reference.roots.lead);
  osc.args[0].oscillator = { type: "pulse", width: 0 };
  expected.find(e => e.op === "construct" && e.id === reference.roots.leadLp).args[0] = 9000;
  assert.deepEqual(actual.events, expected, "lead on changes exactly its waveform and held filter cutoff");
}

function checkDryGraph(main, reference) {
  const actual = captureGraph(main, { dry: true });
  const expected = structuredClone(reference.routes);
  for (const route of Object.values(expected)) for (let i = route.length - 1; i >= 0; i--) if (route[i].name === "FeedbackDelay") route.splice(i, 1);
  assert.deepEqual(actual.routes, expected, "dry removes delay from the three voice routes without changing options or other routing");
  assert.equal(actual.nodes.filter(n => n.name === "FeedbackDelay").length, 0, "no orphan or wet-zero delay is allocated");
  assert.equal(reference.nodes.length - actual.nodes.length, 3, "exactly three nodes removed");
}

function checkBassGraph(main, reference) {
  const actual = captureGraph(main, { bass: true });
  const expected = structuredClone(reference.routes);
  expected.bass[0].args[0].oscillator.type = "triangle";
  expected.bass.splice(1, 1);
  expected.bass[1].args[0] = -9;
  assert.deepEqual(actual.routes, expected, "bass on is triangle directly into the -9 dB trim");
  assert.equal(reference.nodes.length - actual.nodes.length, 1, "no dormant bass filter allocated");
}

function checkPadGraph(main, reference) {
  const actual = captureGraph(main, { pad: true });
  const expected = structuredClone(reference.routes);
  const options = expected.pad[0].args[1];
  options.oscillator = { type: "pulse", width: -0.5 };
  expected.pad[0] = { name: "Synth", args: [options] };
  assert.deepEqual(actual.routes, expected, "pad on replaces only PolySynth by mono pulse and retains envelope/filter/trim");
  assert.equal(actual.nodes.length, reference.nodes.length, "one channel does not add instruments");
}

module.exports = { baselineSource, captureGraph, chipDefaults, pianoDefaults, extractFunction, normalize, checkOffGraph, checkLeadGraph, checkDryGraph, checkBassGraph, checkPadGraph };
