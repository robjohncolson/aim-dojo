"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const wave11Fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "moonline-wave11-shaders.fixture.json"), "utf8"));

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
  new vm.Script(`${source}\nthis.breathHarness={emitWave9RoadShaders};`, { filename }).runInContext(context);
  return context.breathHarness;
}

function breathOptions(overrides = {}) {
  return { markGlyph: true, terrainOn: true, terrainAmp: 1, curveBite: 2.2, wallsOn: true, wallDissolve: 95, wallGlow: 1, wallExhale: 0, wallEcho: 0, wallSat: 1, ...overrides };
}

function breathFlags(source, options) {
  const declarations = ["ML_WALLS", "ML_WALL_EXHALE", "ML_WALL_ECHO"].map((name) => {
    const match = source.match(new RegExp(`const ${name}=([^;]+);`));
    assert.ok(match, `${name} gate is extractable`);
    return `const ${name}=${match[1]};`;
  }).join("\n");
  const context = vm.createContext({ CFG: { moonline: options }, ML_NAVE: true, Math });
  vm.runInContext(`${declarations}\nthis.flags={walls:ML_WALLS,exhale:ML_WALL_EXHALE,echo:ML_WALL_ECHO};`, context);
  return { ...context.flags };
}

function numericConst(source, name) {
  const match = source.match(new RegExp(`\\b${name}=([0-9.]+)`));
  assert.ok(match, `${name} is a named numeric constant`);
  return Number(match[1]);
}

function emittedWallFamilyShaders(source, options, { low = false, reduced = false } = {}) {
  class BufferGeometry { setAttribute() {} setIndex() {} }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  class ShaderMaterial { constructor(settings) { Object.assign(this, settings); } }
  class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; } }
  class Points extends Mesh {}
  const flags = breathFlags(source, options), uniform = () => ({ value: 0 }), roadUniforms = {
    uNow: uniform(), uBase: uniform(), uA: uniform(), uW: uniform(), uP: uniform(), uBite: uniform(), uTerrain: uniform(), uTerrainBase: uniform(), uHorizon: uniform(), uPulse: uniform(),
  };
  const context = vm.createContext({
    Math, Number, Float32Array, Uint16Array,
    CFG: { moonline: options }, LOW: low, reduceMotion: reduced, ML_TERRAIN: true, ML_BITE: true, ML_WALL_STAR: false, ML_WALL_EXHALE: flags.exhale, ML_WALL_ECHO: flags.echo, ML_DOOR_CROSS: !!options.doorCross, ML_MERCY_INVERSE: false,
    ML_ARCH_N: 11, ML_WALL_N: low ? 7 : 11, ML_ARCH_BEHIND: 8, ML_ARCH_EVERY: 4, ML_WALL_REAR0: -12, ML_WALL_REAR1: -8, ROAD_MPB: 27, ROAD_FADE0: 734.4, ROAD_FADE1: 864, ML_FOCAL_PX: 494.82,
    ML_WALL_X: 216.5, ML_WALL_Y0: -270, ML_WALL_Y1: 221, ML_WALL_APEX: 17, ML_WALL_RING_R1: 10, ML_WALL_RING_R2: 11.6, ML_WALL_SPRING: 12, ML_WALL_DJ: 7.3, ML_WALL_DA: 7.3, ML_WALL_DB: 5,
    ML_WALL_BAY_X: 16.5, ML_WALL_BAY_Y0: -70, ML_WALL_BAY_Y1: 21, ML_WALL_POWDER1: 200, ML_WALL_POWDER_NOISE: 22,
    ML_WALL_EXHALE2: numericConst(source, "ML_WALL_EXHALE2"), ML_WALL_EXHALE1: numericConst(source, "ML_WALL_EXHALE1"),
    ML_WALL_ECHO_LIFT: numericConst(source, "ML_WALL_ECHO_LIFT"), ML_WALL_ECHO_BEATS: numericConst(source, "ML_WALL_ECHO_BEATS"), ML_WALL_ECHO_WIDTH: numericConst(source, "ML_WALL_ECHO_WIDTH"),
    ML_WALL_ECHO_SPEED: 108, ML_WALL_ECHO_DIM: numericConst(source, "ML_WALL_ECHO_DIM"), ML_WALL_ECHO_DIM_BEATS: numericConst(source, "ML_WALL_ECHO_DIM_BEATS"), ML_WALL_ECHO_STILL_BEATS: numericConst(source, "ML_WALL_ECHO_STILL_BEATS"), ML_CROSS_LIFT: 0.18, ML_CROSS_BEATS: 1,
    _archKind: new Float32Array(11), _wallCol: Array.from({ length: 11 }, () => ({})), _wallNext: Array.from({ length: 11 }, () => ({})), _wallHit: { value: -1e9 }, _wallMiss: { value: -1e9 }, _wallCross: { value: -1e9 },
    roadMat: { uniforms: roadUniforms }, roadWall: null, roadWallMat: null, roadWallAccent: null, roadWallAccentMat: null, roadWallVeil: null, roadWallVeilMat: null,
    _roadG: (number) => (+number).toFixed(5), roadTerrainShader: () => "TERRAIN", scene: { add() {} }, THREE: { BufferGeometry, BufferAttribute, ShaderMaterial, Mesh, Points, DoubleSide: 1, AdditiveBlending: 2 },
  });
  const production = ["roadWallVertexShader", "roadWallFragmentShader", "buildRoadWalls"].map((name) => extractFunction(source, name)).join("\n");
  vm.runInContext(`${production}\nbuildRoadWalls(); this.family={wallVertex:roadWallMat.vertexShader,wallFragment:roadWallMat.fragmentShader,wallAccentVertex:roadWallAccentMat.vertexShader,wallAccentFragment:roadWallAccentMat.fragmentShader,wallVeilVertex:roadWallVeilMat&&roadWallVeilMat.vertexShader,wallVeilFragment:roadWallVeilMat&&roadWallVeilMat.fragmentShader};`, context);
  return { ...context.family };
}

