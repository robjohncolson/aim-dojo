"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const wave10Fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "moonline-wave10-shaders.fixture.json"), "utf8"));

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

function fingerprint(shaders) {
  const out = {};
  for (const [name, source] of Object.entries(shaders)) out[name] = source == null ? null : { chars: source.length, sha256: crypto.createHash("sha256").update(source).digest("hex") };
  return out;
}

function loadRoadHarness() {
  const filename = path.join(__dirname, "moonline-terrain.test.js"), source = fs.readFileSync(filename, "utf8");
  const context = vm.createContext({ __dirname, require: (id) => id === "node:test" ? (() => {}) : require(id) });
  new vm.Script(`${source}\nthis.enfiladeHarness={emitWave9RoadShaders,emitWave9NaveShaders};`, { filename }).runInContext(context);
  return context.enfiladeHarness;
}

function productionFlags(options) {
  const names = ["ML_MARK", "ML_TERRAIN", "ML_BITE", "ML_WALLS", "ML_SAT"];
  const declarations = names.map((name) => {
    const match = html.match(new RegExp(`const ${name}=([^;]+);`));
    assert.ok(match, `${name} production gate is extractable`);
    return `const ${name}=${match[1]};`;
  }).join("\n");
  const context = vm.createContext({ CFG: { moonline: options }, ML_NAVE: true });
  vm.runInContext(`${declarations}\nthis.flags={mark:ML_MARK,terrain:ML_TERRAIN,bite:ML_BITE,walls:ML_WALLS,sat:ML_SAT};`, context);
  return { ...context.flags };
}

function wallOptions(overrides = {}) {
  return { markGlyph: true, terrainOn: true, terrainAmp: 1, curveBite: 2.2, wallsOn: true, wallDissolve: 95, wallGlow: 1, wallExhale: 0, wallEcho: false, wallSat: 1, wallPalette: null, ...overrides };
}

function emittedWallFragment(options = wallOptions()) {
  if (!productionFlags(options).walls) return null;
  const context = vm.createContext({
    LOW: false, reduceMotion: false, ML_TERRAIN: true, ML_WALL_STAR: false, ML_WALL_EXHALE: 0, ML_WALL_ECHO: false, ML_DOOR_CROSS: false, ML_MERCY_INVERSE: false, ML_WALL_RING_R1: 10, ML_WALL_RING_R2: 11.6, ML_WALL_SPRING: 12, ML_WALL_DJ: 7.3, ML_WALL_DA: 7.3, ML_WALL_DB: 5,
    ML_WALL_BAY_X: 16.5, ML_WALL_BAY_Y0: -70, ML_WALL_BAY_Y1: 21, ML_WALL_POWDER1: 200, ML_WALL_POWDER_NOISE: 22,
    _roadG: (number) => (+number).toFixed(5),
  });
  vm.runInContext(`${extractFunction(html, "roadWallFragmentShader")}\nthis.shader=roadWallFragmentShader();`, context);
  return context.shader;
}

function mulberry32(seed) {
  let value = seed;
  return () => { value |= 0; value = value + 0x6d2b79f5 | 0; let word = Math.imul(value ^ value >>> 15, 1 | value); word = word + Math.imul(word ^ word >>> 7, 61 | word) ^ word; return ((word ^ word >>> 14) >>> 0) / 4294967296; };
}

