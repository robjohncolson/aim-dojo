"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const { sourceText: html } = require("./source.js");
const wave9Fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "moonline-wave9-shaders.fixture.json"), "utf8"));

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

function shaderFingerprint(value) {
  const out = {};
  for (const [name, source] of Object.entries(value)) {
    if (source == null) { out[name] = null; continue; }
    out[name] = { chars: source.length, sha256: crypto.createHash("sha256").update(source).digest("hex") };
  }
  return out;
}

function productionFeatureFlags(source, moonline) {
  const declarations = ["ML_MARK", "ML_TERRAIN", "ML_BITE", "ML_WALLS", "ML_WALL_EXHALE", "ML_WALL_ECHO", "ML_MERCY_INVERSE", "ML_DOOR_CROSS", "ML_SAT"].map((name) => {
    const match = source.match(new RegExp(`const ${name}=([^;]+);`));
    assert.ok(match, `${name} production gate is extractable`);
    return `const ${name}=${match[1]};`;
  }).join("\n");
  const context = vm.createContext({ CFG: { moonline }, ML_NAVE: true });
  vm.runInContext(`${declarations}\nthis.flags={mark:ML_MARK,terrain:ML_TERRAIN,bite:ML_BITE,walls:ML_WALLS,wallExhale:ML_WALL_EXHALE,wallEcho:ML_WALL_ECHO,mercyInverse:ML_MERCY_INVERSE,doorCross:ML_DOOR_CROSS,sat:ML_SAT};`, context);
  return context.flags;
}

function moonlineOptions(features = {}) {
  const options = {
    naveStreetGold: 1,
    markGlyph: false,
    terrainOn: false,
    terrainAmp: 0,
    curveBite: 0,
    wallsOn: false,
    wallDissolve: 95,
    wallGlow: 1,
    wallExhale: 0,
    wallEcho: false,
    mercyInverse: false,
    wallSat: 0,
    wallPalette: null,
    ...features,
  };
  if (Object.hasOwn(features, "mark")) options.markGlyph = !!features.mark;
  if (Object.hasOwn(features, "terrain")) { options.terrainOn = !!features.terrain; options.terrainAmp = features.terrain ? 1 : 0; }
  if (Object.hasOwn(features, "bite")) options.curveBite = features.bite ? 2.2 : 0;
  if (Object.hasOwn(features, "walls")) options.wallsOn = !!features.walls;
  if (Object.hasOwn(features, "wallExhale")) options.wallExhale = Number(features.wallExhale);
  if (Object.hasOwn(features, "wallEcho")) options.wallEcho = !!features.wallEcho;
  if (Object.hasOwn(features, "mercyInverse")) options.mercyInverse = !!features.mercyInverse;
  if (Object.hasOwn(features, "wallSat")) options.wallSat = Number(features.wallSat);
  return options;
}

