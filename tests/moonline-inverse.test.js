"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const inverseSpec = fs.readFileSync(path.join(ROOT, "SPEC_MOONLINE_INVERSE.md"), "utf8");
const wave10Fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "moonline-wave10-shaders.fixture.json"), "utf8"));
const wave111Fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "moonline-wave11-1-shaders.fixture.json"), "utf8"));

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
  new vm.Script(`${source}\nthis.inverseRoadHarness={emitWave9RoadShaders,emitWave9NaveShaders};`, { filename }).runInContext(context);
  return context.inverseRoadHarness;
}

function inverseOptions(overrides = {}) {
  return { markGlyph: true, terrainOn: true, terrainAmp: 1, curveBite: 2.2, wallsOn: true, wallDissolve: 95, wallGlow: 1, wallExhale: 1, wallEcho: true, mercyInverse: true, wallSat: 1, wallPalette: null, ...overrides };
}

function inverseFlags(source, options) {
  const names = ["ML_WALLS", "ML_WALL_EXHALE", "ML_WALL_ECHO", "ML_MERCY_INVERSE", "ML_DOOR_CROSS"];
  const declarations = names.map((name) => {
    const match = source.match(new RegExp(`const ${name}=([^;]+);`));
    assert.ok(match, `${name} gate is extractable`);
    return `const ${name}=${match[1]};`;
  }).join("\n");
  const context = vm.createContext({ CFG: { moonline: options }, ML_NAVE: true, Math });
  vm.runInContext(`${declarations}\nthis.flags={walls:ML_WALLS,exhale:ML_WALL_EXHALE,echo:ML_WALL_ECHO,inverse:ML_MERCY_INVERSE,doorCross:ML_DOOR_CROSS};`, context);
  return { ...context.flags };
}

function numericConst(source, name) {
  const match = source.match(new RegExp(`\\b${name}=([0-9.]+)`));
  assert.ok(match, `${name} is a named numeric constant`);
  return Number(match[1]);
}

function emittedRoadFamily(source, overrides = {}) {
  return loadRoadHarness().emitWave9RoadShaders(source, {
    mark: true, terrain: true, bite: true, live: true, walls: true, wallSat: 1, wallExhale: 1, wallEcho: true, mercyInverse: true, ...overrides,
  });
}

