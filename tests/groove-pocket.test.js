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
      // THE FORTY FIX (parcel R): the lane reads its OWN ladder now, so the floor-tint sandbox must carry it. diffT() is stubbed at 0 below,
      // so wasdNoteDiv() returns 1 exactly as the old inline beatQuantT expression did — every expectation in these tests is unchanged.
      wasdNoteDivs: [2, 4, 8],
      wasdNoteT: [0.75, 1.01],
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
  vm.runInContext(`${extractFunction("wasdNoteDiv")}; ${extractFunction("updateFloorBeat")}; updateFloorBeat();`, context);
  return { amount: amount.value, color: seen.color };
}

test("THE FORTY FIX: the lane demands exactly one key per beat across 20-50 bpm and never four (R)", () => {
  const cfg = extractCfg();
  assert.equal(cfg.wasdNoteDivs.join(","), "2,4,8", "lane divs mirror the strobe's shape");
  assert.equal(cfg.wasdNoteT.join(","), "0.75,1.01", "lane thresholds are the lane's own: 50.0 bpm, then off the top of the world");
  assert.equal(cfg.beatQuantT.join(","), "0.4,0.75", "the ORB STROBE's audited 36/50 deepening is untouched by the decoupling");

  const context = vm.createContext({ Math, Number, CFG: cfg });
  vm.runInContext(extractFunction("wasdNoteDiv"), context);
  // diffT() verbatim (index.html): clamp((bpm-minBpm)/(maxBpm-minBpm)) — linear in tempo, so a threshold IS a tempo.
  const diffT = (bpm) => Math.max(0, Math.min(1, (bpm - cfg.minBpm) / (cfg.maxBpm - cfg.minBpm)));
  const nd = (bpm) => vm.runInContext(`wasdNoteDiv(${diffT(bpm)})`, context);

  for (let bpm = 20; bpm < 50; bpm += 0.5) assert.equal(nd(bpm), 1, `one demanded press per beat at ${bpm} bpm`);
  for (let bpm = 50; bpm <= 60; bpm += 0.5) assert.equal(nd(bpm), 2, `mains stay one per beat with one optional ghost at ${bpm} bpm`);
  assert.equal(nd(60), 2, "the summit never asks for four presses a beat (240/min is a mash test)");
  assert.equal(nd(1e6), 2, "diffT clamps at 1.00, so wasdNoteT[1]=1.01 is out of the world by construction");
});

test("DE-COERCION: an in-between note is claimable but cannot break the combo (R)", () => {
  // The lane draw ghosts a bonus note (dim ring + dim letter) and animate's combo reset is gated on _curMain.
  assert.match(html, /const lw=main\?4\.5:2\.0, ghost=main\?1:0\.45;/, "bonus ring renders as a ghost");
  // laneCue is THE STAR ROAD's note-lane gate (wave 7, parcel S) — !roadLive(), so it is `true` with road.on:false and the
  // ghost/dim contract below is unchanged. The de-coercion this test guards is the ghostNote argument, still last and still there.
  assert.match(html, /showWasdGlyph\(letterKey, spoiled, laneCue && \(CFG\.wasdLetter \|\| reduceMotion\) && !hitHeld, ghostNote\)/, "bonus letter renders as a ghost");
  assert.match(html, /if\(_curCi>=0 && !_resolved\.has\(_curCi\) && _curMain\)\{ _baseMul=1; _wasdCombo=0; \}/, "only a MAIN going unresolved zeroes the bonus combo");
  assert.match(html, /else if\(acc>0\) _wasdCombo\+\+;/, "claiming a bonus note still credits the combo");
  // 6 -> 8: THE MEANING (wave 7, parcel S2) added two READERS of the lane's density — roadLaneAt (which beat-band shows
  // which key) and roadWakeLatch (is this resolved note a MAIN?). Both call the one helper, which is what this line pins;
  // the "no duplicated inline density expression survives" assertion below is the half that must never move.
  assert.equal((html.match(/nd=wasdNoteDiv\(\)/g) || []).length, 8, "every inline note-density computation calls the one helper");
  assert.equal((html.match(/nd=Math\.max\(1,spb\/2\)/g) || []).length, 0, "no duplicated inline density expression survives");
  assert.equal((html.match(/spb=dT<t\[0\]\?d\[0\]:\(dT<t\[1\]\?d\[1\]:d\[2\]\)/g) || []).length, 1, "the one surviving tier expression is the ORB STROBE's own");
});

