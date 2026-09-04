"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const wave18Colours = JSON.parse(fs.readFileSync(path.join(__dirname, "moonline-wave18-wall-colours.fixture.json"), "utf8"));

function closingDelimiter(source, openAt, open = "{", close = "}") {
  let depth = 0, quote = "", lineComment = false, blockComment = false;
  for (let index = openAt; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index += 1; } continue; }
    if (quote) { if (char === "\\") index += 1; else if (char === quote) quote = ""; continue; }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === open) depth += 1;
    if (char === close && --depth === 0) return index;
  }
  throw new Error(`unclosed ${open} at ${openAt}`);
}

function extractFunction(source, name) {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} is present as a testable named function`);
  const openAt = source.indexOf("{", match.index + match[0].length);
  return source.slice(match.index, closingDelimiter(source, openAt) + 1);
}

function replaceFunction(source, name, mutate) {
  const before = extractFunction(source, name), after = mutate(before);
  assert.notEqual(after, before, `${name} mutation is constructible`);
  return source.replace(before, after);
}

function mutationMustFail(assertContract, mutation, message) {
  assert.notEqual(mutation, html, `${message} is constructible`);
  assert.throws(() => assertContract(mutation), assert.AssertionError, message);
}

function sourceNumber(source, name) {
  const match = source.match(new RegExp(`\\b${name}=((?:0x)?[0-9a-f.]+)`, "i"));
  assert.ok(match, `${name} is a named numeric constant`);
  return Number(match[1]);
}

function colourAt(bar) { return (bar + 1) * 0x010101; }

function expectedTint(hex, cb) {
  if (cb >= 8) return hex;
  const x = Math.max(0, Math.min(1, cb / 7)), k = 0.45 * x * x * (3 - 2 * x);
  const r = hex >>> 16 & 255, g = hex >>> 8 & 255, b = hex & 255, cool = 0x6f91bc;
  return ((Math.round(r + ((cool >>> 16 & 255) - r) * k) << 16) | (Math.round(g + ((cool >>> 8 & 255) - g) * k) << 8) | Math.round(b + ((cool & 255) - b) * k)) >>> 0;
}

function runTint(source, hex, cb, tide = { riseBars: 6, peakBars: 2, mercyBars: 1 }) {
  const context = vm.createContext({ Math, Number, CFG: { tide }, ML_TIDE_COOL: sourceNumber(source, "ML_TIDE_COOL"), ML_TIDE_COOL_MAX: sourceNumber(source, "ML_TIDE_COOL_MAX") });
  vm.runInContext(`${extractFunction(source, "tideTint")}\nthis.value=tideTint(${hex},${cb});`, context);
  return context.value;
}

function runTide(source, bars, on = true) {
  const context = vm.createContext({
    Math, CFG: { tide: { on, riseBars: 6, peakBars: 2, mercyBars: 1 } },
    _roadTide0: { m: 0, i: 1, cb: 0 }, _roadTideR: { m: 0, i: 1, cb: 0 },
  });
  vm.runInContext(`${extractFunction(source, "roadTideAt")}\nthis.at=roadTideAt;`, context);
  const record = context.at(bars[0] * 4), reused = bars.every((bar) => context.at(bar * 4) === record);
  return { reused, states: bars.map((bar) => { const value = context.at(bar * 4); return { m: value.m, i: value.i, cb: value.cb }; }) };
}

function runPalette(source, { tidePalette = false, walls = true, mercyInverse = true, doorCross = true } = {}) {
  class Colour { constructor() { this.value = null; } setHex(value) { this.value = Number(value) >>> 0; return this; } }
  const col = Array.from({ length: 7 }, () => new Colour()), next = Array.from({ length: 7 }, () => new Colour()), paletteCalls = [], tintCalls = [];
  const pane = { visible: false }, depth = { visible: false }, uniform = () => ({ value: 0 }), uniforms = { uArchN0: uniform(), uWallDissolve: uniform(), uWallGlow: uniform(), uArchH: uniform(), uArchGlow: uniform(), uArchPrism: uniform(), uReflect: uniform(), uMercyRB: uniform() };
  const context = vm.createContext({
    Math, Number, Float32Array,
    CFG: { tide: { on: true, riseBars: 6, peakBars: 2, mercyBars: 1 }, moonline: { tidePalette, doorCross, naveStreetGold: 1, wallDissolve: 95, wallGlow: 1, dustGlow: 1 } },
    ML_TIDE_COOL: sourceNumber(source, "ML_TIDE_COOL"), ML_TIDE_COOL_MAX: sourceNumber(source, "ML_TIDE_COOL_MAX"),
    ML_WALLS: walls, ML_WALL_EXHALE: 1, ML_MERCY_INVERSE: walls && mercyInverse, ML_NAVE: true, ML_WALL_N: 7, ML_ARCH_N: 7, ML_ARCH_EVERY: 4, ML_ARCH_BEHIND: 8, ROAD_HALF_W: 3.5, LOW: false, reduceMotion: false,
    _roadTide0: { m: 0, i: 1, cb: 0 }, _roadTideR: { m: 0, i: 1, cb: 0 }, _archKind: new Float32Array(7), _wallCol: col, _wallNext: next,
    roadMat: { uniforms: { uNaveGold: null } }, roadArchMat: walls ? null : { uniforms }, roadWallMat: walls ? { uniforms } : null, roadMercyInverse: pane, roadMercyInverseDepth: depth, roadDustMat: null,
    roadWallPaletteAt(bar) { paletteCalls.push(bar); return colourAt(bar); }, paletteCalls, tintCalls,
  });
  vm.runInContext(`${extractFunction(source, "tideTint")}\n${extractFunction(source, "roadTideAt")}\n${extractFunction(source, "roadArchFill")}\nconst tintAuthority=tideTint; tideTint=function(hex,cb){ tintCalls.push([hex,cb]); return tintAuthority(hex,cb); }; this.fill=roadArchFill;`, context);
  const frames = [];
  for (let bar = 0; bar < 9; bar += 1) {
    context.fill(8 + bar * 4);
    frames.push({ col: col.map((colour) => colour.value), next: next.map((colour) => colour.value), kind: Array.from(context._archKind) });
  }
  return { frames, paletteCalls: Array.from(paletteCalls), tintCalls: Array.from(tintCalls, (entry) => Array.from(entry)), pane: pane.visible, depth: depth.visible };
}

function frameColours(run) { return { col: run.frames.map((frame) => frame.col), next: run.frames.map((frame) => frame.next) }; }

function expectedActiveColours() {
  const result = { col: [], next: [] };
  for (let bar = 0; bar < 9; bar += 1) {
    result.col.push(Array.from({ length: 7 }, (_unused, slot) => expectedTint(colourAt(bar + slot), (bar + slot) % 9)));
    result.next.push(Array.from({ length: 7 }, (_unused, slot) => expectedTint(colourAt(bar + slot + 1), (bar + slot) % 9 + 1)));
  }
  return result;
}

test("Tide chalk uses the named powder mix, smooth approach, and an untinted mercy bar", () => {
  const assertContract = (source) => {
    assert.match(source, /tidePalette:1(?:,|\s)/, "the shipped knob is one flat literal");
    assert.equal(sourceNumber(source, "ML_TIDE_COOL"), 0x6f91bc); assert.equal(sourceNumber(source, "ML_TIDE_COOL_MAX"), 0.45);
    const base = 0xbf7486, actual = Array.from({ length: 9 }, (_unused, cb) => runTint(source, base, cb)), expected = Array.from({ length: 9 }, (_unused, cb) => expectedTint(base, cb));
    assert.deepEqual(actual, expected);
    const cool = 0x6f91bc, channels = (hex) => [hex >>> 16 & 255, hex >>> 8 & 255, hex & 255], target = channels(cool), distance = (hex) => Math.hypot(...channels(hex).map((value, index) => value - target[index]));
    for (let cb = 1; cb < 8; cb += 1) assert.ok(distance(actual[cb]) <= distance(actual[cb - 1]), `bar ${cb} moves monotonically toward powder`);
    assert.equal(actual[0], base, "the trough is unblended"); assert.notEqual(actual[7], base, "the final peak reaches the named mix"); assert.equal(actual[8], base, "the mercy pane keeps its own chalk");
  };
  assertContract(html);
  mutationMustFail(assertContract, html.replace("ML_TIDE_COOL=0x6f91bc", "ML_TIDE_COOL=0xbf7486"), "the pigment oracle kills a warm self-mix");
  mutationMustFail(assertContract, html.replace("ML_TIDE_COOL_MAX=0.45", "ML_TIDE_COOL_MAX=0.30"), "the amount oracle kills a weaker maximum");
  mutationMustFail(assertContract, replaceFunction(html, "tideTint", (fn) => fn.replace("s=x*x*(3-2*x)", "s=x")), "the envelope oracle kills a linear ramp");
  mutationMustFail(assertContract, replaceFunction(html, "tideTint", (fn) => fn.replace("cb>=rise+peak", "cb>rise+peak")), "the mercy oracle kills a tinted inverse pane");
});

test("roadTideAt exposes the existing cycle bar on its allocation-free shared record", () => {
  const assertContract = (source) => {
    assert.match(source, /_roadTide0=\{m:0,i:1,cb:0\}, _roadTideR=\{m:0,i:1,cb:0\}/);
    assert.match(extractFunction(source, "roadTideAt"), /_roadTideR\.cb = cb;/);
    const bars = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], active = runTide(source, bars);
    assert.equal(active.reused, true, "every active lookup returns the one shared record");
    assert.deepEqual(active.states.map((state) => state.cb), [8, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1]);
    const quiet = runTide(source, bars, false); assert.equal(quiet.reused, true); assert.ok(quiet.states.every((state) => state.cb === 0 && state.m === 0 && state.i === 1));
    const fill = extractFunction(source, "roadArchFill"); assert.match(fill, /tide=roadTideAt\(b\), cb=tide\.cb/); assert.doesNotMatch(fill, /cb[^;\n]*%/, "the colour path cannot reconstruct the cycle with another modulo");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "roadTideAt", (fn) => fn.replace("_roadTideR.cb = cb", "_roadTideR.cb = bar")), "the cycle oracle kills an absolute-bar leak");
  mutationMustFail(assertContract, replaceFunction(html, "roadArchFill", (fn) => fn.replace("cb=tide.cb", "cb=((Math.floor(b/ML_ARCH_EVERY)%9)+9)%9")), "the authority oracle kills a second modulo");
});

test("tidePalette:0 freezes both wall arrays for a full cycle and every coupled switch stands alone", () => {
  const assertContract = (source) => {
    const off = runPalette(source, { tidePalette: false });
    assert.deepEqual(frameColours(off), wave18Colours, "tidePalette:0 preserves the frozen Wave 18 colour arrays for all nine bars");
    assert.equal(off.tintCalls.length, 0); assert.equal(off.paletteCalls.length, 126, "the off arm keeps exactly two palette lookups per active wall slot");
    const expected = expectedActiveColours(), reference = frameColours(runPalette(source, { tidePalette: true }));
    assert.deepEqual(reference, expected);
    for (const doorCross of [false, true]) for (const mercyInverse of [false, true]) for (const tidePalette of [false, true]) for (const walls of [false, true]) {
      const run = runPalette(source, { doorCross, mercyInverse, tidePalette, walls }), colours = frameColours(run);
      if (!walls) {
        assert.ok(colours.col.flat().every((value) => value === null) && colours.next.flat().every((value) => value === null));
        assert.equal(run.tintCalls.length, 0);
      } else if (!tidePalette) {
        assert.deepEqual(colours, wave18Colours, `off fixture survives door=${doorCross} inverse=${mercyInverse}`); assert.equal(run.tintCalls.length, 0);
      } else {
        assert.deepEqual(colours, expected, `live tint survives door=${doorCross} inverse=${mercyInverse}`); assert.equal(run.tintCalls.length, 126);
      }
    }
    for (const frame of runPalette(source, { tidePalette: true }).frames) for (let slot = 0; slot < 6; slot += 1) assert.equal(frame.next[slot], frame.col[slot + 1], "cb+1 keeps the station crossfade continuous");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "roadArchFill", (fn) => fn.replace("tidePalette=!!M.tidePalette", "tidePalette=!!M.doorCross")), "the alone matrix kills a tidePalette/doorCross cross-wire");
  mutationMustFail(assertContract, replaceFunction(html, "roadArchFill", (fn) => fn.replace("tideTint(next,cb+1)", "tideTint(next,cb)")), "the continuity oracle kills a same-bar next colour");
  mutationMustFail(assertContract, replaceFunction(html, "roadArchFill", (fn) => fn.replace("col=roadWallPaletteAt(bar)", "col=roadWallPaletteAt(bar+1)")), "the frozen fixture kills a shifted private walk");
});

test("the private palette stream and every ghost seat remain outside the tide", () => {
  const assertContract = (source) => {
    const palette = extractFunction(source, "roadWallPalette"), fill = extractFunction(source, "roadArchFill"), ghostNight = extractFunction(source, "ghostNightPalette"), ghostSeat = extractFunction(source, "ghostSeatPalette");
    assert.equal((palette.match(/\brr\(\)/g) || []).length, 2, "the private walk still spends exactly two draws per chamber");
    assert.doesNotMatch(palette, /tideTint|tidePalette|roadTideAt/, "the seeded 512-bar walk never learns the live tide");
    assert.equal((fill.match(/roadWallPaletteAt\(/g) || []).length, 2); assert.match(fill, /col=roadWallPaletteAt\(bar\), next=roadWallPaletteAt\(bar\+1\);[\s\S]*tideTint\(col,cb\)[\s\S]*tideTint\(next,cb\+1\)/);
    assert.doesNotMatch(`${ghostNight}\n${ghostSeat}`, /tideTint|tidePalette|roadTideAt|_roadTideR/, "a ghost keeps the chalk of its own night");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "roadWallPalette", (fn) => fn.replace("rr()*n", "rr()*rr()*n")), "the stream oracle kills a third private draw");
  mutationMustFail(assertContract, replaceFunction(html, "ghostSeatPalette", (fn) => fn.replace("setHex(_ghNightChalk[i])", "setHex(tideTint(_ghNightChalk[i],0))")), "the ghost oracle kills a live-night tint");
});