function emitWave9RoadShaders(source = html, features = {}) {
  const match = source.match(/\(function buildRoad\(\)\{[\s\S]*?\n\}\)\(\);/);
  assert.ok(match, "buildRoad is extractable for shader emission");
  class DataTexture { constructor() {} }
  class ShaderMaterial { constructor(options) { Object.assign(this, options); } }
  class PlaneGeometry {}
  class BufferGeometry { setAttribute() {} setIndex() {} }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; this.rotation = { x: 0 }; this.position = { y: 0 }; this.children = []; } add(child) { this.children.push(child); child.parent = this; } }
  class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
  class Vector3 {}
  class Points { constructor(geometry, material) { this.geometry = geometry; this.material = material; } }
  const moonline = moonlineOptions(features);
  const flags = productionFeatureFlags(source, moonline);
  const low = !!features.low, horizonN = low ? 0 : 32;
  const context = vm.createContext({
    Math, Number, Float32Array, Uint16Array, LOW: low, EYE: 4, reduceMotion: !!features.reduceMotion,
    CFG: { road: { on: true, bandGlyphs: true, mercyBoost: 1.6 }, moonline },
    ML_RIBBON: true, ML_NAVE: true, ML_MARK: flags.mark, ML_TERRAIN: flags.terrain, ML_BITE: flags.bite, ML_WALLS: flags.walls, ML_WALL_EXHALE: flags.wallExhale, ML_WALL_ECHO: flags.wallEcho, ML_MERCY_INVERSE: flags.mercyInverse, ML_DOOR_CROSS: flags.doorCross, ML_SAT: flags.sat, ML_ARCH: false,
    ML_NAVE_STARS: 0, ML_NAVE_VEIL: 0, ML_DUST_N: features.dust ? 1 : 0, ROAD_GLYPH_PASS: false,
    ROAD_HALF_W: 7, ROAD_MPB: 27, ROAD_PLANE_W: 386, ROAD_PLANE_L: 1776, ROAD_FADE0: 734.4, ROAD_FADE1: 864,
    ROAD_SLOTS: 23, ROAD_WAKE: 14, ROAD_TIER_W: [0.42, 0.58, 1, 1.24], ROAD_TIER_D: 33.16,
    ROAD_LINE_PX: 1.5, ROAD_LINE_MAX: 0.22, ROAD_CELL_INK: 0.34, ROAD_GRID_INK: 0.72, ROAD_RAIL_INK: 0.95,
    ROAD_INK_NOW: 1.15, ROAD_INK_PULSE: 0.85, ROAD_WAKE_DARK: 0.16, ROAD_TIDE_LO: 0.45, ROAD_LANE_MIX: 0.8,
    ROAD_GLYPH_L: 23.22, ROAD_GLYPH_W: 8.68, ROAD_GLYPH_F0: 67.5, ROAD_GLYPH_F1: 121.5, ROAD_INK_GLYPH: 1.3,
    ROAD_ALPHA: 0.55, ROAD_BAND_M: 10, ROAD_INK_BASE: 0.1, ROAD_INK_BODY: 0.16, ROAD_INK_EDGE: 0.9,
    ROAD_TERRAIN_A0: 6, ROAD_TERRAIN_A1: 2.4, ROAD_TERRAIN_A2: 0.9, ROAD_TERRAIN_P0: 22, ROAD_TERRAIN_P1: 13, ROAD_TERRAIN_P2: 10.5,
    ROAD_TERRAIN_HN: horizonN, ROAD_TERRAIN_HSTEP: low ? 864 : 27, ROAD_TERRAIN_RAIL_SOFT: 0.8,
    ML_DUST_SPAN: 5, ML_DUST_BEHIND: 1, ML_DUST_RAD: 40, ML_DUST_VERT: 25, ML_DUST_M: 0.3, ML_FOCAL_PX: 494.82,
    ML_DUST_PX0: 1, ML_DUST_PX1: 6, ML_DUST_FAR0: 66.96, ML_DUST_FAR1: 108, ML_DUST_BEH_M: 27, ML_DUST_INK: 0.55,
    ROAD_MARK_W: (4.67 * 0.5 - 0.99 * 0.5) / 1.03, ROAD_MARK_T: 0.99 / (2 * ((4.67 * 0.5 - 0.99 * 0.5) / 1.03)), ROAD_MARK_G: 0.25 / ((4.67 * 0.5 - 0.99 * 0.5) / 1.03),
    ROAD_MARK_STONE_HONEY: 0.18, ROAD_MARK_TAPER0: 54, ROAD_MARK_TAPER1: 108,
    ML_WALL_SAT_RAMP: 1, ML_WALL_SAT_PEAK_LIFT: 0.18,
    _roadG: (number) => (+number).toFixed(5), _roadBandBuf: new Uint8Array(23 * 4), _roadBase: {}, _roadInk: {}, _roadLaneCol: [{}, {}, {}, {}], _roadMark: {},
    roadBandTex: null, roadMat: null, roadMesh: null, roadMercyInverseDepth: null, roadMercyInverseDepthMat: null, roadSocket: null, roadSocketMat: null, roadDust: null, roadDustMat: null,
    _roadTerrainBase: new Vector2(), _roadHorizon: new Float32Array(horizonN * 4),
    roadGlyphTex: () => null, roadCourse: () => ({ terrainPhase: 0 }), roadTerrainGeometry: () => new BufferGeometry(),
    buildRoadImpostor: () => {}, buildRoadArches: () => {}, buildRoadWalls: () => {}, buildNaveVault: () => {}, buildNaveVeil: () => {}, buildRoadDust: () => {},
    mulberry32: (seed) => { let value = seed; return () => { value |= 0; value = value + 0x6d2b79f5 | 0; let word = Math.imul(value ^ value >>> 15, 1 | value); word = word + Math.imul(word ^ word >>> 7, 61 | word) ^ word; return ((word ^ word >>> 14) >>> 0) / 4294967296; }; },
    THREE: { DataTexture, ShaderMaterial, PlaneGeometry, BufferGeometry, BufferAttribute, Mesh, Points, Vector2, Vector3, RGBAFormat: 1, NearestFilter: 2, ClampToEdgeWrapping: 3, AdditiveBlending: 4, NormalBlending: 5, CustomBlending: 6, AddEquation: 7, OneFactor: 8, OneMinusSrcAlphaFactor: 9 },
    scene: { add() {} },
  });
  const helpers = ["roadTerrainShader", "roadMarkShader"].concat(features.dust ? ["buildRoadDust"] : []).map((name) => extractFunction(source, name)).join("\n");
  new vm.Script(`${helpers}\n${match[0]}`, { filename: "buildRoad.wave9.vm.js" }).runInContext(context);
  const emitted = { roadVertex: context.roadMat.vertexShader, roadFragment: context.roadMat.fragmentShader };
  if (features.live) Object.assign(emitted, { roadBlending: context.roadMat.blending, roadBlendEquation: context.roadMat.blendEquation, roadBlendSrc: context.roadMat.blendSrc, roadBlendDst: context.roadMat.blendDst, roadSocketFragment: context.roadSocketMat && context.roadSocketMat.fragmentShader, roadSocketDraw: !!context.roadSocket, roadMesh: context.roadMesh, roadMaterial: context.roadMat, inverseDepth: context.roadMercyInverseDepth, inverseDepthMaterial: context.roadMercyInverseDepthMat });
  if (features.dust) emitted.roadDustVertex = context.roadDustMat && context.roadDustMat.vertexShader;
  return emitted;
}

