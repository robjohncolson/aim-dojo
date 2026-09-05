"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const { sourceText: html } = require("./source.js");
const wave18Fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "moonline-wave18-shaders.fixture.json"), "utf8"));

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

function mutationMustFail(assertContract, mutation, message) {
  assert.notEqual(mutation, html, `${message} is constructible`);
  assert.throws(() => assertContract(mutation), assert.AssertionError, message);
}

function loadHelpers(filename, expression) {
  const source = fs.readFileSync(path.join(__dirname, filename), "utf8");
  const context = vm.createContext({ __dirname, require: (id) => id === "node:test" ? (() => {}) : require(id) });
  new vm.Script(`${source}\nthis.helpers=${expression};`, { filename }).runInContext(context);
  return context.helpers;
}

function fingerprint(sources) {
  const result = {};
  for (const [name, source] of Object.entries(sources)) result[name] = source == null ? null : { chars: source.length, sha256: crypto.createHash("sha256").update(source).digest("hex") };
  return result;
}

function emittedDoorFamily(source, doorCross, reduced = false) {
  const terrain = loadHelpers("moonline-terrain.test.js", "{emitWave9RoadShaders,emitWave9NaveShaders}");
  const inverse = loadHelpers("moonline-inverse.test.js", "{emittedWallFamily,inverseOptions}");
  const road = terrain.emitWave9RoadShaders(source, { mark: true, terrain: true, bite: true, live: true, walls: true, wallSat: 1, wallExhale: 1, wallEcho: true, mercyInverse: true, doorCross, reduceMotion: reduced });
  const nave = terrain.emitWave9NaveShaders(source, { mark: true, terrain: true, bite: true, walls: false, doorCross, reduceMotion: reduced });
  const options = inverse.inverseOptions({ doorCross });
  const high = inverse.emittedWallFamily(source, options, { reduced });
  const low = inverse.emittedWallFamily(source, options, { low: true, reduced });
  const take = (family, prefix) => ({
    [`${prefix}WallVertex`]: family.wallMat.vertexShader,
    [`${prefix}WallFragment`]: family.wallMat.fragmentShader,
    [`${prefix}InverseVertex`]: family.inverseMat.vertexShader,
    [`${prefix}InverseFragment`]: family.inverseMat.fragmentShader,
    [`${prefix}AccentVertex`]: family.accentMat.vertexShader,
    [`${prefix}AccentFragment`]: family.accentMat.fragmentShader,
    [`${prefix}VeilVertex`]: family.veilMat && family.veilMat.vertexShader,
    [`${prefix}VeilFragment`]: family.veilMat && family.veilMat.fragmentShader,
  });
  return {
    roadVertex: road.roadVertex, roadFragment: road.roadFragment, roadSocketFragment: road.roadSocketFragment,
    naveVertex: nave.naveVertex, naveFragment: nave.naveFragment, naveAccentFragment: nave.naveAccentFragment,
    ...take(high, "high"), ...take(low, "low"),
  };
}

function runDoorCross(source, { live = true, train = false, temple = false, sound = true, ready = true, reduced = false } = {}) {
  const sweep = [], frequency = [], padNotes = [], snaps = [];
  const context = vm.createContext({
    Math, Number, ML_DOOR_CROSS: true, ML_ARCH_EVERY: 4, ML_CROSS_LIFT: 0.18, ML_CROSS_BEATS: 1,
    DOOR_WHOOSH_DB: -26, DOOR_WHOOSH_SEC: 0.22, DOOR_WHOOSH_HZ: [520, 140],
    CFG: { tide: { on: true, riseBars: 6, peakBars: 2, mercyBars: 1, padPeakVel: 0.12 } },
    _roadTide0: { m: 0, i: 1 }, _roadTideR: { m: 0, i: 1 }, _wallCross: { value: -1e9 },
    roadMat: { uniforms: { uNow: { value: 0 }, uPulse: { value: 0 } } }, reduceMotion: reduced,
    roadLive: () => live, trainMode: train, templeActive: temple, soundOn: sound, toneReady: ready,
    doorWhoosh: {
      triggerAttackRelease(...args) { sweep.push(args); },
      frequency: {
        cancelScheduledValues(...args) { frequency.push(["cancel", ...args]); },
        setValueAtTime(...args) { frequency.push(["set", ...args]); },
        linearRampToValueAtTime(...args) { frequency.push(["ramp", ...args]); },
      },
    },
    pad: { triggerAttackRelease(...args) { padNotes.push(args); } }, CHORD_TRIAD: [[110, 132, 165]],
    beatSnap: () => { snaps.push(1); return 10; }, sweep, frequency, padNotes, snaps,
  });
  context.padChord = (...args) => context.pad.triggerAttackRelease(...args);
  vm.runInContext(`${extractFunction(source, "roadTideAt")}\n${extractFunction(source, "doorCross")}\nthis.cross=function(bar,clock){ roadMat.uniforms.uNow.value=clock; roadMat.uniforms.uPulse.value=clock+100; doorCross(bar); return _wallCross.value; };`, context);
  return context;
}

