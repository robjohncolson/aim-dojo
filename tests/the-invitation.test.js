"use strict";

// THE INVITATION, wave 19 (SPEC_THE_INVITATION parcels A, B, M): the silent calibration, the link on the card, and the
// lesson leaving no record. Every parcel has a flat knob whose off arm is pinned here.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function extract(re, what) {
  const m = html.match(re);
  assert.ok(m, what + " is extractable");
  return m[0];
}

// ---------------------------------------------------------------- Parcel A
const CALIB_CONSTS = extract(/const CALIB_MIN_SEC=[^\n]*\n/, "the calibration constants line");
const CALIB_APPLY = extract(/function calibApply\(avg\)\{[\s\S]*?\n\}/, "calibApply");
const CALIB_SILENT = extract(/function calibSilent\(\)\{[\s\S]*?\n\}/, "calibSilent");

function calibWorld({ stored = null, offset = 0, sum = 0, n = 0, knob = 1, train = false, done = false } = {}) {
  const store = new Map(); if (stored !== null) store.set("aimdojo.offsetMs", String(stored));
  const ctx = vm.createContext({
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    Math, isFinite, cloud: [], rebased: 0, store,
  });
  const prelude = `const CFG={calibSilent:${knob}}; let _calibSilentDone=false, _userOffsetSec=${offset}, _tapOffSum=${sum}, _tapOffN=${n}, trainMode=${train};
function rebasePocketMissTracking(){ rebased++; } function queueCloudPrefs(o){ cloud.push(o); }`;
  new vm.Script(prelude + "\n" + CALIB_CONSTS + CALIB_APPLY + "\n" + CALIB_SILENT + (done ? "\n_calibSilentDone=true;" : "") +
    "\nthis.fired=calibSilent(); this.offset=_userOffsetSec; this.sum=_tapOffSum; this.n=_tapOffN; this.done=_calibSilentDone;").runInContext(ctx);
  return ctx;
}

test("the silent calibration folds a trusted mean into the offset once, wordlessly, and stores what the button would store", () => {
  const w = calibWorld({ sum: 12 * 0.040, n: 12 });
  assert.equal(w.fired, true);
  assert.equal(Math.round(w.offset * 1000), 40);
  assert.equal(w.store.get("aimdojo.offsetMs"), "40", "stored as rounded ms, exactly as the button stores it");
  assert.deepEqual(JSON.parse(JSON.stringify(w.cloud)), [{ offset_ms: 40 }], "one cloud sync");
  assert.equal(w.rebased, 1, "pocket miss tracking rebased once");
  assert.deepEqual([w.sum, w.n], [0, 0], "the accumulator is spent");
  assert.equal(w.done, true);
});

test("the silent calibration never overrides a stored or cloud-applied offset, and needs a sample worth trusting", () => {
  const stored = calibWorld({ stored: 25, offset: 0.025, sum: 12 * 0.04, n: 12 });
  assert.equal(stored.fired, false); assert.deepEqual([stored.sum, stored.n], [12 * 0.04, 12], "accumulator untouched");
  const cloudOnly = calibWorld({ offset: 0.03, sum: 12 * 0.04, n: 12 });
  assert.equal(cloudOnly.fired, false, "a live nonzero offset with no key (cloud-applied this session) is respected");
  const few = calibWorld({ sum: 11 * 0.04, n: 11 });
  assert.equal(few.fired, false, "eleven taps are not twelve");
  const tiny = calibWorld({ sum: 12 * 0.008, n: 12 });
  assert.equal(tiny.fired, false, "an 8 ms mean is inside the noise floor");
  assert.deepEqual([tiny.sum, tiny.n], [12 * 0.008, 12], "and the accumulator is LEFT INTACT so the button still works");
  const huge = calibWorld({ sum: 12 * 0.9, n: 12 });
  assert.equal(Math.round(huge.offset * 1000), 320, "clamped to the button's ceiling");
  const again = calibWorld({ sum: 12 * 0.04, n: 12, done: true });
  assert.equal(again.fired, false, "once per page life");
  const off = calibWorld({ sum: 12 * 0.04, n: 12, knob: 0 });
  assert.equal(off.fired, false); assert.equal(off.store.size, 0, "calibSilent:0 writes nothing");
  const lesson = calibWorld({ sum: 12 * 0.04, n: 12, train: true });
  assert.equal(lesson.fired, false, "never during the lesson");
});

