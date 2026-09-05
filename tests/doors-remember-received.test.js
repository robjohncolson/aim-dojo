"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { main, html } = require("./source.js");
const { extractFunction } = require("./chip-graph.js");

function helpers() {
  const filename = path.join(__dirname, "the-visitor.test.js");
  const c = vm.createContext({ __dirname, module: { exports: {} }, TextEncoder, TextDecoder, AbortController, setTimeout, clearTimeout, require: id => id === "node:test" ? (() => {}) : require(id) });
  vm.runInContext(`${fs.readFileSync(filename, "utf8")}\nthis.helpers={core,data,response};`, c, { filename });
  return c.helpers;
}
const { data, response } = helpers();
const clockFunctions = ["ghostMailReset", "ghostMailBeatAt", "ghostMailRender", "ghostMailNearestDoor", "ghostMailWallKind", "ghostMailAdvance", "ghostMailArrive"];
const plain = value => JSON.parse(JSON.stringify(value));

function clockContext({ enabled = true, share = true, reduced = false, origin = 20.5, token = "a".repeat(32), mercy = [] } = {}) {
  const paints = [], touches = [];
  const forbidden = () => { touches.push("forbidden"); throw Error("received mail cannot touch gameplay, transport, storage, audio or RNG"); };
  const guard = new Proxy({}, { get: forbidden, set: forbidden });
  const math = Object.create(Math); math.random = forbidden;
  let roadTime = 0;
  const c = vm.createContext({ Math: math, Number, GH_CHALK: enabled, GH_SHARE: share, ML_WALLS: true, ML_ARCH_EVERY: 4, ML_ARCH_N: 11, ML_WALL_N: 11, ML_ARCH_BEHIND: 8, reduceMotion: reduced, _ghostDoorOrigin: Math.floor(origin / 4), _ghostMailState: null, _ghostToken: token,
    roadTideAt: b => ({ m: mercy.includes(b) ? 1 : 0 }), roadWallMat: { uniforms: { uArchN0: { value: -8 } } },
    ghostMailPaint(rows) { paints.push(plain(rows)); }, ghostRoadTime: () => roadTime,
    state: guard, Tone: guard, THREE: guard, localStorage: guard, rnd: forbidden, pushEvent: forbidden, fetch: forbidden, setTimeout: forbidden, doorCross: forbidden,
  });
  vm.runInContext(clockFunctions.map(name => extractFunction(main, name)).join("\n"), c);
  c.ghostMailReset(origin);
  return { context: c, paints, touches, setRoadTime(value) { roadTime = value; } };
}

test("C5 two senders map heard seconds to half-open door spans without mutating relay rows", () => {
  const rows = [[8, 3, 7], [0, 0, 1], [3.5, 1, 7], [3.499, 2, 1]], original = plain(rows);
  const run = clockContext(), c = run.context;
  c.ghostMailArrive(rows); c.ghostMailAdvance(28.5, 8);
  assert.deepEqual(plain(c._ghostMailState.assigned), [
    { b: 24, lane: 0, sig: 1 }, { b: 24, lane: 2, sig: 1 }, { b: 28, lane: 1, sig: 7 }, { b: 32, lane: 3, sig: 7 },
  ]);
  assert.deepEqual(rows, original); assert.equal(c._ghostMailState.pending.length, 0); assert.deepEqual(run.touches, []);
  assert.equal(c.ghostMailBeatAt([], 1), 0);
  assert.equal(c.ghostMailBeatAt([[2, 20], [4, 24]], -1), 20); assert.equal(c.ghostMailBeatAt([[2, 20], [4, 24]], 9), 24);
});

test("C5 late read and early read agree across sampled tempo changes and skipped frames", () => {
  const rows = [[1, 0, 1], [2, 1, 7], [9.999, 2, 1], [10, 3, 7], [14, 0, 7]];
  const samples = [[2, 24], [10, 28], [14, 32]];
  const early = clockContext({ origin: 22 }), late = clockContext({ origin: 22 });
  early.context.ghostMailArrive(rows);
  for (const [t, r] of samples) { early.context.ghostMailAdvance(r, t); late.context.ghostMailAdvance(r, t); }
  late.context.ghostMailArrive(rows);
  const expected = [{ b: 24, lane: 0, sig: 1 }, { b: 28, lane: 1, sig: 7 }, { b: 28, lane: 2, sig: 1 }, { b: 32, lane: 3, sig: 7 }, { b: 36, lane: 0, sig: 7 }];
  assert.deepEqual(plain(early.context._ghostMailState.assigned), expected); assert.deepEqual(plain(late.context._ghostMailState.assigned), expected);
  assert.equal(late.context._ghostMailState.clock.length, 1, "a consumed read no longer retains prefetch history");
});

