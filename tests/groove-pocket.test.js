"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const { sourceText: html } = require("./source.js");

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
    var trainMode = false, MOBILE = false, templeActive = false, bonusActive = false;
    var state = { running: true, t: 0, bpm: 120 };
    var _pocketBuffer = [], _expectedPocket = 'on', _pocketBarCount = 0;
    var _pocketCandidate = null, _pocketCandidateStreak = 0, _pocketMissScan = null;
    var _resolved = new Set(), _resolvedNd = null, _pocketResolvedMains = new Set(), _baseMul = 1, _wasdCombo = 0;
    var _pipSetN = 0, _pipSetFlashT = -999;
    var _streakNotice = { misses: 0, kind: '', at: -999, hits: 0 };
    var _curCi = -1, _curMain = true, _spoilNote = -1, _hitNote = -1;
    var toasts = [];
    function T(_key, fallback) { return fallback; }
    function showGhostToast(message) { toasts.push(message); }
  `;
  const context = vm.createContext({ Math, Number, Set, console });
  vm.runInContext(prelude + source, context);
  vm.runInContext(["streakFlowLevel", "wasdStreakMiss", "wasdStreakRecover", "resetWasdStreakNotice"].map(extractFunction).join("\n"), context);
  context.read = (expression) => vm.runInContext(expression, context);
  context.write = (statement) => vm.runInContext(statement, context);
  return context;
}

function bonusAccessSandbox(bpm = 28) {
  const context = loadPocketSandbox(extractCfg());
  const audio = [];
  const rainbow = /\bconst FLOCK=\{[^]*?\brainbowCombo:(\d+)/.exec(html);
  assert.ok(rainbow, "the authored flock threshold is present");
  Object.assign(context, {
    state: { running: true, t: 0, bpm, streak: 0, hits: 0 },
    _beats: 0, _combo: [0, 1, 2, 3, 0, 1, 2, 3],
    _tapOffSum: 0, _tapOffN: 0, _tapAcc: 0, _tapShowT: 0,
    _noteFlashT: 0, _noteFlashHit: false, _sparkPend: null,
    templeActive: false, bonusActive: false, _bow: { stage: 0 }, BOW: { LAST: 2 },
    GH_CHALK: false, GH_RECORD: false, soundOn: true, toneReady: true, reduceMotion: false,
    FLOCK: { rainbowCombo: Number(rainbow[1]) }, PENTA: [277.18, 329.63, 369.99, 415.30, 493.88, 554.37, 659.25, 739.99],
    activeTheme: { name: "MOONLIGHT" }, tapSynth: { triggerAttackRelease: (...args) => audio.push(args) },
    bowTouch: () => {}, audioLat: () => 0, grooveI: 0, accuracy: null, strobe: true,
    Tone: { Transport: { state: "started" } },
  });
  context.wasdBeats = () => context._beats;
  context.beatSnap = () => context.state.t;
  context.windowAccuracy = () => context.accuracy;
  vm.runInContext(["diffT", "_wasdResolve", "noteTrainWasd", "wasdLanePress", "wasdMul"].map(extractFunction).join("\n"), context);

  // Replay the actual main-miss resolution block; audio, clock and graphics alone are stubs.
  const frameAt = html.indexOf("if(CFG.wasdRhythm && strobe){ const nd=wasdNoteDiv();");
  assert.ok(frameAt > 0, "animate's note-resolution block is present");
  const frameOpen = html.indexOf("{", frameAt);
  const frameClose = closingDelimiter(html, frameOpen);
  const frameElse = /^\s*else\s*\{/.exec(html.slice(frameClose + 1));
  assert.ok(frameElse, "animate's disabled-lane reset branch is present");
  const elseOpen = frameClose + frameElse[0].length;
  const frame = new vm.Script(html.slice(frameAt, closingDelimiter(html, elseOpen) + 1));
  const grid = extractFunction("onGrid");
  const rewardAt = grid.indexOf("const _acc=windowAccuracy()");
  const tierAt = grid.indexOf("const tier =", rewardAt);
  assert.ok(rewardAt > 0 && tierAt > rewardAt, "onGrid's actual reward and tier selection are present");
  const reward = new vm.Script(`(()=>{${grid.slice(rewardAt, grid.indexOf(";", tierAt) + 1)} return {target:gt,groove:grooveI,tier};})()`);
  context.step = (beats) => {
    context._beats = beats;
    context.state.t = (beats + .5) * 60 / bpm;
    if (context.state.running && !context.templeActive) context.updatePocketMisses();
    if (context.state.running && !context.templeActive && !context.bonusActive) frame.runInContext(context);
  };
  context.rewardStep = () => reward.runInContext(context);
  // Run the actual contiguous WASD reset portion, including a fresh combo and pocket reset.
  // The rest of resetSession owns unrelated scene, score and audio setup.
  const reset = extractFunction("resetSession");
  const resetAt = reset.indexOf("_curCi=-1;");
  const resetEnd = reset.indexOf(" tideI=1;", resetAt);
  assert.ok(resetAt > 0 && resetEnd > resetAt, "session's WASD reset segment is present");
  const resetWasd = new vm.Script(reset.slice(resetAt, resetEnd));
  context.resetFlock = () => {};
  vm.runInContext(extractFunction("makeWasdCombo"), context);
  context.resetWasdSession = () => resetWasd.runInContext(context);
  context.audio = audio;
  return context;
}

function pipRendererSandbox(bpm = 28) {
  const context = bonusAccessSandbox(bpm);
  const operations = [], glyphs = [];
  Object.assign(context.CFG, { wasdHud: true, wasdLetter: true, wasdTapText: false, pocketCircleCue: false });
  Object.assign(context, {
    HUD_CSS: 560, HUD_CX: 280, HUD_K: 1, ROAD_LANE_READY: false,
    LOW: false, _flowGlow: { value: 0 }, _flowPhase: { value: 0 },
    ML_RING_ECHO: false, ML_RING_ECHO_T: .30, ML_RING_IN: .18,
    Tone: { Transport: { state: "started" } }, WASD_COL: ["lane-w", "lane-a", "lane-s", "lane-d"],
    dayAmt: 0, _spoilOff: 0, _hitOff: 0,
    hudCanvas: { style: { display: "block" } },
    roadLive: () => false, moonlineVoid: () => false, wasdBeatCueOn: () => false,
    wasdBeatsHeard: () => context._beats,
    showWasdGlyph: (key, spoiled, on, ghost, glow) => glyphs.push({ key, spoiled, on, ghost, glow }),
    hudCtx: {
      globalAlpha: 1, lineWidth: 1, strokeStyle: "", fillStyle: "", _path: [],
      beginPath() { this._path = []; },
      arc(x, y, radius) { this._path.push({ x, y, radius }); },
      fill() { operations.push({ kind: "fill", color: this.fillStyle, alpha: this.globalAlpha, path: this._path.slice() }); },
      stroke() { operations.push({ kind: "stroke", color: this.strokeStyle, width: this.lineWidth, path: this._path.slice() }); },
      fillText(text, x, y) {
        operations.push({ kind: "fillText", text, x, y, color: this.fillStyle, font: this.font, align: this.textAlign, baseline: this.textBaseline });
      },
      strokeText(text, x, y) {
        operations.push({ kind: "strokeText", text, x, y, color: this.strokeStyle, width: this.lineWidth, font: this.font });
      },
      clearRect() {}, setTransform() {},
    },
  });
  vm.runInContext(["ARC", "drawStreakFlow", "drawWasdLane"].map(extractFunction).join("\n"), context);
  context.draw = () => {
    operations.length = 0; glyphs.length = 0;
    context.drawWasdLane();
    return {
      pips: operations.filter((op) => op.kind === "fill" && op.color === "#74e84a"),
      backing: operations.filter((op) => op.kind === "fill" && op.color === "rgba(0,0,0,0.7)"),
      numerals: operations.filter((op) => op.kind === "fillText"),
      outlines: operations.filter((op) => op.kind === "strokeText"),
      glyph: glyphs.at(-1),
    };
  };
  return context;
}

function pressMainStreak(context, count, firstBeat = 0) {
  for (let beat = firstBeat; beat < firstBeat + count; beat += 1) {
    context.step(beat);
    context.wasdLanePress(context._combo[beat % context._combo.length]);
  }
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
      // THE FORTY FIX (parcel R): the lane reads its OWN ladder now, so the floor-tint sandbox must carry it. diffT() is stubbed at 0 below,
      // so wasdNoteDiv() returns 1 exactly as the old inline beatQuantT expression did — every expectation in these tests is unchanged.
      wasdNoteDivs: [2, 4, 8],
      wasdNoteT: [1.01, 1.02],
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
    // THE STAR ROAD (wave 7, parcel S) gates this cue: the road subsumes the floor-beat flash. false = the kill-switch
    // state (CFG.road.on:false), which is exactly the shipped floor-beat behaviour these B5/B7 cases pin.
    roadLive: () => false,
    reduceMotion: false,
    state: { bpm: 120, running: true },
    toneReady: true,
    trainMode: false,
    wasdBeats: () => beats,
    wasdBeatsHeard: () => beats,
  });
  // PARCEL W lifted the envelope out of updateFloorBeat into wasdBeatGlow() so the CROSSHAIR can read the same law
  // (SPEC_MOONLINE §1's cue contract) — the floor path is the same arithmetic, one call deeper, so this sandbox lifts
  // both halves and every B5/B7 expectation below is the one that shipped.
  vm.runInContext(`var _beatGlowKey=0; ${extractFunction("wasdNoteDiv")}; ${extractFunction("wasdBeatCueOn")}; ${extractFunction("beatSwell")}; ${extractFunction("wasdBeatGlow")}; ${extractFunction("updateFloorBeat")}; updateFloorBeat();`, context);
  return { amount: amount.value, color: seen.color };
}

test("on-beat pace: main mode has one required note throughout 20-60 bpm", () => {
  const cfg = extractCfg();
  assert.equal(cfg.wasdNoteDivs.join(","), "2,4,8", "lane divs mirror the strobe's shape");
  assert.equal(cfg.wasdNoteT.join(","), "1.01,1.02", "both denser subdivisions are above the clamped difficulty ceiling");
  assert.equal(cfg.wasdPipN, 16, "one visible set contains sixteen credited main beats");
  assert.equal(cfg.beatQuantT.join(","), "0.4,0.75", "the ORB STROBE's audited 36/50 deepening is untouched by the decoupling");

  const context = vm.createContext({ Math, Number, CFG: cfg });
  vm.runInContext(extractFunction("wasdNoteDiv"), context);
  // diffT() verbatim (index.html): clamp((bpm-minBpm)/(maxBpm-minBpm)) — linear in tempo, so a threshold IS a tempo.
  const diffT = (bpm) => Math.max(0, Math.min(1, (bpm - cfg.minBpm) / (cfg.maxBpm - cfg.minBpm)));
  const nd = (bpm) => vm.runInContext(`wasdNoteDiv(${diffT(bpm)})`, context);

  for (let bpm = 20; bpm <= 60; bpm += 0.5) assert.equal(nd(bpm), 1, `one required main at ${bpm} bpm`);
  assert.equal(nd(60), 1, "the summit retains one note per beat");
  assert.equal(nd(1e6), 1, "even an out-of-range BPM clamps to difficulty 1 before density selection");
});

test("on-beat pace: live main, lessons and explicit clamped difficulty probes all retain one note", () => {
  const cfg = extractCfg();
  const context = vm.createContext({ Math, Number, CFG: cfg, state: { bpm: 28 }, trainMode: false });
  vm.runInContext(`${extractFunction("diffT")}\n${extractFunction("wasdNoteDiv")}`, context);
  for (const bpm of [20, 28, 40, 50, 60]) {
    context.state.bpm = bpm;
    context.trainMode = false;
    assert.equal(context.wasdNoteDiv(), 1, `live main density at ${bpm}`);
    context.trainMode = true;
    for (const probe of [undefined, null, NaN, Infinity]) assert.equal(context.wasdNoteDiv(probe), 1, `live trainer density at ${bpm}`);
    assert.equal(context.wasdNoteDiv(context.diffT()), 1, "an explicit finite probe remains independent of training state");
  }
});

test("DE-COERCION: unreachable denser probes retain ghost styling and main-only miss handling (R)", () => {
  // These legacy branches remain testable under explicit denser probes; live play is always nd1.
  assert.match(html, /const lw=main\?4\.5:2\.0, ghost=main\?1:0\.45;/, "bonus ring renders as a ghost");
  // laneCue is THE STAR ROAD's note-lane gate (wave 7, parcel S) — !roadLive(), so it is `true` with road.on:false and the
  // ghost/dim contract below is unchanged. The de-coercion this test guards is the ghostNote argument, still last and still there.
  // PARCEL W appends the beat-glow amount as a FIFTH argument; ghostNote is still fourth and still there, which is the
  // de-coercion this test guards.
  assert.match(html, /showWasdGlyph\(letterKey, spoiled, laneCue && \(CFG\.wasdLetter \|\| reduceMotion\) && !hitHeld && !flashing, ghostNote, cueGlow\)/, "legacy ghost styling survives the set-flash glyph gate");
  assert.match(html, /if\(!pocketLive\(\) && _curCi>=0 && !_resolved\.has\(_curCi\) && _curMain\)/, "only a MAIN can miss at departure, and the pocket sweep owns its full late window");
  assert.match(html, /else if\(acc>0\) _wasdCombo\+\+;/, "the unreachable bonus-credit branch is retained");
  // 6 -> 8: THE MEANING (wave 7, parcel S2) added two READERS of the lane's density — roadLaneAt (which beat-band shows
  // which key) and roadWakeLatch (is this resolved note a MAIN?). Both call the one helper, which is what this line pins;
  // the "no duplicated inline density expression survives" assertion below is the half that must never move.
  assert.equal((html.match(/nd=wasdNoteDiv\(\)/g) || []).length, 8, "every inline note-density computation calls the one helper");
  assert.equal((html.match(/nd=Math\.max\(1,spb\/2\)/g) || []).length, 0, "no duplicated inline density expression survives");
  assert.equal((html.match(/spb=dT<t\[0\]\?d\[0\]:\(dT<t\[1\]\?d\[1\]:d\[2\]\)/g) || []).length, 1, "the one surviving tier expression is the ORB STROBE's own");
});

test("on-beat pace: real mains earn streak credit, duplicates cannot farm, and on-law midpoints earn no credit", () => {
  for (const bpm of [20, 28, 60]) for (const pocketEnabled of [false, true]) {
    const c = bonusAccessSandbox(bpm);
    c.CFG.groovePocket = pocketEnabled;
    c.step(0); c.wasdLanePress(0);
    assert.equal(c._wasdCombo, 1, "a credited free-play main earns the first pip");
    assert.equal(c._baseMul, 0, "a clean main earns its existing damping");
    assert.equal(c._sparkPend.key, 0);
    assert.equal(c._sparkPend.acc, 100, "the real press requests the existing visual burst");
    assert.equal(c._sparkPend.rainbow, false);
    c.wasdLanePress(0);
    assert.equal(c._wasdCombo, 1, "a duplicate cannot farm main credit");
    assert.equal(c.audio.length, 1, "only the accepted press sounds");
    c.step(.5);
    const claim = c.claimWasdNote(.5, c.wasdNoteDiv(), 60 / bpm, 60 / bpm * c.CFG.wasdWindowFrac);
    if (pocketEnabled) {
      assert.equal(claim.main, true, "overlapping pocket windows may claim an adjacent MAIN, never an interstitial bonus");
      assert.equal(claim.mainBeat, 1, "the already resolved main cannot be claimed again");
      c.wasdLanePress(1);
      assert.equal(c._tapAcc, 0, "a half beat is outside the current on-law accuracy window");
      assert.equal(c._wasdCombo, 0, "a claimed main with zero credit breaks the consecutive streak");
      c.wasdLanePress(1);
      assert.equal(c._tapOffN, 2, "the midpoint's main cannot be farmed by a duplicate either");
      c.step(1); c.wasdLanePress(1);
      assert.equal(c._tapOffN, 2, "the main resolved at the midpoint stays consumed at its center");
    } else {
      assert.equal(claim, null, "default nd1 play has no note at the midpoint");
      c.wasdLanePress(1); c.wasdLanePress(1);
      assert.equal(c._wasdCombo, 1, "unclaimed midpoint presses neither earn credit nor break a clean streak");
      assert.equal(c._tapOffN, 1);
      c.step(1); c.wasdLanePress(1);
      assert.equal(c._wasdCombo, 2, "the next main remains available at its center");
    }
    c.step(2); c.wasdLanePress(2);
    assert.equal(c._wasdCombo, pocketEnabled ? 1 : 3, "only credited mains contribute to the streak");
    c.step(3); c.step(pocketEnabled ? 3.7 : 3.6);
    assert.equal(c._wasdCombo, 0, "an unresolved main still costs the streak");
    assert.equal(c._baseMul, 1, "an unresolved main still releases damping");
    assert.equal(c._pipSetN, 0);
    assert.equal(c._pipSetFlashT, -999);
  }
});

test("on-beat pace: one main press per beat stays clean at entry with the 857 ms nd1 accuracy window", () => {
  const c = bonusAccessSandbox();
  for (let beat = 0; beat < 4; beat += 1) {
    c.step(beat); c.wasdLanePress(beat % 4); c.step(beat + .5);
    assert.equal(c._baseMul, 0);
    assert.equal(c._wasdCombo, beat + 1, "passing a midpoint without pressing cannot break the streak");
  }
  c.step(4);
  assert.equal(c._baseMul, 0, "four required presses suffice without any midpoint presses");
  assert.equal(c._tapOffN, 4);
  assert.equal(c.audio.length, 4);
  const bps = 60 / 28;
  const w = bps * c.CFG.wasdWindowFrac;
  assert.equal(Math.round(w * 1000), 857, "entry uses the existing nd1 window arithmetic");
  const inside = bonusAccessSandbox(), outside = bonusAccessSandbox();
  inside.step((w - .001) / bps); inside.wasdLanePress(0);
  outside.step((w + .001) / bps); outside.wasdLanePress(0);
  assert.equal(inside._tapOffN, 1, "just inside the main window is graded");
  assert.equal(inside._wasdCombo, 1, "positive accuracy earns streak credit even when the displayed percentage rounds to zero");
  assert.equal(outside._tapOffN, 0, "default play leaves a press just outside the main window unclaimed");
  const pocketOutside = bonusAccessSandbox();
  pocketOutside.CFG.groovePocket = true;
  pocketOutside.pocketArmMissFrontier(0, bps, w); // Pocket was active before this main began; no activation-time skip.
  pocketOutside.step((w + .001) / bps); pocketOutside.wasdLanePress(0);
  assert.equal(pocketOutside._tapOffN, 1, "opted-in pocket windows still allow an adjacent feel to claim this main");
  assert.equal(pocketOutside._wasdCombo, 0, "outside the on-law accuracy window the pocket claim earns no streak credit");
});

test("early music: nine credited mains draw nine pips and reach the authored top tier at 28 BPM without shot hits", () => {
  const c = pipRendererSandbox();
  assert.equal(c.rewardStep().tier, 0, "idle entry has no unearned music reward");
  for (let beat = 0; beat < 9; beat += 1) {
    const key = beat % 4;
    c.step(beat); c.wasdLanePress(key); c.rewardStep();
    assert.equal(c._wasdCombo, beat + 1);
    assert.equal(c._sparkPend.rainbow, beat + 1 >= 6, "the existing six-hit rainbow threshold reads the main streak");
    assert.equal(c.audio.at(-1)[0], c.PENTA[key * 2] * (beat + 1 >= 8 ? 2 : 1), "the existing eighth-hit octave reads the same streak");
    const drawing = c.draw();
    assert.equal(drawing.pips.length, beat + 1, "each credited main adds one rendered inner pip");
    assert.equal(drawing.numerals.length, 0, "a partial set has no numeral");
  }
  assert.ok(c.state.t < 20, "nine main successes fit in the first twenty seconds at entry tempo");
  assert.equal(c._pipSetN, 0);
  assert.equal(c._pipSetFlashT, -999);
  let result;
  for (let i = 0; i < 4; i += 1) result = c.rewardStep();
  assert.ok(Math.abs(result.target - 2.7) < 1e-12, "WASD reward stops at its authored contribution cap");
  assert.equal(result.tier, 3, "normal smoothing reaches the existing highest tier");
  assert.ok(result.groove < 3);
  assert.equal(c.state.bpm, 28);
  assert.equal(c.state.hits, 0);
  assert.equal(c.state.streak, 0);
});

test("on-beat pips: the sixteenth and thirty-second mains fill the same sixteen slots and flash sets 1 and 2", () => {
  for (const bpm of [28, 60]) {
    const c = pipRendererSandbox(bpm);
    for (const set of [1, 2]) {
      pressMainStreak(c, 16, (set - 1) * 16);
      assert.equal(c._wasdCombo, set * 16);
      assert.equal(c._pipSetN, set);
      assert.equal(c._pipSetFlashT, c.state.t, "completion latches the actual press time");
      const d = c.draw();
      assert.equal(d.pips.length, 16);
      assert.equal(d.backing.length, 16);
      for (let i = 0; i < 16; i += 1) {
        const pip = d.pips[i].path[0], backing = d.backing[i].path[0];
        const angle = -Math.PI / 2 + i * Math.PI / 8;
        assert.ok(Math.abs(pip.x - (280 + Math.cos(angle) * 36)) < 1e-9, "slots run clockwise from twelve o'clock");
        assert.ok(Math.abs(pip.y - (280 + Math.sin(angle) * 36)) < 1e-9, "pips stay on the existing Rin-10 radius");
        assert.equal(pip.radius, 2.6);
        assert.deepEqual(backing, { x: pip.x, y: pip.y, radius: 3.4 }, "each green dot keeps its black backing");
      }
      assert.equal(d.numerals.length, 1, "only the bare completed-set numeral is drawn");
      assert.equal(d.numerals[0].text, String(set));
      assert.deepEqual([d.numerals[0].x, d.numerals[0].y, d.numerals[0].align, d.numerals[0].baseline], [280, 280, "center", "middle"]);
      const fontSize = Number(/(\d+)px/.exec(d.numerals[0].font)?.[1]);
      assert.ok(fontSize >= 64 && fontSize <= 90, "the numeral is large in the existing 560-space canvas");
      assert.equal(d.outlines.length, 1);
      assert.equal(d.outlines[0].text, String(set));
      assert.equal(d.outlines[0].color, "rgba(0,0,0,0.85)", "a black stroke keeps the set readable");
      assert.ok(d.outlines[0].width >= 3);
      assert.equal(d.glyph.on, false);
    }
  }
});

test("on-beat pips: a completed set expires to an empty ring, then the seventeenth main draws one pip", () => {
  for (const bpm of [20, 28, 60]) {
    const c = pipRendererSandbox(bpm);
    pressMainStreak(c, 16);
    const flashedAt = c._pipSetFlashT;
    c.wasdLanePress(c._combo[15 % c._combo.length]);
    assert.equal(c._wasdCombo, 16, "a duplicate completion press cannot create another set");
    assert.equal(c._pipSetFlashT, flashedAt, "a duplicate cannot extend the numeral's lifetime");
    c.step(15 + .999 * bpm / 60);
    assert.equal(c.draw().pips.length, 16, "the full ring is held through the bounded flash");
    assert.equal(c.draw().numerals[0].text, "1");
    c.step(15 + 1.001 * bpm / 60);
    assert.equal(c._wasdCombo, 16);
    assert.equal(c.draw().pips.length, 0, "sixteen modulo sixteen becomes empty after the one-second live-tempo cap");
    assert.equal(c.draw().numerals.length, 0);
    pressMainStreak(c, 1, 16);
    assert.equal(c._wasdCombo, 17);
    assert.equal(c._pipSetN, 1, "set history is retained without drawing a running counter");
    assert.equal(c.draw().pips.length, 1);
    assert.equal(c.draw().numerals.length, 0);
  }
});

test("on-beat pips: flash alone hides an otherwise visible next letter and remains static under reduced motion", () => {
  const c = pipRendererSandbox(60);
  pressMainStreak(c, 16);
  c.step(15.6); // The next MAIN is in focus, while the previous set's one-second flash is still alive.
  assert.equal(c._hitNote, -1, "the ordinary consumed-note glyph gate is no longer active");
  const normal = c.draw();
  assert.equal(normal.glyph.on, false, "the numeral itself suppresses the next required letter");
  c.reduceMotion = true;
  const reduced = c.draw();
  assert.deepEqual(reduced.pips, normal.pips);
  assert.deepEqual(reduced.numerals, normal.numerals, "reduced motion preserves the same static numeral");
  assert.equal(reduced.glyph.on, false);
  c.step(16.001);
  assert.equal(c.draw().numerals.length, 0);
  assert.equal(c.draw().glyph.on, true, "the pending main letter returns when the set flash expires");
});

test("on-beat pips: an unresolved main clears a partial set and warns an earned full set", () => {
  for (const count of [15, 16]) {
    const c = pipRendererSandbox();
    pressMainStreak(c, count);
    assert.equal(c.draw().pips.length, count, "the earned set is visible before the miss");
    c.step(count); c.step(count + .6);
    if (count === 16) {
      assert.equal(c._wasdCombo, 16);
      assert.equal(c._pipSetN, 1);
      assert.equal(c._streakNotice.kind, "warning");
      assert.equal(c._streakNotice.misses, 1);
      c.step(count + 1); c.step(count + 1.6);
      assert.equal(c._streakNotice.kind, "ended");
      assert.equal(c._streakNotice.hits, 16);
    }
    assert.equal(c._wasdCombo, 0);
    assert.equal(c._pipSetN, 0);
    assert.equal(c._pipSetFlashT, -999);
    assert.equal(c.draw().pips.length, 0);
    assert.equal(c.draw().numerals.length, 0, "a miss cannot leave a completed-set numeral behind");
  }
});

test("on-beat pips: target-free silent sweeps warn, then end a completed set", () => {
  const c = pipRendererSandbox();
  c.CFG.groovePocket = true;
  pressMainStreak(c, 16);
  c._beats = 16.7;
  c.state.t = (c._beats + .5) * 60 / c.state.bpm;
  c.updatePocketMisses(); // No animation resolution step and no input are needed for this path.
  assert.equal(c._wasdCombo, 16);
  assert.equal(c._pipSetN, 1);
  assert.equal(c._streakNotice.kind, "warning");
  assert.equal(c._streakNotice.misses, 1);
  c.updatePocketMisses();
  assert.equal(c._streakNotice.misses, 1, "repeated frames cannot count the same missed main twice");
  c._beats = 17.7;
  c.state.t = (c._beats + .5) * 60 / c.state.bpm;
  c.updatePocketMisses();
  assert.equal(c._wasdCombo, 0);
  assert.equal(c._pipSetN, 0);
  assert.equal(c._pipSetFlashT, -999);
  assert.equal(c._streakNotice.kind, "ended");
  assert.equal(c._streakNotice.hits, 16);
  assert.equal(c.draw().pips.length, 0);
  assert.equal(c.draw().numerals.length, 0);
});

test("on-beat pips: wrong keys, weak credit and zero-credit mains preserve one earned-set warning", () => {
  for (const failure of ["wrong key", "weak credit", "zero credit"]) {
    const c = pipRendererSandbox();
    pressMainStreak(c, 16);
    c.step(16);
    const w = 60 / c.state.bpm * c.CFG.wasdWindowFrac;
    if (failure === "wrong key") c.wasdLanePress(1);
    else if (failure === "weak credit") c._wasdResolve(0, true, w, { fullCredit: false, weakAcc: .25 });
    else c._wasdResolve(w + .001, true, w);
    assert.equal(c._wasdCombo, 16, failure);
    assert.equal(c._pipSetN, 1, failure);
    assert.equal(c._streakNotice.kind, "warning", failure);
    assert.equal(c._streakNotice.misses, 1, failure);
    if (failure !== "wrong key") c._resolved.add(16); // The real claim reserves this main before calling _wasdResolve.
    c.step(17);
    if (failure === "wrong key") c.wasdLanePress(2);
    else if (failure === "weak credit") c._wasdResolve(0, true, w, { fullCredit: false, weakAcc: .25 });
    else c._wasdResolve(w + .001, true, w);
    assert.equal(c._wasdCombo, 0, failure);
    assert.equal(c._pipSetN, 0, failure);
    assert.equal(c._pipSetFlashT, -999, failure);
    assert.equal(c._streakNotice.kind, "ended", failure);
    assert.equal(c._streakNotice.hits, 16, failure);
    assert.equal(c.draw().pips.length, 0, failure);
    assert.equal(c.draw().numerals.length, 0, failure);
  }
});

test("streak warning: a wrong accepted key, duplicates and its later pocket sweep count one miss", () => {
  const c = bonusAccessSandbox(); c.CFG.groovePocket = true;
  pressMainStreak(c, 16);
  c.step(16); c.wasdLanePress(1);
  assert.equal(c._streakNotice.misses, 1);
  assert.equal(c._wasdCombo, 16);
  c.wasdLanePress(1); c.wasdLanePress(0);
  assert.equal(c._streakNotice.misses, 1, "neither a repeated wrong key nor a rescue duplicate gets another claim");
  c.step(16.7); c.updatePocketMisses();
  assert.equal(c._streakNotice.misses, 1, "the stable main id excludes the accepted miss from silent scoring");
  assert.equal(c._wasdCombo, 16);
  c.step(17); c.wasdLanePress(1);
  assert.equal(c._streakNotice.misses, 0);
  assert.equal(c._streakNotice.kind, "");
  assert.equal(c._wasdCombo, 17, "a correct next main restores the streak without losing earned hits");
  c.step(18.7);
  assert.equal(c._streakNotice.kind, "warning", "a later isolated miss gets a fresh warning");
  assert.equal(c._streakNotice.misses, 1);
});

test("streak warning: a legal layback hit survives the legacy midpoint departure without a premature miss", () => {
  const c = bonusAccessSandbox(); c.CFG.groovePocket = true;
  pressMainStreak(c, 16);
  c.pocketSetExpected("layback");
  c.step(16); c.step(16.5);
  assert.equal(c._streakNotice.misses, 0, "the next focused letter cannot close the older legal pocket window");
  assert.equal(c._wasdCombo, 16);
  c.step(16.6); c.wasdLanePress(0);
  assert.ok(c._tapAcc > 0, "0.6 beats is still inside the learned layback accuracy window");
  assert.equal(c._wasdCombo, 17);
  assert.equal(c._streakNotice.kind, "");
  c.step(16.7);
  assert.equal(c._wasdCombo, 17);
  assert.equal(c._streakNotice.misses, 0);
});

test("streak warning: optional wrong keys and unclaimed presses cannot spend or restore protection", () => {
  const c = bonusAccessSandbox();
  pressMainStreak(c, 16);
  c.step(16); c.wasdLanePress(1);
  assert.equal(c._streakNotice.misses, 1);
  c.step(16.5); c.wasdLanePress(0);
  assert.equal(c._streakNotice.misses, 1, "a midpoint with no live note remains ignored");
  c.wasdNoteDiv = () => 2; // Explicit legacy density probe; live play remains one main per beat.
  c.wasdLanePress(2); // ci=33 asks for lane 1 and is optional.
  assert.equal(c._streakNotice.misses, 1, "an accepted optional wrong key cannot consume main protection");
  assert.equal(c._wasdCombo, 16);
  assert.equal(c._pipSetN, 1);
  c._beats = 17.5; c.wasdLanePress(3); // ci=35 is an optional success; isolate its claim from unplayed intervening mains.
  assert.equal(c._streakNotice.misses, 1, "an optional success cannot reset the main warning chain");
  assert.equal(c._streakNotice.kind, "warning");
});

test("streak warning: flick ownership skips mains and pause time never manufactures a second strike", () => {
  const c = bonusAccessSandbox(); c.CFG.groovePocket = true;
  pressMainStreak(c, 16); c.step(16.7);
  assert.equal(c._streakNotice.misses, 1);
  c.state.running = false;
  for (let frame = 0; frame < 5; frame += 1) c.updatePocketMisses();
  assert.equal(c._streakNotice.misses, 1);
  c.state.running = true;
  c.bonusActive = true; c.step(21.7);
  assert.equal(c._streakNotice.misses, 1, "bonus-owned mains do not spend normal streak protection");
  c.bonusActive = false;
  c.step(22); c.wasdLanePress(2);
  assert.equal(c._wasdCombo, 17);
  assert.equal(c._streakNotice.misses, 0);
  assert.equal(c._streakNotice.kind, "");
});

test("streak ending keeps the exact credited-main total while a new ring starts", () => {
  const c = bonusAccessSandbox(); c.CFG.groovePocket = true;
  pressMainStreak(c, 16); c.step(16.7);
  pressMainStreak(c, 3, 17);
  assert.equal(c._wasdCombo, 19, "forgiven silence adds no credit and loses no prior correct hit");
  c.step(20.7); c.step(21.7);
  assert.equal(c._wasdCombo, 0);
  assert.equal(c._streakNotice.kind, "ended");
  assert.equal(c._streakNotice.hits, 19);
  const endedAt = c._streakNotice.at;
  c.step(22); c.wasdLanePress(2);
  assert.equal(c._wasdCombo, 1);
  assert.equal(c._streakNotice.kind, "ended");
  assert.equal(c._streakNotice.hits, 19, "a new streak cannot overwrite the previous result");
  assert.equal(c._streakNotice.at, endedAt, "the new hit cannot extend the ending notice");
});

test("on-beat pips: initialization, a new session and a disabled lane start without inherited set state", () => {
  const initial = /\blet _combo=[^\n]+/.exec(html);
  assert.ok(initial, "the real WASD state declaration is present");
  const defaults = vm.createContext({});
  vm.runInContext(initial[0].replace(/^let /, "var "), defaults);
  assert.deepEqual([defaults._wasdCombo, defaults._pipSetN, defaults._pipSetFlashT], [0, 0, -999]);
  for (const reset of ["session", "disabled lane"]) {
    const c = pipRendererSandbox();
    pressMainStreak(c, 16);
    c.wasdStreakMiss();
    assert.equal(c._streakNotice.kind, "warning");
    if (reset === "session") c.resetWasdSession();
    else { c.strobe = false; c.step(15); }
    assert.equal(c._wasdCombo, 0, reset);
    assert.equal(c._pipSetN, 0, reset);
    assert.equal(c._pipSetFlashT, -999, reset);
    assert.deepEqual({ ...c._streakNotice }, { misses: 0, kind: "", at: -999, hits: 0 }, reset);
    assert.equal(c.draw().pips.length, 0, reset);
    assert.equal(c.draw().numerals.length, 0, reset);
  }
});

test("on-beat pips: lessons and a hidden beat circle suppress pips and numerals independently of stale main state", () => {
  const c = pipRendererSandbox(60);
  pressMainStreak(c, 16);
  c.step(15.6);
  c.trainMode = true;
  assert.equal(c.draw().pips.length, 0, "lesson rendering never borrows a free-play pip ring");
  assert.equal(c.draw().numerals.length, 0, "lesson rendering never borrows a free-play set flash");
  assert.equal(c.draw().glyph.on, true, "the lesson's required letter is still shown");
  c.trainMode = false;
  c.CFG.wasdHud = false;
  assert.equal(c.draw().pips.length, 0);
  assert.equal(c.draw().numerals.length, 0);
  assert.equal(c.draw().glyph.on, true, "a hidden canvas cannot hide the letter for an invisible numeral");
  c.CFG.wasdHud = true;
  c.state.t = c._pipSetFlashT - .001;
  assert.equal(c.draw().numerals.length, 0, "a clock rebase before the recorded flash cannot resurrect it");
});

test("early music: rewarded shooting reaches full music equally at 28 and 60 BPM and remains bounded", () => {
  const outcomes = [];
  for (const bpm of [28, 60]) {
    const c = bonusAccessSandbox(bpm);
    c.state.streak = 3; c.state.hits = 12; c.accuracy = .8;
    const rise = Array.from({ length: 4 }, () => c.rewardStep());
    assert.ok(Math.abs(rise[0].target - 3) < 1e-12, "three streak, twelve hits and 80% accuracy earn the full target");
    assert.ok(Math.abs(rise[0].groove - 1.5) < 1e-12, "the existing rise smoothing remains gradual");
    assert.equal(rise.at(-1).tier, 3);
    c.state.streak = 300; c.state.hits = 1200; c.accuracy = 1; c._wasdCombo = 100;
    for (let i = 0; i < 20; i += 1) {
      const result = c.rewardStep();
      assert.equal(result.target, 3, "extra shooting and bonus credit cannot create a higher tier");
      assert.ok(result.groove <= 3 && result.tier <= 3);
    }
    c.grooveI = 3; c.state.streak = 0; c.state.hits = 0; c.accuracy = null; c._wasdCombo = 0;
    assert.equal(c.rewardStep().groove, 2.7, "the existing slow reward decay remains intact");
    assert.equal(c.state.bpm, bpm, "musical reward evaluation does not advance combat tempo");
    outcomes.push(rise.map(({ target, groove, tier }) => ({ target, groove, tier })));
  }
  assert.deepEqual(outcomes[0], outcomes[1], "music access is independent of the combat tempo ladder");
});

test("THE MEANING: the note lane stands down on the flag that DRAWS the lane, and only then (S)", () => {
  // A cue may be MOVED into the world, never merely deleted from the crosshair. THE RIVER shipped ROAD_LANE_READY=false
  // because it carried no required-lane channel; THE MEANING draws the band tint AND the mid-band glyph, so the switch is
  // now bound to the very CFG flag that draws them. Bound, not merely flipped: bandGlyphs:false must put the centre letter
  // straight back, in the same read, with no second place to forget.
  assert.match(html, /const ROAD_LANE_READY=!!\(CFG\.road && CFG\.road\.bandGlyphs\) && ROAD_GLYPH_PASS;/, "the switch IS the draw flags — both of them");
  assert.match(html, /uGlyphOn:\{value:\(CFG\.road\.bandGlyphs\?1:0\)\}/, "…and that same flag is what the shader gates the glyph on");
  // PARCEL W (SPEC_MOONLINE §1's cue contract): the Moonline's road is COLOUR-ONLY, so the ribbon compiles no glyph pass on
  // ANY tier — and because ROAD_LANE_READY is BOUND to the emitter's own boolean rather than flipped by hand, that one const
  // is the whole of "the letter comes back to the crosshair". There is no second place to remember.
  assert.match(html, /const ROAD_GLYPH_PASS=!ML_RIBBON;/, "the ribbon never carries the letter; wave 7 always does");
  assert.match(html, /\.\.\.\(ROAD_GLYPH_PASS \? \[/, "…and dropped by not EMITTING the text, which is the only way to shed a dependent texture fetch");
  assert.match(html, /const laneCue=!\(roadLive\(\) && ROAD_LANE_READY\);/, "the lane stands down on the road CARRYING it, not merely on the road existing");
  // The centre-cue gate's three clauses, verbatim — the truth table below is a transcription of exactly this text.
  assert.match(html, /&& \(CFG\.wasdHud \|\| \(CFG\.wasdTapText && !laneCue\) \|\| \(\(CFG\.wasdLetter \|\| reduceMotion\) && laneCue\)\);/, "the centre-cue gate is the three-clause one");
  // 32-way sweep over (wasdHud, wasdTapText, wasdLetter, reduceMotion, laneCue). With laneCue TRUE — the trainer, the
  // Temple, bandGlyphs:false and EVERY configuration under road.on:false — the gate must still reduce to the pre-road one.
  let standDowns = 0;
  for (let bits = 0; bits < 32; bits += 1) {
    const wasdHud = !!(bits & 1), wasdTapText = !!(bits & 2), wasdLetter = !!(bits & 4), reduceMotion = !!(bits & 8), laneCue = !(bits & 16);
    const now = wasdHud || (wasdTapText && !laneCue) || ((wasdLetter || reduceMotion) && laneCue);
    const shipped = wasdHud || wasdLetter || reduceMotion;
    if (laneCue) assert.equal(now, shipped, `centre-cue gate unchanged for bits ${bits}`);
    else {
      // Lane carried by the road: the LETTER term is gone and nothing else is. The circle and the readout keep their own
      // opt-ins, so an explicitly enabled cue is never collateral damage of the day the lane moved into the world.
      assert.equal(now, wasdHud || wasdTapText, `only the letter term stands down for bits ${bits}`);
      if (shipped && !now) standDowns += 1;
    }
  }
  assert.ok(standDowns > 0, "the shipped default (wasdHud:false, wasdTapText:false, wasdLetter:true) is a configuration that actually stands the letter down");
});

test("THE MEANING: every band channel is a pure read of the state the game plays (S)", () => {
  const cfg = extractCfg();
  const context = vm.createContext({ Math, Number, CFG: cfg });
  vm.runInContext(`${extractFunction("roadTideAt")}; const _roadTide0={m:0,i:1}, _roadTideR={m:0,i:1};`, context);
  const tideAt = (n) => {
    const r = vm.runInContext(`roadTideAt(${n})`, context);
    return { m: r.m, i: r.i };
  };
  // ONE CLOCK: replay onGrid's OWN tide expression on the eighth counter and demand agreement at every band edge.
  const TD = cfg.tide, rise = TD.riseBars, peak = TD.peakBars, cyc = rise + peak + TD.mercyBars;
  for (let g = 0; g < 8 * cyc * 6; g += 2) {
    const bar = Math.floor(g / 8), cb = bar % cyc, f = (g % 8) / 8;
    const mercy = cb >= rise + peak;
    const i = mercy ? 0 : (cb < rise ? (cb + f) / rise : 1);
    const road = tideAt(g / 2);
    assert.equal(road.m > 0, mercy, `mercy agrees at eighth ${g}`);
    assert.equal(road.i, i, `tideI agrees at eighth ${g}`);
  }
  // The mercy BAR is one wide band: exactly one of its four beats keeps its "1" (m=1) and the rest swallow theirs (m=2).
  const first = (rise + peak) * 4;
  assert.equal(tideAt(first).m, 1, "the mercy bar's downbeat keeps its own edge");
  for (let k = 1; k < 4; k += 1) assert.equal(tideAt(first + k).m, 2, `mercy beat ${k} is swallowed into the wide band`);
  assert.equal(tideAt(first - 1).m, 0, "the beat before mercy is an ordinary crest band");
  // Every tank figure value is a multiple of 4, so a fill gate is EXACTLY one band edge and never a smear across one.
  for (const fig of [cfg.tank.fig2, cfg.tank.fig3]) for (const s of fig) assert.equal(s % 4, 0, `gate sixteenth ${s} lands on a whole beat`);
  // The byte packing the shader decodes has to fit in a byte at its worst case, or a channel silently eats another.
  assert.ok(3 + 4 * 2 + 12 * 2 < 256, "R = lane + 4*wake + 12*mercy fits");
  assert.ok(1 + 2 * 4 < 256, "B = fillMark + 2*hold fits");
});

test("THE MEANING: the wake's verdict is already final when a band leaves the now-line (S)", () => {
  // wasdLanePress grades with w = min(full*0.5, max(wasdWindow, full*0.4)), full = bps/nd. Over the whole reachable ladder
  // that is 0.400 note-intervals. With nd1 throughout main mode, the main at R=n-0.5 closes at R=n-0.1
  // and the next main opens at R=n+0.1. The main-note accuracy-window gap is 0.200 beat.
  const cfg = extractCfg();
  const context = vm.createContext({ Math, Number, CFG: cfg });
  vm.runInContext(extractFunction("wasdNoteDiv"), context);
  const diffT = (bpm) => Math.max(0, Math.min(1, (bpm - cfg.minBpm) / (cfg.maxBpm - cfg.minBpm)));
  let minDead = Infinity;
  for (let bpm = cfg.minBpm; bpm <= cfg.maxBpm; bpm += 0.25) {
    const nd = vm.runInContext(`wasdNoteDiv(${diffT(bpm)})`, context);
    const bps = 60 / Math.max(20, bpm), full = bps / nd;
    const w = Math.min(full * 0.5, Math.max(cfg.wasdWindow, full * cfg.wasdWindowFrac));
    const fracBeat = (w / full) / nd;                       // the window as a fraction of ONE BAND
    minDead = Math.min(minDead, (0.5 - fracBeat) * 2);
  }
  assert.ok(minDead > 0, `a dead zone exists at every reachable tempo (min ${minDead.toFixed(3)} beat)`);
  assert.equal(minDead.toFixed(3), "0.200", "the main-note accuracy-window gap is 0.200 beat throughout the reachable nd1 ladder");
  // Only a MAIN writes history: a bonus ghost is an invitation, and declining one is not a miss.
  assert.match(html, /if\(\(\(\(_hitNote%nd\)\+nd\)%nd\)!==0\) return;/, "roadWakeLatch ignores in-between notes");
  assert.match(html, /_roadWake\[\(\(n%ROAD_WAKE\)\+ROAD_WAKE\)%ROAD_WAKE\] = judged \? \(_roadHitBeat===n \? 1 : 2\) : 0;/, "landed = the lane's own _hitNote, reduced to its main beat");
});

// ---------------------------------------------------------------------------------------------------------------------
// THE PLAYABILITY EPOCH (SPEC_STAR_ROAD v1.2 amendment - THE WAKE RECORDS ONLY JUDGED BEATS).
// A beat gets a hit/miss verdict IFF the lane was live and judging when THAT BEAT passed; everything else is NEUTRAL (0).
// ---------------------------------------------------------------------------------------------------------------------

const ROAD_JUDGE_BOUNDS = (() => {
  const found = /const ROAD_JUDGE_IN=([\d.]+), ROAD_JUDGE_OUT=([\d.]+);/.exec(html);
  assert.ok(found, "the epoch's window boundaries are declared as flat named constants");
  return { in: Number(found[1]), out: Number(found[2]) };
})();

function loadWakeSandbox() {
  // The wake ring, the epoch pair and the four functions that move them - lifted verbatim out of index.html, so this
  // sandbox can never drift from the shipped code. ROAD_WAKE is pinned at its shipped 14 (it only sizes the ring).
  const context = vm.createContext({ Math, Number, Uint8Array, console });
  const prelude = `
    var ROAD_WAKE = 14;
    var ROAD_JUDGE_IN = ${ROAD_JUDGE_BOUNDS.in}, ROAD_JUDGE_OUT = ${ROAD_JUDGE_BOUNDS.out};
    var CFG = { wasdRhythm: true };
    var BOW = { IDLE: 0, GRACE: 1, LAST: 2, RIT: 3, HOLD: 4 };
    var _bow = { stage: 0 };
    var state = { running: false };
    var toneReady = true, templeActive = false, trainMode = false, bonusActive = false;
    var _roadWake = new Uint8Array(ROAD_WAKE);
    var _roadWakeTo = -1e9, _roadWakeFrom = 1e9, _roadHitBeat = -1e9, _roadBeat0 = NaN, _roadLastR = -1e9;
    var _roadJudged = false, _roadEpoch = Infinity, _roadEpochEnd = Infinity;
  `;
  const source = ["roadJudging", "roadJudgeStamp", "roadWakeReset", "roadWakeAt", "roadWakeWrite"]
    .map((name) => extractFunction(name))
    .join("\n");
  vm.runInContext(prelude + source, context);
  context.read = (expression) => vm.runInContext(expression, context);
  context.write = (statement) => vm.runInContext(statement, context);
  // ONE FRAME OF roadSync, in its shipped order: the not-live early return stamps at the last beat the road saw, and the
  // live path resets on a backwards clock, stamps, then backfills every band that left the now-line. The regexes below
  // pin that this driver still IS roadSync; if the shipped order moves, this test fails instead of quietly lying.
  context.frame = (r, live) => vm.runInContext(`(function(){
    if(!${live}){ roadJudgeStamp(_roadLastR); return; }
    if(${r} < _roadLastR - 0.5) roadWakeReset();
    _roadLastR = ${r};
    roadJudgeStamp(${r});
    var n0 = Math.floor(${r});
    if(n0 !== _roadBeat0){
      if(Number.isFinite(_roadBeat0)) for(var n = Math.max(_roadBeat0, n0 - ROAD_WAKE); n < n0; n++) roadWakeWrite(n);
      _roadBeat0 = n0;
    }
  })();`, context);
  return context;
}

test("THE PLAYABILITY EPOCH: the driver above is roadSync's own order (v1.2)", () => {
  assert.match(html, /if\(!live\)\{ roadJudgeStamp\(_roadLastR\); return; \}/, "not-live shuts the window at the last beat the road saw");
  assert.match(html, /if\(r<_roadLastR-0\.5\)\{ roadWakeReset\(\);/, "a backwards clock still empties the ring first");
  assert.match(html, /_roadLastR=r;\s*\n\s*roadJudgeStamp\(r\);/, "…then the stamp, BEFORE any write");
  assert.match(html, /if\(Number\.isFinite\(_roadBeat0\)\) for\(let n=Math\.max\(_roadBeat0, n0-ROAD_WAKE\); n<n0; n\+\+\) roadWakeWrite\(n\);/, "…then the catch-up backfill");
  // The verdict is the BEAT'S OWN playability, never the write moment's - that conflation was the whole root cause.
  assert.match(html, /const judged=\(n>=_roadEpoch && n<_roadEpochEnd\);/, "roadWakeWrite consults the epoch window");
  const write = extractFunction("roadWakeWrite");
  assert.doesNotMatch(write, /trainMode|templeActive|state\.running|_bow\.|bonusActive/, "…and reads no write-moment state at all");
  // Zero per-frame allocations: the ordinary frame is one boolean compare and a return.
  const stamp = extractFunction("roadJudgeStamp");
  assert.doesNotMatch(stamp, /new |\[\]|\{\}|push\(/, "the stamp allocates nothing");
  assert.match(stamp, /const j=roadJudging\(\); if\(j===_roadJudged\) return;/, "…and leaves on the first compare when nothing changed");
  assert.match(html, /function roadWakeReset\(\)\{[^\n]*_roadJudged=false; _roadEpoch=Infinity; _roadEpochEnd=Infinity; \}/, "a new run forgets the epoch with the ring");
});

test("THE PLAYABILITY EPOCH: roadJudging names every state that rejects lane input (v1.2)", () => {
  const context = loadWakeSandbox();
  context.write("state.running = true;");
  assert.equal(context.read("roadJudging()"), true, "a live post-graduation run is judging");
  // Every guard wasdLanePress takes before it will claim a note, plus the trainer the road is gated out of.
  for (const [statement, why] of [
    ["state.running = false", "a pause"],
    ["toneReady = false", "no audio clock"],
    ["templeActive = true", "the Temple"],
    ["trainMode = true", "the trainer"],
    ["bonusActive = true", "the rail-flick bonus (a tap is a LOCK, not a claim)"],
    ["_bow.stage = BOW.LAST", "the Bow from Last Light"],
    ["_bow.stage = BOW.RIT", "the Bow's ritardando"],
    ["_bow.stage = BOW.HOLD", "the Bow's Mandala"],
    ["CFG.wasdRhythm = false", "the lane's own kill-switch"],
  ]) {
    const probe = loadWakeSandbox();
    probe.write("state.running = true;");
    probe.write(`${statement};`);
    assert.equal(probe.read("roadJudging()"), false, `${why} is not judging`);
  }
  // GRACE is deliberately NOT in the predicate: it still accepts input, so a grace-cancel is a no-op, not a re-open.
  const grace = loadWakeSandbox();
  grace.write("state.running = true; _bow.stage = BOW.GRACE;");
  assert.equal(grace.read("roadJudging()"), true, "the Bow's grace window is still play");
  assert.match(html, /_bow\.stage<BOW\.LAST/, "the predicate opens the door exactly where wasdLanePress closes it");
  assert.match(html, /if\(_bow\.stage>=BOW\.LAST\) return;\s+\/\/ the ceremony owns the field from Last Light on/, "…which is the lane's own guard");
});

test("THE PLAYABILITY EPOCH W1: the trainer's beats come back NEUTRAL, not as post-graduation misses (v1.2)", () => {
  const context = loadWakeSandbox();
  // 1. The gate screen. The road is live (no trainer, no Temple) but nothing is running, so nothing is judged.
  context.frame(0, true);
  assert.equal(context.read("_roadJudged"), false, "the menu judges nothing");
  assert.equal(context.read("_roadBeat0"), 0, "…but the road has already latched a beat, which is what W1 fed on");
  // 2. Fourteen beats of lesson. roadLive() is false for the whole trainer, so roadSync never reaches a write.
  context.write("state.running = true; trainMode = true;");
  for (let r = 0.5; r < 14.4; r += 0.5) context.frame(r, false);
  assert.equal(context.read("_roadBeat0"), 0, "the trainer left the road's beat exactly where the menu did");
  // 3. GRADUATION mid-beat 14 (setTrainPhase(3) clears trainMode; the very next frame is live and catches up).
  context.write("trainMode = false;");
  context.frame(14.3, true);
  assert.equal(context.read("_roadEpoch"), 15, "the epoch stamps at ceil(14.3 - 0.1): beat 14's claim window was already open");
  for (let n = 0; n <= 13; n += 1) assert.equal(context.read(`roadWakeAt(${n})`), 0, `lesson beat ${n} is NEUTRAL road, not a miss`);
  // 4. Beat 14 straddled the graduation: it was never wholly yours to play, so it stays neutral too.
  context.frame(15.0, true);
  assert.equal(context.read("roadWakeAt(14)"), 0, "the graduation beat itself is NEUTRAL");
  // 5. The FIRST fully post-graduation beat is judged - landed…
  context.write("_roadHitBeat = 15;");
  context.frame(16.0, true);
  assert.equal(context.read("roadWakeAt(15)"), 1, "beat 15 is the first judged beat and it landed");
  // …and a real miss right after it is still a real miss.
  context.write("_roadHitBeat = -1e9;");
  context.frame(17.0, true);
  assert.equal(context.read("roadWakeAt(16)"), 2, "a beat you were offered and dropped still goes dark");
});

test("THE PLAYABILITY EPOCH W2: the Bow's ceremony is NEUTRAL and the run's real wake survives to the card (v1.2)", () => {
  const context = loadWakeSandbox();
  context.write("state.running = true;");
  context.frame(200.0, true);
  assert.equal(context.read("_roadEpoch"), 200, "judging opens at ceil(200.0 - 0.1)");
  // Two real verdicts, earned: beat 200 landed, beat 201 was dropped.
  context.write("_roadHitBeat = 200;");
  context.frame(201.0, true);
  context.write("_roadHitBeat = -1e9;");
  context.frame(202.0, true);
  assert.equal(context.read("roadWakeAt(200)"), 1);
  assert.equal(context.read("roadWakeAt(201)"), 2);
  // The Bow COMMITS -> GRACE. Input is still accepted here, so nothing about the wake moves…
  context.write("_bow.stage = BOW.GRACE;");
  context.frame(202.4, true);
  assert.equal(context.read("_roadJudged"), true, "grace is still play");
  assert.equal(context.read("_roadEpochEnd"), Infinity, "…so the window never closed");
  // …and a GRACE-CANCEL (bowTouch) resumes play seamlessly: not one stamp, because the predicate never flipped.
  context.write("_bow.stage = BOW.IDLE;");
  context.frame(202.8, true);
  assert.equal(context.read("_roadEpoch"), 200, "the epoch is untouched by a cancelled Bow");
  assert.equal(context.read("_roadEpochEnd"), Infinity);
  // The real thing: bowEnterLast at r = 203.6. Input rejection begins, the Transport keeps advancing.
  context.write("_bow.stage = BOW.LAST; _roadHitBeat = 202;");
  context.frame(203.6, true);
  assert.equal(context.read("_roadEpochEnd"), 203, "the window closes at floor(203.6 - 0.9) + 1");
  assert.equal(context.read("roadWakeAt(202)"), 1, "beat 202's window shut BEFORE the commit, so its verdict stands");
  // Every ceremony beat from here is neutral - the road behind you reads as unplayed, never as a wall of misses.
  context.write("_roadHitBeat = -1e9;");
  for (const r of [204.0, 205.0, 206.0]) context.frame(r, true);
  for (const n of [203, 204, 205]) assert.equal(context.read(`roadWakeAt(${n})`), 0, `ceremony beat ${n} is NEUTRAL`);
  assert.equal(context.read("roadWakeAt(200)"), 1, "and the run's real wake is still there when the Night Card is taken");
  assert.equal(context.read("roadWakeAt(201)"), 2);
});

test("THE PLAYABILITY EPOCH: the window's edges are the lane's OWN claim window (v1.2)", () => {
  // Beat n's note sits at R = n + 0.5 and stays claimable for w = 0.4 note-intervals either side (the dead-zone proof
  // above), so beat n is playable exactly over R in [n + 0.1, n + 0.9]. The epoch's arithmetic is that interval, nothing
  // tuned: judging opening at r admits beats from ceil(r - 0.1); closing at r keeps beats below floor(r - 0.9) + 1.
  assert.equal(ROAD_JUDGE_BOUNDS.in, 0.1);
  assert.equal(ROAD_JUDGE_BOUNDS.out, 0.9);
  const open = (r) => Math.ceil(r - ROAD_JUDGE_BOUNDS.in);
  const end = (r) => Math.floor(r - ROAD_JUDGE_BOUNDS.out) + 1;
  assert.equal(open(100.0), 100, "opening exactly on a band edge admits that band");
  assert.equal(open(100.1), 100, "…and so does opening at the instant its window opens");
  assert.equal(open(100.4), 101, "opening mid-window forfeits that band");
  assert.equal(end(100.9), 101, "closing at the instant a window shuts keeps that band");
  assert.equal(end(100.95), 101, "…and so does closing just after");
  assert.equal(end(100.5), 100, "closing mid-window forfeits that band");
  // The two edges agree: a window that opens and shuts at the same instant judges nothing.
  for (let r = 100; r < 101; r += 0.05) assert.ok(end(r) <= open(r), `no beat is judged by a zero-length window at ${r.toFixed(2)}`);
  // reduceMotion is untouched by any of this: the wake is static history on both paths.
  const sync = extractFunction("roadSync");
  assert.ok(sync.indexOf("roadJudgeStamp(r);") < sync.indexOf("U.uPulse.value="), "the stamp runs before the still-road path pulses and returns");
});

test("THE MEANING: road.on:false restores the noise dolly and the whole parcel goes quiet (S)", () => {
  // Raw-boolean-first at every site. roadLive() reads CFG.road.on before anything else, so with the road off the dolly
  // takes the shipped branch on the shipped arguments, the bank is identically 0, and no texture/uniform/call exists.
  assert.match(html, /function roadLive\(\)\{ return !!\(CFG\.road && CFG\.road\.on\) && !trainMode && !templeActive; \}/, "the kill-switch is the first read");
  assert.match(html, /if\(roadLive\(\)\)\{ {3}\/\/ COURSE-DRIVEN BANKING/, "the course branch is gated on it");
  assert.match(html, /\} else if\(CFG\.dollyHuman\)\{/, "…and the SENSEI noise branch is still the next one");
  assert.match(html, /let _dollyY=0, _dollyP=0, _dollyR=0;/, "the bank starts at zero every frame");
  assert.match(html, /camera\.rotation\.set\(pitch\+recoilPitch\+shP\+_dollyP, yaw\+recoilYaw\+shY\+_dollyY, shR\+_dollyR, 'YXZ'\)/, "the bank rides the roll slot the trauma shake already owns");
  assert.match(html, /if\(!\(CFG\.road && CFG\.road\.on\)\) return;/, "buildRoad still compiles nothing with the road off");
  // The hold scaffold proves a RENDER capability and nothing else: a pure function of the beat index, behind its own flag.
  assert.match(html, /if\(!\(CFG\.road && CFG\.road\.holdDemo\)\) return 0;/, "the hold scaffold reads its raw flag first");
  const hold = extractFunction("roadHoldAt");
  assert.doesNotMatch(hold, /state\.|targets|_resolved|_hitNote|rnd\(|Math\.random|score|streak/, "the hold scaffold reads no gameplay state at all");
  const cfg = extractCfg();
  assert.equal(cfg.road.holdDemo, false, "and it ships off");
  assert.equal(cfg.road.on, true);
  assert.equal(cfg.road.bandGlyphs, true);
  assert.equal(cfg.road.fillMark, true);
  assert.equal(cfg.road.mercyBoost, 1.6);
  assert.equal(cfg.road.lookAheadBeats, 8);
  assert.equal(cfg.road.widthM, 14);
});

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

// ---------------------------------------------------------------------------------------------------------------------
// THE MOONLINE — THE VOID (SPEC_MOONLINE §2, wave 8 parcel T).
// Post-graduation play has no room: the ground plane, the ground fog and the horizon haze go, the Temple's celestial
// shell wraps the player above AND below, and graduation dissolves the floor over the Temple's own floorDissolveSec.
// The master kill-switch (moonline.on:false) must restore wave-7 rendering EXACTLY, and the trainer keeps today's room.
// ---------------------------------------------------------------------------------------------------------------------

function loadVoidSandbox(overrides) {
  // The parcel's whole state and every function that touches it, lifted verbatim out of index.html so this sandbox can
  // never drift from the shipped code. The scene objects are the smallest stand-ins the writes actually need.
  const context = vm.createContext({ Math, Number, console });
  const prelude = `
    var CFG = { moonline:{ on:true, shellOpacity:1, fogDensity:0, domeCull:true }, road:{ on:true }, skyTemple:{ floorDissolveSec:0.8 } };
    var trainMode = false, templeActive = false, state = { running:true };
    var _mlBlend = 0, _mlGrad = 0, _mlAir = 0, _mlDome = false;
    var _milkyReady = true;
    var milkyShell = { visible:true, material:{ opacity:1 } };
    var skyDome = { visible:true }, baseFloor = { visible:true };
    var scene = { fog:{ density:0.012 } };
    var skyDomeMat = { uniforms:{ uHazeAmt:{ value:1 } } };
    ${overrides || ""}
  `;
  const source = ["setScalarCached", "moonlineOn", "moonlineOwns", "moonlineVoid", "moonlineWarmShell",
    "moonlineDissolveSec", "moonlineGraduate", "moonlineStep", "moonlineHideRoom"]
    .map((name) => extractFunction(name))
    .join("\n");
  vm.runInContext(prelude + source, context);
  context.read = (expression) => vm.runInContext(expression, context);
  context.write = (statement) => vm.runInContext(statement, context);
  return context;
}

test("THE VOID: CFG.moonline is a flat literal whose master switch is read first", () => {
  const cfg = html.match(/moonline\s*:\s*\{[^}]+\}/);
  assert.ok(cfg, "CFG.moonline exists as a flat (nested-brace-free) literal");
  for (const contract of [/on\s*:\s*true/, /shellOpacity\s*:\s*1\b/, /fogDensity\s*:\s*0\b/, /domeCull\s*:\s*true/])
    assert.match(cfg[0], contract);
  // Raw-boolean-first, and the ROAD's own switch outranks this parcel: the Moonline is the road.
  assert.match(html, /function moonlineOn\(\)\{ return !!\(CFG\.moonline && CFG\.moonline\.on\) && !!\(CFG\.road && CFG\.road\.on\); \}/);
  assert.match(html, /function moonlineOwns\(\)\{ return moonlineOn\(\) && !trainMode; \}/);
  assert.match(html, /function moonlineVoid\(\)\{ return moonlineOwns\(\) && !templeActive; \}/);
});

test("THE VOID: the predicate ladder over every switch x state", () => {
  for (const moonline of [true, false]) for (const road of [true, false])
    for (const train of [true, false]) for (const temple of [true, false]) {
      const probe = loadVoidSandbox(`CFG.moonline.on=${moonline}; CFG.road.on=${road}; trainMode=${train}; templeActive=${temple};`);
      assert.equal(probe.read("moonlineOn()"), moonline && road, "both raw switches, and only them");
      assert.equal(probe.read("moonlineOwns()"), moonline && road && !train,
        "the WORLD is the void post-graduation - and the predicate is temple-BLIND, so a visit never closes it");
      assert.equal(probe.read("moonlineVoid()"), moonline && road && !train && !temple,
        "...and what we DRAW is that, minus the Temple: identically moonline.on && roadLive()");
    }
});

test("THE VOID: the blend snaps everywhere and ramps only across the graduation dissolve", () => {
  // A player who skips the trainer is in the void on frame one - no dissolve, no fade-in of a world they never left.
  const straight = loadVoidSandbox();
  straight.write("moonlineStep(1/60);");
  assert.equal(straight.read("_mlBlend"), 1, "post-graduation play opens the void immediately");
  assert.equal(straight.read("_mlGrad"), 0, "and arms nothing");

  // The trainer keeps the room, and graduation is the ONE ramp there is - over the Temple's own constant, exactly.
  const grad = loadVoidSandbox("trainMode = true;");
  grad.write("moonlineStep(1/60);");
  assert.equal(grad.read("_mlBlend"), 0, "the trainer is the room");
  assert.equal(grad.read("moonlineGraduate()"), false, "...and cannot arm the dissolve while it is still the trainer");
  grad.write("trainMode = false;");                      // setTrainPhase(3)'s own order: the flag first, the dissolve after
  assert.equal(grad.read("moonlineGraduate()"), true);
  assert.equal(grad.read("_mlGrad"), 0.8, "armed with CFG.skyTemple.floorDissolveSec - no second duration exists");
  const seen = [];
  for (let i = 0; i < 60; i++) { grad.write("moonlineStep(0.02);"); seen.push(grad.read("_mlBlend")); }
  assert.ok(seen[0] > 0 && seen[0] < 0.1, `the ramp starts at 0 (${seen[0].toFixed(3)})`);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1] - 1e-12, "and never goes backwards");
  assert.equal(seen[39].toFixed(6), "1.000000", "...reaching the void after exactly 0.8 s (40 x 0.02)");
  assert.equal(grad.read("_mlGrad"), 0, "...after which the blend is back on its snap");

  // A Temple visit mid-void holds the world open: no dip on the way in, no second dissolve on the way out.
  const visit = loadVoidSandbox();
  visit.write("moonlineStep(0.02); templeActive = true; moonlineStep(0.02);");
  assert.equal(visit.read("_mlBlend"), 1, "the Temple is a visit inside the same world");
  visit.write("templeActive = false; moonlineStep(0.02);");
  assert.equal(visit.read("_mlBlend"), 1, "...and leaving it re-enters the void whole");

  // The kill-switch never leaves 0, whatever happens to it.
  const off = loadVoidSandbox("CFG.moonline.on = false;");
  off.write("moonlineGraduate(); for(var i=0;i<200;i++) moonlineStep(0.02);");
  assert.equal(off.read("_mlBlend"), 0);
  assert.equal(off.read("_mlGrad"), 0);
});

test("THE VOID: moonlineHideRoom removes the room, and the kill-switch never touches it", () => {
  // moonline.on:false -> wave-7 rendering EXACTLY: not one write, not even the haze uniform (_mlAir starts at the 0 the room means).
  for (const off of ["CFG.moonline.on = false;", "CFG.road.on = false;", "trainMode = true;", "templeActive = true;"]) {
    const probe = loadVoidSandbox(off);
    assert.equal(probe.read("moonlineHideRoom()"), false, `${off} keeps the room`);
    assert.equal(probe.read("baseFloor.visible"), true, "the ground plane stands");
    assert.equal(probe.read("scene.fog.density"), 0.012, "the ground fog stands");
    assert.equal(probe.read("skyDomeMat.uniforms.uHazeAmt.value"), 1, "the horizon haze stands - a multiply by exactly 1.0");
    assert.equal(probe.read("skyDome.visible"), true, "and the gradient dome is never culled outside the void");
  }
  // In the void, all four go - and the fog CLEARS across the dissolve rather than snapping.
  const live = loadVoidSandbox("trainMode = true;");
  live.write("trainMode = false; moonlineGraduate(); moonlineStep(0.4);");   // half the dissolve
  assert.equal(live.read("moonlineHideRoom()"), true);
  assert.equal(live.read("baseFloor.visible"), false, "the ground plane goes on the dissolve's first frame");
  assert.equal(live.read("scene.fog.density").toFixed(5), (0.012 * 0.5).toFixed(5), "the ground fog clears WITH the blend");
  assert.equal(live.read("skyDomeMat.uniforms.uHazeAmt.value"), 0.5, "so does the horizon haze band");
  live.write("scene.fog.density = 0.012; moonlineStep(0.4); moonlineHideRoom();");
  assert.equal(live.read("_mlBlend"), 1);
  assert.equal(live.read("scene.fog.density"), 0, "...and reaches CFG.moonline.fogDensity at the end of it");
  assert.equal(live.read("skyDomeMat.uniforms.uHazeAmt.value"), 0);
  assert.equal(live.read("skyDome.visible"), false, "the dome is culled once the shell is solid - this is what pays for the shell");

  // The cull FAILS OPEN: a missing map, a failed decode or a mid-fade shell all keep the dome exactly where it was.
  for (const broken of ["_milkyReady = false;", "milkyShell = null;", "milkyShell.material.opacity = 0.6;", "CFG.moonline.domeCull = false;"]) {
    const probe = loadVoidSandbox(broken);
    probe.write("moonlineStep(0.02); moonlineHideRoom();");
    assert.equal(probe.read("skyDome.visible"), true, `${broken} keeps the gradient dome`);
    assert.equal(probe.read("baseFloor.visible"), false, "...while the void itself still holds");
  }
});

test("THE VOID: zero per-frame allocations, and no reduceMotion path at all", () => {
  for (const name of ["moonlineOn", "moonlineOwns", "moonlineVoid", "moonlineWarmShell", "moonlineStep", "moonlineHideRoom", "moonlineGraduate"]) {
    const src = extractFunction(name);
    assert.doesNotMatch(src, /new |\.push\(|=\s*\[|=>|function\s*\(/, `${name} allocates nothing on the frame path`);
    assert.doesNotMatch(src, /reduceMotion/, `${name} has no reduced-motion variant - the void is not motion (SPEC 2)`);
  }
  // The haze is a BOUNDARY write, not a per-frame one.
  assert.match(extractFunction("moonlineHideRoom"), /if\(t!==_mlAir\)\{ _mlAir=t;/);
});

test("THE VOID: every call site keeps its wave-7 expression and only RAISES it", () => {
  // updateSky: the blend is stepped beside the Temple's own, and the removals are stated after every room write.
  const update = extractFunction("updateSky");
  assert.ok(update.indexOf("moonlineStep(dt)") < update.indexOf("setHorizonOpen(skyOpen)"), "the blend is stepped before the sphere is opened");
  assert.ok(update.indexOf("updateTempleOrbs(dt)") < update.indexOf("moonlineHideRoom()"), "...and the room is removed after the shell's own opacity write, so the dome-cull reads this frame");
  assert.match(update, /baseFloor\.visible=!templeActive;/, "the ROOM's own law is untouched - the void is a pure override of it");

  // setHorizonOpen: one writer, so exitSkyTemple's setHorizonOpen(0) re-opens for the void in the same breath.
  const horizon = extractFunction("setHorizonOpen");
  assert.match(horizon, /const vd=moonlineVoid\(\);/);
  assert.match(horizon, /Math\.max\(0,Math\.min\(1, vd\?Math\.max\(amount,_mlBlend\):amount\)\)/);
  assert.match(horizon, /const open=t>=0\.5 && !vd;/, "the void opens the sphere with the DEPTH law untouched - it has no leftover floor depth, and Echoes still stand in front of the sky");

  // updateChartSky: the Temple's expression stands; the void raises it.
  const chart = extractFunction("updateChartSky");
  assert.match(chart, /hzOpen=templeActive\?1:_templeBlend;/);
  assert.match(chart, /if\(moonlineVoid\(\) && _mlBlend>hzOpen\) hzOpen=_mlBlend;/);

  // updateTempleOrbs: the shell is the Temple's own, pre-warmed, and temple-blind so a visit cannot make it dip.
  const orbs = extractFunction("updateTempleOrbs");
  assert.match(orbs, /const inVoid=moonlineOwns\(\) && _mlBlend>0\.001;/);
  assert.match(orbs, /if\(inTemple \|\| inVoid \|\| moonlineWarmShell\(\) \|\| CFG\.skyMaps\.dojoShell\) ensureMilkyShell\(\);/);
  assert.match(orbs, /if\(inVoid\) target=Math\.max\(target, _mlBlend\*\(CFG\.moonline\.shellOpacity!=null\?\+CFG\.moonline\.shellOpacity:1\)\);/);
  assert.match(orbs, /if\(inTemple\) target=_templeBlend\*\(CFG\.skyMaps\.templeShellOpacity/, "the Temple's own fade is untouched");

  // Graduation dissolves the floor, and it happens AFTER trainMode is cleared (the flag moonlineOwns reads).
  const phase = extractFunction("setTrainPhase");
  assert.ok(phase.indexOf("trainMode=false") < phase.indexOf("moonlineGraduate()"), "the dissolve arms after graduation clears the trainer");

  // Temple exit restores the room unconditionally, so the void re-takes it in the same breath (the roadHideOldFloor pattern).
  const exit = extractFunction("exitSkyTemple");
  assert.ok(exit.indexOf("baseFloor.visible=true") < exit.indexOf("moonlineHideRoom()"), "the base plane never flashes on the way out of the Temple");
  assert.match(exit, /moonlineHideRoom\(\);[\s\S]*roadHideOldFloor\(\);/);

  // The dome shader's new term is a multiply by exactly 1.0 with the parcel off.
  assert.match(html, /uTemple:\{value:0\}, uHazeAmt:\{value:1\} \}/);
  assert.match(html, /uniform float uTime,uCloud,uTemple,uHazeAmt;/);
  assert.match(html, /\*'\+\(GLOW\?'0\.62':'0\.55'\)\+'\*uHazeAmt\)/);
});

// ---------------------------------------------------------------------------------------------------------------------
// THE MOONLINE - THE RIBBON REBUILT (SPEC_MOONLINE section 3, wave 8 parcel U).
// Wave 7 keeps its MACHINERY and hands over only its PRESENTATION: a spline-mapped wireframe at 27 m to the beat, cells
// that fill with lane colour for the look-ahead, naked grid to drawBeats, the wake on the same ring and the same epoch,
// and one painted streak where the geometry has run out of pixels. moonline.on:false must compile wave 7, verbatim.
// ---------------------------------------------------------------------------------------------------------------------

const ROAD_GEOM_SRC = (() => {
  // Every ROAD_* / ML_RIBBON / _roadG declaration, lifted verbatim in file order, so this sandbox cannot drift from the
  // shipped constants. They are pure arithmetic over CFG + EYE + LOW + the camera, which is exactly what makes the
  // kill-switch checkable: run the SAME lines with the switch off and demand wave 7's numbers back.
  const lines = html.split("\n").filter((line) => /^const (ROAD_[A-Z0-9_]+|ML_[A-Z0-9_]+|_roadG)\b/.test(line.trim()));
  assert.ok(lines.length > 12, "the road's constant block is where it always was");
  return lines.map((line) => line.trim()).join("\n");
})();

function loadRoadGeom(moonline, low, widthM, rm) {
  const context = vm.createContext({
    // reduceMotion joined the sandbox in wave 8.2 (Y1): ML_DUST_N reads it, because the volumetric dust is switched OFF
    // under reduced motion at BUILD time rather than frozen in place. Defaults false = the shipped desktop path.
    Math, Number, console, EYE: 4, LOW: !!low, reduceMotion: !!rm, camera: { far: 700 },
    CFG: {
      road: { on: true, lookAheadBeats: 8, widthM: widthM == null ? 14 : widthM, bandGlyphs: true, mercyBoost: 1.6, fillMark: true, holdDemo: false },
      moonline: { on: moonline, metersPerBeat: 27, drawBeats: 32, impostorMinStraight: 0.55, impostorInk: 0.9,
        archOn: true, archHeightM: 7, archGlow: 1, archPrism: 0.35, mercyRingBoost: 1.9, reflectAlpha: 0.18, dustCount: 400, dustGlow: 0.85 },
    },
    moonlineOn: () => moonline,
  });
  vm.runInContext(ROAD_GEOM_SRC, context);
  context.read = (expression) => vm.runInContext(expression, context);
  return context;
}

test("THE RIBBON: the parcel's knobs are CFG.moonline's, flat, and the switch is moonlineOn() itself (U)", () => {
  const cfg = html.match(/moonline\s*:\s*\{[^}]+\}/);
  assert.ok(cfg, "CFG.moonline is still a flat (nested-brace-free) literal");
  for (const contract of [/metersPerBeat\s*:\s*27\b/, /drawBeats\s*:\s*32\b/, /impostorMinStraight\s*:\s*0\.55\b/, /impostorInk\s*:\s*0\.9\b/])
    assert.match(cfg[0], contract);
  // ONE build-time read of the parcel-T predicate, never a second copy of its booleans - sound because the road mesh is
  // visible exactly on the frames moonlineVoid() is true (roadLive already excludes the trainer and the Temple).
  assert.match(html, /const ML_RIBBON=moonlineOn\(\);/, "the switch IS moonlineOn()");
  assert.doesNotMatch(html, /const ML_RIBBON=!!\(CFG\.moonline/, "...and never a re-derivation of it");
});

test("THE RIBBON: every geometry constant collapses to its wave-7 value with the switch off (U)", () => {
  const off = loadRoadGeom(false), on = loadRoadGeom(true);
  // The shipped wave-7 numbers, to the double. If any of these move, the kill-switch stopped restoring wave 7.
  for (const [name, want] of [["ROAD_MPB", 10], ["ROAD_DRAW", 13.2], ["ROAD_DRAW_M", 132], ["ROAD_FADE0", 44], ["ROAD_FADE1", 132],
    ["ROAD_BEND_M", 26], ["ROAD_PLANE_W", 76], ["ROAD_PLANE_L", 280], ["ROAD_WAKE", 14], ["ROAD_SLOTS", 23],
    ["ROAD_GLYPH_S", 1], ["ROAD_GLYPH_W", 5.2], ["ROAD_GLYPH_L", 8.6], ["ROAD_GLYPH_F0", 25], ["ROAD_GLYPH_F1", 45],
    ["ROAD_FAR_ROOM", 700], ["ROAD_ALPHA", 0.55]])
    assert.equal(off.read(name), want, `${name} is wave 7's with moonline.on:false`);
  assert.equal(off.read("ROAD_DRAW"), off.read("ROAD_FADE1 / ROAD_BAND_M"), "...and dbMax is still the fade's own end, to the last bit");
  assert.equal(off.read("ROAD_MPB === ROAD_BAND_M"), true, "metres-per-beat IS the band length when the parcel is off, so every literal below it is wave 7's");
  // THE GLYPH WIDTH'S RAIL CAP IS STRUCTURAL, NOT CONTINGENT. The cap belongs to the ribbon (a 2.7x letter must not climb
  // its own rails); the off path is wave 7's literal expression, unconditionally. Before the gate the cap read on BOTH
  // paths and was inert only because 5.2 < ROAD_HALF_W*1.24 at the shipped widthM 14 - so the kill-switch's exactness
  // depended on a CFG value it does not own. Pin it at a width where the cap would have bitten.
  assert.match(html, /const ROAD_GLYPH_W=ML_RIBBON\?Math\.min\(5\.2\*ROAD_GLYPH_S, ROAD_HALF_W\*1\.24\):5\.2\*ROAD_GLYPH_S,/,
    "the rail cap is ML_RIBBON-gated like every other ROAD_* constant");
  for (const widthM of [8, 14]) {
    assert.equal(loadRoadGeom(false, false, widthM).read("ROAD_GLYPH_W"), 5.2,
      `ROAD_GLYPH_W is wave 7's 5.2 with moonline.on:false at road.widthM ${widthM}`);
    assert.equal(loadRoadGeom(false, true, widthM).read("ROAD_GLYPH_W"), 5.2, `...on LOW too, at road.widthM ${widthM}`);
  }
  assert.equal(loadRoadGeom(true, false, 8).read("ROAD_GLYPH_W"), 4.96, "...and under the ribbon the cap DOES bite at widthM 8: 62% of the road, not 5.2x2.7");
  assert.equal(loadRoadGeom(true, false, 14).read("ROAD_GLYPH_W"), 8.68, "...and 8.68 m of 14 at the shipped width");
  // ...and the ribbon's own geometry, computed rather than chosen.
  assert.equal(on.read("ROAD_MPB"), 27);
  assert.equal(on.read("ROAD_DRAW_M"), 864, "32 beats x 27 m of grid each way");
  assert.equal(on.read("ROAD_WAKE"), 14, "the wake ring is UNCHANGED - 14 beats of memory, now 378 m of road");
  assert.equal(on.read("ROAD_SLOTS"), 23, "...and so is the band table it indexes");
  assert.equal(on.read("ROAD_BEND_M"), 181, "the bend that puts the p90 lead-4 heading back on ROAD_TURN_FULL");
  assert.equal(on.read("ROAD_PLANE_W"), 386, "the smallest plane the bounded ribbon can never leave");
  assert.equal(on.read("ROAD_FAR"), 1000, "...and enough depth for a road that runs to 894 m");
  // THE LOD LADDER IS THE GEOMETRY'S, not a taste: a segment of length s at distance d subtends EYE*s/d^2.
  const K = 4 * (180 / Math.PI) * (1080 / 95);
  const dFor = (s, px) => Math.sqrt(K * s / px);
  assert.equal(on.read("ROAD_TIER_D").toFixed(6), dFor(27 / 16, 4).toFixed(6), "tier 0 dies where a SIXTEENTH is 4 px");
  for (let k = 0; k < 4; k += 1) {
    const spacing = (27 / 16) * Math.pow(4, k);
    const start = on.read("ROAD_TIER_D") * Math.pow(2, k);
    assert.equal(start.toFixed(6), dFor(spacing, 4).toFixed(6), `tier ${k} opens where its own crossbar is 4 px`);
    assert.equal((2 * start).toFixed(6), dFor(spacing, 1).toFixed(6), `...and closes where it is 1 px`);
    if (k < 3) assert.equal((2 * start).toFixed(6), dFor(spacing * 4, 4).toFixed(6), `...which is exactly where tier ${k + 1} is still 4 px`);
  }
});