function emittedWallFamily(source, options, { low = false, reduced = false } = {}) {
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(name, attribute) { this.attributes[name] = attribute; } setIndex(attribute) { this.index = attribute; } }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  class ShaderMaterial { constructor(settings) { Object.assign(this, settings); } }
  class Mesh {
    constructor(geometry, material) { this.geometry = geometry; this.material = material; this.children = []; }
    add(child) { this.children.push(child); child.parent = this; }
  }
  class Points extends Mesh {}
  const flags = inverseFlags(source, options), uniform = () => ({ value: 0 }), roadUniforms = {
    uNow: uniform(), uBase: uniform(), uA: uniform(), uW: uniform(), uP: uniform(), uBite: uniform(), uTerrain: uniform(), uTerrainBase: uniform(), uHorizon: uniform(), uPulse: uniform(),
  }, sceneAdds = [];
  const context = vm.createContext({
    Math, Number, Float32Array, Uint16Array,
    CFG: { moonline: options }, LOW: low, reduceMotion: reduced, ML_TERRAIN: true, ML_BITE: true, ML_WALL_STAR: false, ML_WALL_EXHALE: flags.exhale, ML_WALL_ECHO: flags.echo, ML_DOOR_CROSS: flags.doorCross, ML_MERCY_INVERSE: flags.inverse,
    ML_ARCH_N: 11, ML_WALL_N: low ? 7 : 11, ML_ARCH_BEHIND: 8, ML_ARCH_EVERY: 4, ML_WALL_REAR0: -12, ML_WALL_REAR1: -8, ROAD_MPB: 27, ROAD_FADE0: 734.4, ROAD_FADE1: 864, ML_FOCAL_PX: 494.82,
    ML_WALL_X: 216.5, ML_WALL_Y0: -270, ML_WALL_Y1: 221, ML_WALL_APEX: 17, ML_WALL_RING_R1: 10, ML_WALL_RING_R2: 11.6, ML_WALL_SPRING: 12, ML_WALL_DJ: 7.3, ML_WALL_DA: 7.3, ML_WALL_DB: 5,
    ML_WALL_BAY_X: 16.5, ML_WALL_BAY_Y0: -70, ML_WALL_BAY_Y1: 21, ML_WALL_POWDER1: 200, ML_WALL_POWDER_NOISE: 22,
    ML_WALL_EXHALE2: numericConst(source, "ML_WALL_EXHALE2"), ML_WALL_EXHALE1: numericConst(source, "ML_WALL_EXHALE1"),
    ML_WALL_ECHO_LIFT: numericConst(source, "ML_WALL_ECHO_LIFT"), ML_WALL_ECHO_BEATS: numericConst(source, "ML_WALL_ECHO_BEATS"), ML_WALL_ECHO_WIDTH: numericConst(source, "ML_WALL_ECHO_WIDTH"),
    ML_WALL_ECHO_SPEED: 108, ML_WALL_ECHO_DIM: numericConst(source, "ML_WALL_ECHO_DIM"), ML_WALL_ECHO_DIM_BEATS: numericConst(source, "ML_WALL_ECHO_DIM_BEATS"), ML_WALL_ECHO_STILL_BEATS: numericConst(source, "ML_WALL_ECHO_STILL_BEATS"), ML_CROSS_LIFT: 0.18, ML_CROSS_BEATS: 1,
    _archKind: new Float32Array(11), _wallCol: Array.from({ length: 11 }, () => ({})), _wallNext: Array.from({ length: 11 }, () => ({})), _wallHit: { value: -1e9 }, _wallMiss: { value: -1e9 }, _wallCross: { value: -1e9 },
    roadMat: { uniforms: roadUniforms }, roadWall: null, roadWallMat: null, roadMercyInverse: null, roadMercyInverseMat: null, roadWallAccent: null, roadWallAccentMat: null, roadWallVeil: null, roadWallVeilMat: null,
    _roadG: (number) => (+number).toFixed(5), roadTerrainShader: () => "TERRAIN", scene: { add(object) { sceneAdds.push(object); } },
    THREE: { BufferGeometry, BufferAttribute, ShaderMaterial, Mesh, Points, DoubleSide: "DoubleSide", AdditiveBlending: "AdditiveBlending", CustomBlending: "CustomBlending", AddEquation: "AddEquation", OneMinusDstColorFactor: "OneMinusDstColorFactor", ZeroFactor: "ZeroFactor" },
  });
  const production = ["roadWallVertexShader", "roadWallFragmentShader", "roadMercyInverseFragmentShader", "buildRoadWalls"].map((name) => extractFunction(source, name)).join("\n");
  vm.runInContext(`${production}\nbuildRoadWalls(); this.family={wall:roadWall,wallMat:roadWallMat,inverse:roadMercyInverse,inverseMat:roadMercyInverseMat,accent:roadWallAccent,accentMat:roadWallAccentMat,veilMat:roadWallVeilMat};`, context);
  return { ...context.family, sceneAdds };
}

function emittedLegacySet(source, wallExhale, wallEcho) {
  const options = inverseOptions({ mercyInverse: false, wallExhale, wallEcho }), family = emittedWallFamily(source, options), road = loadRoadHarness().emitWave9RoadShaders(source, {
    mark: true, terrain: true, bite: true, live: true, walls: true, wallSat: 1, wallExhale, wallEcho, mercyInverse: false,
  });
  return {
    roadVertex: road.roadVertex, roadFragment: road.roadFragment, roadSocketFragment: road.roadSocketFragment,
    wallVertex: family.wallMat.vertexShader, wallFragment: family.wallMat.fragmentShader,
    wallAccentVertex: family.accentMat.vertexShader, wallAccentFragment: family.accentMat.fragmentShader,
    wallVeilVertex: family.veilMat && family.veilMat.vertexShader, wallVeilFragment: family.veilMat && family.veilMat.fragmentShader,
  };
}