test("C5 pending future rows wait for heard time, only the first response is consumed, and old samples cannot rewind", () => {
  const run = clockContext({ origin: 20 }), c = run.context, rows = [[5, 1, 3]];
  c.ghostMailArrive(rows); rows[0][1] = 3; c.ghostMailArrive([[1, 0, 0]]);
  c.ghostMailAdvance(24, 4); assert.equal(c._ghostMailState.assigned.length, 0);
  const before = plain(c._ghostMailState); c.ghostMailAdvance(21, 1); c.ghostMailAdvance(NaN, 6); assert.deepEqual(plain(c._ghostMailState), before);
  run.setRoadTime(5); c.ghostMailAdvance(25);
  assert.deepEqual(plain(c._ghostMailState.assigned), [{ b: 28, lane: 1, sig: 3 }]);
  const empty = clockContext().context; empty.ghostMailArrive([]); empty.ghostMailArrive([[0, 0, 0]]); assert.equal(empty._ghostMailState.assigned.length, 0);
});

test("C5 bounded prefetch history retains both endpoints and linear-time assignment through decimation", () => {
  const c = clockContext({ origin: 20 }).context;
  for (let i = 1; i <= 2000; i++) { c.ghostMailAdvance(20 + i / 100, i / 100); assert.ok(c._ghostMailState.clock.length <= 256); }
  assert.deepEqual(plain(c._ghostMailState.clock[0]), [0, 20]); assert.deepEqual(plain(c._ghostMailState.clock.at(-1)), [20, 40]);
  c.ghostMailArrive([[0, 0, 1], [3.9, 1, 7], [4, 2, 1], [19.9, 3, 7]]);
  assert.deepEqual(Array.from(c._ghostMailState.assigned, row => row.b), [24, 24, 28, 40]);
  assert.equal(c._ghostMailState.clock.length, 1);
});

test("C5 reduced motion remaps only physical stations while assignment and first-door clamping remain stable", () => {
  const run = clockContext({ reduced: true }), c = run.context;
  c.ghostMailArrive([[0, 1, 7]]);
  assert.deepEqual(run.paints.at(-1), [{ b: 4, lane: 1, sig: 7 }]);
  const count = run.paints.length; c.ghostMailAdvance(23.5, 3); assert.equal(run.paints.length, count);
  c.ghostMailAdvance(24.5, 4); assert.deepEqual(run.paints.at(-1), [{ b: 0, lane: 1, sig: 7 }]);
  assert.equal(c._ghostMailState.assigned[0].b, 24);
  c._ghostDoorOrigin = 5; c.ghostMailReset(0); c.ghostMailArrive([[0, 0, 1]]); assert.equal(c._ghostMailState.assigned[0].b, 24, "times preceding the recorded start clamp to the first door");
});

test("C5 resetting a session clears received geometry and pending data while disabled paths touch no systems", () => {
  const run = clockContext(), c = run.context; c.ghostMailArrive([[0, 0, 1], [100, 1, 7]]);
  const old = c._ghostMailState; c.ghostMailReset(40);
  assert.notEqual(c._ghostMailState, old); assert.deepEqual(plain(c._ghostMailState.assigned), []); assert.deepEqual(plain(c._ghostMailState.pending), []);
  assert.equal(c._ghostMailState.ready, false); assert.deepEqual(run.paints.at(-1), []); assert.deepEqual(plain(c._ghostMailState.clock), [[0, 40]]);
  for (const options of [{ enabled: false }, { share: false }]) {
    const off = clockContext(options); off.context.ghostMailArrive([[0, 0, 1]]); off.context.ghostMailAdvance(25, 5); off.context.ghostMailRender(25);
    assert.equal(off.context._ghostMailState, null); assert.deepEqual(off.touches, []); assert.deepEqual(off.paints, options.enabled === false ? [] : [[]]);
  }
});

