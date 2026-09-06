"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "aim-dojo-main.js"), "utf8");

function flowSourceFunction(name) {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} exists in the browser runtime`);
  const openAt = source.indexOf("{", match.index + match[0].length);
  let depth = 0, quote = "", lineComment = false, blockComment = false;
  for (let i = openAt; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
    if (quote) { if (ch === "\\") i += 1; else if (ch === quote) quote = ""; continue; }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}" && --depth === 0) return source.slice(match.index, i + 1);
  }
  throw new Error(`unclosed function ${name}`);
}

function flowSandbox(bpm = 28) {
  const context = vm.createContext({
    Math, Number, console,
    CFG: { streakFlow: true, streakGrace: true, streakMissLimit: 2, wasdRhythm: true, grooveGroove: true, grooveVuln: true, wasdPipN: 16, hitTrauma: .1 },
    state: { t: 10, bpm, running: true, shots: 0, streak: 4 },
    trainMode: false, templeActive: false, bonusActive: false, reduceMotion: false, LOW: false,
    _wasdCombo: 0, _pipSetN: 0, _pipSetFlashT: -999,
    _streakNotice: { misses: 0, kind: "", at: -999, hits: 0 },
    _flowGlow: { value: 0 }, _flowPhase: { value: 0 }, _flowActive: false, _flowGraceUntil: -999,
    _openAmt: 0, _baseMul: 1, _noteFlashT: -999, _noteFlashHit: false,
    _tapOffMs: 0, _tapOffSum: 0, _tapOffN: 0, _tapAcc: 0, _tapShowT: -999,
    noteTrainWasd() {}, pushEvent() {}, flashReticleBad() {}, playWhiffSfx() {},
    missGrooveDuck() {}, addTrauma() {}, missCamKick() {}, padRumble() {},
  });
  vm.runInContext([
    "streakFlowLevel", "updateStreakFlow", "resetStreakFlow", "streakFlowOpen",
    "wasdStreakMiss", "wasdStreakRecover", "resetWasdStreakNotice",
    "wasdTapAccuracy", "_wasdResolve", "orbOpen", "onWhiff",
  ].map(flowSourceFunction).join("\n"), context);
  context.credit = (count) => {
    for (let i = 0; i < count; i += 1) {
      context.state.t += 60 / bpm;
      context._wasdResolve(0, true, .2);
      context.updateStreakFlow(1 / 60);
    }
  };
  return context;
}

function flowProjectileSandbox(bpm = 28) {
  const context = flowSandbox(bpm);
  // Plain vector doubles preserve the runtime's real launch, integration and hit dispatcher.
  const vector = () => ({
    x: 0, y: 4, z: 0,
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; },
  });
  Object.assign(context.CFG, { projGravity: 0, projRadius: .17, projLife: 10, tank: { fillOnly: true } });
  const events = [];
  Object.assign(context, {
    THREE: { Vector3: vector }, projectiles: [], projectilePool: [], targets: [], _prev: vector(),
    windX: 0, windZ: 0, ROOM_HALF_W: 1000, ROOM_HALF_D: 1000,
    soundOn: false, toneReady: false, kick: null,
    computeShotPlan(pos, vel) { pos.copy({ x: 0, y: 4, z: 0 }); vel.copy({ x: 0, y: 0, z: 1 }); return .5; },
    playFireLaunch() {}, acquireProjectileMesh: () => ({ position: vector() }),
    retireProjectile(index) { const pr = context.projectiles.splice(index, 1)[0]; context.projectilePool.push(pr); },
    segDistSq: () => 0,
    gradeRhythmHit(tg) { tg.dead = true; events.push("kill"); },
    clankShot() { events.push("clank"); },
    handleTankHit() { events.push("tank"); },
  });
  // Vector3 is called with new by the real pool acquisition.
  context.THREE.Vector3 = function () { return vector(); };
  vm.runInContext(["spawnProjectile", "updateProjectiles"].map(flowSourceFunction).join("\n"), context);
  context.makeTarget = (extra = {}) => ({ kind: 0, hp: 1, hpMax: 1, dead: false, radius: 1, sc: 1, mesh: { position: vector() }, ...extra });
  context.events = events;
  context.hit = (target) => {
    context.targets = [target || context.makeTarget()];
    context.updateProjectiles(0);
    return events.at(-1);
  };
  return context;
}

test("Flow begins on the first completed sixteen-main ring and the raw beat gate stays unchanged", () => {
  assert.match(source, /\bstreakFlow\s*:\s*true\b/, "the reward ships enabled");
  const c = flowSandbox();
  c.credit(15);
  assert.equal(c._wasdCombo, 15);
  assert.equal(c._pipSetN, 0);
  assert.equal(c.streakFlowLevel(), 0);
  assert.equal(c.streakFlowOpen(), false);
  c.credit(1);
  assert.equal(c._pipSetN, 1);
  assert.equal(c.streakFlowLevel(), 1);
  assert.equal(c.streakFlowOpen(), true);
  assert.equal(c.orbOpen(), false, "Flow does not rewrite the whole-beat gate used by tanks");
  c._openAmt = 1;
  assert.equal(c.orbOpen(), true);
  c.credit(1);
  assert.equal(c.streakFlowOpen(), true, "the seventeenth tap sustains the full reward while the next ring starts");
});

test("optional notes alone cannot activate the completed-main-ring reward", () => {
  const c = flowSandbox();
  for (let i = 0; i < 32; i += 1) c._wasdResolve(0, false, .2);
  assert.equal(c._wasdCombo, 32);
  assert.equal(c._pipSetN, 0);
  assert.equal(c.streakFlowOpen(), false);
});

test("later set numbers deepen the sheen to a bounded ceiling while the first set grants full shields", () => {
  const c = flowSandbox(), glow = c._flowGlow, phase = c._flowPhase, values = [];
  for (let set = 1; set <= 6; set += 1) {
    c.credit(16);
    for (let frame = 0; frame < 300; frame += 1) c.updateStreakFlow(1 / 60);
    values.push(c._flowGlow.value);
    assert.equal(c.streakFlowOpen(), true);
    assert.equal(c.streakFlowLevel(), Math.min(3, set));
    assert.ok(c._flowGlow.value > 0 && c._flowGlow.value <= 1);
    assert.equal(c._flowGlow, glow, "the shader uniform keeps its shared identity");
    assert.equal(c._flowPhase, phase);
  }
  assert.ok(values[1] > values[0] && values[2] > values[1]);
  assert.ok(Math.abs(values[3] - values[5]) < 1e-8, "large streak numbers do not keep brightening the room");
});

test("weak and zero-credit mains warn once, then end Flow with quarter-beat grace at every supported tempo", () => {
  for (const bpm of [20, 28, 40, 50, 60]) {
    for (const weak of [true, false]) {
      const c = flowSandbox(bpm);
      c.credit(16);
      c._wasdResolve(weak ? 0 : .2, true, .2, weak ? { fullCredit: false, weakAcc: .25 } : undefined);
      assert.equal(c._wasdCombo, 16, "the first failed main preserves the earned hit count");
      assert.equal(c._pipSetN, 1);
      assert.equal(c._streakNotice.kind, "warning");
      assert.equal(c._streakNotice.misses, 1);
      assert.equal(c._streakNotice.hits, 16);
      assert.equal(c.streakFlowOpen(), true);
      assert.ok(c._flowGraceUntil < 0, "a warning does not start shield-closing grace");
      c.state.t += 60 / bpm;
      c._wasdResolve(weak ? 0 : .2, true, .2, weak ? { fullCredit: false, weakAcc: .25 } : undefined);
      const brokenAt = c.state.t, grace = .25 * 60 / bpm;
      assert.equal(c._streakNotice.kind, "ended");
      assert.equal(c._streakNotice.hits, 16);
      assert.equal(c._pipSetN, 0);
      assert.equal(c.streakFlowLevel(), 0);
      assert.equal(c.streakFlowOpen(), true, "the break does not slam shields on an arriving shot");
      assert.ok(Math.abs(c._flowGraceUntil - brokenAt - grace) < 1e-12);
      c.state.t = brokenAt + grace - 1e-6;
      assert.equal(c.streakFlowOpen(), true);
      c.state.t = brokenAt + grace + 1e-6;
      assert.equal(c.streakFlowOpen(), false);
      const endedAt = c._flowGraceUntil;
      c.state.t += 1;
      assert.equal(c.streakFlowOpen(), false);
      assert.equal(c._flowGraceUntil, endedAt, "repeated reads cannot extend a broken streak's grace");
    }
  }
});

test("a keyboard streak break fades the visual reward rather than abruptly clearing the glow", () => {
  const c = flowSandbox();
  c.credit(16);
  for (let i = 0; i < 100; i += 1) c.updateStreakFlow(1 / 60);
  const activeGlow = c._flowGlow.value;
  c._wasdCombo = 0; c._pipSetN = 0;
  c.updateStreakFlow(1 / 60);
  assert.ok(c._flowGlow.value > 0 && c._flowGlow.value <= activeGlow);
  c.state.t += 2;
  for (let i = 0; i < 300; i += 1) c.updateStreakFlow(1 / 60);
  assert.ok(c._flowGlow.value < .001);
  assert.equal(c.streakFlowOpen(), false);
});

test("only a credited main clears a Flow warning and preserves the accumulated correct-hit total", () => {
  const c = flowSandbox(); c.credit(23);
  c._wasdResolve(.2, true, .2);
  assert.equal(c._streakNotice.misses, 1);
  assert.equal(c._streakNotice.hits, 23);
  c.onWhiff();
  assert.equal(c._streakNotice.misses, 1, "shooting misses cannot spend or restore WASD protection");
  c._wasdResolve(0, false, .2);
  assert.equal(c._streakNotice.misses, 1, "the retained optional-note branch cannot clear a main warning");
  c.credit(1);
  assert.equal(c._streakNotice.kind, "");
  assert.equal(c._streakNotice.misses, 0);
  assert.equal(c._streakNotice.hits, 0);
  assert.equal(c._wasdCombo, 25, "legacy optional credit and both sides of the forgiven main remain accounted for");
  assert.equal(c.streakFlowOpen(), true);
});

test("the warning budget applies only to earned free-play Flow and can be disabled", () => {
  assert.match(source, /\bstreakGrace\s*:\s*true\b/);
  assert.match(source, /\bstreakMissLimit\s*:\s*2\b/);
  for (const variant of ["partial", "lesson", "disabled"]) {
    const c = flowSandbox();
    c.credit(variant === "partial" ? 15 : 16);
    if (variant === "lesson") c.trainMode = true;
    if (variant === "disabled") c.CFG.streakGrace = false;
    c._wasdResolve(.2, true, .2);
    assert.equal(c._wasdCombo, 0, variant);
    assert.equal(c._pipSetN, 0, variant);
    assert.equal(c._streakNotice.kind, "", variant);
    assert.equal(c._streakNotice.misses, 0, variant);
  }
});

test("hiding Flow in pause, Temple or flick bonus preserves a pending warning for the next normal main", () => {
  for (const mode of ["pause", "temple", "bonus"]) {
    const c = flowSandbox(); c.credit(16); c.wasdStreakMiss();
    const before = { ...c._streakNotice };
    if (mode === "pause") c.state.running = false;
    if (mode === "temple") c.templeActive = true;
    if (mode === "bonus") c.bonusActive = true;
    c.updateStreakFlow(0);
    assert.equal(c.streakFlowOpen(), false, mode);
    assert.deepEqual({ ...c._streakNotice }, before, mode);
    c.state.running = true; c.templeActive = false; c.bonusActive = false;
    assert.equal(c.streakFlowOpen(), true, mode);
    c.credit(1);
    assert.equal(c._streakNotice.misses, 0, mode);
  }
});

test("missing a shot changes the shooting streak but preserves the earned WASD Flow", () => {
  const c = flowSandbox();
  c.credit(16);
  c.onWhiff();
  assert.equal(c.state.streak, 0);
  assert.equal(c.state.shots, 1);
  assert.equal(c._wasdCombo, 16);
  assert.equal(c._pipSetN, 1);
  assert.equal(c.streakFlowOpen(), true);
});

test("Flow cannot leak into lessons, Temple, bonus mode, pauses or disabled rhythm settings", () => {
  const cases = [
    (c) => { c.trainMode = true; }, (c) => { c.templeActive = true; },
    (c) => { c.bonusActive = true; }, (c) => { c.state.running = false; },
    (c) => { c.CFG.streakFlow = false; }, (c) => { c.CFG.wasdRhythm = false; },
    (c) => { c.CFG.grooveGroove = false; }, (c) => { c.CFG.grooveVuln = false; },
  ];
  for (const disable of cases) {
    const c = flowSandbox(); c.credit(16); disable(c); c.updateStreakFlow(1 / 60);
    assert.equal(c.streakFlowLevel(), 0);
    assert.equal(c.streakFlowOpen(), false, "mode changes do not get the ordinary streak-loss grace");
    assert.equal(c._flowGlow.value, 0);
    assert.equal(c._flowActive, false);
  }
});

test("reduced motion and LOW retain a still, visible reward without rotating the iridescence", () => {
  for (const flag of ["reduceMotion", "LOW"]) {
    const c = flowSandbox(); c[flag] = true; c.credit(16);
    c.updateStreakFlow(1);
    assert.ok(c._flowGlow.value > 0);
    assert.equal(c._flowPhase.value, 0);
    c.state.t += 20; c.updateStreakFlow(1);
    assert.equal(c._flowPhase.value, 0);
    assert.equal(c.streakFlowOpen(), true);
  }
  const c = flowSandbox(); c.credit(16); c.updateStreakFlow(1);
  const first = c._flowPhase.value;
  c.state.t += 1; c.updateStreakFlow(1);
  assert.ok(c._flowPhase.value > first);
});

test("reset clears the shared Flow uniforms and grace, and session reset invokes that reset", () => {
  const c = flowSandbox(); c.credit(16); c._wasdCombo = 0; c._pipSetN = 0; c.streakFlowOpen();
  const glow = c._flowGlow, phase = c._flowPhase;
  c.resetStreakFlow();
  assert.equal(c._flowGlow, glow); assert.equal(c._flowPhase, phase);
  assert.equal(glow.value, 0); assert.equal(phase.value, 0);
  assert.equal(c._flowActive, false);
  assert.ok(c._flowGraceUntil < 0);
  assert.equal(c.streakFlowOpen(), false);
  assert.match(flowSourceFunction("resetSession"), /resetStreakFlow\(\)/);
});

test("ordinary orbs, including newly created ones, accept off-beat arrivals throughout Flow", () => {
  const c = flowProjectileSandbox();
  c.spawnProjectile(1);
  assert.equal(c.hit(), "clank", "the same off-beat contact before earning Flow remains shielded");
  c.credit(16);
  c.spawnProjectile(2);
  assert.equal(c.hit(), "kill");
  c.spawnProjectile(3);
  assert.equal(c.hit(c.makeTarget({ kind: 1 })), "kill", "a new special ordinary orb shares the open field");
});

test("a projectile launched during Flow stays fair after grace ends, and pooled shots are stamped afresh", () => {
  const c = flowProjectileSandbox(); c.credit(16); c.spawnProjectile(7);
  const earnedShot = c.projectiles[0];
  assert.equal(earnedShot.flow, true);
  c._wasdCombo = 0; c._pipSetN = 0; c.streakFlowOpen();
  c.state.t += 2;
  assert.equal(c.streakFlowOpen(), false);
  assert.equal(c.hit(), "kill", "earned launch permission survives the flight");
  c.spawnProjectile(8);
  assert.equal(c.projectiles[0], earnedShot, "the exact pooled record is reused");
  assert.equal(c.projectiles[0].flow, false, "a new launch overwrites old entitlement");
  assert.equal(c.hit(), "clank");
});

test("Flow helps a pre-existing projectile only while the field is open; grace launches also remain fair", () => {
  const c = flowProjectileSandbox(); c.spawnProjectile(1);
  assert.equal(c.projectiles[0].flow, false);
  c.credit(16);
  assert.equal(c.hit(), "kill", "activation opens targets to a shot already in flight");
  c._wasdCombo = 0; c._pipSetN = 0;
  assert.equal(c.streakFlowOpen(), true);
  c.spawnProjectile(2);
  assert.equal(c.projectiles[0].flow, true);
  c.state.t += 2;
  assert.equal(c.hit(), "kill", "the visible ending grace grants honest launch permission");
  c.spawnProjectile(3);
  assert.equal(c.hit(), "clank");
});

test("Flow never bypasses tank dispatch, including an amber tank with only its final HP left", () => {
  const c = flowProjectileSandbox(); c.credit(16);
  for (const hp of [3, 2, 1]) {
    c.spawnProjectile(hp);
    assert.equal(c.projectiles[0].flow, true);
    assert.equal(c.hit(c.makeTarget({ hp, hpMax: 3, fill16: 64, fig: [8, 12, 16] })), "tank");
  }
  // Replay the actual tank gate as well: Flow does not replace a closed figure note.
  vm.runInContext(flowSourceFunction("handleTankHit"), c);
  c.fillOpen = () => -1;
  c.spawnProjectile(4);
  const tank = c.makeTarget({ hp: 1, hpMax: 3, fill16: 64, fig: [8, 12, 16] });
  assert.equal(c.hit(tank), "clank");
  assert.equal(tank.hp, 1);
  assert.equal(tank.dead, false);
});

test("decoy penalties remain reachable regardless of ordinary shields or Flow", () => {
  const c = flowProjectileSandbox();
  c.spawnProjectile(1);
  assert.equal(c.hit(c.makeTarget({ kind: 2 })), "kill", "the existing grading path owns the decoy penalty even when shields are shut");
  c.credit(16); c.spawnProjectile(2);
  assert.equal(c.hit(c.makeTarget({ kind: 2 })), "kill");
});

test("the Flow reticle stays outside the hit circle, preserves the canvas state, and is still under reduced motion", () => {
  const c = flowSandbox(), strokes = [], saved = [];
  c.hudCtx = {
    globalAlpha: .5, lineWidth: 3, strokeStyle: "ordinary", lineCap: "butt", path: null,
    save() { saved.push({ globalAlpha: this.globalAlpha, lineWidth: this.lineWidth, strokeStyle: this.strokeStyle, lineCap: this.lineCap }); },
    restore() { Object.assign(this, saved.pop()); },
    beginPath() {}, arc(...args) { this.path = args; },
    stroke() { strokes.push({ path: this.path.slice(), color: this.strokeStyle, alpha: this.globalAlpha }); },
  };
  vm.runInContext(flowSourceFunction("drawStreakFlow"), c);
  c.drawStreakFlow(280, 280, 32);
  assert.equal(strokes.length, 0);
  c.credit(16); c.updateStreakFlow(1);
  c.drawStreakFlow(280, 280, 32);
  assert.ok(strokes.length > 0);
  assert.ok(strokes.every((stroke) => stroke.path[2] > 32), "no reward arc overlaps the hit line or inner pips");
  assert.ok(new Set(strokes.map((stroke) => stroke.color)).size >= 3, "the persistent glow carries multiple pearl colors");
  assert.equal(c.hudCtx.globalAlpha, .5);
  assert.equal(c.hudCtx.lineWidth, 3);
  assert.equal(c.hudCtx.strokeStyle, "ordinary");
  assert.equal(c.hudCtx.lineCap, "butt");
  assert.equal(saved.length, 0);
  c.reduceMotion = true;
  strokes.length = 0; c._flowPhase.value = 10; c.drawStreakFlow(280, 280, 32);
  const firstPaths = strokes.map((stroke) => stroke.path);
  strokes.length = 0; c._flowPhase.value = 30; c.drawStreakFlow(280, 280, 32);
  assert.deepEqual(strokes.map((stroke) => stroke.path), firstPaths, "reduced motion keeps even a stale phase from rotating the ring");
  c.CFG.streakFlow = false; strokes.length = 0; c.drawStreakFlow(280, 280, 32);
  assert.equal(strokes.length, 0);
});
