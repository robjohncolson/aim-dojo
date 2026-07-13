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
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = "";
      }
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
  const declaration = new RegExp(`\\bfunction\\s+${name}\\s*\\(`);
  const match = declaration.exec(html);
  assert.ok(match, `${name} must be a named function so its behavior can be tested`);
  const openAt = html.indexOf("{", match.index + match[0].length);
  assert.notEqual(openAt, -1, `${name} has a body`);
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

const expectedCueCfg = Object.freeze({
  pocketCircleCue: true,
  pocketColPush: 0xb8f0a0,
  pocketColOn: 0x9fd8ff,
  pocketColLay: 0xff8ab8,
  pocketMainDim: 0.28,
  pocketGhostAlpha: 0.34,
  pocketTargetAlpha: 0.92,
  pocketLateScale: 0.55,
  pocketStaffMode: "slim",
});

function radiusHarness(overrides = {}) {
  const context = vm.createContext({
    CFG: { ...expectedCueCfg, ...overrides },
    Math,
  });
  vm.runInContext(`${extractFunction("radiusForIdeal")};`, context);
  return context.radiusForIdeal;
}

function normalizeColor(value) {
  if (typeof value === "number") return `#${value.toString(16).padStart(6, "0")}`;
  const text = String(value).trim().toLowerCase();
  if (/^#[\da-f]{6}$/.test(text)) return text;
  if (/^#[\da-f]{3}$/.test(text)) {
    return `#${[...text.slice(1)].map((char) => char + char).join("")}`;
  }
  const rgb = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return `#${rgb.slice(1).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
  }
  return text;
}

function recordingContext() {
  const strokes = [];
  let pendingRadius = null;
  const ctx = {
    fillStyle: "#000000",
    font: "",
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "#000000",
    textAlign: "",
    textBaseline: "",
    beginPath() { pendingRadius = null; },
    arc(_x, _y, radius) { pendingRadius = radius; },
    clearRect() {},
    closePath() {},
    fill() {},
    fillText() {},
    restore() {},
    save() {},
    setLineDash() {},
    setTransform() {},
    stroke() {
      strokes.push({
        alpha: this.globalAlpha,
        color: normalizeColor(this.strokeStyle),
        lineWidth: this.lineWidth,
        radius: pendingRadius,
      });
    },
    strokeText() {},
  };
  return { ctx, strokes };
}

function renderPocketCircle({
  activePocket = "on",
  beats = 1,
  circleCue = true,
  phase = "hold",
  pocketEnabled = true,
  reduced = false,
} = {}) {
  const { ctx: hudCtx, strokes } = recordingContext();
  const cfg = {
    ...expectedCueCfg,
    beatQuant: true,
    beatQuantDivs: [2, 4, 8],
    beatQuantT: [0.4, 0.75],
    pocketCircleCue: circleCue,
    pocketOffsetBeat: 0.25,
    wasdHud: true,
    wasdLetter: true,
    wasdRhythm: true,
    wasdTapText: false,
  };
  const context = vm.createContext({
    CFG: cfg,
    HUD_CSS: 560,
    HUD_DPR: 1,
    IS_JA: false,
    MOBILE: false,
    PI2: Math.PI * 2,
    T: (_key, fallback) => fallback,
    Tone: { Transport: { state: "started" } },
    WASD_COL: ["#112233", "#112233", "#112233", "#112233"],
    _activePocket: activePocket,
    _combo: [0, 1, 2, 3],
    _hitNote: -1,
    _hitOff: 0,
    _noteFlashHit: false,
    _noteFlashT: -999,
    _pocketPhase: phase,
    _sparkPend: null,
    _spoilNote: -1,
    _spoilOff: 0,
    _tapAcc: 0,
    _tapOffMs: 0,
    _tapShowT: -999,
    _wasdCombo: 0,
    dayAmt: 0,
    diffT: () => 0,
    hudCanvas: { style: { display: "block" } },
    hudCtx,
    pocketCueId: () => (phase === "hold" ? activePocket : "on"),
    pocketIdeal: (id) => (id === "push" ? -0.25 : id === "layback" ? 0.25 : 0),
    pocketLive: () => pocketEnabled,
    reduceMotion: reduced,
    showWasdGlyph: () => {},
    state: { running: true, t: 10 },
    toneReady: true,
    trainMode: false,
    wasdBeats: () => beats,
    wasdBeatsHeard: () => beats,
  });

  // A top-level helper is available to the extracted draw function. An implementation
  // may instead nest the same named helper inside drawWasdLane; declaring it twice in
  // separate lexical scopes is harmless.
  vm.runInContext([
    extractFunction("radiusForIdeal"),
    extractFunction("pocketColorCss"),
  ].join("\n"), context);
  vm.runInContext(`${extractFunction("drawWasdLane")}; drawWasdLane();`, context);
  return strokes;
}

function strokesOf(strokes, color) {
  return strokes.filter((stroke) => stroke.color === color);
}

function runStaff(mode, phase, activePocket = "on") {
  const names = ["pocketBeatInBar", "pocketBarHtml", "pocketStaffLayoutMode", "pocketStaffHtml"];
  const context = vm.createContext({
    CFG: { ...expectedCueCfg, pocketStaffMode: mode },
    T: (_key, fallback) => fallback,
    _activePocket: activePocket,
    _pocketCount: 0,
    _pocketPhase: phase,
    pocketLabel: (id) => id.toUpperCase(),
  });
  vm.runInContext(names.map(extractFunction).join("\n"), context);
  return context.pocketStaffHtml();
}

test("pocket beat-circle CFG defaults are exact and independently kill-switchable (C1)", () => {
  const cfg = extractCfg();
  for (const [key, value] of Object.entries(expectedCueCfg)) {
    assert.equal(cfg[key], value, `CFG.${key}`);
  }
});

test("radiusForIdeal implements the adopted early/on/late geometry (C2, C10)", () => {
  const radiusForIdeal = radiusHarness();
  const inner = 46;
  const span = 200;
  const half = 0.5;

  assert.equal(radiusForIdeal(0, inner, span, half), inner);
  assert.equal(radiusForIdeal(-0.25, inner, span, half), 146);
  assert.equal(radiusForIdeal(0.25, inner, span, half), 101);
  assert.ok(radiusForIdeal(-0.25, inner, span, half) > radiusForIdeal(0.25, inner, span, half));
  assert.ok(radiusForIdeal(0.25, inner, span, half) > inner);
  assert.ok(Number.isFinite(radiusForIdeal(0)), "the spec's one-argument helper call remains valid");

  const tighterLate = radiusHarness({ pocketLateScale: 0.3 });
  assert.equal(tighterLate(0.25, inner, span, half), 76, "layback geometry reads the CFG late scale");
});

test("drawWasdLane emits the phase-specific target colors and main-ring hierarchy (C3-C7)", () => {
  const mint = "#b8f0a0";
  const rail = "#9fd8ff";
  const pink = "#ff8ab8";
  const lane = "#112233";

  const establish = renderPocketCircle({ phase: "establish", beats: 1 });
  assert.equal(strokesOf(establish, mint).length, 0, "establish has no push target");
  assert.equal(strokesOf(establish, pink).length, 0, "establish has no layback target");
  assert.ok(strokesOf(establish, lane).some((stroke) => stroke.alpha >= 0.75), "establish keeps its main ring strong");

  const listening = renderPocketCircle({ phase: "sample", beats: 1 });
  for (const color of [mint, rail, pink]) {
    const ghosts = strokesOf(listening, color);
    assert.ok(ghosts.length >= 1, `LISTENING draws ${color}`);
    assert.ok(ghosts.some((stroke) => stroke.alpha <= expectedCueCfg.pocketGhostAlpha + 0.02), `${color} is a faint ghost`);
  }
  const listeningRadii = Object.fromEntries([mint, rail, pink].map((color) => [color, strokesOf(listening, color)[0].radius]));
  assert.ok(listeningRadii[mint] > listeningRadii[pink]);
  assert.ok(listeningRadii[pink] > listeningRadii[rail]);

  const push = renderPocketCircle({ phase: "hold", activePocket: "push", beats: 0.75 });
  assert.ok(strokesOf(push, mint).some((stroke) => stroke.alpha >= expectedCueCfg.pocketTargetAlpha - 0.02), "push target is primary mint");
  assert.equal(strokesOf(push, pink).length, 0);
  assert.ok(strokesOf(push, lane).some((stroke) => stroke.alpha <= expectedCueCfg.pocketMainDim + 0.02), "push dims the main approach ring");
  assert.ok(Math.max(...strokesOf(push, mint).map((stroke) => stroke.lineWidth)) >= Math.max(...strokesOf(push, lane).map((stroke) => stroke.lineWidth)));
  assert.ok(Math.abs(strokesOf(push, mint)[0].radius - strokesOf(push, lane)[0].radius) < 1e-9, "raw push path crosses the fixed target at the grading ideal");

  const layback = renderPocketCircle({ phase: "hold", activePocket: "layback", beats: 1.25 });
  assert.ok(strokesOf(layback, pink).some((stroke) => stroke.alpha >= expectedCueCfg.pocketTargetAlpha - 0.02), "layback target is primary pink");
  assert.equal(strokesOf(layback, mint).length, 0);
  assert.ok(strokesOf(layback, lane).some((stroke) => stroke.alpha <= expectedCueCfg.pocketMainDim + 0.02), "layback dims the main approach ring");
  assert.ok(Math.max(...strokesOf(layback, pink).map((stroke) => stroke.lineWidth)) >= Math.max(...strokesOf(layback, lane).map((stroke) => stroke.lineWidth)));
  assert.ok(Math.abs(strokesOf(layback, pink)[0].radius - strokesOf(layback, lane)[0].radius) < 1e-9, "raw layback path crosses the fixed target at the grading ideal");

  const on = renderPocketCircle({ phase: "hold", activePocket: "on", beats: 1 });
  assert.equal(strokesOf(on, mint).length, 0, "hold-on does not draw a second colored target");
  assert.equal(strokesOf(on, pink).length, 0, "hold-on does not draw a second colored target");
  assert.ok(strokesOf(on, lane).some((stroke) => stroke.alpha >= 0.75), "hold-on keeps the main ring strong");
});

test("circle kill-switch and non-pocket modes preserve the legacy single-ring draw", () => {
  const legacyPush = renderPocketCircle({ phase: "hold", activePocket: "push", beats: 0.75, circleCue: false });
  const cuePush = renderPocketCircle({ phase: "hold", activePocket: "push", beats: 0.75 });
  assert.ok(strokesOf(legacyPush, "#112233").some((stroke) => stroke.radius === 46), "legacy ring still lands at Rin on the shifted pocket ideal");
  assert.ok(strokesOf(cuePush, "#112233").some((stroke) => stroke.radius > 46), "new cue keeps the raw main path to cross the outer target");

  for (const strokes of [
    legacyPush,
    renderPocketCircle({ phase: "hold", activePocket: "push", pocketEnabled: false }),
  ]) {
    assert.equal(strokesOf(strokes, "#b8f0a0").length, 0);
    assert.equal(strokesOf(strokes, "#ff8ab8").length, 0);
    assert.ok(strokesOf(strokes, "#112233").length >= 1, "legacy main ring remains");
  }
});

test("pocketStaffMode supports full, slim, and off without removing coach metadata (C8)", () => {
  assert.equal((runStaff("full", "sample").match(/class="ph-row/g) || []).length, 3);
  assert.equal((runStaff("slim", "sample").match(/class="ph-row/g) || []).length, 0);
  assert.equal((runStaff("slim", "establish").match(/class="ph-row/g) || []).length, 1);
  assert.equal((runStaff("slim", "hold", "push").match(/class="ph-row/g) || []).length, 1);
  assert.equal((runStaff("off", "sample").match(/class="ph-row/g) || []).length, 0);

  const phaseEl = { textContent: "" };
  const countEl = { textContent: "" };
  const staffEl = { innerHTML: "sentinel" };
  const context = vm.createContext({
    CFG: { ...expectedCueCfg, pocketSampleBeats: 4, pocketStaffMode: "off" },
    T: (_key, fallback) => fallback,
    _activePocket: "on",
    _pocketCount: 1,
    _pocketPhase: "sample",
    pocketAcc: () => 1,
    pocketBarNow: () => 1,
    pocketBarTotal: () => 1,
    pocketBindEls: () => {},
    pocketCountEl: countEl,
    pocketHelpEl: { textContent: "" },
    pocketHoldLen: () => 16,
    pocketHudEl: { classList: { add() {}, remove() {} } },
    pocketLabel: (id) => id.toUpperCase(),
    pocketLive: () => true,
    pocketPhaseEl: phaseEl,
    pocketStaffEl: staffEl,
    pocketStaffHtml: () => "",
    state: { running: true },
  });
  vm.runInContext(`${extractFunction("pocketUpdateHud")}; pocketUpdateHud();`, context);
  assert.equal(staffEl.innerHTML, "");
  assert.match(phaseEl.textContent, /LISTENING/);
  assert.match(countEl.textContent, /1\/4/);
});

test("reduced motion keeps a static pocket target instead of animating or hiding it (C9)", () => {
  const first = strokesOf(renderPocketCircle({
    phase: "hold",
    activePocket: "push",
    beats: 0.7,
    reduced: true,
  }), "#b8f0a0");
  const second = strokesOf(renderPocketCircle({
    phase: "hold",
    activePocket: "push",
    beats: 0.9,
    reduced: true,
  }), "#b8f0a0");
  assert.ok(first.length >= 1, "reduced motion retains the functional push target");
  assert.deepEqual(first.map((stroke) => stroke.radius), second.map((stroke) => stroke.radius));
});

test("combat open-window implementation has no pocket-circle dependency (C10)", () => {
  assert.equal(extractCfg().grooveFireEarlyBeat, 0);
  const animate = extractFunction("animate");
  const gateAt = animate.indexOf("if(CFG.grooveGroove && CFG.grooveVuln)");
  assert.notEqual(gateAt, -1, "animate contains the combat open-window gate");
  const blockAt = animate.indexOf("{", gateAt);
  const openWindow = animate.slice(blockAt, closingDelimiter(animate, blockAt) + 1);
  assert.match(openWindow, /CFG\.grooveFireEarlyBeat/);
  assert.match(openWindow, /_openAmt\s*=/);
  assert.doesNotMatch(openWindow, /pocket(?:Live|Ideal|Cue|Circle|Offset|Phase)|_activePocket|_pocketPhase/i);
});