function runRoadLatch(source, beats) {
  const crossed = [], resets = [];
  const uniform = (value = 0) => ({ value }), U = { uNow: uniform(), uPulse: uniform(), uBeat0: uniform(), uGlyph: uniform(null), uGlyphOn: uniform(), uMercyB: uniform(), uBreath: uniform() };
  let now = 0;
  const context = vm.createContext({
    GH_CHALK: false,
    Math, Number, CFG: { road: { bandGlyphs: false, mercyBoost: 1 }, moonline: { breathMax: 0 } },
    ML_DOOR_CROSS: true, ML_ARCH_EVERY: 4, ML_RIBBON: false, ML_TERRAIN: false, ML_WALLS: false, ML_WALL_ECHO: false, ROAD_GLYPH_PASS: false, ROAD_WAKE: 14, ROAD_ALPHA: 0.55, ML_HEADING_KEEP: 0,
    trainMode: false, templeActive: false, reduceMotion: false, roadMesh: { visible: true }, roadMat: { uniforms: U }, roadSocket: null, roadImp: null, roadArch: null, roadDust: null, roadArchAccent: null, roadWall: null, roadWallAccent: null, roadWallVeil: null, roadVault: null, roadNaveVeil: null,
    _roadVis: true, _roadUp: true, _roadInkIdx: 0, gridColIdx: 0, _roadInk: { setHex() {} }, GRID_COLS: [[1]], _roadLastR: -1e9, _roadBeat0: NaN, _roadBar0: NaN, _wallCross: { value: 77 },
    _roadBase: { set() {} }, camera: { far: 0, updateProjectionMatrix() {} }, crossed, resets,
    roadLive: () => true, roadBeatNow: () => now, roadWakeLatch() {}, roadWakeReset() { resets.push(now); }, roadJudgeStamp() {}, roadWakeWrite() {}, roadBandFill() {}, roadArchFill() {}, roadBreath: () => 0, roadImpSync() {}, roadHorizonSync() {}, roadCourseX: () => 0, roadCourseD: () => 0,
    doorCross(bar) { crossed.push([bar, U.uNow.value]); },
  });
  vm.runInContext(`${extractFunction(source, "roadSync")}\nthis.sync=roadSync;`, context);
  for (const beat of beats) { now = beat; context.sync(); }
  return { crossed: Array.from(context.crossed, (entry) => Array.from(entry)), resets: Array.from(context.resets), stamp: context._wallCross.value };
}

test("Door-cross switch alone restores the frozen Wave 18 shader family", () => {
  const assertContract = (source) => {
    assert.match(source, /doorCross:1(?:,|\s)/, "the shipped knob is one flat literal");
    assert.match(source, /const ML_DOOR_CROSS=ML_NAVE && !!\(CFG\.moonline && CFG\.moonline\.doorCross\);/);
    const off = fingerprint(emittedDoorFamily(source, false));
    assert.deepEqual(off, wave18Fixture, "doorCross:0 preserves every frozen road/nave/wall shader byte");
    assert.doesNotMatch(emittedDoorFamily(source, false).naveVertex, /uWallCross|crossEnv/);
    assert.notDeepEqual(fingerprint(emittedDoorFamily(source, true)), wave18Fixture, "the switch alone owns a visible emission");
  };
  assertContract(html);
  const mutation = html.replace("const ML_DOOR_CROSS=ML_NAVE && !!(CFG.moonline && CFG.moonline.doorCross);", "const ML_DOOR_CROSS=ML_NAVE && !!(CFG.moonline && CFG.moonline.wallEcho);");
  mutationMustFail(assertContract, mutation, "the alone fixture kills a doorCross/wallEcho cross-wire");
});

