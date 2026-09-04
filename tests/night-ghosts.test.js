"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
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

function runGhost(source, { record = false, seat = false, gift = false, share = false, phase = false, low = false, extra = {}, body = "" } = {}) {
  const context = vm.createContext({
    Math, Number, JSON, WeakMap, Float32Array, Uint16Array,
    CFG: { ghostRecord: record ? 1 : 0, ghostSeat: seat ? 1 : 0, ghostGift: gift ? 1 : 0, ghostShare: share ? 1 : 0, ghostPhase: phase ? 1 : 0, moonline: {} }, LOW: low,
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

function withGhostFlags(source, record, seat, gift, share, phase) {
  return source.replace(/ghostRecord:[01]/, `ghostRecord:${record ? 1 : 0}`).replace(/ghostSeat:[01]/, `ghostSeat:${seat ? 1 : 0}`).replace(/ghostGift:[01]/, `ghostGift:${gift ? 1 : 0}`).replace(/ghostShare:[01]/, `ghostShare:${share ? 1 : 0}`).replace(/ghostPhase:[01]/, `ghostPhase:${phase ? 1 : 0}`);
}

test("MY emitted road and wall family stays on its frozen bytes in all thirty-two ghost flag combinations", () => {
  const assertContract = (source) => {
    for (const record of [false, true]) for (const seat of [false, true]) for (const gift of [false, true]) for (const share of [false, true]) for (const phase of [false, true]) {
      const variant = withGhostFlags(source, record, seat, gift, share, phase);
      assert.deepEqual(emissionFingerprint(variant, false), emissionFixture.high, `HIGH remains frozen at record=${+record}, seat=${+seat}, gift=${+gift}, share=${+share}, phase=${+phase}`);
      assert.deepEqual(emissionFingerprint(variant, true), emissionFixture.low, `LOW remains frozen at record=${+record}, seat=${+seat}, gift=${+gift}, share=${+share}, phase=${+phase}`);
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
    const artifact = JSON.parse(stored);
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

test("the dormant phase archive keeps one bounded worthy night per moon bucket after the ordinary save", () => {
  const assertContract = (source) => {
    assert.match(source, /ghostPhase:0,\s+\/\/ THE MOON REMEMBERS YOU/);
    const prior = { v: 1, date: "2026-07-03", moonBucket: 2, bpm0: 60, dur: 60, bpmCurve: [[0, 60]], targets: [], taps: [], fires: [] };
    const exercise = (phase, quota = false, phaseValue = JSON.stringify({ v: 1, slots: { 2: prior } })) => {
      const values = new Map([["aimdojo.ghostPhase", phaseValue]]), operations = [];
      runGhost(source, {
        record: true, phase,
        extra: { localStorage: {
          getItem(key) { operations.push(["get", key]); return values.get(key) || null; },
          setItem(key, value) { operations.push(["set", key]); if(quota && key === "aimdojo.ghostPhase") throw new Error("quota"); values.set(key, value); },
        } },
        body: `
          ghostRecordArm();
          for(let i=0;i<8;i++){ const tg={mesh:{position:{x:i%4,z:-10}},expireAt:2}; ghostRecordSpawn(tg); ghostRecordTargetOutcome(tg,0); }
          Tone.Transport.seconds=45; ghostRecordFinalize();
        `,
      });
      return { values, operations };
    };
    const off = exercise(false);
    assert.deepEqual(off.operations, [["set", "aimdojo.ghost"]], "ghostPhase:0 never opens the archive key");
    const on = exercise(true), archive = JSON.parse(on.values.get("aimdojo.ghostPhase"));
    assert.deepEqual(on.operations.map((row) => row.join(":")), ["set:aimdojo.ghost", "get:aimdojo.ghostPhase", "set:aimdojo.ghostPhase"], "the phase copy follows the safe ordinary save");
    assert.deepEqual(Object.keys(archive), ["v", "slots"]); assert.deepEqual(Object.keys(archive.slots), ["2", "4"]);
    assert.deepEqual(archive.slots[2], prior); assert.equal(archive.slots[4].date, "2026-08-22"); assert.equal(archive.slots[4].moonBucket, 4);
    const quota = exercise(true, true);
    assert.ok(quota.values.get("aimdojo.ghost"), "a phase quota failure cannot cost the ordinary worthy night");
    assert.equal(quota.values.get("aimdojo.ghostPhase"), JSON.stringify({ v: 1, slots: { 2: prior } }), "the failed copy leaves the prior archive alone");
    const recovered = exercise(true, false, "{");
    let recoveredArchive=null; try{ recoveredArchive=JSON.parse(recovered.values.get("aimdojo.ghostPhase")); }catch(_error){}
    assert.deepEqual(recoveredArchive&&Object.keys(recoveredArchive.slots), ["4"], "a malformed stale archive cannot block the next worthy moon copy");
    const phaseFns = ["ghostPhaseSlots", "ghostPhaseRead", "ghostPhaseWrite"].map((name) => extractFunction(source, name)).join("\n");
    assert.doesNotMatch(phaseFns, /\bfetch\s*\(|ghostRelay|ghostShareUpload/, "the phase archive has no transport path");
    assert.match(source, /GH_PHASE_MAX_BYTES=GH_MAX_BYTES\*8\+1024/);
  };
  assertContract(html);
  let mutation = replaceFunction(html, "ghostRecordFinalize", (fn) => fn.replace("    if(GH_PHASE) ghostPhaseWrite(r);", ""));
  mutationMustFail(assertContract, mutation, "the archive oracle kills a worthy night omitted from its moon slot");
  mutation = replaceFunction(html, "ghostPhaseWrite", (fn) => fn.replace("slots[String(record.moonBucket)]=record;", "slots['0']=record;"));
  mutationMustFail(assertContract, mutation, "the bucket oracle kills a phase copy written under the wrong moon");
  mutation = replaceFunction(html, "ghostPhaseWrite", (fn) => fn.replace("try{ const prior=raw?ghostPhaseSlots(JSON.parse(raw)):null; if(prior) slots=prior; }catch(e){}", "const prior=raw?ghostPhaseSlots(JSON.parse(raw)):null; if(prior) slots=prior;"));
  mutationMustFail(assertContract, mutation, "the recovery oracle kills a malformed archive blocking the next worthy moon copy");
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
    const artifact = JSON.parse(stored);
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
    assert.equal((extractFunction(source, "updateProjectiles").match(/pr\.fireRow/g) || []).length, 4);
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
        CFG: { ghostRecord: 1, ghostSeat: 0, moonline: {}, tank: { fillOnly: false } },
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
    const artifact = JSON.parse(stored);
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
        CFG: { ghostRecord: 1, ghostSeat: 0, ghostGift: 0, ghostShare: 0, moonline: {}, rangeStart: 11 },
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
    const artifact = JSON.parse(stored);
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
    const artifact = JSON.parse(stored);
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
  mutationMustFail(assertContract, html.replace("if(!ghostArtifactValid(r)) return;", "ghostArtifactValid(r);"), "the finalize test kills the demonstrated invalid overwrite survivor");
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
    assert.match(extractFunction(source, "ghostSessionStart"), /if\(GH_SEAT\) ghostSeatReset\(\);/);
    assert.match(extractFunction(source, "resetSession"), /ghostSessionStart\(\);/);
    assert.match(extractFunction(source, "animate"), /if\(GH_SEAT\) try\{ ghostSeatUpdate\(dt\); \}catch/);
    const approved = /if\(GH_RECORD\) ghostRecord(?:Spawn|TargetOutcome|Clank|MarkFire|Fire|Tap|Bpm|FinalizeOnce|Finalize|Arm)\([^;\n]*\);/g;
    for (const name of ["spawnTarget", "gradeRhythmHit", "clankShot", "handleTankHit", "onExpire", "fire", "wasdLanePress", "changeBpm", "bowFinish", "resetSession", "computeShotPlan", "spawnProjectile", "updateProjectiles", "updateArcPreview", "scopeLockTarget", "updateScope", "maybeAdjust"]) {
      const stripped = extractFunction(source, name).replace(approved, "").replace(/const fireRow=GH_RECORD\?ghostRecordFire\(ghostRoadTime\(\),yaw,pitch\):null;/g, "").replace(/ghostSessionStart\(\);/g, "");
      assert.doesNotMatch(stripped, /\b(?:GH_RECORD|GH_SEAT|ghostRecord\w*|ghostSeat\w*|_ghostRecord\w*|_ghostSeat\w*)\b/, `${name} cannot read Night Ghost state back`);
    }
    assert.doesNotMatch(ghostBlock(source), /\b(?:rnd|Math\.random)\s*\(/, "the renderer and recorder own no gameplay RNG draw");
  };
  assertContract(html);
  const mutation = html.replace("if(GH_RECORD) ghostRecordSpawn(tg);", "state.bpm+=_ghostSeatRecord.bpm0;\n  if(GH_RECORD) ghostRecordSpawn(tg);");
  mutationMustFail(assertContract, mutation, "the isolation test kills a seat-to-spawn/difficulty cross-wire");
});

test("uK hundredths drive the exact reveal and v=0 suppresses every seat draw", () => {
  const assertContract = (source) => {
    const context = runGhost(source, { body: `
      this.reveal=[0.03,0.02,2.01,1.03,2.03,0.03].map(kind=>ghostSeatReveal(0,0,[kind]));
      _ghostSeatRecord={};
      _ghostSeatRoot={visible:true}; _ghostRoad={visible:true}; _ghostWalls={visible:true}; _ghostAvatar={visible:true}; _ghostAvatarBody={visible:true}; _ghostAvatarHalo={visible:true}; _ghostAvatarBow={visible:true}; _ghostTargets={visible:true}; _ghostBursts={visible:true};
      _ghostBeaconRoot={visible:false}; _ghostBeaconCols={visible:false}; _ghostBeaconRings={visible:false}; _ghVis={value:9}; _ghBeacon={value:0};
      ghostSeatApplyVisibility(0,1,1); ghostSeatBeaconVisibility(1);
      this.visibility={seat:[_ghostSeatRoot,_ghostRoad,_ghostWalls,_ghostAvatar,_ghostAvatarBody,_ghostAvatarHalo,_ghostAvatarBow,_ghostTargets,_ghostBursts].map(x=>x.visible),beacon:[_ghostBeaconRoot.visible,_ghostBeaconCols.visible,_ghostBeaconRings.visible],uVis:_ghVis.value};
    ` });
    assert.deepEqual(Array.from(context.reveal), [0, 0.35, 0.7, 1, 1, 0]);
    assert.deepEqual(Array.from(context.visibility.seat), [false, false, false, false, false, false, false, false, false]);
    assert.deepEqual(Array.from(context.visibility.beacon), [true, true, true]); assert.equal(context.visibility.uVis, 0);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostSeatApplyVisibility", (fn) => fn.replace("v>0", "v>=0"));
  mutationMustFail(assertContract, mutation, "the visibility test kills the seat-draws-at-v=0 mutant");
});

test("lazy ghost-seat construction schedules one bounded idle shader re-warm after the build", () => {
  const assertContract = (source) => {
    const build = extractFunction(source, "ghostSeatBuild");
    const calls = [...build.matchAll(/runIdle\(\(\)=>\{ try\{ renderer\.compile\(scene,camera\); \}catch\(e\)\{\} \},(\d+),(\d+)\);/g)];
    assert.equal(calls.length, 1, "the completed lazy seat schedules exactly one renderer compile");
    const visibilityAt = build.lastIndexOf("ghostSeatApplyVisibility(0,0,0); ghostSeatBeaconVisibility(0);");
    assert.ok(visibilityAt >= 0 && calls[0].index > visibilityAt, "the re-warm is scheduled only after every seat object and effect exists");
    const delay = Number(calls[0][1]), timeout = Number(calls[0][2]);
    assert.ok(delay >= 100 && delay <= 500, `fallback delay ${delay} stays in the quiet opening`);
    assert.ok(timeout >= 1000 && timeout <= 2500 && timeout > delay, `idle timeout ${timeout} is bounded beyond the fallback delay`);
    assert.match(build.slice(visibilityAt, calls[0].index), /the game slows down when playing after a bit/, "the decision comment names the user's report");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostSeatBuild", (fn) => fn.replace("  runIdle(()=>{ try{ renderer.compile(scene,camera); }catch(e){} },180,1800);\n", ""));
  mutationMustFail(assertContract, mutation, "the lazy-seat warm contract kills removal of the scheduled compile");
});

test("every ghost lane tint comes from WASD_COL mixed toward the named moon blue", () => {
  const assertContract = (source) => {
    const block = ghostBlock(source), laneHex = source.match(/WASD_HEX=\[([^\]]+)\]/);
    assert.ok(laneHex, "the shipped lane literals are discoverable only as forbidden mutant needles");
    for (const literal of laneHex[1].split(",").map((value) => value.trim())) assert.ok(!block.toLowerCase().includes(literal.toLowerCase()), `Night Ghosts contains no lane literal ${literal}`);
    assert.match(block, /GH_MOON_BLUE=0x9fc2ec/);
    assert.match(extractFunction(source, "ghostSeatBuild"), /new THREE\.Color\(\)\.setStyle\(WASD_COL\[lane\]\)\.lerp\(_ghMoon,GH_LANE_MIX\)/);
    assert.match(extractFunction(source, "ghostLaneColor"), /return out\.copy\(_ghLane\[/);
    for (const name of ["ghostSeatUpdateTargets", "ghostSeatUpdateBursts"]) {
      const fn = extractFunction(source, name);
      for (const call of fn.matchAll(/setColorAt\([^;]+/g)) if (!/_ghWhite/.test(call[0])) assert.match(call[0], /ghostLaneColor\(/, `${name} routes lane tint through the authority`);
    }
  };
  assertContract(html);
  const mutation = html.replace("new THREE.Color().setStyle(WASD_COL[lane])", "new THREE.Color(0x43d9ff)");
  mutationMustFail(assertContract, mutation, "the lane authority test kills a literal cyan ghost tint");
});

test("the ghost reconstructs the prior night's shipped course seed and private wall-palette stream", () => {
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
    assert.doesNotMatch(extractFunction(source, "ghostSeatPalette"), /roadWallPalette\(/, "the prior night never reads today's cached palette");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostNightSeed", (fn) => fn.replace("0x9e3779b9", "0x9e3779b8"));
  mutationMustFail(assertContract, mutation, "the palette oracle kills a drifted course-seed mixer");
});

function threeHarness() {
  class Vector3 { constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } setScalar(value) { return this.set(value, value, value); } copy(value) { return this.set(value.x || 0, value.y || 0, value.z || 0); } }
  class Quaternion { setFromAxisAngle() { return this; } }
  class Matrix4 { compose() { return this; } }
  class Color { constructor(value) { this.value = value; } setHex(value) { this.value = value; return this; } setStyle(value) { this.value = value; return this; } lerp() { return this; } copy(value) { this.value = value.value; return this; } }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; } }
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(name, value) { this.attributes[name] = value; return this; } setIndex(value) { this.index = value; return this; } }
  class Object3D { constructor() { this.children = []; this.visible = true; this.position = new Vector3(); this.scale = new Vector3(1, 1, 1); this.rotation = { set() {} }; } add(child) { this.children.push(child); child.parent = this; } }
  class Group extends Object3D {}
  class Mesh extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
  class InstancedMesh extends Mesh { constructor(geometry, material, max) { super(geometry, material); this.max = max; this.count = 0; this.instanceMatrix = { setUsage() {}, needsUpdate: false }; this.instanceColor = null; } setMatrixAt() {} setColorAt() {} }
  class ShaderMaterial { constructor(settings) { Object.assign(this, settings); } }
  class BoxGeometry extends BufferGeometry {} class ConeGeometry extends BufferGeometry {} class SphereGeometry extends BufferGeometry {} class TorusGeometry extends BufferGeometry {}
  return { Vector3, Quaternion, Matrix4, Color, BufferAttribute, Float32BufferAttribute: BufferAttribute, InstancedBufferAttribute: BufferAttribute, BufferGeometry, Group, Mesh, InstancedMesh, ShaderMaterial, BoxGeometry, ConeGeometry, SphereGeometry, TorusGeometry, DoubleSide: 2, AdditiveBlending: 3, DynamicDrawUsage: 4 };
}

function builtSeat(source, low) {
  const sceneAdds = [], THREE = threeHarness();
  const context = runGhost(source, {
    seat: true, low,
    extra: { THREE, scene: { add(value) { sceneAdds.push(value); } }, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
    body: `
      const record={v:1,date:'2026-08-22',moonBucket:4,bpm0:60,dur:60,bpmCurve:[[0,60]],targets:[],taps:[],fires:[]};
      _ghostSeatRecord=record; ghostSeatBuild(record);
      const drawList=()=>[_ghostRoad,_ghostWalls,_ghostTargets,_ghostAvatarBody,_ghostAvatarHalo,_ghostAvatarBow,_ghostBursts,_ghostBeaconCols,_ghostBeaconRings].filter(x=>x&&x.visible).length;
      ghostSeatApplyVisibility(0,1,1); ghostSeatBeaconVisibility(0); const work=drawList();
      ghostSeatApplyVisibility(0,1,1); ghostSeatBeaconVisibility(1); const workBeacon=drawList();
      ghostSeatApplyVisibility(1,1,1); ghostSeatBeaconVisibility(1); const reveal=drawList();
      _ghActiveTargets.push([0,1,0,2,0,null]); ghostSeatUpdateTargets(1,true);
      this.built={work,workBeacon,reveal,walls:!!_ghostWalls,bursts:!!_ghostBursts,bow:!!_ghostAvatarBow,ringInstances:_ghostBeaconRings.count,ringMax:_ghostBeaconRings.max};
    `,
  });
  context.built.sceneAdds = sceneAdds.length;
  return { ...context.built };
}

test("the separate seat keeps locked geometry and bounded HIGH/LOW draw families", () => {
  const assertContract = (source) => {
    const block = ghostBlock(source);
    assert.match(block, /GH_SEAT_X=90/); assert.match(block, /GH_ROAD_HALF=7/); assert.match(block, /GH_WALL_SOLID=24, GH_WALL_POWDER=38, GH_WALL_Y0=-24, GH_WALL_Y1=21/);
    assert.match(block, /GH_LOW_TARGET_MAX=24, GH_HIGH_TARGET_MAX=48, GH_LOW_BURST_MAX=0, GH_HIGH_BURST_MAX=24/);
    assert.match(extractFunction(source, "ghostRoadGeometry"), /for\(const x of \[x0,x1\]\) for\(const y of \[1\.8,3\.6\]\)/);
    assert.match(extractFunction(source, "ghostWallMaterial"), /smoothstep\('\+_roadG\(GH_WALL_SOLID\)\+','\+_roadG\(GH_WALL_POWDER\)/);
    assert.deepEqual(builtSeat(source, false), { work: 0, workBeacon: 2, reveal: 9, walls: true, bursts: true, bow: true, ringInstances: 2, ringMax: 16, sceneAdds: 2 });
    assert.deepEqual(builtSeat(source, true), { work: 0, workBeacon: 2, reveal: 7, walls: false, bursts: false, bow: true, ringInstances: 2, ringMax: 16, sceneAdds: 2 });
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostSeatBuild", (fn) => fn.replace("if(!LOW){ _ghostWalls", "if(true){ _ghostWalls"));
  mutationMustFail(assertContract, mutation, "the tier test kills LOW ghost-wall allocation");
});

test("the lighthouse and avatar expose named presence, halo, bow, and yaw contracts", () => {
  const assertContract = (source) => {
    const block = ghostBlock(source), build = extractFunction(source, "ghostSeatBuild"), instances = extractFunction(source, "ghostInstanceMaterial"), advance = extractFunction(source, "ghostSeatAdvance");
    assert.match(block, /GH_BEACON_ALPHA=0\.78, GH_BEACON_WIDTH=1\.6, GH_BEACON_HEIGHT=40, GH_BEACON_RING_RADIUS=1\.05, GH_BEACON_RING_TUBE=0\.10, GH_BEACON_HALO_RADIUS=2\.6/);
    assert.match(build, /ghostInstanceMaterial\(GH_BEACON_ALPHA\*_ghSeatAlpha,_ghBeacon\)/);
    assert.match(build, /new THREE\.BoxGeometry\(GH_BEACON_WIDTH,GH_BEACON_HEIGHT,GH_BEACON_WIDTH\)/);
    assert.match(instances, /gl_FragColor=vec4\(vCol,a\)/);
    assert.doesNotMatch(instances, /vec4\(vCol\*a,a\)/, "additive RGB is not alpha-premultiplied twice");
    assert.match(build, /_ghostAvatarBow=new THREE\.Mesh\(new THREE\.BoxGeometry\(GH_AVATAR_BOW_WIDTH,GH_AVATAR_BOW_HEIGHT,GH_AVATAR_BOW_LENGTH\)/);
    assert.match(advance, /GH_AVATAR_YAW_SIGN\*fire\[1\]/);
    for (const low of [false, true]) {
      const seat = builtSeat(source, low);
      assert.equal(seat.workBeacon, 2, "column plus shared ring/halo family remain two beacon draws");
      assert.equal(seat.ringInstances, 2, "one missed note emits its note ring and lighthouse halo");
      assert.equal(seat.bow, true, "the directional bow element is allocated in both tiers");
    }
  };
  assertContract(html);
  mutationMustFail(assertContract, html.replace("GH_BEACON_ALPHA=0.78", "GH_BEACON_ALPHA=0.48"), "the lighthouse test kills the under-read beacon alpha");
  mutationMustFail(assertContract, replaceFunction(html, "ghostSeatUpdateTargets", (fn) => fn.replace("ringN+=2;", "ringN++;")), "the lighthouse test kills a hidden halo instance");
});

test("the ghost bow follows the gameplay aim direction for recorded yaw", () => {
  const assertContract = (source) => {
    const yaws = [-0.4, 0.4, 1.1];
    const aimContext = vm.createContext({ Math });
    new vm.Script(`${extractFunction(source, "setAimDir")}\nthis.aimX=value=>setAimDir({set(x){ this.x=x; return this; }},0,value).x;`).runInContext(aimContext);
    const replay = runGhost(source, {
      seat: true,
      body: `
        _ghostSeatRecord={targets:[],fires:[[0,-0.4,0,0],[1,0.4,0,0],[2,1.1,0,0]]};
        _ghActiveTargets=[]; _ghHitRows=[];
        _ghostAvatar={rotation:{y:0,set(_pitch,value){ this.y=value; }}};
        this.bowX=[];
        for(let i=0;i<3;i++){ ghostSeatAdvance(i); this.bowX.push(-Math.sin(_ghostAvatar.rotation.y)); }
      `,
    });
    for (let index = 0; index < yaws.length; index += 1) {
      assert.ok(Math.abs(replay.bowX[index] - aimContext.aimX(yaws[index])) < 1e-12, `yaw ${yaws[index]} keeps the bow on gameplay's x aim`);
    }
  };
  assertContract(html);
  const mutation = html.replace("GH_AVATAR_YAW_SIGN=1", "GH_AVATAR_YAW_SIGN=-1");
  mutationMustFail(assertContract, mutation, "the aim-direction oracle kills mirrored ghost yaw");
  assertContract(html);
});

test("seat-off is allocation/storage silent and replay frame bodies stay on the road authority", () => {
  const assertContract = (source) => {
    let allocations = 0, touches = 0;
    const THREE = new Proxy({}, { get: () => class { constructor() { allocations += 1; } } });
    const context = runGhost(source, {
      extra: { THREE, localStorage: { getItem: () => { touches += 1; return null; }, setItem: () => { touches += 1; } } },
      body: `
        ghostSeatRead(); ghostSeatReset(); ghostSeatUpdate(0.016);
        _ghostSeatRecord={bpm0:60,bpmCurve:[[0,60],[10,120]]}; _ghBeatPrefix=[0,10]; _ghBpmCursor=0; this.beat=ghostSeatBeatAt(15);
        this.roots=[_ghostSeatRoot,_ghostBeaconRoot];
      `,
    });
    assert.equal(allocations, 0); assert.equal(touches, 0); assert.deepEqual(Array.from(context.roots), [null, null]); assert.equal(context.beat, 20);
    const frame = ["ghostSeatUpdate", "ghostSeatBeatAt", "ghostSeatAdvance", "ghostSeatUpdateTargets", "ghostSeatUpdateBursts"].map((name) => extractFunction(source, name)).join("\n");
    assert.doesNotMatch(frame, /Date\.now|performance\.now|\bnew\s+THREE\b/);
    assert.doesNotMatch(frame, /state\.t/, "replay never consumes capped gameplay time");
    assert.match(extractFunction(source, "ghostRoadTime"), /Tone\.Transport\.seconds-audioLat\(\)/, "the shared authority is heard Transport seconds");
    assert.match(extractFunction(source, "ghostSeatUpdateBursts"), /const travel=reduceMotion\?0:age/);
    assert.match(extractFunction(source, "ghostSeatUpdateTargets"), /breath=reduceMotion\?1:/);
    assert.doesNotMatch(ghostBlock(source), /PLAYER_POS(?:\.(?:set|copy|add|sub|multiply)\s*\(|\s*=|\.[xyz]\s*=|\[['"][xyz]['"]\]\s*=)/, "the seat never moves the player treadmill authority");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostSeatUpdate", (fn) => fn.replace("const roadT=", "Date.now(); const roadT="));
  mutationMustFail(assertContract, mutation, "the one-clock test kills a wall-clock frame read");
});

test("recording and slow-frame replay share monotonic latency-corrected road seconds", () => {
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

    const replay = runGhost(source, {
      seat: true,
      extra: { audioLat: () => 0.5 },
      body: `
        _ghostSeatRecord={dur:60,bpm0:60,bpmCurve:[[0,60]],targets:[],taps:[],fires:[]}; _ghostSeatRoot={}; _ghBeat={value:0}; _ghBeatPrefix=[0]; _ghBpmCursor=0;
        ghostSeatAdvance=t=>{ this.replayT=t; }; ghostSeatUpdateTargets=()=>({targets:0,beacons:0}); ghostSeatUpdateBursts=()=>0; ghostSeatApplyVisibility=()=>{}; ghostSeatBeaconVisibility=()=>{};
        state.t=1; Tone.Transport.seconds=12; ghostSeatUpdate(0.05);
      `,
    });
    assert.equal(replay.replayT, 11.5, "slow frames follow Transport rather than capped state.t");
    const projectile = extractFunction(source, "spawnProjectile");
    assert.match(projectile, /pr\.fireRow=fireRow/);
    assert.doesNotMatch(projectile, /state\.t|recordT|fireT|fireBpm/, "the projectile carries only the opaque recorder row");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "ghostSeatUpdate", (fn) => fn.replace("ghostRoadTime()", "state.t*0.1")), "the behavioral oracle kills the review's state.t replay survivor");
  mutationMustFail(assertContract, replaceFunction(html, "ghostRecordSpawn", (fn) => fn.replace("const now=ghostRoadTime()", "const now=ghostTime(state.t)")), "the recorder oracle kills capped gameplay time at spawn");
  mutationMustFail(assertContract, replaceFunction(html, "ghostRoadTime", (fn) => fn.replace("if(raw<_ghostRoadLast) raw=_ghostRoadLast;", "")), "the pause oracle kills unsorted timestamps after an offset rewind");
});

test("replay resets before beat integration and bpm0 owns time before a retained first row", () => {
  const assertContract = (source) => {
    const context = runGhost(source, {
      seat: true,
      body: `
        _ghostSeatRecord={dur:60,bpm0:60,bpmCurve:[[0,60],[10,120]],targets:[],taps:[],fires:[]};
        _ghActiveTargets=[]; _ghHitRows=[]; _ghBeatPrefix=[]; _ghBeat={value:0}; _ghostSeatRoot={}; ghostSeatPrepare(_ghostSeatRecord);
        ghostSeatUpdateTargets=()=>({targets:0,beacons:0}); ghostSeatUpdateBursts=()=>0; ghostSeatApplyVisibility=()=>{}; ghostSeatBeaconVisibility=()=>{};
        let roadT=15; ghostRoadTime=()=>roadT; ghostSeatUpdate(0.05); const forward=_ghBeat.value;
        roadT=5; ghostSeatUpdate(0.05); const rewind=_ghBeat.value;
        _ghostSeatRecord={dur:60,bpm0:60,bpmCurve:[[10,120]],targets:[],taps:[],fires:[]}; _ghActiveTargets=[]; _ghHitRows=[]; _ghBeatPrefix=[]; ghostSeatPrepare(_ghostSeatRecord);
        const capped=[0,5,10,11].map(t=>ghostSeatBeatAt(t)); this.replayLaw={forward,rewind,capped};
      `,
    }).replayLaw;
    assert.equal(context.forward, 20);
    assert.equal(context.rewind, 5, "the rewind frame resets cursors before integrating its beat");
    assert.deepEqual(Array.from(context.capped), [0, 5, 10, 12], "bpm0 integrates up to the first retained curve row");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "ghostSeatUpdate", (fn) => fn.replace("ghostSeatAdvance(t); _ghBeat.value=ghostSeatBeatAt(t);", "_ghBeat.value=ghostSeatBeatAt(t); ghostSeatAdvance(t);")), "the rewind oracle kills beat-before-reset ordering");
  mutationMustFail(assertContract, replaceFunction(html, "ghostSeatBeatAt", (fn) => fn.replace("if(t<curve[0][0]) return t*record.bpm0/60;", "")), "the capped-curve oracle kills a frozen pre-row replay");
});

test("recorder and seat bodies preserve proxied gameplay state and both gameplay RNG streams", () => {
  const assertContract = (source) => {
    const writes = [], gameplay = { t: 2, bpm: 60, running: true, range: 18, hits: 4, shots: 5, streak: 3 };
    const state = new Proxy(gameplay, { set(target, key, value) { writes.push([String(key), value]); target[key] = value; return true; } });
    const rng = { seed: 0x12345678, calls: 0 };
    const next = () => { rng.calls += 1; rng.seed = (Math.imul(rng.seed, 1664525) + 1013904223) >>> 0; return rng.seed / 4294967296; };
    const trackedMath = Object.create(Math); trackedMath.random = next;
    const THREE = threeHarness(), before = JSON.stringify(gameplay), rngBefore = { ...rng };
    runGhost(source, {
      record: true, seat: true,
      extra: { state, Math: trackedMath, rnd: next, THREE, scene: { add() {} }, TARGET_CORE_GEO: new THREE.BufferGeometry(), _flockGeo: new THREE.BufferGeometry() },
      body: `
        Tone.Transport.seconds=2; ghostRecordArm();
        const live={mesh:{position:{x:0,z:-10}},expireAt:8}; ghostRecordSpawn(live); ghostRecordTap(0,100); ghostRecordFire(ghostRoadTime(),0.2,-0.1);
        const record={v:1,date:'2026-08-22',moonBucket:4,bpm0:60,dur:60,bpmCurve:[[0,60]],targets:[],taps:[],fires:[]};
        _ghostSeatRecord=record; ghostSeatBuild(record); _ghActiveTargets.push([0,1,0,4,0,null]); ghostSeatUpdateTargets(2,true);
      `,
    });
    assert.equal(JSON.stringify(gameplay), before, "gameplay state is byte-stable across recorder and seat bodies");
    assert.deepEqual(writes, [], "the state proxy observes no hidden write");
    assert.deepEqual(rng, rngBefore, "neither rnd nor Math.random advances");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "ghostRecordSpawn", (fn) => fn.replace("const r=", "state.bpm+=1; const r=")), "the snapshot oracle kills the review's recorder-body bpm survivor");
  mutationMustFail(assertContract, replaceFunction(html, "ghostSeatUpdateTargets", (fn) => fn.replace("let targetN=", "state.bpm+=1; let targetN=")), "the snapshot oracle kills the review's seat-body bpm survivor");
  mutationMustFail(assertContract, replaceFunction(html, "ghostSeatUpdateTargets", (fn) => fn.replace("let targetN=", "rnd(); let targetN=")), "the RNG snapshot kills a seat-body gameplay draw");
});