test("C5 suppressed spans map receipts to the nearest real door with forward ties and no pre-run fallback", () => {
  const c = clockContext({ origin: 16.5, mercy: [24] }).context;
  assert.deepEqual([16, 20, 24, 28, 32, 36].map(b => c.ghostMailWallKind(b)), [0, 2, 1, 2, 2, 0]);
  assert.equal(c.ghostMailNearestDoor(20), 24, "equidistant ordinary and mercy doors choose forward");
  assert.equal(c.ghostMailNearestDoor(28), 24, "a nearer past door wins over a farther future one");
  assert.equal(c.ghostMailNearestDoor(32), 36);
  c.ghostMailArrive([[0, 0, 1], [4, 1, 7], [8, 2, 1], [12, 3, 7]]); c.ghostMailAdvance(28.5, 12);
  assert.deepEqual(Array.from(c._ghostMailState.assigned, row => row.b), [24, 24, 24, 36]);
  c._ghostDoorOrigin = 7; assert.equal(c.ghostMailNearestDoor(28), 36, "fallback cannot use a door preceding this run's first boundary");
});

test("C5 a missing relay token closes prefetch history without accepting mail or touching transport", () => {
  const run = clockContext({ token: "" }), c = run.context;
  assert.equal(c._ghostMailState.ready, true);
  for (let i = 1; i <= 1000; i++) c.ghostMailAdvance(20.5 + i / 100, i / 100);
  assert.equal(c._ghostMailState.clock.length, 1); c.ghostMailArrive([[0, 0, 1]]);
  assert.equal(c._ghostMailState.assigned.length, 0); assert.equal(c._ghostMailState.pending.length, 0); assert.deepEqual(run.touches, []); assert.deepEqual(run.paints, [[]]);
});

test("C5 reduced-motion receipts choose real pinned walls after subtraction and leave retired or distant stations outside", () => {
  const run = clockContext({ reduced: true, mercy: [0] }), c = run.context;
  c.ghostMailArrive([[0, 1, 7]]);
  assert.equal(c._ghostMailState.assigned[0].b, 24);
  assert.deepEqual(run.paints.at(-1), [{ b: 0, lane: 1, sig: 7 }], "logical door 24 shifts to suppressed physical 4, whose nearest real pane is 0");
  c.ghostMailAdvance(28.5, 8); assert.deepEqual(run.paints.at(-1), [{ b: 0, lane: 1, sig: 7 }], "the physical -4 tie also chooses forward");
  const raw = clockContext({ reduced: true, origin: 16.5, mercy: [24] }); raw.context.ghostMailArrive([[0, 2, 1]]);
  assert.equal(raw.context._ghostMailState.assigned[0].b, 20, "reduced mode must not use logical wall suppression before physical remapping");
  assert.deepEqual(raw.paints.at(-1), [{ b: 4, lane: 2, sig: 1 }]);
  const bounded = clockContext({ reduced: true, mercy: [28] }).context;
  assert.equal(bounded.ghostMailNearestDoor(32, -8, 32), 28, "nearest pinned choices cannot escape the last resident slot");
  c._ghostMailState.assigned = [{ b: 4, lane: 0, sig: 1 }, { b: 64, lane: 3, sig: 7 }]; c.ghostMailRender(20.5);
  assert.deepEqual(run.paints.at(-1), [{ b: -16, lane: 0, sig: 1 }, { b: 44, lane: 3, sig: 7 }], "retired and beyond-residency marks are not pulled back onto the visible ring");
});

test("C5 read-once adapter preserves the token and validation boundary and closes empty or rejected reads without a cache", async () => {
  for (const body of [{ catches: [[2, 0, 1], [1, 3, 7]] }, { catches: [] }, { catches: [[2, 4, 1]] }, { catches: [[1, 0, 1]], padding: "x".repeat(100001) }, null]) {
    const calls = [], arrivals = [], c = data({ GH_CHALK: true, ghostMailArrive(rows) { arrivals.push(plain(rows)); }, fetch(url, init) { calls.push({ url, init }); return Promise.resolve(response(body)); } });
    await c.ghostMailFetch(4, "a".repeat(32));
    assert.equal(calls.length, 1); assert.equal(calls[0].url, "https://relay.example/api/ghost-mail"); assert.equal(calls[0].init.headers["X-Ghost-Token"], "a".repeat(32));
    assert.equal(calls[0].init.body, undefined); assert.equal(calls[0].init.method, undefined);
    assert.deepEqual(arrivals, [body && body.catches.length === 2 ? body.catches : []]);
  }
  for (const extra of [{ GH_CHALK: false }, { _ghostShareEpoch: 5 }]) {
    let count = 0; const c = data({ GH_CHALK: true, ghostMailArrive() { count++; }, fetch: () => Promise.resolve(response({ catches: [[1, 0, 1]] })), ...extra });
    await c.ghostMailFetch(4, "a".repeat(32)); assert.equal(count, 0);
  }
});