function emittedWallsOffSet(source) {
  const harness = loadRoadHarness(), features = { mark: true, terrain: true, bite: true, live: true, walls: false, wallSat: 1, wallExhale: 1, wallEcho: true, mercyInverse: true };
  const road = harness.emitWave9RoadShaders(source, features), nave = harness.emitWave9NaveShaders(source, features);
  return {
    roadVertex: road.roadVertex, roadFragment: road.roadFragment, roadSocketFragment: road.roadSocketFragment,
    naveVertex: nave.naveVertex, naveFragment: nave.naveFragment, naveAccentFragment: nave.naveAccentFragment,
    wallVertex: null, wallFragment: null, wallAccentVertex: null, wallAccentFragment: null, wallVeilVertex: null, wallVeilFragment: null,
  };
}

function inverseVisibilitySequence(source, mercyBeats) {
  const colours = () => Array.from({ length: 7 }, () => ({ setHex() {} })), pane = { visible: false }, depth = { visible: false };
  let mercyBeat = mercyBeats[0];
  const context = vm.createContext({
    Math, Float32Array, ML_WALLS: true, ML_WALL_EXHALE: 1, ML_MERCY_INVERSE: true, ML_NAVE: true, ML_WALL_N: 7, ML_ARCH_N: 7, ML_ARCH_EVERY: 4, ML_ARCH_BEHIND: 8, LOW: false, reduceMotion: false,
    CFG: { moonline: { naveStreetGold: 1, wallDissolve: 95, wallGlow: 1, dustGlow: 1 } }, _archKind: new Float32Array(7), _wallCol: colours(), _wallNext: colours(),
    roadMat: { uniforms: { uNaveGold: null } }, roadArchMat: null, roadWallMat: { uniforms: { uArchN0: { value: 0 }, uWallDissolve: { value: 0 }, uWallGlow: { value: 0 } } }, roadMercyInverse: pane, roadMercyInverseDepth: depth, roadDustMat: null,
    roadTideAt: (beat) => ({ m: beat === mercyBeat ? 1 : 0 }), roadWallPaletteAt: () => 0,
  });
  vm.runInContext(extractFunction(source, "roadArchFill"), context);
  const states = [];
  for (mercyBeat of mercyBeats) {
    vm.runInContext("roadArchFill(0);", context);
    states.push({ pane: pane.visible, depth: depth.visible, kinds: Array.from(context._archKind) });
  }
  return states;
}

function roadFootprintClauses(fragment) {
  const lines = fragment.split("\n"), start = lines.indexOf("  float u=-vXZ.y, d=abs(u);"), end = lines.findIndex((line, index) => index >= start && /^  float outer=.*if\(outer<=0\.004\) discard;$/.test(line));
  assert.ok(start >= 0 && end >= start, "the road footprint clauses are extractable");
  return lines.slice(start, end + 1);
}

function changedInverseGlsl(source) {
  const result = {};
  for (const [tier, low] of [["high", false], ["low", true]]) {
    const family = emittedWallFamily(source, inverseOptions(), { low }), road = emittedRoadFamily(source, { low });
    for (const [name, shader] of Object.entries({
      wallVertex: family.wallMat.vertexShader, wallFragment: family.wallMat.fragmentShader,
      paneVertex: family.inverseMat.vertexShader, paneFragment: family.inverseMat.fragmentShader,
      accentVertex: family.accentMat.vertexShader, accentFragment: family.accentMat.fragmentShader,
      veilVertex: family.veilMat && family.veilMat.vertexShader, veilFragment: family.veilMat && family.veilMat.fragmentShader,
      roadDepthVertex: road.inverseDepthMaterial.vertexShader, roadDepthFragment: road.inverseDepthMaterial.fragmentShader,
    })) if (shader != null) result[`${tier}.${name}`] = shader;
  }
  return result;
}

