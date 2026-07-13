"use strict";

/**
 * Behavioral tests for groove pocket language (SPEC_GROOVE_POCKET).
 * Extracts pure helpers + a minimal state machine from index.html and runs them in vm.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function loadPocketSandbox() {
  // Slice from pocketLive through pocketOnMainMiss (inclusive), then adapt lets → vars for ctx visibility
  const start = html.indexOf("function pocketLive()");
  const end = html.indexOf("function _wasdResolve");
  assert.ok(start > 0 && end > start, "pocket block markers present");
  let src = html.slice(start, end);
  // In-file `let` bindings would TDZ / redeclare against our prelude — promote to var
  src = src.replace(/\blet _pocketMissScan\b/g, "var _pocketMissScan");

  // Prepend state the helpers close over
  const prelude = `
    var CFG = {
      groovePocket: true, wasdRhythm: true, grooveGroove: true,
      pocketEstablishBeats: 12, pocketSampleBeats: 4, pocketHoldSets: 4, pocketHoldSetBeats: 4,
      pocketAccFloor: 0.70, pocketAccWindow: 12, pocketOffsetBeat: 0.25, pocketBinEdge: 0.125
    };
    var trainMode = false, MOBILE = false;
    var state = { running: true, t: 0, bpm: 140 };
    var _pocketPhase = 'establish', _pocketCount = 0, _activePocket = 'on';
    var _sampleVotes = { push: 0, on: 0, layback: 0 }, _pocketHits = [];
    var _pocketMissScan = null;
    var _resolved = new Set();
    var _baseMul = 1, _wasdCombo = 0;
    var toasts = [];
    function T(k, en) { return en; }
    function showGhostToast(m) { toasts.push(m); }
    var pocketHudEl = null, pocketPhaseEl = null, pocketHelpEl = null, pocketStaffEl = null, pocketCountEl = null;
    function pocketUpdateHud() {}
  `;

  src = prelude + src;
  const ctx = { Set, Math, console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  vm.runInContext("pocketUpdateHud = function(){};", ctx);
  return ctx;
}

test("pocketMajority: unique win + ties", () => {
  const ctx = loadPocketSandbox();
  // unique winner
  ctx._sampleVotes = { push: 4, on: 0, layback: 0 };
  assert.equal(ctx.pocketMajority(), "push");
  // push/layback tie, previous on not among tops → on
  ctx._sampleVotes = { push: 2, on: 0, layback: 2 };
  ctx._activePocket = "on";
  assert.equal(ctx.pocketMajority(), "on");
  // push/layback tie, previous push is among tops → push
  ctx._activePocket = "push";
  assert.equal(ctx.pocketMajority(), "push");
  // clear on majority
  ctx._sampleVotes = { push: 1, on: 2, layback: 1 };
  assert.equal(ctx.pocketMajority(), "on");
  // no votes
  ctx._sampleVotes = { push: 0, on: 0, layback: 0 };
  assert.equal(ctx.pocketMajority(), "on");
});

test("classifyPocket bins at ±⅛", () => {
  const ctx = loadPocketSandbox();
  assert.equal(ctx.classifyPocket(-0.2), "push");
  assert.equal(ctx.classifyPocket(0), "on");
  assert.equal(ctx.classifyPocket(0.2), "layback");
  assert.equal(ctx.classifyPocket(-0.1), "on");
});

test("claimWasdNote at nd=4 binds ±¼ to MAIN not adjacent 16th", () => {
  const ctx = loadPocketSandbox();
  ctx._pocketPhase = "sample";
  ctx._resolved.clear();
  const nd = 4, bps = 60 / 140, w = 0.16;
  // Main at beat 6 → ci = 24. Push ideal at 5.75
  const push = ctx.claimWasdNote(5.75, nd, bps, w);
  assert.ok(push, "push claim exists");
  assert.equal(push.main, true);
  assert.equal(push.ci, 24);
  assert.ok(Math.abs(push.offBeats - (-0.25)) < 1e-9);

  ctx._resolved.clear();
  const lay = ctx.claimWasdNote(6.25, nd, bps, w);
  assert.ok(lay);
  assert.equal(lay.main, true);
  assert.equal(lay.ci, 24);
  assert.ok(Math.abs(lay.offBeats - 0.25) < 1e-9);

  ctx._resolved.clear();
  // Without pocket, nearest subdiv to 5.75 at nd=4 is ci=23 (5.75*4=23)
  ctx.CFG.groovePocket = false;
  const legacy = ctx.claimWasdNote(5.75, nd, bps, w);
  assert.ok(legacy);
  assert.equal(legacy.ci, 23);
  assert.equal(legacy.main, false);
});

test("establish → sample after 12 mains; silent misses advance", () => {
  const ctx = loadPocketSandbox();
  ctx.resetPocketState();
  for (let i = 0; i < 12; i++) ctx.pocketOnMain(0, 1, 0.16);
  assert.equal(ctx._pocketPhase, "sample");
  assert.equal(ctx._pocketCount, 0);

  // 4 silent misses during listening → hold with on (no votes → majority on)
  for (let i = 0; i < 4; i++) ctx.pocketOnMainMiss();
  assert.equal(ctx._pocketPhase, "hold");
  assert.equal(ctx._activePocket, "on");
});

test("hold accuracy collapse resets once with single REFOCUS toast", () => {
  const ctx = loadPocketSandbox();
  ctx.resetPocketState();
  ctx.toasts.length = 0;
  ctx.pocketEnter("hold", { silent: true });
  ctx._activePocket = "push";
  // 12 off-pocket hits → below 70% after minHits
  for (let i = 0; i < 12; i++) ctx.pocketOnMain(0, 1, 0.16); // on while expected push
  assert.equal(ctx._pocketPhase, "establish");
  const refocus = ctx.toasts.filter((t) => String(t).includes("REFOCUS"));
  const onBeat = ctx.toasts.filter((t) => t === "ON THE BEAT");
  assert.equal(refocus.length, 1, "exactly one REFOCUS toast");
  assert.equal(onBeat.length, 0, "REFOCUS must not be overwritten by ON THE BEAT");
});

test("sample majority after push votes enters hold push", () => {
  const ctx = loadPocketSandbox();
  ctx.resetPocketState();
  ctx.pocketEnter("sample", { silent: true });
  for (let i = 0; i < 4; i++) ctx.pocketOnMain(-0.25, 1, 0.16);
  assert.equal(ctx._pocketPhase, "hold");
  assert.equal(ctx._activePocket, "push");
});

test("pocketSweepMisses marks unresolved mains and advances establish", () => {
  const ctx = loadPocketSandbox();
  ctx.resetPocketState();
  ctx._resolved.clear();
  const nd = 4;
  // First call arms at current frontier (no backlog storm)
  ctx.pocketSweepMisses(0.0, nd); // due = floor(0-0.37)=-1 → arm
  assert.equal(ctx._pocketCount, 0);
  // Advance heard time so mains 0,1,2 become due
  ctx.pocketSweepMisses(3.0, nd); // due = floor(3-0.37)=2
  assert.equal(ctx._pocketPhase, "establish");
  assert.equal(ctx._pocketCount, 3, "mains 0,1,2 counted as silent misses");
  assert.ok(ctx._resolved.has(0));
  assert.ok(ctx._resolved.has(nd));
  assert.ok(ctx._resolved.has(2 * nd));
});

test("index.html wires claimWasdNote + pocketSweepMisses", () => {
  assert.match(html, /function claimWasdNote\b/);
  assert.match(html, /function pocketSweepMisses\b/);
  assert.match(html, /claimWasdNote\(beats,\s*nd,\s*bps,\s*w\)/);
  assert.match(html, /pocketSweepMisses\(/);
  assert.match(html, /pocketEnter\('establish',\s*\{\s*toast:/);
});
