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
  assert.ok(match, `${name} is present`);
  const openAt = html.indexOf("{", match.index + match[0].length);
  return html.slice(match.index, closingDelimiter(html, openAt) + 1);
}

function makeCanvasContext(operations) {
  return {
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "",
    fillStyle: "",
    _path: [],
    beginPath() { this._path = []; },
    arc(x, y, radius) { this._path.push({ x, y, radius }); },
    fill() {
      operations.push({ kind: "fill", alpha: this.globalAlpha, color: this.fillStyle, path: this._path.slice() });
    },
    stroke() {
      operations.push({ kind: "stroke", alpha: this.globalAlpha, color: this.strokeStyle, width: this.lineWidth, radius: this._path.at(-1)?.radius });
    },
    clearRect() {},
    setTransform() {},
  };
}

function loadRingHarness({
  ringEcho = true,
  nd = 4,
  train = false,
  reduceMotion = false,
  pocketCircleCue = false,
  pocketActive = false,
  pocketExpected = "on",
  pocketIdeal = 0,
  pocketRadius = 46,
  pocketColor = "unused-pocket",
} = {}) {
  const operations = [];
  let beats = 0;
  let noteDiv = nd;
  const context = vm.createContext({
    Math,
    Number,
    CFG: {
      beatQuant: true,
      floorBeatMax: 0,
      pocketCircleCue,
      pocketLateScale: 0.55,
      pocketMainDim: 0.28,
      pocketTargetAlpha: 0.92,
      wasdHud: true,
      wasdLetter: true,
      wasdRhythm: true,
      wasdTapText: false,
    },
    GLYPH_GLOW_STEPS: 12,
    HUD_CSS: 560,
    HUD_K: 1,
    HUD_CX: 280,
    ML_RING_ECHO: ringEcho,
    ML_RING_ECHO_T: 0.30,
    ML_RING_IN: 0.18,
    MOBILE: false,
    ROAD_LANE_READY: false,
    Tone: { Transport: { state: "started" } },
    WASD_COL: ["lane-w", "lane-a", "lane-s", "lane-d"],
    _combo: [0, 1, 2, 3],
    _glyphGlowOwned: false,
    _hitNote: -1,
    _hitOff: 0,
    _noteFlashHit: false,
    _noteFlashT: -999,
    _ringEchoAt: -1e9,
    _ringEchoDur: 0,
    _ringEchoKey: 0,
    _ringEchoMain: true,
    _ringEchoR: 0,
    _spoilNote: -1,
    _spoilOff: 0,
    _wasdCombo: 0,
    dayAmt: 0,
    hudCanvas: { style: { display: "block" } },
    hudCtx: null,
    moonlineVoid: () => false,
    pocketColorCss: () => pocketColor,
    pocketExpected: () => pocketExpected,
    pocketIdeal: () => pocketIdeal,
    pocketLive: () => pocketActive,
    radiusForIdeal: () => pocketRadius,
    reduceMotion,
    roadLive: () => false,
    showWasdGlyph() {},
    state: { bpm: 60, running: true, t: 0 },
    syncWasdResolutionGrid() {},
    templeActive: false,
    toneReady: true,
    trainMode: train,
    wasdBeatCueOn: () => false,
    wasdBeatGlow: () => 0,
    wasdBeats: () => beats,
    wasdBeatsHeard: () => beats,
    wasdNoteDiv: () => noteDiv,
    wasdGlyphEl: null,
  });
  context.hudCtx = makeCanvasContext(operations);
  new vm.Script(`${extractFunction("ARC")}\n${extractFunction("drawWasdLane")}`, { filename: "space-truth-ring.vm.js" }).runInContext(context);
  return {
    context,
    draw() {
      operations.length = 0;
      context.drawWasdLane();
      return operations.slice();
    },
    setBeats(value) { beats = value; },
    setNoteDiv(value) { noteDiv = value; },
  };
}

function emitArcShader(arcVoid) {
  const start = html.indexOf("const ARC_RAIN_VS=");
  const end = html.indexOf("function makeArcGeo", start);
  assert.ok(start > 0 && end > start, "arc shader declarations are extractable");
  return vm.runInNewContext(`${html.slice(start, end)}\nARC_RAIN_FS`, { ML_ARC_VOID: arcVoid });
}

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(other) { return this.set(other.x, other.y, other.z); }
  addScaledVector(other, scale) { this.x += other.x * scale; this.y += other.y * scale; this.z += other.z * scale; return this; }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; }
}

