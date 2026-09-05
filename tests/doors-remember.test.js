"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const beatFixture = JSON.parse(fs.readFileSync(path.join(__dirname, "doors-remember-beat.fixture.json"), "utf8"));

function extractFunction(source, name) {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} is present`);
  const open = source.indexOf("{", match.index + match[0].length);
  let depth = 0, quote = "", line = false, block = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (line) { if (c === "\n") line = false; continue; }
    if (block) { if (c === "*" && next === "/") { block = false; i++; } continue; }
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; continue; }
    if (c === "/" && next === "/") { line = true; i++; continue; }
    if (c === "/" && next === "*") { block = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) return source.slice(match.index, i + 1);
  }
  throw Error(`unclosed ${name}`);
}

function night(overrides = {}) {
  return { v: 1, date: "2026-09-04", moonBucket: 4, bpm0: 60, dur: 64, bpmCurve: [], targets: [], taps: [], fires: [], ...overrides };
}

function historicalBeatAt(record, t) {
  const context = vm.createContext({
    Math, _ghostSeatRecord: record, _ghActiveTargets: [], _ghHitRows: [], _ghBeatPrefix: [],
    _ghBurstPool: null, _ghostTargets: null, _ghostBursts: null, GH_GIFT: false,
    ghostSeatApplyVisibility() {}, ghostSeatBeaconVisibility() {},
  });
  vm.runInContext(`${Object.values(beatFixture.functions).join("\n")}\nghostSeatPrepare(_ghostSeatRecord); this.beatAt=ghostSeatBeatAt;`, context);
  return context.beatAt(t);
}

function marks({ enabled = true, extra = {}, functions = [] } = {}) {
  const forbidden = new Proxy({}, { get() { throw Error("chalk cannot read gameplay, audio or scene state"); }, set() { throw Error("chalk cannot write gameplay state"); } });
  const constants = ["GH_MARK_WINDOW", "GH_MARK_SPAN"].map(name => {
    const value = main.match(new RegExp(`\\b${name}=([0-9.]+)`));
    assert.ok(value, `${name} is a named numeric constant`);
    return `const ${name}=${value[1]};`;
  }).join("\n");
  const math = Object.create(Math); math.random = () => { throw Error("chalk cannot advance gameplay RNG"); };
  const context = vm.createContext({ Math: math, Number, Date, GH_CHALK: enabled, state: forbidden, Tone: forbidden, THREE: forbidden, rnd: math.random, ...extra });
  const names = [...new Set(["ghostBeatAt", "markFor", ...functions])];
  const dateGrammar = main.match(/const PHASES_DATE_RE=[^;\n]+;/);
  assert.ok(dateGrammar, "the existing civil-date grammar is extractable");
  vm.runInContext(`${constants}\n${dateGrammar[0]}\n${names.map(name => extractFunction(main, name)).join("\n")}`, context);
  return context;
}

function assertMark(value, x, kind = 1) {
  assert.ok(value, "the remembered arrival produces a mark");
  assert.deepEqual(Object.keys(value).sort(), ["alpha", "hue", "kind", "x"]);
  assert.ok(Math.abs(value.x - x) < 1e-12, `offset ${value.x} should be ${x}`);
  assert.equal(value.kind, kind); assert.equal(value.hue, -1); assert.equal(value.alpha, 1);
}

test("C2 missing doors and disabled chalk produce no mark and read no artifact", () => {
  const c = marks(), record = night({ targets: [[0, 0, 17, 5, 1, 1]] });
  for (const index of [-1, 0.5, NaN, Infinity, "0", 1, 999]) assert.equal(c.markFor(record, index), null, `invalid or absent door ${index}`);
  assert.equal(c.markFor(null, 0), null); assert.equal(c.markFor(night(), 0), null);
  const unreadable = new Proxy({}, { get() { throw Error("disabled chalk cannot inspect artifacts"); } });
  assert.equal(marks({ enabled: false }).markFor(unreadable, 0), null);
  assert.match(main, /\n  ghostChalk:1,/);
  assert.match(main, /const GH_CHALK=!!CFG\.ghostChalk;/);
});

test("C2 door index uses target row order and expiry remains a centred sill dash", () => {
  const record = night({ targets: [[0, 3, 991, 20, 1, 0.875], [1, 0, 4, 30, 0, null], [2, 2, 70, 40, 1, 1.125]] });
  const before = JSON.stringify(record), c = marks();
  assertMark(c.markFor(record, 0), -0.275);
  assertMark(c.markFor(record, 1), 0, 0);
  assertMark(c.markFor(record, 2), 0.275);
  assert.equal(c.markFor(record, 3), null);
  assert.equal(JSON.stringify(record), before, "marks cannot rewrite last night's rows");
});

test("C2 signed nearest-beat phase keeps early left, late right and clamps at a quarter beat", () => {
  const c = marks();
  for (const [hit, expected] of [[2, 0], [1.875, -0.275], [2.125, 0.275], [1.75, -0.55], [2.25, 0.55], [1.6, -0.55], [2.4, 0.55]]) {
    const record = night({ targets: [[0, 0, 0, 50, 1, hit]] });
    assertMark(c.markFor(record, 0), expected);
  }
});

test("C2 tempo reconstruction matches the pre-C1 beat oracle across retained BPM segments", () => {
  const c = marks(), record = night({ bpm0: 60, bpmCurve: [[2, 30], [6, 60], [10, 20]] });
  const cases = [[1.875, 1.875], [2, 2], [2.25, 2.125], [5.5, 3.75], [6, 4], [6.125, 4.125], [10, 8], [10.375, 8.125], [11.8, 8.6]];
  for (const [t, expected] of cases) {
    assert.ok(Math.abs(historicalBeatAt(record, t) - expected) < 1e-12, "the historical fixture agrees with the hand-integrated beat");
    assert.ok(Math.abs(c.ghostBeatAt(record, t) - expected) < 1e-12);
  }
  record.targets = cases.slice().reverse().map(([hit], index) => [0, index % 4, index, 50, 1, hit]);
  for (let index = 0; index < record.targets.length; index++) {
    const beat = historicalBeatAt(record, record.targets[index][5]);
    const x = Math.max(-1, Math.min(1, (beat - Math.round(beat)) / 0.25)) * 0.55;
    assertMark(c.markFor(record, index), x);
  }
  const slow = night({ bpm0: 28, targets: [[0, 0, 0, 50, 1, 3.125 * 60 / 28]] });
  assertMark(c.markFor(slow, 0), 0.275);
});

function wallFamily({ low = false, reduced = false, chalk = true } = {}) {
  const filename = path.join(__dirname, "moonline-inverse.test.js"), source = fs.readFileSync(filename, "utf8");
  const context = vm.createContext({ __dirname, require: id => id === "node:test" ? (() => {}) : require(id) });
  vm.runInContext(`${source}\nthis.emit=emittedWallFamily; this.options=inverseOptions;`, context, { filename });
  return context.emit(main, context.options(), { low, reduced, chalk });
}

function installer({ enabled = true, reduced = false, low = true, record = night(), origin = 20.25, arch0 = 16 } = {}) {
  const uniform = value => ({ value });
  const uniforms = { uArchN0: uniform(arch0) };
  for (let source = 0; source < 4; source++) uniforms[`uMark${source}`] = uniform(Array.from({ length: 11 }, () => ({
    x: 99, y: 99, z: 99, w: 99,
    set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; },
  })));
  const context = marks({ enabled, functions: ["realCivilDate", "ghostLastNight", "ghostDoorIndex", "ghostChalkReset", "ghostChalkInstall"], extra: {
    ML_ARCH_EVERY: 4, ML_ARCH_BEHIND: 8, ML_WALL_DJ: 7.3, ML_WALL_N: low ? 7 : 11, reduceMotion: reduced,
    _ghostOwn: record, _ghostDoorOrigin: NaN, _ghostChalkBeat0: 0, roadWallMat: { uniforms }, phasesToday: () => "2026-09-05",
  } });
  context.ghostChalkReset(origin);
  return { context, uniforms, values: source => uniforms[`uMark${source}`].value.map(v => [v.x, v.y, v.z, v.w]) };
}

test("C2 only yesterday's civil-date artifact may draw, including month, year and DST boundaries", () => {
  const c = marks({ functions: ["realCivilDate", "ghostLastNight"], extra: { phasesToday: () => "2026-09-05" } });
  for (const [date, today] of [["2026-09-04", "2026-09-05"], ["2025-12-31", "2026-01-01"], ["2024-02-29", "2024-03-01"], ["2026-03-08", "2026-03-09"], ["2026-11-01", "2026-11-02"]]) assert.equal(c.ghostLastNight(night({ date }), today), true);
  for (const date of ["2026-09-05", "2026-09-03", "2026-09-06", "2026-02-31", "bad"]) assert.equal(c.ghostLastNight(night({ date }), "2026-09-05"), false);
  assert.equal(c.ghostLastNight(night()), true); assert.equal(c.ghostLastNight(null), false);
});

test("C2 slot installation numbers the first next-boundary door zero and clears every unused source and slot", () => {
  const record = night({ targets: [[0, 1, 999, 50, 1, 1.125], [0, 0, 4, 50, 0, null]] });
  const { context: c, uniforms, values } = installer({ record });
  assert.deepEqual([20, 23.99, 24, 28, 32].map(c.ghostDoorIndex), [-1, -1, 0, 1, 2]);
  const references = uniforms.uMark0.value.slice();
  c.ghostChalkInstall();
  assert.ok(Math.abs(values(0)[2][0] - 0.275 * 7.3) < 1e-12); assert.deepEqual(values(0)[2].slice(1), [1, -1, 1]);
  assert.deepEqual(values(0)[3], [0, 0, -1, 1]);
  for (const index of [0, 1, 4, 5, 6, 7, 8, 9, 10]) assert.deepEqual(values(0)[index], [0, 0, -1, 0]);
  for (const source of [1, 2, 3]) assert.ok(values(source).every(v => JSON.stringify(v) === "[0,0,-1,0]"));
  c._ghostOwn = night({ date: "2026-09-03", targets: record.targets }); c.ghostChalkInstall();
  assert.ok(values(0).every(v => v[3] === 0), "an old artifact clears prior ink");
  assert.ok(uniforms.uMark0.value.every((v, i) => v === references[i]), "updates reuse the allocated vector payloads");
});

test("C2 reduced-motion marks advance logical doors while geometry stays pinned and chalk off writes nothing", () => {
  const record = night({ targets: [[0, 0, 0, 50, 1, 1.125]] });
  const { context: c, uniforms, values } = installer({ record, reduced: true, arch0: -8 });
  c.ghostChalkInstall(); assert.equal(values(0)[3][3], 1);
  c.ghostChalkInstall(24); assert.equal(values(0)[2][3], 1); assert.equal(values(0)[3][3], 0);
  assert.equal(uniforms.uArchN0.value, -8);
  const off = installer({ enabled: false, record });
  off.context.roadWallMat = new Proxy({}, { get() { throw Error("disabled chalk cannot touch uniforms"); } });
  off.context.ghostChalkInstall(24); assert.equal(Number.isNaN(off.context._ghostDoorOrigin), true);
  assert.ok(off.values(0).every(v => v[0] === 99 && v[3] === 99));
});

test("C2 chalk compiles into both wall arms and mercy while off emits no payload, callback or shader branch", () => {
  for (const low of [false, true]) {
    const on = wallFamily({ low }), off = wallFamily({ low, chalk: false });
    assert.equal(on.sceneAdds.length, off.sceneAdds.length); assert.equal(on.wall.children.length, off.wall.children.length);
    assert.deepEqual(Array.from(on.wall.geometry.attributes.position.array), Array.from(off.wall.geometry.attributes.position.array));
    assert.equal(on.wallMat.uniforms, on.inverseMat.uniforms, "wall and mercy borrow the same marks");
    for (let source = 0; source < 4; source++) {
      assert.equal(on.wallMat.uniforms[`uMark${source}`].value.length, 11);
      assert.equal(Object.hasOwn(off.wallMat.uniforms, `uMark${source}`), false);
    }
    for (const shader of [on.wallMat.fragmentShader, on.inverseMat.fragmentShader]) {
      assert.match(shader, /vec4 chalkStroke\(vec4 mark,vec2 p,float px\)/);
      assert.ok(shader.indexOf("vec4 chalk=chalkOnDoor") < shader.indexOf("if(d<0.0) discard;"), "marks inside the opening survive its aperture discard");
      assert.doesNotMatch(shader, /\b(?:dFdx|dFdy|fwidth)\s*\(/);
    }
    for (const material of [off.wallMat, off.inverseMat]) assert.doesNotMatch(`${material.vertexShader}\n${material.fragmentShader}`, /uMark|vMark|chalkStroke|chalkOnDoor/);
    assert.equal(Object.hasOwn(off.wall, "onBeforeRender"), false); assert.equal(Object.hasOwn(off.inverse, "onBeforeRender"), false);
  }
});

test("C2 three-pixel chalk optics follow backing height, FOV and reflection targets", () => {
  const family = wallFamily({ low: true }), uniforms = family.wallMat.uniforms, camera = { projectionMatrix: { elements: [0, 0, 0, 0, 0, 2] } };
  let target = null;
  const renderer = { getRenderTarget: () => target, domElement: { height: 600 } };
  assert.equal(family.wall.onBeforeRender, family.inverse.onBeforeRender);
  family.wall.onBeforeRender(renderer, null, camera); assert.equal(uniforms.uMarkFocalPx.value, 600);
  renderer.domElement.height = 1200; family.wall.onBeforeRender(renderer, null, camera); assert.equal(uniforms.uMarkFocalPx.value, 1200);
  camera.projectionMatrix.elements[5] = 1; family.wall.onBeforeRender(renderer, null, camera); assert.equal(uniforms.uMarkFocalPx.value, 600);
  target = { height: 200 }; family.inverse.onBeforeRender(renderer, null, camera); assert.equal(uniforms.uMarkFocalPx.value, 100);
  const shader = family.wallMat.fragmentShader;
  assert.match(shader, /float px=1\.0\/max\(0\.00001,uMarkFocalPx\*gl_FragCoord\.w\)/);
  assert.match(shader, /mask=step\(dx,1\.5\*px\)/); assert.match(shader, /abs\(p\.y-5\.44000\),1\.19000/);
  assert.match(shader, /mark\.y<0\.5[\s\S]*abs\(p\.y-0\.18\),1\.5\*px/);
  assert.match(shader, /if\(mark\.w<=0\.0\) return vec4\(0\.0\)/);
  assert.match(shader, /if\(h<0\.0\) return vec3\(1\.0,0\.98,0\.94\)/);
});

test("C2 mercy keeps inverse background pixels and paints normal chalk without another draw", () => {
  const family = wallFamily(), material = family.inverseMat;
  assert.equal(material.blendEquation, "SubtractEquation"); assert.equal(material.blendSrc, "OneFactor"); assert.equal(material.blendDst, "SrcAlphaFactor");
  assert.match(material.fragmentShader, /vec4\(chalk\.rgb\*vWallFade,0\.0\)/);
  assert.match(material.fragmentShader, /gl_FragColor=vec4\(1\.0\)/);
  const destination = [0.2, 0.4, 0.6], chalk = [1, 0.98, 0.94];
  assert.deepEqual(destination.map(value => 1 - value * 1), [0.8, 0.6, 0.4]);
  assert.deepEqual(destination.map((value, i) => chalk[i] - value * 0), chalk);
});