test("Enfilade kill-switch restores the frozen Wave 10 emitted shader set", () => {
  const harness = loadRoadHarness(), base = { mark: true, terrain: true, bite: true, live: true, wallSat: 1 };
  for (const variant of [
    { label: "wallsOn:false alone", features: { ...base, walls: false }, options: wallOptions({ wallsOn: false }) },
    { label: "wallDissolve:0 alone", features: { ...base, walls: true, wallDissolve: 0 }, options: wallOptions({ wallDissolve: 0 }) },
  ]) {
    const road = harness.emitWave9RoadShaders(html, variant.features), nave = harness.emitWave9NaveShaders(html, variant.features), shaders = {
      roadVertex: road.roadVertex, roadFragment: road.roadFragment, roadSocketFragment: road.roadSocketFragment,
      naveVertex: nave.naveVertex, naveFragment: nave.naveFragment, naveAccentFragment: nave.naveAccentFragment,
      wallVertex: null, wallFragment: emittedWallFragment(variant.options), wallAccentVertex: null, wallAccentFragment: null, wallVeilVertex: null, wallVeilFragment: null,
    };
    assert.deepEqual(productionFlags(variant.options), { mark: true, terrain: true, bite: true, walls: false, sat: false }, variant.label);
    assert.deepEqual(fingerprint(shaders), wave10Fixture, variant.label);
    assert.doesNotMatch(Object.values(shaders).filter(Boolean).join("\n"), /\buWall(?:Dissolve|Glow|Sat|Seed|Col|Next)\b/, variant.label);
  }
  assert.match(html, /const ML_WALLS=ML_NAVE && !!\(CFG\.moonline && CFG\.moonline\.wallsOn\) && \(\+CFG\.moonline\.wallDissolve>0\);/);
  assert.match(html, /const ML_SAT=ML_WALLS && ML_MARK && \(\+CFG\.moonline\.wallSat>0\);/);
  assert.match(html, /if\(ML_WALLS\) buildRoadWalls\(\); else if\(ML_ARCH\) buildRoadArches\(\);/);
  assert.match(html, /const TARGET_THROUGH_MAT=ML_WALLS\?/);
});

