"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "doors-remember-c4-isolation.fixture.json"), "utf8"));

function loadHelpers(file, expression) {
  const filename = path.join(__dirname, file), context = vm.createContext({ __dirname, module: { exports: {} }, TextDecoder, AbortController, setTimeout, clearTimeout, require: id => id === "node:test" ? (() => {}) : require(id) });
  vm.runInContext(`${fs.readFileSync(filename, "utf8")}\nthis.helpers=${expression};`, context, { filename });
  return context.helpers;
}

const { extractFunction, installer } = loadHelpers("doors-remember.test.js", "{extractFunction,installer}");
const { core, artifact } = loadHelpers("the-visitor.test.js", "{core,artifact}");

function tapContext(options = {}) {
  const seen = [], installs = [], kinds = options.kinds || [0, 0, 1, 0, 1, 0, 0];
  let roadTime = 7.25;
  const forbidden = () => { throw Error("chalk cannot enter grading, audio, crossing or gameplay RNG"); };
  const math = Object.create(Math); math.random = forbidden;
  const state = new Proxy({ running: options.running !== false }, { get(target, key) { if (key !== "running") return forbidden(); return target[key]; }, set: forbidden });
  const context = vm.createContext({
    Math: math, Number, Map, GH_CHALK: options.enabled !== false, reduceMotion: !!options.reduced,
    ML_MERCY_INVERSE: options.inverse !== false, ML_WALL_N: kinds.length, ML_WALL_DJ: 7.3, ML_ARCH_EVERY: 4,
    ROAD_MPB: 27, ROAD_FADE1: options.fade === undefined ? 864 : options.fade, GH_CAP_MAIL: 64,
    CFG: { grooveGroove: !!options.groove, grooveFreezePhase: 0.5 },
    state, trainMode: !!options.train, templeActive: !!options.temple, bonusActive: !!options.bonus,
    _bow: { stage: options.stage || 0 }, BOW: { LAST: 3 }, _wallCross: { value: 11 }, _roadBar0: 17,
    _ghostMarksOut: [], _ghostMercyMarks: new Map(), _ghostVisitors: [],
    roadWallMat: { uniforms: { uArchN0: { value: options.arch0 === undefined ? 16 : options.arch0 }, uK: { value: kinds } } },
    ghostChalkVisible(b, x, kind) { seen.push([b, x, kind]); return options.visible ? options.visible(b, x, kind) : true; },
    ghostRoadTime: () => roadTime, ghostChalkInstall() { installs.push(true); }, ghostMailAdvance() {},
    doorCross: forbidden, pushEvent: forbidden, rnd: forbidden, spawnTarget: forbidden, Tone: new Proxy({}, { get: forbidden }),
  });
  const lanes = main.match(/\bGH_MARK_LANES=(\[[^\]]+\])/); assert.ok(lanes);
  vm.runInContext(`const GH_MARK_LANES=${lanes[1]};\n${extractFunction(main, "ghostChalkTap")}\n${extractFunction(main, "ghostChalkObserve")}`, context);
  return { context, seen, installs, setRoadTime(value) { roadTime = value; } };
}

