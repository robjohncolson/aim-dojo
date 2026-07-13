"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function closingDelimiter(source, openAt, open = "{", close = "}") {
  let depth = 0;
  let quote = "";
  let lineComment = false;
  let blockComment = false;
  for (let index = openAt; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`unclosed ${open} at ${openAt}`);
}

function extractFunction(name) {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(html);
  assert.ok(match, `${name} is present as a testable named function`);
  const openAt = html.indexOf("{", match.index + match[0].length);
  return html.slice(match.index, closingDelimiter(html, openAt) + 1);
}

function extractCfg() {
  const declaration = /\bconst\s+CFG\s*=\s*\{/.exec(html);
  assert.ok(declaration, "CFG object exists");
  const openAt = html.indexOf("{", declaration.index);
  const literal = html.slice(openAt, closingDelimiter(html, openAt) + 1);
  return vm.runInNewContext(`(${literal})`, {
    DEFAULT_SKY_SUPABASE_ANON_KEY: "test-anon-key",
    DEFAULT_SKY_SUPABASE_URL: "https://example.test",
    SIDEREAL_RUNTIME: {},
    localStorage: { getItem: () => null },
  });
}

const bufferCfg = Object.freeze({
  grooveGroove: true,
  groovePocket: true,
  pocketBinEdge: 0.125,
  pocketBufferLen: 16,
  pocketCircleCue: false,
  pocketExpectBeats: 4,
  pocketHysteresisBars: 2,
  pocketLead: 0.06,
  pocketLeadHard: 0.12,
  pocketMinSamples: 8,
  pocketOffsetBeat: 0.25,
  pocketStaffMode: "off",
  pocketWeakFloor: 0.35,
  wasdRhythm: true,
});

function loadPocketSandbox(overrides = {}) {
  const start = html.indexOf("function pocketLive()");
  const end = html.indexOf("function _wasdResolve");
  assert.ok(start > 0 && end > start, "pocket helper block markers are present");
  let source = html.slice(start, end);
  source = source.replace(/\blet (_pocket[A-Za-z0-9_]*)/g, "var $1");

  const prelude = `
    var CFG = ${JSON.stringify({ ...bufferCfg, ...overrides })};
    var trainMode = false, MOBILE = false;
    var state = { running: true, t: 0, bpm: 120 };
    var _pocketBuffer = [], _expectedPocket = 'on', _pocketBarCount = 0;
    var _pocketCandidate = null, _pocketCandidateStreak = 0, _pocketMissScan = null;
    var _resolved = new Set(), _resolvedNd = null, _pocketResolvedMains = new Set(), _baseMul = 1, _wasdCombo = 0;
    var _curCi = -1, _curMain = true, _spoilNote = -1, _hitNote = -1;
    var toasts = [];
    function T(_key, fallback) { return fallback; }
    function showGhostToast(message) { toasts.push(message); }
  `;
  const context = vm.createContext({ Math, Number, Set, console });
  vm.runInContext(prelude + source, context);
  context.read = (expression) => vm.runInContext(expression, context);
  context.write = (statement) => vm.runInContext(statement, context);
  return context;
}

function appendScores(context, count, { on, push, layback }) {
  for (let index = 0; index < count; index += 1) {
    context.pocketAppendSample({
      accOn: on,
      accPush: push,
      accLay: layback,
      best: push > on && push > layback ? "push" : layback > on && layback > push ? "layback" : "on",
      expectedAtHit: context.read("_expectedPocket"),
      offBeats: 0,
    });
  }
}

function floorFrame(expected, beats, pocketEnabled = true) {
  const amount = { value: 0 };
  const seen = { color: null };
  const floorColor = {
    hex: null,
    setHex(value) { this.hex = value; },
  };
  const context = vm.createContext({
    CFG: {
      beatQuant: true,
      beatQuantDivs: [2, 4, 8],
      beatQuantT: [0.4, 0.75],
      floorBeat: true,
      floorBeatDayMul: 2.2,
      floorBeatMax: 0.45,
      pocketOffsetBeat: 0.25,
      wasdRhythm: true,
    },
    MOBILE: false,
    templeActive: false,
    Tone: { Transport: { state: "started" } },
    WASD_HEX: [0x102030, 0x405060, 0x708090, 0xa0b0c0],
    _combo: [0, 1, 2, 3],
    _expectedPocket: expected,
    _floorBeatCol: floorColor,
    dayAmt: 0,
    dayFloor: null,
    diffT: () => 0,
    nightGrid: {
      material: {
        userData: {
          shBeat: {
            uniforms: {
              uBeatAmt: amount,
              uBeatCol: { value: { copy(color) { seen.color = color.hex; } } },
            },
          },
        },
      },
    },
    pocketExpected: () => expected,
    pocketIdeal: (id) => (id === "push" ? -0.25 : id === "layback" ? 0.25 : 0),
    pocketLive: () => pocketEnabled,
    reduceMotion: false,
    state: { bpm: 120, running: true },
    toneReady: true,
    trainMode: false,
    wasdBeats: () => beats,
    wasdBeatsHeard: () => beats,
  });
  vm.runInContext(`${extractFunction("updateFloorBeat")}; updateFloorBeat();`, context);
  return { amount: amount.value, color: seen.color };
}

test("rolling-pocket CFG: feature shelved by default; buffer knobs remain (B1, B6)", () => {
  const cfg = extractCfg();
  // Product default: OFF (zen free-play). Logic is covered with groovePocket forced true in sandbox tests.
  assert.equal(cfg.groovePocket, false, "groovePocket shelved by default");
  assert.equal(cfg.pocketLawHud, false, "LAW HUD off while shelved");
  for (const [key, expected] of Object.entries(bufferCfg)) {
    if (key === "groovePocket") continue;
    assert.equal(cfg[key], expected, `CFG.${key}`);
  }
  assert.equal(cfg.grooveFireEarlyBeat, 0);
});

test("three-clock accuracy and best intent are continuous and correctly ordered (B2)", () => {
  const context = loadPocketSandbox();
  const on = context.pocketIntentSample(0, 1, 0.3);
  const push = context.pocketIntentSample(-0.25, 1, 0.3);
  const layback = context.pocketIntentSample(0.25, 1, 0.3);

  assert.equal(on.accOn, 1);
  assert.ok(on.accOn > on.accPush && on.accOn > on.accLay);
  assert.equal(on.best, "on");
  assert.equal(push.accPush, 1);
  assert.ok(push.accPush > push.accOn && push.accOn > push.accLay);
  assert.equal(push.best, "push");
  assert.equal(layback.accLay, 1);
  assert.ok(layback.accLay > layback.accOn && layback.accOn > layback.accPush);
  assert.equal(layback.best, "layback");
  assert.equal(context.pocketIntentSample(0.5, 1, 0.16).best, null, "weak three-clock evidence casts no vote");
});

test("intent buffer caps at 16 and main misses append an all-zero event (B2)", () => {
  const context = loadPocketSandbox();
  context.resetPocketState();
  for (let index = 0; index < 20; index += 1) {
    context.pocketAppendSample({ accOn: 1, accPush: 0, accLay: 0, best: "on", offBeats: index, expectedAtHit: "on" });
  }
  let buffer = context.read("_pocketBuffer");
  assert.equal(buffer.length, 16);
  assert.equal(buffer[0].offBeats, 4);
  assert.equal(buffer[15].offBeats, 19);

  context.resetPocketState();
  context.pocketOnMainMiss();
  buffer = context.read("_pocketBuffer");
  assert.equal(buffer.length, 1);
  assert.deepEqual(
    { on: buffer[0].accOn, push: buffer[0].accPush, lay: buffer[0].accLay, best: buffer[0].best },
    { on: 0, push: 0, lay: 0, best: null },
  );
  assert.equal(context.read("_pocketBarCount"), 1);
});

test("intent winner uses means and deterministic on/previous tie ordering (B3)", () => {
  const context = loadPocketSandbox();
  appendScores(context, 8, { on: 0.2, push: 0.9, layback: 0.1 });
  let intent = context.pocketIntent();
  assert.equal(intent.winner, "push");
  assert.ok(intent.means.push > intent.means.on && intent.means.on > intent.means.layback);

  context.resetPocketState();
  context.write("_expectedPocket='layback'");
  appendScores(context, 8, { on: 0.1, push: 0.8, layback: 0.8 });
  intent = context.pocketIntent();
  assert.equal(intent.winner, "layback", "previous expected wins a non-on tie when it is among the tops");

  context.resetPocketState();
  appendScores(context, 8, { on: 0.8, push: 0.8, layback: 0.1 });
  assert.equal(context.pocketIntent().winner, "on", "on wins every tie that includes on");
});

test("minimum samples, lead, hard lead, hysteresis, and four-main bar gates control commits (B3)", () => {
  const hard = loadPocketSandbox();
  hard.resetPocketState();
  for (let index = 0; index < 7; index += 1) hard.pocketOnMain(-0.25, 1, 0.3);
  assert.equal(hard.read("_expectedPocket"), "on", "no cold-start switch before eight samples");
  const boundary = hard.pocketOnMain(-0.25, 1, 0.3);
  assert.equal(boundary.gradeOffSec, -0.25, "boundary hit is graded against expected-at-hit");
  assert.equal(boundary.sample.expectedAtHit, "on", "the boundary sample freezes the old law for audit/debug use");
  assert.equal(hard.read("_expectedPocket"), "push", "hard lead promotes at the first eligible boundary");
  assert.equal(hard.pocketOnMain(-0.25, 1, 0.3).gradeOffSec, 0, "the next hit receives the newly committed law");

  const soft = loadPocketSandbox();
  for (let index = 0; index < 8; index += 1) soft.pocketOnMain(-0.14, 1, 0.3);
  assert.equal(soft.read("_expectedPocket"), "on");
  assert.equal(soft.read("_pocketCandidate"), "push");
  assert.equal(soft.read("_pocketCandidateStreak"), 1);
  for (let index = 0; index < 3; index += 1) soft.pocketOnMain(-0.14, 1, 0.3);
  assert.equal(soft.read("_expectedPocket"), "on", "expectation is stable between bar boundaries");
  soft.pocketOnMain(-0.14, 1, 0.3);
  assert.equal(soft.read("_expectedPocket"), "push", "soft lead commits after two consecutive boundary wins");

  const resetCandidate = loadPocketSandbox();
  for (let index = 0; index < 8; index += 1) resetCandidate.pocketOnMain(-0.14, 1, 0.3);
  assert.equal(resetCandidate.read("_pocketCandidateStreak"), 1);
  for (let index = 0; index < 4; index += 1) resetCandidate.pocketOnMain(0, 1, 0.3);
  assert.equal(resetCandidate.read("_expectedPocket"), "on");
  assert.equal(resetCandidate.read("_pocketCandidate"), null, "current-law win clears a stale challenger");
  assert.equal(resetCandidate.read("_pocketCandidateStreak"), 0);

  const weakLead = loadPocketSandbox();
  for (let index = 0; index < 16; index += 1) weakLead.pocketOnMain(-0.13, 1, 0.3);
  assert.equal(weakLead.read("_expectedPocket"), "on", "a sub-lead winner never commits");
});

test("resolved mains freeze against expected-at-hit; bonus lanes do not feed intent (B4)", () => {
  const context = loadPocketSandbox();
  context.resetPocketState();
  assert.equal(context.pocketOnMain(-0.25, 0.8, 0.3).gradeOffSec, -0.2);
  context.write("_expectedPocket='push'");
  assert.equal(context.pocketOnMain(-0.25, 0.8, 0.3).gradeOffSec, 0);
  context.write("_expectedPocket='layback'");
  assert.equal(context.pocketOnMain(0.25, 0.8, 0.3).gradeOffSec, 0);

  const lanePress = extractFunction("wasdLanePress");
  const callAt = lanePress.indexOf("pocketOnMain(");
  assert.notEqual(callAt, -1);
  const guardAt = lanePress.lastIndexOf("if(main", callAt);
  assert.notEqual(guardAt, -1, "only the main-note branch can call pocketOnMain");
});

test("all three ideals still claim mains at nd=4 and silent sweep feeds buffer misses (B7)", () => {
  const context = loadPocketSandbox();
  assert.deepEqual(Array.from(context.pocketClaimIdeals()), [-0.25, 0, 0.25]);
  const bps = 60 / 140;
  for (const [beats, expectedOffset] of [[5.75, -0.25], [6, 0], [6.25, 0.25]]) {
    context.write("_resolved.clear()");
    const claim = context.claimWasdNote(beats, 4, bps, 0.16);
    assert.equal(claim.main, true);
    assert.equal(claim.ci, 24);
    assert.ok(Math.abs(claim.offBeats - expectedOffset) < 1e-9);
  }

  context.write("_resolved.clear(); _pocketResolvedMains.clear()");
  const halfBeatBonus = context.claimWasdNote(10.5, 2, 0.5, 0.125);
  assert.equal(halfBeatBonus.main, false, "an exact nd=2 bonus stays on the unchanged bonus path");
  assert.equal(halfBeatBonus.ci, 21);
  context.write("_resolved.clear(); _pocketResolvedMains.clear()");
  const quarterTie = context.claimWasdNote(10.25, 4, 0.5, 0.0625);
  assert.equal(quarterTie.main, true, "the nd=4 quarter-beat tie binds to the pocket main");
  assert.equal(quarterTie.mainBeat, 10);

  context.resetPocketState();
  context.write("_resolved.clear()");
  context.pocketSweepMisses(0, 4, bps, 0.16);
  context.pocketSweepMisses(3, 4, bps, 0.16);
  const misses = context.read("_pocketBuffer");
  assert.equal(misses.length, 3);
  assert.ok(misses.every((entry) => entry.accOn === 0 && entry.accPush === 0 && entry.accLay === 0));
});

test("overlapping low-density main windows resolve in chronological order (B3, B7)", () => {
  const context = loadPocketSandbox();
  context.pocketSweepMisses(4, 1, 0.5, 0.2); // activate before either overlapping main
  context.write("_pocketBarCount=3");

  const older = context.claimWasdNote(5.55, 1, 0.5, 0.2);
  assert.equal(older.mainBeat, 5, "late main 5 wins over the closer early ideal for future main 6");
  context.write(`_resolved.add(${older.ci}); _pocketResolvedMains.add(${older.mainBeat})`);
  context.pocketOnMain(older.offBeats, 0.5, 0.2);
  assert.equal(context.read("_pocketBarCount"), 4, "the chronological older event owns the boundary");

  const newer = context.claimWasdNote(5.55, 1, 0.5, 0.2);
  assert.equal(newer.mainBeat, 6, "the future main becomes claimable after the older one resolves");
});

test("silent sweep waits until strictly after the final layback claim instant (B7)", () => {
  const context = loadPocketSandbox();
  const bps = 1;
  const win = 0.16;
  const finalLaybackInstant = bufferCfg.pocketOffsetBeat + win / bps;

  context.pocketSweepMisses(0, 4, bps, win);
  context.pocketSweepMisses(finalLaybackInstant, 4, bps, win);
  assert.equal(context.read("_pocketBuffer.length"), 0, "deadline equality remains claimable");

  context.pocketSweepMisses(finalLaybackInstant + 1e-9, 4, bps, win);
  assert.equal(context.read("_pocketBuffer.length"), 1, "the same main becomes a miss immediately after its deadline");
});

test("activating pocket tracking skips pre-activation and in-flight historical mains", () => {
  const freshRun = loadPocketSandbox();
  freshRun.pocketSweepMisses(-0.5, 1, 0.5, 0.2);
  assert.equal(freshRun.read("_pocketMissScan"), -1, "the pre-transport negative main is behind the activation frontier");
  freshRun.pocketSweepMisses(-0.34, 1, 0.5, 0.2);
  assert.equal(freshRun.read("_pocketBuffer.length"), 0, "the uncued negative main never becomes a cold-start miss");
  freshRun.pocketSweepMisses(0.66, 1, 0.5, 0.2);
  assert.equal(freshRun.read("_pocketBuffer.length"), 1, "the first post-activation main still becomes a miss");

  const graduation = loadPocketSandbox();
  graduation.pocketSweepMisses(100.2, 1, 1, 0.16);
  assert.equal(graduation.read("_pocketMissScan"), 100);
  graduation.pocketSweepMisses(100.42, 1, 1, 0.16);
  assert.equal(graduation.read("_pocketBuffer.length"), 0, "an in-flight trainer-era main is not imported into the new buffer");
  assert.equal(graduation.claimWasdNote(100.3, 1, 1, 0.16), null, "the skipped trainer-era main cannot be claimed after activation");
});

test("stable whole-main ids prevent an nd change from turning a resolved main into a miss (B7)", () => {
  const context = loadPocketSandbox();
  const bps = 1;
  const win = 0.16;
  const late = bufferCfg.pocketOffsetBeat + win / bps;

  context.pocketSweepMisses(late + 1e-9, 4, bps, win); // arm after main 0
  const claim = context.claimWasdNote(1, 4, bps, win);
  assert.equal(claim.ci, 4);
  assert.equal(claim.mainBeat, 1);
  context.write(`_resolved.add(${claim.ci}); _pocketResolvedMains.add(${claim.mainBeat})`);
  assert.equal(context.read("_resolved.has(8)"), false, "the subdivision id changes when nd changes");
  assert.equal(context.claimWasdNote(1, 8, bps, win), null, "the same main cannot be claimed twice after the nd change");

  context.pocketSweepMisses(1 + late + 1e-9, 8, bps, win);
  assert.equal(context.read("_pocketBuffer.length"), 0, "the stable main id suppresses the false miss");

  context.pocketSweepMisses(2 + late + 1e-9, 8, bps, win);
  assert.equal(context.read("_pocketBuffer.length"), 1, "the next genuinely unresolved main still misses once");

  const collision = loadPocketSandbox();
  const oldMain = collision.claimWasdNote(1, 4, bps, win);
  collision.write(`_resolved.add(${oldMain.ci}); _pocketResolvedMains.add(${oldMain.mainBeat})`);
  const distinctMain = collision.claimWasdNote(2, 2, bps, win);
  assert.equal(distinctMain.mainBeat, 2, "an old ci collision cannot hide a distinct main after nd falls");
  assert.equal(distinctMain.ci, oldMain.ci, "the regression exercises the same subdivision id for two whole mains");

  const vanishedBonus = loadPocketSandbox();
  vanishedBonus.write("_resolvedNd=4; _resolved.add(3); _curCi=3; _hitNote=3");
  const laterBonus = vanishedBonus.claimWasdNote(1.5, 2, 1, 0.2);
  assert.equal(laterBonus.main, false);
  assert.equal(laterBonus.ci, 3, "a vanished old-grid bonus id cannot block a different future bonus");
  assert.equal(vanishedBonus.read("_hitNote"), -1, "visual resolution markers drop with vanished grid points");

  const commonBonus = loadPocketSandbox();
  commonBonus.write("_resolvedNd=4; _resolved.add(2)");
  assert.equal(commonBonus.claimWasdNote(0.5, 2, 1, 0.2), null, "a bonus position common to both grids remains resolved");
});

test("lane presses sweep older silent mains before claiming the boundary tap (B7)", () => {
  const lanePress = extractFunction("wasdLanePress");
  const sweepAt = lanePress.indexOf("pocketSweepMisses(");
  const claimAt = lanePress.indexOf("claimWasdNote(");
  assert.notEqual(sweepAt, -1);
  assert.notEqual(claimAt, -1);
  assert.ok(sweepAt < claimAt, "a boundary tap cannot overtake an overdue prior-main miss");
});

test("reset and every pocket kill-switch leave center-only behavior with no buffer writes (B8, B9)", () => {
  const context = loadPocketSandbox();
  for (let index = 0; index < 8; index += 1) context.pocketOnMain(-0.25, 1, 0.3);
  context.resetPocketState();
  assert.equal(context.read("_expectedPocket"), "on");
  assert.equal(context.read("_pocketBuffer.length"), 0);
  assert.equal(context.read("_pocketBarCount"), 0);
  assert.equal(context.read("_pocketCandidate"), null);
  assert.equal(context.read("_pocketCandidateStreak"), 0);
  assert.equal(context.read("_pocketResolvedMains.size"), 0);

  context.pocketAppendSample({ accOn: 0, accPush: 1, accLay: 0, best: "push", offBeats: -0.25, expectedAtHit: "push" });
  context.write("_expectedPocket='push'; _pocketMissScan=9; _pocketResolvedMains.add(9)");
  context.rebasePocketMissTracking();
  assert.equal(context.read("_pocketMissScan"), null);
  assert.equal(context.read("_pocketResolvedMains.size"), 1, "recent resolved-main identity survives a heard-timeline rebase");
  assert.equal(context.read("_pocketBuffer.length"), 1, "a heard-timeline rebase preserves learned intent");
  assert.equal(context.read("_expectedPocket"), "push");
  assert.equal(context.claimWasdNote(9, 1, 1, 0.16), null, "the in-flight resolved main cannot be appended twice after resume");

  for (const statement of ["CFG.groovePocket=false", "trainMode=true", "MOBILE=true"]) {
    context.resetPocketState();
    context.write("CFG.groovePocket=true; trainMode=false; MOBILE=false; " + statement);
    assert.equal(context.pocketLive(), false);
    const result = context.pocketOnMain(-0.25, 1, 0.3);
    assert.equal(result.gradeOffSec, -0.25);
    assert.equal(context.read("_pocketBuffer.length"), 0);
  }
});

test("toast fires once per expected-pocket change, never once per bar", () => {
  const context = loadPocketSandbox();
  for (let index = 0; index < 12; index += 1) context.pocketOnMain(-0.25, 1, 0.3);
  assert.equal(context.toasts.length, 1);
  assert.match(String(context.toasts[0]), /LEAN EARLY/i);
});

test("LAW HUD markup remains for optional re-enable; phase-era staff/coach is gone", () => {
  assert.match(html, /\bid=["']pocketLaw["']/);
  assert.match(html, /\bfunction\s+pocketUpdateLawHud\s*\(/);
  assert.match(html, /pocketLawHud\s*:\s*false/);
  assert.doesNotMatch(html, /\bid=["']pocket(?:Hud|Phase|Help|Staff|Count)["']/);
  assert.doesNotMatch(html, /\bfunction\s+pocketUpdateHud\s*\(/);
  assert.doesNotMatch(extractFunction("enterRunning"), /_pocketPhase|pocketToastPhase/);
  assert.doesNotMatch(extractFunction("setTrainPhase"), /_pocketPhase|pocketToastPhase/);
});

test("retired establish/sample/hold config, state, and helpers are absent (B1, B6)", () => {
  const retired = [
    "pocketEstablishBeats", "pocketSampleBeats", "pocketHoldSets", "pocketHoldSetBeats",
    "pocketAccFloor", "pocketAccWindow", "pocketGhostAlpha",
    "_pocketPhase", "_pocketCount", "_activePocket", "_sampleVotes", "_pocketHits",
    "pocketBindEls", "pocketCueId", "pocketAcc", "pocketPushHit", "pocketLabel", "pocketMajority",
    "pocketBarTotal", "pocketBarNow", "pocketBeatInBar", "pocketBarHtml", "pocketStaffLayoutMode",
    "pocketStaffHtml", "pocketUpdateHud", "pocketToastPhase", "pocketEnter", "pocketHoldLen",
    "pocketMaybeResetHold",
  ];
  for (const name of retired) {
    assert.doesNotMatch(html, new RegExp(`\\b${name}\\b`), `${name} was retired with the phase machine`);
  }
});

test("floor peak follows expected phase while hue always follows the main letter (B5)", () => {
  const on = floorFrame("on", 1);
  const push = floorFrame("push", 0.75);
  const layback = floorFrame("layback", 1.25);
  assert.ok(on.amount > 0.4 && push.amount > 0.4 && layback.amount > 0.4);
  assert.equal(on.color, 0x405060);
  assert.equal(push.color, on.color);
  assert.equal(layback.color, on.color);
  assert.ok(floorFrame("push", 0.75).amount > floorFrame("push", 1).amount, "push peaks early");
  assert.ok(floorFrame("layback", 1.25).amount > floorFrame("layback", 1).amount, "layback peaks late");

  assert.ok(floorFrame("push", 1, false).amount > floorFrame("push", 0.75, false).amount, "kill-switch restores unshifted center phase");
  assert.doesNotMatch(extractFunction("updateFloorBeat"), /pocketColorCss|pocketColPush|pocketColOn|pocketColLay/);
});

test("combat open-window remains on the audible one and isolated from pocket state (B10)", () => {
  assert.equal(extractCfg().grooveFireEarlyBeat, 0);
  const animate = extractFunction("animate");
  const gateAt = animate.indexOf("if(CFG.grooveGroove && CFG.grooveVuln)");
  assert.notEqual(gateAt, -1);
  const blockAt = animate.indexOf("{", gateAt);
  const openWindow = animate.slice(blockAt, closingDelimiter(animate, blockAt) + 1);
  assert.match(openWindow, /CFG\.grooveFireEarlyBeat/);
  assert.match(openWindow, /_openAmt\s*=/);
  assert.doesNotMatch(openWindow, /pocket(?:Live|Ideal|Expected|Intent|Buffer|Offset)|_expectedPocket|_pocket/i);
});

test("silent-miss sweep is fed outside the target-presence branch and pauses for flick bonus", () => {
  const animate = extractFunction("animate");
  const sweepAt = animate.indexOf("updatePocketMisses()");
  const targetsAt = animate.indexOf("if(targets.length)");
  assert.notEqual(sweepAt, -1, "running loop feeds silent pocket misses");
  assert.notEqual(targetsAt, -1);
  assert.ok(sweepAt < targetsAt, "silence advances intent even while no Echo exists");

  const update = extractFunction("updatePocketMisses");
  assert.match(update, /bonusActive/);
  assert.ok(update.indexOf("bonusActive") < update.indexOf("pocketSweepMisses("));
  const arm = extractFunction("maybeArmFlickBonus");
  assert.ok(arm.indexOf("updatePocketMisses()") < arm.indexOf("bonusActive=true"), "bonus entry closes the normal frontier first");
  const end = extractFunction("endFlickBonus");
  assert.ok(end.indexOf("updatePocketMisses()") < end.indexOf("bonusActive=false"), "every bonus exit advances the frozen frontier first");
  const abort = extractFunction("abortFlickBonus");
  assert.ok(abort.indexOf("updatePocketMisses()") < abort.indexOf("bonusActive=false"), "pausing a bonus freezes its last crossed main before exit");

  const context = loadPocketSandbox();
  context.pocketSweepMisses(5.6, 4, 1, 0.25); // arm at main 5
  context.pocketSkipMisses(9.6, 1, 0.25); // bonus spans mains 6–9
  context.pocketSweepMisses(10.6, 4, 1, 0.25);
  assert.equal(context.read("_pocketBuffer.length"), 1, "bonus-time mains are not back-filled after the pause");
  assert.equal(context.read("_pocketMissScan"), 10);

  const inFlight = loadPocketSandbox();
  inFlight.pocketSweepMisses(5.6, 1, 1, 0.25);
  inFlight.pocketSkipMisses(6.3, 1, 0.25);
  assert.equal(inFlight.read("_pocketMissScan"), 6, "a center crossed during bonus is skipped before its layback deadline");
  assert.equal(inFlight.claimWasdNote(6.3, 1, 1, 0.25), null, "the bonus-owned main cannot leak into normal input after exit");
  inFlight.pocketSweepMisses(6.6, 1, 1, 0.25);
  assert.equal(inFlight.read("_pocketBuffer.length"), 0, "the bonus-owned main is not later back-filled as a miss");
});