function emittedWallShaders(source, options, variant = {}) {
  const family = emittedWallFamilyShaders(source, options, variant);
  return { vertex: family.wallVertex, fragment: family.wallFragment };
}

function emittedBreathSet(source, overrides = {}) {
  const options = breathOptions(overrides), walls = emittedWallFamilyShaders(source, options), road = loadRoadHarness().emitWave9RoadShaders(source, {
    mark: true, terrain: true, bite: true, live: true, walls: true, wallSat: 1, wallExhale: options.wallExhale, wallEcho: !!options.wallEcho,
  });
  return { roadVertex: road.roadVertex, roadFragment: road.roadFragment, roadSocketFragment: road.roadSocketFragment, ...walls };
}

function smoothstep(edge0, edge1, value) {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

test("Breath kill-switches independently preserve the frozen Wave 11 emission", () => {
  const assertGateContract = (source) => {
    assert.deepEqual(breathFlags(source, breathOptions({ wallExhale: 1, wallEcho: 0 })), { walls: true, exhale: 1, echo: false }, "exhale can stand alone");
    assert.deepEqual(breathFlags(source, breathOptions({ wallExhale: 0, wallEcho: 1 })), { walls: true, exhale: 0, echo: true }, "echo can stand alone");
  };
  assertGateContract(html);
  assert.deepEqual(fingerprint(emittedBreathSet(html, { wallExhale: 0, wallEcho: 0 })), wave11Fixture, "both switches off");
  for (const variant of [
    { label: "wallExhale:0 alone", options: { wallExhale: 0, wallEcho: 1 }, flags: { walls: true, exhale: 0, echo: true }, present: /uWallHit,uWallMiss/, absent: /wallBars=/ },
    { label: "wallEcho:0 alone", options: { wallExhale: 1, wallEcho: 0 }, flags: { walls: true, exhale: 1, echo: false }, present: /wallBars=/, absent: /uWallHit|uWallMiss/ },
  ]) {
    const emitted = emittedBreathSet(html, variant.options);
    assert.deepEqual(breathFlags(html, breathOptions(variant.options)), variant.flags, `${variant.label} leaves the other switch on`);
    assert.match(emitted.wallFragment, variant.present, variant.label); assert.doesNotMatch(emitted.wallFragment, variant.absent, variant.label);
    assert.notDeepEqual(fingerprint(emitted), wave11Fixture, `${variant.label} retains the other parcel's emission`);
  }
  const exhaleOnly = emittedBreathSet(html, { wallExhale: 1, wallEcho: 0 }), echoOnly = emittedBreathSet(html, { wallExhale: 0, wallEcho: 1 });
  assert.notDeepEqual(fingerprint(exhaleOnly).wallFragment, wave11Fixture.wallFragment, "the exhale switch owns wall dissolve emission");
  assert.notDeepEqual(fingerprint(echoOnly).wallVertex, wave11Fixture.wallVertex, "the echo switch owns wall locality emission");
  assert.match(echoOnly.wallFragment, /uWallHit,uWallMiss/); assert.doesNotMatch(exhaleOnly.wallFragment, /uWallHit|uWallMiss/);
  const survivingMutation = html.replace(/const ML_WALL_ECHO=ML_WALLS && !!\(CFG\.moonline && CFG\.moonline\.wallEcho\);/, "const ML_WALL_ECHO=ML_WALLS && !!(CFG.moonline && CFG.moonline.wallExhale);");
  assert.notEqual(survivingMutation, html, "the historical cross-wired gate mutation is constructible");
  assert.throws(() => assertGateContract(survivingMutation), assert.AssertionError, "the alone variants kill the mutation that a both-off check lets survive");
});

test("Breath exhale emits the 100/60/30 mercy approach and instant inhale law", () => {
  const colours = () => Array.from({ length: 7 }, () => ({ setHex() {} })), context = vm.createContext({
    Math, Float32Array, ML_WALLS: true, ML_WALL_EXHALE: 1, ML_MERCY_INVERSE: false, ML_NAVE: true, ML_WALL_N: 7, ML_ARCH_N: 7, ML_ARCH_EVERY: 4, ML_ARCH_BEHIND: 12, LOW: false, reduceMotion: false,
    CFG: { moonline: { naveStreetGold: 1, wallDissolve: 100, wallGlow: 1, dustGlow: 1 } }, _archKind: new Float32Array(7), _wallCol: colours(), _wallNext: colours(),
    roadMat: { uniforms: { uNaveGold: null } }, roadArchMat: null, roadWallMat: { uniforms: { uArchN0: { value: 0 }, uWallDissolve: { value: 0 }, uWallGlow: { value: 0 } } }, roadMercyInverse: null, roadDustMat: null,
    roadTideAt: (beat) => ({ m: beat === 0 ? 1 : 0 }), roadWallPaletteAt: () => 0,
  });
  vm.runInContext(`${extractFunction(html, "roadArchFill")}\nroadArchFill(0); this.kind=Array.from(_archKind);`, context);
  const shader = emittedWallShaders(html, breathOptions({ wallExhale: 1, wallEcho: 0 })).fragment;
  const law = shader.match(/exhaleRadius=mix\(([0-9.]+),([0-9.]+),step\(1\.5,wallBars\)\); exhaleRadius=mix\(exhaleRadius,([0-9.]+),step\(2\.5,wallBars\)\); float wallDissolve=mix\(uWallDissolve,uWallDissolve\*exhaleRadius,([0-9.]+)\)/);
  assert.ok(law, "the emitted radius input is extractable");
  const one = Number(law[1]), two = Number(law[2]), full = Number(law[3]), amount = Number(law[4]);
  const dissolveAt = (kind) => { const bars = Math.floor((kind - Math.floor(kind)) * 100 + 0.5), scale = bars >= 3 ? full : bars >= 2 ? two : one; return 100 * (1 + (scale - 1) * amount); };
  const kinds = context.kind, samples = [kinds[0], kinds[1], kinds[2], kinds[3], kinds[6]];
  assert.deepEqual(samples.map((kind, index) => index === 3 ? null : Math.round(dissolveAt(kind))), [100, 60, 30, null, 100]);
  assert.deepEqual(Array.from(kinds.slice(2, 6), (kind) => Math.floor(kind + 1e-4)), [2, 1, 2, 2], "Wave 11's one-before through two-after no-wall span remains intact around the ring");
  assert.match(shader, /smoothstep\(wallDissolve,200\.00000/); assert.doesNotMatch(shader, /uniform float uWallExhale/);
  const lowShader = emittedWallShaders(html, breathOptions({ wallExhale: 1, wallEcho: 0 }), { low: true }).fragment;
  assert.match(lowShader, /smoothstep\(wallDissolve,200\.00000,r\)/, "LOW changes the same existing dissolve input without another pass");
});

test("Breath echo adds exactly two one-way gameplay stamp writes", () => {
  const grade = extractFunction(html, "gradeRhythmHit"), clank = extractFunction(html, "clankShot");
  const spawnAndAim = ["spawnTarget", "computeShotPlan", "spawnProjectile", "updateArcPreview", "scopeLockTarget", "updateScope"].map((name) => extractFunction(html, name)).join("\n");
  const gameplay = `${grade}\n${clank}\n${spawnAndAim}`, writes = [...gameplay.matchAll(/_wall(Hit|Miss)\.value\s*=/g)];
  assert.deepEqual(writes.map((match) => match[1]), ["Hit", "Miss"]);
  assert.deepEqual([...html.matchAll(/_wall(Hit|Miss)\.value\s*=/g)].map((match) => match[1]), ["Hit", "Miss", "Hit", "Miss"], "production has only the event pair and the session-boundary reset pair");
  const withoutWrites = gameplay.replace(/_wall(?:Hit|Miss)\.value\s*=[^;]+;/g, "");
  assert.doesNotMatch(withoutWrites, /_wall(?:Hit|Miss)\.value|uWallHit|uWallMiss/, "gameplay never reads either visual stamp back");
  assert.doesNotMatch(spawnAndAim, /ML_WALL_ECHO|roadWall|_wallHit|_wallMiss/, "spawn and aim paths remain wall-blind");
  assert.match(grade, /if\(ML_WALL_ECHO&&gradeIdx===0\) _wallHit\.value=/); assert.match(clank, /if\(ML_WALL_ECHO\) _wallMiss\.value=/);
  assert.doesNotMatch(`${grade}\n${clank}`, /roadBeatNow\s*\(/, "the event sites reuse the road's written clock instead of reading a new one");
  const live = emittedWallShaders(html, breathOptions({ wallExhale: 0, wallEcho: 1 })), low = emittedWallShaders(html, breathOptions({ wallExhale: 0, wallEcho: 1 }), { low: true }), still = emittedWallShaders(html, breathOptions({ wallExhale: 0, wallEcho: 1 }), { reduced: true });
  assert.match(live.fragment, /uWallHit,uWallMiss/); assert.match(low.fragment, /missAge=/); assert.doesNotMatch(low.fragment, /hitAge=|echoWarm=/, "LOW emits dim only");
  const stillEcho = still.fragment.slice(still.fragment.indexOf("float missAge="), still.fragment.lastIndexOf("gl_FragColor"));
  assert.match(stillEcho, /smoothstep\(0\.0,1\.00000,hitAge\)/); assert.doesNotMatch(stillEcho, /length\(vec2\(/, "reduced motion emits a static one-beat glow, never a travelling front");
  const standingRoad = loadRoadHarness().emitWave9RoadShaders(html, { mark: true, terrain: true, bite: true, walls: true, wallSat: 1, wallEcho: true, reduceMotion: true }).roadFragment;
  assert.match(standingRoad, /abs\(fract\(uPulse\+0\.5\)-0\.5\)<0\.12/); assert.doesNotMatch(standingRoad, /\bround\s*\(/, "the reconstructed pulse remains WebGL1-safe");
});

test("Breath reduced-motion echo keeps live age but pinned chamber locality", () => {
  const assertPinnedLocality = (vertex) => {
    const clocks = vertex.match(/vWallClock=(uPulse|uNow); vWallLocal=1\.0-step\(1\.5,abs\(floor\(b\/4\.00000\)-floor\((uPulse|uNow|vWallClock)\/4\.00000\)\)\)/);
    assert.ok(clocks, "both reduced-motion clock authorities are extractable from the emitted shader");
    assert.deepEqual(clocks.slice(1), ["uPulse", "uNow"], "age advances on uPulse while locality stays on pinned uNow");
    for (const liveClock of [10, 50, 200]) {
      const values = { uNow: 0, uPulse: liveClock, vWallClock: liveClock }, pinnedStationBeat = 0;
      const locality = Math.abs(Math.floor(pinnedStationBeat / 4) - Math.floor(values[clocks[2]] / 4)) < 1.5 ? 1 : 0;
      assert.ok(locality > 0, `the pinned current-chamber station remains local at live beat ${liveClock}`);
    }
  };
  const still = emittedWallShaders(html, breathOptions({ wallExhale: 0, wallEcho: 1 }), { reduced: true });
  assertPinnedLocality(still.vertex);
  const mutation = still.vertex.replace("floor(uNow/4.00000)", "floor(vWallClock/4.00000)");
  assert.notEqual(mutation, still.vertex, "the reviewed advancing-locality mutation is constructible");
  assert.throws(() => assertPinnedLocality(mutation), assert.AssertionError, "the pinned-station samples kill advancing echo locality");
});

test("Breath echo stamps initialize and reset outside every new run", () => {
  const assertLifecycle = (source) => {
    const initial = source.match(/const _wallHit=\{value:(-?[0-9.e+]+)\}, _wallMiss=\{value:(-?[0-9.e+]+)\};/i);
    assert.ok(initial, "both initial echo sentinels are extractable");
    const shader = emittedWallShaders(source, breathOptions({ wallExhale: 0, wallEcho: 1 })).fragment;
    const missDuration = shader.match(/smoothstep\(0\.0,([0-9.]+),missAge\)/), hitDuration = shader.match(/smoothstep\(0\.0,([0-9.]+),hitAge\)/);
    assert.ok(missDuration && hitDuration, "the emitted echo ages are extractable");
    const contribution = (clock, stamp, duration) => { const age = clock - stamp; return (1 - smoothstep(0, duration, age)) * (age >= 0 ? 1 : 0); };
    for (const stamp of initial.slice(1).map(Number)) for (const clock of [0, 1, 3.99, 4, 4.25, 5]) {
      assert.equal(contribution(clock, stamp, Number(hitDuration[1])), 0, `a fresh stamp cannot replay a hit at beat ${clock}`);
      assert.equal(contribution(clock, stamp, Number(missDuration[1])), 0, `a fresh stamp cannot replay a miss at beat ${clock}`);
    }
    const reset = extractFunction(source, "resetSession"), resetWrite = reset.match(/if\(ML_WALL_ECHO\) _wallHit\.value=_wallMiss\.value=-?[0-9.e+]+;/i);
    assert.ok(resetWrite, "resetSession owns one gated reset of both stamps");
    const hit = { value: 4 }, miss = { value: 4 }, context = vm.createContext({ ML_WALL_ECHO: true, _wallHit: hit, _wallMiss: miss, roadWallMat: { uniforms: { uWallHit: hit, uWallMiss: miss } } });
    vm.runInContext(resetWrite[0], context);
    assert.deepEqual([hit.value, miss.value, context.roadWallMat.uniforms.uWallHit.value, context.roadWallMat.uniforms.uWallMiss.value], [-1e9, -1e9, -1e9, -1e9], "the live shared uniforms clear with their stamps");
    for (const clock of [0, 1, 3.99, 4, 4.25, 5]) {
      assert.equal(contribution(clock, hit.value, Number(hitDuration[1])), 0, `reset prevents a phantom hit at beat ${clock}`);
      assert.equal(contribution(clock, miss.value, Number(missDuration[1])), 0, `reset prevents a phantom miss at beat ${clock}`);
    }
  };
  assertLifecycle(html);
  const initialMutation = html.replace("const _wallHit={value:-1e9}, _wallMiss={value:-1e9};", "const _wallHit={value:4}, _wallMiss={value:4};");
  assert.notEqual(initialMutation, html, "the reviewer's initial-stamp-4 mutation is constructible");
  assert.throws(() => assertLifecycle(initialMutation), assert.AssertionError, "the lifecycle samples kill the initial-stamp-4 replay");
  const resetMutation = html.replace("if(ML_WALL_ECHO) _wallHit.value=_wallMiss.value=-1e9;", "if(ML_WALL_ECHO) _wallHit.value=_wallMiss.value=4;");
  assert.notEqual(resetMutation, html, "the reset-stamp-4 mutation is constructible");
  assert.throws(() => assertLifecycle(resetMutation), assert.AssertionError, "the lifecycle samples kill a phantom-producing reset");
});

test("Breath uK readers agree on kind and bars-to-mercy for every packed family value", () => {
  const samples = [
    [0.01, { kind: 0, barsToMercy: 1 }], [0.02, { kind: 0, barsToMercy: 2 }], [0.03, { kind: 0, barsToMercy: 3 }],
    [1.03, { kind: 1, barsToMercy: 3 }], [2.01, { kind: 2, barsToMercy: 1 }], [2.03, { kind: 2, barsToMercy: 3 }],
  ];
  const barsToMercy = (packed) => Math.floor((packed - Math.floor(packed)) * 100 + 0.5);
  const assertTruthTable = (source) => {
    const family = emittedWallFamilyShaders(source, breathOptions({ wallExhale: 1, wallEcho: 0 })), wallSource = `${family.wallVertex}\n${family.wallFragment}`, accentSource = `${family.wallAccentVertex}\n${family.wallAccentFragment}`, veilSource = `${family.wallVeilVertex}\n${family.wallVeilFragment}`;
    for (const reader of [wallSource, accentSource, veilSource]) assert.match(reader, /uK\[/, "every wall-family reader receives the packed uK channel");
    const thresholdReader = (reader) => {
      const bounds = reader.match(/vWallKind>([0-9.]+)[\s\S]*?vWallKind>([0-9.]+)/); assert.ok(bounds, "wall/veil kind bounds are extractable");
      const upper = Number(bounds[1]), lower = Number(bounds[2]);
      return (packed) => ({ kind: packed > upper ? 2 : (packed > lower ? 1 : 0), barsToMercy: barsToMercy(packed) });
    };
    const accentBounds = accentSource.match(/mercy=step\(([0-9.]+),kind\)\*step\(kind,([0-9.]+)\)[\s\S]*?show=\(1\.0-step\(([0-9.]+),kind\)\)/);
    assert.ok(accentBounds, "accent mercy and no-wall bounds are extractable");
    const accentReader = (packed) => { const mercy = packed >= Number(accentBounds[1]) && packed <= Number(accentBounds[2]), noWall = packed >= Number(accentBounds[3]); return { kind: noWall ? 2 : (mercy ? 1 : 0), barsToMercy: barsToMercy(packed) }; };
    const readers = { wall: thresholdReader(wallSource), accent: accentReader, veil: thresholdReader(veilSource) }, output = {};
    for (const [name, read] of Object.entries(readers)) {
      output[name] = samples.map(([packed]) => read(packed));
      assert.deepEqual(output[name], samples.map(([, expected]) => expected), `${name} decodes the complete uK truth table`);
    }
    return output;
  };
  assertTruthTable(html);
  const mutation = html.replaceAll("step(0.5,kind)*step(kind,1.5)", "step(0.02,kind)*step(kind,1.5)");
  assert.notEqual(mutation, html, "the reviewer's accent step-boundary mutation is constructible");
  assert.throws(() => assertTruthTable(mutation), assert.AssertionError, "the accent truth table kills packed walls misclassified as mercy");
});

test("Breath ripple is warm-white, chamber-local, and luminance-capped at twelve percent", () => {
  const emitted = emittedWallShaders(html, breathOptions({ wallExhale: 1, wallEcho: 1 })), shader = emitted.fragment;
  const capMatch = html.match(/const ML_WALL_ECHO_LIFT=([0-9.]+)/); assert.ok(capMatch); const cap = Number(capMatch[1]); assert.equal(cap, 0.12);
  assert.match(emitted.vertex, /vWallLocal=1\.0-step\(1\.5,abs\(floor\(b\/4\.00000\)-floor\(uNow\/4\.00000\)\)\)/);
  assert.match(shader, /abs\(max\(0\.0,abs\(x\)-7\.30000\)-hitAge\*108\.00000\)/);
  assert.match(shader, /echoLift=min\(wallLum\*0\.12000\*hitEcho,max\(0\.0,\(1\.0-wallLum\)\/echoWarmLum\)\)/);
  const warm = [1, 0.97, 0.9], warmLum = warm[0] * 0.2126 + warm[1] * 0.7152 + warm[2] * 0.0722;
  for (let base = 0; base <= 1.00001; base += 0.01) for (let age = 0; age <= 1.50001; age += 0.025) for (let distance = 0; distance <= 180; distance += 2) {
    const decay = (1 - smoothstep(0, 1.5, age)), wave = 1 - smoothstep(4, 8, Math.abs(distance - age * 108)), phase = decay * wave;
    const lift = Math.min(base * cap * phase, Math.max(0, (1 - base) / warmLum)), luminance = base + warmLum * lift;
    assert.ok(luminance <= Math.min(1, base * (1 + cap)) + 1e-12, `cap holds at base=${base.toFixed(2)} age=${age.toFixed(3)} distance=${distance}`);
  }
  const effect = shader.slice(shader.indexOf("float wallBars="), shader.lastIndexOf("gl_FragColor"));
  assert.match(effect, /vec3 echoWarm=vec3\(1\.0,0\.97,0\.90\)/); assert.doesNotMatch(effect, /\buL[0-3]\b|lanePure|markCol|\blc\b/i, "neither exhale nor echo can name lane colour");
  const echoEffect = shader.slice(shader.indexOf("float missAge="), shader.lastIndexOf("gl_FragColor")); assert.doesNotMatch(echoEffect, /\by\b/, "the ripple adds no half-space-sensitive vertical term");
  const laneHex = html.match(/WASD_HEX=\[([^\]]+)\]/); assert.ok(laneHex);
  for (const literal of laneHex[1].split(",").map((value) => value.trim().toLowerCase())) assert.doesNotMatch(effect.toLowerCase(), new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