test("C4 WASD adds one fail-soft heard-time sink while the C3 handler and door-cross bytes remain intact", () => {
  const expectedHashes = { wasdLanePress: "76c95dd400b0b133924b64433fae987d754734c8862d9c3f4677429be430b6ce", doorCross: "c090f6e7cac2eb3e77b405848602ee9e3e1b829c36b7bc5536e9d2dd443b2064", doorCrossBlock: "a4cad97e590ea72bc982a9f462618d04ea54460ad028c069e458f7ecb154ab72" };
  for (const [name, hash] of Object.entries(expectedHashes)) assert.equal(crypto.createHash("sha256").update(name === "doorCrossBlock" ? fixture.doorCrossBlock : fixture.functions[name]).digest("hex"), hash);
  const press = extractFunction(main, "wasdLanePress");
  const hook = press.split("\n").filter(line => line.includes("ghostChalkTap("));
  assert.equal(hook.length, 1); assert.match(hook[0], /^  if\(GH_CHALK\) try\{ ghostChalkTap\(k,beats,nd,bps,w\); \}catch\(e\)\{\}/);
  // Extend the authenticated expectation only with the authorized pip-flash reset.
  // Every original grading, audio, timing and chalk-isolation byte remains compared.
  const oldReset = "_wasdCombo=0; _noteFlashT=state.t;";
  assert.equal(fixture.functions.wasdLanePress.split(oldReset).length, 2, "one frozen wrong-key reset exists");
  const expectedPress = fixture.functions.wasdLanePress.replace(oldReset,
    "_wasdCombo=0; _pipSetN=0; _pipSetFlashT=-999; _noteFlashT=state.t;");
  assert.equal(press.replace(`${hook[0]}\n`, ""), expectedPress);
  assert.ok(press.indexOf(hook[0]) > press.indexOf("beats-=lat/bps;")); assert.ok(press.indexOf(hook[0]) < press.indexOf("const claim=claimWasdNote"));
  const doorOff = extractFunction(main, "doorCross").replace("(!PIANO && !doorWhoosh)", "!doorWhoosh").replace("    if(!PIANO){\n", "").replace("    }\n    const tonic", "    const tonic");
  assert.equal(doorOff, fixture.functions.doorCross);
  assert.equal(extractFunction(main, "roadSync").match(/  if\(ML_DOOR_CROSS\)\{\n[^]*?\n  \}/)[0], fixture.doorCrossBlock);
  for (const enabled of [false, true]) {
    const trace = [], c = vm.createContext({
      Math, GH_CHALK: enabled, state: { running: true, bpm: 60 }, templeActive: false, bonusActive: false,
      _bow: { stage: 0 }, BOW: { LAST: 3 }, CFG: { wasdRhythm: true, wasdWindow: 0.1, wasdWindowFrac: 0.4 }, _combo: [0, 1, 2, 3],
      bowTouch() { trace.push("bow"); }, wasdNoteDiv: () => 2, wasdBeats: () => 20.75, audioLat: () => 0.25, pocketLive: () => false,
      ghostChalkTap(...args) { trace.push(args); throw Error("a failed mark must not consume the press"); },
      claimWasdNote(...args) { trace.push(args); return null; },
    });
    vm.runInContext(`${press}\nwasdLanePress(3);`, c);
    assert.deepEqual(trace, enabled ? ["bow", [3, 20.5, 2, 1, 0.2], [20.5, 2, 1, 0.2]] : ["bow", [20.5, 2, 1, 0.2]]);
  }
});

test("C4 only heard-grid taps in live main play can leave marks", () => {
  for (const options of [{ enabled: false }, { reduced: true }, { inverse: false }, { running: false }, { train: true }, { temple: true }, { bonus: true }, { stage: 3 }]) {
    const run = tapContext(options); assert.equal(run.context.ghostChalkTap(0, 20, 1, 1, 0.125), false); assert.equal(run.seen.length, 0);
  }
  for (const [beats, nd, bps, window, accepted] of [[19.875, 1, 1, 0.125, true], [20.125, 1, 1, 0.125, true], [20.126, 1, 1, 0.125, false], [20.5, 2, 1, 0.125, true], [20.25, 4, 1, 0.1, true], [20.07, 1, 2, 0.125, false]]) {
    const run = tapContext(); assert.equal(run.context.ghostChalkTap(2, beats, nd, bps, window), accepted);
    assert.equal(run.context._ghostMarksOut.length, +accepted);
    assert.equal(run.context._wallCross.value, 11); assert.equal(run.context._roadBar0, 17);
  }
  for (const lane of [-1, 4, 0.5]) assert.equal(tapContext().context.ghostChalkTap(lane, 20, 1, 1, 0.125), false);
});

test("C4 nearest visible mercy consumes one mark until it passes and uses the road clock", () => {
  const run = tapContext(), c = run.context;
  assert.equal(c.ghostChalkTap(0, 20, 1, 1, 0.125), true);
  assert.deepEqual(Array.from(c._ghostMarksOut, row => Array.from(row)), [[7.25, 0]]);
  assert.deepEqual(run.seen, [[24, -0.6 * 7.3, 1]]);
  assert.equal(c._ghostMercyMarks.get(24), c._ghostMarksOut[0]);
  assert.equal(c.ghostChalkTap(3, 21, 1, 1, 0.125), false); assert.equal(c._ghostMarksOut.length, 1);
  assert.equal(c._ghostMercyMarks.has(32), false, "a spent near pane cannot leak a mark onto the farther one");
  run.setRoadTime(11.25); assert.equal(c.ghostChalkTap(3, 24, 1, 1, 0.125), true);
  assert.deepEqual(Array.from(c._ghostMarksOut, row => Array.from(row)), [[7.25, 0], [11.25, 3]]); assert.equal(run.installs.length, 2);
});

