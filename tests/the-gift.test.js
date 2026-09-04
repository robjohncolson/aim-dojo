"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

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
  assert.ok(start >= 0 && end > start, "the Night Ghosts + Gift block is extractable");
  return source.slice(start, end);
}

function mutationMustFail(assertContract, mutation, message) {
  assert.notEqual(mutation, html, `${message} is constructible`);
  assert.throws(() => assertContract(mutation), assert.AssertionError, message);
  assert.doesNotThrow(() => assertContract(html), `${message} passes reverted`);
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

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(value) { return this.set(value.x, value.y, value.z); }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  multiplyScalar(value) { return this.set(this.x * value, this.y * value, this.z * value); }
  addScaledVector(value, scale) { return this.set(this.x + value.x * scale, this.y + value.y * scale, this.z + value.z * scale); }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const length = this.length(); return length ? this.multiplyScalar(1 / length) : this; }
  distanceTo(value) { return Math.hypot(this.x - value.x, this.y - value.y, this.z - value.z); }
}

function runGhost(source, { gift = true, record = false, seat = false, extra = {}, body = "" } = {}) {
  const context = vm.createContext({
    Math, Number, JSON, WeakMap, Float32Array, Uint16Array, Set,
    CFG: { ghostRecord: record ? 1 : 0, ghostSeat: seat ? 1 : 0, ghostGift: gift ? 1 : 0, moonline: {}, projSpeedFast: 72, projGravity: 0, projRadius: 0.3, projLife: 14 }, LOW: false,
    state: { t: 0, bpm: 60, running: true }, trainMode: false, templeActive: false, reduceMotion: false,
    Tone: { Transport: { seconds: 0 } }, audioLat: () => 0, PITCH_LIMIT: 88 * Math.PI / 180,
    PLAYER_POS: { x: 0, y: 1.7, z: 0 }, ML_ARCH_EVERY: 4, ROAD_MPB: 27,
    ML_WALL_SPRING: 12, ML_WALL_DJ: 7.3, ML_WALL_DA: 7.3, ML_WALL_DB: 5,
    WASD_COL: ["lane-w", "lane-a", "lane-s", "lane-d"], ML_WALL_CHALK: [1, 2, 3, 4, 5], ML_GOLD: 6,
    phasesToday: () => "2026-08-22", moonPhaseBucket: () => 4, realCivilDate, mulberry32,
    roadWallMat: null, roadArchMat: null, scene: { add() {} }, TARGET_CORE_GEO: {}, _flockGeo: {}, SPAWN_UP: {},
    _roadG: (number) => (+number).toFixed(5), TF: (_key, english, values) => english.replace("{n}", String(values.n)),
    localStorage: { getItem: () => null, setItem() {} },
    ...extra,
  });
  new vm.Script(`${ghostBlock(source)}\n${body}`, { filename: "the-gift.vm.js" }).runInContext(context);
  return context;
}

function scopeResult(source, realPresent) {
  const gift = { gift: true }; let giftCalls = 0;
  const context = vm.createContext({
    Math, GH_GIFT: true, CFG: { flickBonus: { coneMul: 1 } },
    camera: { getWorldDirection(out) { out.set(0, 0, -1); } }, _scAim: new Vec3(), _scTo: new Vec3(), PLAYER_POS: new Vec3(),
    targets: realPresent ? [{ dead: false, kind: 0, radius: 1, sc: 1, mesh: { position: new Vec3(0, 0, -10) } }] : [],
    ghostGiftLockTarget: () => { giftCalls += 1; return gift; },
  });
  new vm.Script(`${extractFunction(source, "scopeLockTarget")}\nthis.result=scopeLockTarget(false);`).runInContext(context);
  return { gift, result: context.result, giftCalls };
}

function beaconCountAt(source, gift, roadT) {
  const context = runGhost(source, { gift, extra: { Vec3 }, body: `
    const row=[0,1,9,10,0,null];
    _ghActiveTargets=[row]; _ghCaughtSlots=new Set(); _ghCatchPool=null; _ghPos=new Vec3(); _ghScale={set(){},setScalar(){}}; _ghMatrix={compose(){}}; _ghIdentity={}; _ghRingQuat={}; _ghColor={}; _ghWhite={}; _ghCounts={};
    _ghostTargets={count:0,instanceMatrix:{},instanceColor:{},setMatrixAt(){},setColorAt(){}};
    _ghostBeaconCols={count:0,instanceMatrix:{},instanceColor:{},setMatrixAt(){},setColorAt(){}};
    _ghostBeaconRings={count:0,instanceMatrix:{},instanceColor:{},setMatrixAt(){},setColorAt(){}};
    ghostLaneColor=()=>({}); this.count=ghostSeatUpdateTargets(${roadT},false,${roadT}).beacons;
  ` });
  return context.count;
}

