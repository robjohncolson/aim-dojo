"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "aim-dojo-main.js"), "utf8");

function closingDelimiter(text, openAt) {
  let depth = 0, quote = "", lineComment = false, blockComment = false;
  for (let i = openAt; i < text.length; i += 1) {
    const ch = text[i], next = text[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
    if (quote) { if (ch === "\\") i += 1; else if (ch === quote) quote = ""; continue; }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}" && --depth === 0) return i;
  }
  throw new Error(`unclosed function/object at ${openAt}`);
}

function extractFunction(name) {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} exists in the loaded runtime`);
  const openAt = source.indexOf("{", match.index + match[0].length);
  return source.slice(match.index, closingDelimiter(source, openAt) + 1);
}

function extractLiteral(name) {
  const match = new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\{`).exec(source);
  assert.ok(match, `${name} is a literal runtime configuration`);
  const openAt = source.indexOf("{", match.index);
  return source.slice(openAt, closingDelimiter(source, openAt) + 1);
}

class FillVector {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  addScaledVector(v, scale) { this.x += v.x * scale; this.y += v.y * scale; this.z += v.z * scale; return this; }
  multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; }
  normalize() { return this.multiplyScalar(1 / (Math.hypot(this.x, this.y, this.z) || 1)); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}

function tankFillSandbox({ bpm = 28, off = 0, base16 = 64, latency = 0 } = {}) {
  const context = vm.createContext({
    Math, Number, console,
    DEFAULT_SKY_SUPABASE_ANON_KEY: "fixture", DEFAULT_SKY_SUPABASE_URL: "https://example.test",
    SIDEREAL_RUNTIME: {}, localStorage: { getItem: () => null },
    state: { bpm, range: 28, t: 0, running: true }, trainMode: false, templeActive: false,
    Tone: { Transport: { ticks: 0, PPQ: 192 }, now: () => 0 }, audioLat: () => latency,
    targets: [], GH_RECORD: false, soundOn: true, toneReady: true, reduceMotion: true,
    PENTA: [220, 246.94, 293.66, 329.63, 369.99], CHORD_ROOT: [55, 69.3, 82.4],
    kick: null, synthHit: null, beatSnap: () => 0, events: [], notes: [],
  });
  const merge = /for\(const k of Object\.keys\(SENSEI_PACK\)\)[^\n]+/.exec(source);
  assert.ok(merge, "the actual full-night SENSEI merge is present");
  vm.runInContext(`var CFG=${extractLiteral("CFG")}; var SENSEI_PACK=${extractLiteral("SENSEI_PACK")};\n${merge[0]}`, context);
  const names = ["lerp", "diffT", "projSpeedNow", "fillOff16", "fillOpen", "fillGlowAmt", "fillNote", "handleTankHit", "tankChip", "updateProjectiles"];
  names.push("fillCueNeed", "fillSkipClosed");
  vm.runInContext(names.map(extractFunction).join("\n"), context);
  context.lead = { triggerAttackRelease: (...args) => context.notes.push(args) };
  context.clankShot = (_tg, _point, soft) => context.events.push({ kind: "clank", soft });
  context.gradeRhythmHit = (tg) => { tg.dead = true; context.events.push({ kind: "kill" }); };
  context.setOff = (nextOff) => {
    context.Tone.Transport.ticks = ((base16 + nextOff) / 4 + latency / (60 / Math.max(20, bpm))) * context.Tone.Transport.PPQ;
    context.state.t = (base16 + nextOff) / 4 * 60 / Math.max(20, bpm);
  };
  context.makeTank = (figure = [8, 12, 16], hp = figure.length) => ({
    fig: figure.slice(), hp, hpMax: figure.length, fill16: base16, bowK: 4, dead: false,
  });
  context.setOff(off);
  return context;
}