function loadArcObjects(arcVoid) {
  class BufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(name, value) { this.attributes[name] = value; }
    setIndex(value) { this.index = value; }
  }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  class Material { constructor(options) { Object.assign(this, options); } }
  class Object3D {
    constructor(geometry, material) { this.geometry = geometry; this.material = material; this.visible = false; }
  }
  const tail = { value: 0 };
  const context = vm.createContext({
    ARC_RAIN_FS: emitArcShader(arcVoid),
    ARC_RAIN_VS: "arc-vs",
    ARC_SAMP: 30,
    ML_ARC_VOID: arcVoid,
    THREE: {
      BufferAttribute,
      BufferGeometry,
      DoubleSide: 2,
      Line: Object3D,
      LineBasicMaterial: Material,
      LineLoop: Object3D,
      Mesh: Object3D,
      ShaderMaterial: Material,
    },
    _arcRingGeo: {},
    _arcTail: tail,
    arcApex: null,
    arcLand: null,
    arcPulseA: null,
    arcPulseB: null,
    arcRibbon: null,
    makeArcGeo: () => ({}),
    scene: { add() {} },
  });
  new vm.Script(`${extractFunction("ensureArcObjs")}\nensureArcObjs();`, { filename: "space-truth-arc-objs.vm.js" }).runInContext(context);
  return { uniforms: context.arcRibbon.material.uniforms, tail };
}

function previewFrame({ arcSwitch, voidWorld }) {
  const positions = new Float32Array(30 * 2 * 3);
  const arcRibbon = {
    geometry: { attributes: { position: { array: positions, needsUpdate: false } } },
    material: { uniforms: { uBands: { value: 6 }, uOpacity: { value: 0 }, uScroll: { value: 0 } } },
    renderOrder: 0,
    visible: false,
  };
  const arcLand = { position: new Vec3(), scale: { set() {} }, material: { opacity: 0 }, visible: true };
  const context = vm.createContext({
    ARC_SAMP: 30,
    ARC_UPDATE_STEP: 1 / 20,
    CFG: { projArc: true, projGravity: 1, projectile: true, projLife: 14 },
    GH_GIFT: false,
    ML_ARC_FAR: 140,
    ML_ARC_VOID: arcSwitch,
    Math,
    RIB_HALF: 0.1,
    RIB_OP_BASE: 0.62,
    RIB_OP_DAY: 0.28,
    _arcApexOn: false,
    _arcApexY: 0,
    _arcI: new Vec3(),
    _arcLandPos: new Vec3(),
    _arcM: new Vec3(),
    _arcPos: new Vec3(),
    _arcPts: new Float32Array(30 * 3),
    _arcScroll: 0,
    _arcTail: { value: 0 },
    _arcV: new Vec3(),
    _arcVel: new Vec3(),
    _planLanded: false,
    _ribOff: new Vec3(),
    _ribTan: new Vec3(),
    _ribToCam: new Vec3(),
    animateArcPulse() {},
    arcAccum: 1,
    arcApex: null,
    arcLand,
    arcLanded: false,
    arcPulseA: { visible: true },
    arcPulseB: { visible: true },
    arcRibbon,
    bonusActive: false,
    camera: { position: new Vec3() },
    dayAmt: 0,
    ensureArcObjs() {},
    hideArc() {},
    moonlineVoid: () => voidWorld,
    projSpeedNow: () => 20,
    reduceMotion: true,
    state: { bpm: 60, running: true, t: 0 },
    templeActive: false,
    windX: 0,
    windZ: 0,
  });
  let sampledT = -1;
  context.computeShotPlan = (muzzle, velocity) => {
    muzzle.set(0, 1, 0);
    velocity.set(20, 0, 0);
    context._arcI.set(20, 0.03, 0);
    context._planLanded = true;
    return 1;
  };
  context.sampleArc = (_muzzle, _velocity, duration, samples, output) => {
    sampledT = duration;
    for (let index = 0; index < samples; index += 1) {
      output[index * 3] = index;
      output[index * 3 + 1] = 1;
      output[index * 3 + 2] = 0;
    }
  };
  new vm.Script(`${extractFunction("updateArcPreview")}\nupdateArcPreview(0.05);`, { filename: "space-truth-preview.vm.js" }).runInContext(context);
  return { context, sampledT };
}