test("Door bloom shares one stamp, adds to arch breath, and is bounded to visible wall above deck", () => {
  const assertContract = (source) => {
    const live = emittedDoorFamily(source, true), still = emittedDoorFamily(source, true, true);
    assert.match(source, /const _wallCross=\{value:-1e9\};/);
    assert.match(extractFunction(source, "buildRoadArches"), /uWallCross:_wallCross,uPulse:U\.uPulse/);
    assert.match(extractFunction(source, "buildRoadWalls"), /uWallCross:_wallCross/);
    assert.match(live.naveVertex, /crossClock=uNow, crossAge=crossClock-uWallCross/);
    assert.match(live.naveVertex, /\(uBreath\+0\.18000\*crossEnv\)\*0\.45000/);
    assert.match(still.naveVertex, /crossClock=uPulse/); assert.match(still.naveVertex, /\(uBreath\+0\.06000\*crossEnv\)\*0\.45000/);
    for (const prefix of ["high", "low"]) {
      assert.match(live[`${prefix}WallVertex`], /vWallCrossLocal=step\(0\.0,uNow-b\)\*\(1\.0-step\(4\.00000,uNow-b\)\)/);
      assert.match(live[`${prefix}WallFragment`], /abs\(d-crossAge\*108\.00000\)/);
      assert.match(live[`${prefix}WallFragment`], /crossEvent=crossEnv\*crossFront\*vWallCrossLocal\*powder\*step\(0\.0,y\)/);
      assert.match(live[`${prefix}WallFragment`], /crossLum\*0\.18000\*crossEvent/);
      assert.match(live[`${prefix}WallFragment`], /gl_FragColor=vec4\(col\*vWallFade,1\.0\)/, "the road-distance dissolve still bounds the lift");
      assert.match(still[`${prefix}WallVertex`], /vWallClock=uPulse/);
      assert.match(still[`${prefix}WallFragment`], /crossFront=1\.0/); assert.match(still[`${prefix}WallFragment`], /crossLum\*0\.06000\*crossEvent/);
      assert.doesNotMatch(still[`${prefix}WallFragment`], /abs\(d-crossAge\*/, "reduced motion has no travelling front");
    }
    assert.match(live.naveVertex, /crossLocal=step\(0\.0,uNow-b\)\*\(1\.0-step\(4\.00000,uNow-b\)\)/);
    assert.match(extractFunction(source, "roadSync"), /U\.uPulse\.value=\(ML_WALL_ECHO\|\|ML_DOOR_CROSS\)\?r:/);
    assert.match(source, /const PULSE=reduceMotion&&\(ML_WALL_ECHO\|\|ML_DOOR_CROSS\)\?/);
    const terrain = loadHelpers("moonline-terrain.test.js", "{emitWave9RoadShaders}");
    const standingRoad = terrain.emitWave9RoadShaders(source, { mark: true, terrain: true, bite: true, live: true, walls: false, wallEcho: false, doorCross: true, reduceMotion: true });
    assert.match(standingRoad.roadFragment, /abs\(fract\(uPulse\+0\.5\)-0\.5\)<0\.12/, "door crossing alone preserves the road's binary reduced-motion pulse");
    const effect = live.highWallFragment.slice(live.highWallFragment.indexOf("float crossAge="), live.highWallFragment.lastIndexOf("gl_FragColor"));
    assert.match(effect, /vec3 crossWarm=vec3\(1\.0,0\.97,0\.90\)/); assert.doesNotMatch(effect, /\buL[0-3]\b|lanePure|markCol/);
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "roadWallFragmentShader", (fn) => fn.replace("*powder*step(0.0,y)", "")), "the half-space oracle kills a bloom below the deck and past the powder tail");
  mutationMustFail(assertContract, replaceFunction(html, "buildRoadArches", (fn) => fn.replaceAll("(uBreath+'+_roadG(reduceMotion?0.06:ML_CROSS_LIFT)+'*crossEnv)", "('+_roadG(reduceMotion?0.06:ML_CROSS_LIFT)+'*crossEnv)")), "the arch oracle kills a crossing that replaces breath");
  mutationMustFail(assertContract, html.replaceAll("_roadG(reduceMotion?0.06:ML_CROSS_LIFT)", "_roadG(ML_CROSS_LIFT)"), "the standing oracle kills a full-strength reduced-motion flash");
});