function emitWave9NaveShaders(source = html, features = {}) {
  const match = source.match(/function buildRoadArches\(\)\{[\s\S]*?\n\}(?=\nfunction buildNaveVault)/);
  assert.ok(match, "buildRoadArches is extractable for shader emission");
  class BufferGeometry { setAttribute() {} setIndex() {} }
  class BufferAttribute {}
  class ShaderMaterial { constructor(options) { Object.assign(this, options); } }
  class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; } }
  const uniforms = { uNow: {}, uBase: {}, uA: {}, uW: {}, uP: {}, uBite: {}, uTerrain: {}, uBreath: {}, uPulse: {} };
  const moonline = moonlineOptions(features), flags = productionFeatureFlags(source, moonline);
  const context = vm.createContext({
    Math, Number, Float32Array, Uint16Array, ML_NAVE: true, ML_BITE: flags.bite, ML_TERRAIN: flags.terrain, ML_DOOR_CROSS: flags.doorCross, LOW: false, reduceMotion: !!features.reduceMotion, ML_ARCH_RICH: true, ML_ARCH_SEG: 28, ML_NAVE_SEG: 40,
    ML_ARCH_N: 11, ML_ARCH_BEHIND: 8, ML_ARCH_EVERY: 4, ML_ARCH_SPREAD: 0.25, ROAD_HALF_W: 7, ROAD_MPB: 27, ROAD_FADE0: 734.4, ROAD_FADE1: 864,
    ML_ARCH_PX: 3.2, ML_FOCAL_PX: (1080 / 2) / Math.tan(95 * Math.PI / 360), ML_ARCH_WMIN: 0.06, ML_ARCH_WMAX: 2.6, ML_ARCH_BREATH: 0.45, ML_CROSS_LIFT: 0.18, ML_CROSS_BEATS: 1,
    ML_ARCH_CORE: 16, ML_ARCH_NODE: 2.2, ML_ARCH_PRISM_AT: -0.55, ML_ARCH_PRISM_K: 22, ML_ARCH_AUR: 2.4, ML_ARCH_INK: 0.62,
    ML_GOLD: 0xffeccc, ML_NAVE_VEIL: 0.45, ML_NAVE_SPRING: 9.5, ML_NAVE_R1: 7, ML_NAVE_R2: 8.3, ML_NAVE_RM1: 10, ML_NAVE_RM2: 11.6,
    _roadG: (number) => (+number).toFixed(5), _archKind: new Float32Array(11), _wallCross: { value: -1e9 }, roadTerrainShader: () => "",
    roadMat: { uniforms }, roadArchMat: null, roadArch: null, roadArchAccentMat: null, roadArchAccent: null,
    CFG: { moonline: { ...moonline, archHeightM: 7, archGlow: 1, archPrism: 0.35, reflectAlpha: 0.18, mercyRingBoost: 1.9 } },
    THREE: { BufferGeometry, BufferAttribute, Float32BufferAttribute: BufferAttribute, ShaderMaterial, Mesh, DoubleSide: 1, AdditiveBlending: 2, NormalBlending: 3 }, scene: { add() {} },
  });
  new vm.Script(`${match[0]}\nbuildRoadArches();`, { filename: "buildRoadArches.wave9.vm.js" }).runInContext(context);
  return { naveVertex: context.roadArchMat.vertexShader, naveFragment: context.roadArchMat.fragmentShader, naveAccentFragment: context.roadArchAccentMat.fragmentShader };
}

const TAU = 6.283185307;

