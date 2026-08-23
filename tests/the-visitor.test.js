"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
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
  class BoxGeometry extends BufferGeometry {}
  class ConeGeometry extends BufferGeometry {}
  class SphereGeometry extends BufferGeometry {}
  class TorusGeometry extends BufferGeometry {}
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

function runVisitor(source, { record = false, seat = false, gift = false, share = false, low = false, extra = {}, body = "" } = {}) {
  const context = vm.createContext({
    Math, Number, JSON, Promise, Date, WeakMap, Set, Float32Array, Uint8Array, Uint16Array,
    CFG: { ghostRecord: record ? 1 : 0, ghostSeat: seat ? 1 : 0, ghostGift: gift ? 1 : 0, ghostShare: share ? 1 : 0, moonline: {}, skyDay: { api: "https://relay.example" }, rangeStart: 11, projGravity: 0, projLife: 10, projRadius: 0.1, flickBonus: { coneMul: 1 } }, LOW: low,
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

function graduationSnapshot(source, { record, seat, gift, share, low }) {
  let touches = 0, network = 0, timers = 0, weakMaps = 0;
  const armCalls = [];
  class CountedWeakMap extends WeakMap { constructor(...args) { super(...args); weakMaps += 1; } }
  const context = runVisitor(source, {
    record, seat, gift, share, low,
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
        body: `const before=weakMapCount(); ghostShareReset(); ghostShareUpload({v:1}); ghostShareFinalize(); this.off=[ghostToken(),_ghostSeats,_ghostOwnSeat,_ghostVisitorSeat,_ghostSeatRows,_ghostReturnPool]; this.weakMaps=weakMapCount()-before;`,
      });
      assert.deepEqual(Array.from(off.off), ["", null, null, null, null, null]); assert.equal(off.weakMaps, 0); assert.equal(touches, 0); assert.equal(network, 0); assert.equal(timers, 0);
    }
    const visitorFetch = extractFunction(source, "ghostVisitorFetch"), pathLine = visitorFetch.split("\n").find((line) => line.includes("const path=")), pathExpression = pathLine && pathLine.slice(0, pathLine.indexOf(", body="));
    assert.ok(pathExpression); assert.doesNotMatch(pathExpression, /\btoken\b/, "the bearer never enters the query URL");
    for (const name of ["ghostUploadAttempt", "ghostMailAttempt"]) assert.doesNotMatch(extractFunction(source, name), /JSON\.stringify\(\{[^}]*\btoken\b/, `${name} keeps the token out of JSON`);
    assert.match(extractFunction(source, "ghostLonBucket"), /Geolocation and the observer longitude never enter this path/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostShareReset", (fn) => fn.replace("  if(!GH_SHARE) return;\n", ""));
  await mutationMustFail(assertContract, mutation, "the matrix kills a network/token/allocation-at-share:0 mutant");
  mutation = replaceFunction(html, "ghostVisitorFetch", (fn) => fn.replace("+'&n='+GH_VISITOR_COUNT", "+'&n='+GH_VISITOR_COUNT+'&token='+token"));
  await mutationMustFail(assertContract, mutation, "the URL oracle kills a token-in-query mutant");
  mutation = replaceFunction(html, "ghostLonBucket", (fn) => fn.replace("  const hour=", "  if(offset===-330) return 17;\n  const hour="));
  await mutationMustFail(assertContract, mutation, "the exact table kills India minus-330 mapping to bucket 17");
  mutation = replaceFunction(html, "ghostLonBucket", (fn) => fn.replace("  const hour=", "  if(offset===210) return 8;\n  const hour="));
  await mutationMustFail(assertContract, mutation, "the exact table kills Newfoundland plus-210 mapping to bucket 8");
  mutation = replaceFunction(html, "ghostLonBucket", (fn) => fn.replace("  const hour=", "  if(offset===-840) return 1;\n  const hour="));
  await mutationMustFail(assertContract, mutation, "the exact table mutation-pins Kiribati minus-840 to bucket 2");
  mutation = replaceFunction(html, "ghostShareReset", (fn) => fn.replace("  if(!GH_SHARE) return;", "  new WeakMap();\n  if(!GH_SHARE) return;"));
  await mutationMustFail(assertContract, mutation, "the constructor oracle kills a throwaway WeakMap before the share-off return");
});

test("graduation is the ordered main-play ghost boundary across the full HIGH/LOW knob matrix", async () => {
  const assertContract = (source) => {
    for (const low of [false, true]) for (const record of [false, true]) for (const seat of [false, true]) for (const gift of [false, true]) for (const share of [false, true]) {
      const snapshot = graduationSnapshot(source, { low, record, seat, gift, share });
      const calls = []; if (seat) calls.push("seat"); if (share) calls.push("share"); if (record) calls.push("record");
      assert.deepEqual(snapshot.lesson, { calls: [], record: false, touches: 0, network: 0, timers: 0, weakMaps: 0 }, `lesson stays ghost-silent at low:${+low} record:${+record} seat:${+seat} gift:${+gift} share:${+share}`);
      assert.deepEqual(snapshot.graduation, {
        calls, record, own: share, touches: +seat + +share, network: 0, timers: 1, weakMaps: +record + +share,
        base: record || seat || share ? 20 : 0, trainMode: false,
      }, `graduation arms exact knobs at low:${+low} record:${+record} seat:${+seat} gift:${+gift} share:${+share}`);
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
  mutation = replaceFunction(html, "ghostSessionStart", (fn) => fn.replace("  if(GH_SEAT) ghostSeatReset();\n  if(GH_SHARE) ghostShareReset();", "  if(GH_SHARE) ghostShareReset();\n  if(GH_SEAT) ghostSeatReset();"));
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
    assert.equal(visitor.url, "https://relay.example/api/ghosts?lon=18&n=1");
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
      ghostRecordArm(); _ghostRecordArrivals=16;
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
  let mutation = html.replace("_ghSeatX=GH_SEAT_X;", "_ghSeatX=GH_VISITOR_X;");
  await mutationMustFail(assertContract, mutation, "the own-seat fixture kills a default-seat displacement mutant");
  mutation = html.replace("_ghSeatX=GH_SEAT_X;", "_ghSeatX=GH_GIFT?GH_SEAT_X:GH_VISITOR_X;");
  await mutationMustFail(assertContract, mutation, "the full matrix kills a share-off gift-off displacement mutant");
});

test("a fetched artifact is client-validated before the same seat machinery builds it at minus ninety", async () => {
  const assertContract = async (source) => {
    const THREE = threeHarness(), sceneAdds = [];
    const context = runVisitor(source, {
      seat: true, share: true,
      extra: { THREE, sceneAdds, scene: { add(value) { sceneAdds.push(value); } }, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
      body: `
        const own=${JSON.stringify(artifact({ moonBucket: 2 }))}; _ghostSeatRecord=own; ghostSeatBuild(own); ghostSeatPrepare(own);
        _ghostOwnSeat=ghostSeatCapture({visitor:false}); _ghostSeats=[]; _ghostSeats.push(_ghostOwnSeat); _ghostSeatRows=new WeakMap(); _ghostShareEpoch=3;
        this.receive=async value=>{ ghostRelayJson=()=>Promise.resolve(value); await ghostVisitorFetch(3,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',12); };
        this.inspect=()=>({count:_ghostSeats.length,visitor:_ghostVisitorSeat&&{x:_ghostVisitorSeat.x,id:_ghostVisitorSeat.id,sig:_ghostVisitorSeat.sig,avatarX:_ghostVisitorSeat.avatar.position.x,wall:_ghostVisitorSeat.walls.material.vertexShader.includes('-90.00000'),sameRecord:_ghostVisitorSeat.record===this.validArtifact},ownX:_ghostOwnSeat.avatar.position.x,sceneAdds:sceneAdds.length});
      `,
    });
    const invalid = artifact(); invalid.extra = true;
    await context.receive({ ghosts: [{ id: "b".repeat(32), artifact: invalid }] }); assert.equal(context.inspect().count, 1); assert.equal(context.inspect().visitor, null);
    const valid = artifact({ moonBucket: 7 }); context.validArtifact = valid;
    await context.receive({ ghosts: [{ id: "b".repeat(32), artifact: valid }] });
    const result = JSON.parse(JSON.stringify(context.inspect()));
    assert.deepEqual(result, { count: 2, visitor: { x: -90, id: "b".repeat(32), sig: 7, avatarX: -90, wall: true, sameRecord: true }, ownX: 90, sceneAdds: 4 });
    assert.equal((ghostBlock(source).match(/function ghostSeatBuild\(/g) || []).length, 1, "both seats use the one build function");
    assert.match(extractFunction(source, "ghostVisitorFetch"), /const record=ghostArtifactValid\(item\.artifact\); if\(!record\) return;[\s\S]*ghostVisitorAccept\(epoch,item\.id,record\);/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostVisitorFetch", (fn) => fn.replace("const record=ghostArtifactValid(item.artifact); if(!record) return;", "const record=item.artifact;"));
  mutation = replaceFunction(mutation, "ghostVisitorAccept", (fn) => fn.replace(" || !ghostArtifactValid(record)", ""));
  await mutationMustFail(assertContract, mutation, "the fetch fixture kills an unvalidated server-artifact mutant");
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
  mutation = replaceFunction(html, "ghostRelayJson", (fn) => fn.replace(" || bytes>GH_MAX_BYTES) return null;", ") return null;"));
  await mutationMustFail(assertContract, mutation, "the declared-length ceiling is mutation-pinned");
  mutation = replaceFunction(html, "ghostRelayJson", (fn) => fn.replace("bytes+=part.value.byteLength; if(bytes>GH_MAX_BYTES)", "bytes+=part.value.byteLength; if(false)"));
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
    ghostSeatInstall(_ghostVisitorSeat); _ghActiveTargets.push(visitor.targets[0]); ghostSeatCapture(_ghostVisitorSeat); ghostSeatInstall(_ghostOwnSeat);
    PLAYER_POS.z=200; Tone.Transport.seconds=7.5;
    const intended=${JSON.stringify(direction)}==='own'?own.targets[0]:visitor.targets[0], intendedSeat=${JSON.stringify(direction)}==='own'?_ghostOwnSeat:_ghostVisitorSeat;
    const intendedPosition=new THREE.Vector3(); ghostSeatInstall(intendedSeat); ghostTargetPosition(intended,7.5,intendedPosition); ghostSeatInstall(_ghostOwnSeat);
    const dx=intendedPosition.x-PLAYER_POS.x, dy=intendedPosition.y-PLAYER_POS.y, dz=intendedPosition.z-PLAYER_POS.z, distance=Math.hypot(dx,dy,dz), aim={x:dx/distance,y:dy/distance,z:dz/distance};
    const camera={getWorldDirection(out){ return out.copy(aim); }};
    const realPosition=new THREE.Vector3(PLAYER_POS.x+aim.x*20-aim.z*15,PLAYER_POS.y+aim.y*20,PLAYER_POS.z+aim.z*20+aim.x*15);
    const real={dead:false,kind:0,radius:1,sc:1,mesh:{position:realPosition}}; targets.push(real);
    const realPick=scopeLockTarget(); real.dead=true; const giftPick=scopeLockTarget();
    const selectedRow=giftPick&&giftPick._ghostGiftRow, pr={gift:true,giftRow:selectedRow,giftRoadT:7.5,pos:new THREE.Vector3().copy(giftPick.mesh.position),vel:new THREE.Vector3().copy(giftPick.vel),life:0,mesh:{position:new THREE.Vector3()},fireRow:null};
    projectiles.push(pr); Tone.Transport.seconds=7.6; updateProjectiles(0.1);
    this.snapshot={realWon:realPick===real,selected:selectedRow&&selectedRow[2],retired,ownMail:_ghostOwnSeat.mail.map(row=>row.slice()),visitorMail:_ghostVisitorSeat.mail.map(row=>row.slice())};
  `;
  const context = runVisitor(source, {
    seat: true, gift: true, share: true,
    extra: { THREE, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry(), roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } } },
    body,
  });
  return JSON.parse(JSON.stringify(context.snapshot));
}

test("Gift locking scans both seats, visitor catches stay in its ledger, and one mail batch leaves at Bow end", async () => {
  const assertContract = async (source) => {
    assert.deepEqual(multiSeatRouteSnapshot(source, "own"), { realWon: true, selected: 101, retired: 1, ownMail: [[7.6, 1]], visitorMail: [] });
    assert.deepEqual(multiSeatRouteSnapshot(source, "visitor"), { realWon: true, selected: 202, retired: 1, ownMail: [], visitorMail: [[7.6, 2]] });
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
        ghostSeatInstall(_ghostVisitorSeat); _ghActiveTargets.push(visitor.targets[0]); ghostSeatCapture(_ghostVisitorSeat); ghostSeatInstall(_ghostOwnSeat);
        Tone.Transport.seconds=8; const p=new THREE.Vector3(); ghostSeatInstall(_ghostVisitorSeat); ghostTargetPosition(visitor.targets[0],8,p); ghostSeatInstall(_ghostOwnSeat);
        const dx=p.x-PLAYER_POS.x,dy=p.y-PLAYER_POS.y,dz=p.z-PLAYER_POS.z,d=Math.hypot(dx,dy,dz),aim={x:dx/d,y:dy/d,z:dz/d};
        const proxy=ghostGiftLockTarget(aim,0.72); this.selected=proxy&&proxy._ghostGiftRow[2]; this.proxyX=proxy&&proxy.mesh.position.x;
        this.caught=ghostGiftCatch(visitor.targets[0],8); this.ownMail=_ghostOwnSeat.mail.slice(); this.visitorMail=_ghostVisitorSeat.mail.slice();
        _ghostToken='dddddddddddddddddddddddddddddddd'; ghostMailAttempt=(token,toId,catches)=>{ sends.push({token,toId,catches:catches.map(row=>row.slice())}); return Promise.resolve(true); };
        ghostShareFinalize(); ghostShareFinalize(); this.sends=sends;
      `,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(context.selected, 2); assert.ok(context.proxyX < 0); assert.equal(context.caught, true);
    assert.deepEqual(Array.from(context.ownMail), []); assert.deepEqual(Array.from(context.visitorMail, (row) => Array.from(row)), [[8, 1]]);
    assert.deepEqual(Array.from(context.sends, (send) => ({ token: send.token, toId: send.toId, catches: Array.from(send.catches, (row) => Array.from(row)) })), [{ token: "d".repeat(32), toId: "c".repeat(32), catches: [[8, 1]] }]);
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
  let mutation = replaceFunction(html, "ghostGiftLockTarget", (fn) => fn.replace("  if(GH_SHARE && !_ghostSeatBusy) return ghostGiftLockSeats(aim,minDot);\n", ""));
  await mutationMustFail(assertContract, mutation, "the two-seat oracle kills an own-seat-only Gift scan");
  mutation = replaceFunction(html, "scopeLockTarget", (fn) => fn.replace("if(best || tight || !GH_GIFT) return best;", "if(tight || !GH_GIFT) return best;"));
  await mutationMustFail(assertContract, mutation, "the real arbitration route kills charity outranking a live target");
  mutation = replaceFunction(html, "ghostGiftLockSeats", (fn) => fn.replace("if(dot>bestDot){", "if(dot>bestDot || seat.visitor){"));
  await mutationMustFail(assertContract, mutation, "both aim directions kill an always-prefer-visitor seat mutant");
});

test("threshold copy is EN+JA and keeps comeback then mail then visitor then deal precedence", async () => {
  const assertContract = (source) => {
    const context = runVisitor(source, {
      gift: true, share: true,
      body: `
        _ghostReturnCount=3; _ghostReturnSig=1; _ghostReturnSpoken=false; _ghostGiftGreetingCount=2; _ghostGiftMailSpoken=false;
        _ghostVisitorSeat={record:${JSON.stringify(artifact({ moonBucket: 7 }))},sig:7,spoken:false};
        this.lines=[ghostGiftMailLine(),ghostGiftMailLine(),ghostVisitorLine(),ghostVisitorLine()];
      `,
    });
    assert.deepEqual(Array.from(context.lines), ["3 of your notes were caught · 🌒", "", "a visitor rides tonight · 🌘", ""]);
    assert.match(source, /ghostVisitorMail:'きみの音を \{n\}こ だれかが つかまえた · \{sigil\}'/);
    assert.match(source, /ghostVisitorLine:'今夜 たびびとが となりを走る · \{sigil\}'/);
    const flash = extractFunction(source, "flashTheme");
    assert.match(flash, /const vm=rl\?'':\(GH_SHARE\?ghostVisitorMailLine\(\):''\);/);
    assert.match(flash, /const vl=rl\|\|vm\|\|ml\?'':\(GH_SHARE\?ghostVisitorLine\(\):''\);/);
    assert.match(flash, /setText\(f, vm\|\|vl\|\|base\);/);
  };
  await assertContract(html);
  const mutation = replaceFunction(html, "flashTheme", (fn) => fn.replace("setText(f, vm||vl||base);", "setText(f, vl||vm||base);"));
  await mutationMustFail(assertContract, mutation, "the threshold oracle kills visitor-over-mail precedence");
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
    "ghostVisitorAccept", "ghostVisitorFetch", "ghostMailFetch", "ghostShareReset", "ghostMailAttempt", "ghostShareFinalize", "ghostSeatsUpdate", "ghostGiftLockSeats", "ghostGiftSeatPlan", "ghostGiftSeatProjectileHit", "ghostGiftSeatCatch",
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
        this.run=async()=>{ await ghostMailFetch(11,'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'); ghostReturnUpdate(); return {before,after:authoritySnapshot(),visitor:JSON.stringify(_ghostVisitorSeat.record),mail:_ghostVisitorSeat.mail.map(row=>row.slice()),star:_ghostReturnPool[0].mesh.visible}; };
      `,
    });
    const snapshot = await context.run();
    assert.equal(snapshot.after, snapshot.before); assert.deepEqual(writes, []); assert.equal(randomCalls, 0); assert.equal(snapshot.star, true);
    assert.deepEqual(Array.from(snapshot.mail, (row) => Array.from(row)), [[8, 2]]); assert.equal(snapshot.visitor, JSON.stringify(artifact({ moonBucket: 5, targets: [visitorRow] })));
    const paths = ["ghostVisitorAccept", "ghostMailFetch", "ghostReturnSchedule", "ghostReturnUpdate", "ghostGiftSeatCatch"].map((name) => extractFunction(source, name)).join("\n");
    assert.doesNotMatch(paths, /\brnd\s*\(|Math\.random\s*\(/); assert.doesNotMatch(paths, /state\.(?:bpm|hits|shots|streak|range)\s*=/);
  };
  await assertContract(html);
  let mutation = replaceFunction(html, "ghostVisitorAccept", (fn) => fn.replace("  if(!GH_SHARE", "  state.bpm+=1;\n  if(!GH_SHARE"));
  await mutationMustFail(assertContract, mutation, "the isolation snapshot kills a visitor-to-difficulty write");
  mutation = replaceFunction(html, "ghostReturnUpdate", (fn) => fn.replace("  const now=ghostRoadTime();", "  PLAYER_POS.x+=1;\n  const now=ghostRoadTime();"));
  await mutationMustFail(assertContract, mutation, "the authority proxy kills a returning-star PLAYER_POS write");
});