test("Door whoosh observes the exact bars-to-mercy gain ladder and mercy tonic", () => {
  const assertContract = (source) => {
    const context = runDoorCross(source);
    for (const bar of [5, 6, 7, 8]) context.cross(bar, bar * 4 + 0.02);
    assert.equal(context.sweep.length, 3, "three bars out is silent; two, one, and mercy speak");
    assert.ok(Math.abs(context.sweep[0][3] - Math.pow(10, -6 / 20)) < 1e-15, "two bars out is exactly -6 dB in amplitude");
    assert.deepEqual(Array.from(context.sweep[1]), [520, 0.22, 10, 1]);
    assert.deepEqual(Array.from(context.sweep[2]), [520, 0.22, 10, 1]);
    assert.deepEqual(Array.from(context.frequency.slice(-3), (entry) => Array.from(entry)), [["cancel", 10], ["set", 520, 10], ["ramp", 140, 10.22]]);
    assert.equal(context.padNotes.length, 1, "the mercy doorway adds exactly one tonic grace");
    assert.deepEqual(Array.from(context.padNotes[0]), [110, "16n", 10, 0.12], "the grace uses the theme tonic and tide's own velocity");
    assert.equal(context.snaps.length, 3);
    const still = runDoorCross(source, { reduced: true }); assert.equal(still.cross(6, 24.25), 124.25, "reduced motion stamps the live uPulse road time");
    for (const gates of [{ live: false }, { train: true }, { temple: true }]) { const muted = runDoorCross(source, gates); assert.equal(muted.cross(8, 32), -1e9); assert.equal(muted.sweep.length, 0); }
    const noSound = runDoorCross(source, { sound: false }); assert.equal(noSound.cross(8, 32), 32); assert.equal(noSound.sweep.length, 0, "audio-off keeps the visual event and builds no sound event");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "doorCross", (fn) => fn.replace("barsToMercy>=3", "barsToMercy>3")), "the quiet ladder kills a whoosh three bars before mercy");
  mutationMustFail(assertContract, replaceFunction(html, "doorCross", (fn) => fn.replace("barsToMercy===2?Math.pow(10,-6/20):1", "1")), "the gain oracle kills a full-volume two-bars-out door");
  mutationMustFail(assertContract, replaceFunction(html, "doorCross", (fn) => fn.replace("if(tonic) padChord", "if(false&&tonic) padChord")), "the mercy oracle kills a missing tonic grace");
  mutationMustFail(assertContract, replaceFunction(html, "doorCross", (fn) => fn.replace("(reduceMotion?roadMat.uniforms.uPulse:roadMat.uniforms.uNow)", "roadMat.uniforms.uNow")), "the standing clock oracle kills a uNow-stamped crossing");
});

test("Road bar latch seats silently, crosses once per bar, and resets on rewind", () => {
  const assertContract = (source) => {
    assert.deepEqual(runRoadLatch(source, [0.1, 0.9, 1.1, 3.99, 4.01, 4.9, 7.99, 8.1]).crossed, [[1, 4.01], [2, 8.1]]);
    assert.deepEqual(runRoadLatch(source, [0.1, 12.1]).crossed, [[3, 12.1]], "a dropped frame emits only the doorway entered now");
    const rewind = runRoadLatch(source, [0.1, 4.1, 0.1, 3.9, 4.1]);
    assert.deepEqual(rewind.crossed, [[1, 4.1], [1, 4.1]], "rewind seats the new opening chamber instead of replaying bar zero");
    assert.deepEqual(rewind.resets, [0.1]); assert.equal(rewind.stamp, -1e9, "rewind retires the old visual stamp");
    const sync = extractFunction(source, "roadSync"), door = extractFunction(source, "doorCross");
    assert.equal((sync.match(/doorCross\(bar\)/g) || []).length, 1);
    assert.doesNotMatch(`${sync}\n${door}`, /\brnd\s*\(|Math\.random|spawnTarget|spawnRhythmOrb|gradeRhythmHit|state\.(?:shots|hits|streak)\s*[+\-=]/, "the event cannot reach RNG, spawn, grading, or score");
  };
  assertContract(html);
  mutationMustFail(assertContract, replaceFunction(html, "roadSync", (fn) => fn.replace("Math.floor(r/ML_ARCH_EVERY)", "Math.floor(r)")), "the once-per-bar oracle kills a beat latch");
  mutationMustFail(assertContract, replaceFunction(html, "roadSync", (fn) => fn.replace("const crossed=Number.isFinite(_roadBar0)", "const crossed=true")), "the opening-chamber oracle kills a first-frame crossing");
  mutationMustFail(assertContract, replaceFunction(html, "roadSync", (fn) => fn.replace("_roadBar0=NaN; _wallCross.value=-1e9;", "_wallCross.value=-1e9;")), "the rewind oracle kills a stale bar latch");
});

test("Door voice is one gated triangle node beside the existing arc voice", () => {
  const init = extractFunction(html, "initAudio"), launch = extractFunction(html, "playFireLaunch");
  assert.match(html, /let doorWhoosh=null;/);
  assert.match(init, /if\(ML_DOOR_CROSS\) try\{ doorWhoosh=new Tone\.Synth\(\{oscillator:\{type:'triangle'\}/);
  assert.match(init, /new Tone\.Volume\(DOOR_WHOOSH_DB\)\.toDestination\(\)/);
  assert.doesNotMatch(launch, /doorWhoosh/, "the projectile whoosh remains a separate voice and path");
  assert.equal((html.match(/new Tone\.Synth\(\{oscillator:\{type:'triangle'\},envelope:\{attack:0\.005,decay:0\.13,sustain:0\.18,release:0\.06\}\}\)/g) || []).length, 1);
});