function spawnFillSandbox(options = {}) {
  const context = tankFillSandbox(options);
  const rolls = [0, .5, .99, .6, .6, .6, .99, options.figureRoll ?? .1, .99, .99];
  const draws = [];
  Object.assign(context.CFG, {
    spawnField: "full", spawnMinDeg: 0, spawnMinHiDeg: 0,
    stars: { on: false }, deal: { on: false }, sensei: { on: false }, poly: { on: false }, sing: { on: false },
  });
  const shell = { scale: { setScalar() {} }, userData: { through: {} } };
  const core = { position: new FillVector(), scale: { setScalar() {} }, userData: { shell } };
  Object.assign(context, {
    THREE: { MathUtils: { degToRad: (degrees) => degrees * Math.PI / 180 } },
    PLAYER_POS: new FillVector(0, 4, 0), ROOM_BY: 20,
    _spawnAim0: new FillVector(), _spawnDir: new FillVector(), _spawnPos: new FillVector(),
    _polyPairing: false, _polyK: -1, _specialLive: true, _beatSpawnK: 0,
    _fillPend16: options.base16 ?? 64, _fillSpent8: (options.base16 ?? 64) / 2,
    KIND_CORE_MAT: ["plain-core"], KIND_SHELL_MAT: ["plain-shell"], TARGET_THROUGH_MAT: ["plain-through"],
    TANK_CORE_MAT: "tank-core", TANK_SHELL_MAT: "tank-shell", TANK_THROUGH_MAT: "tank-through",
    CHIP_FIELD: false, setAimDir: (v) => v.set(0, 0, -1),
    acquireTargetMesh: () => core, acquireTargetRecord: () => ({ vel: new FillVector() }),
    makeTargetSound: () => null, voiceTargetSound: () => {}, sensei2Speak: () => {},
    rnd: () => { const roll = rolls[draws.length] ?? .99; draws.push(roll); return roll; },
  });
  vm.runInContext(["targetRadius", "beatSpawnDist", "tankCloseDist", "spawnTarget"].map(extractFunction).join("\n"), context);
  context.spawn = () => { context.spawnTarget(); return context.targets.at(-1); };
  context.draws = draws;
  return context;
}

test("fill cue follows the still-playable beat after a dropped opener", () => {
  const c = tankFillSandbox({ off: 10 });
  const tg = c.makeTank(); c.targets.push(tg);
  assert.equal(c.fillGlowAmt(), 0, "the space between figure gates stays dark");
  c.setOff(12);
  assert.equal(c.fillOpen(tg), 1, "T2 already accepts the next remaining gate");
  assert.equal(c.fillGlowAmt(), 1, "the shell must bloom on that same accepted gate");
  c.setOff(16);
  assert.equal(c.fillOpen(tg), 2);
  assert.equal(c.fillGlowAmt(), 1, "the mercy downbeat must remain visible after both earlier notes were missed");
});

test("spawn drops a fig3 opener that the final k4 shot cannot reach", () => {
  const c = spawnFillSandbox({ off: 7.9 });
  const tg = c.spawn();
  assert.equal(tg.bowK, 4, "the real capped distance solver chose k4");
  assert.equal(tg.hpMax, 3, "the original figure length still anchors the walking notes");
  assert.equal(tg.hp, 2, "the unreachable opener is skipped before this offer enters targets");
  assert.deepEqual(Array.from(tg.fig.slice(tg.hpMax - tg.hp)), [12, 16]);
  assert.equal(c.draws.length, 9, "filtering cannot add a random draw after election and the close redraw");
});

test("early fig2 happy path and its two-hit tonic finish are unchanged", () => {
  const c = spawnFillSandbox({ off: 2, figureRoll: .9 });
  const tg = c.spawn();
  assert.equal(tg.hp, 2);
  assert.equal(tg.hpMax, 2);
  for (const gate of [12, 16]) {
    c.setOff(gate);
    assert.equal(c.fillGlowAmt(), 1);
    c.handleTankHit(tg, {});
  }
  assert.equal(tg.hp, 0);
  assert.deepEqual(c.events, [{ kind: "kill" }]);
  assert.equal(c.notes.at(-2)[0], 220, "the final gate lands on the octave-lifted theme tonic");
  assert.equal(c.notes.at(-1)[0], 440, "the existing octave sparkle is preserved");
});