test("reveal-gated deterministic flares extend the lock only after every real candidate", () => {
  const assertContract = (source) => {
    const block = ghostBlock(source);
    assert.match(source, /ghostGift:1/); assert.match(block, /const GH_GIFT=!!CFG\.ghostGift/);
    assert.match(block, /GH_GIFT_STEP=1\/90, GH_GIFT_V=0\.7, GH_GIFT_R=2\.2/); assert.match(block, /GH_BEACON_LEAD=1\.5, GH_GIFT_LEAD=3\.0/);
    assert.match(extractFunction(source, "scopeLockTarget"), /best \|\| tight \|\| !GH_GIFT/);
    assert.match(extractFunction(source, "ghostSeatBuild"), /if\(GH_GIFT\)\{/);
    assert.match(extractFunction(source, "ghostGiftLockTarget"), /ghostGiftable\(row,_ghGiftRoadT,_ghGiftReveal\)/);
    assert.doesNotMatch(extractFunction(source, "ghostGiftable"), /GH_TARGET_FADE/);
    assert.match(extractFunction(source, "ghostSeatUpdateTargets"), /beaconLead=GH_GIFT\?GH_GIFT_LEAD:GH_BEACON_LEAD/);
    const window = runGhost(source, { body: `
      _ghCaughtSlots=new Set();
      const row=[0,1,9,10,0,null];
      const opens=10-GH_GIFT_LEAD;
      this.window=[ghostGiftable(row,opens,0.69),ghostGiftable(row,opens-0.01,0.7),ghostGiftable(row,opens,0.7),ghostGiftable(row,10,1)];
      _ghCaughtSlots.add(9); this.afterCatch=ghostGiftable(row,9,1);
      _ghGiftPos=new Vec3(); this.positions=[0,5,10].map(t=>{ const out=ghostTargetPosition(row,t,_ghGiftPos); return [out.x,out.y,out.z]; });
    `, extra: { Vec3 } });
    assert.deepEqual(Array.from(window.window), [false, false, true, true]); assert.equal(window.afterCatch, false);
    assert.deepEqual(Array.from(window.positions, (row) => Array.from(row)), [[88.4, 2.2, -108], [88.4, 2.2, -58], [88.4, 2.2, -8]]);
    assert.equal(beaconCountAt(source, true, 7), 1, "Gift beacons ignite on the 3.0 s full-row ballistic lead");
    assert.equal(beaconCountAt(source, false, 7.4), 0, "the kill-switch preserves the shipped 1.5 s beacon arm");
    assert.equal(beaconCountAt(source, false, 8.5), 1, "the shipped beacon opens exactly 1.5 s before arrival");
    const withReal = scopeResult(source, true), withoutReal = scopeResult(source, false);
    assert.equal(withReal.result.gift, undefined); assert.equal(withReal.giftCalls, 0, "a real target prevents even consulting the flare arm");
    assert.equal(withoutReal.result, withoutReal.gift); assert.equal(withoutReal.giftCalls, 1, "a flare extends the empty real lock arm");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "scopeLockTarget", (fn) => fn.replace("if(best || tight || !GH_GIFT) return best;", "if(tight || !GH_GIFT) return best;"));
  mutationMustFail(assertContract, mutation, "the real-target oracle kills a flare that outranks a live target");
  const leadMutation = html.replace("GH_BEACON_LEAD=1.5, GH_GIFT_LEAD=3.0", "GH_BEACON_LEAD=1.5, GH_GIFT_LEAD=1.5");
  mutationMustFail(assertContract, leadMutation, "the ballistic lead oracle kills the obsolete 1.5 s Gift window");
});

function projectileResult(source, kind) {
  const calls = { catch: 0, mark: 0, grade: 0, clank: 0, whiff: 0, orb: 0 };
  const gift = kind.startsWith("gift"), ghostHit = kind === "gift-catch" || kind === "normal-near-flare";
  const real = kind === "gift-near-real" || kind === "normal-real";
  const projectile = { pos: new Vec3(0, 10, 0), vel: new Vec3(), life: 0, mesh: null, gift, giftRow: [0, 0, 0, 8, 0, null], fireRow: [] };
  const context = vm.createContext({
    Math, GH_GIFT: true, GH_RECORD: true, CFG: { projGravity: 0, projRadius: 0, projLife: 10 }, windX: 0, windZ: 0,
    projectiles: [projectile], targets: real ? [{ dead: false, radius: 1, sc: 1, hpMax: 1, kind: 0, mesh: { position: new Vec3() } }] : [],
    _prev: new Vec3(), _ghGiftRoadT: 5, ROOM_HALF_W: 100, ROOM_HALF_D: 100, ML_ARC_VOID: false,
    segDistSq: () => 0, ghostGiftProjectileHit: () => ghostHit, ghostRoadTime: () => 0.016, soundOn: false, toneReady: false, kick: null,
    ghostGiftCatch: () => { calls.catch += 1; return true; }, ghostRecordMarkFire: () => { calls.mark += 1; },
    orbOpen: () => { calls.orb += 1; return true; }, gradeRhythmHit: () => { calls.grade += 1; }, clankShot: () => { calls.clank += 1; }, handleTankHit: () => {},
    retireProjectile: (index) => { context.projectiles.splice(index, 1); }, onWhiff: () => { calls.whiff += 1; }, moonlineVoid: () => false, spawnLandRing: () => {},
  });
  new vm.Script(`${extractFunction(source, "updateProjectiles")}\nupdateProjectiles(0.016);`).runInContext(context);
  return { calls, live: context.projectiles.length };
}

test("the blessed plan is truthful and collision routing is strict, connection-only, and two-way", () => {
  const assertContract = (source) => {
    const spawn = extractFunction(source, "spawnProjectile"), preview = extractFunction(source, "updateArcPreview"), scope = extractFunction(source, "updateScope"), update = extractFunction(source, "updateProjectiles");
    assert.match(spawn, /gift\?computeShotPlan\(pr\.pos,pr\.vel,GH_GIFT_SPEED\):computeShotPlan\(pr\.pos, pr\.vel\)/);
    assert.match(preview, /giftPlanSpeed\?computeShotPlan\(_arcM,_arcV,giftPlanSpeed\):computeShotPlan\(_arcM, _arcV\)/);
    assert.match(scope, /giftCandidate\?computeShotPlan\(_scM,_scV,GH_GIFT_SPEED\):computeShotPlan\(_scM, _scV\)/);
    const normalLock = extractFunction(source, "simShotHits");
    assert.deepEqual({ chars: normalLock.length, sha256: crypto.createHash("sha256").update(normalLock).digest("hex") }, { chars: 1315, sha256: "53608ef8f3cde46e801e9b24090cfe9d2e632ae40c0568fc4b732b1fd55b617e" }, "the normal-target lock stays byte-identical to 378c005");
    assert.match(extractFunction(source, "simGiftShotHits"), /Math\.min\(T\+0\.15,tg\.lockUntil\)/);
    const giftArm = update.slice(update.indexOf("if(GH_GIFT && pr.gift)"), update.indexOf("}else{", update.indexOf("if(GH_GIFT && pr.gift)")));
    assert.doesNotMatch(giftArm, /orbOpen|clankShot|gradeRhythmHit|for\(const tg of targets\)/, "gift connection has no rhythm or real-world route");
    assert.deepEqual(projectileResult(source, "gift-near-real"), { calls: { catch: 0, mark: 0, grade: 0, clank: 0, whiff: 0, orb: 0 }, live: 1 });
    assert.deepEqual(projectileResult(source, "normal-near-flare"), { calls: { catch: 0, mark: 0, grade: 0, clank: 0, whiff: 0, orb: 0 }, live: 1 });
    assert.deepEqual(projectileResult(source, "gift-catch"), { calls: { catch: 1, mark: 1, grade: 0, clank: 0, whiff: 0, orb: 0 }, live: 0 });
    assert.deepEqual(projectileResult(source, "normal-real"), { calls: { catch: 0, mark: 0, grade: 1, clank: 0, whiff: 0, orb: 1 }, live: 0 });
  };
  assertContract(html);
  const mutation = replaceFunction(html, "updateProjectiles", (fn) => fn.replace("ghostGiftProjectileHit(pr) && ghostGiftCatch", "ghostGiftProjectileHit(pr) && orbOpen() && ghostGiftCatch"));
  mutationMustFail(assertContract, mutation, "the connection-only oracle kills a rhythm-window sneak");
});

test("gift lock and launch share mastery’s fixed muzzle speed", () => {
  const assertContract = (source) => {
    const block = ghostBlock(source), spawn = extractFunction(source, "spawnProjectile"), scope = extractFunction(source, "updateScope"), previewSpeed = extractFunction(source, "ghostGiftPlanSpeed");
    assert.match(block, /const GH_GIFT_SPEED=72,/);
    const launch = spawn.match(/gift\?computeShotPlan\(pr\.pos,pr\.vel,([^\)]+)\):computeShotPlan\(pr\.pos, pr\.vel\)/);
    const lock = scope.match(/giftCandidate\?computeShotPlan\(_scM,_scV,([^\)]+)\):computeShotPlan\(_scM, _scV\)/);
    assert.ok(launch && lock, "both Gift planners expose their explicit speed");
    assert.equal(launch[1], "GH_GIFT_SPEED");
    assert.equal(lock[1], launch[1], "lock and launch use the same named speed");
    assert.match(previewSpeed, /return GH_GIFT_SPEED;/);
    assert.doesNotMatch([spawn, scope, previewSpeed].join("\n"), /CFG\.projSpeedFast/, "Gift planning never rides the tuning-flagged CFG endpoint");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "spawnProjectile", (fn) => fn.replace("computeShotPlan(pr.pos,pr.vel,GH_GIFT_SPEED)", "computeShotPlan(pr.pos,pr.vel,CFG.projSpeedFast)"));
  mutationMustFail(assertContract, mutation, "the shared-speed oracle kills a CFG.projSpeedFast Gift-path survivor");
});