function projectileFrame({ arcSwitch, voidWorld }) {
  const events = [];
  const projectile = { life: 0, mesh: {}, pos: new Vec3(0, 0.05, 0), vel: new Vec3(0, -1, 0) };
  const context = vm.createContext({
    CFG: { projGravity: 0, projLife: 14, projRadius: 0.3 },
    GH_GIFT: false,
    ML_ARC_VOID: arcSwitch,
    Math,
    ROOM_HALF_D: 100,
    ROOM_HALF_W: 100,
    _prev: new Vec3(),
    gradeRhythmHit() {},
    handleTankHit() {},
    kick: null,
    moonlineVoid: () => voidWorld,
    onWhiff: () => events.push("whiff"),
    orbOpen: () => true,
    projectiles: [projectile],
    releaseProjectileMesh() {},
    retireProjectile: () => events.push("retire"),
    segDistSq: () => Infinity,
    soundOn: false,
    spawnLandRing: () => events.push("ring"),
    targets: [],
    toneReady: false,
    windX: 0,
    windZ: 0,
  });
  new vm.Script(`${extractFunction("updateProjectiles")}\nupdateProjectiles(0.1);`, { filename: "space-truth-projectile.vm.js" }).runInContext(context);
  return { events, projectile };
}

function realLandRingFrame({ arcSwitch, voidWorld }) {
  const events = [];
  const projectile = { life: 0, mesh: {}, pos: new Vec3(0, 0.05, 0), vel: new Vec3(0, -1, 0) };
  class LineLoop {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new Vec3();
      this.scale = new Vec3(1, 1, 1);
      this.visible = false;
    }
  }
  class LineBasicMaterial { constructor(options) { Object.assign(this, options); } }
  const context = vm.createContext({
    CFG: { projGravity: 0, projLife: 14, projRadius: 0.3 },
    GH_GIFT: false,
    ML_ARC_VOID: arcSwitch,
    Math,
    ROOM_HALF_D: 100,
    ROOM_HALF_W: 100,
    THREE: { AdditiveBlending: 2, LineBasicMaterial, LineLoop },
    _arcRingGeo: {},
    _prev: new Vec3(),
    gradeRhythmHit() {},
    handleTankHit() {},
    kick: null,
    moonlineVoid: () => voidWorld,
    onWhiff: () => events.push("whiff"),
    orbOpen: () => true,
    projectiles: [projectile],
    releaseProjectileMesh() {},
    retireProjectile: () => events.push("retire"),
    scene: { add: () => events.push("ring") },
    segDistSq: () => Infinity,
    soundOn: false,
    targets: [],
    toneReady: false,
    windX: 0,
    windZ: 0,
  });
  const script = `const landRingPool=[];\n${extractFunction("spawnLandRing")}\n${extractFunction("updateProjectiles")}\nupdateProjectiles(0.1);\nglobalThis.landRingCount=landRingPool.length;`;
  new vm.Script(script, { filename: "space-truth-real-land-ring.vm.js" }).runInContext(context);
  return { events, landRingCount: context.landRingCount, projectile };
}

test("SPACE TRUTH knobs are flat, raw, independent, and cover off/R-only/V-only/combined", () => {
  assert.match(html, /\n  ringEcho:1,/);
  assert.match(html, /\n  arcVoid:1,/);
  const ringDecl = html.match(/const ML_RING_ECHO=!!CFG\.ringEcho[^;]*;/)?.[0];
  const arcDecl = html.match(/const ML_ARC_VOID=!!CFG\.arcVoid[^;]*;/)?.[0];
  assert.ok(ringDecl && arcDecl, "both raw-boolean-first declarations are present");
  for (const [ringEcho, arcVoid] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const actual = vm.runInNewContext(`${ringDecl}\n${arcDecl}\n[ML_RING_ECHO,ML_ARC_VOID]`, { CFG: { arcVoid, ringEcho } });
    assert.deepEqual(Array.from(actual), [Boolean(ringEcho), Boolean(arcVoid)], `${ringEcho}/${arcVoid}`);
  }
});

test("computeShotPlan keeps the shipped solve with one explicit gift-speed input", () => {
  const source = extractFunction("computeShotPlan");
  const hash = crypto.createHash("sha256").update(source).digest("hex");
  assert.equal(hash, "9435bc79e35034b572695131365fd979b7b2795775d9843d840afd8eac300dca");
});