test("THE RIBBON: the ONE CLOCK survives the new speed scale, by construction (U)", () => {
  // The shader's beat at u metres ahead is b = R + u/ROAD_MPB, so the NOW-LINE is u = 0 at every scale: metres-per-beat
  // cannot reach the identity, only the metres a beat occupies. Swept over the reachable ladder x latency x transport.
  const on = loadRoadGeom(true);
  const MPB = on.read("ROAD_MPB"), FREEZE = 0.5;
  let worst = 0, worstTrip = 0;
  for (const bpm of [20, 28, 33, 40, 50, 57.5, 60]) for (const lat of [0, 0.005, 0.02, 0.08, 0.25]) {
    const bps = 60 / bpm;
    for (let tp = 0; tp <= 4321.75; tp += 2.5) {
      const G = tp - lat / bps, R = G + FREEZE;
      worst = Math.max(worst, Math.abs((R - G) - FREEZE));
      for (let k = 0; k < 16; k += 5) {
        const target = Math.floor(R) + k / 16;
        worstTrip = Math.max(worstTrip, Math.abs(R + ((target - R) * MPB) / MPB - target));
      }
    }
  }
  assert.ok(worst < 1e-12, `R - G is grooveFreezePhase at every rung and latency (max residual ${worst.toExponential(2)})`);
  assert.ok(worstTrip < 1e-15, `beat -> metres -> beat through ${MPB} is exact (max ${worstTrip.toExponential(2)})`);
  assert.equal((0 / MPB).toFixed(12), "0.000000000000", "the now-line is u = 0 whatever a beat is worth in metres");
  // THE SIXTEENTH GRID needs four more float32 bits than wave 7's fract(b) ever did. At 3 h x 60 bpm that is 2.64 cm.
  const beats = 60 * 60 * 3, ulp16 = Math.pow(2, Math.floor(Math.log2(beats * 16)) - 23);
  assert.ok(ulp16 * MPB / 16 < 0.05, `fract(b*16) resolves to ${(ulp16 * MPB / 16 * 100).toFixed(2)} cm after three hours at the cap, on a ${(MPB / 16).toFixed(4)} m cell`);
  // ...and the shader is fed by 1/ROAD_MPB, so there is no second place for the scale to disagree with itself.
  assert.match(html, /INV=_roadG\(1\/ROAD_MPB\)/);
  assert.match(html, /const t=Math\.atan2\(sl, ROAD_MPB\)\/ROAD_TURN_FULL;/, "the tracking drill measures its heading against the same metres-per-beat");
});

