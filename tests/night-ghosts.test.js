"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const { sourceText: html } = require("./source.js");
const emissionFixture = JSON.parse(fs.readFileSync(path.join(__dirname, "night-ghosts-emission.fixture.json"), "utf8"));

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
  assert.ok(start >= 0 && end > start, "the Night Ghosts block is extractable");
  return source.slice(start, end);
}

function testMulberry32(seed) {
  return function next() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function testRealCivilDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = +value.slice(0, 4), month = +value.slice(5, 7), day = +value.slice(8, 10), date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function runGhost(source, { record = false, share = false, low = false, extra = {}, body = "" } = {}) {
  const context = vm.createContext({
    Math, Number, JSON, WeakMap, Float32Array, Uint16Array, GH_CHALK: false,
    CFG: { ghostRecord: record ? 1 : 0, ghostShare: share ? 1 : 0, ghostChalk: 0, moonline: {} }, LOW: low, WEAK: low,
    state: { t: 0, bpm: 60, running: true }, trainMode: false, templeActive: false, reduceMotion: false,
    Tone: { Transport: { seconds: 0 } }, audioLat: () => 0, PITCH_LIMIT: 88 * Math.PI / 180,
    PLAYER_POS: { x: 0, z: 0 }, ML_ARCH_EVERY: 4, ROAD_MPB: 27,
    ML_WALL_SPRING: 12, ML_WALL_DJ: 7.3, ML_WALL_DA: 7.3, ML_WALL_DB: 5,
    WASD_COL: ["lane-w", "lane-a", "lane-s", "lane-d"], ML_WALL_CHALK: [1, 2, 3, 4, 5], ML_GOLD: 6,
    phasesToday: () => "2026-08-22", moonPhaseBucket: () => 4, realCivilDate: testRealCivilDate, mulberry32: testMulberry32,
    roadWallMat: null, roadArchMat: null, scene: { add() {} }, TARGET_CORE_GEO: {}, _flockGeo: {}, SPAWN_UP: {},
    runIdle() {}, renderer: { compile() {} },
    _roadG: (number) => (+number).toFixed(5),
    localStorage: { getItem: () => null, setItem() {} },
    ...extra,
  });
  new vm.Script(`${ghostBlock(source)}\n${body}`, { filename: "night-ghosts.vm.js" }).runInContext(context);
  return context;
}

function mutationMustFail(assertContract, mutation, message) {
  assert.notEqual(mutation, html, `${message} is constructible`);
  assert.throws(() => assertContract(mutation), assert.AssertionError, message);
}

function loadEmissionHelpers() {
  const filename = path.join(__dirname, "moonline-inverse.test.js"), source = fs.readFileSync(filename, "utf8");
  const context = vm.createContext({ __dirname, require: (id) => id === "node:test" ? (() => {}) : require(id) });
  new vm.Script(`${source}\nthis.helpers={emittedRoadFamily,emittedWallFamily,inverseOptions};`, { filename }).runInContext(context);
  return context.helpers;
}

function emissionFingerprint(source, low) {
  const helpers = loadEmissionHelpers(), road = helpers.emittedRoadFamily(source, { low }), wall = helpers.emittedWallFamily(source, helpers.inverseOptions(), { low });
  const shader = (material, key) => material && material[key] || null, geometry = {};
  for (const name of Object.keys(wall.wall.geometry.attributes).sort()) geometry[name] = Array.from(wall.wall.geometry.attributes[name].array);
  const payload = {
    road: { vertex: road.roadVertex, fragment: road.roadFragment, socket: road.roadSocketFragment, guardVertex: shader(road.inverseDepthMaterial, "vertexShader"), guardFragment: shader(road.inverseDepthMaterial, "fragmentShader") },
    wall: { vertex: shader(wall.wallMat, "vertexShader"), fragment: shader(wall.wallMat, "fragmentShader"), inverseVertex: shader(wall.inverseMat, "vertexShader"), inverseFragment: shader(wall.inverseMat, "fragmentShader"), accentVertex: shader(wall.accentMat, "vertexShader"), accentFragment: shader(wall.accentMat, "fragmentShader"), veilVertex: shader(wall.veilMat, "vertexShader"), veilFragment: shader(wall.veilMat, "fragmentShader"), geometry, index: Array.from(wall.wall.geometry.index.array) },
  };
  const serialized = JSON.stringify(payload);
  return { chars: serialized.length, sha256: crypto.createHash("sha256").update(serialized).digest("hex") };
}

function withGhostFlags(source, record, share) {
  return source.replace(/ghostRecord:[01]/, `ghostRecord:${record ? 1 : 0}`).replace(/ghostShare:[01]/, `ghostShare:${share ? 1 : 0}`);
}

test("MY emitted road and wall family stays on its frozen bytes in all recorder/share combinations", () => {
  const assertContract = (source) => {
    for (const record of [false, true]) for (const share of [false, true]) {
      const variant = withGhostFlags(source, record, share);
      assert.deepEqual(emissionFingerprint(variant, false), emissionFixture.high, `HIGH remains frozen at record=${+record}, share=${+share}`);
      assert.deepEqual(emissionFingerprint(variant, true), emissionFixture.low, `LOW remains frozen at record=${+record}, share=${+share}`);
    }
  };
  assertContract(html);
  const mutation = replaceFunction(html, "roadWallFragmentShader", (fn) => fn.replace("].join('\\n');", "].join('\\n')+'\\n/* ghost drift */';"));
  mutationMustFail(assertContract, mutation, "the frozen emission fixture kills wall shader drift");
});


test("the v1 recorder emits the locked bounded artifact and drop-oldest caps", () => {
  const assertContract = (source) => {
    let stored = "";
    const context = runGhost(source, {
      record: true,
      extra: { localStorage: { getItem: () => null, setItem: (_key, value) => { stored = value; } } },
      body: `
        ghostRecordArm();
        for(let i=0;i<1205;i++){ const tg={mesh:{position:{x:(i%4)-1.5,z:-12}},expireAt:2}; ghostRecordSpawn(tg); if(i<8) ghostRecordTargetOutcome(tg,i%2); }
        for(let i=0;i<2405;i++) ghostRecordTap(i%4,100);
        for(let i=0;i<1205;i++) ghostRecordFire(ghostRoadTime(),0,0);
        for(let i=0;i<205;i++) ghostRecordBpm(40+i);
        this.preCaps={bpm:_ghostRecord.bpmCurve.length,targets:_ghostRecord.targets.length,taps:_ghostRecord.taps.length,fires:_ghostRecord.fires.length};
        Tone.Transport.seconds=45; ghostRecordFinalize();
      `,
    });
    assert.deepEqual({ ...context.preCaps }, { bpm: 200, targets: 1200, taps: 2400, fires: 1200 });
    assert.ok(stored.length > 0 && stored.length <= 100000, "a worthy artifact is stored below the serialized cap");
    assert.deepEqual(Object.keys(JSON.parse(stored)), ["ghost", "mail"]); assert.deepEqual(JSON.parse(stored).mail, [], "the shipped wrapper remains compatible without gift machinery");
    const artifact = JSON.parse(stored).ghost;
    assert.deepEqual(Object.keys(artifact), ["v", "date", "moonBucket", "bpm0", "dur", "bpmCurve", "targets", "taps", "fires"]);
    assert.equal(artifact.v, 1); assert.equal(artifact.date, "2026-08-22"); assert.equal(artifact.moonBucket, 4); assert.equal(artifact.dur, 45);
    assert.equal(runGhost(source, { body: `this.valid=!!ghostArtifactValid(${JSON.stringify(artifact)});` }).valid, true);
    const delayed = runGhost(source, { record: true, body: `
      ghostRecordArm(); const tg={mesh:{position:{x:0,z:-10}},expireAt:4}; ghostRecordSpawn(tg);
      Tone.Transport.seconds=1; const fireRow=ghostRecordFire(ghostRoadTime(),0.2,-0.1);
      Tone.Transport.seconds=2; ghostRecordTargetOutcome(tg,1,fireRow);
      Tone.Transport.seconds=3; ghostRecordFire(ghostRoadTime(),Math.PI*7,9); this.fireHit=_ghostRecord.fires[0][3]; this.aim=_ghostRecord.fires[1].slice(1,3);
    ` });
    assert.equal(delayed.fireHit, 1, "an impact marks the fire row by its launch stamp");
    assert.deepEqual(Array.from(delayed.aim), [-Math.PI, 88 * Math.PI / 180], "recorded yaw is normalized and pitch is bounded");
  };
  assertContract(html);
  mutationMustFail(assertContract, html.replace("GH_CAP_TAPS=2400", "GH_CAP_TAPS=2399"), "the cap test kills a 2399-tap recorder");
  mutationMustFail(assertContract, replaceFunction(html, "ghostAimYaw", (fn) => fn.replace(/return Math\.max\([^;]+;/, "return +value||0;")), "the recorder test kills unnormalized aim output");
});


test("a divergent road clock recomputes arrival before recording the hit", () => {
  const assertContract = (source) => {
    let stored = "";
    runGhost(source, {
      record: true,
      extra: { localStorage: { getItem: () => null, setItem: (_key, value) => { stored = value; } } },
      body: `
        ghostRecordArm();
        const hit={mesh:{position:{x:0,z:-10}},expireAt:6}; ghostRecordSpawn(hit);
        state.t=2; Tone.Transport.seconds=10;
        const fireRow=ghostRecordFire(ghostRoadTime(),0,0); ghostRecordTargetOutcome(hit,1,fireRow);
        state.t=10;
        for(let i=1;i<8;i++){ const miss={mesh:{position:{x:0,z:-10}},expireAt:10}; ghostRecordSpawn(miss); ghostRecordTargetOutcome(miss,0); }
        Tone.Transport.seconds=45; ghostRecordFinalize();
      `,
    });
    assert.ok(stored, "the divergent-clock hit cannot invalidate the completed night");
    const artifact = JSON.parse(stored).ghost;
    assert.deepEqual(Array.from(artifact.targets[0]), [0, 0, 0, 14, 1, 10]);
    assert.equal(artifact.fires[0][3], 1);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostRecordTargetOutcome", (fn) => fn.replace("    row[3]=ghostTime(now+Math.max(0,(+tg.expireAt||0)-state.t));\n", ""));
  mutationMustFail(assertContract, mutation, "the divergent-clock artifact oracle kills the stale-arrival survivor");
  assertContract(html);
});


test("equal-time launches keep opposite outcomes on their own opaque rows", () => {
  const assertContract = (source) => {
    const context = runGhost(source, {
      record: true,
      body: `
        ghostRecordArm(); Tone.Transport.seconds=10;
        const hit={mesh:{position:{x:0,z:-10}},expireAt:16}; ghostRecordSpawn(hit);
        const clank={mesh:{position:{x:1,z:-10}},expireAt:16}; ghostRecordSpawn(clank);
        const first=ghostRecordFire(ghostRoadTime(),-0.2,0);
        const second=ghostRecordFire(ghostRoadTime(),0.2,0);
        ghostRecordTargetOutcome(hit,1,first); ghostRecordClank(clank,second);
        this.fireRows=_ghostRecord.fires.map(row=>Array.from(row));
      `,
    });
    assert.deepEqual(Array.from(context.fireRows, (row) => Array.from(row.slice(0, 4))), [[10, -0.2, 0, 1], [10, 0.2, 0, 0]]);
    assert.match(extractFunction(source, "ghostRecordFire"), /return row;/);
    assert.doesNotMatch(extractFunction(source, "ghostRecordMarkFire"), /fires\[|row\[0\]|for\(/, "fire credit performs no timestamp lookup");
    assert.match(extractFunction(source, "fire"), /spawnProjectile\(fireRow\)/);
    assert.match(extractFunction(source, "spawnProjectile"), /pr\.fireRow=fireRow/);
    const impacts = extractFunction(source, "updateProjectiles");
    for (const sink of ["handleTankHit", "clankShot", "gradeRhythmHit"]) assert.match(impacts, new RegExp(`${sink}\\([^;]*pr\\.fireRow\\)`));
    assert.equal((impacts.match(/pr\.fireRow/g) || []).length, 3);
    assert.match(extractFunction(source, "retireProjectile"), /pr\.fireRow=null/);
    assert.match(extractFunction(source, "clearProjectiles"), /pr\.fireRow=null/);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostRecordMarkFire", (fn) => fn.replace("row[3]=hit?1:0;", "_ghostRecord.fires[_ghostRecord.fires.length-1][3]=hit?1:0;"));
  mutationMustFail(assertContract, mutation, "the equal-time oracle kills newest-row crediting");
  assertContract(html);
});


test("every rhythm-gated tank impact marks its own fire stamp before chip or finale", () => {
  const assertContract = (source) => {
    let stored = "";
    runGhost(source, {
      record: true,
      extra: {
        CFG: { ghostRecord: 1, moonline: {}, tank: { fillOnly: false } },
        localStorage: { getItem: () => null, setItem: (_key, value) => { stored = value; } },
      },
      body: `
        ${extractFunction(source, "handleTankHit")}
        function orbOpen(){ return true; }
        function tankChip(){}
        function gradeRhythmHit(target,_point,_atT,_atBpm,fireRow){ ghostRecordTargetOutcome(target,1,fireRow); }
        const soundOn=false,toneReady=false,kick=null,lead=null,synthHit=null,PENTA=[1],GH_UNUSED=0;
        ghostRecordArm(); const tank={mesh:{position:{x:0,z:-10}},expireAt:10,hpMax:3,hp:3,fill16:-1}; ghostRecordSpawn(tank);
        for(let second=1;second<=3;second++){ Tone.Transport.seconds=second; const fireRow=ghostRecordFire(ghostRoadTime(),0,0); handleTankHit(tank,{},fireRow); }
        for(let i=0;i<7;i++){ Tone.Transport.seconds=4+i; const tg={mesh:{position:{x:0,z:-10}},expireAt:2}; ghostRecordSpawn(tg); ghostRecordTargetOutcome(tg,0); }
        Tone.Transport.seconds=45; ghostRecordFinalize();
      `,
    });
    const artifact = JSON.parse(stored).ghost;
    assert.deepEqual(artifact.fires.map((row) => row[3]), [1, 1, 1], "both chips and the finale own successful fires");
    assert.deepEqual(artifact.targets[0].slice(4), [1, 3], "the tank itself resolves once at the finale");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "handleTankHit", (fn) => fn.replace("if(GH_RECORD) ghostRecordMarkFire(fireRow,true);", ""));
  mutationMustFail(assertContract, mutation, "the multi-hit artifact oracle kills chip fires left as misses");
});


test("ghostRecord off allocates no ledger and cannot touch localStorage", () => {
  const assertContract = (source) => {
    let touches = 0;
    const context = runGhost(source, {
      extra: { localStorage: { getItem: () => { touches += 1; return null; }, setItem: () => { touches += 1; } } },
      body: `
        ghostRecordArm(); ghostRecordSpawn({}); ghostRecordTargetOutcome({},1); ghostRecordClank({},0);
        ghostRecordTap(0,100); ghostRecordFire(0,0,0); ghostRecordBpm(60); ghostRecordFinalize();
        this.recordState={record:_ghostRecord,targets:_ghostRecordTargets};
      `,
    });
    assert.equal(touches, 0); assert.equal(context.recordState.record, null); assert.equal(context.recordState.targets, null);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostRecordFinalize", (fn) => fn.replace("  if(!GH_RECORD) return;", "  localStorage.getItem(GH_STORE_KEY);\n  if(!GH_RECORD) return;"));
  mutationMustFail(assertContract, mutation, "the record-off test kills a pre-gate localStorage touch");
});


test("the recorder stays lesson-silent and measures a worthy night from graduation", () => {
  const assertContract = (source) => {
    let stored = "";
    const context = runGhost(source, {
      extra: {
        CFG: { ghostRecord: 1, ghostShare: 0, moonline: {}, rangeStart: 11 },
        state: { t: 20, bpm: 60, running: true, range: 10 }, trainMode: true, trainPhase: 2, trainWasd: 0, trainOrbs: 7,
        applySenseiFull() {}, resetPocketState() {}, specialOrbsLive: () => true, _specialLive: false, moonlineGraduate() {},
        showTrainCoach() {}, T: (_key, fallback) => fallback, showGhostToast() {}, _konamiGrad: true,
        setTimeout: () => 1, pocketLive: () => false, pocketUpdateLawHud() {},
        localStorage: { getItem: () => null, setItem: (_key, value) => { stored = value; } },
      },
      body: `
        ${extractFunction(source, "setTrainPhase")}
        const liveRecordArm=ghostRecordArm; let recordArmCalls=0;
        ghostRecordArm=()=>{ recordArmCalls++; return liveRecordArm(); };
        Tone.Transport.seconds=20; ghostSessionStart(); liveRecordArm(); this.lesson={armed:!!_ghostRecord,calls:recordArmCalls};
        Tone.Transport.seconds=30; setTrainPhase(3); this.graduated={armed:!!_ghostRecord,calls:recordArmCalls,base:_ghostRoadBase};
        for(let i=1;i<=8;i++){ Tone.Transport.seconds=30+i; state.t=i; const tg={mesh:{position:{x:0,z:-10}},expireAt:i+1}; ghostRecordSpawn(tg); ghostRecordTargetOutcome(tg,0); }
        Tone.Transport.seconds=75; ghostRecordFinalize();
      `,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(context.lesson)), { armed: false, calls: 0 });
    assert.deepEqual(JSON.parse(JSON.stringify(context.graduated)), { armed: true, calls: 1, base: 30 });
    const artifact = JSON.parse(stored).ghost;
    assert.equal(artifact.dur, 45, "lesson Transport time is excluded from the worthy Full Night");
    assert.deepEqual(artifact.bpmCurve, [[0, 60]]);
    assert.equal(artifact.targets.length, 8);
  };
  assertContract(html);
  let mutation = replaceFunction(html, "ghostRoadTime", (fn) => fn.replace("Tone.Transport.seconds-audioLat()-_ghostRoadBase", "Tone.Transport.seconds-audioLat()"));
  mutationMustFail(assertContract, mutation, "the duration oracle kills an absolute-Transport road clock");
  mutation = replaceFunction(html, "ghostRecordArm", (fn) => fn.replace("trainMode || ", ""));
  mutationMustFail(assertContract, mutation, "the lesson oracle kills a recorder that arms during training");
});


test("either false-start threshold preserves the prior worthy night", () => {
  const assertContract = (source) => {
    const attempt = (arrivals, duration) => {
      let writes = 0, slot = "REAL-NIGHT";
      runGhost(source, {
        record: true,
        extra: { localStorage: { getItem: () => slot, setItem: (_key, value) => { writes += 1; slot = value; } } },
        body: `
          ghostRecordArm();
          for(let i=0;i<${arrivals};i++){ const tg={mesh:{position:{x:0,z:-10}},expireAt:2}; ghostRecordSpawn(tg); ghostRecordTargetOutcome(tg,0); }
          Tone.Transport.seconds=${duration}; ghostRecordFinalize();
        `,
      });
      return { writes, preserved: slot === "REAL-NIGHT" };
    };
    assert.deepEqual(attempt(7, 45), { writes: 0, preserved: true }, "seven arrivals cannot replace the prior night");
    assert.deepEqual(attempt(8, 44), { writes: 0, preserved: true }, "44 seconds cannot replace the prior night");
    assert.deepEqual(attempt(8, 45), { writes: 1, preserved: false }, "eight arrivals at 45 seconds store the calibrated worthy night");
  };
  assertContract(html);
  mutationMustFail(assertContract, html.replace("GH_WORTHY_ARRIVALS=8", "GH_WORTHY_ARRIVALS=7"), "the threshold oracle kills a seven-arrival survivor");
  mutationMustFail(assertContract, html.replace("GH_WORTHY_ARRIVALS=8", "GH_WORTHY_ARRIVALS=9"), "the threshold oracle kills rejection of the exact eight-arrival bound");
  mutationMustFail(assertContract, html.replace("GH_WORTHY_DUR=45", "GH_WORTHY_DUR=44"), "the threshold oracle kills a 44-second survivor");
  mutationMustFail(assertContract, html.replace("GH_WORTHY_DUR=45", "GH_WORTHY_DUR=46"), "the threshold oracle kills rejection of the exact 45-second bound");
});


test("visibility hide, BFCache restore, resumed play, and Bow preserve the whole night", () => {
  const assertContract = (source) => {
    const listeners = { pagehide: [], visibilitychange: [] };
    const windowTarget = { addEventListener(type, handler) { listeners[type].push(handler); } };
    const documentTarget = { hidden: false, addEventListener(type, handler) { listeners[type].push(handler); } };
    let writes = 0, stored = "";
    const context = runGhost(source, {
      record: true,
      extra: {
        window: windowTarget, document: documentTarget,
        localStorage: { getItem: () => null, setItem: (_key, value) => { writes += 1; stored = value; } },
      },
      body: `
        ghostRecordArm();
        const liveFinalize=ghostRecordFinalize; let finalizeCalls=0;
        ghostRecordFinalize=pageExit=>{ finalizeCalls++; return liveFinalize(pageExit); };
        this.record=(count,start)=>{ for(let i=0;i<count;i++){ const tg={mesh:{position:{x:0,z:-10}},expireAt:2}; ghostRecordSpawn(tg); ghostRecordTargetOutcome(tg,0); } return _ghostRecord.targets.slice(start).map(row=>row[2]); };
        this.setSeconds=value=>{ Tone.Transport.seconds=value; };
        this.bowFinalize=()=>ghostRecordFinalizeOnce();
        this.counts=()=>({finalizeCalls,finalized:_ghostRecordFinalized,targets:_ghostRecord&&_ghostRecord.targets.length});
      `,
    });
    assert.equal(listeners.pagehide.length, 1); assert.equal(listeners.visibilitychange.length, 0, "tab visibility never owns a terminal recorder action");
    assert.deepEqual(Array.from(context.record(8, 0)), Array.from({ length: 8 }, (_unused, index) => index)); context.setSeconds(45);
    documentTarget.hidden = true; for (const handler of listeners.visibilitychange) handler();
    listeners.pagehide[0]({ persisted: true });
    assert.deepEqual({ ...context.counts() }, { finalizeCalls: 0, finalized: false, targets: 8 }, "a hidden or BFCache-bound tab keeps the recorder alive");
    documentTarget.hidden = false;
    assert.deepEqual(Array.from(context.record(4, 8)), [8, 9, 10, 11], "play after restore appends to the same ledger"); context.setSeconds(53); context.bowFinalize();
    const artifact = JSON.parse(stored).ghost;
    assert.equal(writes, 1); assert.equal(artifact.dur, 53); assert.deepEqual(artifact.targets.map(row => row[2]), Array.from({ length: 12 }, (_unused, index) => index), "Bow stores the prefix and resumed play as one whole night");
    assert.deepEqual({ ...context.counts() }, { finalizeCalls: 1, finalized: true, targets: null });
    assert.match(extractFunction(source, "ghostRecordFinalizeOnce"), /try\{ ghostRecordFinalize\(pageExit===true\); \}catch\(e\)\{\}/, "the once boundary forwards page-exit intent fail-soft");
    assert.match(extractFunction(source, "bowFinish"), /if\(GH_RECORD\) ghostRecordFinalizeOnce\(\);/, "the Bow remains the primary ordinary finalize tap");
  };
  assertContract(html);
  const mutation = html.replace("  window.addEventListener('pagehide',event=>{\n", "  document.addEventListener('visibilitychange',()=>{ if(document.hidden) ghostRecordFinalizeOnce(true); });\n  window.addEventListener('pagehide',event=>{\n");
  mutationMustFail(assertContract, mutation, "the hide/restore/play/Bow oracle kills a visibilitychange-finalizes survivor");
  assertContract(html);
});


test("an unworthy night finalized by pagehide preserves the prior stored night", () => {
  const assertContract = (source) => {
    const listeners = { pagehide: [] };
    let writes = 0, slot = "REAL-NIGHT";
    const context = runGhost(source, {
      record: true,
      extra: {
        window: { addEventListener(type, handler) { if(type === "pagehide") listeners.pagehide.push(handler); } },
        document: { hidden: false, addEventListener() {} },
        localStorage: { getItem: () => slot, setItem: (_key, value) => { writes += 1; slot = value; } },
      },
      body: `
        ghostRecordArm();
        for(let i=0;i<7;i++){ const tg={mesh:{position:{x:0,z:-10}},expireAt:2}; ghostRecordSpawn(tg); ghostRecordTargetOutcome(tg,0); }
        Tone.Transport.seconds=100;
        this.recordState=()=>({active:!!_ghostRecord,finalized:_ghostRecordFinalized});
      `,
    });
    assert.equal(listeners.pagehide.length, 1);
    listeners.pagehide[0]({ persisted: true }); listeners.pagehide[0]({});
    assert.deepEqual({ ...context.recordState(), writes, slot }, { active: true, finalized: false, writes: 0, slot: "REAL-NIGHT" }, "only an explicit persisted:false may consume the recorder");
    listeners.pagehide[0]({ persisted: false });
    assert.deepEqual({ ...context.recordState(), writes, slot }, { active: false, finalized: true, writes: 0, slot: "REAL-NIGHT" });
  };
  assertContract(html);
  const mutation = html.replace("_ghostRecordArrivals<GH_WORTHY_ARRIVALS || r.dur<GH_WORTHY_DUR", "_ghostRecordArrivals<GH_WORTHY_ARRIVALS && r.dur<GH_WORTHY_DUR");
  mutationMustFail(assertContract, mutation, "the pagehide oracle kills an unworthy-night overwrite survivor");
});


test("ghostRecord:0 wires no page lifecycle listeners", () => {
  const assertContract = (source) => {
    const wired = [];
    runGhost(source, {
      extra: {
        window: { addEventListener(type) { wired.push(["window", type]); } },
        document: { hidden: false, addEventListener(type) { wired.push(["document", type]); } },
      },
    });
    assert.deepEqual(wired, []);
  };
  assertContract(html);
  const mutation = html.replace("if(GH_RECORD && typeof window!=='undefined')", "if(typeof window!=='undefined')");
  mutationMustFail(assertContract, mutation, "the ghostRecord:0 oracle kills unconditional lifecycle wiring");
});


test("finalization validates inside its fail-soft boundary before replacing a worthy night", () => {
  const assertContract = (source) => {
    const attempt = (phasesToday) => {
      let writes = 0, slot = "REAL-NIGHT";
      assert.doesNotThrow(() => runGhost(source, {
        record: true,
        extra: { phasesToday, localStorage: { getItem: () => slot, setItem: (_key, value) => { writes += 1; slot = value; } } },
        body: `
          ghostRecordArm();
          for(let i=0;i<8;i++){ const tg={mesh:{position:{x:0,z:-10}},expireAt:2}; ghostRecordSpawn(tg); ghostRecordTargetOutcome(tg,0); }
          Tone.Transport.seconds=45; ghostRecordFinalize();
        `,
      }));
      return { writes, slot };
    };
    assert.deepEqual(attempt(() => "2026-99-99"), { writes: 0, slot: "REAL-NIGHT" });
    assert.deepEqual(attempt(() => { throw new Error("metadata unavailable"); }), { writes: 0, slot: "REAL-NIGHT" });
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostRecordFinalize", (fn) => fn
    .replace("if(!ghostArtifactValid(r)) return;", "ghostArtifactValid(r);")
    .replace("if(!ghostWrapperValid({ghost:r,mail})) return;", "ghostWrapperValid({ghost:r,mail});"));
  mutationMustFail(assertContract, mutation, "the finalize test kills bypassing both artifact and wrapper validation before storage");
});

test("a capped recording above the keepalive budget still uploads at the ordinary Bow", async () => {
  const requests = [];
  let stored = "";
  runGhost(html, {
    record: true, share: true,
    extra: { requests, localStorage: { getItem: () => null, setItem: (_key, value) => { stored = value; } } },
    body: `
      _ghostToken='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; ghostLonBucket=()=>7;
      ghostRelayFetch=(path,init)=>{ requests.push({path,init}); return Promise.resolve({ok:true}); };
      ghostRecordArm(); _ghostRecordArrivals=GH_WORTHY_ARRIVALS;
      _ghostRecord.bpmCurve=Array.from({length:200},(_x,i)=>[i*0.3,60+i/100]);
      _ghostRecord.targets=Array.from({length:1200},(_x,i)=>[i*0.04,i%4,i,i*0.04+0.02,0,null]);
      _ghostRecord.taps=Array.from({length:2400},(_x,i)=>[i*0.025,i%4,100]);
      _ghostRecord.fires=Array.from({length:1200},(_x,i)=>[i*0.05,3.1415,-1.5358,0]);
      Tone.Transport.seconds=64; ghostRecordFinalizeOnce(); ghostRecordFinalizeOnce();
    `,
  });
  await new Promise(setImmediate);
  assert.ok(Buffer.byteLength(stored) <= 100000);
  const saved = JSON.parse(stored);
  assert.deepEqual(saved.mail, []);
  assert.equal(requests.length, 1); assert.equal(requests[0].path, "/api/ghost");
  assert.ok(Buffer.byteLength(requests[0].init.body) > 65536);
  assert.deepEqual(JSON.parse(requests[0].init.body), { lonBucket: 7, artifact: saved.ghost });
  assert.equal(requests[0].init.keepalive, undefined);
  assert.match(extractFunction(html, "bowFinish"), /if\(GH_RECORD\) ghostRecordFinalizeOnce\(\);/);
});


test("the v1 validator is transport-complete for keys, civil date, slots, arrival order, and aim", () => {
  const assertContract = (source) => {
    const context = runGhost(source, { body: `
      const base={v:1,date:'2026-08-22',moonBucket:4,bpm0:60,dur:45,bpmCurve:[[0,60]],targets:[],taps:[],fires:[]};
      this.good=ghostArtifactValid(base);
      this.badCap=ghostArtifactValid({...base,targets:Array.from({length:1201},(_x,i)=>[0,0,i,1,0,null])});
      this.badOrder=ghostArtifactValid({...base,taps:[[2,0,90],[1,1,90]]});
      this.badHit=ghostArtifactValid({...base,targets:[[0,0,0,1,1,null]]});
      this.badVersion=ghostArtifactValid({...base,v:2});
      this.badDate=ghostArtifactValid({...base,date:'2026-02-31'});
      this.badExtra=ghostArtifactValid({...base,extra:true});
      this.badDuplicateSlot=ghostArtifactValid({...base,targets:[[0,0,7,2,0,null],[1,1,7,3,0,null]]});
      this.badUnsafeSlot=ghostArtifactValid({...base,targets:[[0,0,Number.MAX_SAFE_INTEGER+1,2,0,null]]});
      this.badLateHit=ghostArtifactValid({...base,targets:[[0,0,0,2,1,3]]});
      this.badYaw=ghostArtifactValid({...base,fires:[[1,Math.PI+0.01,0,0]]});
      this.badPitch=ghostArtifactValid({...base,fires:[[1,0,PITCH_LIMIT+0.01,0]]});
      this.badShort=ghostArtifactValid({...base,dur:44});
    ` });
    assert.ok(context.good);
    for (const key of ["badCap", "badOrder", "badHit", "badVersion", "badDate", "badExtra", "badDuplicateSlot", "badUnsafeSlot", "badLateHit", "badYaw", "badPitch", "badShort"]) assert.equal(context[key], null, `${key} is rejected`);
  };
  assertContract(html);
  mutationMustFail(assertContract, html.replace("GH_CAP_TARGETS=1200", "GH_CAP_TARGETS=1201"), "the validator test kills an expanded transport cap");
  mutationMustFail(assertContract, html.replace("!realCivilDate(value.date)", "!/^\\d{4}-\\d{2}-\\d{2}$/.test(value.date)"), "the validator test kills a shape-only civil date gate");
  mutationMustFail(assertContract, replaceFunction(html, "ghostArtifactValid", (fn) => fn.replace("if(keys.length!==GH_V1_KEYS.length) return null;", "if(keys.length<GH_V1_KEYS.length) return null;").replace("for(const key of keys) if(GH_V1_KEYS.indexOf(key)<0) return null;", "")), "the validator test kills an extra-key survivor");
  mutationMustFail(assertContract, html.replace("!Number.isSafeInteger(row[2])||row[2]<=priorSlot", "!Number.isInteger(row[2])||row[2]<0"), "the validator test kills duplicate and unsafe target slots");
  mutationMustFail(assertContract, html.replace("row[5]>row[3]||", ""), "the validator test kills a hit-after-arrival survivor");
  mutationMustFail(assertContract, html.replace("Math.abs(row[1])>GH_AIM_YAW_MAX||", ""), "the validator test kills an unbounded yaw survivor");
  mutationMustFail(assertContract, html.replace("Math.abs(row[2])>GH_AIM_PITCH_MAX||", ""), "the validator test kills an unbounded pitch survivor");
});


test("event taps are complete sinks and a recorder-to-gameplay cross-wire is rejected", () => {
  const assertContract = (source) => {
    const expected = [
      ["spawnTarget", /if\(GH_RECORD\) ghostRecordSpawn\(tg\);/g, 1],
      ["gradeRhythmHit", /if\(GH_RECORD\) ghostRecordTargetOutcome\(tg,1,fireRow\);/g, 2],
      ["clankShot", /if\(GH_RECORD\) ghostRecordClank\(tg,fireRow\);/g, 1],
      ["handleTankHit", /if\(GH_RECORD\) ghostRecordMarkFire\(fireRow,true\);/g, 1],
      ["onExpire", /if\(GH_RECORD\) ghostRecordTargetOutcome\(tg,0\);/g, 1],
      ["fire", /const fireRow=GH_RECORD\?ghostRecordFire\(ghostRoadTime\(\),yaw,pitch\):null;/g, 1],
      ["wasdLanePress", /if\(GH_RECORD\) ghostRecordTap\(k,k===ckey\?_tapAcc:-1\);/g, 1],
      ["changeBpm", /if\(GH_RECORD\) ghostRecordBpm\(state\.bpm\);/g, 1],
      ["bowFinish", /if\(GH_RECORD\) ghostRecordFinalizeOnce\(\);/g, 1],
      ["ghostSessionStart", /if\(GH_RECORD\) ghostRecordArm\(\);/g, 1],
    ];
    for (const [name, pattern, count] of expected) assert.equal((extractFunction(source, name).match(pattern) || []).length, count, `${name} owns its exact tap count`);
    assert.match(extractFunction(source, "resetSession"), /ghostSessionStart\(\);/);
    const approved = /if\(GH_RECORD\) ghostRecord(?:Spawn|TargetOutcome|Clank|MarkFire|Fire|Tap|Bpm|FinalizeOnce|Finalize|Arm)\([^;\n]*\);/g;
    for (const name of ["spawnTarget", "gradeRhythmHit", "clankShot", "handleTankHit", "onExpire", "fire", "wasdLanePress", "changeBpm", "bowFinish", "resetSession", "computeShotPlan", "spawnProjectile", "updateProjectiles", "updateArcPreview", "scopeLockTarget", "updateScope", "maybeAdjust"]) {
      const stripped = extractFunction(source, name).replace(approved, "").replace(/const fireRow=GH_RECORD\?ghostRecordFire\(ghostRoadTime\(\),yaw,pitch\):null;/g, "").replace(/ghostSessionStart\(\);/g, "");
      assert.doesNotMatch(stripped, /\b(?:GH_RECORD|ghostRecord\w*|_ghostRecord\w*|_ghostOwn|_ghostVisitors)\b/, `${name} cannot read Night Ghost state back`);
    }
    assert.doesNotMatch(ghostBlock(source), /\b(?:rnd|Math\.random)\s*\(/, "the renderer and recorder own no gameplay RNG draw");
  };
  assertContract(html);
  const mutation = html.replace("if(GH_RECORD) ghostRecordSpawn(tg);", "state.bpm+=_ghostOwn.bpm0;\n  if(GH_RECORD) ghostRecordSpawn(tg);");
  mutationMustFail(assertContract, mutation, "the isolation test kills a seat-to-spawn/difficulty cross-wire");
});


test("the remembered artifact preserves its prior-night palette seed and private stream", () => {
  const chalk = [0xbf7486, 0x6f91bc, 0x789b6b, 0xb99a49, 0x8d70ac, 0xc48465, 0x6ea895];
  const assertContract = (source) => {
    const context = runGhost(source, {
      extra: { ML_WALL_CHALK: chalk },
      body: `
        const record={date:'2026-08-22',moonBucket:4};
        this.seed=ghostNightSeed(record); this.palette=Array.from(ghostNightPalette(record,new Uint32Array(5)));
      `,
    });
    assert.equal(context.seed, 0x1620474b);
    assert.deepEqual(Array.from(context.palette), [0xb99a49, 0x789b6b, 0x6ea895, 0x8d70ac, 0x6f91bc]);
    assert.doesNotMatch(extractFunction(source, "ghostNightPalette"), /roadWallPalette\(/, "the prior night never reads today's cached palette");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostNightSeed", (fn) => fn.replace("0x9e3779b9", "0x9e3779b8"));
  mutationMustFail(assertContract, mutation, "the palette oracle kills a drifted course-seed mixer");
});


test("recording keeps monotonic latency-corrected road seconds and opaque projectile rows", () => {
  const assertContract = (source) => {
    const recorded = runGhost(source, {
      record: true,
      extra: { audioLat: () => 0.25 },
      body: `
        ghostRecordArm(); state.t=1; Tone.Transport.seconds=10;
        const tg={mesh:{position:{x:0,z:-10}},expireAt:6}; ghostRecordSpawn(tg);
        Tone.Transport.seconds=10.5; ghostRecordTap(0,100);
        Tone.Transport.seconds=10.1; ghostRecordTap(1,90);
        this.clockRows={target:Array.from(_ghostRecord.targets[0]),taps:_ghostRecord.taps.map(row=>Array.from(row))};
      `,
    }).clockRows;
    assert.deepEqual(Array.from(recorded.target), [9.75, 0, 0, 14.75, -1, null]);
    assert.deepEqual(Array.from(recorded.taps, (row) => Array.from(row)), [[10.25, 0, 100], [10.25, 1, 90]], "a paused offset rewind cannot unsort timestamps");

    const projectile = extractFunction(source, "spawnProjectile");
    assert.match(projectile, /pr\.fireRow=fireRow/);
    assert.doesNotMatch(projectile, /state\.t|recordT|fireT|fireBpm/, "the projectile carries only the opaque recorder row");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "ghostRecordSpawn", (fn) => fn.replace("const now=ghostRoadTime()", "const now=ghostTime(state.t)")), "the recorder oracle kills capped gameplay time at spawn");
  mutationMustFail(assertContract, replaceFunction(html, "ghostRoadTime", (fn) => fn.replace("if(raw<_ghostRoadLast) raw=_ghostRoadLast;", "")), "the pause oracle kills unsorted timestamps after an offset rewind");
});


test("recorder bodies preserve proxied gameplay state and both gameplay RNG streams", () => {
  const assertContract = (source) => {
    const writes = [], gameplay = { t: 2, bpm: 60, running: true, range: 18, hits: 4, shots: 5, streak: 3 };
    const state = new Proxy(gameplay, { set(target, key, value) { writes.push([String(key), value]); target[key] = value; return true; } });
    const rng = { seed: 0x12345678, calls: 0 };
    const next = () => { rng.calls += 1; rng.seed = (Math.imul(rng.seed, 1664525) + 1013904223) >>> 0; return rng.seed / 4294967296; };
    const trackedMath = Object.create(Math); trackedMath.random = next;
    const before = JSON.stringify(gameplay), rngBefore = { ...rng };
    runGhost(source, {
      record: true,
      extra: { state, Math: trackedMath, rnd: next },
      body: `
        Tone.Transport.seconds=2; ghostRecordArm();
        const live={mesh:{position:{x:0,z:-10}},expireAt:8}; ghostRecordSpawn(live); ghostRecordTap(0,100); ghostRecordFire(ghostRoadTime(),0.2,-0.1);
      `,
    });
    assert.equal(JSON.stringify(gameplay), before, "gameplay state is byte-stable across recorder bodies");
    assert.deepEqual(writes, [], "the state proxy observes no hidden write");
    assert.deepEqual(rng, rngBefore, "neither rnd nor Math.random advances");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "ghostRecordSpawn", (fn) => fn.replace("const r=", "state.bpm+=1; const r=")), "the snapshot oracle kills the review's recorder-body bpm survivor");
  mutationMustFail(assertContract, replaceFunction(html, "ghostRecordSpawn", (fn) => fn.replace("const r=", "rnd(); const r=")), "the RNG snapshot kills a recorder-body gameplay draw");
});