test("ML_RING_IN remains the named approach-condensation constant", () => {
  assert.match(html, /const ML_RING_ECHO=!!CFG\.ringEcho, ML_RING_ECHO_T=0\.30, ML_RING_IN=0\.18;/);
  const approach = extractFunction("drawWasdLane").split("\n").find((line) => line.includes("if(off<=0)"));
  assert.ok(approach, "the shared approach arm is present");
  assert.match(approach, /\/ML_RING_IN/);
  assert.doesNotMatch(approach, /\/0\.18/);
});

test("R condenses the shared approach branch from zero while ringEcho:0 keeps shipped alpha", () => {
  for (const train of [false, true]) {
    const on = loadRingHarness({ ringEcho: true, train });
    const off = loadRingHarness({ ringEcho: false, train });
    on.setBeats(0.875);
    off.setBeats(0.875);
    const onInk = on.draw().find((operation) => operation.kind === "stroke" && operation.color === "lane-w" && operation.radius === 272);
    const offInk = off.draw().find((operation) => operation.kind === "stroke" && operation.color === "lane-w" && operation.radius === 272);
    assert.ok(onInk && offInk, `birth ring is drawn on ${train ? "trainer" : "play"} clock`);
    assert.equal(onInk.alpha, 0, "enabled ring begins fully condensed");
    assert.equal(offInk.alpha, 0.35, "disabled parcel preserves the shipped birth alpha");
  }
});

test("R does not run its ring work under reduced motion", () => {
  const ring = loadRingHarness({ ringEcho: true, reduceMotion: true });
  ring.context._hitNote = 0;
  ring.context._hitOff = -0.08;
  ring.context.state.t = 12;
  ring.setBeats(0);
  assert.equal(ring.draw().some((operation) => operation.color === "lane-w"), false, "the note-ring arm is skipped while the static hit line remains");
  assert.equal(ring.context._ringEchoAt, -1e9, "a hidden correct note cannot capture echo state");
});

test("R never promotes a spoiled note into echo state", () => {
  const ring = loadRingHarness({ ringEcho: true });
  ring.context._spoilNote = 0;
  ring.context._spoilOff = -0.08;
  ring.context.state.t = 14;
  ring.setBeats(0);
  const spoiled = ring.draw();
  assert.ok(spoiled.some((operation) => operation.kind === "stroke" && operation.color === "rgba(150,152,160,0.85)"), "the real spoiled arm is exercised");
  assert.equal(ring.context._ringEchoAt, -1e9, "spoiled feedback never becomes a correct echo");
});

test("R leaves the opt-in pocketCircleCue target ring intact", () => {
  const ring = loadRingHarness({
    ringEcho: true,
    pocketCircleCue: true,
    pocketActive: true,
    pocketExpected: "late",
    pocketIdeal: 0.2,
    pocketRadius: 173,
    pocketColor: "pocket-late",
  });
  const target = ring.draw().find((operation) => operation.kind === "stroke" && operation.color === "pocket-late");
  assert.ok(target, "the real pocket target arm emits its colored ring");
  assert.equal(target.radius, 173);
  assert.equal(target.width, 5);
  assert.equal(target.alpha, 0.92);
});

