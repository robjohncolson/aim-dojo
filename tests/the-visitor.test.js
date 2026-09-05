"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const { sourceText: html } = require("./source.js");
const ownSeatFixture = JSON.parse(fs.readFileSync(path.join(__dirname, "the-visitor-own-seat.fixture.json"), "utf8"));

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

function ghostBlock(source) {
  const start = source.indexOf("const GH_RECORD=!!CFG.ghostRecord;");
  const end = source.indexOf("/* ---- WASD BEAT-TINT", start);
  assert.ok(start >= 0 && end > start, "the Visitor block is extractable");
  return source.slice(start, end);
}

async function mutationMustFail(assertContract, mutation, message) {
  assert.notEqual(mutation, html, `${message} is constructible`);
  await assert.rejects(async () => assertContract(mutation), assert.AssertionError, message);
  await assert.doesNotReject(async () => assertContract(html), `${message} passes reverted`);
}

function realCivilDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = +value.slice(0, 4), month = +value.slice(5, 7), day = +value.slice(8, 10), date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function mulberry32(seed) {
  return function next() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function threeHarness() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    setScalar(value) { return this.set(value, value, value); }
    copy(value) { return this.set(value.x || 0, value.y || 0, value.z || 0); }
    subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    distanceTo(value) { return Math.hypot(this.x - value.x, this.y - value.y, this.z - value.z); }
  }
  class Quaternion { setFromAxisAngle() { return this; } }
  class Matrix4 { compose() { return this; } }
  class Color {
    constructor(value) { this.value = value; }
    setHex(value) { this.value = value; return this; }
    setStyle(value) { this.value = value; return this; }
    lerp() { return this; }
    copy(value) { this.value = value.value; return this; }
  }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; } }
  class BufferGeometry {
    constructor() { this.attributes = {}; this.index = null; }
    setAttribute(name, value) { this.attributes[name] = value; return this; }
    setIndex(value) { this.index = value; return this; }
  }
  class Object3D {
    constructor() { this.children = []; this.visible = true; this.position = new Vector3(); this.scale = new Vector3(1, 1, 1); this.rotation = { set() {} }; }
    add(child) { this.children.push(child); child.parent = this; }
  }
  class Group extends Object3D {}
  class Mesh extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
  class Line extends Mesh {}
  class InstancedMesh extends Mesh {
    constructor(geometry, material, max) { super(geometry, material); this.max = max; this.count = 0; this.instanceMatrix = { setUsage() {}, needsUpdate: false }; this.instanceColor = null; }
    setMatrixAt() {}
    setColorAt() {}
  }
  class ShaderMaterial { constructor(settings) { Object.assign(this, settings); } }
  class LineBasicMaterial {
    constructor(settings) { Object.assign(this, settings); this.color = new Color().setStyle(settings.color); }
  }
  class BoxGeometry extends BufferGeometry { constructor(...args) { super(); this.args = args; } }
  class ConeGeometry extends BufferGeometry { constructor(...args) { super(); this.args = args; } }
  class SphereGeometry extends BufferGeometry { constructor(...args) { super(); this.args = args; } }
  class TorusGeometry extends BufferGeometry { constructor(...args) { super(); this.args = args; } }
  return { Vector3, Quaternion, Matrix4, Color, BufferAttribute, Float32BufferAttribute: BufferAttribute, InstancedBufferAttribute: BufferAttribute, BufferGeometry, Group, Mesh, Line, InstancedMesh, ShaderMaterial, LineBasicMaterial, BoxGeometry, ConeGeometry, SphereGeometry, TorusGeometry, DoubleSide: 2, AdditiveBlending: 3, DynamicDrawUsage: 4 };
}

function artifact({ moonBucket = 4, targets = [], fires = [] } = {}) {
  return { v: 1, date: "2026-08-22", moonBucket, bpm0: 60, dur: 60, bpmCurve: [[0, 60]], targets, taps: [], fires };
}

function oversizedArtifact() {
  const value = artifact();
  value.targets = Array.from({ length: 1200 }, (_unused, index) => {
    const at = index / 37;
    return [at, index % 4, index, at + 20.123456789, 0, null];
  });
  value.fires = Array.from({ length: 1200 }, (_unused, index) => [index / 37, 0.1234567890123, 0.2345678901234, 0]);
  return value;
}

function nearLimitArtifact() {
  const value = artifact();
  value.targets = Array.from({ length: 650 }, (_unused, index) => {
    const at = index / 37;
    return [at, index % 4, index, at + 20.123456789, 0, null];
  });
  value.fires = Array.from({ length: 650 }, (_unused, index) => [index / 37, 0.1234567890123, 0.2345678901234, 0]);
  return value;
}

function relayResponse(value, { declared, chunkSize, stall = false, reads } = {}) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return {
    ok: true,
    headers: { get(name) { return name.toLowerCase() === "content-length" && declared !== undefined ? String(declared) : null; } },
    body: {
      getReader() {
        return {
          read() {
            if (reads) reads.count += 1;
            if (stall) return new Promise(() => {});
            if (offset >= bytes.length) return Promise.resolve({ done: true });
            const end = Math.min(bytes.length, offset + (chunkSize || bytes.length || 1));
            const part = bytes.slice(offset, end); offset = end;
            return Promise.resolve({ done: false, value: part });
          },
          cancel() { return Promise.resolve(); },
        };
      },
    },
  };
}

function runVisitor(source, { record = false, seat = false, gift = false, share = false, phase = false, low = false, weak = low, extra = {}, body = "" } = {}) {
  const context = vm.createContext({
    Math, Number, JSON, Promise, Date, WeakMap, Set, Float32Array, Uint8Array, Uint16Array,
    CFG: { ghostRecord: record ? 1 : 0, ghostSeat: seat ? 1 : 0, ghostGift: gift ? 1 : 0, ghostShare: share ? 1 : 0, ghostPhase: phase ? 1 : 0, moonline: {}, skyDay: { api: "https://relay.example" }, rangeStart: 11, projGravity: 0, projLife: 10, projRadius: 0.1, flickBonus: { coneMul: 1 } }, LOW: low, WEAK: weak,
    state: { t: 0, bpm: 60, running: true }, trainMode: false, templeActive: false, reduceMotion: false,
    Tone: { Transport: { seconds: 0 } }, audioLat: () => 0, PITCH_LIMIT: 88 * Math.PI / 180,
    PLAYER_POS: { x: 0, y: 1.7, z: 0 }, ML_ARCH_EVERY: 4, ROAD_MPB: 27,
    ML_WALL_SPRING: 12, ML_WALL_DJ: 7.3, ML_WALL_DA: 7.3, ML_WALL_DB: 5,
    WASD_COL: ["lane-w", "lane-a", "lane-s", "lane-d"], ML_WALL_CHALK: [1, 2, 3, 4, 5], ML_GOLD: 6,
    phasesToday: () => "2026-08-22", moonPhaseBucket: () => 4, realCivilDate, mulberry32,
    roadWallMat: null, roadArchMat: null, scene: { add() {} }, TARGET_CORE_GEO: {}, _flockGeo: {}, SPAWN_UP: {},
    runIdle() {}, renderer: { compile() {} }, _roadG: (number) => (+number).toFixed(5),
    TF: (_key, english, values = {}) => english.replace(/\{(n|sigil)\}/g, (_match, key) => String(values[key])),
    localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout,
    ...extra,
  });
  new vm.Script(`${ghostBlock(source)}\n${body}`, { filename: "the-visitor.vm.js" }).runInContext(context);
  return context;
}

function graduationSnapshot(source, { record, seat, gift, share, phase, low }) {
  let touches = 0, network = 0, timers = 0, weakMaps = 0;
  const armCalls = [];
  class CountedWeakMap extends WeakMap { constructor(...args) { super(...args); weakMaps += 1; } }
  const context = runVisitor(source, {
    record, seat, gift, share, phase, low,
    extra: {
      state: { t: 20, bpm: 60, running: true, range: 10 }, trainMode: true, trainPhase: 2, trainWasd: 0, trainOrbs: 7,
      WeakMap: CountedWeakMap, armCalls, weakMapCount: () => weakMaps, touchCount: () => touches, networkCount: () => network, timerCount: () => timers,
      applySenseiFull() {}, resetPocketState() {}, specialOrbsLive: () => true, _specialLive: false, moonlineGraduate() {},
      showTrainCoach() {}, T: (_key, fallback) => fallback, showGhostToast() {}, _konamiGrad: true,
      pocketLive: () => false, pocketUpdateLawHud() {},
      localStorage: { getItem() { touches += 1; return null; }, setItem() { touches += 1; } },
      fetch() { network += 1; return Promise.resolve({ ok: false }); },
      setTimeout() { timers += 1; return timers; }, clearTimeout() {},
    },
    body: `
      ${extractFunction(source, "setTrainPhase")}
      const liveSeatReset=ghostSeatReset, liveShareReset=ghostShareReset, liveRecordArm=ghostRecordArm;
      ghostSeatReset=()=>{ armCalls.push('seat'); return liveSeatReset(); };
      ghostShareReset=()=>{ armCalls.push('share'); return liveShareReset(); };
      ghostRecordArm=()=>{ armCalls.push('record'); return liveRecordArm(); };
      Tone.Transport.seconds=10; ghostSessionStart();
      this.lesson={calls:armCalls.slice(),record:!!_ghostRecord,touches:touchCount(),network:networkCount(),timers:timerCount(),weakMaps:weakMapCount()};
      Tone.Transport.seconds=20; setTrainPhase(3);
      this.graduation={calls:armCalls.slice(),record:!!_ghostRecord,own:!!_ghostOwnSeat,touches:touchCount(),network:networkCount(),timers:timerCount(),weakMaps:weakMapCount(),base:_ghostRoadBase,trainMode};
    `,
  });
  return JSON.parse(JSON.stringify({ lesson: context.lesson, graduation: context.graduation }));
}