test("fill clocks and judged windows use the actual SENSEI merge across the whole tempo ladder", () => {
  for (const [bpm, expectedWin] of [[20, .26], [28, .232], [40, .19], [50, .155], [60, .12]]) {
    const c = tankFillSandbox({ bpm, off: 12, latency: .137 });
    assert.deepEqual(Array.from(c.CFG.grooveOpenSec), [.26, .12]);
    const spb = 60 / bpm;
    const win = c.CFG.grooveOpenSec[0] + (c.CFG.grooveOpenSec[1] - c.CFG.grooveOpenSec[0]) * c.diffT();
    assert.ok(Math.abs(win - expectedWin) < 1e-12, `SENSEI judged window at ${bpm} BPM`);
    const tg = c.makeTank(); c.targets.push(tg);
    assert.ok(Math.abs(c.fillOff16(tg.fill16) - 12) < 1e-12, "the heard clock removes the same audio latency once");
    assert.equal(c.fillCueNeed(tg), 1);
    assert.ok(Math.abs(c.fillGlowAmt() - 1) < 1e-12);
    c.setOff(12 + (win - 1e-7) * 4 / spb);
    assert.equal(c.fillOpen(tg), 1, "the final instant inside the judged window still advertises this gate");
    assert.equal(c.fillCueNeed(tg), 1);
    c.setOff(12 + (win + 1e-7) * 4 / spb);
    assert.equal(c.fillOpen(tg), -1);
    assert.equal(c.fillCueNeed(tg), 2, "a closed gate hands the cue to the next playable one");
  }
});

test("cue search skips past openers, preserves accepted-index priority and falls back to the last gate", () => {
  const c = tankFillSandbox({ off: 10 });
  const tg = c.makeTank(); c.targets.push(tg);
  assert.equal(c.fillCueNeed(tg), 1);
  c.setOff(14);
  assert.equal(c.fillCueNeed(tg), 2);
  c.setOff(18);
  assert.equal(c.fillCueNeed(tg), 2, "an entirely past figure retains its final-gate fallback while alive");
  assert.equal(c.fillGlowAmt(), 0, "fallback does not invent a new post-mercy opening");
  // Deliberately overlapping fixture gates test earliest accepted index, using the real SENSEI window.
  // The authored figures still use [8,12,16] / [12,16]; this does not change any shipped window.
  const overlap = c.makeTank([8, 8.2, 16]);
  c.setOff(8.15);
  assert.equal(c.fillOpen(overlap), 0);
  assert.equal(c.fillCueNeed(overlap), 0, "the cue cannot pick the closer second gate over T2's first accepted gate");
  tg.dead = true;
  assert.equal(c.fillCueNeed(tg), -1);
  assert.equal(c.fillGlowAmt(), -1, "dead or expired targets hand the shell cue back to the field");
});

test("the moved cue keeps the existing blink-width floor and does not light unrelated beats", () => {
  const c = tankFillSandbox({ off: 10 });
  const tg = c.makeTank(); c.targets.push(tg);
  const spb = 60 / c.state.bpm;
  const visualHalfWidth = c.CFG.tank.blinkWin * spb;
  assert.equal(c.CFG.tank.blinkWin, .16);
  c.setOff(12 - .5 * visualHalfWidth * 4 / spb);
  assert.ok(Math.abs(c.fillGlowAmt() - .5) < 1e-12, "the approach remains the same triangular envelope");
  c.setOff(12);
  assert.equal(c.fillGlowAmt(), 1);
  c.setOff(14);
  assert.equal(c.fillGlowAmt(), 0, "the space between required gates stays dark instead of borrowing _openAmt");
});

test("k4 flight is a quarter beat in the real distance solver, and skips use that flight", () => {
  for (const bpm of [20, 28, 40, 50, 60]) {
    const c = spawnFillSandbox({ bpm, off: 2 });
    c.CFG.beatSpawnSixteenths = [4];
    const distance = c.beatSpawnDist(4);
    const speed = c.projSpeedNow(), gravity = c.CFG.projGravity;
    const flight = .25 * 60 / bpm;
    const horizontalSpeed = Math.sqrt(speed * speed - Math.pow(gravity * flight / 2, 2));
    assert.ok(Math.abs(distance / horizontalSpeed - flight) < 1e-12, "the solver distance matches the launched same-height arc at k/16 beats");
    assert.equal(c._beatSpawnK, 4);
    const win = c.CFG.grooveOpenSec[0] + (c.CFG.grooveOpenSec[1] - c.CFG.grooveOpenSec[0]) * c.diffT();
    const boundary = 8 + (win - flight) * 4 / (60 / bpm);
    const early = c.makeTank(), late = c.makeTank();
    c.setOff(boundary - 1e-6);
    c.fillSkipClosed(early, 4);
    assert.equal(early.hp, 3, "an arrival just before the opener closes is still offered");
    c.setOff(boundary + 1e-6);
    c.fillSkipClosed(late, 4);
    assert.equal(late.hp, 2, "an arrival just after that same judged edge skips the opener");
  }
});