function giftLockCatchResult(source, tta) {
  const projectiles = [];
  const context = runGhost(source, { gift: true, extra: {
    Vec3, CFG: { ghostRecord: 0, ghostSeat: 0, ghostGift: 1, moonline: {}, projSpeedFast: 72, projGravity: 16, projRadius: 0.3, projLife: 14 },
    projectiles, windX: 0, windZ: 0, ROOM_HALF_W: 32, ROOM_HALF_D: 32, ML_ARC_VOID: false,
    roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } }, roadArchMat: null,
    soundOn: false, toneReady: false, kick: null, targets: [],
    onWhiff() {}, orbOpen: () => true, gradeRhythmHit() {}, clankShot() {}, handleTankHit() {},
    retireProjectile: (index) => { projectiles.splice(index, 1); }, moonlineVoid: () => false, spawnLandRing() {},
  }, body: `
    ${extractFunction(source, "simShotHits")}
    ${extractFunction(source, "simGiftShotHits")}
    ${extractFunction(source, "segDistSq")}
    ${extractFunction(source, "updateProjectiles")}
    const row=[7,1,7,10,0,null], now=row[3]-${tta}, step=1/90, muzzle=new Vec3(0,1,0), current=new Vec3();
    ghostTargetPosition(row,now,current);
    const targetVelocity=new Vec3(0,0,(GH_TARGET_FAR-GH_TARGET_NEAR)/(row[3]-row[0]));
    let best=null;
    for(let n=72;n<=180;n++){
      const t=n*step, tx=current.x+targetVelocity.x*t, ty=current.y+targetVelocity.y*t, tz=current.z+targetVelocity.z*t;
      const vx=(tx-muzzle.x)/t, vy=(ty-muzzle.y+CFG.projGravity*step*step*n*(n+1)/2)/t, vz=(tz-muzzle.z)/t;
      const speed=Math.hypot(vx,vy,vz), error=Math.abs(speed-GH_GIFT_SPEED);
      if(!best || error<best.error) best={n,t,vx,vy,vz,speed,error};
    }
    const velocity=new Vec3(best.vx,best.vy,best.vz), proxy={mesh:{position:current},vel:targetVelocity,radius:GH_GIFT_R,sc:1,gift:true,lockUntil:${tta}};
    this.normalLocked=simShotHits(muzzle,velocity,best.t,proxy);
    this.locked=simGiftShotHits(muzzle,velocity,best.t,proxy);
    this.distance=Math.hypot(current.x-muzzle.x,current.y-muzzle.y,current.z-muzzle.z);
    this.flight=best.t; this.speed=best.speed; this.band=GH_GIFT_LEAD-best.t;
    const projectile={pos:new Vec3().copy(muzzle),vel:new Vec3().copy(velocity),life:0,mesh:null,gift:true,giftRow:row,giftRoadT:now,giftLaunchT:now,giftX:muzzle.x,giftY:muzzle.y,giftZ:muzzle.z,giftVx:velocity.x,giftVy:velocity.y,giftVz:velocity.z,fireRow:null};
    projectiles.push(projectile); this._prev=new Vec3(); _ghostSeatRecord={dur:row[3],targets:[row]}; _ghostSeatRoot={}; _ghCaughtSlots=new Set(); _ghostGiftMail=[]; _ghGiftPrevPos=new Vec3(); _ghGiftImpactPos=new Vec3(); _ghBurstPool=null; _ghCatchPool=null;
    Tone.Transport.seconds=now;
    for(let n=0;n<220 && projectiles.length;n++){ Tone.Transport.seconds=now+(n+1)*step; updateProjectiles(step); }
    this.caught=_ghCaughtSlots.has(row[2]); this.catchAt=_ghostGiftMail.length?_ghostGiftMail[0][0]:null;
  ` });
  return { normalLocked: context.normalLocked, locked: context.locked, caught: context.caught, catchAt: context.catchAt, distance: context.distance, flight: context.flight, speed: context.speed, band: context.band };
}

test("the 90–120 m gold band ends one real flight before arrival", () => {
  const assertContract = (source) => {
    const mid = giftLockCatchResult(source, 2), late = giftLockCatchResult(source, 1.1);
    assert.ok(mid.distance>=90 && mid.distance<=120); assert.ok(mid.band>=1.5 && mid.band<=1.7); assert.ok(Math.abs(mid.speed-72)<0.5);
    assert.equal(mid.locked, true, "a mid-band mastery-speed aim earns gold"); assert.equal(mid.caught, true);
    assert.ok(late.distance>=90 && late.distance<=120); assert.ok(late.flight>1.1); assert.ok(Math.abs(late.speed-72)<0.5);
    assert.equal(late.normalLocked, true, "the historical unclamped march reaches the post-arrival proxy");
    assert.equal(late.locked, false, "a shot whose connection time exceeds tta never earns gold"); assert.equal(late.caught, false);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "simGiftShotHits", (fn) => fn.replace("Math.min(T+0.15,tg.lockUntil)", "T+0.15"));
  mutationMustFail(assertContract, mutation, "the honest-band oracle kills the unclamped proxy march");
});

test("every confirmed gift lock agrees with the catch's clamped pre-arrival law", () => {
  const assertContract = (source) => {
    const results = [2.5,2.25,2,1.75,1.5,1.25,1.1,0.9].map((tta) => giftLockCatchResult(source, tta));
    const confirmed = results.filter((result) => result.locked);
    assert.ok(confirmed.length>=4, "the contract exercises a real confirmed-lock band");
    for(const result of confirmed){ assert.equal(result.caught, true); assert.ok(result.catchAt<=10); }
    assert.ok(results.some((result) => result.normalLocked && !result.caught), "the fixture contains the dispatcher's false-gold survivor");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "simGiftShotHits", (fn) => fn.replace("Math.min(T+0.15,tg.lockUntil)", "T+0.15"));
  mutationMustFail(assertContract, mutation, "the catch-vs-lock agreement oracle kills the unclamped proxy march");
});

const FULL_ROW_GIFT_FIXTURES = [
  { seat: -90, lane: 0, x: -94.8, yaw: -1.160627950944, pitch: 0.172779564118, flight: 1.666666666667 },
  { seat: -90, lane: 3, x: -85.2, yaw: -1.097849589503, pitch: 0.160763167367, flight: 1.566666666667 },
  { seat: 90, lane: 0, x: 85.2, yaw: 1.093398761263, pitch: 0.160763167367, flight: 1.566666666667 },
  { seat: 90, lane: 3, x: 94.8, yaw: 1.156948973114, pitch: 0.172779564118, flight: 1.666666666667 },
  { seat: -180, lane: 0, x: -184.8, yaw: -1.494170565889, pitch: 0.314508864538, flight: 2.833333333333 },
  { seat: -180, lane: 3, x: -175.2, yaw: -1.471018455992, pitch: 0.295972443571, flight: 2.7 },
  { seat: 180, lane: 0, x: 175.2, yaw: 1.470106611394, pitch: 0.295972453094, flight: 2.7 },
  { seat: 180, lane: 3, x: 184.8, yaw: 1.493473526534, pitch: 0.314508839985, flight: 2.833333333333 },
  { seat: -180, lane: 0, x: -184.8, yaw: -1.4822273254394531, pitch: 0.31649957380029015, flight: 2.866666666667, edge: true },
  { seat: -180, lane: 0, x: -184.8, yaw: -1.494170565889, pitch: 0.299994265985, flight: 2.733333333333, edge: true },
  { seat: -180, lane: 0, x: -184.8, yaw: -1.49333984375, pitch: 0.299993141289, flight: 2.733333333333, edge: true },
];