function assertNoLaneLiterals(source) {
  const laneMatch = source.match(/WASD_HEX=\[([^\]]+)\]/); assert.ok(laneMatch, "the lane authority is extractable");
  const lanes = laneMatch[1].split(",").map((literal) => Number(literal.trim())).map((value) => [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255]);
  const compactLiterals = laneMatch[1].split(",").map((literal) => literal.trim().toLowerCase());
  for (const [name, shader] of Object.entries(changedInverseGlsl(source))) {
    const compact = shader.toLowerCase().replace(/\s+/g, "");
    for (const literal of compactLiterals) assert.ok(!compact.includes(literal), `${name} has no raw lane hex ${literal}`);
    for (const match of shader.matchAll(/vec3\(\s*([^(),]+)\s*,\s*([^(),]+)\s*,\s*([^(),]+)\s*\)/g)) {
      const expressions = match.slice(1), values = [];
      if (!expressions.every((expression) => /^[0-9eE+\-*/.\s]+$/.test(expression))) continue;
      for (const expression of expressions) values.push(Function(`"use strict"; return (${expression});`)());
      for (const lane of lanes) assert.ok(!values.every((value, index) => Math.abs(value - lane[index]) < 1e-5), `${name} has no normalized numeric lane-colour literal`);
    }
  }
}

function accentVisibility(family, packedKind, mode) {
  const vertex = family.accentMat.vertexShader, initial = vertex.match(/show=([^;]+);/), updates = [...vertex.matchAll(/show\*=([^;]+);/g)].map((match) => match[1]);
  assert.ok(initial && updates.length >= 2, "every inverse accent visibility expression is extractable");
  const step = (edge, value) => value < edge ? 0 : 1, mix = (left, right, amount) => left * (1 - amount) + right * amount;
  const mercy = step(0.5, packedKind) * step(packedKind, 1.5);
  let show = Function("kind", "mercy", "aMode", "step", "mix", `return (${initial[1]});`)(packedKind, mercy, mode, step, mix);
  for (const expression of updates) show *= Function("kind", "mercy", "aMode", "step", "mix", `return (${expression});`)(packedKind, mercy, mode, step, mix);
  return show > 0.5;
}

function assertAllKindReaders(source) {
  const samples = [0.01, 0.02, 0.03, 1.03, 2.01, 2.03], ordinary = [true, true, true, false, false, false], mercy = [false, false, false, true, false, false];
  const family = emittedWallFamily(source, inverseOptions()), wallBound = family.wallMat.fragmentShader.match(/vWallKind>([0-9.]+)/), paneBounds = family.inverseMat.fragmentShader.match(/vWallKind<([0-9.]+) \|\| vWallKind>([0-9.]+)/), veilBound = family.veilMat.fragmentShader.match(/vWallKind>([0-9.]+)/);
  assert.ok(wallBound && paneBounds && veilBound, "every wall-family kind boundary is extractable");
  assert.match(family.wallMat.vertexShader, /vWallKind=uK\[si\]/); assert.match(family.accentMat.vertexShader, /kind=uK\[int\(slot\)\]/);
  assert.deepEqual(samples.map((value) => value <= Number(wallBound[1])), ordinary, "ordinary wall excludes packed mercy and suppressed slots");
  assert.deepEqual(samples.map((value) => value >= Number(paneBounds[1]) && value <= Number(paneBounds[2])), mercy, "inverse pane accepts only packed mercy");
  assert.deepEqual(samples.map((value) => value <= Number(veilBound[1])), ordinary, "ordinary veil excludes packed mercy and suppressed slots");
  assert.deepEqual(samples.map((value) => accentVisibility(family, value, 0)), mercy, "crown reads only packed mercy");
  for (const mode of [1, 2]) assert.deepEqual(samples.map((value) => accentVisibility(family, value, mode)), ordinary, `accent mode ${mode} reads only ordinary slots`);
}