test("spawn filtering advances the owed index without slicing the figure or changing its final note", () => {
  const c = tankFillSandbox({ off: 10 });
  const tg = c.makeTank(), figure = tg.fig;
  c.fillSkipClosed(tg, 4);
  assert.equal(tg.fig, figure, "the original figure identity is retained");
  assert.equal(tg.hpMax, 3);
  assert.equal(tg.hp, 2);
  assert.equal(c.fillCueNeed(tg), 1);
  c.targets.push(tg);
  c.setOff(12); c.handleTankHit(tg, {});
  assert.equal(tg.hp, 1);
  assert.equal(tg._chipT, .28, "the surviving middle gate takes the actual tankChip path");
  assert.equal(c.notes.at(-1)[0], c.fillNote(3, 1), "the walk plays the gate that landed, without replaying the skipped note");
  c.setOff(16); c.handleTankHit(tg, {});
  assert.equal(tg.hp, 0);
  assert.equal(c.notes.at(-2)[0], c.fillNote(3, 2));
  assert.deepEqual(c.events, [{ kind: "kill" }]);
});

test("full spawn uses the final capped k, preserves the random stream and presents the next real opening", () => {
  const early = spawnFillSandbox({ bpm: 60, off: 2 });
  const late = spawnFillSandbox({ bpm: 60, off: 7.9 });
  const a = early.spawn(), b = late.spawn();
  assert.deepEqual(late.draws, early.draws, "a dropped opener spends exactly the old spawn draws in the old order");
  assert.equal(late.draws.length, 9);
  assert.equal(a.hp, 3);
  assert.equal(b.hp, 2);
  assert.equal(b.bowK, 4, "the close redraw, not the initial farther spawn, owns the final k");
  assert.deepEqual(b.mesh.position, a.mesh.position, "the same final close position survives filtering");
  assert.equal(b.mesh.material, "tank-core");
  assert.equal(b.shell.material, "tank-shell");
  assert.equal(late._fillPend16, -1, "the election handoff is consumed once");
  assert.equal(late._fillSpent8, 32, "the swell remains spent; filtering never elects a replacement");
  late.setOff(12);
  assert.equal(late.fillGlowAmt(), 1);
  assert.equal(late.fillOpen(b), 1);
});

test("one surviving mercy gate stays amber and reaches the real projectile-to-tank dispatcher", () => {
  const c = spawnFillSandbox({ off: 2 });
  const solver = c.beatSpawnDist;
  c.beatSpawnDist = (maxK) => {
    const distance = solver(maxK);
    if (maxK) c.setOff(13); // The heard clock advanced after election and before the final spawn check.
    return distance;
  };
  const tg = c.spawn();
  assert.equal(tg.hp, 1);
  assert.equal(tg.hpMax, 3, "remaining HP is not the tank dispatch identity");
  assert.equal(tg.mesh.material, "tank-core");
  assert.equal(tg.shell.material, "tank-shell");
  assert.equal(tg.mesh.userData.shell.userData.through.material, "tank-through");
  assert.equal(c.fillCueNeed(tg), 2);
  const projectile = { pos: new FillVector(), vel: new FillVector(), life: 0, fireRow: 17 };
  Object.assign(c, {
    _prev: new FillVector(), windX: 0, windZ: 0, projectiles: [projectile],
    segDistSq: () => 0, retireProjectile: (index) => c.projectiles.splice(index, 1),
    orbOpen: () => { throw new Error("a surviving fill must never take the ordinary whole-beat branch"); },
  });
  c.setOff(16);
  assert.equal(c.fillGlowAmt(), 1);
  c.updateProjectiles(0);
  assert.equal(tg.hp, 0);
  assert.equal(tg.dead, true);
  assert.equal(c.projectiles.length, 0);
  assert.equal(c.notes.at(-2)[0], c.fillNote(3, 2));
  assert.deepEqual(c.events, [{ kind: "kill" }]);
});