function fullRowGiftResult(source, fixture) {
  const projectiles = [];
  const cp = Math.cos(fixture.pitch), direction = new Vec3(cp * Math.sin(fixture.yaw), Math.sin(fixture.pitch), -cp * Math.cos(fixture.yaw));
  const camera = { direction, getWorldDirection(out) { return out.copy(this.direction); } };
  const context = runGhost(source, { gift: true, extra: {
    Vec3, camera, projectiles, windX: 0, windZ: 0, ROOM_HALF_W: 32, ROOM_HALF_D: 32, ML_ARC_VOID: false,
    CFG: { ghostRecord: 0, ghostSeat: 0, ghostGift: 1, moonline: {}, projSpeedFast: 72, projGravity: 16, projRadius: 0.3, projLife: 14 },
    roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } }, roadArchMat: null,
    soundOn: false, toneReady: false, kick: null, targets: [], onWhiff() {}, orbOpen: () => true, gradeRhythmHit() {}, clankShot() {}, handleTankHit() {},
    retireProjectile: (index) => { projectiles.splice(index, 1); }, moonlineVoid: () => false, spawnLandRing() {},
  }, body: `
    const ARC_MAX=430, BLADE_DX=1.5, BLADE_DY=0.7, BLADE_DZ=0.4, _arcDir=new Vec3(), _arcPos=new Vec3(), _arcVel=new Vec3(), _arcRight=new Vec3(), _arcI=new Vec3(), _ARC_UP=new Vec3(0,1,0); let _planLanded=false;
    ${extractFunction(source, "computeShotPlan")}
    ${extractFunction(source, "simGiftShotHits")}
    ${extractFunction(source, "segDistSq")}
    ${extractFunction(source, "updateProjectiles")}
    const row=[5.38,${fixture.lane},71,10,0,null], now=7, muzzle=new Vec3(), velocity=new Vec3(); _ghSeatX=${fixture.seat};
    _ghostSeatRecord={dur:10,targets:[row]}; _ghostSeatRoot={}; _ghCaughtSlots=new Set(); _ghostGiftMail=[]; _ghGiftPos=new Vec3(); _ghGiftVel=new Vec3(); _ghGiftPrevPos=new Vec3(); _ghGiftImpactPos=new Vec3(); _ghBurstPool=null; _ghCatchPool=null; _ghActiveTargets=[row]; _prev=new Vec3();
    _ghGiftProxy={mesh:{position:_ghGiftPos},vel:_ghGiftVel,radius:GH_GIFT_R,sc:1,kind:0,gift:true,lockUntil:0,_ghostGiftRow:null}; Tone.Transport.seconds=now;
    const proxy=ghostGiftLockTarget(camera.direction,0.72), flight=computeShotPlan(muzzle,velocity,GH_GIFT_SPEED), locked=!!proxy&&simGiftShotHits(muzzle,velocity,flight,proxy);
    const resetRun=()=>{ projectiles.length=0; _ghCaughtSlots.clear(); _ghostGiftMail=[]; _ghGiftRoadT=now; _ghGiftReveal=1; _ghostRoadBase=0; _ghostRoadLast=now; Tone.Transport.seconds=now;
      const projectile={pos:new Vec3().copy(muzzle),vel:new Vec3().copy(velocity),life:0,mesh:null,gift:true,giftRow:row,giftRoadT:now,giftLaunchT:now,giftX:muzzle.x,giftY:muzzle.y,giftZ:muzzle.z,giftVx:velocity.x,giftVy:velocity.y,giftVz:velocity.z,fireRow:null}; projectiles.push(projectile);
      return projectile; };
    const runHz=hz=>{ resetRun();
      for(let frame=1;frame<=Math.ceil(3.2*hz)&&projectiles.length;frame++){ Tone.Transport.seconds=now+frame/hz; updateProjectiles(1/hz); }
      return {caught:_ghCaughtSlots.has(row[2]),at:_ghostGiftMail.length?_ghostGiftMail[0][0]:null}; };
    const runStall=()=>{ resetRun(); let prior=now; for(const at of [now+1,now+3]){ Tone.Transport.seconds=at; updateProjectiles(at-prior); prior=at; } return {caught:_ghCaughtSlots.has(row[2]),at:_ghostGiftMail.length?_ghostGiftMail[0][0]:null}; };
    const position=new Vec3(); ghostTargetPosition(row,now,position);
    this.fullRow={selected:proxy&&proxy._ghostGiftRow===row,locked,flight,position:[position.x,position.y,position.z],speed:velocity.length(),rates:[30,60,90,144].map(runHz),stall:runStall()};
  ` });
  return { ...context.fullRow, position: Array.from(context.fullRow.position), rates: Array.from(context.fullRow.rates, (row) => ({ ...row })), stall: { ...context.fullRow.stall } };
}

function giftWindowBoundary(source, lead) {
  const tuned = lead === 3 ? source : source.replace("GH_BEACON_LEAD=1.5, GH_GIFT_LEAD=3.0", `GH_BEACON_LEAD=1.5, GH_GIFT_LEAD=${lead}`);
  assert.ok(lead === 3 || tuned !== source, `lead ${lead} is constructible`);
  const context = runGhost(tuned, { gift: true, body: `
    _ghCaughtSlots=new Set(); const row=[5.38,1,9,10,0,null], open=10-GH_GIFT_LEAD;
    this.boundary=[ghostGiftable(row,open,0.7),ghostGiftable(row,open-0.001,0.7),ghostGiftable(row,open,0.699),ghostGiftable(row,10,1),ghostGiftable(row,10.001,1)];
  ` });
  return Array.from(context.boundary);
}

test("the three-second Gift lead reaches every full seat and gold stays honest across cadence and stalls", () => {
  const assertContract = (source) => {
    const block = ghostBlock(source), spawn = extractFunction(source, "spawnProjectile"), update = extractFunction(source, "updateProjectiles"), collision = extractFunction(source, "ghostGiftProjectileHit");
    assert.match(block, /GH_BEACON_LEAD=1\.5, GH_GIFT_LEAD=3\.0/); assert.match(block, /GH_GIFT_SPEED=72, GH_GIFT_STEP=1\/90/);
    assert.match(spawn, /giftLaunchT=pr\.giftRoadT; pr\.giftX=pr\.pos\.x; pr\.giftY=pr\.pos\.y; pr\.giftZ=pr\.pos\.z; pr\.giftVx=pr\.vel\.x; pr\.giftVy=pr\.vel\.y; pr\.giftVz=pr\.vel\.z/);
    assert.match(update, /k=0\.5\*t\*\(t\+GH_GIFT_STEP\)/); assert.doesNotMatch(update, /new THREE/, "the cadence-stable Gift flight allocates nothing per frame");
    assert.match(collision, /first=Math\.max\(1,[^;]+GH_GIFT_STEP[^;]+last=Math\.floor\([^;]+GH_GIFT_STEP\+1e-9\)/); assert.doesNotMatch(collision, /new THREE/, "the curved-path catch allocates nothing per frame");
    assert.deepEqual([2.2, 2.6, 3].map((lead) => giftWindowBoundary(source, lead)), Array(3).fill([true, false, false, true, false]), "every audition keeps exact open/reveal/arrival boundaries");
    for (const lead of [2.2, 2.6, 3]) {
      const tuned = lead === 3 ? source : source.replace("GH_BEACON_LEAD=1.5, GH_GIFT_LEAD=3.0", `GH_BEACON_LEAD=1.5, GH_GIFT_LEAD=${lead}`), late = giftLockCatchResult(tuned, 1.1);
      assert.equal(late.normalLocked, true); assert.equal(late.locked, false); assert.equal(late.caught, false);
    }
    for (const fixture of FULL_ROW_GIFT_FIXTURES) {
      const result = fullRowGiftResult(source, fixture);
      assert.equal(result.selected, true); assert.equal(result.locked, true); assert.ok(Math.abs(result.flight-fixture.flight)<1e-9); assert.ok(Math.abs(result.speed-72)<0.5);
      assert.ok(Math.abs(result.position[0]-fixture.x)<1e-9); assert.ok(Math.abs(result.position[1]-2.2)<1e-9);
      for (const rate of result.rates) { assert.equal(rate.caught, true, `${fixture.x} m ${fixture.edge?'edge ':' '}gold catches`); assert.ok(rate.at<=10); }
      assert.equal(result.stall.caught, true, `${fixture.x} m ${fixture.edge?'edge ':' '}gold survives a two-second frame stall`); assert.ok(result.stall.at<=10);
    }
  };
  assertContract(html);
  let mutation = html.replace("GH_BEACON_LEAD=1.5, GH_GIFT_LEAD=3.0", "GH_BEACON_LEAD=1.5, GH_GIFT_LEAD=2.6");
  mutationMustFail(assertContract, mutation, "the outer-row oracle rejects the 2.6-second near-only survivor");
  mutation = replaceFunction(html, "simGiftShotHits", (fn) => fn.replace("Math.min(T+0.15,tg.lockUntil)", "T+0.15"));
  mutationMustFail(assertContract, mutation, "every audition kills the historical post-arrival false gold");
  mutation = replaceFunction(html, "updateProjectiles", (fn) => fn.replace("if(Number.isFinite(pr.giftLaunchT)&&Number.isFinite(pr.giftX))", "if(false)"));
  mutationMustFail(assertContract, mutation, "the cadence oracle kills the former render-step Gift flight");
  mutation = replaceFunction(html, "ghostGiftProjectileHit", (fn) => fn.replace("if(Number.isFinite(pr.giftLaunchT)&&Number.isFinite(pr.giftX))", "if(false)"));
  mutationMustFail(assertContract, mutation, "the collision oracle kills a frame chord that skips the blessed parabola");
  mutation = replaceFunction(html, "spawnProjectile", (fn) => fn.replace("pr.giftLaunchT=pr.giftRoadT; ", ""));
  mutationMustFail(assertContract, mutation, "the launch oracle kills a pooled Gift without its absolute road origin");
});

function traceGeometryAgreement(source) {
  const projectiles = [];
  const context = runGhost(source, { gift: true, extra: {
    Vec3, CFG: { ghostRecord: 0, ghostSeat: 0, ghostGift: 1, moonline: {}, projGravity: 16, projRadius: 0.3, projLife: 14 },
    projectiles, windX: 0, windZ: 0, ROOM_HALF_W: 32, ROOM_HALF_D: 32, ML_ARC_VOID: false, targets: [],
    roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } }, roadArchMat: null,
    soundOn: false, toneReady: false, kick: null, onWhiff() {}, orbOpen: () => true, gradeRhythmHit() {}, clankShot() {}, handleTankHit() {},
    retireProjectile: (index) => { projectiles.splice(index, 1); }, moonlineVoid: () => false, spawnLandRing() {},
  }, body: `
    ${extractFunction(source, "simGiftShotHits")}
    ${extractFunction(source, "segDistSq")}
    ${extractFunction(source, "updateProjectiles")}
    const row=[5.38,2,7,10,0,null], distractor=[5.38,0,8,10,0,null], now=7.69, tta=2.31;
    const aim=new Vec3(0.9410860927809271,0.16227916709046178,-0.29668575615077003);
    const muzzle=new Vec3(0.8274412171933399,1.0649116668361847,1.3119174926793804);
    const velocity=new Vec3(67.2300447118054,11.822808895653273,-22.19876858711886), flight=1.5666666666666667;
    _ghostSeatRecord={dur:10,targets:[row,distractor]}; _ghostSeatRoot={}; _ghCaughtSlots=new Set(); _ghostGiftMail=[]; _ghGiftPos=new Vec3(); _ghGiftVel=new Vec3(); _ghGiftPrevPos=new Vec3(); _ghGiftImpactPos=new Vec3(); _ghBurstPool=null; _ghCatchPool=null;
    _ghGiftProxy={mesh:{position:_ghGiftPos},vel:_ghGiftVel,radius:GH_GIFT_R,sc:1,kind:0,gift:true,lockUntil:0,_ghostGiftRow:null}; _ghActiveTargets=[row,distractor]; _prev=new Vec3();
    Tone.Transport.seconds=now;
    const proxy=ghostGiftLockTarget(aim,0.72), initialDistance=Math.hypot(proxy.mesh.position.x-PLAYER_POS.x,proxy.mesh.position.y-PLAYER_POS.y,proxy.mesh.position.z-PLAYER_POS.z);
    const proxyPosition=[proxy.mesh.position.x,proxy.mesh.position.y,proxy.mesh.position.z], proxySpeed=proxy.vel.z, locked=simGiftShotHits(muzzle,velocity,flight,proxy);
    const projectile={pos:new Vec3().copy(muzzle),vel:new Vec3().copy(velocity),life:0,mesh:null,gift:true,giftRow:row,giftRoadT:now,giftLaunchT:now,giftX:muzzle.x,giftY:muzzle.y,giftZ:muzzle.z,giftVx:velocity.x,giftVy:velocity.y,giftVz:velocity.z,fireRow:null};
    projectiles.push(projectile);
    const frameWall=0.075, frameDt=0.05, flare=new Vec3(); let dmin=Infinity, closestTta=null;
    for(let frame=1;frame<=40 && projectiles.length;frame++){
      Tone.Transport.seconds=now+frame*frameWall; updateProjectiles(frameDt);
      ghostTargetPosition(row,Math.min(Tone.Transport.seconds,row[3]),flare);
      const distance=projectile.pos.distanceTo(flare);
      if(distance<dmin){ dmin=distance; closestTta=row[3]-Tone.Transport.seconds; }
    }
    this.trace={locked,caught:_ghCaughtSlots.has(row[2]),dmin,closestTta,initialDistance,proxyPosition,proxySpeed,launchSpeed:velocity.length(),selectedSlot:proxy._ghostGiftRow[2],lastSlot:distractor[2]};
  ` });
  return {
    ...context.trace,
    proxyPosition: Array.from(context.trace.proxyPosition),
  };
}