test("C4 taps reject absent, offscreen, behind and beyond-fade panes using physical resident identity", () => {
  for (const options of [{ kinds: [0, 0, 0] }, { kinds: [1.5] }, { kinds: [1], arch0: 20 }, { kinds: [1], arch0: 16 }, { kinds: [1], arch0: 52 }, { visible: () => false }]) {
    const run = tapContext(options); assert.equal(run.context.ghostChalkTap(1, 20, 1, 1, 0.125), false); assert.equal(run.context._ghostMarksOut.length, 0);
  }
  const skipped = tapContext({ visible: b => b === 32 });
  assert.equal(skipped.context.ghostChalkTap(1, 20, 1, 1, 0.125), true); assert.equal(skipped.context._ghostMercyMarks.has(32), true);
  const phased = tapContext({ groove: true, kinds: [1], arch0: 24 });
  assert.equal(phased.context.ghostChalkTap(0, 23.5, 2, 1, 0.125), false, "the groove phase restores road r=24, where the physical pane has passed");
});

test("C4 capture caps at 64 and the captured lane overrides only the own source on its pane", () => {
  const run = tapContext({ kinds: [1], arch0: 4 }), c = run.context;
  for (let i = 0; i < 64; i++) { c.roadWallMat.uniforms.uArchN0.value = (i + 1) * 4; run.setRoadTime(i + 0.25); assert.equal(c.ghostChalkTap(i % 4, i * 4, 1, 1, 0.125), true); }
  c.roadWallMat.uniforms.uArchN0.value = 260;
  assert.equal(c.ghostChalkTap(0, 256, 1, 1, 0.125), false); assert.equal(c._ghostMarksOut.length, 64); assert.equal(run.installs.length, 64);
  for (let lane = 0; lane < 4; lane++) {
    const view = installer(); view.context.GH_MARK_LANES = [-0.6, -0.2, 0.2, 0.6];
    view.context._ghostMercyMarks.set(24, [7.25, lane]); view.context.ghostChalkInstall();
    assert.deepEqual(Array.from(view.values(0)[2]), [[-0.6, -0.2, 0.2, 0.6][lane] * 7.3, 1, -1, 1]);
    for (const source of [1, 2, 3]) assert.ok(view.values(source).every(v => v[3] === 0));
  }
});

test("C4 a stranger becomes shown only after a nonempty projected mark is visible", () => {
  let thirdVisible = false;
  const run = tapContext({ kinds: [0, 0, 1], visible: b => b === 16 || thirdVisible }), c = run.context, U = c.roadWallMat.uniforms;
  c._ghostVisitors = [{ shown: false }, { shown: false }, { shown: false }, { shown: false }];
  U.uMark1 = { value: [{ x: 1, y: 1, w: 0.72 }, { w: 0 }, { w: 0 }] };
  U.uMark2 = { value: [{ w: 0 }, { w: 0 }, { w: 0 }] };
  U.uMark3 = { value: [{ w: 0 }, { w: 0 }, { x: 3, y: 3, w: 0.72 }] };
  c.ghostChalkObserve(20); assert.deepEqual(Array.from(c._ghostVisitors, v => v.shown), [true, false, false, false]);
  assert.deepEqual(run.seen, [[16, 1, 1], [24, 3, 3]]);
  thirdVisible = true; c.ghostChalkObserve(20); assert.deepEqual(Array.from(c._ghostVisitors, v => v.shown), [true, false, true, false]);
  assert.equal(run.seen.filter(([b]) => b === 16).length, 1, "already-shown memory remains a one-way session fact");
});

test("C4 mail sends one capped copy to each shown stranger, never self, unseen, duplicate or a fourth recipient", async () => {
  const requests = [], rows = Array.from({ length: 70 }, (_, i) => [i, i % 4]);
  const c = core(main, { functions: ["ghostShareFinalize"], extra: { GH_CHALK: true, _ghostMarksOut: rows, fetch(url, init) { requests.push({ url, init }); return Promise.resolve({ ok: true }); } } });
  c._ghostToken = "a".repeat(32);
  c._ghostVisitors = [{ id: "b".repeat(32), shown: true }, { id: "b".repeat(32), shown: true }, { id: "c".repeat(32), shown: "true" }, { id: "d".repeat(32), shown: true }, { id: "e".repeat(32), shown: true }, { id: "f".repeat(32), shown: true }];
  c.ghostShareFinalize(); c.ghostShareFinalize(); await new Promise(setImmediate);
  assert.deepEqual(requests.map(r => JSON.parse(r.init.body).toId), ["b", "d", "e"].map(id => id.repeat(32)));
  for (const request of requests) {
    assert.equal(request.url, "https://relay.example/api/ghost-mail"); assert.equal(request.init.method, "POST");
    assert.equal(request.init.headers["X-Ghost-Token"], "a".repeat(32)); assert.deepEqual(JSON.parse(request.init.body).catches, rows.slice(0, 64));
  }
  let selfSends = 0;
  const self = core(main, { functions: ["ghostShareFinalize"], extra: { GH_CHALK: true, _ghostMarksOut: [[1, 0]] } });
  self.ghostMailAttempt = () => { selfSends++; return Promise.resolve(true); };
  self._ghostToken = "a".repeat(32); self._ghostVisitors = [{ id: self._ghostToken, shown: true }]; self.ghostShareFinalize();
  assert.equal(selfSends, 0);
});