test("Parcel T mints one header-only token, maps timezone offsets, and makes share:0 structurally silent", async () => {
  const assertContract = (source) => {
    const table = [[-330, 18], [210, 9], [-840, 2]];
    let stored = "bad", reads = 0, writes = 0;
    const context = runVisitor(source, {
      share: true,
      extra: {
        crypto: { getRandomValues(bytes) { for (let i = 0; i < bytes.length; i += 1) bytes[i] = i; return bytes; } },
        localStorage: { getItem() { reads += 1; return stored; }, setItem(_key, value) { writes += 1; stored = value; } },
      },
      body: `this.buckets=${JSON.stringify(table.map((row) => row[0]))}.map(ghostLonBucket); this.tokens=[ghostToken(),ghostToken()];`,
    });
    assert.deepEqual(Array.from(context.buckets), table.map((row) => row[1]));
    assert.deepEqual(Array.from(context.tokens), ["000102030405060708090a0b0c0d0e0f", "000102030405060708090a0b0c0d0e0f"]);
    assert.equal(reads, 1); assert.equal(writes, 1);
    for (const record of [false, true]) for (const seat of [false, true]) for (const gift of [false, true]) {
      let touches = 0, network = 0, timers = 0, weakMaps = 0;
      class CountedWeakMap extends WeakMap { constructor(...args) { super(...args); weakMaps += 1; } }
      const off = runVisitor(source, {
        record, seat, gift, share: false,
        extra: {
          WeakMap: CountedWeakMap, weakMapCount: () => weakMaps,
          localStorage: { getItem() { touches += 1; return null; }, setItem() { touches += 1; } },
          fetch() { network += 1; return Promise.resolve({ ok: false }); },
          setTimeout() { timers += 1; return timers; }, clearTimeout() {},
        },
        body: `const before=weakMapCount(); ghostShareReset(); ghostShareUpload({v:1}); ghostShareFinalize(); this.off=[ghostToken(),_ghostSeats,_ghostOwnSeat,_ghostVisitorSeats,_ghostSilhouettes,_ghostSeatRows,_ghostReturnPool]; this.weakMaps=weakMapCount()-before;`,
      });
      assert.deepEqual(Array.from(off.off), ["", null, null, null, null, null, null]); assert.equal(off.weakMaps, 0); assert.equal(touches, 0); assert.equal(network, 0); assert.equal(timers, 0);
    }
    const visitorFetch = extractFunction(source, "ghostVisitorFetch"), pathLine = visitorFetch.split("\n").find((line) => line.includes("const path=")), pathExpression = pathLine && pathLine.slice(0, pathLine.indexOf(", body="));
    assert.ok(pathExpression); assert.doesNotMatch(pathExpression, /\btoken\b/, "the bearer never enters the query URL");
    for (const name of ["ghostUploadAttempt", "ghostMailAttempt"]) assert.doesNotMatch(extractFunction(source, name), /JSON\.stringify\(\{[^}]*\btoken\b/, `${name} keeps the token out of JSON`);
    assert.match(extractFunction(source, "ghostLonBucket"), /Geolocation and the observer longitude never enter this path/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostShareReset", (fn) => fn.replace("  if(!GH_MULTI) return;\n", ""));
  await mutationMustFail(assertContract, mutation, "the matrix kills a network/token/allocation-at-share:0 mutant");
  mutation = replaceFunction(html, "ghostVisitorFetch", (fn) => fn.replace("+'&n='+GH_VISITOR_FETCH_COUNT", "+'&n='+GH_VISITOR_FETCH_COUNT+'&token='+token"));
  await mutationMustFail(assertContract, mutation, "the URL oracle kills a token-in-query mutant");
  mutation = replaceFunction(html, "ghostLonBucket", (fn) => fn.replace("  const hour=", "  if(offset===-330) return 17;\n  const hour="));
  await mutationMustFail(assertContract, mutation, "the exact table kills India minus-330 mapping to bucket 17");
  mutation = replaceFunction(html, "ghostLonBucket", (fn) => fn.replace("  const hour=", "  if(offset===210) return 8;\n  const hour="));
  await mutationMustFail(assertContract, mutation, "the exact table kills Newfoundland plus-210 mapping to bucket 8");
  mutation = replaceFunction(html, "ghostLonBucket", (fn) => fn.replace("  const hour=", "  if(offset===-840) return 1;\n  const hour="));
  await mutationMustFail(assertContract, mutation, "the exact table mutation-pins Kiribati minus-840 to bucket 2");
  mutation = replaceFunction(html, "ghostShareReset", (fn) => fn.replace("  if(!GH_MULTI) return;", "  new WeakMap();\n  if(!GH_MULTI) return;"));
  await mutationMustFail(assertContract, mutation, "the constructor oracle kills a throwaway WeakMap before the share-off return");
});

test("graduation is the ordered main-play ghost boundary across the full HIGH/LOW phase matrix", async () => {
  const assertContract = (source) => {
    for (const low of [false, true]) for (const record of [false, true]) for (const seat of [false, true]) for (const gift of [false, true]) for (const share of [false, true]) for (const phase of [false, true]) {
      const snapshot = graduationSnapshot(source, { low, record, seat, gift, share, phase });
      const calls = []; if (seat) calls.push("seat"); if (share || phase) calls.push("share"); if (record) calls.push("record");
      assert.deepEqual(snapshot.lesson, { calls: [], record: false, touches: 0, network: 0, timers: 0, weakMaps: 0 }, `lesson stays ghost-silent at low:${+low} record:${+record} seat:${+seat} gift:${+gift} share:${+share} phase:${+phase}`);
      assert.deepEqual(snapshot.graduation, {
        calls, record, own: share || phase, touches: +seat + +share + +phase, network: 0, timers: 1, weakMaps: +record + +(share || phase),
        base: record || seat || share || phase ? 20 : 0, trainMode: false,
      }, `graduation arms exact knobs at low:${+low} record:${+record} seat:${+seat} gift:${+gift} share:${+share} phase:${+phase}`);
    }
    const phase = extractFunction(source, "setTrainPhase"), moonAt = phase.indexOf("moonlineGraduate();"), ghostAt = phase.indexOf("ghostSessionStart();");
    assert.ok(moonAt >= 0 && ghostAt > moonAt, "graduation starts ghosts only after the Moonline owns main play");
    assert.match(extractFunction(source, "resetSession"), /ghostSessionStart\(\);/, "the future direct-main-play reset keeps the same boundary");
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "setTrainPhase", (fn) => fn.replace("    ghostSessionStart();\n", ""));
  await mutationMustFail(assertContract, mutation, "the graduation matrix kills removal of the real-entry hook");
  mutation = replaceFunction(html, "ghostSessionStart", (fn) => fn.replace(" || trainMode", ""));
  await mutationMustFail(assertContract, mutation, "the lesson matrix kills a pre-graduation arm");
  mutation = replaceFunction(html, "ghostSessionStart", (fn) => fn.replace("  if(GH_SEAT) ghostSeatReset();\n  if(GH_MULTI) ghostShareReset();", "  if(GH_MULTI) ghostShareReset();\n  if(GH_SEAT) ghostSeatReset();"));
  await mutationMustFail(assertContract, mutation, "the ordered-arm matrix kills share-before-own-seat startup");
});

test("the real relay path keeps bearer tokens header-only on every complete URL and body", async () => {
  const assertContract = async (source) => {
    const requests = [];
    const fakeFetch = (url, init = {}) => {
      requests.push({ url, init });
      if (url.includes("/api/ghosts")) return Promise.resolve(relayResponse({ ghosts: [] }));
      if (url.endsWith("/api/ghost-mail") && !init.method) return Promise.resolve(relayResponse({ catches: [] }));
      return Promise.resolve({ ok: true });
    };
    const context = runVisitor(source, {
      share: true,
      extra: { fetch: fakeFetch, AbortController, TextDecoder },
      body: `
        _ghostToken='ffffffffffffffffffffffffffffffff'; _ghostShareEpoch=6;
        const night=${JSON.stringify(artifact())};
        this.done=Promise.all([
          ghostUploadAttempt('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',18,night),
          ghostVisitorFetch(6,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',18),
          ghostMailFetch(6,'cccccccccccccccccccccccccccccccc'),
          ghostMailAttempt('dddddddddddddddddddddddddddddddd','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',[[8,1]])
        ]);
      `,
    });
    await context.done;
    assert.equal(requests.length, 4);
    const upload = requests.find((request) => request.init.method === "POST" && request.url.includes("/api/ghost") && !request.url.includes("ghost-mail"));
    const visitor = requests.find((request) => request.url.includes("/api/ghosts"));
    const mailRead = requests.find((request) => request.url.endsWith("/api/ghost-mail") && !request.init.method);
    const mailWrite = requests.find((request) => request.url.endsWith("/api/ghost-mail") && request.init.method === "POST");
    assert.equal(upload.url, "https://relay.example/api/ghost");
    assert.equal(visitor.url, "https://relay.example/api/ghosts?lon=18&n=4");
    assert.equal(mailRead.url, "https://relay.example/api/ghost-mail");
    assert.equal(mailWrite.url, "https://relay.example/api/ghost-mail");
    assert.deepEqual(JSON.parse(upload.init.body), { lonBucket: 18, artifact: artifact() });
    assert.equal(visitor.init.body, undefined); assert.equal(mailRead.init.body, undefined);
    assert.deepEqual(JSON.parse(mailWrite.init.body), { toId: "e".repeat(32), catches: [[8, 1]] });
    assert.deepEqual(JSON.parse(JSON.stringify(upload.init.headers)), { "X-Ghost-Token": "a".repeat(32), "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(JSON.stringify(visitor.init.headers)), { "X-Ghost-Token": "b".repeat(32) });
    assert.deepEqual(JSON.parse(JSON.stringify(mailRead.init.headers)), { "X-Ghost-Token": "c".repeat(32) });
    assert.deepEqual(JSON.parse(JSON.stringify(mailWrite.init.headers)), { "X-Ghost-Token": "d".repeat(32), "Content-Type": "application/json" });
    for (const request of requests) assert.doesNotMatch(request.url, /[a-f]{32}/, "no bearer appears in a complete URL");
    for (const request of [upload, mailWrite]) assert.doesNotMatch(request.init.body, /"token"\s*:/, "no bearer field appears in a POST body");

    const lowRequests = [];
    const low = runVisitor(source, {
      share: true, low: true,
      extra: { fetch(url, init = {}) { lowRequests.push({ url, init }); return Promise.resolve(relayResponse({ ghosts: [] })); }, AbortController, TextDecoder },
      body: `_ghostShareEpoch=7; this.done=ghostVisitorFetch(7,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',18);`,
    });
    await low.done;
    assert.equal(lowRequests.length, 1); assert.equal(lowRequests[0].url, "https://relay.example/api/ghosts?lon=18&n=1", "LOW asks for its one full visitor and no silhouette");
  };
  await assertContract(html);
  const mutation = replaceFunction(html, "ghostRelayUrl", (fn) => fn.replace("raw+path:''", "raw+path+'?token='+ghostToken():''"));
  await mutationMustFail(assertContract, mutation, "the real fetch path kills a relay URL that appends the bearer");
});

test("Parcel U uploads the exact artifact fire-and-forget and performs one quiet 30-second retry", async () => {
  const assertContract = async (source) => {
    const timers = [], calls = [];
    const context = runVisitor(source, {
      share: true,
      extra: { calls, setTimeout(callback, ms) { timers.push({ callback, ms }); return timers.length; }, clearTimeout() {} },
      body: `
        _ghostToken='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; ghostLonBucket=()=>7;
        ghostUploadAttempt=(token,bucket,value,pageExit)=>{ calls.push({token,bucket,value,pageExit}); return Promise.resolve(false); };
        this.artifact=${JSON.stringify(artifact())}; this.calls=calls; this.result=ghostShareUpload(this.artifact);
      `,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(context.result, undefined); assert.equal(context.calls.length, 1); assert.equal(context.calls[0].value, context.artifact); assert.equal(context.calls[0].pageExit, false);
    assert.equal(timers.length, 1); assert.equal(timers[0].ms, 30000); timers[0].callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(context.calls.length, 2); assert.equal(context.calls[1].value, context.artifact); assert.equal(context.calls[1].pageExit, undefined); assert.equal(timers.length, 1, "the retry cannot schedule a storm");
    const requests = [];
    const wire = runVisitor(source, {
      share: true, extra: { requests },
      body: `
        ghostRelayFetch=(path,init)=>{ requests.push({path,init}); return Promise.resolve({ok:true}); };
        this.artifact=${JSON.stringify(artifact())}; this.requests=requests; this.sent=ghostUploadAttempt('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',7,this.artifact);
      `,
    });
    assert.equal(await wire.sent, true); assert.equal(wire.requests.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(wire.requests[0].init.headers)), { "X-Ghost-Token": "a".repeat(32), "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(wire.requests[0].init.body), { lonBucket: 7, artifact: JSON.parse(JSON.stringify(wire.artifact)) });
    assert.equal(wire.requests[0].path, "/api/ghost"); assert.equal(wire.requests[0].init.method, "POST");
    const finalize = extractFunction(source, "ghostRecordFinalize");
    assert.match(finalize, /localStorage\.setItem\(GH_STORE_KEY,json\);[\s\S]*if\(GH_SHARE\) ghostShareUpload\(r,pageExit===true\);/);
    assert.doesNotMatch(extractFunction(source, "ghostShareUpload"), /\bawait\b/);
  };
  await assertContract(html);
  const mutation = replaceFunction(html, "ghostShareUpload", (fn) => fn.replace(/ghostUploadAttempt\(token,bucket,artifact,pageExit===true\)\.then\([\s\S]*\);\n/, "  ghostUploadAttempt(token,bucket,artifact,pageExit===true).catch(()=>{});\n"));
  await mutationMustFail(assertContract, mutation, "the upload oracle kills removal of the single delayed retry");
});

test("upload keepalive is page-exit-only at the exact UTF-8 envelope boundary", async () => {
  const assertContract = async (source) => {
    const boundaryArtifact = (budget) => {
      const moon = "🌕", base = Buffer.byteLength(JSON.stringify({ lonBucket: 7, artifact: { padding: moon } }));
      return { padding: moon + "x".repeat(budget - base) };
    };
    const atBudget = boundaryArtifact(65536), overBudget = boundaryArtifact(65537);
    const requests = [];
    const context = runVisitor(source, {
      share: true,
      extra: { requests, atBudget, overBudget },
      body: `
        ghostRelayFetch=(path,init)=>{ requests.push({path,init}); return Promise.resolve({ok:true}); };
        this.sent=Promise.all([
          ghostUploadAttempt('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',7,atBudget,true),
          ghostUploadAttempt('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',7,overBudget,true),
          ghostUploadAttempt('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',7,atBudget)
        ]); this.requests=requests;
      `,
    });
    assert.deepEqual(Array.from(await context.sent), [true, true, true]); assert.equal(context.requests.length, 3);
    assert.deepEqual(context.requests.map(request => Buffer.byteLength(request.init.body)), [65536, 65537, 65536]);
    assert.deepEqual(context.requests.map(request => request.init.keepalive), [true, undefined, undefined], "only a fitting last-time page exit opts into keepalive");
    for (const request of context.requests) assert.equal(request.path, "/api/ghost");
    const attempt = extractFunction(source, "ghostUploadAttempt");
    assert.equal((attempt.match(/JSON\.stringify/g) || []).length, 1, "the exact envelope is serialized once");
    assert.match(attempt, /ghostUtf8Bytes\(body\)<=GH_KEEPALIVE_BUDGET/); assert.match(ghostBlock(source), /GH_KEEPALIVE_BUDGET=65536/);

    const sharedRequests = [], timers = [];
    const shared = runVisitor(source, {
      share: true,
      extra: {
        atBudget, sharedRequests, timers,
        setTimeout(callback, ms) { timers.push({ callback, ms }); return timers.length; }, clearTimeout() {},
      },
      body: `
        _ghostToken='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; ghostLonBucket=()=>7;
        ghostRelayFetch=(path,init)=>{ sharedRequests.push({path,init}); return Promise.resolve(init.keepalive?null:{ok:true}); };
        this.start=()=>ghostShareUpload(atBudget,true);
      `,
    });
    shared.start(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(timers.length, 1); assert.equal(timers[0].ms, 30000); assert.equal(sharedRequests[0].init.keepalive, true, "the fitting exit request may meet an already-used shared budget");
    timers[0].callback(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(sharedRequests.length, 2); assert.equal(sharedRequests[1].init.keepalive, undefined, "shared-budget rejection retries as an ordinary request when the page survives long enough");
  };
  await assertContract(html);
  const mutation = replaceFunction(html, "ghostUploadAttempt", (fn) => fn.replace("if(pageExit===true && ghostUtf8Bytes(body)<=GH_KEEPALIVE_BUDGET) init.keepalive=true;", "init.keepalive=true;"));
  await mutationMustFail(assertContract, mutation, "the boundary/Bow oracle kills an unconditional-keepalive survivor");
});

test("a capped Gift night's 99,556-byte envelope uploads at the ordinary Bow", async () => {
  const requests = [];
  let stored = "";
  const context = runVisitor(html, {
    record: true, gift: true, share: true,
    extra: {
      requests,
      localStorage: { getItem: () => null, setItem: (_key, value) => { stored = value; } },
    },
    body: `
      _ghostToken='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; ghostLonBucket=()=>7;
      ghostRelayFetch=(path,init)=>{ requests.push({path,init}); return Promise.resolve({ok:true}); };
      ghostRecordArm(); _ghostRecordArrivals=GH_WORTHY_ARRIVALS;
      _ghostRecord.bpmCurve=Array.from({length:200},(_x,i)=>[i*0.3,60+i/100]);
      _ghostRecord.targets=Array.from({length:1200},(_x,i)=>[i*0.04,i%4,i,i*0.04+0.02,0,null]);
      _ghostRecord.taps=Array.from({length:2400},(_x,i)=>[i*0.025,i%4,100]);
      _ghostRecord.fires=Array.from({length:1200},(_x,i)=>[i*0.05,3.1415,-1.5358,0]);
      _ghostGiftMail=Array.from({length:64},(_x,i)=>[i,i%4]);
      Tone.Transport.seconds=64; ghostRecordFinalizeOnce();
      this.requests=requests;
    `,
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(Buffer.byteLength(stored), 99986, "the capped Gift wrapper fixture remains exact");
  assert.equal(context.requests.length, 1); assert.equal(context.requests[0].path, "/api/ghost");
  assert.equal(Buffer.byteLength(context.requests[0].init.body), 99556, "the upload envelope exceeds the keepalive budget but still leaves the Bow");
  assert.equal(context.requests[0].init.keepalive, undefined, "ordinary Bow upload is never keepalive");
  assert.match(extractFunction(html, "bowFinish"), /if\(GH_RECORD\) ghostRecordFinalizeOnce\(\);/);
});

function ownSeatSnapshot(source, { low, record, seat, gift, share }) {
  const THREE = threeHarness(), sceneAdds = [];
  const context = runVisitor(source, {
    record, seat, gift, share, low,
    extra: { THREE, scene: { add(value) { sceneAdds.push(value); } }, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
    body: `
      const record=${JSON.stringify(artifact())}; _ghostSeatRecord=record; ghostSeatBuild(record);
      const drawList=()=>[_ghostRoad,_ghostWalls,_ghostTargets,_ghostAvatarBody,_ghostAvatarHalo,_ghostAvatarBow,_ghostBursts,_ghostBeaconCols,_ghostBeaconRings].filter(value=>value&&value.visible).length;
      ghostSeatApplyVisibility(0,1,1); ghostSeatBeaconVisibility(0); const work=drawList();
      ghostSeatApplyVisibility(0,1,1); ghostSeatBeaconVisibility(1); const workBeacon=drawList();
      ghostSeatApplyVisibility(1,1,1); ghostSeatBeaconVisibility(1); const reveal=drawList();
      const row=[0,1,0,2,0,null], target=new THREE.Vector3(); _ghActiveTargets.push(row); const counts=ghostSeatUpdateTargets(1,true,1); ghostTargetPosition(row,1,target);
      const road=Array.from(_ghostRoad.geometry.attributes.position.array), xs=[]; for(let i=0;i<road.length;i+=3) xs.push(road[i]);
      this.snapshot={sceneAdds:0,rootChildren:_ghostSeatRoot.children.length,beaconChildren:_ghostBeaconRoot.children.length,work,workBeacon,reveal,targets:_ghostTargets.count,beacons:counts.beacons,rings:_ghostBeaconRings.count,avatarX:_ghostAvatar.position.x,target:[target.x,target.y,target.z],roadX:[Math.min(...xs),Math.max(...xs)],wallSeat:_ghostWalls?_ghostWalls.material.vertexShader.match(/vec3 P=vec3\\(([-0-9.]+)/)[1]:null};
    `,
  });
  const snapshot = JSON.parse(JSON.stringify(context.snapshot)); snapshot.sceneAdds = sceneAdds.length; return snapshot;
}

test("the frozen own-seat scene survives the full HIGH/LOW four-knob matrix", async () => {
  const assertContract = (source) => {
    for (const low of [false, true]) for (const record of [false, true]) for (const seat of [false, true]) for (const gift of [false, true]) for (const share of [false, true]) {
      assert.deepEqual(ownSeatSnapshot(source, { low, record, seat, gift, share }), low ? ownSeatFixture.low : ownSeatFixture.high, `own seat stays frozen for low:${+low} record:${+record} seat:${+seat} gift:${+gift} share:${+share}`);
    }
    assert.match(ghostBlock(source), /let _ghCatchNext=0, _ghGiftRoadT=0, _ghGiftReveal=0, _ghSeatX=GH_SEAT_X/);
  };
  await assertContract(html);
  let mutation = html.replace("_ghSeatX=GH_SEAT_X;", "_ghSeatX=-90;");
  await mutationMustFail(assertContract, mutation, "the own-seat fixture kills a default-seat displacement mutant");
  mutation = html.replace("_ghSeatX=GH_SEAT_X;", "_ghSeatX=GH_GIFT?GH_SEAT_X:-90;");
  await mutationMustFail(assertContract, mutation, "the full matrix kills a share-off gift-off displacement mutant");
});

test("a fetched artifact is client-validated before the same seat machinery builds it at minus ninety", async () => {
  const assertContract = async (source) => {
    const THREE = threeHarness(), sceneAdds = [];
    const sceneOracle = `
      const sceneShape=seat=>{ const clean=value=>typeof value==='string'?value.split(_roadG(seat.x)).join('$SEAT'):value, rounded=value=>Math.round(value*1e6)/1e6, node=object=>({type:object.constructor.name,visible:object.visible!==false,position:[object===seat.avatar?0:object.position.x,object.position.y,object.position.z],scale:[object.scale.x,object.scale.y,object.scale.z],renderOrder:object.renderOrder||0,frustumCulled:object.frustumCulled!==false,max:object.max||0,geometry:object.geometry?{type:object.geometry.constructor.name,attributes:Object.keys(object.geometry.attributes||{}).sort().map(key=>{ const attribute=object.geometry.attributes[key]; return [key,attribute.itemSize,Array.from(attribute.array,(value,index)=>rounded(object===seat.road&&key==='position'&&index%3===0?value-seat.x:value))]; }),index:object.geometry.index?Array.from(object.geometry.index):[],args:object.geometry.args||[]}:null,material:object.material?{transparent:!!object.material.transparent,depthWrite:object.material.depthWrite,depthTest:object.material.depthTest,side:object.material.side,blending:object.material.blending,vertexShader:clean(object.material.vertexShader),fragmentShader:clean(object.material.fragmentShader)}:null,children:object.children.map(node)}); return {seat:node(seat.seatRoot),beacon:node(seat.beaconRoot)}; };
      const uniformsMatch=seat=>seat.road.material.uniforms.uVis===seat.vis&&seat.road.material.uniforms.uBeat===seat.beat&&seat.road.material.uniforms.uDeck.value===seat.roadDeck&&seat.road.material.uniforms.uGold.value===seat.roadGold&&(!seat.walls||(seat.walls.material.uniforms.uVis===seat.vis&&seat.walls.material.uniforms.uBeat===seat.beat&&seat.walls.material.uniforms.uPal.value===seat.palette))&&seat.targets.material.uniforms.uVis===seat.vis&&seat.avatarBody.material.uniforms.uVis===seat.vis&&seat.avatarHalo.material.uniforms.uVis===seat.vis&&seat.avatarBow.material.uniforms.uVis===seat.vis&&seat.avatarBody.material.uniforms.uCol.value===seat.avatarCol&&seat.avatarHalo.material.uniforms.uCol.value===seat.avatarCol&&seat.avatarBow.material.uniforms.uCol.value===seat.avatarCol&&(!seat.bursts||seat.bursts.material.uniforms.uVis===seat.vis)&&seat.beaconCols.material===seat.beaconRings.material&&seat.beaconCols.material.uniforms.uVis===seat.beacon;
      const recordPaletteMatches=seat=>{ const expected=new Uint32Array(seat.palette.length); ghostNightPalette(seat.record,expected); return seat.palette.every((color,index)=>color.value===expected[index])&&seat.roadDeck.value===expected[0]&&seat.roadGold.value===ML_GOLD&&seat.avatarCol.value===GH_MOON_BLUE&&seat.moon.value===GH_MOON_BLUE&&seat.white.value===GH_WHITE&&seat.lane.every((color,index)=>color.value===WASD_COL[index]); };
    `;
    const context = runVisitor(source, {
      seat: true, share: true,
      extra: { THREE, sceneAdds, scene: { add(value) { sceneAdds.push(value); } }, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
      body: `
        const own=${JSON.stringify(artifact({ moonBucket: 2 }))}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own);
        _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[]; _ghostSeats.push(_ghostOwnSeat); _ghostSeatRows=new WeakMap(); _ghostShareEpoch=3;
        this.receive=async value=>{ ghostRelayJson=()=>Promise.resolve(value); await ghostVisitorFetch(3,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',12); };
        ${sceneOracle}
        this.inspect=()=>{ const seat=_ghostVisitorSeats&&_ghostVisitorSeats[0]; return {count:_ghostSeats.length,visitor:seat&&{x:seat.x,id:seat.id,sig:seat.sig,rootChildren:seat.seatRoot.children.length,beaconChildren:seat.beaconRoot.children.length,avatarChildren:seat.avatar.children.length,avatarX:seat.avatar.position.x,avatarY:seat.avatar.position.y,avatarZ:seat.avatar.position.z,wall:seat.walls.material.vertexShader.includes('-90.00000'),prepared:seat.beatPrefix.length===1,sceneMatches:uniformsMatch(seat)&&uniformsMatch(_ghostOwnSeat)&&JSON.stringify(sceneShape(seat))===JSON.stringify(sceneShape(_ghostOwnSeat)),sameRecord:seat.record===this.validArtifact},ownX:_ghostOwnSeat.avatar.position.x,sceneAdds:sceneAdds.length}; };
      `,
    });
    const invalid = artifact(); invalid.extra = true;
    await context.receive({ ghosts: [{ id: "b".repeat(32), artifact: invalid }] }); assert.equal(context.inspect().count, 1); assert.equal(context.inspect().visitor, null);
    const valid = artifact({ moonBucket: 7 }); context.validArtifact = valid;
    await context.receive({ ghosts: [{ id: "b".repeat(32), artifact: valid }] });
    const result = JSON.parse(JSON.stringify(context.inspect()));
    assert.deepEqual(result, { count: 2, visitor: { x: -90, id: "b".repeat(32), sig: 7, rootChildren: 5, beaconChildren: 2, avatarChildren: 3, avatarX: -90, avatarY: 1.7, avatarZ: 0, wall: true, prepared: true, sceneMatches: true, sameRecord: true }, ownX: 90, sceneAdds: 4 });
    for (const low of [false, true]) for (const seatOn of [false, true]) for (const gift of [false, true]) {
      const matrixAdds = [];
      const matrix = runVisitor(source, {
        low, seat: seatOn, gift, share: true,
        extra: { THREE, scene: { add(value) { matrixAdds.push(value); } }, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
        body: `
          const own=${JSON.stringify(artifact({ moonBucket: 2 }))}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=21;
          ${sceneOracle}
          const visitor=${JSON.stringify(artifact({ moonBucket: 7 }))}; this.accepted=ghostVisitorAccept(21,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',visitor); const current=_ghostVisitorSeats[0];
          this.snapshot={sceneMatches:recordPaletteMatches(current)&&recordPaletteMatches(_ghostOwnSeat)&&uniformsMatch(current)&&uniformsMatch(_ghostOwnSeat)&&JSON.stringify(sceneShape(current))===JSON.stringify(sceneShape(_ghostOwnSeat)),rootChildren:current.seatRoot.children.length,beaconChildren:current.beaconRoot.children.length,avatar:[current.avatar.position.x,current.avatar.position.y,current.avatar.position.z,current.avatar.scale.x,current.avatar.scale.y,current.avatar.scale.z],walls:!!current.walls,bursts:!!current.bursts,seatXs:_ghostSeats.map(item=>item.x)};
        `,
      });
      assert.equal(matrix.accepted, true); assert.equal(matrix.snapshot.sceneMatches, true, `singleton scene parity holds at low:${+low} seat:${+seatOn} gift:${+gift}`);
      assert.deepEqual(JSON.parse(JSON.stringify(matrix.snapshot)), { sceneMatches: true, rootChildren: low ? 3 : 5, beaconChildren: 2, avatar: [-90, 1.7, 0, 1, 1, 1], walls: !low, bursts: !low, seatXs: seatOn ? [90, -90] : [-90] });
      assert.equal(matrixAdds.length, 4);
    }
    const ownIsolation = runVisitor(source, {
      seat: true, share: true,
      extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(), roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } } },
      body: `
        const own=${JSON.stringify(artifact({ moonBucket: 2, targets: [[4, 1, 101, 10, 0, null]], fires: [[5, 0.25, -0.1, 0]] }))}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own);
        const turns=[]; _ghostAvatar.rotation={last:[0,0,0,'YXZ'],set(...args){ this.last=args; turns.push(args); }};
        _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=22;
        Tone.Transport.seconds=2; ghostSeatsUpdate(0.016);
        const seat=_ghostOwnSeat, refs=[seat.seatRoot,seat.beaconRoot,seat.road,seat.walls,seat.targets,seat.avatar,seat.avatarBody,seat.avatarHalo,seat.avatarBow,seat.vis,seat.beat,seat.palette,seat.activeTargets,seat.hitRows,seat.beatPrefix], snapshot=()=>({record:seat.record===own,x:seat.x,palette:seat.palette.map(color=>color.value),derived:[seat.roadDeck.value,seat.roadGold.value,seat.avatarCol.value,seat.moon.value,seat.white.value],replay:[seat.targetCursor,seat.hitCursor,seat.fireCursor,seat.bpmCursor,seat.burstNext,seat.lastTime],active:seat.activeTargets.map(row=>row[2]),beat:seat.beat.value,reveal:[seat.vis.value,seat.seatRoot.visible,seat.road.visible,seat.avatar.visible]});
        const before=snapshot(), accepted=ghostVisitorAccept(22,'dddddddddddddddddddddddddddddddd',${JSON.stringify(artifact({ moonBucket: 7 }))}), after=snapshot();
        const sameRefs=refs.every((value,index)=>value===[seat.seatRoot,seat.beaconRoot,seat.road,seat.walls,seat.targets,seat.avatar,seat.avatarBody,seat.avatarHalo,seat.avatarBow,seat.vis,seat.beat,seat.palette,seat.activeTargets,seat.hitRows,seat.beatPrefix][index]);
        Tone.Transport.seconds=4.999; ghostSeatsUpdate(0.016); const beforeDue={fireCursor:seat.fireCursor,targetCursor:seat.targetCursor,active:seat.activeTargets.map(row=>row[2]),targetDraw:seat.targets.count,beat:seat.beat.value,turns:turns.slice()};
        Tone.Transport.seconds=5; ghostSeatsUpdate(0.016); const atDue={fireCursor:seat.fireCursor,targetCursor:seat.targetCursor,active:seat.activeTargets.map(row=>row[2]),targetDraw:seat.targets.count,beat:seat.beat.value,turns:turns.slice()};
        this.ownIsolation={accepted,sameRefs,before,after,beforeDue,atDue};
      `,
    });
    const ownResult = JSON.parse(JSON.stringify(ownIsolation.ownIsolation));
    assert.equal(ownResult.accepted, true); assert.equal(ownResult.sameRefs, true, "visitor acceptance preserves the own seat's built scene and replay storage identities");
    assert.deepEqual(ownResult.after, ownResult.before, "visitor acceptance leaves the own seat's build, palette, replay, and reveal state untouched");
    assert.deepEqual(ownResult.beforeDue, { fireCursor: 0, targetCursor: 1, active: [101], targetDraw: 1, beat: 4.999, turns: [] }, "the own seat advances its target while its fire remains pending one millisecond before due");
    assert.deepEqual(ownResult.atDue, { fireCursor: 1, targetCursor: 1, active: [101], targetDraw: 1, beat: 5, turns: [[-0.1, 0.25, 0, "YXZ"]] }, "the own seat fires exactly when due after visitor acceptance");
    assert.equal((ghostBlock(source).match(/function ghostSeatBuild\(/g) || []).length, 1, "both seats use the one build function");
    assert.match(extractFunction(source, "ghostVisitorFetch"), /const record=ghostArtifactValid\(item\.artifact\); if\(!record\) continue;[\s\S]*ghostVisitorAccept\(epoch,item\.id,record,reachedBack\)/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostVisitorFetch", (fn) => fn.replace("const record=ghostArtifactValid(item.artifact); if(!record) continue;", "const record=item.artifact;"));
  mutation = replaceFunction(mutation, "ghostVisitorAccept", (fn) => fn.replace(" || !ghostArtifactValid(record)", ""));
  await mutationMustFail(assertContract, mutation, "the fetch fixture kills an unvalidated server-artifact mutant");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("  _ghostVisitorCount++;", "  _ghostVisitorCount++; if(_ghostOwnSeat) _ghostOwnSeat.fireCursor=999;"));
  await mutationMustFail(assertContract, mutation, "the own-seat replay oracle kills visitor acceptance corrupting a future local fire");
  mutation = replaceFunction(html, "ghostSeatAdvance", (fn) => fn.replace("record.fires[_ghFireCursor][0]<=t", "record.fires[_ghFireCursor][0]+0.001<=t"));
  await mutationMustFail(assertContract, mutation, "the own-seat replay oracle kills a local fire delayed past its exact timestamp");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("ghostSeatPrepare(record); if(_ghostAvatar)", "ghostSeatPrepare(record); _ghostAvatar.position.y=99; if(_ghostAvatar)"));
  await mutationMustFail(assertContract, mutation, "the singleton scene-state oracle pins the visitor avatar at player height");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "_ghostAvatar.position.z=99; seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the singleton scene-state oracle pins the visitor avatar to its full frozen pose");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "_ghostAvatar.scale.setScalar(2); seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the normalized singleton scene oracle kills a visitor-only transform drift");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "_ghostRoad.geometry.attributes.position.array[0]=999; seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the normalized singleton scene oracle kills visitor-only geometry drift");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "_ghostRoad.material.uniforms.uVis={value:1}; seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the normalized singleton scene oracle kills a detached reveal uniform");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "if(LOW) _ghostAvatar.scale.setScalar(2); seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the singleton matrix kills a LOW-only visual drift");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "if(!GH_SEAT) _ghostAvatar.scale.setScalar(2); seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the singleton matrix kills a share-only visual drift");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "if(LOW) _ghRoadDeck.setHex(123456789); seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the singleton matrix kills a LOW-only palette drift");
});

test("HIGH packs three full visitors and one honest fire-only silhouette while LOW remains one seat", async () => {
  const assertContract = async (source) => {
    const THREE = threeHarness(), sceneAdds = [];
    const records = [
      artifact({ moonBucket: 1, targets: [[0, 0, 11, 10, 1, 5]] }),
      artifact({ moonBucket: 2, targets: [[0, 1, 22, 10, 1, 5]] }),
      artifact({ moonBucket: 3, targets: [[0, 2, 33, 10, 1, 5]] }),
      artifact({ moonBucket: 4, targets: [[0, 3, 44, 10, 0, null]], fires: [[1, 0.25, -0.1, 0], [5, -0.5, 0.2, 1]] }),
      artifact({ moonBucket: 5, targets: [[0, 0, 55, 10, 0, null]] }),
    ];
    const ids = ["a", "b", "c", "d", "e"].map((letter) => letter.repeat(32));
    const context = runVisitor(source, {
      seat: true, gift: true, share: true,
      extra: {
        THREE, sceneAdds, scene: { add(value) { sceneAdds.push(value); } }, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(),
        roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } },
      },
      body: `
        const own=${JSON.stringify(artifact({ moonBucket: 0 }))}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostGiftMail=[];
        _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=3; this.heldLock={slot:77}; _ghGiftLockedRow=this.heldLock;
        const paletteMatches=seat=>{ const expected=new Uint32Array(seat.palette.length); ghostNightPalette(seat.record,expected); return seat.palette.every((color,index)=>color.value===expected[index])&&seat.roadDeck.value===expected[0]&&seat.roadGold.value===ML_GOLD&&seat.avatarCol.value===GH_MOON_BLUE&&seat.moon.value===GH_MOON_BLUE&&seat.white.value===GH_WHITE&&seat.lane.every((color,index)=>color.value===WASD_COL[index]); };
        const avatarParity=(silhouette,full)=>{ if(!silhouette||!full) return false; const pieces=[[silhouette.body,full.avatarBody],[silhouette.halo,full.avatarHalo],[silhouette.bow,full.avatarBow]], shape=object=>({geometry:object.geometry.constructor.name,args:object.geometry.args||[],position:[object.position.x,object.position.y,object.position.z],scale:[object.scale.x,object.scale.y,object.scale.z],renderOrder:object.renderOrder||0,transparent:object.material.transparent,depthWrite:object.material.depthWrite,depthTest:object.material.depthTest,side:object.material.side,blending:object.material.blending,vertexShader:object.material.vertexShader,fragmentShader:object.material.fragmentShader,color:object.material.uniforms.uCol.value.value}), avatarShape=(seat,avatar)=>[avatar.position.x-seat.x,avatar.position.y,avatar.position.z,avatar.scale.x,avatar.scale.y,avatar.scale.z]; return JSON.stringify(avatarShape(silhouette,silhouette.avatar))===JSON.stringify(avatarShape(full,full.avatar))&&pieces.every(pair=>JSON.stringify(shape(pair[0]))===JSON.stringify(shape(pair[1])))&&[silhouette.body,silhouette.halo,silhouette.bow].every(object=>object.material.uniforms.uVis===silhouette.vis)&&[full.avatarBody,full.avatarHalo,full.avatarBow].every(object=>object.material.uniforms.uVis===full.vis); };
        this.receive=async value=>{ ghostRelayJson=()=>Promise.resolve(value); await ghostVisitorFetch(3,'ffffffffffffffffffffffffffffffff',12); };
        this.inspect=()=>{ const silhouette=_ghostSilhouettes&&_ghostSilhouettes[0]; return {
          visitorCount:_ghostVisitorCount, visitorXs:_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(seat=>seat.x),
          seatXs:_ghostSeats.map(seat=>seat.x), ids:_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(seat=>seat.id),
          allFull:_ghostVisitorSeats.slice(0,_ghostVisitorCount).every(seat=>!!(seat.road&&seat.targets&&seat.beaconCols)),
          prepared:_ghostVisitorSeats.slice(0,_ghostVisitorCount).every(seat=>seat.beatPrefix.length===1&&seat.hitRows.length===1),
          paletteOk:_ghostVisitorSeats.slice(0,_ghostVisitorCount).every(paletteMatches), heldLock:_ghGiftLockedRow===this.heldLock, sceneAdds:sceneAdds.length,
          silhouette:silhouette&&{x:silhouette.x,id:silhouette.id,rootChildren:silhouette.root.children.length,avatarChildren:silhouette.avatar.children.length,avatarParity:avatarParity(silhouette,_ghostVisitorSeats[0]),forbidden:['road','walls','targets','beaconCols','beaconRings','bursts','mail','caughtSlots'].some(key=>key in silhouette),mapped:_ghostSeatRows.has(silhouette.record.targets[0])},
          silhouetteInGiftSeats:!!(silhouette&&_ghostSeats.includes(silhouette))
        }; };
        this.advance=()=>{ const silhouette=_ghostSilhouettes[0], turns=[]; silhouette.avatar.rotation={last:null,set(...args){ turns.push(args); this.last=args; }}; Tone.Transport.seconds=2; ghostSilhouettesUpdate(); const atTwo=turns.map(row=>row.slice()),cursorTwo=silhouette.fireCursor; Tone.Transport.seconds=6; ghostSilhouettesUpdate(); const giftSilent=!_ghostOwnSeat.mail.length&&(!_ghostOwnSeat.caughtSlots||!_ghostOwnSeat.caughtSlots.size)&&_ghostVisitorSeats.slice(0,_ghostVisitorCount).every(seat=>!seat.mail.length&&(!seat.caughtSlots||!seat.caughtSlots.size)); return {atTwo,cursorTwo,turns:turns,visible:silhouette.root.visible,alpha:silhouette.vis.value,giftSilent}; };
        this.stages=()=>[0,0.02,0.01,1].map(packed=>{ roadWallMat.uniforms.uK.value=[packed]; ghostSeatsUpdate(0.016); const silhouette=_ghostSilhouettes[0]; return {full:_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(seat=>[seat.vis.value,seat.seatRoot.visible,seat.avatar.visible,seat.avatarBody.visible,seat.avatarHalo.visible,seat.avatarBow.visible]),silhouette:[silhouette.vis.value,silhouette.root.visible,silhouette.avatar.visible,silhouette.body.visible,silhouette.halo.visible,silhouette.bow.visible]}; });
        this.gates=()=>{ const fullSeat=seat=>seat.seatRoot.visible&&seat.avatar.visible&&seat.avatarBody.visible&&seat.avatarHalo.visible&&seat.avatarBow.visible, fullSilhouette=seat=>seat.root.visible&&seat.avatar.visible&&seat.body.visible&&seat.halo.visible&&seat.bow.visible, hiddenSeat=seat=>!seat.seatRoot.visible&&!seat.avatar.visible&&!seat.avatarBody.visible&&!seat.avatarHalo.visible&&!seat.avatarBow.visible, hiddenSilhouette=seat=>!seat.root.visible&&!seat.avatar.visible&&!seat.body.visible&&!seat.halo.visible&&!seat.bow.visible, full=()=>_ghostVisitorSeats.slice(0,_ghostVisitorCount).every(fullSeat)&&_ghostSilhouettes.every(fullSilhouette), hidden=()=>_ghostVisitorSeats.slice(0,_ghostVisitorCount).every(hiddenSeat)&&_ghostSilhouettes.every(hiddenSilhouette), cycle=kind=>{ state.running=true; templeActive=false; trainMode=false; ghostSeatsUpdate(0.016); const opened=full(); if(kind==='paused') state.running=false; if(kind==='temple') templeActive=true; if(kind==='trainer') trainMode=true; ghostSeatsUpdate(0.016); return opened&&hidden(); }; const paused=cycle('paused'),temple=cycle('temple'),trainer=cycle('trainer'); state.running=true; templeActive=false; trainMode=false; ghostSeatsUpdate(0.016); return {paused,temple,trainer}; };
        this.recycle=recordList=>{
          const fullResources=seat=>[seat.seatRoot,seat.beaconRoot,seat.road,seat.road&&seat.road.geometry,seat.road&&seat.road.material,seat.walls,seat.walls&&seat.walls.geometry,seat.walls&&seat.walls.material,seat.targets,seat.targets&&seat.targets.geometry,seat.targets&&seat.targets.material,seat.avatar,seat.avatarBody,seat.avatarBody&&seat.avatarBody.geometry,seat.avatarBody&&seat.avatarBody.material,seat.avatarHalo,seat.avatarHalo&&seat.avatarHalo.geometry,seat.avatarHalo&&seat.avatarHalo.material,seat.avatarBow,seat.avatarBow&&seat.avatarBow.geometry,seat.avatarBow&&seat.avatarBow.material,seat.bursts,seat.bursts&&seat.bursts.geometry,seat.bursts&&seat.bursts.material,seat.beaconCols,seat.beaconCols&&seat.beaconCols.geometry,seat.beaconCols&&seat.beaconCols.material,seat.beaconRings,seat.beaconRings&&seat.beaconRings.geometry,seat.beaconRings&&seat.beaconRings.material], silhouetteResources=seat=>[seat.root,seat.avatar,seat.body,seat.body.geometry,seat.body.material,seat.halo,seat.halo.geometry,seat.halo.material,seat.bow,seat.bow.geometry,seat.bow.material];
          const beforeFull=_ghostVisitorSeats.map(fullResources), beforeSilhouette=silhouetteResources(_ghostSilhouettes[0]), firstRoot=_ghostVisitorSeats[0].seatRoot, adds=sceneAdds.length;
          for(const seat of _ghostVisitorSeats){
            seat.mail.push([8,1]); if(seat.caughtSlots) seat.caughtSlots.add(1); seat.activeTargets.push(seat.record.targets[0]);
            seat.targetCursor=1; seat.hitCursor=1; seat.fireCursor=1; seat.bpmCursor=1; seat.burstNext=1; seat.lastTime=4; seat.targets.count=1;
            if(seat.bursts) seat.bursts.count=1; if(seat.burstPool&&seat.burstPool[0]) seat.burstPool[0].on=true; if(seat.catchPool&&seat.catchPool[0]) seat.catchPool[0].on=true;
            if(seat.giftProxy) seat.giftProxy._ghostGiftRow=seat.record.targets[0]; seat.giftRoadT=8; seat.giftReveal=1; seat.beat.value=9; seat.counts.targets=1; seat.counts.beacons=1; seat.beaconCols.count=1; seat.beaconRings.count=2;
            seat.avatar.rotation={last:['stale'],set(...args){ this.last=args; }};
          }
          ghostShareReset();
          const cleared=_ghostVisitorSeats.every(seat=>!seat.record&&!seat.id&&!seat.mail.length&&(!seat.caughtSlots||!seat.caughtSlots.size)&&!seat.seatRoot.visible&&!seat.activeTargets.length&&!seat.hitRows.length&&!seat.beatPrefix.length&&seat.targetCursor===0&&seat.hitCursor===0&&seat.fireCursor===0&&seat.bpmCursor===0&&seat.burstNext===0&&seat.lastTime===0&&seat.targets.count===0&&(!seat.bursts||seat.bursts.count===0)&&(!seat.burstPool||seat.burstPool.every(bird=>!bird.on))&&(!seat.catchPool||seat.catchPool.every(effect=>!effect.on))&&(!seat.giftProxy||seat.giftProxy._ghostGiftRow===null)&&seat.giftRoadT===0&&seat.giftReveal===0&&seat.beat.value===0&&seat.counts.targets===0&&seat.counts.beacons===0&&seat.beaconCols.count===0&&seat.beaconRings.count===0&&JSON.stringify(seat.avatar.rotation.last)===JSON.stringify([0,0,0,'YXZ']));
          const silhouetteCleared=_ghostSilhouettes.every(seat=>!seat.record&&!seat.id&&!seat.root.visible&&JSON.stringify(seat.avatar.rotation.last)===JSON.stringify([0,0,0,'YXZ']));
          const nextIds=['5','6','7','8'].map(value=>value.repeat(32)), reused=recordList.slice(0,3).every((record,index)=>ghostVisitorAccept(_ghostShareEpoch,nextIds[index],record)), silhouetteReused=ghostSilhouetteAccept(_ghostShareEpoch,nextIds[3],recordList[3]), next=_ghostVisitorSeats[0];
          const sameResources=_ghostVisitorSeats.every((seat,index)=>fullResources(seat).every((value,part)=>value===beforeFull[index][part]))&&silhouetteResources(_ghostSilhouettes[0]).every((value,part)=>value===beforeSilhouette[part]);
          return {addsBefore:adds,addsAfter:sceneAdds.length,cleared,silhouetteCleared,reused,silhouetteReused,sameRoot:next.seatRoot===firstRoot,sameResources,reusedNeutral:_ghostVisitorSeats.every(seat=>JSON.stringify(seat.avatar.rotation.last)===JSON.stringify([0,0,0,'YXZ']))&&JSON.stringify(_ghostSilhouettes[0].avatar.rotation.last)===JSON.stringify([0,0,0,'YXZ']),reusedPalette:_ghostVisitorSeats.every(paletteMatches),visitorCount:_ghostVisitorCount,seatXs:_ghostSeats.map(seat=>seat.x),silhouetteX:_ghostSilhouettes[0].x};
        };
      `,
    });
    await context.receive({ ghosts: records.map((record, index) => ({ id: ids[index], artifact: record })) });
    assert.deepEqual(JSON.parse(JSON.stringify(context.inspect())), {
      visitorCount: 3, visitorXs: [-90, 180, -180], seatXs: [90, -90, 180, -180], ids: ids.slice(0, 3), allFull: true, prepared: true, paletteOk: true, heldLock: true, sceneAdds: 9,
      silhouette: { x: 270, id: ids[3], rootChildren: 1, avatarChildren: 3, avatarParity: true, forbidden: false, mapped: false }, silhouetteInGiftSeats: false,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(context.advance())), { atTwo: [[-0.1, 0.25, 0, "YXZ"]], cursorTwo: 1, turns: [[-0.1, 0.25, 0, "YXZ"], [0.2, -0.5, 0, "YXZ"]], visible: true, alpha: 1, giftSilent: true }, "the distant bow replays only due fires and can never enter any Gift ledger");
    assert.deepEqual(JSON.parse(JSON.stringify(context.stages())), [
      { full: [[0, false, false, false, false, false], [0, false, false, false, false, false], [0, false, false, false, false, false]], silhouette: [0, false, false, false, false, false] },
      { full: [[0.35, true, true, true, true, true], [0.35, true, true, true, true, true], [0.35, true, true, true, true, true]], silhouette: [0.35, true, true, true, true, true] },
      { full: [[0.7, true, true, true, true, true], [0.7, true, true, true, true, true], [0.7, true, true, true, true, true]], silhouette: [0.7, true, true, true, true, true] },
      { full: [[1, true, true, true, true, true], [1, true, true, true, true, true], [1, true, true, true, true, true]], silhouette: [1, true, true, true, true, true] },
    ], "the silhouette follows the same closed, veiled, near-mercy, and mercy reveal stages as every full seat");
    assert.deepEqual(JSON.parse(JSON.stringify(context.gates())), { paused: true, temple: true, trainer: true }, "pause, Temple, and trainer gates hide every full visitor and the silhouette");
    assert.deepEqual(JSON.parse(JSON.stringify(context.recycle(records.slice(0, 4)))), { addsBefore: 9, addsAfter: 9, cleared: true, silhouetteCleared: true, reused: true, silhouetteReused: true, sameRoot: true, sameResources: true, reusedNeutral: true, reusedPalette: true, visitorCount: 3, seatXs: [90, -90, 180, -180], silhouetteX: 270 }, "reset clears every ledger/replay/root and refills all four returned strangers without rebuilding a resource");

    const packed = runVisitor(source, {
      seat: true, share: true,
      extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
      body: `
        const own=${JSON.stringify(artifact())}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=8;
        this.receive=async value=>{ ghostRelayJson=()=>Promise.resolve(value); await ghostVisitorFetch(8,'ffffffffffffffffffffffffffffffff',12); return {n:_ghostVisitorCount,xs:_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(seat=>seat.x),ids:_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(seat=>seat.id),silhouettes:_ghostSilhouettes?_ghostSilhouettes.filter(seat=>seat.record).length:0}; };
      `,
    });
    const invalid = artifact(); invalid.extra = true;
    assert.deepEqual(JSON.parse(JSON.stringify(await packed.receive({ ghosts: [
      { id: ids[0], artifact: invalid }, { id: ids[1], artifact: records[0] }, { id: ids[1], artifact: records[1] }, { id: ids[2], artifact: records[2] },
    ] }))), { n: 2, xs: [-90, 180], ids: [ids[1], ids[2]], silhouettes: 0 }, "invalid and duplicate rows consume no seat and leave no gap");

    const honestShape = async (rows) => {
      const probe = runVisitor(source, {
        seat: true, share: true,
        extra: { THREE, rows, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
        body: `
          const own=${JSON.stringify(artifact())}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=31;
          ghostRelayJson=()=>Promise.resolve({ghosts:rows}); this.receive=async()=>{ await ghostVisitorFetch(31,'ffffffffffffffffffffffffffffffff',12); return {n:_ghostVisitorCount,silhouettes:_ghostSilhouettes?_ghostSilhouettes.filter(seat=>seat.record).length:0,allocated:!!_ghostSilhouettes}; };
        `,
      });
      return JSON.parse(JSON.stringify(await probe.receive()));
    };
    const threeRows = records.slice(0, 3).map((record, index) => ({ id: ids[index], artifact: record }));
    assert.deepEqual(await honestShape(threeRows), { n: 3, silhouettes: 0, allocated: false }, "exactly three real returns leave the fourth chair honestly empty");
    assert.deepEqual(await honestShape([...threeRows, { id: ids[3], artifact: invalid }]), { n: 3, silhouettes: 0, allocated: false }, "an invalid fourth row cannot populate a silhouette");
    assert.deepEqual(await honestShape([...threeRows, { id: ids[2], artifact: records[3] }]), { n: 3, silhouettes: 0, allocated: false }, "a duplicate fourth identity cannot impersonate another night");

    const shareOnly = runVisitor(source, {
      share: true,
      extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(), roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } } },
      body: `
        _ghostShareEpoch=5; ghostVisitorAccept(5,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',${JSON.stringify(records[0])}); ghostVisitorAccept(5,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',${JSON.stringify(records[1])}); ghostVisitorAccept(5,'cccccccccccccccccccccccccccccccc',${JSON.stringify(records[2])}); Tone.Transport.seconds=2; ghostSeatsUpdate(0.016); this.visible=_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(seat=>[seat.x,seat.seatRoot.visible]);
      `,
    });
    assert.deepEqual(Array.from(shareOnly.visible, (row) => Array.from(row)), [[-90, true], [180, true], [-180, true]], "share-only mode updates every full visitor, not just minus ninety");

    const low = runVisitor(source, {
      seat: true, share: true, low: true,
      extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
      body: `
        const own=${JSON.stringify(artifact())}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=6;
        this.receive=async value=>{ ghostRelayJson=()=>Promise.resolve(value); await ghostVisitorFetch(6,'ffffffffffffffffffffffffffffffff',12); return {n:_ghostVisitorCount,xs:_ghostSeats.map(seat=>seat.x),silhouettes:_ghostSilhouettes}; };
      `,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(await low.receive({ ghosts: records.slice(0, 4).map((record, index) => ({ id: ids[index], artifact: record })) }))), { n: 1, xs: [90, -90], silhouettes: null });
  };
  await assertContract(html);
  let mutation = html.replace("GH_VISITOR_FETCH_COUNT=WEAK?1:4", "GH_VISITOR_FETCH_COUNT=WEAK?1:3");
  await mutationMustFail(assertContract, mutation, "the four-return oracle kills a HIGH fetch capped before the honest silhouette");
  mutation = replaceFunction(html, "ghostVisitorFetch", (fn) => fn.replace(/\n}$/, "\n  if(accepted===3 && body.ghosts.length===3) ghostSilhouetteAccept(epoch,'f'.repeat(32),body.ghosts[0].artifact);\n}"));
  await mutationMustFail(assertContract, mutation, "the exact-three oracle kills a fabricated fourth presence");
  mutation = html.replace("GH_SEAT_XS=GH_MULTI?[-90,180,-180]", "GH_SEAT_XS=GH_MULTI?[-90,-180,180]");
  await mutationMustFail(assertContract, mutation, "the position oracle pins the alternating fill order");
  mutation = replaceFunction(html, "ghostSeatUpdate", (fn) => fn.replace("const seatOn=GH_SEAT || (GH_MULTI&&_ghostSeatBusy);", "const seatOn=GH_SEAT || (GH_MULTI&&_ghostSeatBusy&&_ghSeatX===GH_SEAT_XS[0]);"));
  await mutationMustFail(assertContract, mutation, "the share-only oracle kills the old minus-ninety gate");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("    ghostSeatPrepare(record);", ""));
  await mutationMustFail(assertContract, mutation, "the replay-table oracle kills a first-build visitor left unprepared");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("ghostSeatPrepare(record); if(_ghostAvatar)", "ghostSeatPrepare(record); _ghPalette[0].setHex(123456789); if(_ghostAvatar)"));
  await mutationMustFail(assertContract, mutation, "the per-record palette oracle kills a corrupt visitor recolour");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "_ghRoadDeck.setHex(123456789); seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the palette oracle pins every derived visitor road colour");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.id=phase?'':id;", "ghostSeatPalette({date:'2026-08-22',moonBucket:0}); seat.id=phase?'':id;"));
  await mutationMustFail(assertContract, mutation, "the independent palette oracle kills a fixed-seed visitor recolour");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("_ghGiftLockedRow=heldGiftLock;", ""));
  await mutationMustFail(assertContract, mutation, "the live-accept oracle preserves a held Gift lock while visitor replay tables prepare");
  mutation = replaceFunction(html, "ghostShareReset", (fn) => fn.replace("if(_ghActiveTargets) _ghActiveTargets.length=0;", ""));
  await mutationMustFail(assertContract, mutation, "the recycle oracle kills retained visitor replay rows");
  mutation = replaceFunction(html, "ghostShareReset", (fn) => fn.replace("if(_ghGiftProxy) _ghGiftProxy._ghostGiftRow=null;", ""));
  await mutationMustFail(assertContract, mutation, "the recycle oracle kills a Gift proxy retaining an old artifact row");
  mutation = replaceFunction(html, "ghostShareReset", (fn) => fn.replace("if(_ghostAvatar) _ghostAvatar.rotation.set(0,0,0,'YXZ');", ""));
  await mutationMustFail(assertContract, mutation, "the recycle oracle kills a stale full-visitor aim pose");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("const slot=_ghostVisitorCount, heldGiftLock=_ghGiftLockedRow;", "const slot=_ghostVisitorCount, heldGiftLock=_ghGiftLockedRow; if(slot) _ghostVisitorSeats[slot]=null;"));
  await mutationMustFail(assertContract, mutation, "the full refill oracle kills rebuilding later visitor slots");
  mutation = replaceFunction(html, "ghostSilhouettesReset", (fn) => fn.replace("seat.avatar.rotation.set(0,0,0,'YXZ');", ""));
  await mutationMustFail(assertContract, mutation, "the recycle oracle kills a stale silhouette aim pose");
  mutation = replaceFunction(html, "ghostSilhouetteAccept", (fn) => fn.replace("let seat=_ghostSilhouettes[0];", "let seat=null;"));
  await mutationMustFail(assertContract, mutation, "the silhouette refill oracle kills rebuilding its avatar family");
  mutation = replaceFunction(html, "ghostSilhouettesUpdate", (fn) => fn.replace("if(!state.running || templeActive || trainMode)", "if(templeActive || trainMode)"));
  await mutationMustFail(assertContract, mutation, "the lifecycle gate oracle kills a silhouette left visible on pause");
  mutation = replaceFunction(html, "ghostSilhouettesUpdate", (fn) => fn.replace("if(!state.running || templeActive || trainMode)", "if(!state.running || trainMode)"));
  await mutationMustFail(assertContract, mutation, "the lifecycle gate oracle kills a silhouette left visible in the Temple");
  mutation = replaceFunction(html, "ghostSilhouettesUpdate", (fn) => fn.replace("if(!state.running || templeActive || trainMode)", "if(!state.running || templeActive)"));
  await mutationMustFail(assertContract, mutation, "the lifecycle gate oracle kills a silhouette left visible in the trainer");
  mutation = replaceFunction(html, "ghostSilhouettesUpdate", (fn) => fn.replace("v=authority?ghostSeatReveal(authority.uniforms.uNow.value,authority.uniforms.uArchN0.value,authority.uniforms.uK.value):0", "v=authority?1:0"));
  await mutationMustFail(assertContract, mutation, "the staged-reveal oracle kills an always-open silhouette");
  mutation = replaceFunction(html, "ghostSilhouettesUpdate", (fn) => fn.replace(" && seat.record.fires[seat.fireCursor][0]<=t", ""));
  await mutationMustFail(assertContract, mutation, "the two-time replay oracle kills future silhouette bows fired early");
  mutation = replaceFunction(html, "ghostSilhouetteBuild", (fn) => fn.replace("new THREE.ConeGeometry(0.9,3.2,6)", "new THREE.ConeGeometry(1.4,3.2,6)"));
  await mutationMustFail(assertContract, mutation, "the avatar-parity oracle kills dishonest silhouette geometry");
  mutation = replaceFunction(html, "ghostSilhouetteMaterial", (fn) => fn.replace("depthWrite:false", "depthWrite:true"));
  await mutationMustFail(assertContract, mutation, "the avatar-parity oracle kills dishonest silhouette depth semantics");
  mutation = replaceFunction(html, "ghostSilhouetteAccept", (fn) => fn.replace("seat.id=id;", "seat.avatar.position.x=0; seat.id=id;"));
  await mutationMustFail(assertContract, mutation, "the avatar-parity oracle pins the silhouette to its distant seat");
  mutation = replaceFunction(html, "ghostSilhouettesUpdate", (fn) => fn.replace("seat.body.visible=open;", ""));
  await mutationMustFail(assertContract, mutation, "the staged-reveal oracle kills a silhouette cone left hidden");
  mutation = replaceFunction(html, "ghostSilhouettesUpdate", (fn) => fn.replace("seat.lastTime=t;", "seat.lastTime=t; ghostGiftCatch(seat.record.targets[0],t);"));
  await mutationMustFail(assertContract, mutation, "the ledger oracle kills a silhouette leaking into Gift catches");
});