test("the trace geometry's proxy march and real road-clock flight agree", () => {
  const assertContract = (source) => {
    const result = traceGeometryAgreement(source);
    assert.equal(result.selectedSlot, 7); assert.equal(result.lastSlot, 8);
    assert.ok(result.proxyPosition.every((value,index)=>Math.abs(value-[91.6,2.2,-58][index])<1e-12)); assert.ok(Math.abs(result.proxySpeed-100/4.62)<1e-12);
    assert.ok(result.initialDistance>108 && result.initialDistance<109); assert.ok(Math.abs(result.launchSpeed-71.8)<0.1);
    assert.equal(result.locked, true); assert.equal(result.caught, true, `march blessed but real flight missed by ${result.dmin.toFixed(2)} m`);
    assert.ok(result.dmin<5, `the rendered projectile follows its blessed curve (nearest sampled frame ${result.dmin.toFixed(2)} m)`);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "updateProjectiles", (fn) => fn.replace("pr.pos.x=pr.giftX+pr.giftVx*t+windX*k", "pr.pos.x=pr.giftX"));
  mutationMustFail(assertContract, mutation, "the trace oracle kills a blessed flight frozen at its launch x");
});

function realBoundsGiftResult(source) {
  const calls = { mark: 0, whiff: 0, grade: 0, clank: 0, orb: 0 };
  const projectiles = [];
  const context = runGhost(source, { gift: true, record: true, extra: {
    Vec3, calls, projectiles, windX: 0, windZ: 0, ROOM_HALF_W: 32, ROOM_HALF_D: 32, ML_ARC_VOID: false,
    roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } }, roadArchMat: null,
    soundOn: false, toneReady: false, kick: null,
    onWhiff: () => { calls.whiff += 1; },
    orbOpen: () => { calls.orb += 1; return true; }, gradeRhythmHit: () => { calls.grade += 1; }, clankShot: () => { calls.clank += 1; }, handleTankHit: () => {},
    retireProjectile: (index) => { projectiles.splice(index, 1); }, moonlineVoid: () => false, spawnLandRing: () => {},
  }, body: `
    ${extractFunction(source, "segDistSq")}
    ${extractFunction(source, "updateProjectiles")}
    const row=[0,1,7,10,0,null], flareStart=new Vec3(); ghostTargetPosition(row,7.4,flareStart);
    const flight=1.04, projectile={pos:new Vec3(31,flareStart.y,flareStart.z),vel:new Vec3((flareStart.x-31)/flight,0,10),life:0,mesh:null,gift:true,giftRow:row,giftRoadT:7.4,fireRow:[0,0,0,0]};
    projectiles.push(projectile); this.targets=[]; this._prev=new Vec3(); _ghostRecord={}; _ghostSeatRecord={dur:10,targets:[row]}; _ghostSeatRoot={}; _ghCaughtSlots=new Set(); _ghostGiftMail=[]; _ghGiftPrevPos=new Vec3(); _ghGiftImpactPos=new Vec3(); _ghBurstPool=null; _ghCatchPool=null;
    Tone.Transport.seconds=7.44; updateProjectiles(0.04); this.afterBoundary={live:projectiles.length,x:projectile.pos.x,z:projectile.pos.z,tag:projectile.gift,whiff:calls.whiff};
    Tone.Transport.seconds=8.44; updateProjectiles(1); this.afterCatch={live:projectiles.length,mail:_ghostGiftMail.map(row=>Array.from(row)),caught:_ghCaughtSlots.has(7),fireHit:projectile.fireRow[3],calls:{...calls},flareX:flareStart.x};
  ` });
  return {
    afterBoundary: { ...context.afterBoundary },
    afterCatch: { ...context.afterCatch, mail: Array.from(context.afterCatch.mail, (row) => Array.from(row)), calls: { ...context.afterCatch.calls } },
  };
}