test("C5 the mail header uses stable unique moon sigils, stays anonymous, and preserves its one-line consumption", () => {
  const c = data(); c._ghostMailRows = [[0, 0, 7], [1, 1, 1], [2, 2, 7], [3, 3, 1]];
  assert.equal(c.ghostVisitorMailLine(), "strangers left marks at your door · 🌘\u2009🌒"); assert.equal(c.ghostVisitorMailLine(), "");
  c._ghostMailSpoken = false; c._ghostMailRows = [[0, 0, 1], [1, 3, 1]];
  assert.equal(c.ghostVisitorMailLine(), "someone left a mark at your door · 🌒");
  c._ghostMailSpoken = false; c._ghostMailRows = [[0, 0, 8], [1, 3, "1"]]; assert.equal(c.ghostVisitorMailLine(), ""); assert.equal(c._ghostMailSpoken, false);
  assert.ok(html.includes("ghostVisitorMail:'だれかがあなたの戸口にしるしを残した · {sigil}'"));
  assert.ok(html.includes("ghostVisitorsMail:'旅人たちがあなたの戸口にしるしを残した · {sigils}'"));
  assert.ok(html.slice(html.indexOf("ghostVisitorMail:'") - 180, html.indexOf("ghostVisitorMail:'")).includes("native"));
});

function meshContext({ enabled = true, low = true, walls = true } = {}) {
  const allocations = [], added = [];
  class Float32 extends Float32Array { constructor(n) { super(n); allocations.push(["Float32", n]); } }
  class Uint16 extends Uint16Array { constructor(n) { super(n); allocations.push(["Uint16", n]); } }
  class BufferAttribute {
    constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; allocations.push(["attribute", this.count]); }
    setUsage(value) { this.usage = value; return this; }
  }
  class BufferGeometry {
    constructor() { this.attributes = {}; allocations.push(["geometry"]); }
    setAttribute(name, value) { this.attributes[name] = value; return this; }
    setIndex(value) { this.index = value; return this; }
    setDrawRange(start, count) { this.drawRange = { start, count }; }
  }
  class ShaderMaterial { constructor(options) { Object.assign(this, options); allocations.push(["material"]); } }
  class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; allocations.push(["mesh"]); } }
  const uniforms = Object.fromEntries(["uNow", "uArchN0", "uMarkFocalPx", "uWallSeed", "uBase", "uA", "uW", "uP", "uBite", "uTerrain", "uTerrainBase", "uHorizon"].map(name => [name, { value: name }]));
  const forbidden = () => { throw Error("received chalk cannot touch gameplay, audio, transport or RNG"); }, guard = new Proxy({}, { get: forbidden, set: forbidden });
  const math = Object.create(Math); math.random = forbidden;
  const context = vm.createContext({ Math: math, Number, Float32Array: Float32, Uint16Array: Uint16, GH_CHALK: enabled, ML_WALLS: walls, LOW: low,
    ML_BITE: false, ML_TERRAIN: false, GH_MAIL_RESPONSE_MAX: 256, GH_MARK_LANES: [-0.6, -0.2, 0.2, 0.6], ML_WALL_DJ: 7.3, ML_WALL_APEX: 17,
    ML_ARCH_EVERY: 4, ML_WALL_N: low ? 7 : 11, ROAD_MPB: 27, ROAD_FADE0: 734.4, ROAD_FADE1: 864, ML_WALL_REAR0: -12, ML_WALL_REAR1: -8,
    THREE: { BufferAttribute, BufferGeometry, ShaderMaterial, Mesh, DynamicDrawUsage: "dynamic", DoubleSide: "double" },
    _ghostMailMesh: null, _ghostMailGeometry: null, _roadG: x => x.toFixed(5), roadWallMat: { uniforms }, roadWall: { onBeforeRender() {}, add(mesh) { added.push(mesh); } },
    roadTideAt: b => ({ m: b === 24 ? 1 : 0 }), state: guard, Tone: guard, localStorage: guard, rnd: forbidden, fetch: forbidden, pushEvent: forbidden,
  });
  vm.runInContext(["ghostMailVertexShader", "ghostMailFragmentShader", "ghostMailBuild", "ghostMailWallKind", "ghostMailPaint"].map(name => extractFunction(main, name)).join("\n"), context);
  return { context, allocations, added, uniforms };
}