test("R echo survives an nd remap by stored time/radius/key, uses WASD_COL, and obeys the 60% cap", () => {
  const ring = loadRingHarness({ ringEcho: true, nd: 4 });
  ring.context._hitNote = 0;
  ring.context._hitOff = -0.08;
  ring.context.state.t = 10;
  ring.setBeats(0);
  ring.draw();
  const storedRadius = ring.context._ringEchoR;
  assert.ok(storedRadius > 46 && storedRadius < 272);
  assert.equal(ring.context._ringEchoDur, 0.15, "four notes/beat at 60 bpm caps 0.30 s to 0.15 s");

  ring.context._hitNote = -1;
  ring.context.state.t = 10.10;
  ring.setNoteDiv(8);
  ring.setBeats(0.07);
  const remapped = ring.draw();
  const echoInk = remapped.find((operation) => operation.kind === "stroke" && operation.color === "lane-w" && Math.abs(operation.radius - storedRadius) < 1e-9);
  assert.ok(echoInk, "the old answer remains at its stored geometry and key after the live grid changes");
  assert.ok(echoInk.alpha > 0.32 && echoInk.alpha < 0.34, "the stored 0.15 s cap, not remapped nd=8, owns age");

  ring.context.state.t = 10.151;
  assert.equal(ring.draw().some((operation) => operation.kind === "stroke" && operation.color === "lane-w" && Math.abs(operation.radius - storedRadius) < 1e-9), false);
  const echoBlock = html.slice(html.indexOf("if(ML_RING_ECHO && !hit)"), html.indexOf("if(hit){ al=1", html.indexOf("if(ML_RING_ECHO && !hit)")));
  assert.match(echoBlock, /WASD_COL\[_ringEchoKey\]/);
  assert.doesNotMatch(echoBlock, /#[0-9a-f]{3,8}/i, "no lane-colour literal enters the echo");
});

test("R session reset retires the old timestamp before state.t rewinds", () => {
  const ring = loadRingHarness({ ringEcho: true, nd: 4 });
  ring.context._hitNote = 0;
  ring.context._hitOff = -0.08;
  ring.context.state.t = 50;
  ring.setBeats(0);
  ring.draw();
  const storedRadius = ring.context._ringEchoR;
  ring.context._hitNote = -1;
  ring.context.state.t = 0;
  ring.setNoteDiv(8);
  ring.setBeats(0.07);

  const reset = extractFunction("resetSession");
  const resetStatement = reset.match(/_ringEchoAt=-1e9;/)?.[0] || "";
  if (resetStatement) vm.runInContext(resetStatement, ring.context);
  assert.ok(reset.indexOf(resetStatement) < reset.indexOf("Object.assign(state,{t:0"), "echo retirement precedes the transport-derived clock reset");
  assert.equal(ring.draw().some((operation) => operation.kind === "stroke" && operation.color === "lane-w" && Math.abs(operation.radius - storedRadius) < 1e-9), false, "a prior run cannot resurrect its confirm at t=0");
});

test("R echo state survives pause and Temple while the state.t clock is frozen", () => {
  const ring = loadRingHarness({ ringEcho: true, nd: 4 });
  ring.context._hitNote = 0;
  ring.context._hitOff = -0.08;
  ring.context.state.t = 20;
  ring.setBeats(0);
  ring.draw();
  const storedAt = ring.context._ringEchoAt;
  const storedRadius = ring.context._ringEchoR;

  ring.context._hitNote = -1;
  ring.context.state.running = false;
  ring.draw();
  assert.equal(ring.context._ringEchoAt, storedAt, "pause preserves the state.t-owned echo");

  ring.context.state.running = true;
  ring.context.templeActive = true;
  ring.draw();
  assert.equal(ring.context._ringEchoAt, storedAt, "Temple preserves the state.t-owned echo");

  ring.context.templeActive = false;
  ring.context.state.t = 20.1;
  ring.setBeats(0.07);
  assert.ok(ring.draw().some((operation) => operation.kind === "stroke" && operation.color === "lane-w" && Math.abs(operation.radius - storedRadius) < 1e-9), "the frozen echo resumes with its remaining state.t lifetime");
});

test("V build-time tail arm keeps arcVoid:0 shader bytes and shares one uTail object", () => {
  const shipped = [
    "uniform float uScroll; uniform float uOpacity; uniform float uBands; varying vec2 vUv;",
    "vec3 roygbiv(float t){",
    "  float i=floor(clamp(t,0.0,0.999)*7.0);",
    "  if(i<0.5) return vec3(1.00,0.15,0.12);",
    "  if(i<1.5) return vec3(1.00,0.48,0.08);",
    "  if(i<2.5) return vec3(1.00,0.90,0.12);",
    "  if(i<3.5) return vec3(0.18,0.88,0.22);",
    "  if(i<4.5) return vec3(0.15,0.55,1.00);",
    "  if(i<5.5) return vec3(0.38,0.22,0.95);",
    "  return vec3(0.72,0.28,1.00);",
    "}",
    "void main(){",
    "  float t=fract(vUv.x*uBands - uScroll);",
    "  vec3 c=roygbiv(t);",
    "  float edge=smoothstep(0.0,0.18,vUv.y)*smoothstep(1.0,0.82,vUv.y);",
    "  float a=uOpacity*(0.50+0.50*edge);",
    "  gl_FragColor=vec4(c,a);",
    "}",
  ].join("\n");
  assert.equal(emitArcShader(false), shipped);
  assert.match(emitArcShader(true), /uniform float uTail;/);
  assert.match(emitArcShader(true), /a\*=mix\(1\.0,1\.0-smoothstep\(0\.72,1\.0,vUv\.x\),uTail\);/);
  const off = loadArcObjects(false);
  const on = loadArcObjects(true);
  assert.equal(Object.hasOwn(off.uniforms, "uTail"), false);
  assert.strictEqual(on.uniforms.uTail, on.tail, "the material borrows the module-scope uniform object");
});

test("V extends only the void ribbon and suppresses landing truth without touching _planLanded", () => {
  const off = previewFrame({ arcSwitch: false, voidWorld: true });
  const room = previewFrame({ arcSwitch: true, voidWorld: false });
  const voidFrame = previewFrame({ arcSwitch: true, voidWorld: true });
  for (const ordinary of [off, room]) {
    assert.equal(ordinary.sampledT, 1, "ordinary and kill-switch paths sample the shipped T");
    assert.equal(ordinary.context.arcLand.visible, true);
    assert.equal(ordinary.context.arcLanded, true);
    assert.equal(ordinary.context._arcTail.value, 0);
    assert.equal(ordinary.context.arcRibbon.renderOrder, 0);
    assert.equal(ordinary.context.arcRibbon.material.uniforms.uBands.value, 6, "ordinary space keeps the shipped six-band period");
  }
  assert.ok(Math.abs(voidFrame.sampledT - 7) < 0.05, `20 m/s path reaches the named 140 m horizon at about seven seconds (got ${voidFrame.sampledT})`);
  assert.equal(voidFrame.context._arcTail.value, 1);
  assert.equal(voidFrame.context.arcRibbon.renderOrder, -41, "the void tail renders behind the -40 road cue");
  assert.ok(Math.abs(voidFrame.context.arcRibbon.material.uniforms.uBands.value - 6 * voidFrame.sampledT) < 1e-9, "uBands scales by TVis/T so the shipped stripe period survives the extension");
  assert.equal(voidFrame.context.arcLand.visible, false);
  assert.equal(voidFrame.context.arcLanded, false);
  assert.equal(voidFrame.context._planLanded, true, "combat plan truth is read-only even while its floor decoration stands down");
});

test("V void-preview extension performs no per-update allocation", () => {
  const preview = extractFunction("updateArcPreview");
  const start = preview.indexOf("if(arcVoid){");
  const end = preview.indexOf("sampleArc(", start);
  assert.ok(start > 0 && end > start, "the void extension arm is extractable");
  const extension = preview.slice(start, end);
  assert.doesNotMatch(extension, /\bnew\s+|=\s*\[|=\s*\{\s*(?:[A-Za-z_$][\w$]*\s*:|\})|\b(?:Array\.from|Object\.create)\s*\(/, "the update arm reuses module-scope vectors and scalars");
});

test("V skips only the void land-ring call; onWhiff and retirement stay byte-ordered", () => {
  const off = projectileFrame({ arcSwitch: false, voidWorld: true });
  const room = projectileFrame({ arcSwitch: true, voidWorld: false });
  const voidFrame = projectileFrame({ arcSwitch: true, voidWorld: true });
  assert.deepEqual(off.events, ["ring", "whiff", "retire"], "arcVoid:0 is the shipped call order");
  assert.deepEqual(room.events, ["ring", "whiff", "retire"], "a real floor keeps its ring");
  assert.deepEqual(voidFrame.events, ["whiff", "retire"], "only the phantom-floor visual call disappears");
  assert.ok(voidFrame.projectile.pos.y <= 0.04, "the accepted phantom-plane bullet death remains");
  assert.match(extractFunction("spawnLandRing"), /if\(moonlineVoid\(\)\) return;/, "the shipped defense-in-depth visual arm is unconditional");
  const deathLine = extractFunction("updateProjectiles").split("\n").find((line) => line.includes("pr.life>=CFG.projLife"));
  assert.match(deathLine, /spawnLandRing\([^;]+\); onWhiff\(gift\); retireProjectile\(i\); continue;/, "grading and retirement remain on the same shipped clock and order");
});

test("arcVoid:0 real missed-shot rings retain the shipped void suppression", () => {
  const off = realLandRingFrame({ arcSwitch: false, voidWorld: true });
  const room = realLandRingFrame({ arcSwitch: true, voidWorld: false });
  const voidFrame = realLandRingFrame({ arcSwitch: true, voidWorld: true });
  assert.deepEqual(off.events, ["whiff", "retire"], "arcVoid:0 calls the real ring function, whose shipped guard suppresses the void visual");
  assert.equal(off.landRingCount, 0);
  assert.deepEqual(room.events, ["ring", "whiff", "retire"], "a real floor still creates the real pooled ring");
  assert.equal(room.landRingCount, 1);
  assert.deepEqual(voidFrame.events, ["whiff", "retire"], "arcVoid:1 skips the call in the void");
  assert.equal(voidFrame.landRingCount, 0);
});