test("the silent calibration has exactly two call sites, both behind the knob, and the button rides the shared authority", () => {
  const sites = html.match(/calibSilent\(\);/g) || [];
  assert.equal(sites.length, 2, "graduation + showPause");
  assert.match(html, /_gradSnap=\{t:state\.t,hits:state\.hits\};[^\n]*\n\s*if\(CFG\.calibSilent\) calibSilent\(\);/, "the graduation site sits after the snapshot, behind the knob");
  assert.match(html, /function showPause\(\)\{\n  if\(!state\.started\) return;\n  if\(CFG\.calibSilent && !trainMode\) calibSilent\(\);/, "the pause site is the first thing after the started gate");
  const button = extract(/if\(calibBtn\) calibBtn\.addEventListener\('click', \(\)=>\{[\s\S]*?\n\}\);/, "the button handler");
  assert.match(button, /ms=calibApply\(avg\)/, "the button folds through calibApply");
  assert.ok(!/localStorage\.setItem/.test(button), "the button no longer stores on its own");
});

// ---------------------------------------------------------------- Parcel M
const DOJO_SESSION = extract(/function dojoSession\(\)\{ return \{[\s\S]*?\n\}; \}/, "dojoSession");

test("the records count runtime and voices from graduation, never from the lesson", () => {
  const ctx = vm.createContext({ Math });
  new vm.Script(`let _gradSnap={t:61.4,hits:3}; const state={t:181.4,maxBpm:34,maxHitDist:12.345,maxHitHeight:4,hits:12,bestStreak:5};\n` + DOJO_SESSION + "\nthis.s=dojoSession();").runInContext(ctx);
  assert.equal(ctx.s.dur, 120, "the lesson's 61 s are not the night's");
  assert.equal(ctx.s.kills, 9, "the lesson's 3 voices are not the night's");
  assert.equal(ctx.s.bpm, 34, "bpm stays whole-run");
  const fresh = vm.createContext({ Math });
  new vm.Script(`let _gradSnap={t:0,hits:0}; const state={t:90,maxBpm:20,maxHitDist:0,maxHitHeight:0,hits:4,bestStreak:1};\n` + DOJO_SESSION + "\nthis.s=dojoSession();").runInContext(fresh);
  assert.deepEqual([fresh.s.dur, fresh.s.kills], [90, 4], "a run with no graduation subtracts nothing");
});

test("the trainer publishes nothing: submitDojo is gated, the snapshot is taken at graduation and zeroed at reset", () => {
  assert.match(html, /async function submitDojo\(\)\{\n  if\(trainMode \|\| state\.hits-_gradSnap\.hits<1\) return;/, "the gate is the first statement");
  assert.match(html, /resetPocketState\(\);[^\n]*\n\s*_gradSnap=\{t:state\.t,hits:state\.hits\};/, "the snapshot follows resetPocketState in the graduation branch");
  assert.match(html, /\n  _gradSnap=\{t:0,hits:0\};[^\n]*\n  _dojoBest=loadDojoBests\(\);/, "resetSession zeroes it right before refreshing the bests");
  const graduation = html.slice(html.indexOf("// graduate → full dojo mid-run"), html.indexOf("// graduate → full dojo mid-run") + 2200);
  assert.ok(!/state\.t=0|state\.hits=0/.test(graduation), "graduation never resets state.t or state.hits themselves (the road and the spawn scheduler read them)");
});

// ---------------------------------------------------------------- Parcel B
const CARD_COMPOSE = extract(/function cardCompose\(g,W,H,rec\)\{[\s\S]*?\n\}/, "cardCompose");
const CARD_LINK = extract(/function cardLinkText\(\)\{[\s\S]*?\n\}/, "cardLinkText");
const SHARE_LINK = extract(/function shareLinkUrl\(\)\{[^\n]*\n/, "shareLinkUrl");

function paintCard({ link, protocol = "https:", origin = "https://aim-dojo.vercel.app", pathname = "/" }) {
  const calls = [];
  const g = new Proxy({}, { get: (_t, k) => (k === "createLinearGradient" ? () => ({ addColorStop() {} }) : (...a) => { calls.push([k, ...a.map((x) => (typeof x === "number" ? Math.round(x) : x))]); }), set: () => true });
  const ctx = vm.createContext({
    Math, g, calls, location: { protocol, origin, pathname, href: origin + pathname },
    CFG: { nightCard: { on: true, maxDots: 60, w: 720, h: 1080, link } }, CARD_FONT: "F", DEAL_RULE_EN: ["RULE"], state: { bpm: 30 },
    T: (k, d) => d, phasesDrawDisc() { calls.push(["disc"]); }, cardBand() { calls.push(["band"]); }, bowGlyphPaint() { calls.push(["glyph"]); }, cardDateText: () => "23 Aug 2026",
  });
  new vm.Script(SHARE_LINK + CARD_COMPOSE + "\n" + CARD_LINK + "\ncardCompose(g,720,1080,{phase:1,rule:0,hits:[],hb:1000,d:'2026-08-23'});").runInContext(ctx);
  return calls.filter((c) => c[0] === "fillText").map((c) => c.slice(1));
}

test("the link on the card is the host, under the date, and only when the knob is on", () => {
  const on = paintCard({ link: 1 });
  assert.deepEqual(on[on.length - 1], ["aim-dojo.vercel.app", 360, 1050, 576], "host and path only, no protocol, no trailing slash, under the date");
  assert.deepEqual(on[on.length - 2], ["23 Aug 2026", 360, 1021, 576], "the date line is where it always was");
  const off = paintCard({ link: 0 });
  assert.deepEqual(off, on.slice(0, -1), "link:0 → the exact draw sequence without the link line");
  assert.equal(off.length, 3, "✦ · the deal · the date — nothing else is text on the card");
  const local = paintCard({ link: 1, protocol: "file:", origin: "null", pathname: "/C:/x/index.html" });
  assert.deepEqual(local, off, "a local file is not an invitation");
  const mirror = paintCard({ link: 1, origin: "https://robjohncolson.github.io", pathname: "/aim-dojo/" });
  assert.equal(mirror[mirror.length - 1][0], "robjohncolson.github.io/aim-dojo", "the mirror paints its own address");
});

test("the share overlay and the card read one link authority, and no identity travels in it", () => {
  assert.equal((html.match(/function linkUrl\(/g) || []).length, 0, "the closure copy is gone");
  assert.equal((html.match(/=shareLinkUrl\(\)/g) || []).length, 2, "the QR builder and the card are its only callers");
  assert.match(SHARE_LINK, /location\.origin\+location\.pathname/);
  assert.ok(!/location\.(?:search|hash)|URLSearchParams|ghostToken|localStorage/.test(SHARE_LINK + CARD_LINK), "no query, hash or token can reach the link");
});