test("C4 no-mail cases start no network work and relay 429 or 404 never schedules a retry", async () => {
  for (const options of [{ share: false }, { chalk: false }, { rows: [] }, { visitors: [] }, { visitors: [{ id: "b".repeat(32), shown: false }] }]) {
    const touches = { storage: 0, fetch: 0, timer: 0 };
    const c = core(main, { share: options.share !== false, functions: ["ghostShareFinalize"], extra: {
      GH_CHALK: options.chalk !== false, _ghostMarksOut: options.rows || [[1, 0]], _ghostVisitors: options.visitors || [{ id: "b".repeat(32), shown: true }],
      localStorage: { getItem() { touches.storage++; return "a".repeat(32); } }, fetch() { touches.fetch++; return Promise.resolve({ ok: true }); }, setTimeout() { touches.timer++; return null; }, clearTimeout() {},
    } });
    c.ghostShareFinalize(); await new Promise(setImmediate); assert.deepEqual(touches, { storage: 0, fetch: 0, timer: 0 });
  }
  for (const status of [429, 404]) {
    const timers = [], requests = [], c = core(main, { functions: ["ghostShareFinalize"], extra: {
      GH_CHALK: true, _ghostMarksOut: [[1, 0]], _ghostVisitors: [{ id: "b".repeat(32), shown: true }],
      setTimeout(fn, ms) { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer; }, clearTimeout(timer) { timer.cleared = true; },
      fetch(url, init) { requests.push({ url, init }); return Promise.resolve({ ok: false, status }); },
    } });
    c._ghostToken = "a".repeat(32); c.ghostShareFinalize(); await new Promise(setImmediate); c.ghostShareFinalize();
    assert.equal(requests.length, 1); assert.deepEqual(timers.map(t => [t.ms, t.cleared]), [[4000, true]], "only the cleared request timeout exists; no retry timer appears");
  }
});

function visibilityContext(low) {
  let allocations = 0;
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { allocations++; this.set(x, y, z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { return this.set(v.x, v.y, v.z); }
    applyMatrix4(matrix) {
      const e = matrix.elements, x = this.x, y = this.y, z = this.z, w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
      return this.set((e[0] * x + e[4] * y + e[8] * z + e[12]) * w, (e[1] * x + e[5] * y + e[9] * z + e[13]) * w, (e[2] * x + e[6] * y + e[10] * z + e[14]) * w);
    }
  }
  const matrix = (x = 0, y = 0, z = 0) => ({ elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1] });
  const f = 1 / Math.tan(95 * Math.PI / 360), near = 0.1, far = 2000;
  const camera = { near, far, matrixWorld: matrix(0, 4, 0), matrixWorldInverse: matrix(0, -4, 0), projectionMatrix: { elements: [f / 1.6, 0, 0, 0, 0, f, 0, 0, 0, 0, -(far + near) / (far - near), -1, 0, 0, -2 * far * near / (far - near), 0] } };
  const U = { uNow: { value: 0 }, uArchN0: { value: -8 }, uA: { value: { x: 0, y: 0, z: 0 } }, uW: { value: { x: 0, y: 0, z: 0 } }, uP: { value: { x: 0, y: 0, z: 0 } }, uBase: { value: { x: 0, y: 0 } }, uK: { value: Array(11).fill(2.03) }, uMarkFocalPx: { value: 300 * f }, uWallDissolve: { value: 95 } };
  U.uK.value[4] = 0.03;
  const c = vm.createContext({
    THREE: { Vector3 }, GH_CHALK: true, ML_WALLS: true, state: { running: true }, trainMode: false, templeActive: false, roadWall: { visible: true }, roadMercyInverse: { visible: true }, roadWallMat: { uniforms: U }, camera,
    ML_BITE: false, ML_TERRAIN: false, ROAD_TERRAIN_HN: 0, ROAD_MPB: 27, ROAD_FADE0: 734.4, ROAD_FADE1: 864, ML_ARCH_EVERY: 4, ML_WALL_N: 11, ML_MERCY_INVERSE: true, ML_WALL_REAR0: -12, ML_WALL_REAR1: -8,
    ML_WALL_X: 216.5, ML_WALL_Y0: -270, ML_WALL_Y1: 221, ML_WALL_SPRING: 12, ML_WALL_DJ: 7.3, ML_WALL_DA: 7.3, ML_WALL_DB: 5, ML_WALL_BAY_X: 16.5, ML_WALL_BAY_Y0: -70, ML_WALL_BAY_Y1: 21,
    ML_WALL_EXHALE: 1, ML_WALL_EXHALE1: 0.7, ML_WALL_EXHALE2: 0.85, ML_WALL_POWDER_NOISE: 22, ML_WALL_APEX: 17, LOW: low,
  });
  vm.runInContext(`let _ghostChalkProbe=null;\n${["ghostChalkPoint", "ghostChalkTerrain", "ghostChalkOccluded", "ghostChalkInk", "ghostChalkVisible"].map(name => extractFunction(main, name)).join("\n")}`, c);
  return { context: c, U, allocations: () => allocations, eyeX(x) { camera.matrixWorld = matrix(x, 4, 0); camera.matrixWorldInverse = matrix(-x, -4, 0); }, lookBack() { camera.matrixWorldInverse = { elements: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, -4, 0, 1] }; } };
}