function seededCourse(seed, wave10 = false) {
  let value = seed;
  const random = () => { value |= 0; value = value + 0x6d2b79f5 | 0; let word = Math.imul(value ^ value >>> 15, 1 | value); word = word + Math.imul(word ^ word >>> 7, 61 | word) ^ word; return ((word ^ word >>> 14) >>> 0) / 4294967296; };
  const amplitudes = [], frequencies = [], phases = [], keep = wave10 ? 0.2 : 0, biteFrequency = TAU / 7;
  let biteNorm = 0, biteAmplitude = 0, baseBudget = 181;
  if (wave10) {
    for (let db = 0; db <= 32; db += 0.05) { const x = biteFrequency * db, norm = Math.hypot(Math.cos(x) - 1, Math.sin(x) - (1 - keep) * x); biteNorm = Math.max(biteNorm, norm); }
    biteAmplitude = Math.min(2.2, 181 / biteNorm);
    baseBudget = Math.max(0, 181 - biteAmplitude * biteNorm);
  }
  for (let index = 0; index < 3; index += 1) {
    const frequency = TAU / (20 + random() * 40); let normMax = 0;
    for (let db = 0; db <= 32; db += 0.05) { const x = frequency * db, norm = Math.hypot(Math.cos(x) - 1, Math.sin(x) - (1 - keep) * x); normMax = Math.max(normMax, norm); }
    frequencies.push(frequency); phases.push(random() * TAU); amplitudes.push((baseBudget / 3) / normMax);
  }
  return { amplitudes, frequencies, phases, biteAmplitude, biteFrequency, bitePhase: wave10 ? random() * TAU : 0, keep };
}

function courseValue(course, beat) {
  let value = 0;
  for (let index = 0; index < 3; index += 1) value += course.amplitudes[index] * Math.sin(course.frequencies[index] * beat + course.phases[index]);
  return value + course.biteAmplitude * Math.sin(course.biteFrequency * beat + course.bitePhase);
}

function courseDerivative(course, beat, leanBite = 1) {
  let value = 0;
  for (let index = 0; index < 3; index += 1) value += course.amplitudes[index] * course.frequencies[index] * Math.cos(course.frequencies[index] * beat + course.phases[index]);
  return value + leanBite * course.biteAmplitude * course.biteFrequency * Math.cos(course.biteFrequency * beat + course.bitePhase);
}

function courseOffset(course, now, u) {
  const db = u / 27;
  return courseValue(course, now + db) - courseValue(course, now) - courseDerivative(course, now) * (1 - course.keep) * db;
}

function terrainValue(beat, phase) {
  const q = beat + phase;
  return 6 * Math.sin(TAU * q / 22) + 2.4 * Math.sin(TAU * (q / 13 + 0.2)) + 0.9 * Math.sin(TAU * (q / 10.5 + 0.6));
}

function terrainDerivative(beat, phase) {
  const q = beat + phase;
  return 6 * (TAU / 22) * Math.cos(TAU * q / 22) + 2.4 * (TAU / 13) * Math.cos(TAU * (q / 13 + 0.2)) + 0.9 * (TAU / 10.5) * Math.cos(TAU * (q / 10.5 + 0.6));
}