test("Enfilade palette uses the course date-phase seed and a private stream", () => {
  class FixedDate { getFullYear() { return 2026; } getMonth() { return 7; } getDate() { return 21; } }
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(name, value) { this.attributes[name] = value; } setIndex(value) { this.index = value; } }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  class ShaderMaterial { constructor(options) { Object.assign(this, options); } }
  class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; } }
  class Points extends Mesh {}
  const phase = 4, shared = { spawnCalls: 0, courseCalls: 0 }, palette = [0x102031, 0x405061, 0x708091, 0xa0b0c1, 0xd0e0f1], setValue = () => ({ set() {} });
  const uniforms = { uNow: { value: 0 }, uBase: { value: {} }, uA: { value: setValue() }, uW: { value: setValue() }, uP: { value: setValue() }, uBite: { value: setValue() }, uTerrain: { value: setValue() }, uTerrainBase: { value: {} }, uHorizon: { value: [] }, uAmt: { value: 0 }, uNaveGold: null, uBeat0: { value: 0 }, uGlyph: { value: null }, uGlyphOn: { value: 0 }, uMercyB: { value: 0 }, uBreath: { value: 0 }, uPulse: { value: 0 } };
  const context = vm.createContext({
    Math, Number, Date: FixedDate, Float32Array, Uint16Array, Uint32Array,
    CFG: { road: { bandGlyphs: true, mercyBoost: 1.6 }, moonline: { curveBite: 2.2, wallPalette: palette, wallDissolve: 95, wallGlow: 1 } }, moonPhaseBucket: () => phase, mulberry32,
    rnd: () => { shared.spawnCalls += 1; return 0.25; }, shared,
    ROAD_DRAW: 32, ROAD_HARM: 3, ROAD_BEND_M: 181, ROAD_ALPHA: 0.55, ROAD_WAKE: 14, ROAD_GLYPH_PASS: false, ML_HEADING_KEEP: 0.2, ML_BITE: false, ML_TERRAIN: false, ML_WALLS: true, ML_WALL_EXHALE: 0, ML_WALL_ECHO: false, ML_DOOR_CROSS: false, ML_MERCY_INVERSE: false, ML_WALL_STAR: false, ML_RIBBON: true, LOW: false, reduceMotion: false,
    ML_ARCH_N: 11, ML_WALL_N: 11, ML_ARCH_BEHIND: 8, ML_ARCH_EVERY: 4, ML_WALL_REAR0: -12, ML_WALL_REAR1: -8, ROAD_MPB: 27, ROAD_FADE0: 734.4, ROAD_FADE1: 864, ROAD_FAR: 894, ROAD_FAR_ROOM: 260, ML_FOCAL_PX: 494.82,
    ML_WALL_DJ: 7.3, ML_WALL_SPRING: 12, ML_WALL_DA: 7.3, ML_WALL_DB: 5, ML_WALL_APEX: 17, ML_WALL_BAY_X: 16.5, ML_WALL_BAY_Y0: -70, ML_WALL_BAY_Y1: 21,
    ML_WALL_POWDER1: 200, ML_WALL_POWDER_NOISE: 22, ML_WALL_X: 216.5, ML_WALL_Y0: -270, ML_WALL_Y1: 221, ML_WALL_RING_R1: 10, ML_WALL_RING_R2: 11.6, ML_WALL_PAL_N: 512,
    ML_WALL_CHALK: palette, _roadG: (number) => (+number).toFixed(5), _roadCourse: null, _wallNight: new Uint32Array(512), _wallNightReady: false,
    _archKind: new Float32Array(11), _wallCol: Array.from({ length: 11 }, () => ({})), _wallNext: Array.from({ length: 11 }, () => ({})),
    roadMat: { uniforms }, roadMesh: { visible: false }, roadSocket: null, roadImp: null, roadArch: null, roadArchAccent: null, roadDust: null, roadVault: null, roadNaveVeil: null,
    roadWall: null, roadWallMat: null, roadWallAccent: null, roadWallAccentMat: null, roadWallVeil: null, roadWallVeilMat: null,
    _roadVis: false, _roadUp: false, _roadLaneCol: Array.from({ length: 4 }, () => ({ setHex() {} })), _roadMark: { setHex() {} }, WASD_HEX: [1, 2, 3, 4], TANK_COLOR: 5,
    gridColIdx: 0, _roadInkIdx: -1, _roadInk: { setHex() {} }, GRID_COLS: [[6]], _roadLastR: -1e9, _roadBeat0: NaN, _roadBar0: NaN,
    _roadBase: { set() {} }, roadCourseX: () => 0, roadCourseD: () => 0, roadTerrainShader: () => "", roadLive: () => true, roadBeatNow: () => 0, roadWakeLatch() {}, roadWakeReset() {}, roadJudgeStamp() {}, roadWakeWrite() {}, roadBandFill() {}, roadArchFill() {}, roadBreath: () => 0, roadImpSync() {}, roadHorizonSync() {},
    camera: { far: 0, updateProjectionMatrix() {} }, THREE: { BufferGeometry, BufferAttribute, ShaderMaterial, Mesh, Points, DoubleSide: 1, AdditiveBlending: 2 }, scene: { add() {} },
  });
  const production = ["roadCourse", "roadWallPalette", "roadWallPaletteAt", "roadWallVertexShader", "roadWallFragmentShader", "buildRoadWalls", "roadSync"].map((name) => extractFunction(html, name)).join("\n");
  vm.runInContext(`${production}\nconst courseAuthority=roadCourse; roadCourse=function(){ shared.courseCalls++; return courseAuthority(); }; this.spawnBefore=shared.spawnCalls; buildRoadWalls(); this.buildCourseCalls=shared.courseCalls; this.seedAtBuild=roadWallMat.uniforms.uWallSeed.value; roadSync(); this.syncCourseCalls=shared.courseCalls; this.seed=_roadCourse.seed; this.seedAfterSync=roadWallMat.uniforms.uWallSeed.value; this.night=Array.from(roadWallPalette()); this.spawnAfter=shared.spawnCalls;`, context);
  const key = 20260821, expectedSeed = (key ^ Math.imul(phase + 1, 0x9e3779b9)) >>> 0, expected = [], random = mulberry32(expectedSeed); let previous = -1;
  for (let index = 0; index < 512; index += 1) { const first = Math.min(palette.length - 1, (random() * palette.length) | 0), turn = Math.min(Math.max(0, palette.length - 2), (random() * Math.max(1, palette.length - 1)) | 0), pick = palette.length > 1 && first === previous ? (first + 1 + turn) % palette.length : first; expected.push(palette[pick] >>> 0); previous = pick; }
  if (expected.at(-1) === expected[0]) for (let step = 1; step < palette.length; step += 1) { const colour = palette[(previous + step) % palette.length] >>> 0; if (colour !== expected[0] && colour !== expected.at(-2)) { expected[expected.length - 1] = colour; break; } }
  assert.equal(context.seed, expectedSeed);
  assert.deepEqual(Array.from(context.night), expected);
  assert.equal(context.buildCourseCalls, 0, "buildRoadWalls cannot call roadCourse before the road first becomes live");
  assert.equal(context.syncCourseCalls, 1, "first live roadSync retains Wave 10's single roadCourse call");
  assert.equal(context.seedAtBuild, 0, "the wall seed uniform stays inert at build time");
  assert.equal(context.seedAfterSync, (expectedSeed % 104729) / 104729, "first live sync publishes the same course seed to the wall family");
  assert.equal(context.spawnBefore, context.spawnAfter, "wall build and lazy palette initialization cannot consume the shared spawn rng");
  assert.ok(context.night.every((value, index) => !index || value !== context.night[index - 1]), "successive chambers differ");
  assert.notEqual(context.night.at(-1), context.night[0], "the repeated lookup cannot create a seam at bar 512");
  assert.doesNotMatch(extractFunction(html, "buildRoadWalls"), /\b(?:roadCourse|roadWallPalette)\s*\(/);
  assert.doesNotMatch(extractFunction(html, "roadWallPalette"), /\b(?:rnd|Math\.random)\s*\(/);
  assert.match(extractFunction(html, "roadWallPalette"), /courseSeed=seed==null\?\(_roadCourse\|\|roadCourse\(\)\)\.seed:seed/);
  assert.match(extractFunction(html, "roadSync"), /const c=roadCourse\(\);[\s\S]*roadWallPalette\(c\.seed\)/);
});