test("crunch preserves strong-device visitors and replay budgets while geometry follows LOW", async () => {
  const assertContract = async (source) => {
    const records = [1, 2, 3, 4].map((moonBucket) => artifact({
      moonBucket,
      targets: Array.from({ length: 30 }, (_unused, index) => [0, index % 4, index, 10, index === 0 ? 1 : 0, index === 0 ? 5 : null]),
    }));
    for (const low of [true, false]) for (const weak of [false, true]) {
      const THREE = threeHarness();
      const context = runVisitor(source, {
        seat: true, share: true, low, weak,
        extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
        body: `
          const own=${JSON.stringify(artifact())}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=63;
          const records=${JSON.stringify(records)}, rows=records.map((record,index)=>({id:String(index+1).repeat(32),artifact:record})); let request='';
          ghostRelayJson=path=>{ request=path; return Promise.resolve({ghosts:rows}); };
          this.inspect=async()=>{
            await ghostVisitorFetch(63,'f'.repeat(32),12);
            const seat=_ghostVisitorSeats[0]; ghostSeatInstall(seat); ghostSeatAdvance(5);
            return {request,visitors:_ghostVisitorCount,silhouettes:_ghostSilhouettes?_ghostSilhouettes.filter(value=>value.record).length:0,xs:_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(value=>value.x),wall:!!seat.walls,halo:seat.avatarHalo.geometry.args.slice(1),targetMax:seat.targets.max,activeTargets:_ghActiveTargets.length,burstMax:seat.bursts?seat.bursts.max:0,burstPool:_ghBurstPool?_ghBurstPool.length:0,burstOn:_ghBurstPool?_ghBurstPool.filter(value=>value.on).length:0};
          };
        `,
      });
      assert.deepEqual(JSON.parse(JSON.stringify(await context.inspect())), {
        request: `/api/ghosts?lon=12&n=${weak ? 1 : 4}`, visitors: weak ? 1 : 3, silhouettes: weak ? 0 : 1,
        xs: weak ? [-90] : [-90, 180, -180], wall: !low, halo: low ? [6, 4] : [10, 8],
        targetMax: weak ? 24 : 48, activeTargets: weak ? 24 : 30,
        burstMax: weak ? 0 : 24, burstPool: weak ? 0 : 24, burstOn: weak ? 0 : 3,
      }, `social and replay limits follow WEAK:${+weak}; drawn geometry follows LOW:${+low}`);
    }
  };
  await assertContract(html);
  await mutationMustFail(assertContract, html.replace("GH_VISITOR_COUNT=WEAK?1:3", "GH_VISITOR_COUNT=LOW?1:3"), "the independent tier matrix catches visitors coupled to render quality");
  await mutationMustFail(assertContract, replaceFunction(html, "ghostSilhouetteAccept", (fn) => fn.replace("|| WEAK ||", "|| LOW ||")), "strong crunch retains the fourth honest presence");
  await mutationMustFail(assertContract, replaceFunction(html, "ghostSeatBuild", (fn) => fn.replace("if(!WEAK){", "if(!LOW){")), "the replay test catches a nonzero burst cap without its pool");
});