test("Inverse kill-switch preserves every shipped reveal combination and remains independently wired", () => {
  const assertGateContract = (source) => {
    const matrix = [
      [inverseOptions({ mercyInverse: true, wallExhale: 1, wallEcho: true }), { walls: true, exhale: 1, echo: true, inverse: true, doorCross: false }],
      [inverseOptions({ mercyInverse: false, wallExhale: 1, wallEcho: true }), { walls: true, exhale: 1, echo: true, inverse: false, doorCross: false }],
      [inverseOptions({ mercyInverse: true, wallExhale: 0, wallEcho: true }), { walls: true, exhale: 0, echo: true, inverse: true, doorCross: false }],
      [inverseOptions({ mercyInverse: true, wallExhale: 1, wallEcho: false }), { walls: true, exhale: 1, echo: false, inverse: true, doorCross: false }],
      [inverseOptions({ mercyInverse: true, wallsOn: false }), { walls: false, exhale: 0, echo: false, inverse: false, doorCross: false }],
    ];
    for (const [options, expected] of matrix) assert.deepEqual(inverseFlags(source, options), expected);
  };
  assert.match(html, /mercyInverse:1(?:,|\s)/, "the new knob is a flat literal");
  assert.match(html, /const ML_MERCY_INVERSE=ML_WALLS && !!\(CFG\.moonline && CFG\.moonline\.mercyInverse\);/, "the wall master and raw boolean are read first");
  assertGateContract(html);
  for (const [label, exhale, echo] of [["offOff", 0, false], ["exhaleOnly", 1, false], ["echoOnly", 0, true], ["bothOn", 1, true]]) {
    assert.deepEqual(fingerprint(emittedLegacySet(html, exhale, echo)), wave111Fixture[label], `mercyInverse:0 preserves ${label}`);
  }
  assert.deepEqual(fingerprint(emittedWallsOffSet(html)), wave10Fixture, "wallsOn:false still restores frozen Wave 10 with every child switch requested on");
  const mutation = html.replace("const ML_MERCY_INVERSE=ML_WALLS && !!(CFG.moonline && CFG.moonline.mercyInverse);", "const ML_MERCY_INVERSE=ML_WALLS && !!(CFG.moonline && CFG.moonline.wallEcho);");
  assert.notEqual(mutation, html, "the coupling-blind mercyInverse/wallEcho mutation is constructible");
  assert.deepEqual(inverseFlags(mutation, inverseOptions({ mercyInverse: false, wallEcho: false })), { walls: true, exhale: 1, echo: false, inverse: false, doorCross: false }, "the mutation survives a both-off-only check");
  assert.throws(() => assertGateContract(mutation), assert.AssertionError, "the alone matrix kills the surviving cross-wire mutation");
});