test("C5 empty or disabled receipts allocate nothing and both tiers reuse one bounded 512-triangle mesh", () => {
  for (const options of [{ enabled: false }, { walls: false }]) {
    const off = meshContext(options); off.context.ghostMailBuild(); off.context.ghostMailPaint([{ b: 24, lane: 0, sig: 1 }]);
    assert.equal(off.context.ghostMailVertexShader(), ""); assert.equal(off.context.ghostMailFragmentShader(), ""); assert.deepEqual(off.allocations, []); assert.deepEqual(off.added, []);
  }
  for (const low of [true, false]) {
    const run = meshContext({ low }), c = run.context; c.ghostMailPaint([]); c.ghostMailPaint(null); assert.deepEqual(run.allocations, []);
    const rows = Array.from({ length: 270 }, (_, i) => ({ b: 24 + i * 4, lane: i % 4, sig: i % 8 })); c.ghostMailPaint(rows);
    const mesh = c._ghostMailMesh, g = c._ghostMailGeometry, positions = g.attributes.position.array, mail = g.attributes.aMail.array;
    assert.equal(run.added.length, 1); assert.equal(run.added[0], mesh); assert.equal(g.attributes.position.count, 1024); assert.equal(g.index.array.length, 1536);
    assert.equal(g.drawRange.count, 512 * 3); assert.equal(mesh.visible, true); assert.equal(mesh.frustumCulled, false);
    assert.equal(mesh.onBeforeRender, c.roadWall.onBeforeRender); assert.equal(mesh.renderOrder, 6.25);
    for (const [name, value] of Object.entries(run.uniforms)) assert.equal(mesh.material.uniforms[name], value);
    assert.deepEqual([mesh.material.depthTest, mesh.material.depthWrite, mesh.material.polygonOffsetFactor, mesh.material.polygonOffsetUnits], [true, false, -1, -1]);
    for (let i = 0; i < 4; i++) for (let q = 0; q < 4; q++) {
      assert.equal(positions[(i * 4 + q) * 3], 24 + i * 4);
      assert.ok(Math.abs(positions[(i * 4 + q) * 3 + 1] - [-0.6, -0.2, 0.2, 0.6][i] * 7.3) < 1e-6);
      assert.equal(mail[(i * 4 + q) * 2], i / 8);
    }
    const count = run.allocations.length, corners = Array.from(g.attributes.aCorner.array), indices = Array.from(g.index.array);
    c.ghostMailPaint([{ b: 80, lane: 3, sig: 7, kind: 1 }]);
    assert.equal(c._ghostMailMesh, mesh); assert.equal(run.allocations.length, count); assert.equal(g.drawRange.count, 6);
    assert.equal(mail[0], 7 / 8); assert.equal(mail[1], 1);
    c.ghostMailPaint([]); assert.equal(mesh.visible, false); assert.equal(g.drawRange.count, 0); assert.ok(positions.every(x => x === 0)); assert.ok(mail.every(x => x === 0));
    assert.deepEqual(Array.from(g.attributes.aCorner.array), corners); assert.deepEqual(Array.from(g.index.array), indices); assert.equal(run.allocations.length, count);
  }
});

test("C5 received geometry rejects invalid payloads and keeps lane, sender hue, mercy suppression and brighter chalk independent", () => {
  for (const low of [false, true]) {
    const { context: c } = meshContext({ low });
    c.ghostMailPaint([null, { b: NaN, lane: 0, sig: 0 }, { b: 24, lane: 4, sig: 0 }, { b: 24, lane: 1, sig: 8 }, { b: 24, lane: 0, sig: 1 }, { b: 28, lane: 1, sig: 7 }, { b: 80, lane: 2, sig: 3 }]);
    const g = c._ghostMailGeometry; assert.equal(g.drawRange.count, 18);
    assert.deepEqual([g.attributes.aMail.array[1], g.attributes.aMail.array[9], g.attributes.aMail.array[17]], [1, 2, 0]);
    const vs = c.ghostMailVertexShader(), fragment = c.ghostMailFragmentShader();
    assert.match(vs, /vMailInk=0\.9\*/); assert.match(vs, /halfW=1\.5\*/); assert.match(vs, /1\.0-step\(1\.5,aMail\.y\)/);
    assert.match(fragment, /mix\(vec3\(0\.92\),rgb,0\.28\)\*vMailInk,1\.0/);
    assert.doesNotMatch(vs + fragment, /dFdx|dFdy|fwidth|texture2D|sampler2D/); assert.equal(fragment.includes("mailVn"), !low);
  }
});