test("a strong crunch visitor retries completely after its final burst material fails", async () => {
  const assertContract = (source) => {
    const THREE = threeHarness();
    const context = runVisitor(source, {
      seat: true, share: true, low: true, weak: false,
      extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
      body: `
        const own=${JSON.stringify(artifact())}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=64;
        const ownRoot=_ghostSeatRoot, LiveShaderMaterial=THREE.ShaderMaterial, visitor=${JSON.stringify(artifact({ moonBucket: 7 }))}; let materialCalls=0;
        THREE.ShaderMaterial=function(options){ if(++materialCalls===7) throw new Error('last burst material failed'); return new LiveShaderMaterial(options); };
        const first=ghostVisitorAccept(64,'e'.repeat(32),visitor), restored=_ghostSeatRoot===ownRoot&&_ghostVisitorCount===0; THREE.ShaderMaterial=LiveShaderMaterial;
        const retried=ghostVisitorAccept(64,'e'.repeat(32),visitor), seat=_ghostVisitorSeats[0];
        this.result={first,restored,retried,wall:!!seat.walls,bursts:seat.bursts?seat.bursts.max:0,pool:seat.burstPool?seat.burstPool.length:0,ownRestored:_ghostSeatRoot===ownRoot};
      `,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(context.result)), { first: false, restored: true, retried: true, wall: false, bursts: 24, pool: 24, ownRestored: true });
  };
  assertContract(html);
  await mutationMustFail(assertContract, replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("(LOW||_ghostWalls)&&(WEAK||_ghostBursts)", "LOW||(_ghostWalls&&_ghostBursts)")), "the failure path independently requires strong-device bursts and HIGH walls");
});