test("Inverse pane emits exact one-minus-destination blending and binary edges", () => {
  const assertMaterialContract = (source) => {
    const live = emittedWallFamily(source, inverseOptions()), legacy = emittedWallFamily(source, inverseOptions({ mercyInverse: false })), low = emittedWallFamily(source, inverseOptions(), { low: true });
    assert.ok(live.inverse && live.inverseMat, "the live switch builds the inverse child");
    assert.equal(legacy.inverse, null); assert.equal(legacy.inverseMat, null);
    assert.equal(live.inverse.geometry, live.wall.geometry, "the inverse pane shares the wall silhouette geometry");
    assert.equal(live.inverseMat.vertexShader, live.wallMat.vertexShader, "the inverse pane shares the complete station/terrain vertex path");
    assert.equal(live.inverseMat.uniforms, live.wallMat.uniforms, "the wall family shares one uniform object");
    assert.equal(live.inverse.parent, live.wall, "the wall visibility parent owns the inverse child");
    assert.equal(live.inverse.visible, false, "the filter starts draw-silent before the first station fill");
    assert.deepEqual({ transparent: live.inverseMat.transparent, depthWrite: live.inverseMat.depthWrite, depthTest: live.inverseMat.depthTest, blending: live.inverseMat.blending, blendEquation: live.inverseMat.blendEquation, blendSrc: live.inverseMat.blendSrc, blendDst: live.inverseMat.blendDst }, {
      transparent: true, depthWrite: false, depthTest: true, blending: "CustomBlending", blendEquation: "AddEquation", blendSrc: "OneMinusDstColorFactor", blendDst: "ZeroFactor",
    });
    assert.equal(live.inverse.renderOrder, 6); assert.equal(live.accent.renderOrder, 6.5, "the retained crown star stays normal after the filter"); assert.equal(legacy.accent.renderOrder, -37.8);
    assert.match(source, /if\(ML_MERCY_INVERSE&&roadDust\) roadDust\.renderOrder=7;/);
    const fragment = live.inverseMat.fragmentShader, lowFragment = low.inverseMat.fragmentShader;
    assert.equal((fragment.match(/gl_FragColor/g) || []).length, 1); assert.match(fragment, /gl_FragColor=vec4\(1\.0\);/);
    assert.doesNotMatch(fragment, /gl_FragColor=.*(?:vWallFade|powder|mix|alpha)/, "the inversion source is white and never alpha-faded");
    assert.match(fragment, /powderNoise=wallVn\(vec2\(x,y\)\*0\.9\)\*0\.6\+wallVn\(vec2\(x,y\)\*3\.7\)\*0\.4/);
    assert.match(fragment, /smoothstep\(uWallDissolve,200\.00000/); assert.doesNotMatch(fragment, /wallBars|exhaleRadius|uWallExhale/);
    assert.doesNotMatch(lowFragment, /wallVn|powderNoise/); assert.match(lowFragment, /smoothstep\(uWallDissolve,200\.00000,r\); if\(powder<0\.5\) discard;/); assert.match(lowFragment, /gl_FragColor=vec4\(1\.0\);/);
    const sdf = /float d; if\(y<12\.00000\)[\s\S]*?if\(d<0\.0\) discard;/;
    assert.equal(fragment.match(sdf)[0], live.wallMat.fragmentShader.match(sdf)[0], "the true-colour doorway is the ordinary wall's exact SDF");
    assert.doesNotMatch(live.wallMat.fragmentShader, /float ring=/, "the old ring branch is not emitted");
    assert.doesNotMatch(live.accentMat.fragmentShader, /\brose\b|atan\(/, "the rose is not emitted");
    assert.match(live.accentMat.fragmentShader, /a\+=r4\*0\.62\+r8\*0\.46/, "the eight-point crown star remains");
    assert.match(live.accentMat.vertexShader, /show\*=mix\(1\.0,1\.0-mercy,step\(0\.5,aMode\)\)/, "mercy keeps the crown and suppresses its other accent modes");
    assert.match(live.veilMat.fragmentShader, /vWallKind>0\.5/); assert.doesNotMatch(live.veilMat.fragmentShader, /if\(vWallKind>0\.5\) inside=/, "the mercy veil is not emitted");
    const liveDraws = live.sceneAdds.length + live.wall.children.length, legacyDraws = legacy.sceneAdds.length + legacy.wall.children.length;
    const lowDraws = low.sceneAdds.length + low.wall.children.length, lowLegacy = emittedWallFamily(source, inverseOptions({ mercyInverse: false }), { low: true });
    assert.equal(liveDraws - legacyDraws, 1); assert.equal(lowDraws - (lowLegacy.sceneAdds.length + lowLegacy.wall.children.length), 1, "both tiers add exactly one pane submission");
  };
  assertMaterialContract(html);
  const mutation = html.replace("blendSrc:THREE.OneMinusDstColorFactor", "blendSrc:THREE.OneFactor");
  assert.notEqual(mutation, html, "the non-inverting source-factor mutation is constructible");
  assert.throws(() => assertMaterialContract(mutation), assert.AssertionError, "the exact emitted-material contract kills the source-factor mutation");
});

test("Every uK reader classifies packed wall, mercy, and suppressed values", () => {
  assertAllKindReaders(html);
  const mutation = html.replace("(ML_MERCY_INVERSE?'0.5':'1.5')", "(ML_MERCY_INVERSE?'1.5':'1.5')");
  assert.notEqual(mutation, html, "the ordinary-wall mercy-admission mutation is constructible");
  assert.throws(() => assertAllKindReaders(mutation), assert.AssertionError, "the all-reader table kills the ordinary wall's >1.5 mercy admission");
});

test("Inverse pane and road guard clear on an ordinary beat using the same live objects", () => {
  const assertLifecycle = (source) => {
    const states = inverseVisibilitySequence(source, [0, 100]);
    assert.deepEqual(states.map((state) => state.pane), [true, false], "the pane flips true to false on one object");
    assert.deepEqual(states.map((state) => state.depth), [true, false], "the road guard flips with the pane on one object");
    const fill = extractFunction(source, "roadArchFill");
    assert.match(fill, /roadMercyInverse\.visible=mercyPaneVisible;\s+roadMercyInverseDepth\.visible=mercyPaneVisible;/, "both visibility assignments share the pane decision site and false arm");
  };
  assertLifecycle(html);
  const mutation = html.replace("roadMercyInverse.visible=mercyPaneVisible;", "if(mercyPaneVisible) roadMercyInverse.visible=true;");
  assert.notEqual(mutation, html, "the sticky-pane mutation is constructible");
  assert.throws(() => assertLifecycle(mutation), assert.AssertionError, "the sequential lifecycle kills sticky pane visibility");
});

test("Mercy crown is apex plus 1.35 metres, terrain-lifted, and mercy-only", () => {
  const assertCrown = (source) => {
    const family = emittedWallFamily(source, inverseOptions()), attributes = family.accent.geometry.attributes, positions = attributes.position.array, modes = attributes.aMode.array;
    const apex = numericConst(source, "ML_WALL_APEX"), crowns = [];
    assert.match(source, /wallStar:false(?:,|\s)/, "the shipped flat contract leaves ordinary wall crowns disabled");
    for (let index = 0; index < modes.length; index += 1) if (modes[index] < 0.5) crowns.push([positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]]);
    assert.equal(crowns.length, 11, "one crown point is authored per station slot");
    for (const [slot, lateral, height] of crowns) { assert.equal(slot, Math.floor(slot)); assert.equal(lateral, 0); assert.ok(Math.abs(height - (apex + 1.35)) < 1e-6, "the crown is exactly 1.35 m above the apex"); }
    assert.match(family.accentMat.vertexShader, /tv=terrainVis\(u,P\.x,0\.0\); P\.y\+=cyAt\(u\)/, "the crown uses the wall family's terrain lift");
    assert.equal(accentVisibility(family, 1.03, 0), true, "packed mercy keeps its crown when wallStar is false");
    for (const packed of [0.01, 0.03, 2.01, 2.03]) assert.equal(accentVisibility(family, packed, 0), false, "ordinary and suppressed slots have no crown when wallStar is false");
  };
  assertCrown(html);
  const mutation = html.replace("put(0,ML_WALL_APEX+1.35,0,1)", "put(0,ML_WALL_APEX-48.65,0,1)");
  assert.notEqual(mutation, html, "the minus-50-metre crown mutation is constructible");
  assert.throws(() => assertCrown(mutation), assert.AssertionError, "the numeric crown contract kills the displaced apex");
});

test("Every changed or new inverse GLSL source is lane-literal-free in any numeric spelling", () => {
  assertNoLaneLiterals(html);
  const mutation = html.replace("vec3 c=mix(vec3(1.0,0.70,0.30)", "vec3 laneLeak=vec3(0.262745,0.850980,1.0); vec3 c=mix(vec3(1.0,0.70,0.30)");
  assert.notEqual(mutation, html, "the normalized vec3 lane-colour mutation is constructible");
  assert.throws(() => assertNoLaneLiterals(mutation), assert.AssertionError, "the representation-independent all-source scan kills a normalized lane colour");
});

test("Every target core remains opaque and depth-writing in front of the pane", () => {
  const assertTargetDepth = (source) => {
    const names = ["TARGET_CORE_MAT", "GOLD_CORE_MAT", "DECOY_CORE_MAT", "SPEED_CORE_MAT", "MOVER_CORE_MAT", "TANK_CORE_MAT"];
    for (const name of names) {
      const match = source.match(new RegExp(`const ${name}=new THREE\\.MeshBasicMaterial\\(\\{([^}]*)\\}\\);`)); assert.ok(match, `${name} is extractable`);
      const transparent = match[1].match(/\btransparent:(true|false)/), depthWrite = match[1].match(/\bdepthWrite:(true|false)/);
      assert.equal(transparent ? transparent[1] === "true" : false, false, `${name} is opaque by explicit value or Three default`);
      assert.equal(depthWrite ? depthWrite[1] === "true" : true, true, `${name} writes depth by explicit value or Three default`);
    }
  };
  assertTargetDepth(html);
  const mutation = html.replace("const TARGET_CORE_MAT=new THREE.MeshBasicMaterial({color:TOXIC});", "const TARGET_CORE_MAT=new THREE.MeshBasicMaterial({color:TOXIC,transparent:true,depthWrite:false});");
  assert.notEqual(mutation, html, "the transparent target-core mutation is constructible");
  assert.throws(() => assertTargetDepth(mutation), assert.AssertionError, "the target depth contract kills a non-depth-writing core");
});

test("Late road depth guard enforces structure, ordering, footprint sync, and the two-submission contract", () => {
  const assertPrepass = (source) => {
    for (const low of [false, true]) {
      const liveRoad = emittedRoadFamily(source, { low }), legacyRoad = emittedRoadFamily(source, { low, mercyInverse: false });
      const liveWall = emittedWallFamily(source, inverseOptions(), { low }), legacyWall = emittedWallFamily(source, inverseOptions({ mercyInverse: false }), { low });
      assert.ok(liveRoad.inverseDepth && liveRoad.inverseDepthMaterial, "the live inverse builds the road guard");
      assert.equal(legacyRoad.inverseDepth, null); assert.equal(legacyRoad.inverseDepthMaterial, null, "inverse-off compiles out the road guard material");
      assert.equal(liveRoad.inverseDepth.parent, liveRoad.roadMesh, "the road owns the guard child");
      assert.equal(liveRoad.inverseDepth.geometry, liveRoad.roadMesh.geometry, "the guard uses the exact road geometry");
      assert.equal(liveRoad.inverseDepthMaterial.vertexShader, liveRoad.roadMaterial.vertexShader, "the guard uses the exact road vertex shader");
      assert.equal(liveRoad.inverseDepthMaterial.uniforms, liveRoad.roadMaterial.uniforms, "the guard receives roadMat.uniforms itself");
      assert.deepEqual({ transparent: liveRoad.inverseDepthMaterial.transparent, colorWrite: liveRoad.inverseDepthMaterial.colorWrite, depthWrite: liveRoad.inverseDepthMaterial.depthWrite, depthTest: liveRoad.inverseDepthMaterial.depthTest, order: liveRoad.inverseDepth.renderOrder }, { transparent: true, colorWrite: false, depthWrite: true, depthTest: true, order: 5.5 });
      assert.equal(liveRoad.inverseDepth.visible, false, "the guard starts draw-silent");
      assert.equal(liveRoad.roadMesh.renderOrder, -40); assert.equal(liveWall.inverse.renderOrder, 6); assert.equal(liveWall.accent.renderOrder, 6.5);
      assert.deepEqual(roadFootprintClauses(liveRoad.inverseDepthMaterial.fragmentShader), roadFootprintClauses(liveRoad.roadMaterial.fragmentShader), "the stripped guard copies the road fade, terrain visibility, and outer footprint spellings");
      assert.doesNotMatch(liveRoad.inverseDepthMaterial.fragmentShader, /texture2D|markChev|fwidth|dFdy/, "the guard reruns no texture, mark, or derivative work");
      const paneDelta = (liveWall.sceneAdds.length + liveWall.wall.children.length) - (legacyWall.sceneAdds.length + legacyWall.wall.children.length);
      const guardDelta = liveRoad.roadMesh.children.length - legacyRoad.roadMesh.children.length;
      assert.equal(paneDelta + guardDelta, 2, "both tiers add exactly the pane and its road guard");
    }
    assert.match(inverseSpec, /\+2 submissions at most/); assert.match(inverseSpec, /dust particles below the deck may now fail their depth test/);
  };
  assertPrepass(html);
  const orderMutation = html.replace("roadMercyInverseDepth.renderOrder=5.5;", "roadMercyInverseDepth.renderOrder=5.0;");
  assert.notEqual(orderMutation, html, "the wrong-order guard mutation is constructible");
  assert.throws(() => assertPrepass(orderMutation), assert.AssertionError, "the structural contract kills the wrong transparent order");
  const footprintNeedle = "'  float outer=1.0-smoothstep('+HW+'+rw*0.5,'+HW+'+rw*1.6,al); if(outer<=0.004) discard;',";
  const footprintAt = html.lastIndexOf(footprintNeedle); assert.ok(footprintAt >= 0, "the copied guard footprint is independently mutable");
  const footprintMutation = html.slice(0, footprintAt) + footprintNeedle.replace("rw*1.6", "rw*1.7") + html.slice(footprintAt + footprintNeedle.length);
  assert.throws(() => assertPrepass(footprintMutation), assert.AssertionError, "the spelling-sync contract kills footprint drift from the road fragment");
});