test("a tagged shot crosses the real room bounds and catches the actual x≈90 flare", () => {
  const assertContract = (source) => {
    assert.match(extractFunction(source, "updateProjectiles"), /if\(pr\.life>=CFG\.projLife \|\| pr\.pos\.y<=0\.04 \|\| \(!gift && \(Math\.abs\(pr\.pos\.x\)>ROOM_HALF_W \|\| Math\.abs\(pr\.pos\.z\)>ROOM_HALF_D\)\)\)/, "lifetime and ground death stay universal while room bounds stay normal-only");
    const result = realBoundsGiftResult(source);
    assert.ok(result.afterBoundary.x > 32 && Math.abs(result.afterBoundary.z) > 32, "the first frame crosses both real room bounds");
    assert.deepEqual(result.afterBoundary, { live: 1, x: result.afterBoundary.x, z: result.afterBoundary.z, tag: true, whiff: 0 });
    assert.equal(result.afterCatch.flareX, 88.4); assert.ok(result.afterCatch.flareX > 32);
    assert.deepEqual(result.afterCatch, { live: 0, mail: [[8.44, 1]], caught: true, fireHit: 1, calls: { mark: 0, whiff: 0, grade: 0, clank: 0, orb: 0 }, flareX: 88.4 });
  };
  assertContract(html);
  const mutation = replaceFunction(html, "updateProjectiles", (fn) => fn.replace("(!gift && (Math.abs(pr.pos.x)>ROOM_HALF_W || Math.abs(pr.pos.z)>ROOM_HALF_D))", "Math.abs(pr.pos.x)>ROOM_HALF_W || Math.abs(pr.pos.z)>ROOM_HALF_D"));
  mutationMustFail(assertContract, mutation, "the real-bounds oracle kills room-boundary death for a tagged Gift shot");
});

function replayEdgeCollision(source, fromRelativeX, toRelativeX) {
  const context = runGhost(source, { gift: true, extra: {
    Vec3, roadWallMat: { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [1] } } }, roadArchMat: null,
  }, body: `
    const row=[0,1,7,10,0,null], targetBefore=new Vec3(), targetArrival=new Vec3();
    ghostTargetPosition(row,9.99,targetBefore); ghostTargetPosition(row,10,targetArrival);
    this._prev=new Vec3(targetBefore.x+${fromRelativeX},targetBefore.y,targetBefore.z);
    const projectile={pos:new Vec3(targetArrival.x+${toRelativeX},targetArrival.y,targetArrival.z+0.1),gift:true,giftRow:row,giftRoadT:9.99};
    _ghostSeatRecord={dur:10,targets:[row]}; _ghostSeatRoot={}; _ghCaughtSlots=new Set(); _ghGiftPrevPos=new Vec3(); _ghGiftImpactPos=new Vec3(); Tone.Transport.seconds=10.01;
    this.hit=ghostGiftProjectileHit(projectile); this.roadT=projectile.giftRoadT; this.collisionT=_ghGiftRoadT;
  ` });
  return { hit: context.hit, roadT: context.roadT, collisionT: context.collisionT };
}