function visitorAlphaSnapshot(source, alpha, low) {
  const tuned = source.replace("const GH_VISITOR_ALPHA=1.0;", `const GH_VISITOR_ALPHA=${alpha};`);
  assert.notEqual(tuned, source, `visitor alpha ${alpha} is constructible`);
  const THREE = threeHarness();
  const records = [1, 2, 3, 4].map((moonBucket) => artifact({ moonBucket }));
  const context = runVisitor(tuned, {
    seat: true, gift: true, share: true, low,
    extra: {
      THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(),
      roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } },
    },
    body: `
      const records=${JSON.stringify(records)}, ids=['a','b','c','d'].map(value=>value.repeat(32));
      const scalar=mesh=>Number(mesh.material.fragmentShader.match(/float a=([0-9.]+)\\*uVis/)[1]);
      const road=mesh=>mesh.material.fragmentShader.match(/float a=mix\\(([0-9.]+),([0-9.]+)/).slice(1).map(Number);
      const shape=seat=>({road:road(seat.road),wall:seat.walls?scalar(seat.walls):null,target:scalar(seat.targets),body:scalar(seat.avatarBody),halo:scalar(seat.avatarHalo),bow:scalar(seat.avatarBow),beacon:scalar(seat.beaconCols),burst:seat.bursts?scalar(seat.bursts):null});
      const silhouetteShape=seat=>seat?{body:scalar(seat.body),halo:scalar(seat.halo),bow:scalar(seat.bow)}:null;
      const own=records[0]; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=41;
      for(let i=0;i<GH_VISITOR_COUNT;i++) ghostVisitorAccept(41,ids[i],records[i+1]);
      if(!LOW) ghostSilhouetteAccept(41,ids[3],records[3]);
      const beforeMaterials=_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(seat=>[seat.road.material,seat.walls&&seat.walls.material,seat.targets.material,seat.avatarBody.material,seat.avatarHalo.material,seat.avatarBow.material,seat.beaconCols.material,seat.bursts&&seat.bursts.material]);
      const beforeShapes=_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(shape), beforeSilhouette=_ghostSilhouettes&&_ghostSilhouettes[0]?silhouetteShape(_ghostSilhouettes[0]):null;
      ghostSeatInstall(_ghostVisitorSeats[0]); const visitorInstall=_ghSeatAlpha;
      ghostSeatInstall(_ghostOwnSeat); const ownInstall=_ghSeatAlpha;
      ghostSeatInstall(_ghostVisitorSeats[_ghostVisitorCount-1]); const lastVisitorInstall=_ghSeatAlpha;
      ghostSeatClear(999); const clearAlpha=_ghSeatAlpha; ghostSeatInstall(_ghostOwnSeat);
      const stages=[0,0.02,0.01,1].map(packed=>{ roadWallMat.uniforms.uK.value=[packed]; ghostSeatsUpdate(0.016); return _ghostVisitorSeats.slice(0,_ghostVisitorCount).map(seat=>seat.vis.value); });
      ghostShareReset(); const epoch=_ghostShareEpoch;
      for(let i=0;i<GH_VISITOR_COUNT;i++) ghostVisitorAccept(epoch,ids[i],records[i+1]);
      if(!LOW) ghostSilhouetteAccept(epoch,ids[3],records[3]);
      const afterShapes=_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(shape), afterSilhouette=_ghostSilhouettes&&_ghostSilhouettes[0]?silhouetteShape(_ghostSilhouettes[0]):null;
      const sameMaterials=_ghostVisitorSeats.slice(0,_ghostVisitorCount).every((seat,index)=>[seat.road.material,seat.walls&&seat.walls.material,seat.targets.material,seat.avatarBody.material,seat.avatarHalo.material,seat.avatarBow.material,seat.beaconCols.material,seat.bursts&&seat.bursts.material].every((material,part)=>material===beforeMaterials[index][part]));
      this.alphaSnapshot={own:shape(_ghostOwnSeat),visitors:beforeShapes,silhouette:beforeSilhouette,stages,install:[visitorInstall,ownInstall,lastVisitorInstall,clearAlpha],reused:{sameMaterials,sameShapes:JSON.stringify(beforeShapes)===JSON.stringify(afterShapes),sameSilhouette:JSON.stringify(beforeSilhouette)===JSON.stringify(afterSilhouette)}};
    `,
  });
  return JSON.parse(JSON.stringify(context.alphaSnapshot));
}

function visitorAlphaFailureSnapshot(source, alpha, low, failAt) {
  const tuned = source.replace("const GH_VISITOR_ALPHA=1.0;", `const GH_VISITOR_ALPHA=${alpha};`);
  assert.notEqual(tuned, source, `visitor alpha ${alpha} failure probe is constructible`);
  const THREE = threeHarness(), sceneAdds = [];
  const context = runVisitor(tuned, {
    seat: true, gift: true, share: true, low,
    extra: { THREE, sceneAdds, scene: { add(value) { sceneAdds.push(value); } }, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
    body: `
      const own=${JSON.stringify(artifact({ moonBucket: 0 }))}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=51;
      const ownState=ghostSeatCapture({}), ownAdds=sceneAdds.length, heldLock={slot:99}, LiveShaderMaterial=THREE.ShaderMaterial, visitor=${JSON.stringify(artifact({ moonBucket: 7 }))}; let materialCalls=0; _ghGiftLockedRow=heldLock;
      THREE.ShaderMaterial=function(options){ materialCalls++; if(materialCalls===${failAt}) throw new Error('visitor material failure'); return new LiveShaderMaterial(options); };
      const first=ghostVisitorAccept(51,'e'.repeat(32),visitor); THREE.ShaderMaterial=LiveShaderMaterial;
      const restoredState=ghostSeatCapture({}), exactOwn=Object.keys(ownState).every(key=>Object.is(ownState[key],restoredState[key]));
      const restored={alpha:_ghSeatAlpha,exactOwn,heldLock:_ghGiftLockedRow===heldLock,visitorCount:_ghostVisitorCount,sceneAdds:sceneAdds.length-ownAdds};
      const retried=ghostVisitorAccept(51,'e'.repeat(32),visitor), seat=_ghostVisitorSeats[0];
      const complete=!!(seat&&seat.road&&seat.targets&&seat.avatarBody&&seat.avatarHalo&&seat.avatarBow&&seat.beaconCols&&(LOW?!seat.walls&&!seat.bursts:seat.walls&&seat.bursts));
      this.failureSnapshot={first,restored,retried,complete,visitorAlpha:complete?Number(seat.avatarBody.material.fragmentShader.match(/float a=([0-9.]+)\\*uVis/)[1]):null,finalAlpha:_ghSeatAlpha,sceneAdds:sceneAdds.length-ownAdds};
    `,
  });
  return JSON.parse(JSON.stringify(context.failureSnapshot));
}

test("visitor weight is per-seat, construction-time, and excludes targets, hit/catch birds, and the honest silhouette", async () => {
  const assertContract = (source) => {
    assert.match(ghostBlock(source), /const GH_VISITOR_ALPHA=1\.0;/, "the shipped tuning starts byte-identical at one");
    const ownHigh = { road: [0.12, 0.72], wall: 0.55, target: 0.82, body: 0.62, halo: 0.34, bow: 0.72, beacon: 0.78, burst: 0.7 };
    const ownLow = { ...ownHigh, wall: null, burst: null };
    for (const alpha of [0.8, 0.65]) for (const low of [false, true]) {
      const snapshot = visitorAlphaSnapshot(source, alpha, low);
      const visitor = alpha === 0.8
        ? { road: [0.096, 0.576], wall: 0.44, target: 0.82, body: 0.496, halo: 0.272, bow: 0.576, beacon: 0.624, burst: 0.7 }
        : { road: [0.078, 0.468], wall: 0.3575, target: 0.82, body: 0.403, halo: 0.221, bow: 0.468, beacon: 0.507, burst: 0.7 };
      if (low) { visitor.wall = null; visitor.burst = null; }
      assert.deepEqual(snapshot.own, low ? ownLow : ownHigh, `own seat stays exact at alpha ${alpha} LOW:${+low}`);
      assert.equal(snapshot.visitors.length, low ? 1 : 3);
      for (const weighted of snapshot.visitors) assert.deepEqual(weighted, visitor, `every visitor receives alpha ${alpha} at LOW:${+low}`);
      assert.deepEqual(snapshot.silhouette, low ? null : { body: 0.62, halo: 0.34, bow: 0.72 }, "the fourth real voice remains an honest avatar-only silhouette");
      assert.deepEqual(snapshot.stages, [0, 0.35, 0.7, 1].map(value => Array(low ? 1 : 3).fill(value)), "weight never changes the reveal authority");
      assert.deepEqual(snapshot.install, [alpha, 1, alpha, 1], "semantic seat identity selects the weight and clear restores neutral state");
      assert.deepEqual(snapshot.reused, { sameMaterials: true, sameShapes: true, sameSilhouette: true }, "reset/refill reuses the tuned material family without rebuilding it");
    }
    for (const low of [false, true]) for (const failAt of [1, low ? 6 : 8]) assert.deepEqual(visitorAlphaFailureSnapshot(source, 0.65, low, failAt), {
      first: false, restored: { alpha: 1, exactOwn: true, heldLock: true, visitorCount: 0, sceneAdds: 0 }, retried: true, complete: true, visitorAlpha: 0.403, finalAlpha: 1, sceneAdds: 2,
    }, `an allocation-${failAt} visitor failure restores own state, publishes no orphan, and retries a complete weighted seat at LOW:${+low}`);
  };
  assertContract(html);
  const mutations = [
    [replaceFunction(html, "ghostSeatInstall", (fn) => fn.replace("seat.visitor?GH_VISITOR_ALPHA:1", "seat.visitor?1:GH_VISITOR_ALPHA")), "the semantic identity oracle kills inverted own/visitor weighting"],
    [replaceFunction(html, "ghostSeatClear", (fn) => fn.replace("_ghSeatAlpha=1; ", "")), "the clear oracle kills a leaked visitor construction weight"],
    [replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("ghostSeatCapture({visitor:true})", "ghostSeatCapture({})")), "the first-build oracle kills visitor identity marked after construction"],
    [replaceFunction(html, "ghostRoadMaterial", (fn) => fn.replace("GH_ROAD_RULE_ALPHA*_ghSeatAlpha", "GH_ROAD_RULE_ALPHA")), "the road oracle kills one unweighted rule layer"],
    [replaceFunction(html, "ghostWallMaterial", (fn) => fn.replace("GH_WALL_ALPHA*_ghSeatAlpha", "GH_WALL_ALPHA")), "the wall oracle kills an unweighted HIGH-only layer"],
    [replaceFunction(html, "ghostSeatBuild", (fn) => fn.replace("GH_AVATAR_HALO_ALPHA*_ghSeatAlpha", "GH_AVATAR_HALO_ALPHA")), "the avatar oracle kills one unweighted body-family layer"],
    [replaceFunction(html, "ghostSeatBuild", (fn) => fn.replace("GH_BEACON_ALPHA*_ghSeatAlpha", "GH_BEACON_ALPHA")), "the beacon oracle kills an unweighted always-visible exception"],
    [replaceFunction(html, "ghostSeatBuild", (fn) => fn.replace("GH_TARGET_ALPHA,_ghVis", "GH_TARGET_ALPHA*_ghSeatAlpha,_ghVis")), "the target oracle kills weight leaking into gameplay notes"],
    [replaceFunction(html, "ghostSeatBuild", (fn) => fn.replace("GH_BURST_ALPHA,_ghVis", "GH_BURST_ALPHA*_ghSeatAlpha,_ghVis")), "the burst oracle kills weight leaking into hit birds"],
    [replaceFunction(html, "ghostSilhouetteBuild", (fn) => fn.replace("GH_AVATAR_BODY_ALPHA,visibility", "GH_AVATAR_BODY_ALPHA*GH_VISITOR_ALPHA,visibility")), "the silhouette oracle kills weighting a representation promised to stay honest"],
    [replaceFunction(html, "ghostSeatApplyVisibility", (fn) => fn.replace("_ghVis.value=open?v:0", "_ghVis.value=open?v*_ghSeatAlpha:0")), "the reveal oracle kills a shared-uniform weight that dims targets and bursts"],
    [replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("if(_ghostOwnSeat) ghostSeatInstall(_ghostOwnSeat); }", "}")), "the failure oracle kills a visitor register set left installed over the own seat"],
    [replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("(LOW||_ghostWalls)&&(WEAK||_ghostBursts)", "(LOW||_ghostWalls)")), "the late-failure oracle kills a HIGH seat accepted without its burst family"],
    [replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("if(!complete) ghostSeatClear(seat.x);", "")), "the retry oracle kills an incomplete cached seat that is not cleared"],
    [replaceFunction(html, "ghostSeatBuild", (fn) => fn.replace("  scene.add(_ghostSeatRoot); scene.add(_ghostBeaconRoot);\n", "").replace("_ghostSeatRoot=new THREE.Group(); _ghostBeaconRoot=new THREE.Group();", "_ghostSeatRoot=new THREE.Group(); _ghostBeaconRoot=new THREE.Group(); scene.add(_ghostSeatRoot); scene.add(_ghostBeaconRoot);")), "the publication oracle kills roots attached before construction completes"],
  ];
  for (const [mutation, message] of mutations) await mutationMustFail(assertContract, mutation, message);
});