test("Enfilade saturation reaches the pure lane exactly on the beat", () => {
  const harness = loadRoadHarness(), shader = harness.emitWave9RoadShaders(html, { mark: true, terrain: true, bite: true, live: true, walls: true, wallSat: 1 }).roadFragment;
  const rampMatch = html.match(/const ML_WALL_SAT_RAMP=([0-9.]+)/), liftMatch = html.match(/ML_WALL_SAT_PEAK_LIFT=([0-9.]+)/);
  assert.ok(rampMatch && liftMatch); const width = Number(rampMatch[1]), peakLift = Number(liftMatch[1]);
  assert.equal(width, 1); assert.ok(peakLift > 0);
  const smoothstep = (edge0, edge1, value) => { const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t); };
  const phaseMatch = shader.match(/float markPhase=([^;]+);/), saturationMatch = shader.match(/float markSat=([^;]+);/);
  assert.ok(phaseMatch && saturationMatch, "the production cell envelope is extractable from emitted GLSL");
  const evaluateSat = new Function("b", "uNow", "uWallSat", "ahead", "floor", "max", "smoothstep", "clamp", `const markPhase=${phaseMatch[1]}; return ${saturationMatch[1]};`);
  const saturationAt = (phase, fraction = 0.5, ahead = 1) => evaluateSat(32 + fraction, 32 - phase, 1, ahead, Math.floor, Math.max, smoothstep, (value, lo, hi) => Math.max(lo, Math.min(hi, value)));
  const wasd = html.match(/WASD_HEX=\[([^\]]+)\]/); assert.ok(wasd);
  const laneHex = Number(wasd[1].split(",")[0].trim()), pure = [laneHex >>> 16 & 255, laneHex >>> 8 & 255, laneHex & 255].map((channel) => channel / 255);
  const luminance = pure[0] * 0.299 + pure[1] * 0.587 + pure[2] * 0.114;
  const rest = pure.map((channel) => Math.max(0, Math.min(1, (luminance + (channel - luminance) * 1.32) * 1.04)));
  const mix = (amount) => rest.map((channel, index) => channel + (pure[index] - channel) * amount), distance = (colour) => Math.hypot(...colour.map((channel, index) => channel - pure[index]));
  const deltas = [1, 0.5, 0.25, 0], colours = deltas.map((delta) => mix(saturationAt(delta))), distances = colours.map(distance);
  for (let index = 1; index < distances.length; index += 1) assert.ok(distances[index] <= distances[index - 1] + 1e-15, `distance to pure decreases at ${deltas[index]} beat`);
  assert.ok(colours[3].every((channel, index) => Math.abs(channel - pure[index]) < 1e-15), "the landed peak is exactly the selected uL colour");
  assert.ok(mix(saturationAt(-0.25)).every((channel, index) => Math.abs(channel - rest[index]) < 1e-15), "the wake handoff is exactly the Wave 10 rest colour");
  const samples = [{ label: "band edge", fraction: 0 }, { label: "left arm", fraction: 0.18 }, { label: "centre", fraction: 0.5 }, { label: "right arm", fraction: 0.82 }];
  for (const phase of [-0.25, 0, 0.25]) {
    const amounts = samples.map((sample) => saturationAt(phase, sample.fraction));
    assert.ok(amounts.every((amount) => Math.abs(amount - amounts[0]) < 1e-15), `edge/centre/arms share one envelope at phase ${phase}`);
    if (phase === 0) for (const [index, sample] of samples.entries()) assert.ok(mix(amounts[index]).every((channel, laneIndex) => Math.abs(channel - pure[laneIndex]) < 1e-15), `${sample.label} is pure lane colour at the audible edge`);
  }
  assert.equal(saturationAt(0, 0.5, 0), 0, "a missed/wake band cannot retain the full-lane peak");
  assert.ok(mix(saturationAt(0, 0.5, 0)).some((channel, index) => Math.abs(channel - pure[index]) > 1e-6), "the missed band dies in its Wave 10 rest colour, not pure lane colour");
  const headroom = Math.max(0, 1 - Math.max(...colours[3])), cappedLift = Math.min(peakLift * saturationAt(0), headroom); assert.ok(Math.max(...colours[3]) + cappedLift <= 1 + 1e-15);
  assert.match(shader, /vec3 lc=mix\(mix\(uL0,uL1/); assert.match(shader, /vec3 lanePure=lc;/); assert.match(shader, /float markPhase=floor\(b\)-uNow;/); assert.match(shader, /markSat=.*\*ahead;/); assert.match(shader, /vec3 markCol=mix\(lc,lanePure,min\(1\.0,markSat\)\)/);
  assert.match(shader, /max\(0\.0,1\.0-max\(max\(markCol\.r,markCol\.g\),markCol\.b\)\)/);
  const peakBlock = shader.slice(shader.indexOf("vec3 lanePure=lc;"), shader.indexOf("vec3 col=mix", shader.indexOf("vec3 lanePure=lc;")));
  for (const token of wasd[1].split(",").map((value) => value.trim().toLowerCase())) assert.doesNotMatch(peakBlock.toLowerCase(), new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const standing = harness.emitWave9RoadShaders(html, { mark: true, terrain: true, bite: true, live: true, walls: true, wallSat: 1, reduceMotion: true }).roadFragment;
  assert.doesNotMatch(standing, /markPhase|floor\(b\)-uNow/, "reduceMotion emits no permanent spatial saturation gradient");
  assert.match(standing, /float markSat=uPulse\*clamp\(uWallSat,0\.0,1\.0\)\*ahead;/, "standing marks take the shared heard-beat pulse and still exclude wake/missed cells");
});

test("Enfilade rear slots crumble before recycle and reduced-motion identities stay pinned", () => {
  const vertexContext = vm.createContext({
    ML_ARCH_N: 11, ML_ARCH_EVERY: 4, ML_BITE: false, ML_TERRAIN: false, ML_WALL_EXHALE: 0, ML_WALL_ECHO: false, ML_DOOR_CROSS: false, reduceMotion: false, ML_WALL_REAR0: -12, ML_WALL_REAR1: -8, ROAD_MPB: 27, ROAD_FADE0: 734.4, ROAD_FADE1: 864,
    _roadG: (number) => (+number).toFixed(5),
  });
  vm.runInContext(`${extractFunction(html, "roadWallVertexShader")}\nthis.shader=roadWallVertexShader();`, vertexContext);
  assert.match(vertexContext.shader, /vWallRetire=smoothstep\(-12\.00000,-8\.00000,b-uNow\)/);
  assert.match(emittedWallFragment(), /if\(vWallRetire<wallVn\(vec2\(x,y\)\*5\.3\+19\.1\)\) discard;/, "the rear wall reuses the smooth powder field while it retires");
  const smoothstep = (edge0, edge1, value) => { const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t); };
  const retire = [-8, -9, -10, -11, -12].map((phase) => smoothstep(-12, -8, phase));
  assert.deepEqual(retire, [1, 0.84375, 0.5, 0.15625, 0]);
  const identities = (reduced) => {
    const colours = () => Array.from({ length: 11 }, () => ({ value: null, setHex(value) { this.value = value; } })), wallCol = colours(), wallNext = colours();
    const context = vm.createContext({
      Math, Number, Float32Array, ML_WALLS: true, ML_WALL_EXHALE: 0, ML_WALL_ECHO: false, ML_MERCY_INVERSE: false, ML_NAVE: true, ML_WALL_N: 7, ML_ARCH_N: 11, ML_ARCH_EVERY: 4, ML_ARCH_BEHIND: 8, LOW: false, reduceMotion: reduced,
      CFG: { moonline: { naveStreetGold: 1, wallDissolve: 95, wallGlow: 1, dustGlow: 1 } }, _archKind: new Float32Array(11), _wallCol: wallCol, _wallNext: wallNext,
      roadMat: { uniforms: { uNaveGold: null } }, roadArchMat: null, roadWallMat: { uniforms: { uArchN0: { value: 0 }, uWallDissolve: { value: 0 }, uWallGlow: { value: 0 } } }, roadMercyInverse: null, roadDustMat: null,
      roadTideAt: (beat) => ({ m: ((Math.floor(beat / 4) % 7) + 7) % 7 === 2 ? 1 : 0 }), roadWallPaletteAt: (bar) => bar + 1000,
    });
    vm.runInContext(`${extractFunction(html, "roadArchFill")}\nroadArchFill(0); this.first={kind:Array.from(_archKind),col:_wallCol.map(c=>c.value),next:_wallNext.map(c=>c.value),n0:roadWallMat.uniforms.uArchN0.value}; roadArchFill(8); this.second={kind:Array.from(_archKind),col:_wallCol.map(c=>c.value),next:_wallNext.map(c=>c.value),n0:roadWallMat.uniforms.uArchN0.value};`, context);
    return { first: context.first, second: context.second };
  };
  const standing = identities(true); assert.deepEqual(standing.second, standing.first, "standing slots cannot swap wall/ring/suppressed kind or chamber colour at a later bar");
  const scrolling = identities(false); assert.notDeepEqual(scrolling.second.col.slice(0, 7), scrolling.first.col.slice(0, 7), "the moving treadmill still advances absolute chamber identities");
});