test("THE MEANING: the note lane stands down on the flag that DRAWS the lane, and only then (S)", () => {
  // A cue may be MOVED into the world, never merely deleted from the crosshair. THE RIVER shipped ROAD_LANE_READY=false
  // because it carried no required-lane channel; THE MEANING draws the band tint AND the mid-band glyph, so the switch is
  // now bound to the very CFG flag that draws them. Bound, not merely flipped: bandGlyphs:false must put the centre letter
  // straight back, in the same read, with no second place to forget.
  assert.match(html, /const ROAD_LANE_READY=!!\(CFG\.road && CFG\.road\.bandGlyphs\) && ROAD_GLYPH_PASS;/, "the switch IS the draw flags — both of them");
  assert.match(html, /uGlyphOn:\{value:\(CFG\.road\.bandGlyphs\?1:0\)\}/, "…and that same flag is what the shader gates the glyph on");
  // Parcel U's fix: LOW does not COMPILE the glyph pass, so on LOW the road cannot carry the letter and the crosshair must
  // take it back. Bound, not merely flipped — the second term is the very boolean the shader emitter reads.
  assert.match(html, /const ROAD_GLYPH_PASS=!\(ML_RIBBON&&LOW\);/, "the pass is dropped only where the ribbon meets LOW");
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
  // that is 0.400 note-intervals, so band n-1's note (at R = n-0.5) closes at R = n-0.1 and band n's opens at R = n+0.1:
  // a 0.200-beat dead zone straddles every band edge. THE WAKE is written once, at the edge, and can never be a lie.
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
  assert.equal(minDead.toFixed(3), "0.200", "and it is 0.200 beat wide everywhere under the sixty cap");
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
  assert.match(html, /if\(r<_roadLastR-0\.5\) roadWakeReset\(\);/, "a backwards clock still empties the ring first");
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
  const lines = html.split("\n").filter((line) => /^const (ROAD_[A-Z0-9_]+|ML_RIBBON|_roadG)\b/.test(line.trim()));
  assert.ok(lines.length > 12, "the road's constant block is where it always was");
  return lines.map((line) => line.trim()).join("\n");
})();

function loadRoadGeom(moonline, low) {
  const context = vm.createContext({
    Math, Number, console, EYE: 4, LOW: !!low, camera: { far: 700 },
    CFG: {
      road: { on: true, lookAheadBeats: 8, widthM: 14, bandGlyphs: true, mercyBoost: 1.6, fillMark: true, holdDemo: false },
      moonline: { on: moonline, metersPerBeat: 27, drawBeats: 32, impostorMinStraight: 0.55, impostorInk: 0.9 },
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

test("THE RIBBON: LOW pays for NO glyph pass, and the crosshair takes the letter back (U)", () => {
  // The FRAME BUDGET comment claims LOW runs "no glyph pass". A uniform gate would NOT have been one: uGlyphOn:0 still
  // pays the footprint test on every road fragment. So the claim is only true if the TEXT is never emitted - which is
  // what this pins, both directions.
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
  assert.match(outside, /uniform float uNow,uAmt,uPulse,uBeat0,uGlyphOn,uMercyB;/, "the declaration line is the shipped one");
  assert.match(outside, /uniform sampler2D uBands,uGlyph;/, "...and so does the sampler it never binds on LOW");
  // The one dependent texture fetch in the whole ribbon shader is the glyph's; the band table's two reads are not.
  assert.equal((ribbon.match(/texture2D\(/g) || []).length, 3, "two band texels plus the one glyph fetch, and no more");
  // The budget comment states this in the same words the code now honours.
  assert.match(html, /and NO GLYPH PASS:\s*\n\s*the mid-cell letter is not emitted into the shader text at all \(ROAD_GLYPH_PASS/, "the LOW-REZ budget line says it plainly, and says HOW");
  // THE CUE IS MOVED, NEVER DELETED: wherever the road stops carrying the letter, laneCue puts it back at the crosshair.
  // ROAD_LANE_READY is the one read both sides share, so the four (moonline x LOW) corners settle it.
  assert.equal(loadRoadGeom(true, false).read("ROAD_LANE_READY"), true, "the ribbon at full rez carries the letter");
  assert.equal(loadRoadGeom(true, true).read("ROAD_LANE_READY"), false, "the ribbon on LOW does NOT, so the crosshair does");
  assert.equal(loadRoadGeom(false, false).read("ROAD_LANE_READY"), true, "wave 7 is untouched");
  assert.equal(loadRoadGeom(false, true).read("ROAD_LANE_READY"), true, "...on LOW too - the kill-switch owes wave 7 the glyph its own LOW path drew");
  assert.equal(loadRoadGeom(false, true).read("ROAD_GLYPH_PASS"), true, "moonline.on:false compiles the pass on every tier");
  assert.equal(loadRoadGeom(true, true).read("ROAD_GLYPH_PASS"), false, "and only the ribbon on LOW omits it");
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
  assert.match(sync, /let t=\(st-mn\)\/Math\.max\(1e-6,\(1-mn\)\*0\.5\);/);
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
  assert.match(html, /depthWrite:!moonlineOn\(\), depthTest:true/, "...because the shell stops WRITING depth, and never stops testing it");
  // The kill-switch is a compile-time fork: wave 7's shader text is still there, unedited, including the terms the
  // wireframe does not have (its own antialiasing law, its band edge, its solid-band ink).
  const wave7 = html.slice(html.indexOf("]:[", html.indexOf("fragmentShader:(ML_RIBBON?[")));
  assert.match(wave7, /float aa='\+\(LOW\?'1\.10':'0\.30\+d\*0\.020'\)\+';'/);
  assert.match(wave7, /float ribbon=1\.0-smoothstep\('\+HW\+'-aa,'\+HW\+'\+aa,lat\); if\(ribbon<=0\.004\) discard;/);
  assert.match(wave7, /float fb=fract\(b\), e=min\(fb,1\.0-fb\);/);
  assert.match(wave7, /gl_FragColor=vec4\(col\*ink, ribbon\*fade\*uAmt\);/);
});