test("the final collision segment clamps both moving endpoints to arrival across replay duration", () => {
  const assertContract = (source) => {
    assert.deepEqual(replayEdgeCollision(source, -1, 3), { hit: true, roadT: 10.01, collisionT: 10 }, "the 9.99→10.01 segment keeps its valid pre-arrival crossing and stamps arrival");
    assert.deepEqual(replayEdgeCollision(source, -5, -1), { hit: false, roadT: 10.01, collisionT: 10.01 }, "a segment that enters only after arrival is never admitted");
    const hit = extractFunction(source, "ghostGiftProjectileHit");
    assert.match(hit, /arrivalT=pr\.giftRow\[3\], endT=Math\.min\(currentT,arrivalT\)/);
    assert.doesNotMatch(hit, /GH_TARGET_FADE/);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostGiftProjectileHit", () => `function ghostGiftProjectileHit(pr){
  if(!GH_GIFT || !pr || !pr.gift || !pr.giftRow || !ghostGiftSync()) return false;
  const priorT=Number.isFinite(pr.giftRoadT)?Math.min(_ghGiftRoadT,pr.giftRoadT):_ghGiftRoadT;
  pr.giftRoadT=_ghGiftRoadT;
  if(!ghostGiftable(pr.giftRow,_ghGiftRoadT,_ghGiftReveal)) return false;
  ghostTargetPosition(pr.giftRow,priorT,_ghGiftPrevPos);
  ghostTargetPosition(pr.giftRow,_ghGiftRoadT,_ghGiftImpactPos);
  const ax=_prev.x-_ghGiftPrevPos.x, ay=_prev.y-_ghGiftPrevPos.y, az=_prev.z-_ghGiftPrevPos.z, bx=pr.pos.x-_ghGiftImpactPos.x, by=pr.pos.y-_ghGiftImpactPos.y, bz=pr.pos.z-_ghGiftImpactPos.z;
  const sx=bx-ax, sy=by-ay, sz=bz-az, l2=sx*sx+sy*sy+sz*sz;
  let u=l2>0?-(ax*sx+ay*sy+az*sz)/l2:0;
  u=u<0?0:u>1?1:u;
  const dx=ax+sx*u, dy=ay+sy*u, dz=az+sz*u;
  return dx*dx+dy*dy+dz*dz<=GH_GIFT_R*GH_GIFT_R;
}`);
  mutationMustFail(assertContract, mutation, "the replay-edge oracle kills the unclamped 9.99→10.01 survivor");
});

function whiffResult(source, giftEnabled, tagged) {
  const calls = { event: 0, reticle: 0, sfx: 0, duck: 0, trauma: 0, kick: 0, rumble: 0 };
  const state = { shots: 0, streak: 9 };
  const context = vm.createContext({
    GH_GIFT: giftEnabled, state, reduceMotion: false, CFG: { hitTrauma: 1 },
    pushEvent: () => { calls.event += 1; }, flashReticleBad: () => { calls.reticle += 1; }, playWhiffSfx: () => { calls.sfx += 1; },
    missGrooveDuck: () => { calls.duck += 1; }, addTrauma: () => { calls.trauma += 1; }, missCamKick: () => { calls.kick += 1; }, padRumble: () => { calls.rumble += 1; },
  });
  new vm.Script(`${extractFunction(source, "onWhiff")}\nonWhiff(${tagged});`).runInContext(context);
  return { calls, state };
}

test("a launch-tagged gift miss reaches quiet bookkeeping and no punitive tap", () => {
  const assertContract = (source) => {
    assert.deepEqual(whiffResult(source, true, true), { calls: { event: 0, reticle: 0, sfx: 0, duck: 0, trauma: 0, kick: 0, rumble: 0 }, state: { shots: 1, streak: 9 } });
    assert.deepEqual(whiffResult(source, true, false), { calls: { event: 1, reticle: 1, sfx: 1, duck: 1, trauma: 1, kick: 1, rumble: 1 }, state: { shots: 1, streak: 0 } });
    assert.deepEqual(whiffResult(source, false, true), { calls: { event: 1, reticle: 1, sfx: 1, duck: 1, trauma: 1, kick: 1, rumble: 1 }, state: { shots: 1, streak: 0 } }, "the kill-switch restores the normal whiff even for an adversarial true argument");
    assert.match(extractFunction(source, "updateProjectiles"), /onWhiff\(gift\)/);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "onWhiff", (fn) => fn.replace("if(GH_GIFT && gift) return;", "if(GH_GIFT && gift){ flashReticleBad(); return; }"));
  mutationMustFail(assertContract, mutation, "the no-harm oracle kills a single reticle punishment leaking through");
});

function finalizedGift(source, gift = true) {
  let stored = "";
  runGhost(source, {
    gift, record: true,
    extra: { localStorage: { getItem: () => null, setItem: (_key, value) => { stored = value; } } },
    body: `
      ghostRecordArm(); _ghostRecordArrivals=GH_WORTHY_ARRIVALS;
      _ghostRecord.bpmCurve=Array.from({length:200},(_x,i)=>[i*0.3,60+i/100]);
      _ghostRecord.targets=Array.from({length:1200},(_x,i)=>[i*0.04,i%4,i,i*0.04+0.02,0,null]);
      _ghostRecord.taps=Array.from({length:2400},(_x,i)=>[i*0.025,i%4,100]);
      _ghostRecord.fires=Array.from({length:1200},(_x,i)=>[i*0.05,3.1415,-1.5358,0]);
      _ghostGiftMail=Array.from({length:64},(_x,i)=>[i,i%4]);
      Tone.Transport.seconds=64; ghostRecordFinalize();
    `,
  });
  return stored;
}

test("mail is a capped generic wrapper ledger, trims with the night, and speaks once in priority order", () => {
  const assertContract = (source) => {
    const stored = finalizedGift(source);
    assert.ok(stored.length > 0 && stored.length <= 100000, "the wrapper, including mail, stays inside the night cap");
    const wrapper = JSON.parse(stored);
    assert.deepEqual(Object.keys(wrapper), ["ghost", "mail"]); assert.equal(wrapper.mail.length, 64); assert.equal(wrapper.ghost.v, 1);
    const offArtifact = JSON.parse(finalizedGift(source, false));
    assert.deepEqual(Object.keys(offArtifact), ["v", "date", "moonBucket", "bpm0", "dur", "bpmCurve", "targets", "taps", "fires"], "ghostGift:0 stores the wave-13 artifact with no wrapper or mail");
    const lines = runGhost(source, { body: `_ghostGiftGreetingCount=2; _ghostGiftMailSpoken=false; this.lines=[ghostGiftMailLine(),ghostGiftMailLine()];` }).lines;
    assert.deepEqual(Array.from(lines), ["you reached back · 2 notes caught", ""]);
    assert.match(html, /ghostGiftMail:'きみは 手をのばした · \{n\}この音を つかまえた'/);
    const flash = extractFunction(source, "flashTheme");
    assert.match(flash, /const ml=rl\?'':\(GH_GIFT\?ghostGiftMailLine\(\):''\)/);
    assert.match(flash, /const dl=rl\|\|ml\?'':/); assert.match(flash, /rl\|\|ml\|\|dl\|\|/);
    assert.doesNotMatch(extractFunction(source, "ghostGiftCatch"), /\bself\b/i, "mail rows carry no self-owner assumption");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostRecordTrim", (fn) => fn.replace("family.shift(); json=JSON.stringify(payload);", "family.shift(); json=JSON.stringify(r);"));
  mutationMustFail(assertContract, mutation, "the wrapper-size oracle kills a ledger that overflows or falls off the trimmed night");
});

test("all gift paths obey the road clock, named tuning, lane authority, pooling, LOW, and reduced motion", () => {
  const assertContract = (source) => {
    const names = ["ghostGiftSync", "ghostGiftable", "ghostGiftLockTarget", "ghostGiftPlanSpeed", "ghostCatchBurst", "ghostGiftCatch", "ghostGiftProjectileHit", "onWhiff", "fire", "spawnProjectile", "updateProjectiles", "updateScope"];
    const paths = names.map((name) => extractFunction(source, name)).join("\n");
    assert.doesNotMatch(paths, /state\.t/, "gift code never reads capped gameplay time");
    assert.match(extractFunction(source, "ghostGiftSync"), /ghostRoadTime\(\)/);
    assert.match(extractFunction(source, "spawnProjectile"), /GH_GIFT\?\{[^}]*gift:false[^}]*\}:\{pos:new THREE\.Vector3\(\),vel:new THREE\.Vector3\(\),fireRow:null,life:0,mesh:null,charged:false\}/);
    const block = ghostBlock(source);
    for (const name of ["GH_GIFT_SPEED", "GH_GIFT_V", "GH_GIFT_R", "GH_GIFT_LEAD", "GH_CAP_MAIL", "GH_CATCH_EFFECT_MAX", "GH_CATCH_BIRDS", "GH_CATCH_LIFE", "GH_CATCH_SCALE", "GH_CATCH_SIGH_LIFE", "GH_CATCH_SIGH_RISE", "GH_CATCH_RING_SCALE"]) assert.match(block, new RegExp(`\\b${name}\\b`));
    assert.match(block, /GH_LOW_BURST_MAX=0/); assert.match(extractFunction(source, "ghostCatchBurst"), /_ghBurstPool/); assert.doesNotMatch(extractFunction(source, "ghostCatchBurst"), /Math\.random|rnd\(/);
    assert.match(extractFunction(source, "ghostSeatUpdateBursts"), /bird\.core\?_ghCatchWarm:ghostLaneColor/);
    assert.match(extractFunction(source, "ghostSeatUpdateBursts"), /reduceMotion\?0:age/);
    assert.match(extractFunction(source, "ghostSeatUpdateTargets"), /rise=reduceMotion\?0:/);
    const laneHex = source.match(/WASD_HEX=\[([^\]]+)\]/);
    assert.ok(laneHex);
    for (const literal of laneHex[1].split(",").map((value) => value.trim())) assert.ok(!block.toLowerCase().includes(literal.toLowerCase()), `Gift contains no lane literal ${literal}`);
    for (const name of ["ghostGiftLockTarget", "ghostGiftProjectileHit", "ghostGiftCatch", "ghostCatchBurst"]) assert.doesNotMatch(extractFunction(source, name), /\bnew\s+THREE\b/, `${name} uses shared objects only`);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostGiftable", (fn) => fn.replace("return !!(", "t=state.t; return !!("));
  mutationMustFail(assertContract, mutation, "the one-clock scan kills a state.t giftability sneak");
});

test("catch state is isolated from replay, gameplay, spawning, RNG, and ordinary fire recording", () => {
  const assertContract = (source) => {
    const writes = [], gameplay = { t: 99, bpm: 42, hits: 7, shots: 8, streak: 6, range: 20 };
    const state = new Proxy(gameplay, { set(target, key, value) { writes.push([String(key), value]); target[key] = value; return true; } });
    let randomCalls = 0;
    const trackedMath = Object.create(Math); trackedMath.random = () => { randomCalls += 1; return 0.5; };
    const context = runGhost(source, {
      gift: true, extra: { state, Math: trackedMath, Vec3 }, body: `
        const row=[0,2,7,10,0,null]; _ghostSeatRecord={targets:[row],fires:[[1,0,0,0]]};
        _ghCaughtSlots=new Set(); _ghostGiftMail=[]; _ghGiftImpactPos=new Vec3(); _ghCatchPool=null; _ghBurstPool=null;
        const before=JSON.stringify(_ghostSeatRecord), stateBefore=JSON.stringify(state);
        this.first=ghostGiftCatch(row,9); this.second=ghostGiftCatch(row,9.1);
        for(let i=0;i<70;i++) ghostGiftCatch([0,i%4,100+i,10,0,null],i);
        this.isolation={before,after:JSON.stringify(_ghostSeatRecord),stateBefore,stateAfter:JSON.stringify(state),mail:_ghostGiftMail.map(row=>Array.from(row))};
      `,
    });
    assert.equal(context.first, true); assert.equal(context.second, false);
    assert.equal(context.isolation.after, context.isolation.before, "caught state never rewrites last night");
    assert.equal(context.isolation.stateAfter, context.isolation.stateBefore); assert.deepEqual(writes, []); assert.equal(randomCalls, 0);
    assert.equal(context.isolation.mail.length, 64); assert.deepEqual(Array.from(context.isolation.mail[0]), [6, 2]); assert.deepEqual(Array.from(context.isolation.mail[63]), [69, 1]);
    assert.match(extractFunction(source, "fire"), /ghostRecordFire\(ghostRoadTime\(\),yaw,pitch\)/);
    assert.match(extractFunction(source, "updateProjectiles"), /ghostRecordMarkFire\(pr\.fireRow,true\)/);
    assert.doesNotMatch(extractFunction(source, "ghostGiftCatch"), /state\.|pushEvent|changeBpm|spawn|rnd\(|Math\.random/);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostGiftCatch", (fn) => fn.replace("_ghCaughtSlots.add(row[2]);", "_ghCaughtSlots.add(row[2]); row[4]=1;"));
  mutationMustFail(assertContract, mutation, "the replay snapshot kills a catch that rewrites the ghost recording");
});

test("an internal replay rewind preserves caught slots and cannot duplicate mail", () => {
  const assertContract = (source) => {
    const context = runGhost(source, { gift: true, extra: { Vec3 }, body: `
      const row=[0,1,7,10,0,null], record={dur:10,bpm0:60,bpmCurve:[],targets:[row],taps:[],fires:[]};
      _ghostSeatRecord=record; _ghActiveTargets=[]; _ghHitRows=[]; _ghBeatPrefix=[]; _ghCaughtSlots=new Set(); _ghostGiftMail=[]; _ghGiftImpactPos=new Vec3(); _ghCatchPool=null; _ghBurstPool=null;
      this.first=ghostGiftCatch(row,9); _ghLastTime=9; ghostSeatAdvance(1); this.second=ghostGiftCatch(row,9.1);
      this.mail=_ghostGiftMail.map(row=>Array.from(row)); this.caught=_ghCaughtSlots.has(7);
    ` });
    assert.equal(context.first, true); assert.equal(context.second, false); assert.equal(context.caught, true);
    assert.deepEqual(Array.from(context.mail, (row) => Array.from(row)), [[9, 1]], "rewind cannot duplicate the caught note's mail");
    assert.doesNotMatch(extractFunction(source, "ghostSeatPrepare"), /_ghCaughtSlots\.clear\(\)/);
    assert.match(extractFunction(source, "ghostSeatReset"), /_ghCaughtSlots\.clear\(\)/);
  };
  assertContract(html);
  const mutation = replaceFunction(html, "ghostSeatPrepare", (fn) => fn.replace("if(GH_GIFT){", "if(GH_GIFT){\n    if(_ghCaughtSlots) _ghCaughtSlots.clear();"));
  mutationMustFail(assertContract, mutation, "the rewind oracle kills caught-slot resurrection and duplicate mail");
});

function revealCollapseResult(source) {
  const calls = { mark: 0, whiff: 0, grade: 0, clank: 0, orb: 0 };
  const projectiles = [];
  const authority = { uniforms: { uNow: { value: 0 }, uArchN0: { value: 0 }, uK: { value: [0] } } };
  const context = runGhost(source, { gift: true, record: true, extra: {
    Vec3, calls, projectiles, windX: 0, windZ: 0, ROOM_HALF_W: 32, ROOM_HALF_D: 32, ML_ARC_VOID: false, roadWallMat: authority, roadArchMat: null,
    soundOn: false, toneReady: false, kick: null,
    onWhiff: () => { calls.whiff += 1; },
    orbOpen: () => { calls.orb += 1; return true; }, gradeRhythmHit: () => { calls.grade += 1; }, clankShot: () => { calls.clank += 1; }, handleTankHit: () => {},
    retireProjectile: (index) => { projectiles.splice(index, 1); }, moonlineVoid: () => false, spawnLandRing: () => {},
  }, body: `
    ${extractFunction(source, "simGiftShotHits")}
    ${extractFunction(source, "segDistSq")}
    ${extractFunction(source, "updateProjectiles")}
    const row=[0,1,5,10,0,null], targetPos=new Vec3(); ghostTargetPosition(row,8,targetPos);
    const projectile={pos:new Vec3().copy(targetPos),vel:new Vec3(),life:0,mesh:null,gift:true,giftRow:row,giftRoadT:7.99,fireRow:[0,0,0,0]};
    projectiles.push(projectile); this.targets=[{dead:false,radius:2.2,sc:1,hpMax:1,kind:0,mesh:{position:new Vec3().copy(targetPos)}}]; this._prev=new Vec3(); _ghostRecord={}; _ghostSeatRecord={dur:10,targets:[row]}; _ghostSeatRoot={}; _ghCaughtSlots=new Set(); _ghostGiftMail=[]; _ghGiftPrevPos=new Vec3(); _ghGiftImpactPos=new Vec3(); _ghBurstPool=null; _ghCatchPool=null;
    Tone.Transport.seconds=8; updateProjectiles(0); this.closed={live:projectiles.length,tag:projectile.gift,mail:_ghostGiftMail.length,calls:{...calls}};
    roadWallMat.uniforms.uK.value=[1]; Tone.Transport.seconds=8.01; updateProjectiles(0); this.reopened={live:projectiles.length,mail:_ghostGiftMail.map(row=>Array.from(row)),fireHit:projectile.fireRow[3],calls:{...calls}};
    projectiles.length=0; _ghCaughtSlots.clear(); _ghostGiftMail=[]; _ghSeatX=90; _ghostRoadBase=0; _ghostRoadLast=7; _ghGiftRoadT=7; Tone.Transport.seconds=7;
    const absRow=[0,1,9,10,0,null], targetAtLaunch=new Vec3(); ghostTargetPosition(absRow,7,targetAtLaunch);
    const muzzle=new Vec3(targetAtLaunch.x-72,2.2,targetAtLaunch.z+10), velocity=new Vec3(72,0,0), proxy={mesh:{position:targetAtLaunch},vel:new Vec3(0,0,10),radius:GH_GIFT_R,sc:1,gift:true,lockUntil:3};
    const absLocked=simGiftShotHits(muzzle,velocity,1,proxy), absolute={pos:new Vec3().copy(muzzle),vel:new Vec3().copy(velocity),life:0,mesh:null,gift:true,giftRow:absRow,giftRoadT:7,giftLaunchT:7,giftX:muzzle.x,giftY:muzzle.y,giftZ:muzzle.z,giftVx:velocity.x,giftVy:velocity.y,giftVz:velocity.z,fireRow:[0,0,0,0]};
    projectiles.push(absolute); _ghostSeatRecord={dur:10,targets:[absRow]}; roadWallMat.uniforms.uK.value=[0]; Tone.Transport.seconds=8.2; updateProjectiles(1.2); const absoluteClosed={locked:absLocked,live:projectiles.length,caught:_ghCaughtSlots.has(9),cursor:absolute.giftRoadT};
    roadWallMat.uniforms.uK.value=[1]; Tone.Transport.seconds=8.3; updateProjectiles(0.1); this.absolute={closed:absoluteClosed,reopened:{live:projectiles.length,caught:_ghCaughtSlots.has(9),mail:_ghostGiftMail.length,cursor:absolute.giftRoadT}};
  ` });
  return {
    closed: { ...context.closed, calls: { ...context.closed.calls } },
    reopened: { ...context.reopened, mail: Array.from(context.reopened.mail, (row) => Array.from(row)), calls: { ...context.reopened.calls } },
    absolute: { closed: { ...context.absolute.closed }, reopened: { ...context.absolute.reopened } },
  };
}

test("mid-flight reveal collapse keeps the tag harmless and exclusive until reveal reopens", () => {
  const assertContract = (source) => {
    const result = revealCollapseResult(source);
    assert.deepEqual(result.closed, { live: 1, tag: true, mail: 0, calls: { mark: 0, whiff: 0, grade: 0, clank: 0, orb: 0 } });
    assert.deepEqual(result.reopened, { live: 0, mail: [[8.01, 1]], fireHit: 1, calls: { mark: 0, whiff: 0, grade: 0, clank: 0, orb: 0 } });
    assert.deepEqual(result.absolute.closed, { locked: true, live: 1, caught: false, cursor: 8.2 }, "the hidden interval advances the absolute Gift collision cursor");
    assert.deepEqual(result.absolute.reopened, { live: 1, caught: false, mail: 0, cursor: 8.3 }, "reopening cannot backfill a connection that crossed under the veil");
  };
  assertContract(html);
  let mutation = replaceFunction(html, "ghostGiftSync", (fn) => fn.replace("return _ghGiftReveal>=GH_GIFT_V;", "return true;"));
  mutation = replaceFunction(mutation, "ghostGiftable", (fn) => fn.replace("v>=GH_GIFT_V", "v>=0"));
  mutationMustFail(assertContract, mutation, "the reveal-gate oracle kills a mid-flight catch while v is below GH_GIFT_V");
  mutation = replaceFunction(html, "ghostGiftProjectileHit", (fn) => fn.replace("if(Number.isFinite(pr.giftLaunchT)&&Number.isFinite(pr.life)){ const cursor=pr.giftLaunchT+Math.max(0,pr.life); pr.giftRoadT=Number.isFinite(pr.giftRoadT)?Math.max(pr.giftRoadT,cursor):cursor; } ", ""));
  mutationMustFail(assertContract, mutation, "the reveal cursor oracle kills a retroactive catch after the veil reopens");
});