function terrainOffset(now, u, phase) {
  const db = u / 27;
  return terrainValue(now + db, phase) - terrainValue(now, phase) - terrainDerivative(now, phase) * db;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

test("production terrain vertices re-base exactly at and level under the player", () => {
  const context = vm.createContext({ Math, EYE: 4, ROAD_HALF_W: 7, ROAD_MPB: 27, ROAD_TERRAIN_A0: 6, ROAD_TERRAIN_A1: 2.4, ROAD_TERRAIN_A2: 0.9, ROAD_TERRAIN_P0: 22, ROAD_TERRAIN_P1: 13, ROAD_TERRAIN_P2: 10.5, ROAD_TERRAIN_HN: 32, ROAD_TERRAIN_HSTEP: 27, ROAD_TERRAIN_RAIL_SOFT: 0.8, _roadG: (number) => (+number).toFixed(5) });
  vm.runInContext(["roadTerrainY", "roadTerrainD", "roadTerrainAt", "roadTerrainShader"].map((name) => extractFunction(html, name)).join("\n"), context);
  const shader = vm.runInContext("roadTerrainShader()", context);
  const emitted = (name) => {
    const match = shader.match(new RegExp(`float ${name}\\(float b\\)\\{ float q=b\\+uTerrain\\.x; return ([^;]+); \\}`));
    assert.ok(match, `${name} is extractable from the emitted terrain shader`);
    return new Function("q", `return ${match[1].replace(/\bsin\(/g, "Math.sin(").replace(/\bcos\(/g, "Math.cos(")};`);
  };
  const terrainY = emitted("terrainY");
  const cyMatch = shader.match(/float cyAt\(float u\)\{ float db=u\/([0-9.]+); return ([^;]+); \}/);
  assert.ok(cyMatch, "the value-and-grade re-base is extractable from emitted GLSL");
  const metresPerBeat = Number(cyMatch[1]), cyExpr = new vm.Script(cyMatch[2]);
  const liveVertex = emitWave9RoadShaders(html, { terrain: true }).roadVertex;
  const liftMatch = liveVertex.match(/wp\.y\+=([^;]+);/);
  assert.ok(liftMatch, "the production road vertex lift is extractable from the emitted shader");
  const emittedVertexY = new Function("baseY", "u", "cyAt", `return baseY+(${liftMatch[1]});`);
  for (const now of [-41.25, -3, 0, 0.125, 7.7, 29, 113.875]) for (const phase of [0, 0.37, 6.5, 18.25]) for (const amp of [0.25, 1, 1.7]) {
    context.now = now; context.phase = phase; context.amp = amp;
    context.uNow = now; context.uTerrain = { x: phase, y: amp }; context.uTerrainBase = { x: terrainY(now + phase), y: vm.runInContext("roadTerrainD(now,phase)", context) }; context.terrainY = (b) => terrainY(b + phase);
    const at = (u) => { context.db = u / metresPerBeat; const value = cyExpr.runInContext(context); const reference = vm.runInContext(`roadTerrainAt(now,${u},phase,amp)`, context); assert.ok(Math.abs(value-reference)<2e-10, `emitted GLSL agrees with the extracted reference at u=${u}`); return value; };
    assert.equal(at(0), 0, `cy(0) at now=${now}, phase=${phase}, amp=${amp}`);
    const h = 1e-3, derivative = (at(h) - at(-h)) / (2 * h);
    assert.ok(Math.abs(derivative) < 2e-9, `cy'(0)=${derivative} at now=${now}, phase=${phase}, amp=${amp}`);
    for (const u of [-702, -108, 0, 81, 702]) { const baseY = 0.03, lifted = emittedVertexY(baseY, u, at); assert.ok(Math.abs(lifted - (baseY + at(u))) < 2e-10, `emitted production vertex y agrees at u=${u}`); }
  }
});

test("measured leanBite keeps the shipped course-following drill at Wave 9 difficulty", () => {
  const defaultMatch = html.match(/\bleanBite:([0-9.]+)/);
  assert.ok(defaultMatch, "the flat Moonline CFG exposes leanBite");
  const leanBite = Number(defaultMatch[1]), samples9 = [], samples10 = [];
  for (let day = 0; day < 365; day += 1) {
    const date = new Date(Date.UTC(2026, 0, day + 1));
    const key = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
    for (let phase = -1; phase <= 7; phase += 1) {
      const seed = (key ^ Math.imul(phase + 1, 0x9e3779b9)) >>> 0, wave9 = seededCourse(seed), wave10 = seededCourse(seed, true);
      for (let position = 0; position < 12; position += 1) {
        const beat = position * 32 / 12;
        const measure = (course, scalar) => Math.min(1, Math.abs(Math.atan2(courseDerivative(course, beat + 4, scalar) - courseDerivative(course, beat, scalar), 27) / (5.45 * Math.PI / 180)));
        samples9.push(measure(wave9, 0)); samples10.push(measure(wave10, leanBite));
      }
    }
  }
  const p90Wave9 = percentile(samples9, 0.9), p90Wave10 = percentile(samples10, 0.9);
  assert.equal(leanBite, 0.25);
  assert.ok(Math.abs(p90Wave9 - 1) < 1e-12, `Wave 9 p90 is ${p90Wave9}`);
  assert.ok(Math.abs(p90Wave10 - 0.9904331498827318) < 1e-12, `Wave 10 p90 is ${p90Wave10}`);
  assert.ok(p90Wave10 >= p90Wave9 * 0.8 && p90Wave10 <= p90Wave9 * 1.2, "the drill remains within 20% of Wave 9");
  const derivative = extractFunction(html, "roadCourseD"), lean = extractFunction(html, "roadLean");
  assert.match(derivative, /biteScale=1/); assert.match(derivative, /biteScale\*c\.bite\.a/);
  assert.match(lean, /roadCourseD\(b\+ROAD_TURN_LEAD,ML_LEAN_BITE\)-roadCourseD\(b,ML_LEAN_BITE\)/);
});

test("terrain stays out of the complete aim, shot, preview, dolly, and lock paths", () => {
  const regions = {
    spawnTarget: extractFunction(html, "spawnTarget"), updateProjectiles: extractFunction(html, "updateProjectiles"), animate: extractFunction(html, "animate"),
    roadLean: extractFunction(html, "roadLean"), computeShotPlan: extractFunction(html, "computeShotPlan"), spawnProjectile: extractFunction(html, "spawnProjectile"),
    updateArcPreview: extractFunction(html, "updateArcPreview"), scopeLockTarget: extractFunction(html, "scopeLockTarget"), updateScope: extractFunction(html, "updateScope"),
  };
  assert.match(regions.spawnTarget, /_spawnPos\.y=Math\.max\(2\.2,Math\.min\(ROOM_BY,_spawnPos\.y\)\)/, "spawn Y remains the room clamp");
  assert.match(regions.updateProjectiles, /pr\.pos\.y<=0\.04/, "projectiles still terminate against the unchanged ground law");
  assert.match(regions.animate, /if\(p\.y<2\.2\)/, "the strobe mover keeps its unchanged 2.2 m bounce");
  assert.match(regions.animate, /if\(p\.y<2\.2\|\|p\.y>ROOM_BY\)/, "the smooth mover keeps the same room-box bounce");
  assert.match(regions.animate, /roadLean\(roadBeatNow\(\)\)/); assert.match(regions.animate, /yaw\+recoilYaw\+shY\+_dollyY/);
  assert.match(regions.computeShotPlan, /camera\.getWorldDirection\(_arcDir\)/);
  assert.match(regions.spawnProjectile, /computeShotPlan\(pr\.pos, pr\.vel\)/);
  assert.match(regions.updateArcPreview, /computeShotPlan\(_arcM, _arcV\)/);
  assert.match(regions.scopeLockTarget, /camera\.getWorldDirection\(_scAim\)/);
  assert.match(regions.updateScope, /scopeLockTarget\(\)/); assert.match(regions.updateScope, /computeShotPlan\(_scM, _scV\)/);
  for (const [name, source] of Object.entries(regions)) assert.doesNotMatch(source, /\b(?:roadTerrain|cyAt)\w*\b/, `${name} cannot read terrain height`);
});

test("each Wave 10 production gate works alone and all gates restore frozen Wave 9", () => {
  const emitted = { ...emitWave9RoadShaders(), ...emitWave9NaveShaders() };
  assert.deepEqual(shaderFingerprint(emitted), wave9Fixture);
  assert.equal(emitted.roadVertex, "varying vec2 vXZ; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vXZ=wp.xz; gl_Position=projectionMatrix*viewMatrix*wp; }");
  assert.doesNotMatch(Object.values(emitted).join("\n"), /\b(?:uTerrain|uBite|markChev|vTerrainVis)\b/);
  const markOff = emitWave9RoadShaders(html, { markGlyph: false, terrainOn: true, terrainAmp: 1, curveBite: 2.2 });
  assert.doesNotMatch(markOff.roadFragment, /markChev/); assert.match(markOff.roadVertex, /uTerrain/); assert.match(markOff.roadFragment, /uBite/);
  for (const switchOff of [{ terrainOn: false, terrainAmp: 1 }, { terrainOn: true, terrainAmp: 0 }]) {
    const terrainOff = emitWave9RoadShaders(html, { markGlyph: true, curveBite: 2.2, ...switchOff });
    assert.equal(terrainOff.roadVertex, emitted.roadVertex); assert.match(terrainOff.roadFragment, /markChev/); assert.match(terrainOff.roadFragment, /uBite/);
  }
  const biteOff = emitWave9RoadShaders(html, { markGlyph: true, terrainOn: true, terrainAmp: 1, curveBite: 0 });
  assert.doesNotMatch(biteOff.roadFragment, /uBite/); assert.match(biteOff.roadFragment, /markChev/); assert.match(biteOff.roadVertex, /uTerrain/);
  const live = emitWave9RoadShaders(html, { mark: true, terrain: true, bite: true, live: true });
  assert.match(live.roadVertex, /vTerrainVis=terrainVis\(u,cx,0\.0\); wp\.y\+=cyAt\(u\)/);
  assert.match(live.roadFragment, /uBite\.x\*sin\(uBite\.y\*b\+uBite\.z\)/);
  assert.match(live.roadFragment, /markFill.*markCut/);
  assert.match(live.roadFragment, /socketA=0\.85\*markCut\*fade\*outer\*vTerrainVis/);
  assert.equal(live.roadSocketFragment, null); assert.equal(live.roadSocketDraw, false);
  const reject = live.roadFragment.indexOf("if(vTerrainVis<=0.004) discard;"), course = live.roadFragment.indexOf("vec3 sc=sin", reject), mark = live.roadFragment.indexOf("float markS=", reject);
  assert.ok(reject >= 0 && reject < course && course < mark, "fully occluded folds leave before course, texture, and mark work");
  assert.equal(live.roadBlending, 6); assert.equal(live.roadBlendEquation, 7); assert.equal(live.roadBlendSrc, 8); assert.equal(live.roadBlendDst, 9);
  assert.equal(live.roadSocketDraw, false, "the displaced ribbon is submitted once when the mark is on");
  const destination = [0.21, 0.34, 0.55], road = [0.78, 0.43, 0.19], dark = [0.004, 0.003, 0.002], roadAlpha = 0.37, socketAlpha = 0.63;
  const oldTwoPass = destination.map((value, index) => value * (1 - socketAlpha) + dark[index] * socketAlpha + road[index] * roadAlpha);
  const fusedSource = road.map((value, index) => value * roadAlpha + dark[index] * socketAlpha);
  const fusedPass = fusedSource.map((value, index) => value + destination[index] * (1 - socketAlpha));
  for (let index = 0; index < 3; index += 1) assert.ok(Math.abs(oldTwoPass[index] - fusedPass[index]) < 1e-12, "fused blend preserves the old socket-then-additive RGB");
});

test("emitted mark samples preserve distinct lane, direction, and wake information", () => {
  const live = emitWave9RoadShaders(html, { mark: true, terrain: true, bite: true, live: true });
  const laneStart = live.roadFragment.indexOf("vec3 lc="), laneEnd = live.roadFragment.indexOf("vec3 jewel=", laneStart);
  assert.ok(laneStart >= 0 && laneEnd > laneStart, "the emitted lane program is extractable");
  const laneAssignments = [...live.roadFragment.slice(laneStart, laneEnd).matchAll(/(?:vec3\s+)?lc=([^;]+);/g)].map((match) => match[1]);
  const mix = (left, right, amount) => Array.isArray(left) ? left.map((value, index) => value * (1 - amount) + right[index] * amount) : left * (1 - amount) + right * amount;
  const step = (edge, value) => value < edge ? 0 : 1;
  const uniforms = [[0.93, 0.18, 0.11], [0.12, 0.84, 0.29], [0.18, 0.31, 0.96], [0.91, 0.74, 0.13]];
  const laneColours = [0, 1, 2, 3].map((lane) => {
    let lc;
    for (const expression of laneAssignments) lc = new Function("uL0", "uL1", "uL2", "uL3", "lane", "lc", "mix", "step", `return (${expression});`)(...uniforms, lane, lc, mix, step);
    return lc;
  });
  assert.equal(new Set(laneColours.map((colour) => colour.map((value) => value.toFixed(6)).join(","))).size, 4, "four emitted lane states retain four authoritative colours");
  const turnMatch = live.roadFragment.match(/vec2 markTurn\(vec2 q,float lane\)\{([^}]+)\}/);
  assert.ok(turnMatch, "the emitted direction transform is extractable");
  const turnBody = turnMatch[1].replace(/vec2\(/g, "vec2(").replace(/q\.x/g, "q[0]").replace(/q\.y/g, "q[1]");
  const turn = new Function("q", "lane", "vec2", turnBody), vector = [0.23, 0.71], directions = [0, 1, 2, 3].map((lane) => turn(vector, lane, (x, y) => [x, y]));
  assert.equal(new Set(directions.map((direction) => direction.join(","))).size, 4, "four emitted lane states retain four chevron directions");
  const fillMatch = live.roadFragment.match(/float fillA=([^;]+);/);
  assert.ok(fillMatch, "the emitted wake fill is extractable");
  const fill = (has, ahead, landed, missed) => new Function("has", "ahead", "landed", "missed", `return ${fillMatch[1]};`)(has, ahead, landed, missed);
  assert.equal(fill(1, 1, 0, 0), 1); assert.equal(fill(1, 0, 1, 0), 1); assert.equal(fill(1, 0, 0, 1), 0.16); assert.equal(fill(0, 0, 1, 0), 0);
  assert.match(live.roadFragment, /nave\+=mix\(ng,nw,0\.55\)\*\(0\.34000\*fillA\*lum\*inner\*1\.35\*0\.18000\)/);
  assert.match(live.roadFragment, /float markStretch\(float d\)\{ return mix\(clamp\(d\/7\.5,1\.0,4\.5\),1\.0,smoothstep\(54\.00000,108\.00000,d\)\); \}/);
  assert.match(live.roadFragment, /float roadA=.*socketA=0\.85\*markCut/, "the dark socket shares the inlay's already-computed distance taper");
  assert.equal(live.roadSocketFragment, null, "the socket does not repeat the mark SDF in a second material");
  const stretch = (d) => { const t = Math.max(0, Math.min(1, (d - 54) / 54)), smooth = t * t * (3 - 2 * t); return (Math.max(1, Math.min(4.5, d / 7.5))) * (1 - smooth) + smooth; };
  for (let cell = 4; cell <= 8; cell += 1) assert.equal(stretch((cell + 0.5) * 27), 1, `cell ${cell} has returned to the compact 1x mark`);
});

test("lateral ray/deck separation prevents the reported false terrain occlusion", () => {
  const seed = 20260821, phase = seed / 4294967296 * 22, now = 64.875, u = 702, course = seededCourse(seed, true), targetX = courseOffset(course, now, u);
  const shader = emitWave9RoadShaders(html, { terrain: true }).roadVertex;
  const countMatch = shader.match(/uniform vec4 uHorizon\[(\d+)\]/), stepMatch = shader.match(/float d=float\(i\+1\)\*([0-9.]+)/), deckMatch = shader.match(/onDeck=1\.0-step\(([0-9.]+),abs\(rayX-cx\)\)/);
  assert.ok(countMatch && stepMatch && deckMatch, "the emitted cached lateral horizon is extractable");
  const count = Number(countMatch[1]), stepDistance = Number(stepMatch[1]), halfDeck = Number(deckMatch[1]);
  let oldHorizon = -1e6, oldDistance = 1, sampleStep = u / 54;
  for (let index = 1; index <= 54; index += 1) { const distance = Math.max(1, index * sampleStep); if (distance < u - sampleStep * 0.2) { const height = (terrainOffset(now, distance, phase) - 4) / distance; if (height > oldHorizon) { oldHorizon = height; oldDistance = distance; } } }
  let lo = Math.max(1, oldDistance - sampleStep), hi = Math.min(u, oldDistance + sampleStep);
  for (let index = 0; index < 9; index += 1) { const d1 = lo + (hi - lo) / 3, d2 = lo + 2 * (hi - lo) / 3, h1 = (terrainOffset(now, d1, phase) - 4) / d1, h2 = (terrainOffset(now, d2, phase) - 4) / d2; if (h1 < h2) lo = d1; else hi = d2; }
  const oldCrest = 0.5 * (lo + hi), oldGap = Math.abs(targetX * oldCrest / u - courseOffset(course, now, oldCrest));
  oldHorizon = Math.max(oldHorizon, (terrainOffset(now, oldCrest, phase) - 4) / oldCrest);
  let cachedHorizon = -1e6;
  for (let index = 0; index < count; index += 1) { const distance = (index + 1) * stepDistance; if (distance < u - stepDistance * 0.2) { const centre = courseOffset(course, now, distance), rayX = targetX * distance / u; if (Math.abs(rayX - centre) <= halfDeck) cachedHorizon = Math.max(cachedHorizon, (terrainOffset(now, distance, phase) - 4) / distance); } }
  const targetRay = (terrainOffset(now, u, phase) - 4) / u;
  assert.ok(oldGap > halfDeck, `old crest misses the ray by ${oldGap.toFixed(3)} m`);
  assert.ok(targetRay < oldHorizon, "the old longitudinal-only test kills the vertex");
  assert.ok(targetRay >= cachedHorizon, "the cached lateral-aware test keeps the physically visible vertex");
});

test("dust occlusion receives deck-local height before the terrain lift", () => {
  const dust = emitWave9RoadShaders(html, { terrain: true, dust: true }).roadDustVertex;
  assert.match(dust, /float tv=terrainVis\(u,P\.x,P\.y\); P\.y\+=cyAt\(u\)/);
  assert.doesNotMatch(dust, /terrainVis\(u,P\.x,P\.y-[0-9.]+\)/);
});

test("terrain horizon uses the cached profile and LOW compiles out its scan", () => {
  const desktop = emitWave9RoadShaders(html, { terrain: true }).roadVertex, low = emitWave9RoadShaders(html, { terrain: true, low: true }).roadVertex;
  const loop = desktop.match(/for\(int i=0;i<32;i\+\+\)\{([\s\S]*?)\} \} float ray=/);
  assert.ok(loop, "desktop emitted horizon scan is extractable");
  assert.match(desktop, /uniform vec4 uHorizon\[32\]/); assert.doesNotMatch(loop[1], /\b(?:sin|cos|terrainY|cyAt)\s*\(/);
  assert.doesNotMatch(low, /uHorizon|for\(int i=/); assert.match(low, /float terrainVis\(float u,float lx,float ly\)\{ return 1\.0; \}/);
});