test("THE RIBBON: the wake and the playability epoch cannot feel a change of metres-per-beat (U)", () => {
  // The epoch is stated in BEATS - claim windows, ring indices, the half-open [_roadEpoch, _roadEpochEnd). No distance
  // quantity appears anywhere in it, which is why parcel U needed to change exactly none of it.
  for (const name of ["roadJudging", "roadJudgeStamp", "roadWakeReset", "roadWakeAt", "roadWakeWrite", "roadWakeLatch"])
    assert.doesNotMatch(extractFunction(name), /ROAD_MPB|ROAD_BAND_M|ROAD_DRAW|ROAD_FADE|metersPerBeat/, `${name} knows nothing about metres`);
  assert.match(html, /const ROAD_WAKE=Math\.max\(1,Math\.ceil\(ROAD_FADE1_7\/ROAD_BAND_M\)\|0\);/, "the ring is bound to the UNBRANCHED double, so it is 14 on both presentations");
  // NEUTRAL renders as the naked grid itself: no fill at all, indistinguishable from road that was never offered.
  const ribbon = (() => { const a = html.indexOf("fragmentShader:(ML_RIBBON?["); return html.slice(a, html.indexOf("]:[", a)); })();
  assert.match(ribbon, /float fillA=has\*\(ahead\+\(1\.0-ahead\)\*\(landed\+missed\*/, "landed keeps its colour, missed is darkened, and a never-judged beat gets neither");
  assert.doesNotMatch(ribbon, /blank/, "...there is no separate 'never judged' shade to get wrong: it is the grid");
  // The 0.200-beat dead zone is unchanged in beats, and that is now 5.40 m of road at 27 m to the beat.
  const on = loadRoadGeom(true);
  assert.equal((0.2 * on.read("ROAD_MPB")).toFixed(2), "5.40");
  assert.equal((on.read("ROAD_WAKE") * on.read("ROAD_MPB")).toFixed(0), "378", "the ring reaches 378 m behind the feet inside an 864 m grid");
});

test("THE RIBBON: rails plus four tiers of ONE crossbar set, and cells only where there is a beat to state (U)", () => {
  const ribbon = (() => { const a = html.indexOf("fragmentShader:(ML_RIBBON?["); return html.slice(a, html.indexOf("]:[", a)); })();
  assert.match(ribbon, /float rail=1\.0-smoothstep\(0\.0,rw,abs\(al-/, "TWO luminous edge rails, on the ribbon's own boundary");
  assert.match(ribbon, /float xb\(float x, float w\)/, "...and one crossbar helper the tiers all share");
  for (const rate of ["16", "4", "1", "0.25"]) assert.ok(ribbon.includes("TIER(" + rate + ","), `the ${rate}/beat tier is emitted`);
  assert.match(ribbon, /g=max\(g,\(1\.0-cont\)\*max\(gb,/, "a mercy continuation swallows its '1' AND its bar line - and only those");
  assert.ok(!ribbon.includes("xb(b*16"), "the tier text is generated, never hand-written twice");
  assert.match(html, /const TIER=\(rate,k\)=>/, "...by one build-time emitter");
  assert.match(html, /LOW \? '  float g=0\.0;' : '  float g=max\('\+TIER\(16,0\)\+','\+TIER\(4,1\)\+'\);'/, "LOW drops the two tiers foreshortening takes first, and keeps the '1' and the bar");
  // Cells are the look-ahead's, ahead of the now-line; the wake is the same cells behind it. Nothing fills what has no beat.
  assert.match(ribbon, /float ahead=step\(/, "the current cell and forward are 'ahead'");
  assert.match(ribbon, /float ink='\+_roadG\(ROAD_CELL_INK\)\+'\*fillA\*lum\*inner\+'\+_roadG\(ROAD_GRID_INK\)\+'\*g\+'\+_roadG\(ROAD_RAIL_INK\)\+'\*rail/, "cell fill, grid and rails are three separate loudness knobs");
  assert.match(ribbon, /gl_FragColor=vec4\(col\*ink, outer\*fade\*uAmt\);/, "...and the clip reaches past the rail it has to contain");
});

test("THE MOONLINE: the ribbon pays for NO glyph pass on any tier, and the crosshair takes the letter back (U, W)", () => {
  // The FRAME BUDGET comment claims the ribbon runs "no glyph pass". A uniform gate would NOT have been one: uGlyphOn:0
  // still pays the footprint test on every road fragment. So the claim is only true if the TEXT is never emitted - which
  // is what this pins, both directions. PARCEL U shipped it for LOW; PARCEL W made it universal, because SPEC_MOONLINE §1's
  // cue contract is about the ROAD (colour-only) and not about a tier.
  const ribbon = (() => { const a = html.indexOf("fragmentShader:(ML_RIBBON?["); return html.slice(a, html.indexOf("]:[", a)); })();
  const s = ribbon.indexOf("...(ROAD_GLYPH_PASS ? ["), e = ribbon.indexOf("] : []),", s);
  assert.ok(s > 0 && e > s, "the glyph lines are one build-time-omitted block");
  const inside = ribbon.slice(s, e), outside = ribbon.slice(0, s) + ribbon.slice(e);
  for (const frag of ["texture2D(uGlyph", "float gv=", "float ing=", "float fb="]) {
    assert.ok(inside.includes(frag), `the ribbon's ${frag} lives inside the omitted block`);
    assert.ok(!outside.includes(frag), `...and NOTHING glyph-shaped survives outside it (${frag})`);
  }
  // What DOES survive outside is the uniform DECLARATION line, and only it: an unused uniform is not an active uniform,
  // so it costs no upload and no fragment op - and keeping it makes the two branches' first line identical, which is
  // exactly what the kill-switch wants to be readable.
  assert.ok(!/\*uGlyphOn/.test(outside), "uGlyphOn is never multiplied into anything outside the block - it is a declaration, not a gate");
  assert.match(outside, /uniform float uNow,uAmt,uPulse,uBeat0,uGlyphOn,uMercyB,uBreath;/, "the declaration line is the shipped one, plus wave 8.1's BREATH");
  assert.match(outside, /uniform sampler2D uBands,uGlyph;/, "...and so does the sampler it never binds on LOW");
  // The one dependent texture fetch in the whole ribbon shader is the glyph's; the band table's two reads are not.
  assert.equal((ribbon.match(/texture2D\(/g) || []).length, 3, "two band texels plus the one glyph fetch, and no more");
  // The budget comment states this in the same words the code now honours.
  assert.match(html, /EVERY TIER: NO GLYPH PASS\. The mid-cell letter is not emitted into the shader text at all \(ROAD_GLYPH_PASS/, "the budget line says it plainly, and says HOW");
  // THE CUE IS MOVED, NEVER DELETED: wherever the road stops carrying the letter, laneCue puts it back at the crosshair.
  // ROAD_LANE_READY is the one read both sides share, so the four (moonline x LOW) corners settle it.
  assert.equal(loadRoadGeom(true, false).read("ROAD_LANE_READY"), false, "the ribbon is COLOUR-ONLY, so the crosshair carries the letter");
  assert.equal(loadRoadGeom(true, true).read("ROAD_LANE_READY"), false, "...on LOW too - the same const, the same read");
  assert.equal(loadRoadGeom(false, false).read("ROAD_LANE_READY"), true, "wave 7 is untouched");
  assert.equal(loadRoadGeom(false, true).read("ROAD_LANE_READY"), true, "...on LOW too - the kill-switch owes wave 7 the glyph its own LOW path drew");
  assert.equal(loadRoadGeom(false, true).read("ROAD_GLYPH_PASS"), true, "moonline.on:false compiles the pass on every tier");
  assert.equal(loadRoadGeom(false, false).read("ROAD_GLYPH_PASS"), true, "...at full rez as well: wave 7 never had a tier gate");
  assert.equal(loadRoadGeom(true, false).read("ROAD_GLYPH_PASS"), false, "and the ribbon omits it at every rez");
  assert.equal(loadRoadGeom(true, true).read("ROAD_GLYPH_PASS"), false, "...LOW included");
  // Wave 7's own branch never learned about any of this: its glyph is unconditional, exactly as it shipped.
  const w0 = html.indexOf("]:[", html.indexOf("fragmentShader:(ML_RIBBON?["));
  const wave7 = html.slice(w0, html.indexOf("]).join('\\n') });", w0));
  assert.ok(wave7.includes("texture2D(uGlyph"), "wave 7 still samples the atlas");
  assert.ok(!wave7.includes("ROAD_GLYPH_PASS"), "...with no LOW gate anywhere in its text");
  assert.ok(!/LOW\s*\?[^']*uGlyph/.test(wave7), "...and no LOW ternary reaches its glyph at all");
  // Nothing builds an atlas nobody samples, and nothing refreshes one.
  assert.match(html, /uGlyph:\{value:ROAD_GLYPH_PASS\?roadGlyphTex\(\):null\}/, "the atlas is built only where it is sampled");
  assert.match(html, /if\(ROAD_GLYPH_PASS\)\{ const gt=roadGlyphTex\(\);/, "...and the per-beat refresh is skipped with it");
});

test("THE RIBBON: the horizon impostor is the EXACT projection of a straight continuation (U)", () => {
  // Not a fudge: a point at road distance D projects EYE/D below the horizon, so on a quad at Dq spanning y in [0, EYE]
  // the height h = 1 - Dq/D carries it, the half-width there is HW*(1-h) and the centre is apex*h with apex = s*D0 - x0.
  // Both LINEAR, which is why the impostor is a triangle. Proven here against the true projection, to machine precision.
  const on = loadRoadGeom(true);
  const HW = on.read("ROAD_HALF_W"), Dq = on.read("ROAD_IMP_D"), D0 = on.read("ROAD_DRAW_M");
  let worstX = 0, worstW = 0;
  for (const x0 of [-40, -3, 0, 7.5, 61]) for (const s of [-0.047, -0.01, 0, 0.008, 0.047]) {
    const xb = x0 + s * (Dq - D0), apex = s * D0 - x0;
    for (const D of [Dq, 1000, 1500, 4000, 1e5, 1e9]) {
      const h = 1 - Dq / D;                                  // the quad height that stands for road distance D
      const trueCx = (x0 + s * (D - D0)) * Dq / D - xb;      // where the real road's centre lands on the quad, relative to it
      const trueHw = HW * Dq / D;                            // ...and how wide it is there
      worstX = Math.max(worstX, Math.abs(apex * h - trueCx));
      worstW = Math.max(worstW, Math.abs(HW * (1 - h) - trueHw));
    }
  }
  assert.ok(worstX < 1e-9, `the shader's centre law is the true projection (max error ${worstX.toExponential(2)} m)`);
  assert.ok(worstW < 1e-9, `...and so is its width law (max error ${worstW.toExponential(2)} m)`);
  assert.match(html, /float x=\(vQ\.x-0\.5\)\*'\+_roadG\(QW\)\+'-uApex\*h;/, "...which is exactly what the quad's shader computes");
  assert.match(html, /float hw='\+_roadG\(ROAD_HALF_W\)\+'\*\(1\.0-h\);/);
  assert.match(html, /roadImp\.position\.x=x0\+sl\*\(ROAD_IMP_D-ROAD_DRAW_M\);/, "the quad stands where the continuation is at its own distance");
  assert.match(html, /roadImpMat\.uniforms\.uApex\.value=sl\*ROAD_DRAW_M-x0;/, "...and leans to where it vanishes (the algebra cancels ROAD_IMP_D)");
  // The quad has room for every shear the gate can admit, and no more.
  const maxShear = Math.tan((1 - 0.55) * on.read("ROAD_IMP_ANG")) * Dq;
  assert.ok(on.read("ROAD_IMP_SHEAR") >= maxShear, `the quad is wide enough for the gate's own worst lean (${maxShear.toFixed(1)} m)`);
  assert.ok(on.read("ROAD_IMP_SHEAR") < 2 * maxShear, "...and not wastefully wider");
});

test("THE RIBBON: the impostor may only stand in for a road that is actually straight (U)", () => {
  // straightness = 1 - |far heading| / ROAD_IMP_ANG, clamped; the gate is moonline.impostorMinStraight and the fade
  // reaches full brightness halfway to dead straight, so the streak arrives and leaves as a fade rather than a pop.
  const sync = extractFunction("roadImpSync");
  assert.match(sync, /const st=1-Math\.min\(1,Math\.abs\(Math\.atan\(sl\)\)\/ROAD_IMP_ANG\);/);
  assert.match(sync, /let t=LOW\?1:\(st-mn\)\/Math\.max\(1e-6,\(1-mn\)\*0\.5\);/);
  assert.match(sync, /const mn=Math\.max\(0,Math\.min\(1,\+CFG\.moonline\.impostorMinStraight\|\|0\)\);/, "the gate itself is the knob, unconditionally - LOW steps around it rather than rewriting it");
  assert.match(sync, /const amt=t\*t\*\(3-2\*t\)\*Math\.max\(0,\+CFG\.moonline\.impostorInk\|\|0\);/, "...and the ramp is a smoothstep, not a step");
  assert.doesNotMatch(sync, /new |\.push\(|=>/, "roadImpSync allocates nothing on the frame path");
  // The gate has to be able to say NO: impostorInk 0 and impostorMinStraight 1 both silence it entirely.
  const gate = (st, mn, ink) => { let t = (st - mn) / Math.max(1e-6, (1 - mn) * 0.5); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t) * ink; };
  assert.equal(gate(1, 1, 0.9), 0, "impostorMinStraight 1 -> never");
  assert.equal(gate(1, 0.55, 0), 0, "impostorInk 0 -> the painted road is off and the ribbon simply ends");
  assert.equal(gate(0.55, 0.55, 0.9), 0, "at the gate itself the streak is not yet lit");
  assert.equal(gate(1, 0, 0.9).toFixed(4), "0.9000", "dead straight with no gate at all -> full ink");
  assert.ok(gate(0.9, 0.55, 0.9) > gate(0.7, 0.55, 0.9), "...and it is monotone in straightness between");
  // Only the road's own visibility latch can take it away; only this gate can bring it back.
  assert.match(html, /if\(roadImp && !live\) roadImp\.visible=false;/);
  assert.match(html, /if\(ML_RIBBON\)\{ camera\.far=live\?ROAD_FAR:ROAD_FAR_ROOM; camera\.updateProjectionMatrix\(\); \}/, "the trainer and the Temple keep the projection matrix that shipped");
});

test("THE RIBBON: no new per-frame allocations, and the void's depth order is repaired (U)", () => {
  const sync = extractFunction("roadSync");
  assert.doesNotMatch(sync, /new [A-Z]/, "roadSync still allocates nothing");
  assert.ok(sync.indexOf("_roadBase.set(roadCourseX(r)") < sync.indexOf("roadImpSync(r)"), "the impostor continues the re-basing pair the line above just wrote");
  assert.match(sync, /roadImpSync\(0\);/, "reduceMotion freezes the painted horizon with the standing ribbon - the same pinned clock");
  // THE VOID'S DEPTH ORDER: the shell is a backdrop standing for infinity, not a wall at 400 m in front of an 864 m road.
  assert.match(html, /roadMesh\.renderOrder=ML_RIBBON\?-40:-900;/, "the ribbon draws AFTER the celestial shell, and wave 7 keeps -900");
  // THE TWO-STATE DEPTH LAW: one predicate, stated at the build site and at the per-frame authority that has re-written
  // the flag every frame since d66a003 (which is why the build-time value ALONE could never have delivered parcel U's
  // intent). moonlineVoid() is false in the Temple, so the Temple keeps wave 7's write - the flag that keeps the milky
  // way off the planet globes at R~315 - and false under either kill-switch, so wave 7 is restored flag for flag.
  assert.match(html, /depthWrite:!moonlineVoid\(\), depthTest:true/, "...because the shell stops WRITING depth in the VOID, and never stops testing it");
  assert.match(html, /milkyShell\.material\.depthWrite=!moonlineVoid\(\);/, "...and the per-frame write states the same law, so the two can never disagree");
  assert.doesNotMatch(html, /milkyShell\.material\.depthWrite=true;/, "no unconditional per-frame write survives to stomp it");
  for (const [temple, train, on, want] of [[false, false, true, false], [true, false, true, true], [false, true, true, true], [false, false, false, true]]) {
    const probe = loadVoidSandbox(`CFG.moonline.on=${on}; templeActive=${temple}; trainMode=${train};`);
    assert.equal(probe.read("!moonlineVoid()"), want,
      `depthWrite is ${want} with temple=${temple} train=${train} moonline.on=${on}`);
  }
  // The kill-switch is a compile-time fork: wave 7's shader text is still there, unedited, including the terms the
  // wireframe does not have (its own antialiasing law, its band edge, its solid-band ink).
  const wave7 = html.slice(html.indexOf("]:[", html.indexOf("fragmentShader:(ML_RIBBON?[")));
  assert.match(wave7, /float aa='\+\(LOW\?'1\.10':'0\.30\+d\*0\.020'\)\+';'/);
  assert.match(wave7, /float ribbon=1\.0-smoothstep\('\+HW\+'-aa,'\+HW\+'\+aa,lat\); if\(ribbon<=0\.004\) discard;/);
  assert.match(wave7, /float fb=fract\(b\), e=min\(fb,1\.0-fb\);/);
  assert.match(wave7, /gl_FragColor=vec4\(col\*ink, ribbon\*fade\*uAmt\);/);
});

// ---------------------------------------------------------------------------------------------------------------------
// THE MOONLINE - ARCHES, RINGS, DUST (SPEC_MOONLINE section 4, wave 8 parcel V).
// The bar line becomes a golden arch grown from the RAILS, the mercy bar becomes the road's only COMPLETE circle, and the
// sixteenth carrier gets a layer of stardust riding the surface - paid for, count by count, out of the hit-flock and shard
// budgets. moonline.on:false must build none of it; LOW must pay for no dust and plain arcs.
// ---------------------------------------------------------------------------------------------------------------------

test("ARCHES, RINGS, DUST: the knobs are CFG.moonline's, flat, and every switch reads the master first (V)", () => {
  const cfg = html.match(/moonline\s*:\s*\{[^}]+\}/);
  assert.ok(cfg, "CFG.moonline is STILL a flat (nested-brace-free) literal after eight more knobs");
  for (const contract of [/archOn\s*:\s*true\b/, /archHeightM\s*:\s*7\b/, /archGlow\s*:\s*1\b/, /archPrism\s*:\s*0\.35\b/,
    /mercyRingBoost\s*:\s*1\.9\b/, /reflectAlpha\s*:\s*0\.18\b/, /dustCount\s*:\s*400\b/, /dustGlow\s*:\s*0\.85\b/])
    assert.match(cfg[0], contract);
  // THE KILL-SWITCH: both parcel-V switches read ML_RIBBON (which IS moonlineOn()) before they read anything of their own.
  assert.match(html, /const ML_ARCH=ML_RIBBON && !!\(CFG\.moonline && CFG\.moonline\.archOn\);/, "the arches read the master switch first");
  assert.match(html, /const ML_DUST_N=ML_RIBBON&&!LOW&&!reduceMotion\?/, "...and so does the dust, which LOW - and, since wave 8.2, reduced motion - turns off in the same read");
  for (const [moonlineOn, low, arch, dust] of [[true, false, true, 400], [true, true, true, 0], [false, false, false, 0], [false, true, false, 0]]) {
    const c = loadRoadGeom(moonlineOn, low);
    assert.equal(c.read("ML_ARCH"), arch, "moonline.on=" + moonlineOn + " LOW=" + low + " -> arches " + arch);
    assert.equal(c.read("ML_DUST_N"), dust, "moonline.on=" + moonlineOn + " LOW=" + low + " -> " + dust + " motes");
  }
  // WAVE 8.2 (Y1): reduced motion is a THIRD off-switch on the same read, and it is off-ness, not stillness - the layer
  // is nothing but motion, so a frozen field would be a fog of dots with no meaning left in it. The arches are untouched
  // by it: they stand still under reduceMotion (uArchN0) because a ruler of the coming bars still says something.
  for (const low of [false, true]) {
    assert.equal(loadRoadGeom(true, low, null, true).read("ML_DUST_N"), 0, "reduceMotion builds no dust (LOW=" + low + ")");
    assert.equal(loadRoadGeom(true, low, null, true).read("ML_ARCH"), true, "...and the arches are not collateral damage");
  }
  // ...and with the switch off nothing is even CALLED: the two builders sit behind their own raw booleans in buildRoad.
  assert.match(html, /if\(ML_ARCH\) buildRoadArches\(\);/);
  assert.match(html, /if\(ML_DUST_N>0\) buildRoadDust\(\);/);
  // The cap SPEC section 4 names is enforced on the read, not trusted to the config.
  assert.equal(loadRoadGeom(true, false).read("ML_DUST_MAX"), 400);
  assert.equal(loadRoadGeom(true, false).read("Math.max(0,Math.min(ML_DUST_MAX,(+40000||0)|0))"), 400, "a console typo cannot put 40000 motes on the road");
});

test("ARCHES: a true ellipse at every station, a semicircle at the shipped height, and feet on the grid (V)", () => {
  const on = loadRoadGeom(true, false);
  const HW = on.read("ROAD_HALF_W"), H = 7, MPB = on.read("ROAD_MPB");
  // The strand is x = +-halfW*sin(th), y = archHeightM*cos(th) with th = (pi/2)*t, so the FRONT view outline satisfies
  // (x/halfW)^2 + (y/archHeightM)^2 = 1 identically - the shader does not approximate a circle, it parametrises one.
  let worst = 0;
  for (let s = 0; s <= 400; s += 1) {
    const t = (s / 400) * 2 - 1, th = (Math.PI / 2) * t;
    const x = HW * Math.sin(th), y = H * Math.cos(th);
    worst = Math.max(worst, Math.abs(Math.pow(x / HW, 2) + Math.pow(y / H, 2) - 1));
  }
  assert.ok(worst < 1e-12, "the arch outline is an exact ellipse at every station (max residual " + worst.toExponential(2) + ")");
  assert.equal(H, HW, "the shipped archHeightM IS ROAD_HALF_W, so the default arch is a TRUE semicircle and the mercy ring a true circle");
  // THE SPREAD IS SOLVED, NOT CHOSEN: a quarter beat is exactly one quarter-crossbar = four sixteenth crossbars, so every
  // junction node lands on a crossbar the ribbon already draws.
  const spread = on.read("ML_ARCH_SPREAD_M"), sixteenth = MPB / 16;
  assert.equal(spread, 6.75);
  assert.equal(spread / sixteenth, 4, "the branch departs four sixteenth crossbars before the bar line and rejoins four after");
  assert.equal(spread / (MPB / 4), 1, "...which is exactly one quarter-crossbar");
  // ...and that fixes the departure and crossing angles, which are geometry rather than taste.
  const foot = Math.atan2(H * Math.PI / 2, spread) * 180 / Math.PI;
  const cross = 2 * Math.atan2(HW * Math.PI / 2, spread) * 180 / Math.PI;
  assert.equal(foot.toFixed(1), "58.5", "the strand leaves the rail at 58.5 deg - a branch, not a spike");
  assert.equal(cross.toFixed(1), "116.9", "...and the two strands meet their partner at the crown at 116.9 deg");
  assert.match(html, /58\.5. above the road/, "the block comment states the departure angle it computed");
  // The tangent can never vanish, so a strand can never collapse to a point in screen space: |dP/dt| >= the along-road term.
  let minT = Infinity;
  for (let s = 0; s <= 400; s += 1) {
    const t = (s / 400) * 2 - 1, th = (Math.PI / 2) * t;
    const dx = HW * Math.cos(th) * Math.PI / 2, dy = -H * Math.sin(th) * Math.PI / 2;
    minT = Math.min(minT, Math.hypot(dx, dy, spread));
  }
  assert.ok(minT >= spread, "the strand's tangent is never shorter than its along-road term (min " + minT.toFixed(3) + " m)");
  // GROWN FROM THE ROAD, NOT HOVERING OVER IT (SPEC section 6's first playtest question, settled before it is asked).
  // The vertex shader's own lines, replayed here against an arbitrary course: a foot must land ON the rail the ribbon's
  // FRAGMENT shader draws - |x - cx(b)| = ROAD_HALF_W at the foot's OWN beat b - and at road level, from any now-position.
  const CA = [9.1, -4.3, 2.7], CW = [0.19, 0.31, 0.11], CP = [0.4, 2.1, 5.0];
  const cX = (b) => CA.reduce((s, a, i) => s + a * Math.sin(CW[i] * b + CP[i]), 0);
  const cD = (b) => CA.reduce((s, a, i) => s + a * CW[i] * Math.cos(CW[i] * b + CP[i]), 0);
  const station = (k, t, side, mir, uNow) => {
    const b = -on.read("ML_ARCH_BEHIND") + on.read("ML_ARCH_EVERY") * k + on.read("ML_ARCH_SPREAD") * t, th = 1.57079633 * t;
    const cx = cX(b) - cX(uNow) - cD(uNow) * (b - uNow);
    return { x: cx + side * HW * Math.sin(th), y: mir * H * Math.cos(th), z: -(b - uNow) * MPB, b, cx };
  };
  let onRail = 0, apex = 0, seam = 0;
  for (const uNow of [0, 3.7, 128.25, 4321.5]) for (let k = 0; k < on.read("ML_ARCH_N"); k += 1) for (const side of [-1, 1]) {
    for (const t of [-1, 1]) { const p = station(k, t, side, 1, uNow); onRail = Math.max(onRail, Math.abs(Math.abs(p.x - p.cx) - HW), Math.abs(p.y)); }
    const a = station(k, 0, side, 1, uNow); apex = Math.max(apex, Math.abs(a.x - a.cx), Math.abs(Math.abs(a.y) - H));
    const u = station(k, 1, side, 1, uNow), d = station(k, 1, side, -1, uNow);
    seam = Math.max(seam, Math.hypot(u.x - d.x, u.y - d.y, u.z - d.z));
  }
  assert.ok(onRail < 1e-7, `every junction node lands on the rail, at road level (max ${onRail.toExponential(2)} m - 22 nm of it is 1.57079633 not being pi/2)`);
  assert.equal(apex, 0, "the crown is exactly archHeightM over the centreline, at every now-position");
  assert.ok(seam < 1e-7, `the mercy ring's two halves share their feet, so the one complete circle has no seam (max ${seam.toExponential(2)} m)`);
  assert.equal((station(3, 1, -1, 1, 0).b * 4) % 1, 0, "a foot's own beat is a whole QUARTER, so the node sits on a crossbar the grid already draws");
  // The slot ring covers exactly the ribbon: the last arch dies where ROAD_DRAW does.
  const N = on.read("ML_ARCH_N"), behind = on.read("ML_ARCH_BEHIND"), every = on.read("ML_ARCH_EVERY");
  assert.equal(behind % every, 0, "the ring re-anchors on a BAR line, never between two");
  assert.equal(-behind + every * (N - 1), on.read("ROAD_DRAW"), "the farthest slot is at drawBeats exactly - no gate hangs over a road that has ended");
});

test("THE MERCY RING: the only complete circle, and it can only land on a bar line (V)", () => {
  // roadTideAt's mercy flag is 1 only at cb === rise+peak AND (g mod 8) === 0, and g = 2n, so n is a multiple of 4 - which
  // is ML_ARCH_EVERY. The ring therefore lands ON an arch slot by the tide's own arithmetic, not by luck.
  const cfg = extractCfg();
  const context = vm.createContext({ Math, Number, CFG: cfg });
  vm.runInContext(extractFunction("roadTideAt") + "; const _roadTide0={m:0,i:1}, _roadTideR={m:0,i:1};", context);
  const TD = cfg.tide, cyc = TD.riseBars + TD.peakBars + TD.mercyBars;
  let opens = 0;
  for (let n = 0; n < 4 * cyc * 12; n += 1) {
    if (vm.runInContext("roadTideAt(" + n + ").m", context) !== 1) continue;
    opens += 1;
    assert.equal(n % 4, 0, "the mercy phase opens on beat " + n + ", which is a bar line");
  }
  assert.ok(opens >= 10, "swept enough swells to matter (" + opens + " ring beats)");
  assert.match(extractFunction("roadArchFill"), /_archKind\[k\]=\(roadTideAt\(b0\+ML_ARCH_EVERY\*k\)\.m===1\)\?1:0;/, "the ring IS that flag, read at the slot's own beat");
  // THE RING IS THE REFLECTION, CLOSING: hlf = mix(1, mix(uReflect,1,mercy), step(mir,0)). reflectAlpha:0 silences every
  // reflection and leaves the ring at full strength, which is the whole point of stating it as one expression.
  const hlf = (reflect, mercy, mir) => {
    const inner = reflect + (1 - reflect) * mercy;
    return 1 + (inner - 1) * (mir <= 0 ? 1 : 0);
  };
  assert.equal(hlf(0.18, 0, +1), 1, "an ordinary arch is at full strength above the road");
  assert.equal(hlf(0.18, 0, -1).toFixed(6), "0.180000", "...and its mirrored pass is the faint reflection");
  assert.equal(hlf(0, 0, -1), 0, "reflectAlpha 0 turns every reflection off");
  assert.equal(hlf(0, 1, -1), 1, "...and the MERCY RING is untouched by it - its lower half is not a reflection of anything");
  assert.equal(hlf(0.18, 1, -1), 1, "the ring closes at full strength whatever reflectAlpha says");
  assert.match(html, /float hlf=mix\(1\.0, mix\(uReflect,1\.0,mercy\), step\(mir,0\.0\)\);/, "...which is exactly the line the vertex shader carries");
  assert.match(html, /vAmt=uAmt\*uArchGlow\*mix\(fade,sqrt\(fade\),mercy\)\*mix\(1\.0,uMercyRB,mercy\)\*hlf\*\(1\.0\+'\+\(ML_DOOR_CROSS\?/, "the ring is boosted AND fades as sqrt(fade), so it is legible from far out - and the gated breath term rides the same amount");
  // "half" is reserved in GLSL ES - the identifier had to be hlf, and nothing in either shader may use a reserved word.
  const archSrc = extractFunction("buildRoadArches").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");   // the EMITTED text only: the prose around it is allowed to say "half-width"
  for (const word of ["half", "fixed", "input", "output", "asm", "union", "template", "namespace"])
    assert.doesNotMatch(archSrc, new RegExp("\\b" + word + "\\b"), word + " is reserved in GLSL ES and cannot appear in the arch shaders");
});

test("THE STARDUST: the road's own speed, the sixteenth's own grain, and not one draw from rnd() (V)", () => {
  const on = loadRoadGeom(true, false), MPB = on.read("ROAD_MPB");
  // SPEC section 4's arithmetic, verified: 4 quarter-crossbars per beat IS the road speed, so a mote pinned to the road
  // states the speed the road actually has and can never lie about it.
  assert.equal(4 * (MPB / 4), MPB, "4 quarter-crossbars per beat = ROAD_MPB = the road's own speed");
  const sixteenth = MPB / 16;
  assert.equal(sixteenth, 1.6875);
  for (const pair of [[20, "187.5"], [60, "62.5"]])
    assert.equal((sixteenth / (MPB * pair[0] / 60) * 1000).toFixed(1), pair[1], "a sixteenth cell arrives every " + pair[1] + " ms at " + pair[0] + " bpm");
  // The window and its density are the numbers the comment claims. WAVE 8.2 (Y1): the window is now a VOLUME wrapped
  // around the camera, so BEHIND is a whole beat of space you have flown through rather than a sliver of pavement.
  const span = on.read("ML_DUST_SPAN"), behind = on.read("ML_DUST_BEHIND"), N = on.read("ML_DUST_N");
  assert.equal(span * MPB, 135, "135 m of travel axis carries dust");
  assert.equal(behind * MPB, 27, "...27 m of it behind the eye, which is exactly ONE BEAT");
  assert.equal(behind, 1, "...stated in the unit this road measures everything in");
  assert.equal((span - behind) * MPB, 108, "...and 108 m ahead");
  assert.equal(span * 16, 80, "the window is a WHOLE number of sixteenth cells - the one invariant the anchor law owes");
  assert.equal(N / (span * 16), 5, "exactly 5 motes per sixteenth cell");
  assert.equal(on.read("ML_DUST_FAR1"), (span - behind) * MPB, "the far ramp ends exactly where the window does");
  assert.ok(on.read("ML_DUST_FAR0") < on.read("ML_DUST_FAR1"), "...and it IS a ramp, so the wrap has no seam");
  assert.equal(on.read("ML_DUST_BEH_M"), behind * MPB, "...as does the rear one, which is now behind you where you can turn and look at it");
  // THE STREAM RULE: the layer is seeded from a PRIVATE mulberry32 exactly as the course is - never rnd(), never Math.random.
  const build = extractFunction("buildRoadDust"), body = build.replace(/\/\*[\s\S]*?\*\//g, " ");
  assert.match(build, /const N=ML_DUST_N, pos=new Float32Array\(N\*3\), sd=new Float32Array\(N\), cells=ML_DUST_SPAN\*16, rr=mulberry32\(0x9e3779b9\);/);
  assert.doesNotMatch(body, /\brnd\(|Math\.random/, "the spawn stream is untouched, draw for draw");
  assert.match(build, /pos\[i\*3\]=\(c\+\(rr\(\)-0\.5\)\*0\.3\)\/16;/, "every anchor is a SIXTEENTH cell, jittered by under a fifth of one");
  // The motes never move: uNow does. No time term exists anywhere, which is why the stream states the road's speed and
  // cannot state any other - and reduced motion does not have to silence one, it simply never builds the layer.
  const dustVs = html.slice(html.indexOf("uniform float uNow,uAmt,uDustGlow;"), html.indexOf("uniform vec3 uCol; varying float vA;"));
  assert.match(dustVs, /float ba=mod\(position\.x-uNow,/, "the anchor is wrapped against the clock, not integrated over frames");
  assert.doesNotMatch(dustVs, /uTime|elapsed/, "there is no time term at all");
});

test("THE DUST IS THE SPACE: a volumetric field around the camera, streaming at the road's own speed (Y1, 8.2)", () => {
  // WAVE 8.2, user-locked from the Moonline playtest. The motes leave the road SURFACE and become the void itself.
  const on = loadRoadGeom(true, false), MPB = on.read("ROAD_MPB"), EYE = 4;
  const R = on.read("ML_DUST_RAD"), V = on.read("ML_DUST_VERT"), N = on.read("ML_DUST_N");
  const span = on.read("ML_DUST_SPAN"), behind = on.read("ML_DUST_BEHIND");
  assert.equal(R, 40, "40 m of dust either side of the eye");
  assert.equal(V, 25, "...25 m above and below it");

  // (1) THE FIELD IS AROUND THE CAMERA, NOT ON THE ROAD. The vertex shader's world position must read the field's own
  // extents and the EYE, and must NOT read the road's half-width, its surface height, or the course centreline.
  const build = extractFunction("buildRoadDust");
  const code = build.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");   // the EMITTED text only: the prose around it is allowed to name the uniforms it dropped
  assert.match(build, /vec3 P=vec3\(position\.y\*'\+_roadG\(ML_DUST_RAD\)\+', '\+_roadG\(EYE\)\+'\+position\.z\*'\+_roadG\(ML_DUST_VERT\)\+', -u\);/,
    "lateral about the eye, vertical about the eye, and -u down the travel axis");
  for (const gone of [/ROAD_HALF_W/, /ML_DUST_Y/, /ML_DUST_LOFT/, /uBase/, /uA,uW,uP/, /dot\(uA/])
    assert.doesNotMatch(code, gone, `the surface-bound term ${gone} left with the surface`);
  // ...and the constants it measured off are no longer DECLARED, not merely unused (the prose above them says why).
  assert.doesNotMatch(html, /const [^\n]*\bML_DUST_Y=/, "ML_DUST_Y retired with the road plane it offset from");
  assert.doesNotMatch(html, /const [^\n]*\bML_DUST_LOFT=/, "ML_DUST_LOFT with it");
  assert.match(html, /const ML_DUST_M=0\.30, ML_DUST_INK=0\.55;/, "what is left is the mote and the ink");

  // (2) THE ONE SHARED UNIFORM IS THE CLOCK, which is what tempo-locks the stream to the ribbon: same uNow object, same
  // ROAD_MPB, so dust speed IS road speed = ROAD_MPB * bpm/60 at every tempo, and neither can drift from the other.
  assert.match(build, /uniforms:\{ uNow:U\.uNow, uCol:U\.uInk,/, "the dust borrows the road's clock object, and only that");
  assert.match(build, /float u=ba\*'\+_roadG\(ROAD_MPB\)\+';/, "one beat of wrap IS one beat of road");
  for (const [bpm, speed] of [[20, 9], [60, 27]])
    assert.equal(MPB * bpm / 60, speed, `${speed} m/s of dust at ${bpm} bpm, because that is what the road does`);

  // (3) THE POPULATION, integrated rather than asserted - the 8.1 method, at the new placement. Motes uniform in the box;
  // a mote is drawn at clamp(ML_DUST_M*ML_FOCAL_PX/d, PX0, PX1) px and is on screen inside the shipped frustum.
  const focal = on.read("ML_FOCAL_PX"), num = on.read("ML_DUST_M") * focal;
  const px0 = on.read("ML_DUST_PX0"), px1 = on.read("ML_DUST_PX1");
  const tanV = Math.tan((95 * Math.PI) / 360), tanH = (1920 / 2) / focal;
  const A = (span - behind) * MPB, B = behind * MPB;
  let seed = 0x9e3779b9 | 0;
  const rr = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const S = 200000;
  let onScreen = 0, area = 0, behindCam = 0, capped = 0, near20 = 0;
  for (let i = 0; i < S; i++) {
    const x = (rr() * 2 - 1) * R, y = (rr() * 2 - 1) * V, u = -B + rr() * (A + B);
    const d = Math.sqrt(x * x + y * y + u * u);
    if (d < 20) near20++;
    if (u <= 0) { behindCam++; continue; }
    if (Math.abs(x) > u * tanH || Math.abs(y) > u * tanV) continue;
    onScreen++;
    const s = Math.min(px1, Math.max(px0, num / d));
    area += s * s;
    if (s >= px1 - 1e-9) capped++;
  }
  const k = N / S, frame = 1920 * 1080, px2 = area * k;
  assert.equal(Math.round(onScreen * k), 276, "276 motes are on screen at a level forward view");
  assert.equal(Math.round(behindCam * k), 81, "...and ~80 are behind the camera, which in a void is space you can turn and look at");
  assert.equal(Math.round(capped * k), 11, "11 hold the 6 px cap - the near field is the cue");
  assert.equal(Math.round(near20 * k), 25, "25 motes are within 20 m of the eye at any instant");
  assert.equal((px2 / frame * 100).toFixed(3), "0.109", "the field costs 0.109% of a 1920x1080 frame");
  assert.ok(px2 / frame < 0.0031, "...which is inside the 0.31% parcel V budgeted, with room to spare");
  assert.ok(px2 / frame < 0.0021, "...and UNDER 8.1's own 0.210%: the same motes, spread over the frame instead of the road strip");
  // The density is what makes it read: one mote per 1350 m^3, mean nearest-neighbour spacing 6.12 m = a 6 px grain.
  const vol = (2 * R) * (2 * V) * (A + B), n = N / vol;
  assert.equal(vol, 540000, "80 x 50 x 135 m of space");
  assert.equal((1 / n).toFixed(0), "1350", "one mote per 1350 m^3");
  assert.equal((0.554 * Math.pow(1 / n, 1 / 3)).toFixed(2), "6.12", "mean nearest-neighbour spacing 6.12 m");
  // ...and the pass rate is the flying-through-space cue itself: it triples with the tempo, from one number.
  for (const [bpm, want] of [[20, "0.52"], [60, "1.57"]])
    assert.equal((n * Math.PI * 25 * MPB * bpm / 60).toFixed(2), want, `${want} motes/s pass within 5 m at ${bpm} bpm`);
});

test("THE STARDUST IS RESOLVABLE: the window ends where the grain dies, and the alpha arrives whole (V, 8.1)", () => {
  // WAVE 8.1, from first light ("I do not see any stardust coming"). The layer was never missing: it was spent where the
  // eye cannot resolve it, and then halved by a blend-mode mismatch. Both halves are ARITHMETIC, so both are pinned here.
  const on = loadRoadGeom(true, false), MPB = on.read("ROAD_MPB"), EYE = 4;
  const focal = on.read("ML_FOCAL_PX"), N = on.read("ML_DUST_N");
  const span = on.read("ML_DUST_SPAN"), behind = on.read("ML_DUST_BEHIND");
  const px0 = on.read("ML_DUST_PX0"), px1 = on.read("ML_DUST_PX1");
  const num = on.read("ML_DUST_M") * focal, sizeAt = (d) => Math.min(px1, Math.max(px0, num / d));

  // (1) THE SIZE LAW. The shader is clamp(ML_DUST_M*ML_FOCAL_PX/d, PX0, PX1), so one number decides everything.
  assert.equal(num.toFixed(2), "148.45", "148.45 px*m, from the shipped optics and a 0.30 m mote");
  assert.equal((num / px1).toFixed(2), "24.74", "a mote is at the 6 px cap inside 24.74 m");
  assert.equal((num / 2).toFixed(2), "74.22", "...still 2 px at 74.22 m");
  const far = (span - behind) * MPB;
  assert.ok(sizeAt(far) > px0, "EVERY mote in the window resolves above the floor - the window ends where the grain would die");
  assert.equal(far, 108, "the window's far edge (wave 8.2 moved BEHIND from 0.5 beats to 1, so ahead is 108 m, not 121.5)");
  assert.equal(sizeAt(far).toFixed(2), "1.37", "the farthest mote is 1.37 px, not a sub-pixel wash");
  // ...which is exactly what the shipped pair could not say: 0.10 m gave 49.48 px*m, under a pixel past 49.5 m, for 81%
  // of a 270 m window. That is the whole bug, in one comparison.
  assert.equal((0.1 * focal).toFixed(2), "49.48");
  assert.ok(0.1 * focal < 54, "the OLD mote was sub-pixel over four fifths of the OLD window");

  // (2) THE HARD BOUND, which survives every placement: 400 points can never cost more than 400 caps' worth of fragments.
  // The REAL budget is no longer a road-distance integral - wave 8.2 (Y1) made the layer volumetric - so it is computed
  // over the box in "THE DUST IS THE SPACE" above, by the same method this test established: 0.109% of the frame.
  const frame = 1920 * 1080;
  assert.ok(N * px1 * px1 / frame < 0.007, "even the unreachable hard bound (every mote at the cap) stays under 0.7%");
  assert.equal(EYE / Math.tan((95 * Math.PI) / 360) > 0, true, "the frame's bottom edge is still where the optics put it");

  // (3) THE BLEND. The fragment emits premultiplied vec4(uCol*a, a); three.js r128 defaults premultipliedAlpha=false and
  // would pick blendFunc(SRC_ALPHA, ONE), delivering a^2. Saying so is the fix, and it is one word on the material.
  const dust = extractFunction("buildRoadDust");
  assert.match(dust, /blending:THREE\.AdditiveBlending, premultipliedAlpha:true,/, "the material declares what its shader already does");
  assert.match(dust, /gl_FragColor=vec4\(uCol\*a, a\);/, "...and the shader still emits premultiplied, unchanged");
  const peak = on.read("ML_DUST_INK") * 0.85;   // dustGlow's shipped default
  assert.equal(peak.toFixed(4), "0.4675", "peak mote alpha");
  assert.equal((peak * peak).toFixed(4), "0.2186", "...which is what the double-alpha was delivering instead");
  assert.ok(peak / (0.95 * 0.55) > 0.85, "a peak mote now reads at 90% of a road rail, where it read at 42%");
  // The arches emit the same premultiplied shape and are deliberately NOT touched: their core saturates rather than dims,
  // so changing them would change a look that shipped and is wanted.
  assert.doesNotMatch(extractFunction("buildRoadArches"), /premultipliedAlpha/, "the arches keep the compositing they shipped with");
});

test("PARCEL V PAYS FOR ITSELF: every halved count, old -> new (V)", () => {
  const cfg = extractCfg();
  assert.equal(cfg.shards, 9, "CFG.shards 18 -> 9");
  assert.match(html, /if\(LOW\)\{ CFG\.shards=4;/, "...and its LOW rung 8 -> 4");
  const at = html.indexOf("const FLOCK={");
  const literal = html.slice(html.indexOf("{", at), closingDelimiter(html, html.indexOf("{", at)) + 1);
  const flock = vm.runInNewContext("(" + literal + ")", { EYE: 4 });
  for (const row of [["max", 190, 95], ["ghostMax", 60, 30], ["burstBase", 8, 4], ["burstAcc", 0.06, 0.03]]) {
    assert.equal(flock[row[0]], row[2], "FLOCK." + row[0] + " " + row[1] + " -> " + row[2]);
    assert.equal(row[2] * 2, row[1], "...which is exactly half of " + row[1]);
  }
  assert.match(html, /if\(LOW\)\{ FLOCK\.max=20; FLOCK\.ghostMax=6; FLOCK\.burstBase=2; \}/, "the LOW rungs halve with them (40->20, 12->6, 4->2)");
  // The burst RANGE halves exactly, which is what "behaviour unchanged, counts down" has to mean for a count derived from
  // two numbers: 8 + 100*0.06 = 14 becomes 4 + 100*0.03 = 7.
  assert.equal(flock.burstBase + 100 * flock.burstAcc, 7);
  // WHAT IT BUYS: birds and ghosts are individual additive Meshes, so the peak flock is 250 draw calls -> 125, against the
  // TWO this parcel adds (one arch mesh, one Points).
  const on = loadRoadGeom(true, false);
  assert.equal(on.read("ML_ARCH_N * 4 * 2 * ML_ARCH_SEG"), 2464, "the arches are 2464 constant triangles");
  assert.equal(loadRoadGeom(true, true).read("ML_ARCH_N * 4 * 2 * ML_ARCH_SEG"), 1232, "...and half that on LOW");
  assert.ok((190 + 60) - (95 + 30) > 2, "the flock frees far more draw calls than parcel V spends");
  assert.equal((190 + 60) * 24 - (95 + 30) * 24, 3000, "...and 3000 triangles at peak, against 2464 constant");
  assert.match(html, /DRAW CALLS: \+2 \(one indexed mesh for every arch, ring and reflection on screen; one THREE\.Points for all the dust\)/, "the frame budget states the cost");
  assert.match(html, /Net at a hot combo: .123\./, "...and what pays for it");
});

test("ARCHES, RINGS, DUST: no per-frame work at all, because the uniforms are shared objects (V)", () => {
  // The whole parcel rides roadMat's OWN uniform objects for the clock, the re-basing pair, the course and the ink - so the
  // three floats roadSync already wrote in wave 7 drive all three shaders and nothing new is written per frame.
  assert.match(extractFunction("buildRoadArches"), /uNow:U\.uNow, uBase:U\.uBase, uA:U\.uA, uW:U\.uW, uP:U\.uP/, "buildRoadArches borrows the road's clock rather than keeping a second copy");
  // The dust borrows the CLOCK and nothing else since wave 8.2 (Y1): it is space, not pavement, so it does not read the
  // re-based centreline or the course - which is one sin() and one dot() per vertex saved, not merely a law respected.
  assert.match(extractFunction("buildRoadDust"), /uniforms:\{ uNow:U\.uNow, uCol:U\.uInk,/, "the dust borrows the road's clock object, so it cannot state a speed the road does not have");
  assert.match(extractFunction("buildRoadDust"), /uCol:U\.uInk/, "the dust is drawn in the ROAD's colour, so tonight's grid roll reaches it for free");
  // Everything a beat can change is written in roadSync's existing once-per-beat block, and nothing there allocates.
  const sync = extractFunction("roadSync");
  const perBeat = sync.slice(sync.indexOf("if(n0!==_roadBeat0)"), sync.lastIndexOf("if(reduceMotion)"));
  assert.ok(perBeat.includes("roadArchFill(n0);"), "the arch table is filled ONCE PER BEAT, beside the band table");
  assert.ok(!sync.slice(sync.lastIndexOf("if(reduceMotion)")).includes("roadArchFill"), "...and never on the per-frame path");
  const fill = extractFunction("roadArchFill");
  assert.doesNotMatch(fill, /new [A-Z]|\.push\(|=>/, "roadArchFill allocates nothing");
  assert.match(fill, /AU\.uArchN0\.value=reduceMotion\?-ML_ARCH_BEHIND:b0;/, "reduceMotion stands the gates still and scrolls the mercy table through them");
  for (const knob of ["uArchH", "uArchGlow", "uArchPrism", "uReflect", "uMercyRB"])
    assert.ok(fill.includes("AU." + knob + ".value="), knob + " is re-read every beat, so the form knob is LIVE");
  assert.match(fill, /roadDustMat\.uniforms\.uDustGlow\.value=/, "...and so is the dust's");
  // Both meshes ride the ROAD's own visibility latch, so the trainer and the Temple hide them by the shipped predicate.
  assert.match(sync, /if\(roadArch\) roadArch\.visible=live;[\s\S]{0,400}?if\(roadDust\) roadDust\.visible=live;/);
  assert.match(html, /roadArch\.frustumCulled=false; roadArch\.renderOrder=-39;/, "the gates draw straight after the ribbon (-40) and before every other transparent thing");
  assert.match(html, /roadDust\.frustumCulled=false; roadDust\.renderOrder=-38;/);
});

test("LOW-REZ pays for no dust, plain arcs, and an impostor that always stands (V)", () => {
  // SPEC section 4's LOW contract, all three clauses. The dust is not built at all; the prism and the aurora are not
  // EMITTED (a uniform set to zero would still pay both exp() on every arch fragment - the ROAD_GLYPH_PASS lesson).
  assert.equal(loadRoadGeom(true, true).read("ML_DUST_N"), 0, "LOW builds no dust buffer, material or draw call");
  assert.equal(loadRoadGeom(true, true).read("ML_ARCH_RICH"), false);
  assert.equal(loadRoadGeom(true, false).read("ML_ARCH_RICH"), true);
  assert.equal(loadRoadGeom(true, true).read("ML_ARCH_SEG"), 14, "half the segments");
  assert.equal(loadRoadGeom(true, false).read("ML_ARCH_SEG"), 28);
  const frag = html.slice(html.indexOf("uniform vec3 uCol; uniform float uArchPrism;"), html.indexOf("roadArch=new THREE.Mesh"));
  const s = frag.indexOf("].concat(ML_ARCH_RICH?["), e = frag.indexOf("]:[", s);
  assert.ok(s > 0 && e > s, "the rich lines are one build-time-omitted block");
  const inside = frag.slice(s, e), outside = frag.slice(0, s) + frag.slice(e);
  for (const term of ["uArchPrism*ie", "float aur=", "cos(vec3(vTh"]) {
    assert.ok(inside.includes(term), term + " lives inside the omitted block");
    assert.ok(!outside.includes(term), "...and nothing prism- or aurora-shaped survives outside it (" + term + ")");
  }
  assert.ok(outside.includes("float core=exp(-vV*vV*"), "what LOW still draws is the core and its junction nodes - the arch's INFORMATION");
  // ...and the horizon impostor stops asking whether the course is straight. SPEC section 1's hard constraint is
  // "impostor always", so LOW SKIPS the straightness gate - it does not merely open it to zero. mn:0 was not the same
  // thing: t=2*st still faded the streak out as the far heading swung and reached exactly nothing at ROAD_IMP_ANG, so a
  // curvy course took the painted far road away from the one tier that most needs it.
  assert.match(extractFunction("roadImpSync"), /let t=LOW\?1:\(st-mn\)\/Math\.max\(1e-6,\(1-mn\)\*0\.5\);/,
    "LOW shows the painted road always; only impostorInk can still silence it");
  const lowAmt = (st, mn, ink) => { let t = 1; t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t) * ink; };
  const deskAmt = (st, mn, ink) => { let t = (st - mn) / Math.max(1e-6, (1 - mn) * 0.5); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t) * ink; };
  assert.equal(deskAmt(0, 0, 0.9), 0, "at mn 0 a 6-degrees-off course still killed the streak on the old LOW path");
  assert.equal(lowAmt(0, 0.55, 0.9).toFixed(4), "0.9000", "...and it now stands at full ink on the curviest course LOW can draw");
  assert.equal(lowAmt(0, 0.55, 0), 0, "...while impostorInk 0 still silences it, which is the one veto SPEC leaves standing");
});

// ---------------------------------------------------------------------------------------------------------------------
// WAVE 8, PARCEL W - CURSOR & TETHERS (SPEC_MOONLINE section 5).
// ---------------------------------------------------------------------------------------------------------------------

function glowSandbox(overrides) {
  // wasdBeatCueOn / wasdBeatGlow lifted verbatim out of index.html, so this sandbox cannot drift from the shipped law.
  const context = vm.createContext({ Math, Number });
  const prelude = `
    var CFG = { floorBeat:true, wasdRhythm:true, beatQuant:true, floorBeatMax:0.45, wasdNoteDivs:[2,4,8], wasdNoteT:[1.01,1.02], moonline:{ breathMax:0.45 } };
    var MOBILE = false, templeActive = false, trainMode = false, reduceMotion = false, toneReady = true;
    var state = { running:true, bpm:60 };
    var Tone = { Transport:{ state:'started' } };
    var _combo = [0,1,2,3], _beatGlowKey = 0, _beats = 0;
    var diffT = function(){ return 0; };
    var pocketLive = function(){ return false; };
    var pocketIdeal = function(){ return 0; };
    var pocketExpected = function(){ return 'on'; };
    var wasdBeats = function(){ return _beats; };
    var wasdBeatsHeard = function(){ return _beats; };
    ${overrides || ""}
  `;
  const source = ["wasdNoteDiv", "wasdBeatCueOn", "beatSwell", "wasdBeatGlow", "roadBreath"].map((n) => extractFunction(n)).join("\n");
  vm.runInContext(prelude + source, context);
  context.read = (expression) => vm.runInContext(expression, context);
  context.write = (statement) => vm.runInContext(statement, context);
  return context;
}

test("CURSOR: the pre-wave-7 pulsating glow is RESTORED, not reinvented - one law, two surfaces (W)", () => {
  // SPEC_MOONLINE section 1's cue contract, from the user's regression report. The envelope that washed the FLOOR before
  // wave 7 now lights the LETTER in the void, and the ONLY way that can be byte-faithful is if there is exactly one copy
  // of the law. There is: wasdBeatGlow(), called by updateFloorBeat and by drawWasdLane and by nothing else.
  assert.equal((html.match(/function wasdBeatGlow\(\)/g) || []).length, 1, "the envelope exists exactly once");
  assert.equal((html.match(/amt=wasdBeatGlow\(\);/g) || []).length, 1, "...the FLOOR renderer is one call site");
  assert.equal((html.match(/wasdBeatGlow\(\)\/_cueMax/g) || []).length, 1, "...the CROSSHAIR renderer is the other, and it normalises");
  // The law itself, character-for-character what shipped before the road existed. WAVE 8.1 lifted the CURVE one level out
  // into beatSwell() so the RIBBON can read the same shape on its own clock - same expression, same multiply order, one copy.
  const glow = extractFunction("wasdBeatGlow");
  assert.match(glow, /if\(trainMode && reduceMotion\) return off<0\.12\?maxAmt:0;/, "the trainer's discrete reduced-motion flash");
  assert.equal((html.match(/function beatSwell\(/g) || []).length, 1, "the curve exists exactly once");
  assert.match(extractFunction("beatSwell"), /\{ const env=Math\.max\(0,1-off\*2\); return maxAmt\*env\*env; \}/, "and the soft envelope, in that multiply order");
  assert.match(glow, /return beatSwell\(maxAmt, off\);/, "...which wasdBeatGlow now delegates to rather than transcribing");
  assert.match(glow, /const bi=Math\.round\(beats\), off=Math\.abs\(beats-bi\);/, "measured against the nearest heard beat");
  // The floor path is the shipped gate with the surface test still last, and the shared prefix carries every other clause.
  assert.match(extractFunction("updateFloorBeat"), /const floorCueOn=wasdBeatCueOn\(\) && !roadLive\(\);/, "the floor still asks !roadLive()");
  const cueOn = extractFunction("wasdBeatCueOn");
  for (const clause of ["!templeActive", "!MOBILE", "CFG.floorBeat", "CFG.wasdRhythm", "CFG.beatQuant", "state.running",
    "toneReady", "Tone.Transport.state==='started'", "(!reduceMotion || trainMode)"])
    assert.ok(cueOn.includes(clause), `the shared gate keeps the shipped clause ${clause}`);
  assert.ok(!cueOn.includes("roadLive") && !cueOn.includes("moonline"), "...and knows nothing about which surface is asking");

  // THE TWO RENDERERS ARE DISJOINT BY CONSTRUCTION: the floor asks !roadLive(), the crosshair asks moonlineVoid(), and
  // moonlineVoid() is identically `moonline.on && roadLive()`. Swept - there is no state where the beat is painted twice.
  for (const roadLive of [true, false]) for (const moonlineOn of [true, false]) {
    const floor = !roadLive, crosshair = moonlineOn && roadLive;
    assert.ok(!(floor && crosshair), `never two beat clocks (roadLive=${roadLive}, moonline.on=${moonlineOn})`);
  }

  // The envelope, replayed against a hand transcription of the pre-wave-7 expression at every offset in the beat.
  const probe = glowSandbox();
  const shipped = (off) => { const env = Math.max(0, 1 - off * 2); return 0.45 * env * env; };
  for (let n = 0; n <= 100; n += 1) {
    const beats = 12 + n / 200, off = Math.abs(beats - Math.round(beats));   // the same |off| the function itself measures, so this compares LAWS and not float noise
    probe.write(`_beats = ${beats};`);
    assert.equal(probe.read("wasdBeatGlow()"), shipped(off), `envelope at |off| = ${off.toFixed(3)}`);
  }
  assert.equal(probe.read("(_beats = 12, wasdBeatGlow())"), 0.45, "it peaks at the beat, at CFG.floorBeatMax exactly");
  assert.equal(probe.read("(_beats = 12.5, wasdBeatGlow())"), 0, "and is fully dark half a beat either side: ONE pulse per beat");
  // reduceMotion is inherited verbatim: OFF in free play (only the trainer ever kept a flash), so the void's bloom is
  // off there too and a reduced-motion player loses nothing they ever had.
  assert.equal(glowSandbox("reduceMotion = true;").read("wasdBeatCueOn()"), false, "free play under reduced motion: no cue, exactly as before wave 7");
  const train = glowSandbox("reduceMotion = true; trainMode = true;");
  assert.equal(train.read("wasdBeatCueOn()"), true, "the trainer keeps its functional colour cue");
  train.write("_beats = 12.05;");
  assert.equal(train.read("wasdBeatGlow()"), 0.45, "...as a DISCRETE flash inside 0.12 beat");
  train.write("_beats = 12.2;");
  assert.equal(train.read("wasdBeatGlow()"), 0, "...and nothing outside it");
});

test("CURSOR: the letter's bloom is a table lookup - zero per-frame allocation, and the colour is the key's own (W)", () => {
  // The glow reaches the DOM as one cached style write per STEP, never as a string built on the hot path.
  assert.match(html, /const GLYPH_GLOW_STEPS=12;/, "the quantisation is a named constant");
  const table = html.slice(html.indexOf("const GLYPH_GLOW=(()=>{"), html.indexOf("let _glyphGlowOwned"));
  assert.match(table, /const base='0 0 4px #000,0 0 10px rgba\(0,0,0,\.95\),0 2px 2px #000'/, "step 0 IS the stylesheet's own shadow stack");
  assert.match(html, /#wasdGlyph\{[^}]*text-shadow:0 0 4px #000,0 0 10px rgba\(0,0,0,\.95\),0 2px 2px #000/, "...and the stylesheet still says exactly that");
  assert.match(table, /currentColor/, "the bloom rides `color`, which showWasdGlyph already sets from WASD_COL - the hue law is inherited, never copied");
  const show = extractFunction("showWasdGlyph");
  assert.match(show, /setStyle\(wasdGlyphEl,'textShadow', GLYPH_GLOW\[glow>=1\?GLYPH_GLOW_STEPS:Math\.round\(glow\*GLYPH_GLOW_STEPS\)\]\);/, "the per-frame write is an INDEX, not a concatenation");
  assert.ok(!/toFixed/.test(show), "no string arithmetic anywhere in the per-frame path");
  assert.match(show, /else if\(_glyphGlowOwned\)\{ _glyphGlowOwned=false; setStyle\(wasdGlyphEl,'textShadow',''\); \}/, "and a single boundary write hands the element back to the stylesheet");
  // The crosshair only owns the letter where the floor it replaces is gone.
  assert.match(html, /const cueGlow=\(_cueMax>0 && wasdBeatCueOn\(\) && moonlineVoid\(\)\) \? wasdBeatGlow\(\)\/_cueMax : -1;/, "the void is the surface test, and -1 means 'not mine'");
  assert.match(html, /cueGlowPx\s*:\s*26\b/, "cueGlowPx is a flat CFG.moonline knob");
});

// ---------------------------------------------------------------------------------------------------------------------
// THE MOONLINE - THE BREATH (SPEC_MOONLINE section 1.1, wave 8.1).
// First light: "the playing field was the color and it had a mesmerizing increase in saturation up until the correct fire
// time, and that helped gauge timing - without it, it's hard." The pre-wave-7 FLOOR WASH is restored on the ribbon: the
// same curve, the road's own latency-corrected clock, the shipped gate, and not one gameplay number touched.
// ---------------------------------------------------------------------------------------------------------------------

test("THE BREATH: the recovered curve, the road's own clock, and zero gameplay math (8.1)", () => {
  // THE AMPLITUDE IS THE RECOVERED ONE, not a new taste: CFG.moonline.breathMax defaults to CFG.floorBeatMax exactly.
  const cfg = extractCfg();
  assert.equal(cfg.moonline.breathMax, 0.45);
  assert.equal(cfg.moonline.breathMax, cfg.floorBeatMax, "the ribbon swells by the amount the floor swelled by");
  assert.match(html.match(/moonline\s*:\s*\{[^}]+\}/)[0], /breathMax\s*:\s*0\.45\b/, "flat, like every other moonline knob");

  // ONE CURVE, THREE RENDERERS. The breath reads beatSwell() - the same object the floor and the crosshair read.
  const breath = extractFunction("roadBreath");
  assert.match(breath, /return beatSwell\(Math\.max\(0,\+CFG\.moonline\.breathMax\|\|0\), Math\.abs\(r-Math\.round\(r\)\)\);/,
    "the curve is the shared one and the phase is |r - round(r)|, the law the floor measured by");
  assert.match(breath, /if\(!wasdBeatCueOn\(\)\) return 0;/, "the gate is the shipped floor-beat gate, whole");
  assert.doesNotMatch(breath, /Math\.max\(0,1-|env\*env/, "the curve is NOT transcribed a second time here");
  assert.equal((html.match(/function roadBreath\(/g) || []).length, 1, "the breath's driver exists exactly once");
  assert.equal((html.match(/=roadBreath\(r\);/g) || []).length, 1, "...and is called from roadSync's per-frame write and nowhere else");

  // THE CLOCK. roadBeatNow() = wasdBeatsHeard() + freeze = ticks/PPQ - audioLat()/bps: the RAW heard beat, which is the
  // clock the pre-wave-7 wash used (Tone.Transport.ticks/PPQ, before grooveFreezePhase existed) plus the one correction
  // every cue now carries. Replayed, not asserted - and the freeze cancels itself, so grooveGroove cannot move the peak.
  for (const grooveGroove of [true, false]) {
    const clock = vm.createContext({ Math, Number, CFG: { grooveGroove, grooveFreezePhase: 0.5 }, state: { bpm: 120 },
      Tone: { Transport: { ticks: 0, PPQ: 192 } }, audioLat: () => 0.05 });
    vm.runInContext(["wasdBeats", "wasdBeatsHeard", "roadBeatNow"].map(extractFunction).join("\n"), clock);
    for (const ticks of [0, 192, 480, 1000]) {
      clock.Tone.Transport.ticks = ticks;
      assert.equal(vm.runInContext("roadBeatNow()", clock).toFixed(9), (ticks / 192 - 0.1).toFixed(9),
        `roadBeatNow is the raw beat minus the latency (ticks=${ticks}, grooveGroove=${grooveGroove})`);
    }
  }
  // ...and the ribbon's own geometry agrees with it by construction: the shader's beat at u metres is b = uNow + u/MPB,
  // so b is integral at the now-line (u = 0) exactly when r is. One clock, one surface.
  assert.match(html, /INV=_roadG\(1\/ROAD_MPB\)/);
  assert.match(html, /float b=uNow\+u\*'\+INV\+';/);

  // THE ENVELOPE, replayed against a hand transcription of the pre-wave-7 expression at every offset in the beat.
  const probe = glowSandbox();
  const shipped = (off) => { const env = Math.max(0, 1 - off * 2); return 0.45 * env * env; };
  for (let n = 0; n <= 100; n += 1) {
    const r = 7 + n / 200, off = Math.abs(r - Math.round(r));
    assert.equal(probe.read(`roadBreath(${r})`), shipped(off), `breath at |off| = ${off.toFixed(3)}`);
  }
  assert.equal(probe.read("roadBreath(7)"), 0.45, "it peaks ON the beat, at breathMax exactly");
  assert.equal(probe.read("roadBreath(7.5)"), 0, "and is fully dark half a beat either side: ONE swell per beat");
  assert.equal(probe.read("(CFG.moonline.breathMax = 0, roadBreath(7))"), 0, "breathMax 0 rests the ribbon at its shipped brightness");

  // THE REDUCED-MOTION STANCE IS THE ORIGINAL'S, inherited rather than restated: the pre-wave-7 wash was OFF in free play
  // under reduced motion, and roadSync only reaches roadBreath where roadLive() is true, i.e. where trainMode is false.
  assert.equal(glowSandbox("reduceMotion = true;").read("roadBreath(7)"), 0, "no breath under reduced motion in free play");
  assert.equal(glowSandbox("MOBILE = true;").read("roadBreath(7)"), 0, "...nor on mobile, which the shipped gate also excluded");
  assert.equal(glowSandbox("CFG.floorBeat = false;").read("roadBreath(7)"), 0, "...and CFG.floorBeat still silences the whole cue");

  // THE SURFACE: one multiply on the ink every element of the ribbon is already summed into, in the MOONLINE branch only.
  const a = html.indexOf("fragmentShader:(ML_RIBBON?["), w0 = html.indexOf("]:[", a);
  const ribbon = html.slice(a, w0), wave7 = html.slice(w0, html.indexOf("]).join('\\n') });", w0));
  assert.match(ribbon, /'  ink\*=1\.0\+uBreath;',/, "the ribbon swells as one body - rails, crossbars, cells and the now-line together");
  assert.ok(!wave7.includes("uBreath"), "wave 7's branch never learned the word, so moonline.on:false compiles the shader it shipped");
  assert.match(html, /uBeat0:\{value:0\}, uBreath:\{value:0\},/, "the uniform is declared once, beside the clock it rides");
  assert.match(extractFunction("roadSync"), /if\(ML_RIBBON\) U\.uBreath\.value=roadBreath\(r\);/, "one float, behind the build-time switch");
  const sync = extractFunction("roadSync");
  assert.ok(sync.indexOf("U.uBreath.value=roadBreath(r)") < sync.lastIndexOf("if(reduceMotion){"),
    "written BEFORE the reduceMotion fork, so a standing road is never left holding a stale swell");
  assert.doesNotMatch(sync, /new [A-Z]/, "roadSync still allocates nothing");

  // THE GATES RIDE IT at lower amplitude, on the ribbon's OWN uniform object - one uniform, no new pass, per VERTEX.
  assert.equal(loadRoadGeom(true, false).read("ML_ARCH_BREATH"), 0.45);
  assert.match(extractFunction("buildRoadArches"), /uP:U\.uP, uBreath:U\.uBreath,/, "the arches share the object, so they cannot be a frame out of step");
  assert.match(html, /\(ML_DOOR_CROSS\?'\(uBreath\+'\+_roadG\(reduceMotion\?0\.06:ML_CROSS_LIFT\)\+'\*crossEnv\)':'uBreath'\)\+'\*'\+_roadG\(ML_ARCH_BREATH\)\+'\);/, "...keeps the old uBreath arm and adds the crossing inside ML_ARCH_BREATH's existing vertex path");
  assert.equal(loadRoadGeom(true, false).read("_roadG(ML_ARCH_BREATH)"), "0.45000", "...emitted as a GLSL float literal, not an int");
  assert.match(html, /'uniform float uNow,uArchN0,uArchH,uArchGlow,uMercyRB,uReflect,uAmt,uBreath'\+\(ML_DOOR_CROSS\?',uWallCross,uPulse':''\)\+';/);

  // ZERO GAMEPLAY MATH, and the TRAINER'S FLOOR IS UNTOUCHED: the two surfaces still cannot both run, and the floor path
  // is the same two lines it was before this wave.
  assert.doesNotMatch(breath, /state\.|_road|spawn|judge|score|streak/i, "roadBreath reads the clock and the knob, and nothing else");
  const floor = extractFunction("updateFloorBeat");
  assert.match(floor, /const floorCueOn=wasdBeatCueOn\(\) && !roadLive\(\);/, "the floor still asks !roadLive()");
  assert.match(floor, /amt=wasdBeatGlow\(\);/, "...and still reads the letter's clock, not the road's");
  assert.ok(!floor.includes("roadBreath") && !floor.includes("breathMax"), "the trainer's floor knows nothing about the ribbon's breath");
});

test("TETHERS: a pooled thread per star-bound Echo, bounded by patternConcurrency, allocating nothing (W)", () => {
  const cfg = extractCfg();
  // SPEC section 5: "line pool bounded by patternConcurrency, zero per-spawn allocation". The spawn gate is `active < C`,
  // so C-1 Echoes are live when it opens and a poly/dealt PAIR issues two on that one Draw: C+1 is the field's true ceiling.
  assert.match(html, /const ML_TETH_N=Math\.max\(1,\(\+CFG\.patternConcurrency\|\|3\)\|0\)\+1;/, "the pool IS patternConcurrency, plus the pair overshoot");
  assert.equal(loadRoadGeom(true, false).read("ML_TETH_N"), (cfg.patternConcurrency | 0) + 1, "4 threads at the shipped concurrency of 3");
  const step = extractFunction("updateStarTethers");
  assert.ok(!/\bnew\s+[A-Z]/.test(step), "not one allocation on the per-frame path");
  assert.match(step, /n<ML_TETH_N/, "the loop is hard-capped at the pool: an overflow drops the THREAD, never the orb");
  assert.match(extractFunction("ensureStarTethers"), /new THREE\.LineSegments/, "ONE LineSegments for the whole field - one draw call, not one per orb");
  assert.equal((extractFunction("ensureStarTethers").match(/new Float32Array\(ML_TETH_N\*6\)/g) || []).length, 2, "position + colour, sized once and never grown");
  assert.match(step, /if\(_tethMesh && _tethMesh\.visible\) _tethMesh\.visible=false; return;/, "an off parcel returns before it ever builds anything");
  assert.match(step, /if\(m\.visible!==\(n>0\)\) m\.visible=\(n>0\);/, "visibility is a boundary write, never a per-frame one");
});

test("THE GOLDEN THREAD: gold, constant, and it stops re-stating the open window (Y2a, 8.2)", () => {
  const step = extractFunction("updateStarTethers");
  const on = loadRoadGeom(true, false);
  // (a) THE IDLE THREAD IS PERSISTENT AND CONSTANT. SPEC_MOONLINE section 1.2 overrides section 5's window-driven law:
  // the alpha depends on nothing inside the loop, so it is hoisted OUT of it, which is the structural proof that no
  // per-orb, per-beat quantity can reach it.
  assert.match(step, /const a=Math\.max\(0,\+CFG\.moonline\.tetherGlow\|\|0\)\*ML_TETH_IDLE, f=a\*ML_TETH_FAR;/, "one alpha for the whole field, from the knob and one constant");
  assert.ok(step.indexOf("ML_TETH_IDLE") < step.indexOf("for(let t=0"), "...computed before the loop, because nothing in the loop can change it");
  assert.doesNotMatch(step, /material\.opacity/, "the shell's opacity is not read here at all any more");
  assert.doesNotMatch(step, /userData\.shell/, "...nor is the shell");
  for (const forbidden of [/_openAmt/, /_fillAmt/, /grooveOpenSec/, /grooveFireEarlyBeat/, /audioLat/, /Tone\.Transport/, /reduceMotion/])
    assert.doesNotMatch(step, forbidden, `the tether reads no cue quantity at all (${forbidden})`);
  // (b) THE COLOUR IS ML_GOLD ITSELF, decomposed - not a second copy of a colour this world already has.
  assert.match(html, /const ML_TETH_RGB=\[\(\(ML_GOLD>>16\)&255\)\/255,\(\(ML_GOLD>>8\)&255\)\/255,\(ML_GOLD&255\)\/255\];/, "the thread is made of the arches' own gold");
  for (const [i, want] of [[0, "1.000"], [1, "0.925"], [2, "0.800"]])
    assert.equal(on.read("ML_TETH_RGB[" + i + "]").toFixed(3), want, "ML_GOLD 0xffeccc, channel " + i);
  assert.equal(on.read("ML_GOLD"), 0xffeccc, "...and it is literally the arches' constant, read not copied");
  // (c) THE NUMBER. Idle alpha = tetherGlow x ML_TETH_IDLE, against the window-driven cue it replaces, whose swing was
  // k x shellOpacity over [openShellOpacityFloor 0.04, openShellOpacityPeak 0.42].
  const cfg = extractCfg(), k = cfg.moonline.tetherGlow, idle = on.read("ML_TETH_IDLE");
  assert.equal(idle, 0.18);
  const a = k * idle;
  assert.equal(a.toFixed(3), "0.162", "the idle thread delivers 0.162 gold at the orb end");
  assert.equal((k * cfg.openShellOpacityFloor).toFixed(3), "0.036", "the old thread's trough - invisible");
  assert.equal((k * cfg.openShellOpacityPeak).toFixed(3), "0.378", "...and its peak, as bright as a road rail, once a beat, forever");
  assert.equal((a / (k * cfg.openShellOpacityPeak)).toFixed(2), "0.43", "the constant is 43% of what the flicker peaked at");
  // ...and 2.3-2.7x its TIME-AVERAGE: a triangular window of half-width win seconds about each beat, over a floor of 0.04.
  const mean = (win, bpm) => { const T = 60 / bpm, duty = Math.min(1, 2 * win / T); return k * (duty * (cfg.openShellOpacityFloor + (cfg.openShellOpacityPeak - cfg.openShellOpacityFloor) * 0.5) + (1 - duty) * cfg.openShellOpacityFloor); };
  assert.equal(mean(0.32, 20).toFixed(4), "0.0725", "the old cue averaged 0.0725 at the 20 bpm floor");
  assert.equal(mean(0.15, 60).toFixed(4), "0.0873", "...and 0.0873 at the sixty cap");
  assert.equal((a / mean(0.32, 20)).toFixed(1), "2.2", "the constant thread carries 2.2x that at 20 bpm");
  assert.equal((a / mean(0.15, 60)).toFixed(1), "1.9", "...and 1.9x at 60");
  // The far end still fades, so the thread points home without competing with the star it points at.
  assert.equal(on.read("ML_TETH_FAR"), 0.12);
  assert.match(step, /ca\[j\+3\]=f0; ca\[j\+4\]=f1; ca\[j\+5\]=f2;/, "star end = orb end x ML_TETH_FAR");
  // SKY HONESTY (SPEC section 1): the TRUE current position, from the one function that knows it.
  assert.match(step, /const w=starWorldAt\(i,_tethW\)/, "the star end is starWorldAt() - the same reader the returning voice uses");
  assert.match(step, /const i=_starLitIdx\[tg\.starId\]; if\(i===undefined\) continue;/, "a bind the fixture cannot draw gets no thread");
  // FALLBACK ORBS GET NO TETHER.
  assert.match(step, /if\(tg\.dead \|\| !tg\.starId\) continue;/, "no bearing, no thread");
  // KILL-SWITCH: the void first, which reads moonline.on and road.on first in turn.
  assert.match(extractFunction("starTetherLive"), /return moonlineVoid\(\) && !!\(CFG\.stars && CFG\.stars\.on\) && \(\+CFG\.moonline\.tetherGlow\|\|0\)>0/, "master switch first, then the sky spine's, then the knob");
  assert.match(html, /tetherGlow\s*:\s*0\.9\b/, "tetherGlow is a flat CFG.moonline knob");
  assert.ok(html.indexOf("try{ updateTargetMarks();") < html.indexOf("try{ updateStarTethers();"), "and the thread is stepped after the field it hangs in");
});

test("THE GOLDEN THREAD: a landed kill sends a pulse UP the thread, and the tick law never hears about it (Y2b, 8.2)", () => {
  const step = extractFunction("starFlyStep"), on = loadRoadGeom(true, false);
  // (a) THE PACKET. It travels along the orb->star path with a head at e and a tail ML_TETH_PULSE behind it, instead of
  // the old line that ran from the burst point to e and grew into the whole path.
  assert.equal(on.read("ML_TETH_PULSE"), 0.18);
  assert.equal(on.read("ML_TETH_PULSE_TAIL"), 0.15);
  assert.match(step, /const e0=Math\.max\(0,e-ML_TETH_PULSE\);/, "the tail is a fixed fraction of the path behind the head");
  assert.match(step, /pa\[0\]=f\.from\.x\+\(w\.x-f\.from\.x\)\*e0;/, "the packet's TAIL is on the path, not pinned to the burst point");
  assert.match(step, /pa\[3\]=f\.from\.x\+\(w\.x-f\.from\.x\)\*e;/, "...and its head is where the old line's head was");
  assert.doesNotMatch(step, /pa\[0\]=f\.from\.x;/, "the old fixed-tail line is gone");
  // Both ends are the TETHER's own two ends, so the packet cannot leave the thread it rides.
  assert.match(step, /const w=starWorldAt\(f\.i,_starW\)/, "star end: the same reader the idle thread uses");
  assert.match(extractFunction("updateStarTethers"), /const w=starWorldAt\(i,_tethW\)/, "...literally the same function");
  // (b) THE COLOUR RAMP is ML_GOLD, written ONCE at acquire exactly as the pale-white one was - no per-frame colour work.
  assert.match(step, /ca\[0\]=ML_TETH_RGB\[0\]\*ML_TETH_PULSE_TAIL;/, "dim gold tail");
  assert.match(step, /ca\[3\]=ML_TETH_RGB\[0\]; ca\[4\]=ML_TETH_RGB\[1\]; ca\[5\]=ML_TETH_RGB\[2\];/, "full ML_GOLD head");
  assert.doesNotMatch(step, /ca\[0\]=ca\[1\]=ca\[2\]=0; ca\[3\]=ca\[4\]=ca\[5\]=1;/, "the pale-white ramp is retired");
  assert.ok(step.indexOf("ca[0]=ML_TETH_RGB[0]") < step.indexOf("const p=f.age/f.life"), "...and it is still inside the once-per-acquire block");
  // (c) THE DURATION IS THE EXISTING ONE. The packet crosses in f.life, which is still lineBeats of gap time, and the
  // envelope is still the shipped one. The pulse is 2.2x the idle thread beside it: lineAlpha vs tetherGlow x IDLE.
  assert.match(extractFunction("starFlyDrain"), /f\.life=Math\.max\(0\.05,\(\+CFG\.stars\.lineBeats\|\|0\)\*spb\);/, "the flight duration is untouched");
  assert.match(step, /m\.material\.opacity=\(\+CFG\.stars\.lineAlpha\|\|0\)\*Math\.min\(1,\(1-p\)\*2\.5\);/, "so is the envelope");
  const cfg = extractCfg();
  assert.equal((cfg.stars.lineAlpha / (cfg.moonline.tetherGlow * on.read("ML_TETH_IDLE"))).toFixed(1), "2.2", "the head burns 2.2x the idle thread's alpha - and it is the only thing on the thread that moves");
  // (d) VISUAL ONLY: DIFF-PROVE that no starFly state machine changed. Nothing but the draw block may name the thread's
  // constants, and every law of SPEC_STAR_ROAD 1.3 is still where it was, character for character.
  for (const fn of ["starVoiceHome", "starGapBeat", "starFlyDrain", "starFlyRetire", "starFlyClear"]) {
    const src = extractFunction(fn);
    assert.doesNotMatch(src, /ML_TETH_|ML_GOLD|e0/, `${fn} knows nothing about the pulse`);
  }
  const drain = extractFunction("starFlyDrain");
  assert.match(drain, /if\(_starDebt\.length && _starDebtDue<=hb\)\{ for\(let k=0;k<_starDebt\.length;k\+\+\) if\(starLitGain\(_starDebt\[k\]\)===1\) sensei2Speak\('star'\); _starDebt\.length=0; _starDebtDue=0; \}/, "the debt is still paid first, with the level return only observed by Sensei");
  assert.match(drain, /if\(!_starPend\.length \|\| _starPend\[0\]\.due>hb\) return;/, "the due gate is unchanged");
  assert.match(drain, /if\(starLitGain\(p\.id\)===1\) sensei2Speak\('star'\);\s*\/\/ THE TICK, HERE AND UNCONDITIONALLY/, "the level is still PAID at the drain, above and outside any line-building");
  assert.match(drain, /if\(!\(reduceMotion \|\| i===undefined \|\| _starFly\.length>=_STAR_FLY_MAX\)\)\{/, "...and reduced motion still builds NO flight record - the existing no-line path, unchanged");
  assert.match(step, /starFlyDrain\(starBeatNow\(\)\);/, "the tick still runs ahead of the open-window freeze");
  assert.match(step, /if\(open\) return;/, "...and the freeze is still below it");
  assert.equal(on.read("ML_TETH_N") > 0, true, "the tether pool is untouched by any of this");
});

test("BEAT CIRCLE: default ON, and a stored preference still wins in BOTH directions (Y3, 8.2)", () => {
  assert.equal(extractCfg().wasdHud, true, "CFG.wasdHud false -> true: the never-set default");
  // THE PRECEDENCE, executed rather than read. Two tiny functions, one stubbed localStorage, all three paths.
  const src = extractFunction("wasdHudPref") + "\n" + extractFunction("applyWasdHudPref");
  const run = (stored, phaseDefault) => {
    const ctx = vm.createContext({ CFG: { wasdHud: extractCfg().wasdHud }, localStorage: { getItem: () => stored } });
    vm.runInContext(src + "\napplyWasdHudPref(" + JSON.stringify(phaseDefault) + ");", ctx);
    return ctx.CFG.wasdHud;
  };
  assert.equal(run(null, true), true, "FRESH PROFILE: nothing stored, the phase default is now true -> the ring is ON");
  assert.equal(run("0", true), false, "STORED OFF: an explicit opt-out beats the new default, in the direction that matters most");
  assert.equal(run("1", false), true, "STORED ON: an explicit opt-in beats a false phase default too - both directions");
  assert.equal(run("0", null), false, "...and a stored value does not need a phase to have an opinion");
  assert.equal(run(null, null), true, "BOOT: no phase opinion and nothing stored leaves the CFG default standing");
  // ...which is exactly the boot call, so the pause menu's BEAT CIRCLE row is honest before the first run ever starts.
  assert.match(html, /^applyWasdHudPref\(null\);/m, "the stored preference is applied at load, not only at resetSession");
  assert.ok(html.indexOf("applyWasdHudPref(null);") < html.indexOf("const on=!!CFG.wasdHud;"), "...before anything reads the flag");
  // The phase defaults that used to hand this function `false` are the sites that actually decided it, because
  // resetSession calls applySenseiFull on every non-trainer start. Flipping the CFG literal alone would be inert.
  assert.match(extractFunction("applySenseiFull"), /applyWasdHudPref\(true\);/, "the full night defaults ON");
  const phase = extractFunction("setTrainPhase");
  assert.equal((phase.match(/applyWasdHudPref\(/g) || []).length, 3, "one default per trainer phase, still");
  assert.match(phase, /applyWasdHudPref\(true\);\s*\n?\s*showTrainCoach\(T\('coachP0'/, "phase 0 was already true");
  assert.match(phase, /applyWasdHudPref\(!MOBILE\);/, "phase 1 keeps its touch guard");
  assert.doesNotMatch(phase, /applyWasdHudPref\(false\)/, "and phase 2's `false` is gone: one law, no blink");
  assert.doesNotMatch(html, /applyWasdHudPref\(false\)/, "no site anywhere still defaults the ring OFF");
  // THE CLOUD PREF IS THE SAME STORED PREFERENCE: the row writes localStorage FIRST, so the two arms above decide it.
  const cloud = extractFunction("applyCloudPrefsRow");
  const at = cloud.indexOf("row.wasd_hud");
  assert.match(cloud.slice(at), /localStorage\.setItem\('aimdojo\.wasdHud', row\.wasd_hud\?'1':'0'\);[\s\S]{0,120}applyWasdHudPref\(row\.wasd_hud\);/,
    "the Supabase value becomes the stored preference before it is applied - so a signed-in OFF survives this wave too");
  // Nothing writes the key on a player's behalf: the only setItem sites are the toggle and the cloud row's echo of it.
  assert.equal((html.match(/localStorage\.setItem\('aimdojo\.wasdHud'/g) || []).length, 2, "two writers, both of them the player");
});

test("THE BRISK LESSON: every phase gate halved again, rounded up, teaching untouched (wave 16)", () => {
  const on = vm.createContext({});
  vm.runInContext(html.split("\n").filter((l) => /^const TRAIN_NEED_/.test(l.trim())).map((l) => l.trim()).join("\n"), on);
  const got = (name) => vm.runInContext(name, on);
  // Old -> new, with the rounding rule applied to the OLD number rather than trusted.
  for (const [name, was] of [["TRAIN_NEED_WASD", 6], ["TRAIN_NEED_ORB1", 3], ["TRAIN_NEED_ORB2", 4]]) {
    assert.equal(got(name), Math.ceil(was / 2), `${name} ${was} -> ${Math.ceil(was / 2)} (half, rounded UP)`);
    assert.ok(got(name) >= 1, `${name} can never be 0 - a phase you pass by existing is not a phase`);
  }
  assert.equal(got("TRAIN_NEED_TOTAL"), 7, "a whole refresher is 7 qualifying events where the first halving left 13");
  assert.equal(got("TRAIN_NEED_ORB1"), 2, "the odd 3-gate rounds ceil(1.5) upward");
  // PACING ONLY. The phases still advance on these three counts and on nothing else - no timer, no duration gate.
  const wasdGate = extractFunction("noteTrainWasd"), orbGate = extractFunction("noteTrainOrb");
  assert.match(wasdGate, /if\(trainWasd>=TRAIN_NEED_WASD\) setTrainPhase\(1\);/, "phase 0 -> 1 on the count, as before");
  assert.match(orbGate, /if\(trainPhase===1 && trainOrbs>=TRAIN_NEED_ORB1\) setTrainPhase\(2\);/);
  assert.match(orbGate, /else if\(trainPhase===2 && trainOrbs>=TRAIN_NEED_ORB2\) setTrainPhase\(3\);/);
  for (const src of [wasdGate, orbGate])
    assert.doesNotMatch(src, /state\.t|Date\.now|performance\.now|dt\b/, "no phase has a duration gate to halve");
  // The phase-2 range ramp reads TRAIN_NEED_ORB2 as its own denominator, so it still reaches TRAIN_RANGE_FAR exactly at
  // graduation - in 2 kills instead of 4, by construction rather than by a second number.
  assert.match(orbGate, /const t=Math\.min\(1, trainOrbs\/TRAIN_NEED_ORB2\);/, "the ramp is tied to the phase, not to a literal");
  assert.match(orbGate, /state\.range=TRAIN_RANGE_NEAR \+ t\*\(TRAIN_RANGE_FAR-TRAIN_RANGE_NEAR\);/);
  // ...and the coach lines still read the constants, so the counter a player sees can never disagree with the gate.
  for (const src of [wasdGate, orbGate])
    assert.doesNotMatch(src, /\{n:\s*train\w+,\s*N:\s*\d/, "no hard-coded N in any progress line");
});

test("TETHERS: the void retires the orb-to-ground drop-line, and the trainer keeps it (W)", () => {
  // SPEC section 5: "the old orb-to-ground drop-line is fully retired from post-grad play (trainer keeps its look)",
  // read with section 1's "nothing beside the road but space". All three floor marks are ONE apparatus anchored to the
  // ground plane parcel T deleted; the .tgtKey label survives because it floats AT THE ORB.
  const marks = extractFunction("updateTargetMarks");
  assert.match(marks, /const vd=moonlineVoid\(\);/, "one predicate, hoisted - and it reads the master kill-switch first");
  assert.match(marks, /if\(vd\)\{ if\(m\.ring\.visible\) m\.ring\.visible=false; if\(m\.drop\.visible\) m\.drop\.visible=false; if\(m\.label\.classList\.contains\('on'\)\) m\.label\.classList\.remove\('on'\); \}/,
    "ring, drop-line and the floor distance label all go, and they go as latched writes");
  const vdAt = marks.indexOf("if(vd){"), hAt = marks.indexOf("if(tg._flickLocked)");
  assert.ok(vdAt > 0 && hAt > vdAt, "the orb-anchored .tgtKey label is OUTSIDE the void branch");
  assert.match(marks.slice(hAt), /m\.hlabel\.classList\.add\('on','held'\)/, "...and still says LOCK / remaining hits in the void");
  // moonlineVoid() is false in the trainer and under either kill-switch, so the room's floor HUD is the one that shipped.
  for (const off of ["CFG.moonline.on = false;", "CFG.road.on = false;", "trainMode = true;", "templeActive = true;"])
    assert.equal(loadVoidSandbox(off).read("moonlineVoid()"), false, `${off} keeps the floor HUD`);
});