test("visitor and mail JSON responses are byte-bounded, malformed-safe, and timed through body consumption", async () => {
  const assertContract = async (source) => {
    const large = oversizedArtifact();
    assert.ok(Buffer.byteLength(JSON.stringify(large)) > 100000, "the structurally valid attack artifact exceeds GH_MAX_BYTES");
    const structural = runVisitor(source, { share: true, body: `this.valid=!!ghostArtifactValid(${JSON.stringify(large)});` });
    assert.equal(structural.valid, true, "shape validation alone admits the oversized artifact");

    const guarded = runVisitor(source, {
      share: true,
      body: `
        _ghostShareEpoch=4; let validations=0, accepts=0; const validate=ghostArtifactValid;
        ghostArtifactValid=value=>{ validations++; return validate(value); };
        ghostVisitorAccept=()=>{ accepts++; };
        ghostRelayJson=()=>Promise.resolve({ghosts:[{id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',artifact:${JSON.stringify(large)}}]});
        this.check=async()=>{ await ghostVisitorFetch(4,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',18); return {validations,accepts}; };
      `,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(await guarded.check())), { validations: 0, accepts: 0 }, "serialized bytes are checked before validation and construction");

    const nearLimit = nearLimitArtifact();
    const aggregateEnvelope = { ghosts: ["a", "b", "c", "d"].map((letter) => ({ id: letter.repeat(32), artifact: nearLimit })) };
    const itemBytes = Buffer.byteLength(JSON.stringify(nearLimit)), aggregateBytes = Buffer.byteLength(JSON.stringify(aggregateEnvelope));
    assert.ok(itemBytes < 100000 && aggregateBytes > 100000, "four individually valid records form a response larger than the per-record ceiling");
    const aggregateVisitors = [], aggregateSilhouettes = [];
    const aggregate = runVisitor(source, {
      share: true,
      extra: {
        aggregateVisitors, aggregateSilhouettes, AbortController, TextDecoder,
        fetch: () => Promise.resolve(relayResponse(aggregateEnvelope, { declared: aggregateBytes, chunkSize: 32768 })),
      },
      body: `
        _ghostShareEpoch=6;
        ghostVisitorAccept=(_epoch,id)=>{ aggregateVisitors.push(id); return true; };
        ghostSilhouetteAccept=(_epoch,id)=>{ aggregateSilhouettes.push(id); return true; };
        this.check=async()=>{ await ghostVisitorFetch(6,'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',18); return {visitors:aggregateVisitors.slice(),silhouettes:aggregateSilhouettes.slice()}; };
      `,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(await aggregate.check())), { visitors: ["a".repeat(32), "b".repeat(32), "c".repeat(32)], silhouettes: ["d".repeat(32)] }, "the expanded ghosts envelope reaches three full seats and the fourth silhouette");

    let fetchCount = 0;
    const oversizedFetch = (url) => {
      fetchCount += 1;
      if (url.includes("/api/ghosts")) return Promise.resolve(relayResponse({ ghosts: [{ id: "a".repeat(32), artifact: large }] }, { chunkSize: 32768 }));
      return Promise.resolve(relayResponse({ catches: [], padding: "x".repeat(100000) }, { chunkSize: 32768 }));
    };
    const bounded = runVisitor(source, {
      share: true,
      extra: { fetch: oversizedFetch, AbortController, TextDecoder },
      body: `
        _ghostShareEpoch=5; let accepts=0, schedules=0; ghostVisitorAccept=()=>{ accepts++; }; ghostReturnSchedule=()=>{ schedules++; };
        this.check=async()=>{ await Promise.all([ghostVisitorFetch(5,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',18),ghostMailFetch(5,'cccccccccccccccccccccccccccccccc')]); return {accepts,schedules}; };
      `,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(await bounded.check())), { accepts: 0, schedules: 0 }); assert.equal(fetchCount, 2);

    const malformed = runVisitor(source, {
      share: true,
      extra: { fetch: () => Promise.resolve(relayResponse("{")), AbortController, TextDecoder },
      body: `this.check=()=>Promise.all([ghostRelayJson('/api/ghosts?lon=18&n=1',{}),ghostRelayJson('/api/ghost-mail',{})]);`,
    });
    assert.deepEqual(Array.from(await malformed.check()), [null, null], "malformed JSON fails closed on both GET endpoints");

    const declaredReads = { count: 0 }, streamedReads = { count: 0 }, responses = [
      relayResponse({}, { declared: 100001, reads: declaredReads }),
      relayResponse(`${" ".repeat(100001)}{}`, { declared: 2, chunkSize: 60000, reads: streamedReads }),
    ];
    const lengths = runVisitor(source, {
      share: true,
      extra: { fetch: () => Promise.resolve(responses.shift()), AbortController, TextDecoder },
      body: `this.check=()=>Promise.all([ghostRelayJson('/api/ghosts?lon=18&n=1',{}),ghostRelayJson('/api/ghost-mail',{})]);`,
    });
    assert.deepEqual(Array.from(await lengths.check()), [null, null], "declared and actual streamed bytes are independently bounded");
    assert.equal(declaredReads.count, 0, "an oversized declaration is rejected before body consumption");
    assert.ok(streamedReads.count >= 2, "an understated declaration cannot hide an oversized stream");

    const timers = []; let requestSignal = null;
    const stalled = runVisitor(source, {
      share: true,
      extra: {
        AbortController, TextDecoder,
        fetch(_url, init) { requestSignal = init.signal; return Promise.resolve(relayResponse("{}", { stall: true })); },
        setTimeout(callback, ms) { const entry = { callback, ms, active: true }; timers.push(entry); return entry; },
        clearTimeout(entry) { if (entry) entry.active = false; },
      },
      body: `this.pending=ghostRelayJson('/api/ghosts?lon=18&n=1',{});`,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(timers.length, 1); assert.equal(timers[0].ms, 4000); assert.equal(timers[0].active, true, "the abort timer remains armed after headers");
    timers[0].callback();
    assert.equal(await stalled.pending, null); assert.equal(requestSignal.aborted, true, "a stalled body is aborted and the caller settles");
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostVisitorFetch", (fn) => fn.replace(" || ghostSerializedBytes(item.artifact)>GH_MAX_BYTES", ""));
  await mutationMustFail(assertContract, mutation, "the oversized artifact cannot reach shape validation or visitor acceptance");
  mutation = html.replace("GH_MAX_BYTES*GH_VISITOR_FETCH_COUNT+4096", "GH_MAX_BYTES");
  await mutationMustFail(assertContract, mutation, "the four-record stream kills a singleton-sized aggregate response cap");
  mutation = replaceFunction(html, "ghostVisitorFetch", (fn) => fn.replace(",GH_GHOSTS_RESPONSE_MAX", ""));
  await mutationMustFail(assertContract, mutation, "the four-record stream pins the expanded cap to the ghosts endpoint only");
  mutation = replaceFunction(html, "ghostRelayJson", (fn) => fn.replace(" || bytes>limit) return null;", ") return null;"));
  await mutationMustFail(assertContract, mutation, "the declared-length ceiling is mutation-pinned");
  mutation = replaceFunction(html, "ghostRelayJson", (fn) => fn.replace("bytes+=part.value.byteLength; if(bytes>limit)", "bytes+=part.value.byteLength; if(false)"));
  await mutationMustFail(assertContract, mutation, "the streamed-length ceiling is mutation-pinned");
  mutation = replaceFunction(html, "ghostRelayJson", (fn) => fn.replace("const value=JSON.parse(text);", "let value={}; try{ value=JSON.parse(text); }catch(e){}"));
  await mutationMustFail(assertContract, mutation, "the malformed-body oracle kills a parse fallback envelope");
  mutation = replaceFunction(html, "ghostRelayFetch", (fn) => fn.replace("); return typeof consume==='function'?", "); clearTimeout(timer); return typeof consume==='function'?"));
  await mutationMustFail(assertContract, mutation, "the stalled-body oracle kills a timer cleared when headers arrive");
});

function multiSeatRouteSnapshot(source, direction) {
  const THREE = threeHarness();
  const body = `
    const targets=[], projectiles=[], projectilePool=[], _scAim=new THREE.Vector3(), _scTo=new THREE.Vector3(), _prev=new THREE.Vector3();
    let windX=0, windZ=0, retired=0;
    function retireProjectile(index){ projectiles.splice(index,1); retired++; }
    function onWhiff(){}
    ${extractFunction(source, "scopeLockTarget")}
    ${extractFunction(source, "updateProjectiles")}
    const ownRow=[0,1,101,10,0,null], visitorRow=[0,2,202,10,0,null];
    const own=${JSON.stringify(artifact({ targets: [[0, 1, 101, 10, 0, null]] }))}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghActiveTargets.push(own.targets[0]); _ghostGiftMail=[];
    _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); ghostSeatRememberRows(_ghostOwnSeat); _ghostShareEpoch=7;
    const visitor=${JSON.stringify(artifact({ moonBucket: 6, targets: [[0, 2, 202, 10, 0, null]] }))}; ghostVisitorAccept(7,'cccccccccccccccccccccccccccccccc',visitor);
    ghostSeatInstall(_ghostVisitorSeats[0]); _ghActiveTargets.push(visitor.targets[0]); ghostSeatCapture(_ghostVisitorSeats[0]); ghostSeatInstall(_ghostOwnSeat);
    PLAYER_POS.z=200; Tone.Transport.seconds=7.5;
    const intended=${JSON.stringify(direction)}==='own'?own.targets[0]:visitor.targets[0], intendedSeat=${JSON.stringify(direction)}==='own'?_ghostOwnSeat:_ghostVisitorSeats[0];
    const intendedPosition=new THREE.Vector3(); ghostSeatInstall(intendedSeat); ghostTargetPosition(intended,7.5,intendedPosition); ghostSeatInstall(_ghostOwnSeat);
    const dx=intendedPosition.x-PLAYER_POS.x, dy=intendedPosition.y-PLAYER_POS.y, dz=intendedPosition.z-PLAYER_POS.z, distance=Math.hypot(dx,dy,dz), aim={x:dx/distance,y:dy/distance,z:dz/distance};
    const camera={getWorldDirection(out){ return out.copy(aim); }};
    const realPosition=new THREE.Vector3(PLAYER_POS.x+aim.x*20-aim.z*15,PLAYER_POS.y+aim.y*20,PLAYER_POS.z+aim.z*20+aim.x*15);
    const real={dead:false,kind:0,radius:1,sc:1,mesh:{position:realPosition}}; targets.push(real);
    const realPick=scopeLockTarget(); real.dead=true; const giftPick=scopeLockTarget();
    const selectedRow=giftPick&&giftPick._ghostGiftRow, pr={gift:true,giftRow:selectedRow,giftRoadT:7.5,pos:new THREE.Vector3().copy(giftPick.mesh.position),vel:new THREE.Vector3().copy(giftPick.vel),life:0,mesh:{position:new THREE.Vector3()},fireRow:null};
    projectiles.push(pr); Tone.Transport.seconds=7.6; updateProjectiles(0.1);
    this.snapshot={realWon:realPick===real,selected:selectedRow&&selectedRow[2],retired,ownMail:_ghostOwnSeat.mail.map(row=>row.slice()),visitorMail:_ghostVisitorSeats[0].mail.map(row=>row.slice())};
  `;
  const context = runVisitor(source, {
    seat: true, gift: true, share: true,
    extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(), roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } } },
    body,
  });
  return JSON.parse(JSON.stringify(context.snapshot));
}

function thirdVisitorGiftSnapshot(source) {
  const THREE = threeHarness();
  const context = runVisitor(source, {
    seat: true, gift: true, share: true,
    extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(), roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } } },
    body: `
      const own=${JSON.stringify(artifact())}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=17;
      const records=[
        ${JSON.stringify(artifact({ moonBucket: 1, targets: [[0, 0, 201, 10, 0, null]] }))},
        ${JSON.stringify(artifact({ moonBucket: 2, targets: [[0, 1, 302, 10, 0, null]] }))},
        ${JSON.stringify(artifact({ moonBucket: 3, targets: [[0, 2, 403, 10, 0, null]] }))}
      ];
      const ids=['a','b','c'].map(letter=>letter.repeat(32));
      for(let i=0;i<records.length;i++){
        ghostVisitorAccept(17,ids[i],records[i]); const seat=_ghostVisitorSeats[i]; ghostSeatInstall(seat); _ghActiveTargets.push(records[i].targets[0]); ghostSeatCapture(seat);
      }
      ghostSeatInstall(_ghostOwnSeat); Tone.Transport.seconds=8;
      const row=records[2].targets[0], position=new THREE.Vector3(); ghostSeatInstall(_ghostVisitorSeats[2]); ghostTargetPosition(row,8,position); ghostSeatInstall(_ghostOwnSeat);
      const dx=position.x-PLAYER_POS.x,dy=position.y-PLAYER_POS.y,dz=position.z-PLAYER_POS.z,d=Math.hypot(dx,dy,dz),aim={x:dx/d,y:dy/d,z:dz/d};
      const proxy=ghostGiftLockSeats(aim,0.72), selected=proxy&&proxy._ghostGiftRow; this.caught=!!selected&&ghostGiftCatch(selected,8);
      this.snapshot={selected:selected&&selected[2],mails:_ghostVisitorSeats.map(seat=>seat.mail.map(item=>item.slice()))};
    `,
  });
  return JSON.parse(JSON.stringify({ ...context.snapshot, caught: context.caught }));
}