test("zero reachable gates downgrade the full spawned orb to plain without another draw or election", () => {
  const c = spawnFillSandbox({ off: 2 });
  const solver = c.beatSpawnDist;
  c.beatSpawnDist = (maxK) => {
    const distance = solver(maxK);
    if (maxK) c.setOff(17);
    return distance;
  };
  const tg = c.spawn();
  assert.deepEqual([tg.hp, tg.hpMax, tg.fig, tg.fill16], [1, 1, null, -1]);
  assert.equal(tg.mesh.material, "plain-core");
  assert.equal(tg.shell.material, "plain-shell");
  assert.equal(tg.mesh.userData.shell.userData.through.material, "plain-through");
  assert.equal(tg.radius, c.targetRadius());
  assert.equal(tg.expireAt, tg.born + 60 / c.state.bpm * c.CFG.rhythmLifeBeats, "an abandoned fill does not inherit the mercy-end lifetime extension");
  assert.equal(tg.bowK, 4, "the retained close position still reports its actual final k");
  assert.equal(c.draws.length, 9);
  assert.equal(c._fillPend16, -1);
  assert.equal(c._fillSpent8, 32);
  assert.equal(c.fillGlowAmt(), -1);
});

test("an unknown flight cannot advertise a supposedly reachable fill opener", () => {
  for (const k of [0, -1, NaN, Infinity]) {
    const c = tankFillSandbox({ off: 2 }), tg = c.makeTank();
    c.fillSkipClosed(tg, k);
    assert.deepEqual([tg.hp, tg.hpMax, tg.fig, tg.fill16], [1, 1, null, -1]);
  }
  const c = spawnFillSandbox({ off: 2 });
  c.CFG.beatSpawn = false;
  const tg = c.spawn();
  assert.deepEqual([tg.hp, tg.hpMax, tg.fig, tg.fill16, tg.bowK], [1, 1, null, -1, 0]);
  assert.equal(tg.mesh.material, "plain-core");
});

test("fill and tide off keep the legacy spawn arm and never invoke fill filtering", () => {
  for (const disabled of ["fillOnly", "tide"]) {
    const c = spawnFillSandbox({ off: 7.9 });
    if (disabled === "fillOnly") c.CFG.tank.fillOnly = false;
    else c.CFG.tide.on = false;
    c.fillSkipClosed = () => { throw new Error("legacy spawn must not call the fill filter"); };
    const tg = c.spawn();
    assert.equal(tg.fill16, -1);
    assert.equal(tg.fig, null);
    assert.equal(tg.hp, 2, "the existing random legacy tank election remains available");
    assert.equal(tg.hpMax, 2);
    assert.equal(c.draws.length, 10, "legacy eligibility/HP rolls and the close draw are untouched");
    assert.equal(c.fillCueNeed(tg), -1);
    assert.equal(c.fillGlowAmt(), -1, "non-fill tanks continue to use the field's existing glow");
  }
});

test("cue and filter guards preserve no-fill, spent and vuln-disabled behavior", () => {
  for (const disabled of ["fillOnly", "tide", "grooveGroove", "grooveVuln", "fill16", "figure", "dead", "spent"]) {
    const c = tankFillSandbox({ off: 18 }), tg = c.makeTank();
    if (disabled === "fillOnly") c.CFG.tank.fillOnly = false;
    else if (disabled === "tide") c.CFG.tide.on = false;
    else if (disabled === "grooveGroove" || disabled === "grooveVuln") c.CFG[disabled] = false;
    else if (disabled === "fill16") tg.fill16 = -1;
    else if (disabled === "figure") tg.fig = null;
    else if (disabled === "dead") tg.dead = true;
    else tg.hp = 0;
    c.targets.push(tg);
    const before = JSON.stringify(tg);
    assert.equal(c.fillCueNeed(tg), -1, disabled);
    assert.equal(c.fillGlowAmt(), -1, disabled);
    // The filter runs only while creating a live offer; dead/spent targets are cue-only guards.
    if (disabled !== "dead" && disabled !== "spent") {
      c.fillSkipClosed(tg, 4);
      assert.equal(JSON.stringify(tg), before, `${disabled}: disabled filtering does not rewrite the target`);
    }
    if (disabled === "grooveGroove" || disabled === "grooveVuln") {
      assert.equal(c.fillOpen(tg), 0, "turning vulnerability off keeps the original one-hit-one-gate escape hatch");
      c.handleTankHit(tg, {});
      assert.equal(tg.hp, 2);
    }
  }
});