test("Enfilade LOW builds only the named seven nearest wall stations", () => {
  const cap = html.match(/const ML_WALL_LOW_N=(\d+), ML_WALL_N=LOW\?ML_WALL_LOW_N:ML_ARCH_N;/); assert.ok(cap);
  assert.equal(Number(cap[1]), 7);
  const build = extractFunction(html, "buildRoadWalls");
  assert.match(build, /new Float32Array\(ML_WALL_N\*12\)/);
  assert.match(build, /pn=ML_WALL_N\*\(3\+sparkN\)/);
  assert.equal((build.match(/for\(let k=0;k<ML_WALL_N;k\+\+\)/g) || []).length, 3, "wall, accent, and desktop veil geometry share the active-station cap");
  assert.doesNotMatch(build, /for\(let k=0;k<ML_ARCH_N;k\+\+\)/, "no wall-family geometry loop can build the four capped LOW stations");
  assert.equal(Number(cap[1]) * 2, 14, "LOW submits fourteen wall triangles instead of the uncapped twenty-two");
});

test("Enfilade glow-through is neutral at equal depth", () => {
  const materialAt = html.indexOf("const TARGET_THROUGH_MAT="), materialEnd = html.indexOf("const SPAWN_UP=", materialAt), materials = html.slice(materialAt, materialEnd);
  assert.ok(materialAt >= 0 && materialEnd > materialAt);
  const depthModes = [...materials.matchAll(/depthFunc:THREE\.(\w+)/g)].map((match) => match[1]);
  assert.deepEqual(depthModes, ["GreaterDepth", "GreaterDepth"]); assert.match(materials, /^const TARGET_THROUGH_MAT=ML_WALLS\?/); assert.match(materials, /blending:THREE\.AdditiveBlending/); assert.doesNotMatch(materials, /depthWrite:true/);
  const passes = (mode, fragmentDepth, bufferDepth) => mode === "GreaterDepth" ? fragmentDepth > bufferDepth : mode === "LessEqualDepth" ? fragmentDepth <= bufferDepth : false;
  const source = [0.16, 0.08, 0.04], destination = [0.2, 0.3, 0.4], contribution = passes(depthModes[0], 0.5, 0.5) ? source : source.map(() => 0), blended = destination.map((channel, index) => channel + contribution[index]);
  assert.deepEqual(contribution, [0, 0, 0]); assert.deepEqual(blended, destination, "an unoccluded/equal-depth Echo receives no extra tint"); assert.equal(passes(depthModes[0], 0.6, 0.5), true, "the pass remains available behind opaque chalk");
  assert.equal(productionFlags(wallOptions({ wallsOn: false })).walls, false); assert.equal(productionFlags(wallOptions({ wallsOn: true })).walls, true);
  const create = extractFunction(html, "createTargetMesh"), spawn = extractFunction(html, "spawnTarget");
  assert.match(create, /if\(ML_WALLS\).*new THREE\.Mesh\(TARGET_SHELL_GEO,TARGET_THROUGH_MAT\[0\]\).*shell\.add\(through\)/s);
  assert.equal((create.match(/shell\.add\(through\)/g) || []).length, 1, "one glow-through child creates at most one extra draw per orb");
  assert.match(spawn, /if\(through\) through\.material=TARGET_THROUGH_MAT\[kind\]/); assert.match(spawn, /if\(through\) through\.material=TANK_THROUGH_MAT/);
});

test("Enfilade door remains solid below deck and clamps honey across both half-spaces", () => {
  const shader = emittedWallFragment(); assert.ok(shader);
  assert.match(shader, /if\(y<0\.0\) d=max\(d,-y\);/);
  assert.match(shader, /exp\(-abs\(y\)\*0\.5\)/);
  assert.match(shader, /if\(y<0\.0\) grad\*=exp\(y\*0\.05\);/);
  assert.doesNotMatch(shader, /exp\(-y\b/);
});