test("Gift locking scans both seats, visitor catches stay in its ledger, and one mail batch leaves at Bow end", async () => {
  const assertContract = async (source) => {
    assert.deepEqual(multiSeatRouteSnapshot(source, "own"), { realWon: true, selected: 101, retired: 1, ownMail: [[7.6, 1]], visitorMail: [] });
    assert.deepEqual(multiSeatRouteSnapshot(source, "visitor"), { realWon: true, selected: 202, retired: 1, ownMail: [], visitorMail: [[7.6, 2]] });
    assert.deepEqual(thirdVisitorGiftSnapshot(source), { selected: 403, mails: [[], [], [[8, 2]]], caught: true }, "Gift arbitration reaches the third full visitor and writes only its ledger");
    assert.doesNotMatch(extractFunction(source, "ghostGiftLockSeats"), /_ghostSilhouettes/, "the avatar-only silhouette cannot enter Gift routing");
    const THREE = threeHarness();
    const ownRow = [0, 1, 1, 10, 0, null], visitorRow = [0, 1, 2, 10, 0, null], sends = [];
    const context = runVisitor(source, {
      seat: true, gift: true, share: true,
      extra: {
        THREE, sends, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(),
        roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } },
      },
      body: `
        const own=${JSON.stringify(artifact({ targets: [ownRow] }))}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghActiveTargets.push(own.targets[0]); _ghostGiftMail=[];
        _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); ghostSeatRememberRows(_ghostOwnSeat); _ghostShareEpoch=4;
        const visitor=${JSON.stringify(artifact({ moonBucket: 6, targets: [visitorRow] }))}; ghostVisitorAccept(4,'cccccccccccccccccccccccccccccccc',visitor);
        ghostSeatInstall(_ghostVisitorSeats[0]); _ghActiveTargets.push(visitor.targets[0]); ghostSeatCapture(_ghostVisitorSeats[0]); ghostSeatInstall(_ghostOwnSeat);
        Tone.Transport.seconds=8; const p=new THREE.Vector3(); ghostSeatInstall(_ghostVisitorSeats[0]); ghostTargetPosition(visitor.targets[0],8,p); ghostSeatInstall(_ghostOwnSeat);
        const dx=p.x-PLAYER_POS.x,dy=p.y-PLAYER_POS.y,dz=p.z-PLAYER_POS.z,d=Math.hypot(dx,dy,dz),aim={x:dx/d,y:dy/d,z:dz/d};
        const proxy=ghostGiftLockTarget(aim,0.72); this.selected=proxy&&proxy._ghostGiftRow[2]; this.proxyX=proxy&&proxy.mesh.position.x;
        this.caught=ghostGiftCatch(visitor.targets[0],8); this.ownMail=_ghostOwnSeat.mail.slice(); this.visitorMail=_ghostVisitorSeats[0].mail.slice();
        _ghostToken='dddddddddddddddddddddddddddddddd'; ghostMailAttempt=(token,toId,catches)=>{ sends.push({token,toId,catches:catches.map(row=>row.slice())}); return Promise.resolve(true); };
        ghostShareFinalize(); ghostShareFinalize(); this.sends=sends;
      `,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(context.selected, 2); assert.ok(context.proxyX < 0); assert.equal(context.caught, true);
    assert.deepEqual(Array.from(context.ownMail), []); assert.deepEqual(Array.from(context.visitorMail, (row) => Array.from(row)), [[8, 1]]);
    assert.deepEqual(Array.from(context.sends, (send) => ({ token: send.token, toId: send.toId, catches: Array.from(send.catches, (row) => Array.from(row)) })), [{ token: "d".repeat(32), toId: "c".repeat(32), catches: [[8, 1]] }]);

    const chorusSends = [];
    const chorus = runVisitor(source, {
      seat: true, gift: true, share: true,
      extra: { THREE, chorusSends, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
      body: `
        const own=${JSON.stringify(artifact())}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=12;
        ghostVisitorAccept(12,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',${JSON.stringify(artifact({ moonBucket: 1 }))}); ghostVisitorAccept(12,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',${JSON.stringify(artifact({ moonBucket: 2 }))}); ghostVisitorAccept(12,'cccccccccccccccccccccccccccccccc',${JSON.stringify(artifact({ moonBucket: 3 }))});
        _ghostVisitorSeats[0].mail=[[7,0]]; _ghostVisitorSeats[1].mail=[]; _ghostVisitorSeats[2].mail=[[9,2]]; _ghostToken='dddddddddddddddddddddddddddddddd';
        ghostMailAttempt=(token,toId,catches)=>{ chorusSends.push({token,toId,catches:catches.map(row=>row.slice())}); return toId[0]==='c'?Promise.reject(new Error('one quiet failure')):Promise.resolve(true); };
        ghostShareFinalize(); ghostShareFinalize(); this.sends=chorusSends;
      `,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(Array.from(chorus.sends, (send) => ({ token: send.token, toId: send.toId, catches: Array.from(send.catches, (row) => Array.from(row)) })), [
      { token: "d".repeat(32), toId: "a".repeat(32), catches: [[7, 0]] },
      { token: "d".repeat(32), toId: "c".repeat(32), catches: [[9, 2]] },
    ], "each non-empty full-visitor ledger gets one independent attempt even when a sibling rejects");
    const requests = [];
    const wire = runVisitor(source, {
      share: true, extra: { requests },
      body: `
        ghostRelayFetch=(path,init)=>{ requests.push({path,init}); return Promise.resolve({ok:true}); };
        this.requests=requests; this.sent=ghostMailAttempt('dddddddddddddddddddddddddddddddd','cccccccccccccccccccccccccccccccc',[[8,1]]);
      `,
    });
    assert.equal(await wire.sent, true); assert.equal(wire.requests.length, 1); assert.equal(wire.requests[0].path, "/api/ghost-mail"); assert.equal(wire.requests[0].init.method, "POST");
    assert.deepEqual(JSON.parse(JSON.stringify(wire.requests[0].init.headers)), { "X-Ghost-Token": "d".repeat(32), "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(wire.requests[0].init.body), { toId: "c".repeat(32), catches: [[8, 1]] });
    const reset = extractFunction(source, "ghostShareReset");
    assert.equal((reset.match(/ghostVisitorFetch\(epoch,token,bucket\)/g) || []).length, 1); assert.equal((reset.match(/ghostMailFetch\(epoch,token\)/g) || []).length, 1);
    assert.match(extractFunction(source, "scopeLockTarget"), /if\(best \|\| tight \|\| !GH_GIFT\) return best/);
    assert.match(extractFunction(source, "bowFinish"), /if\(GH_SHARE\) ghostShareFinalize\(\);/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostGiftLockTarget", (fn) => fn.replace("  if(GH_MULTI && !_ghostSeatBusy) return ghostGiftLockSeats(aim,minDot);\n", ""));
  await mutationMustFail(assertContract, mutation, "the two-seat oracle kills an own-seat-only Gift scan");
  mutation = replaceFunction(html, "scopeLockTarget", (fn) => fn.replace("if(best || tight || !GH_GIFT) return best;", "if(tight || !GH_GIFT) return best;"));
  await mutationMustFail(assertContract, mutation, "the real arbitration route kills charity outranking a live target");
  mutation = replaceFunction(html, "ghostGiftLockSeats", (fn) => fn.replace("if(dot>bestDot){", "if(dot>bestDot || seat.visitor){"));
  await mutationMustFail(assertContract, mutation, "both aim directions kill an always-prefer-visitor seat mutant");
  mutation = replaceFunction(html, "ghostGiftLockSeats", (fn) => fn.replace("for(const seat of _ghostSeats){", "for(const seat of _ghostSeats.slice(0,2)){"));
  await mutationMustFail(assertContract, mutation, "the third-seat Gift oracle kills a two-seat scan cap");
  mutation = replaceFunction(html, "ghostGiftLockSeats", (fn) => fn.replace("  let best=null", "  _ghostSeats=_ghostSeats.concat(_ghostSilhouettes||[]);\n  let best=null"));
  await mutationMustFail(assertContract, mutation, "the Gift-source oracle kills a silhouette routing leak");
  mutation = replaceFunction(html, "ghostShareFinalize", (fn) => fn.replace("for(const item of pending)", "for(const item of pending.slice(0,1))"));
  await mutationMustFail(assertContract, mutation, "the chorus ledger oracle kills a first-visitor-only finalize mutant");
  mutation = replaceFunction(html, "ghostShareFinalize", (fn) => fn.replace("Array.isArray(catches)&&catches.length", "Array.isArray(catches)"));
  await mutationMustFail(assertContract, mutation, "the mixed-ledger oracle kills an empty mail POST");
});

test("threshold copy is EN+JA and keeps comeback then mail then visitor then phase then deal precedence", async () => {
  const assertContract = (source) => {
    const context = runVisitor(source, {
      gift: true, share: true,
      body: `
        _ghostReturnCount=3; _ghostReturnSig=1; _ghostReturnSpoken=false; _ghostGiftGreetingCount=2; _ghostGiftMailSpoken=false;
        _ghostVisitorSeats=[{record:${JSON.stringify(artifact({ moonBucket: 7 }))},sig:7,spoken:false}]; _ghostVisitorCount=1;
        this.lines=[ghostGiftMailLine(),ghostGiftMailLine(),ghostVisitorLine(),ghostVisitorLine()];
      `,
    });
    assert.deepEqual(Array.from(context.lines), ["3 of your notes were caught · 🌒", "", "a visitor rides tonight · 🌘", ""]);
    const plural = runVisitor(source, {
      share: true,
      extra: { TF: (_key, english, values = {}) => english.replace(/\{(\w+)\}/g, (_match, key) => String(values[key])) },
      body: `
        _ghostVisitorSeats=[
          {record:${JSON.stringify(artifact({ moonBucket: 0 }))},sig:0,spoken:false},
          {record:${JSON.stringify(artifact({ moonBucket: 3 }))},sig:3,spoken:false},
          {record:${JSON.stringify(artifact({ moonBucket: 7 }))},sig:7,spoken:false}
        ]; _ghostVisitorCount=3; this.lines=[ghostVisitorLine(),ghostVisitorLine()]; this.spoken=_ghostVisitorSeats.map(seat=>seat.spoken);
      `,
    });
    assert.deepEqual(Array.from(plural.lines), ["3 visitors ride tonight · 🌑 🌔 🌘", ""]); assert.deepEqual(Array.from(plural.spoken), [true, true, true]);
    const pair = runVisitor(source, {
      share: true,
      extra: { TF: (_key, english, values = {}) => english.replace(/\{(\w+)\}/g, (_match, key) => String(values[key])) },
      body: `
        _ghostVisitorSeats=[
          {record:${JSON.stringify(artifact({ moonBucket: 0 }))},sig:0,spoken:false},
          {record:${JSON.stringify(artifact({ moonBucket: 7 }))},sig:7,spoken:false}
        ]; _ghostVisitorCount=2; this.lines=[ghostVisitorLine(),ghostVisitorLine()];
      `,
    });
    assert.deepEqual(Array.from(pair.lines), ["2 visitors ride tonight · \u{1F311}\u2009\u{1F318}", ""], "two visitors take the plural branch and preserve the sigil order");
    const reachedBack = runVisitor(source, {
      share: true,
      extra: { TF: (_key, english, values = {}) => english.replace(/\{(\w+)\}/g, (_match, key) => String(values[key])) },
      body: `
        _ghostVisitorSeats=[
          {record:${JSON.stringify(artifact({ moonBucket: 0 }))},sig:0,spoken:false,back:false},
          {record:${JSON.stringify(artifact({ moonBucket: 7 }))},sig:7,spoken:false,back:true},
          {record:${JSON.stringify(artifact({ moonBucket: 3 }))},sig:3,spoken:false,back:false}
        ]; _ghostVisitorCount=3; this.lines=[ghostVisitorLine(),ghostVisitorLine()];
      `,
    });
    assert.deepEqual(Array.from(reachedBack.lines), ["3 visitors ride tonight · \u{1F318}\u2009\u{1F311}\u2009\u{1F314}", ""], "a chorus stays plural and leads with the reached-back sigil");
    assert.match(source, /ghostVisitorMail:'きみの音を \{n\}こ だれかが つかまえた · \{sigil\}'/);
    assert.match(source, /ghostVisitorBack:'手をのばしてくれた旅人が今夜ならぶ · \{sigil\}'/);
    assert.match(source, /ghostVisitorLine:'今夜 たびびとが となりを走る · \{sigil\}'/);
    assert.match(source, /ghostVisitorsLine:'\{n\}人の旅人が今夜ならぶ · \{sigils\}'/);
    assert.ok(source.includes("ghostPhaseLine:'このまえの{sigil}の夜がとなりを走る'"), "the phase threshold has its exact Japanese line");
    const flash = extractFunction(source, "flashTheme");
    assert.match(flash, /const vm=rl\?'':\(GH_SHARE\?ghostVisitorMailLine\(\):''\);/);
    assert.match(flash, /const vl=rl\|\|vm\|\|ml\?'':\(GH_SHARE\?ghostVisitorLine\(\):''\);/);
    assert.match(flash, /const pl=rl\|\|vm\|\|ml\|\|vl\?'':\(GH_PHASE\?ghostPhaseLine\(\):''\);/);
    assert.match(flash, /setText\(f, vm\|\|vl\|\|pl\|\|base\);/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "flashTheme", (fn) => fn.replace("setText(f, vm||vl||pl||base);", "setText(f, vl||vm||pl||base);"));
  await mutationMustFail(assertContract, mutation, "the threshold oracle kills visitor-over-mail precedence");
  mutation = replaceFunction(html, "ghostVisitorLine", (fn) => fn.replace("sigils.join('\\u2009')", "sigils.join(' ')"));
  await mutationMustFail(assertContract, mutation, "the plural-copy oracle pins the thin-space sigil chorus");
  mutation = replaceFunction(html, "ghostVisitorLine", (fn) => fn.replace("if(seats.length===1) return TF('ghostVisitorLine'", "if(seats.length<=2) return TF('ghostVisitorLine'"));
  await mutationMustFail(assertContract, mutation, "the two-visitor copy oracle kills a singular branch widened to pairs");
  mutation = replaceFunction(html, "ghostVisitorLine", (fn) => fn.replace("if(reachedBack>0)", "if(reachedBack<0)"));
  await mutationMustFail(assertContract, mutation, "the chorus-copy oracle kills a reached-back sigil left out of first place");
});

test("reachedBack is strict relay metadata stored only for the visitor threshold line", async () => {
  const assertContract = async (source) => {
    const fetchOne = async (field) => {
      const item = { id: "b".repeat(32), artifact: artifact({ moonBucket: 7 }) };
      if(field !== undefined) item.reachedBack = field;
      const THREE = threeHarness();
      const context = runVisitor(source, {
        seat: true, share: true,
        extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
        body: `
          _ghostShareEpoch=4; _ghostSeatRows=new WeakMap(); ghostRelayJson=()=>Promise.resolve(${JSON.stringify({ ghosts: [item] })});
          this.read=async()=>{ await ghostVisitorFetch(4,'${"a".repeat(32)}',12); const seat=_ghostVisitorSeats[0]; return {back:seat.back,line:ghostVisitorLine()}; };
        `,
      });
      return JSON.parse(JSON.stringify(await context.read()));
    };
    assert.deepEqual(await fetchOne(undefined), { back: false, line: "a visitor rides tonight · 🌘" }, "an old relay stays byte-identical");
    assert.deepEqual(await fetchOne(true), { back: true, line: "a visitor who reached back rides tonight · 🌘" });
    assert.deepEqual(await fetchOne("true"), { back: false, line: "a visitor rides tonight · 🌘" });
    assert.deepEqual(await fetchOne(1), { back: false, line: "a visitor rides tonight · 🌘" });
    const allowed = ["ghostVisitorFetch", "ghostVisitorAccept", "ghostVisitorLine"];
    let outside = ghostBlock(source);
    for(const name of allowed) outside = outside.replace(extractFunction(source, name), "");
    assert.doesNotMatch(outside, /reachedBack/, "relay reply metadata has no gameplay, grading, spawn, or RNG reader");
    const paths = allowed.map((name) => extractFunction(source, name)).join("\n");
    assert.doesNotMatch(paths, /\brnd\s*\(|Math\.random\s*\(/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostVisitorFetch", (fn) => fn.replace("typeof item.reachedBack==='boolean'?item.reachedBack:false", "!!item.reachedBack"));
  await mutationMustFail(assertContract, mutation, "the strict-type oracle kills truthy relay metadata");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("seat.back=!phase&&reachedBack===true;", "seat.back=false;"));
  await mutationMustFail(assertContract, mutation, "the seat-bag oracle kills a dropped reached-back bit");
  mutation = replaceFunction(html, "ghostVisitorLine", (fn) => fn.replace("seat.back===true", "false"));
  await mutationMustFail(assertContract, mutation, "the threshold oracle kills a stored bit that is never spoken");
});

test("the dormant moon-phase seat follows strangers, skips tonight, and keeps Gifts in the self ledger", async () => {
  const assertContract = async (source) => {
    assert.match(source, /ghostPhase:0,\s+\/\/ THE MOON REMEMBERS YOU/);
    const topology = async ({ share = false, low = false, seat = true, strangerCount = 0, sameDate = false } = {}) => {
      const THREE = threeHarness(), own = artifact({ moonBucket: 2 }), remembered = artifact({ moonBucket: 4 });
      remembered.date = sameDate ? own.date : "2026-07-03";
      const visitors = Array.from({ length: strangerCount }, (_unused, index) => ({ id: String(index + 1).repeat(32), record: artifact({ moonBucket: index }) }));
      let writes = 0;
      const context = runVisitor(source, {
        seat, share, phase: true, low,
        extra: {
          THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(),
          localStorage: {
            getItem(key) { if(key === "aimdojo.ghost") return JSON.stringify(own); if(key === "aimdojo.ghostPhase") return JSON.stringify({ v: 1, slots: { 4: remembered } }); return null; },
            setItem() { writes += 1; },
          },
        },
        body: `
          _ghostToken='${"a".repeat(32)}';
          const visitors=${JSON.stringify(visitors)};
          ghostVisitorFetch=async epoch=>{ for(const visitor of visitors) ghostVisitorAccept(epoch,visitor.id,visitor.record,false,false); };
          ghostMailFetch=async()=>{};
          this.done=new Promise(resolve=>{ const live=ghostPhaseAccept; ghostPhaseAccept=epoch=>{ const accepted=live(epoch); resolve(accepted); return accepted; }; ghostSessionStart(); });
          this.snapshot=()=>{ const rows=_ghostVisitorSeats?_ghostVisitorSeats.slice(0,_ghostVisitorCount).map(item=>({x:item.x,id:item.id,phase:item.phase===true,date:item.record.date})):[]; return {rows,all:_ghostSeats?_ghostSeats.map(item=>item.x):[],visitor:ghostVisitorLine(),phase:ghostPhaseLine(),phaseAgain:ghostPhaseLine()}; };
        `,
      });
      await context.done;
      const snapshot=JSON.parse(JSON.stringify(context.snapshot())); snapshot.writes=writes; return snapshot;
    };
    const local = await topology();
    assert.deepEqual(local, { rows: [{ x: -90, id: "", phase: true, date: "2026-07-03" }], all: [90, -90], visitor: "", phase: "the last 🌕 night rides with you", phaseAgain: "", writes: 0 }, "without the relay, the matching moon takes the first visitor seat and speaks once");
    const phaseOnly = await topology({ seat: false });
    assert.deepEqual(phaseOnly.all, [-90], "the phase knob owns its local visitor seat even when the older +90 seat is off");
    const duplicate = await topology({ sameDate: true });
    assert.deepEqual(duplicate.rows, []); assert.deepEqual(duplicate.all, [90]); assert.equal(duplicate.phase, "", "the +90 night is never seated twice");
    const expectedXs = [[-90], [-90, 180], [-90, 180, -180], [-90, 180, -180]];
    for(let strangers=0;strangers<=3;strangers++){
      const chorus = await topology({ share: true, strangerCount: strangers });
      assert.deepEqual(chorus.rows.map((row) => row.x), expectedXs[strangers], `${strangers} strangers fill before the phase memory`);
      assert.equal(chorus.rows.filter((row) => row.phase).length, strangers < 3 ? 1 : 0, "the phase memory uses only an empty full-seat slot");
      if(strangers===0) assert.equal(chorus.visitor, "", "the local memory is not announced as a stranger");
    }
    const low = await topology({ share: true, low: true, strangerCount: 1 });
    assert.deepEqual(low.rows, [{ x: -90, id: "1".repeat(32), phase: false, date: "2026-08-22" }], "LOW gives its one full seat to the stranger");

    const THREE = threeHarness(), own = artifact({ moonBucket: 2 }), remembered = artifact({ moonBucket: 4, targets: [[0, 1, 900, 10, 0, null]] }); remembered.date = "2026-07-03";
    const gift = runVisitor(source, {
      seat: true, gift: true, phase: true,
      extra: {
        THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(),
        _prev: new THREE.Vector3(),
        roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } },
        localStorage: { getItem(key) { if(key === "aimdojo.ghost") return JSON.stringify(own); if(key === "aimdojo.ghostPhase") return JSON.stringify({ v: 1, slots: { 4: remembered } }); return null; }, setItem() {} },
      },
      body: `
        ghostSessionStart(); Tone.Transport.seconds=8; ghostSeatUpdate(0.016);
        const phaseSeat=_ghostVisitorSeats[0], row=phaseSeat.record.targets[0], p=new THREE.Vector3(); ghostSeatInstall(phaseSeat); ghostTargetPosition(row,8,p); ghostSeatInstall(_ghostOwnSeat);
        const dx=p.x-PLAYER_POS.x,dy=p.y-PLAYER_POS.y,dz=p.z-PLAYER_POS.z,d=Math.hypot(dx,dy,dz),aim={x:dx/d,y:dy/d,z:dz/d};
        const proxy=ghostGiftLockTarget(aim,0.72), selected=proxy&&proxy._ghostGiftRow; _ghGiftLockedRow=selected; const speed=ghostGiftPlanSpeed();
        _prev.copy(p); const projectile={pos:new THREE.Vector3(p.x,p.y,p.z),gift:true,giftRow:selected,giftRoadT:8}, routed=!!selected&&ghostGiftProjectileHit(projectile), caught=routed&&ghostGiftCatch(selected,8);
        this.gift={selected:selected&&selected[2],speed,routed,caught,visible:phaseSeat.seatRoot.visible,sameMail:phaseSeat.mail===_ghostOwnSeat.mail,ownMail:_ghostOwnSeat.mail.map(row=>row.slice()),phaseMail:phaseSeat.mail.map(row=>row.slice())};
      `,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(gift.gift)), { selected: 900, speed: 72, routed: true, caught: true, visible: true, sameMail: true, ownMail: [[8, 1]], phaseMail: [[8, 1]] }, "a phase-only Gift uses the multi-seat projectile route and the normal self-mail ledger");

    let repairs = 0; const mismatched = artifact({ moonBucket: 5 }); mismatched.date = "2026-07-03";
    const invalid = runVisitor(source, { phase: true, extra: { localStorage: { getItem: () => JSON.stringify({ v: 1, slots: { 4: mismatched } }), setItem: () => { repairs += 1; } } }, body: "this.phase=ghostPhaseRead(null);" });
    assert.equal(invalid.phase, null); assert.equal(repairs, 0, "an invalid selected slot is dropped without repairing storage");
    let offTouches = 0;
    const off = runVisitor(source, { extra: { localStorage: { getItem: () => { offTouches += 1; return null; }, setItem: () => { offTouches += 1; } } }, body: `this.values=[ghostPhaseRead(null),ghostPhaseWrite(${JSON.stringify(artifact())}),ghostPhaseAccept(0),ghostPhaseLine(),GH_SEAT_XS];` });
    assert.deepEqual(Array.from(off.values), [null, false, false, "", null]); assert.equal(offTouches, 0, "ghostPhase:0 has no key, seat, or storage touch even under direct calls");
    assert.equal((ghostBlock(source).match(/GH_PHASE_KEY/g) || []).length, 4, "the browser-only key appears only at declaration, phase read, preserving write-read, and write");
    assert.doesNotMatch(extractFunction(source, "ghostShareUpload"), /PHASE|Phase|phase/);
    const phasePaths = ["ghostPhaseSlots", "ghostPhaseRead", "ghostPhaseWrite", "ghostPhaseAccept", "ghostPhaseLine"].map((name) => extractFunction(source, name)).join("\n");
    assert.doesNotMatch(phasePaths, /\brnd\s*\(|Math\.random\s*\(|state\.(?:bpm|hits|shots|streak|range)\s*=/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostPhaseRead", (fn) => fn.replace("&&(!own||record.date!==own.date)", ""));
  await mutationMustFail(assertContract, mutation, "the duplicate-night oracle kills a phase seat beside its identical +90 night");
  mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace(" || _ghostVisitorCount>=GH_VISITOR_COUNT", ""));
  await mutationMustFail(assertContract, mutation, "the LOW oracle kills a phase memory stealing a stranger's only seat");
  mutation = replaceFunction(html, "ghostVisitorLine", (fn) => fn.replace("if(seat&&seat.phase===true) continue;", ""));
  await mutationMustFail(assertContract, mutation, "the copy oracle kills a local memory counted as a stranger");
  mutation = replaceFunction(html, "ghostGiftLockTarget", (fn) => fn.replace("if(GH_MULTI && !_ghostSeatBusy)", "if(GH_SHARE && !_ghostSeatBusy)"));
  await mutationMustFail(assertContract, mutation, "the phase-only Gift oracle kills an own-seat-only critical route");
  mutation = replaceFunction(html, "ghostGiftProjectileHit", (fn) => fn.replace("if(GH_MULTI && !_ghostSeatBusy && pr)", "if(GH_SHARE && !_ghostSeatBusy && pr)"));
  await mutationMustFail(assertContract, mutation, "the phase-only projectile oracle kills a relay-only collision route");
  mutation = replaceFunction(html, "ghostPhaseSlots", (fn) => fn.replace("record.moonBucket===+key && ", ""));
  await mutationMustFail(assertContract, mutation, "the slot validator kills a night filed under the wrong moon");
});

test("read-once mail schedules at most sixteen pooled lane-colour returns on the road clock", async () => {
  const assertContract = async (source) => {
    const THREE = threeHarness(), sceneAdds = [];
    const rows = Array.from({ length: 18 }, (_unused, index) => [5 + index, index % 4, index ? 6 : 1]);
    const state = { t: 100, bpm: 60, running: true };
    const context = runVisitor(source, {
      share: true,
      extra: { THREE, state, scene: { add(value) { sceneAdds.push(value); } } },
      body: `
        _ghostShareEpoch=9; _ghostOwnSeat={record:${JSON.stringify(artifact())}};
        ghostRelayJson=()=>Promise.resolve({catches:${JSON.stringify(rows)}});
        this.read=()=>ghostMailFetch(9,'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
        this.normal=()=>{ Tone.Transport.seconds=5; ghostReturnUpdate(); const star=_ghostReturnPool[0]; return {visible:star.mesh.visible,spent:star.spent,color:star.mesh.material.color.value,data:Array.from(star.data),count:_ghostReturnCount,sig:_ghostReturnSig,pool:_ghostReturnPool.length}; };
        this.standing=()=>{ reduceMotion=true; Tone.Transport.seconds=6; ghostReturnUpdate(); const star=_ghostReturnPool[1]; return {visible:star.mesh.visible,color:star.mesh.material.color.value,data:Array.from(star.data)}; };
        this.hide=()=>{ state.running=false; ghostReturnUpdate(); return _ghostReturnPool.some(star=>star.mesh.visible); };
      `,
    });
    await context.read();
    const normal = context.normal();
    assert.deepEqual({ visible: normal.visible, spent: normal.spent, color: normal.color, count: normal.count, sig: normal.sig, pool: normal.pool, sceneAdds: sceneAdds.length }, { visible: true, spent: false, color: "lane-w", count: 18, sig: 1, pool: 16, sceneAdds: 16 });
    assert.deepEqual(Array.from(normal.data.slice(3)), [-4.800000190734863, 0.18000000715255737, -2]);
    const standing = context.standing(); assert.equal(standing.visible, true); assert.equal(standing.color, "lane-a"); assert.equal(standing.data[2], -2); assert.equal(standing.data[5], -2);
    assert.equal(context.hide(), false, "paused, Temple, and trainer lifecycle gates cannot strand a visible return");
    const paths = ["ghostMailFetch", "ghostReturnSchedule", "ghostReturnUpdate"].map((name) => extractFunction(source, name)).join("\n");
    assert.doesNotMatch(paths, /state\.t/, "mail and stars use only the road authority");
    assert.match(paths, /WASD_COL\[star\.lane\]/); assert.match(ghostBlock(source), /GH_RETURN_MAX=16/); assert.match(extractFunction(source, "ghostReturnUpdate"), /if\(reduceMotion\)/);
  };
  await assertContract(html);
  const mutation = replaceFunction(html, "ghostReturnUpdate", (fn) => fn.replace("const now=ghostRoadTime();", "const now=state.t;"));
  await mutationMustFail(assertContract, mutation, "the returning-star oracle kills a state.t clock sneak");
});

test("every Visitor function rejects the gameplay clock and relay calls remain on reset/finalize boundaries", async () => {
  const visitorFunctions = [
    "ghostTokenValid", "ghostToken", "ghostLonBucket", "ghostRelayUrl", "ghostRelayHeaders", "ghostRelayFetch", "ghostUtf8Bytes", "ghostSerializedBytes", "ghostRelayJson", "ghostUploadAttempt", "ghostUploadRetry", "ghostShareUpload",
    "ghostSeatCapture", "ghostSeatInstall", "ghostSeatClear", "ghostSeatRememberRows", "ghostMoonSigil", "ghostVisitorMailLine", "ghostVisitorLine", "ghostReturnMailValid", "ghostReturnEnsure", "ghostReturnReset", "ghostReturnSchedule", "ghostReturnUpdate",
    "ghostSilhouetteMaterial", "ghostSilhouetteBuild", "ghostSilhouetteHide", "ghostSilhouettesReset", "ghostSilhouetteAccept", "ghostSilhouettesUpdate",
    "ghostPhaseSlots", "ghostPhaseRead", "ghostPhaseWrite", "ghostPhaseLine", "ghostVisitorAccept", "ghostPhaseAccept", "ghostVisitorFetch", "ghostMailFetch", "ghostShareReset", "ghostMailAttempt", "ghostShareFinalize", "ghostSeatsUpdate", "ghostGiftLockSeats", "ghostGiftSeatPlan", "ghostGiftSeatProjectileHit", "ghostGiftSeatCatch",
    "ghostSessionStart",
  ];
  const allowlist = {
    ghostRelayFetch: ["ghostRelayJson", "ghostUploadAttempt", "ghostMailAttempt"],
    ghostRelayJson: ["ghostVisitorFetch", "ghostMailFetch"],
    ghostVisitorFetch: ["ghostShareReset"],
    ghostMailFetch: ["ghostShareReset"],
    ghostUploadAttempt: ["ghostUploadRetry", "ghostShareUpload"],
    ghostMailAttempt: ["ghostShareFinalize"],
    ghostShareUpload: ["ghostRecordFinalize"],
    ghostShareReset: ["ghostSessionStart"],
    ghostShareFinalize: ["bowFinish"],
    ghostSessionStart: ["setTrainPhase", "resetSession"],
  };
  const assertContract = (source) => {
    for (const name of visitorFunctions) assert.doesNotMatch(extractFunction(source, name), /state\.t/, `${name} cannot read the gameplay clock`);
    assert.equal((ghostBlock(source).match(/\bfetch\s*\(/g) || []).length, 1, "the Visitor block has one raw fetch site");
    assert.match(extractFunction(source, "ghostRelayFetch"), /await fetch\(url,/);
    for (const [callee, callers] of Object.entries(allowlist)) {
      assert.equal((source.match(new RegExp(`\\b${callee}\\s*\\(`, "g")) || []).length, callers.length + 1, `${callee} has only its named boundary callers`);
      for (const caller of callers) assert.match(extractFunction(source, caller), new RegExp(`\\b${callee}\\s*\\(`), `${caller} is an allowed ${callee} caller`);
    }
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostGiftSeatProjectileHit", (fn) => fn.replace("  let hit=false;", "  const leakedClock=state.t;\n  let hit=false;"));
  await mutationMustFail(assertContract, mutation, "the all-new-functions scan kills state.t inside seat projectile routing");
  mutation = replaceFunction(html, "ghostSilhouettesUpdate", (fn) => fn.replace("const roadT=ghostRoadTime()", "const roadT=state.t"));
  await mutationMustFail(assertContract, mutation, "the all-new-functions scan kills a silhouette gameplay-clock sneak");
  mutation = replaceFunction(html, "animate", (fn) => fn.replace("  requestAnimationFrame(animate);", "  requestAnimationFrame(animate);\n  ghostMailFetch(_ghostShareEpoch,ghostToken());"));
  await mutationMustFail(assertContract, mutation, "the relay allowlist kills mail fetching from animate");
});

test("visitor, mail, and returning-star execution preserves every proxied gameplay authority", async () => {
  const assertContract = async (source) => {
    const THREE = threeHarness(), writes = [], gameplay = { t: 77, bpm: 43, hits: 8, shots: 9, streak: 5, range: 21, running: true };
    const tracked = (label, value) => new Proxy(value, { set(target, key, next) { writes.push([label, String(key), next]); target[key] = next; return true; } });
    const state = tracked("state", gameplay), player = tracked("PLAYER_POS", { x: 0, y: 1.7, z: 0 }), transport = tracked("Tone.Transport", { seconds: 9 });
    const uNow = tracked("road.uNow", { value: 0 }), uArchN0 = tracked("road.uArchN0", { value: 0 }), uK = tracked("road.uK", { value: [1] });
    const authoritySnapshot = () => JSON.stringify({ state, player, transport, road: { uNow: uNow.value, uArchN0: uArchN0.value, uK: uK.value } });
    let randomCalls = 0; const trackedMath = Object.create(Math); trackedMath.random = () => { randomCalls += 1; return 0.5; };
    const visitorRow = [0, 2, 7, 10, 0, null];
    const context = runVisitor(source, {
      seat: true, gift: true, share: true,
      extra: {
        THREE, Math: trackedMath, state, PLAYER_POS: player, Tone: { Transport: transport }, authoritySnapshot, AbortController, TextDecoder,
        fetch: () => Promise.resolve(relayResponse({ catches: [[9, 3, 2]] })),
        TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(), roadWallMat: { uniforms: { uNow, uArchN0, uK } },
      },
      body: `
        const before=authoritySnapshot(), own=${JSON.stringify(artifact())}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own); _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[_ghostOwnSeat]; _ghostSeatRows=new WeakMap(); _ghostShareEpoch=11;
        const visitor=${JSON.stringify(artifact({ moonBucket: 5, targets: [visitorRow] }))}; ghostVisitorAccept(11,'ffffffffffffffffffffffffffffffff',visitor); ghostGiftCatch(visitor.targets[0],8);
        this.run=async()=>{ await ghostMailFetch(11,'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'); ghostReturnUpdate(); return {before,after:authoritySnapshot(),visitor:JSON.stringify(_ghostVisitorSeats[0].record),mail:_ghostVisitorSeats[0].mail.map(row=>row.slice()),star:_ghostReturnPool[0].mesh.visible}; };
      `,
    });
    const snapshot = await context.run();
    assert.equal(snapshot.after, snapshot.before); assert.deepEqual(writes, []); assert.equal(randomCalls, 0); assert.equal(snapshot.star, true);
    assert.deepEqual(Array.from(snapshot.mail, (row) => Array.from(row)), [[8, 2]]); assert.equal(snapshot.visitor, JSON.stringify(artifact({ moonBucket: 5, targets: [visitorRow] })));
    const paths = ["ghostVisitorAccept", "ghostMailFetch", "ghostReturnSchedule", "ghostReturnUpdate", "ghostGiftSeatCatch"].map((name) => extractFunction(source, name)).join("\n");
    assert.doesNotMatch(paths, /\brnd\s*\(|Math\.random\s*\(/); assert.doesNotMatch(paths, /state\.(?:bpm|hits|shots|streak|range)\s*=/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("  const phase=phaseSeat===true;", "  state.bpm+=1;\n  const phase=phaseSeat===true;"));
  await mutationMustFail(assertContract, mutation, "the isolation snapshot kills a visitor-to-difficulty write");
  mutation = replaceFunction(html, "ghostReturnUpdate", (fn) => fn.replace("  const now=ghostRoadTime();", "  PLAYER_POS.x+=1;\n  const now=ghostRoadTime();"));
  await mutationMustFail(assertContract, mutation, "the authority proxy kills a returning-star PLAYER_POS write");
});