test("C4 actual visibility rejects camera, fade and opaque-bay misses while allocating its probe only once", () => {
  for (const low of [false, true]) {
    const run = visibilityContext(low), c = run.context, U = run.U;
    c.GH_CHALK = false; assert.equal(c.ghostChalkVisible(8, 0, 1), false); assert.equal(run.allocations(), 0); c.GH_CHALK = true;
    for (let form = 0; form < 4; form++) assert.equal(c.ghostChalkVisible(8, 0, form), true);
    for (let s = 0; s < 4; s++) U['uMark' + s] = { value: Array.from({ length: 11 }, () => ({ x: 0, y: 0, z: -1, w: 0 })) };
    for (let form = 0; form < 4; form++) {
      U.uMark2.value[4] = { x: 0, y: form, z: 0, w: 0.72 };
      assert.equal(c.ghostChalkVisible(8, 0, form, 1), false, "a later source replaces the same ink completely");
      assert.equal(c.ghostChalkVisible(8, 0, form), true, "the tap probe remains independent of existing source ink");
      assert.equal(c.ghostChalkVisible(8, 0, form, 3), true, "earlier source ink cannot replace the final source");
    }
    U.uMark2.value[4] = { x: 0.5, y: 1, z: 0, w: 0.72 }; assert.equal(c.ghostChalkVisible(8, 0, 1, 1), true, "partial cover leaves exposed ink");
    U.uMark2.value[4] = { x: 0, y: 1, z: 0, w: 0 }; assert.equal(c.ghostChalkVisible(8, 0, 1, 1), true, "zero-alpha sources paint no ink");
    assert.equal(c.ghostChalkVisible(8, 0, 1, -1), false); assert.equal(c.ghostChalkVisible(8, 0, 1, 4), false);
    assert.equal(run.allocations(), 4); assert.equal(c.ghostChalkVisible(8, 500, 1), false);
    U.uK.value[1] = 0.03; assert.equal(c.ghostChalkVisible(-4, 0, 1), false);
    U.uK.value[10] = 0.03; assert.equal(c.ghostChalkVisible(32, 0, 1), false);
    U.uK.value[4] = 1.03; c.roadMercyInverse.visible = false; assert.equal(c.ghostChalkVisible(8, 0, 1), false);
    c.roadMercyInverse.visible = true; assert.equal(c.ghostChalkVisible(8, 0, 1), true); U.uK.value[4] = 0.03;
    U.uK.value[3] = 0.03; run.eyeX(20); assert.equal(c.ghostChalkVisible(8, 0, 1), false, "the nearer solid bay occludes the mark");
    U.uK.value[3] = 2.03; assert.equal(c.ghostChalkVisible(8, 0, 1), true, "a suppressed nearer wall cannot occlude");
    run.eyeX(0); U.uK.value[3] = 0.03; assert.equal(c.ghostChalkVisible(8, 0, 1), true, "the nearer opening admits the same mark");
    run.lookBack(); assert.equal(c.ghostChalkVisible(8, 0, 1), false); run.eyeX(0);
    c.roadWall.visible = false; assert.equal(c.ghostChalkVisible(8, 0, 1), false); assert.equal(run.allocations(), 4);
  }
});
