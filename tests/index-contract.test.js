"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const { html: indexHtml, main, sourceText: html, sourceFor } = require("./source.js");
const wave8ArchFixture = JSON.parse(fs.readFileSync(path.join(__dirname, "moonline-wave8-arch-shaders.fixture.json"), "utf8"));

function emitRoadArchShaders({ nave, low }) {
  const match = sourceFor("buildRoadArches").match(/function buildRoadArches\(\)\{[\s\S]*?\n\}(?=\nfunction buildNaveVault)/);
  assert.ok(match, "buildRoadArches is extractable for shader emission");
  class BufferGeometry { setAttribute() {} setIndex() {} }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  class ShaderMaterial { constructor(options) { Object.assign(this, options); } }
  class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; } }
  class Color { constructor(value) { this.value = value; } }
  const uniforms = { uNow: {}, uBase: {}, uA: {}, uW: {}, uP: {}, uBreath: {}, uPulse: {} };
  const context = vm.createContext({
    ML_NAVE: nave, ML_BITE: false, ML_TERRAIN: false, ML_DOOR_CROSS: false, LOW: low, ML_ARCH_RICH: !low, ML_ARCH_SEG: low ? 14 : 28, ML_NAVE_SEG: low ? 18 : 40,
    ML_ARCH_N: 11, ML_ARCH_BEHIND: 8, ML_ARCH_EVERY: 4, ML_ARCH_SPREAD: 0.25,
    ROAD_HALF_W: 7, ROAD_MPB: 27, ROAD_FADE0: 734.4, ROAD_FADE1: 864,
    ML_ARCH_PX: 3.2, ML_FOCAL_PX: (1080 / 2) / Math.tan(95 * Math.PI / 360), ML_ARCH_WMIN: 0.06, ML_ARCH_WMAX: 2.6,
    ML_ARCH_BREATH: 0.45, ML_ARCH_CORE: 16, ML_ARCH_NODE: 2.2, ML_ARCH_PRISM_AT: -0.55, ML_ARCH_PRISM_K: 22,
    ML_ARCH_AUR: 2.4, ML_ARCH_INK: 0.62, ML_GOLD: 0xffeccc, ML_NAVE_VEIL: low ? 0 : 0.45,
    ML_NAVE_SPRING: 9.5, ML_NAVE_R1: 7, ML_NAVE_R2: 8.3, ML_NAVE_RM1: 10, ML_NAVE_RM2: 11.6,
    _roadG: (number) => (+number).toFixed(5), _archKind: new Float32Array(11),
    roadMat: { uniforms }, roadArchMat: null, roadArch: null, roadArchAccentMat: null, roadArchAccent: null,
    CFG: { moonline: { archHeightM: 7, archGlow: 1, archPrism: 0.35, reflectAlpha: 0.18, mercyRingBoost: 1.9 } },
    THREE: { BufferGeometry, BufferAttribute, Float32BufferAttribute: BufferAttribute, ShaderMaterial, Mesh, Color, DoubleSide: 1, AdditiveBlending: 2, NormalBlending: 3 },
    scene: { add() {} },
  });
  new vm.Script(`${match[0]}\nbuildRoadArches();`, { filename: "buildRoadArches.vm.js" }).runInContext(context);
  return { vertexShader: context.roadArchMat.vertexShader, fragmentShader: context.roadArchMat.fragmentShader };
}

test("every inline browser script parses", () => {
  const scripts = [...indexHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  assert.ok(scripts.length >= 2);
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `index-inline-${index + 1}.js` }));
  });
});

test("realCivilDate validates Gregorian dates independently of the host time zone", () => {
  class ApiaDate extends Date {
    constructor(...parts) {
      if (parts.length >= 3 && parts[0] === 2011 && parts[1] === 11 && parts[2] === 30) super(2011, 11, 31);   // LOCAL midnight of the day after: Apia handed back Dec 31 in its own clock, and only a local date reads as 31 on hosts west of UTC too (a UTC midnight reads as Dec 30 in the Americas and let the local-midnight mutant survive)
      else super(...parts);
    }
    static UTC(...parts) { return Date.UTC(...parts); }
  }
  const assertContract = (source) => {
    const datePattern = source.match(/const PHASES_DATE_RE=\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/;/);
    const dateGate = source.match(/function realCivilDate\(s\)\{[\s\S]*?\n\}/);
    assert.ok(datePattern && dateGate, "the production civil-date gate is extractable");
    const years = Array.from({ length: 100 }, (_unused, year) => `${String(year).padStart(4, "0")}-01-01`);
    for (const [timezone, DateImpl] of [["ordinary", Date], ["Pacific/Apia skipped-day simulation", ApiaDate]]) {
      const context = vm.createContext({ Date: DateImpl, years });
      new vm.Script(`${datePattern[0]}\n${dateGate[0]}\nthis.result={skipped:realCivilDate('2011-12-30'),impossible:realCivilDate('2026-02-31'),early:years.map(realCivilDate)};`).runInContext(context);
      assert.equal(context.result.skipped, true, `2011-12-30 is Gregorian-valid under ${timezone}`);
      assert.equal(context.result.impossible, false, `February 31 is rejected under ${timezone}`);
      assert.deepEqual(Array.from(context.result.early), Array(100).fill(false), `years 0000-0099 are rejected under ${timezone}`);
    }
  };
  assertContract(html);
  const localMutation = html.replace("new Date(Date.UTC(y, m-1, d))", "new Date(y, m-1, d)").replace("t.getUTCFullYear()===y && t.getUTCMonth()===m-1 && t.getUTCDate()===d", "t.getFullYear()===y && t.getMonth()===m-1 && t.getDate()===d");
  assert.throws(() => assertContract(localMutation), assert.AssertionError, "the timezone oracle kills restoration of the local-midnight gate");
});

test("inline script comments cannot swallow trailing call statements", () => {
  const offenders = [];
  const scripts = [...indexHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .filter((match) => match[1])
    .map((match) => ({
      label: "index.html",
      firstLine: indexHtml.slice(0, match.index + match[0].indexOf(match[1])).split("\n").length,
      source: match[1],
    }));
  scripts.push({ label: "aim-dojo-main.js", firstLine: 1, source: sourceFor("threeBlock") });
  for (const script of scripts) {
    script.source.split("\n").forEach((line, index) => {
      let commentAt = -1;
      let cursor = 0;
      while (true) {
        cursor = line.indexOf("//", cursor);
        if (cursor < 0) break;
        if (cursor > 0 && line[cursor - 1] === ":") {
          cursor += 2;
          continue;
        }
        commentAt = cursor;
        break;
      }
      if (commentAt < 0) return;
      const tail = line.slice(commentAt + 2);
      const trimmed = tail.trimEnd();
      const tailCall = /\)\s*;\s*$/.test(trimmed) && /[A-Za-z_$][\w$]*\(/.test(trimmed);
      const midCall = /[A-Za-z_$][\w$]*\(.*\)\s*;\s+\/\//.test(tail);
      if (tailCall || midCall) offenders.push(`${script.label}:${script.firstLine + index}`);
    });
  }
  assert.deepEqual(offenders, [], `call statements swallowed by // comments at: ${offenders.join(", ")}`);
});

test("the Nave kill-switch emits the frozen Wave 8 shaders character-for-character", () => {
  assert.match(html, /const ML_NAVE=ML_ARCH && !!\(CFG\.moonline && CFG\.moonline\.naveOn\);/);
  const wave8 = {
    desktop: emitRoadArchShaders({ nave: false, low: false }),
    low: emitRoadArchShaders({ nave: false, low: true }),
  };
  const nave = emitRoadArchShaders({ nave: true, low: false });
  assert.deepEqual(wave8, wave8ArchFixture);
  assert.notEqual(nave.vertexShader, wave8.desktop.vertexShader);
  assert.notEqual(nave.fragmentShader, wave8.desktop.fragmentShader);
  assert.match(nave.fragmentShader, /vec3 cool=.*warm=/);
});

test("the Nave CFG defaults remain flat ship literals", () => {
  const moonline = html.match(/moonline:\{([^{}\n]+)\}/);
  assert.ok(moonline, "CFG.moonline is a single flat literal");
  assert.match(moonline[1], /naveOn:true, naveStars:1500, naveVeil:0\.45, naveStreetGold:1(?:,|\s)/);
});

test("the Nave lane palette derives every jewel from the authoritative WASD uniforms", () => {
  const wasd = html.match(/WASD_HEX=\[([^\]]+)\]/);
  assert.ok(wasd, "WASD_HEX is present as the lane-colour authority");
  const laneHex = wasd[1].split(",").map((value) => Number(value.trim()));
  assert.deepEqual(laneHex, [0x43d9ff, 0x74e84a, 0xffd36b, 0xff5a7a]);
  const roadBuilder = html.match(/\(function buildRoad\(\)\{[\s\S]*?\n\}\)\(\);/);
  assert.ok(roadBuilder, "the road material builder is present");
  const laneBindings = [...roadBuilder[0].matchAll(/\buL([0-3]):\{value:_roadLaneCol\[(\d+)\]\}/g)]
    .map(([, uniformIndex, paletteIndex]) => [Number(uniformIndex), Number(paletteIndex)]);
  assert.deepEqual(laneBindings, [[0, 0], [1, 1], [2, 2], [3, 3]], "each WASD uniform binds the same-index lane colour");
  const roadSync = html.match(/function roadSync\(\)\{[\s\S]*?\n\}/);
  assert.ok(roadSync, "roadSync is present as the lane-colour fill owner");
  const laneFill = roadSync[0].match(/for\(let ([A-Za-z_$][\w$]*)=0;\1<4;\1\+\+\)\s*_roadLaneCol\[([^\]]+)\]\.setHex\(WASD_HEX\[([^\]]+)\]\)/);
  assert.ok(laneFill, "the WASD lane-colour fill loop is present");
  const [, iterator, paletteIndex, wasdIndex] = laneFill;
  assert.equal(paletteIndex, iterator, "the fill writes the loop's same-index lane colour");
  assert.equal(wasdIndex, iterator, "the fill reads the loop's same-index WASD colour");
  const laneAt = roadBuilder[0].indexOf("'  vec3 lc=");
  const colourAt = roadBuilder[0].indexOf("'  vec3 col=", laneAt);
  assert.ok(laneAt >= 0 && colourAt > laneAt, "the emitted lane-selection block is extractable");
  const laneBlock = roadBuilder[0].slice(laneAt, colourAt);
  assert.match(laneBlock, /vec3 lc=mix\(mix\(uL0,uL1,step\(0\.5,lane\)\), mix\(uL2,uL3,step\(2\.5,lane\)\), step\(1\.5,lane\)\)/);
  assert.match(laneBlock, /vec3 jewel=clamp\(mix\(vec3\(dot\(lc,vec3\(0\.299,0\.587,0\.114\)\)\),lc,([0-9.]+)\)\*([0-9.]+),0\.0,1\.0\); lc=mix\(lc,jewel,uNaveGold\)/);
  assert.doesNotMatch(laneBlock, /\bj[0-3]\b/);
  assert.deepEqual(laneBlock.match(/vec3\([0-9.]+,[0-9.]+,[0-9.]+\)/g), ["vec3(0.299,0.587,0.114)"], "the Nave fork contains no hardcoded lane-hue vec3 literals");

  const [, saturationText, liftText] = laneBlock.match(/\),lc,([0-9.]+)\)\*([0-9.]+),0\.0,1\.0/);
  const saturation = Number(saturationText), lift = Number(liftText);
  const jewels = laneHex.map((hex) => {
    const lane = [hex >> 16, (hex >> 8) & 0xff, hex & 0xff].map((channel) => channel / 255);
    const luminance = lane[0] * 0.299 + lane[1] * 0.587 + lane[2] * 0.114;
    return lane.map((channel) => Math.max(0, Math.min(1, (luminance + (channel - luminance) * saturation) * lift)));
  });
  assert.ok(jewels[0][2] > jewels[0][1] && jewels[0][1] > jewels[0][0], "W remains cyan");
  assert.ok(jewels[1][1] > jewels[1][0] && jewels[1][1] > jewels[1][2], "A remains green");
  assert.ok(jewels[2][0] > jewels[2][1] && jewels[2][1] > jewels[2][2], "S remains gold");
  assert.ok(jewels[3][0] > jewels[3][2] && jewels[3][2] > jewels[3][1], "D remains pink");
  for (const jewel of jewels) assert.ok(Math.max(...jewel) - Math.min(...jewel) > 0.45, "jewel lift preserves stained-glass saturation");
});

test("LOW emits plain marble without coffer recess or lip code", () => {
  const desktop = emitRoadArchShaders({ nave: true, low: false });
  const low = emitRoadArchShaders({ nave: true, low: true });
  assert.match(desktop.fragmentShader, /\brec\b/);
  assert.match(desktop.fragmentShader, /\blip\b/);
  assert.doesNotMatch(low.fragmentShader, /\b(?:rec|lip|recess)\b/i);
});

test("ordinary orb expiry releases the target and records a miss", () => {
  const source = html.match(/function onExpire\(tg\)\{[\s\S]*?\n\}/);
  assert.ok(source, "onExpire is present as a testable named function");
  let removed = 0;
  const pushed = [];
  const state = { streak: 3 };
  const context = vm.createContext({
    CFG: { tank: { fillOnly: true }, hitTrauma: 0 }, state, reduceMotion: true,
    GH_RECORD: false, ghostRecordTargetOutcome: () => {},
    removeTarget: () => { removed += 1; }, pushEvent: (value) => { pushed.push(value); },
    showTiming: () => {}, playWhiffSfx: () => {}, missGrooveDuck: () => {}, addTrauma: () => {},
    T: (_key, fallback) => fallback,
  });
  vm.runInContext(`${source[0]}; onExpire({kind:0, fill16:-1});`, context);
  assert.equal(removed, 1);
  assert.deepEqual(pushed, [false]);
  assert.equal(state.streak, 0);
});

test("pointer lock resume waits out Esc cooldown and relocks before firing", () => {
  const cancelRetry = html.match(/function cancelLockRetry\(\)\{[\s\S]*?\n\}/);
  const errorHandler = html.match(/function onPointerLockError\(\)\{[\s\S]*?\n\}/);
  const lockChange = html.match(/document\.addEventListener\('pointerlockchange',\(\)=>\{[\s\S]*?\n\}\);/);
  const mouseDown = html.match(/canvas\.addEventListener\('mousedown', e=>\{[\s\S]*?\n\}\);/);
  const enter = html.match(/function enterRunning\(\)\{[\s\S]*?\n\}/);
  const exit = html.match(/function exitRunning\(\)\{[\s\S]*?\n\}/);
  const start = html.match(/function startRun\(viaPad\)\{[\s\S]*?\n\}/);
  const visibility = html.match(/document\.addEventListener\('visibilitychange',\(\)=>\{[\s\S]*?\n\}\);/);
  assert.ok(cancelRetry && errorHandler && lockChange && mouseDown && enter && exit && start && visibility);
  assert.match(errorHandler[0], /LOCK_COOLDOWN_MS/);
  assert.match(errorHandler[0], /_lockLostAt/);
  assert.match(errorHandler[0], /_runNeedsRelock=!MOBILE && _relockTries<1/);
  assert.match(errorHandler[0], /if\(document\.hidden\)\{ cancelLockRetry\(\); return; \}/);
  assert.match(errorHandler[0], /if\(!_lockReqPending\) return;/);
  assert.doesNotMatch(errorHandler[0], /_lockReqPending=false;/);
  assert.match(errorHandler[0], /try\{ _lockReqPending=true; canvas\.requestPointerLock\(\)/);
  assert.match(lockChange[0], /_lockLostAt=performance\.now\(\)/);
  assert.match(lockChange[0], /_relockTries=0/);
  assert.match(lockChange[0], /document\.hidden \|\| \(!state\.running && !_lockReqPending\)/);
  assert.match(lockChange[0], /document\.exitPointerLock\(\)/);
  assert.match(cancelRetry[0], /clearTimeout\(_lockRetryT\)/);
  assert.match(cancelRetry[0], /_lockReqPending=false/);
  assert.match(enter[0], /cancelLockRetry\(\)/);
  assert.match(exit[0], /cancelLockRetry\(\)/);
  assert.match(start[0], /if\(viaPad===true\)\{ cancelLockRetry\(\)/);
  assert.match(start[0], /try\{ _lockReqPending=true; canvas\.requestPointerLock\(\)/);
  assert.match(visibility[0], /if\(document\.hidden\)\{ cancelLockRetry\(\)/);
  const relockAt = mouseDown[0].indexOf("if(_runNeedsRelock");
  const fireAt = mouseDown[0].indexOf("fire();");
  assert.ok(relockAt >= 0 && relockAt < fireAt, "run relock branch precedes fire()");
  assert.match(mouseDown[0], /_runNeedsRelock=false; _relockTries\+\+; try\{ canvas\.requestPointerLock\(\)/);
});

test("late in-run pointer lock error after pause preserves the pause card", () => {
  const cancelRetry = html.match(/function cancelLockRetry\(\)\{[\s\S]*?\n\}/);
  const errorHandler = html.match(/function onPointerLockError\(\)\{[\s\S]*?\n\}/);
  assert.ok(cancelRetry && errorHandler);
  const calls = { enter: 0, request: 0, timers: 0 };
  const state = { running: false };
  const beginLabel = { textContent: "RESUME" };
  const context = vm.createContext({
    state, beginLabel, beginBtn: { textContent: "▶ RESUME" },
    overlay: { classList: { contains: () => false } },
    canvas: { requestPointerLock: () => { calls.request += 1; } },
    document: { hidden: false, pointerLockElement: null, exitPointerLock: () => {} },
    MOBILE: false, LOCK_COOLDOWN_MS: 1350, performance: { now: () => 100 },
    _lockLostAt: 0, _lockRetryT: null, _lockRetries: 0, _runNeedsRelock: false,
    _relockTries: 1, _lockReqPending: false,
    clearTimeout: () => {}, setTimeout: () => { calls.timers += 1; return 1; },
    enterRunning: () => { calls.enter += 1; state.running = true; },
    T: (_key, fallback) => fallback,
  });
  vm.runInContext(`${cancelRetry[0]}; ${errorHandler[0]}; onPointerLockError();`, context);
  assert.equal(calls.enter, 0);
  assert.equal(calls.request, 0);
  assert.equal(calls.timers, 0);
  assert.equal(state.running, false);
  assert.equal(beginLabel.textContent, "RESUME");
});

test("pointer lock acquisition enters only with a pending run request", () => {
  const cancelRetry = html.match(/function cancelLockRetry\(\)\{[\s\S]*?\n\}/);
  const lockChange = html.match(/document\.addEventListener\('pointerlockchange',\(\)=>\{[\s\S]*?\n\}\);/);
  assert.ok(cancelRetry && lockChange);
  const calls = { enter: 0, exitLock: 0 };
  const state = { running: false };
  const canvas = { requestPointerLock: () => {} };
  const listeners = {};
  const document = {
    hidden: false, pointerLockElement: canvas,
    addEventListener: (name, handler) => { listeners[name] = handler; },
    exitPointerLock: () => { calls.exitLock += 1; document.pointerLockElement = null; },
  };
  const context = vm.createContext({
    state, canvas, document, beginLabel: { textContent: "RESUME" }, beginBtn: { textContent: "▶ RESUME" },
    _lockRetryT: null, _lockRetries: 0, _runNeedsRelock: false, _relockTries: 0,
    _lockReqPending: false, _templeEscapeGuard: false, _templeNeedsRelock: false, _lockLostAt: 0,
    clearTimeout: () => {}, performance: { now: () => 100 },
    enterRunning: () => { calls.enter += 1; state.running = true; },
    exitRunning: () => {}, T: (_key, fallback) => fallback,
  });
  vm.runInContext(`${cancelRetry[0]}; ${lockChange[0]}`, context);
  listeners.pointerlockchange();
  assert.equal(calls.exitLock, 1);
  assert.equal(calls.enter, 0);
  assert.equal(state.running, false);

  document.pointerLockElement = canvas;
  context._lockReqPending = true;
  listeners.pointerlockchange();
  assert.equal(calls.exitLock, 1);
  assert.equal(calls.enter, 1);
  assert.equal(state.running, true);
});

test("stale pointer lock error cannot clear a newer resume request", () => {
  const cancelRetry = html.match(/function cancelLockRetry\(\)\{[\s\S]*?\n\}/);
  const errorHandler = html.match(/function onPointerLockError\(\)\{[\s\S]*?\n\}/);
  const lockChange = html.match(/document\.addEventListener\('pointerlockchange',\(\)=>\{[\s\S]*?\n\}\);/);
  assert.ok(cancelRetry && errorHandler && lockChange);
  const calls = { enter: 0, exitLock: 0, timers: 0 };
  const state = { running: false };
  const canvas = { requestPointerLock: () => {} };
  const listeners = {};
  const document = {
    hidden: false, pointerLockElement: null,
    addEventListener: (name, handler) => { listeners[name] = handler; },
    exitPointerLock: () => { calls.exitLock += 1; document.pointerLockElement = null; },
  };
  const context = vm.createContext({
    state, canvas, document, overlay: { classList: { contains: () => false } },
    beginLabel: { textContent: "RESUME" }, beginBtn: { textContent: "▶ RESUME" },
    MOBILE: false, LOCK_COOLDOWN_MS: 1350, performance: { now: () => 100 },
    _lockLostAt: 0, _lockRetryT: null, _lockRetries: 0, _runNeedsRelock: false,
    _relockTries: 0, _lockReqPending: false, _templeEscapeGuard: false, _templeNeedsRelock: false,
    clearTimeout: () => {}, setTimeout: () => { calls.timers += 1; return 1; },
    enterRunning: () => { calls.enter += 1; state.running = true; },
    exitRunning: () => {}, T: (_key, fallback) => fallback,
  });
  vm.runInContext(`${cancelRetry[0]}; ${errorHandler[0]}; ${lockChange[0]}`, context);
  context._lockReqPending = true; // newer RESUME request B is live when request A's stale error arrives
  vm.runInContext("onPointerLockError();", context);
  document.pointerLockElement = canvas;
  listeners.pointerlockchange();
  assert.equal(calls.enter, 1);
  assert.equal(calls.exitLock, 0);
  assert.equal(state.running, true);
});

test("URL render flags suppress cloud preference reloads", () => {
  assert.match(html, /if\(row\.low_rez!==LOW\s*&&\s*!LOW_FROM_URL\) needsReload=true;/);
  assert.match(html, /if\(row\.sky_mode!==SKY_MODE\s*&&\s*!SKY_MODE_FROM_URL\) needsReload=true;/);
});

test("audio latency prefers the native listener output estimate", () => {
  const source = html.match(/function audioLat\(\)\{[\s\S]*?\n\}/);
  assert.ok(source, "audioLat is present as a testable named function");
  assert.match(html, /const AUDIO_OUT_LATENCY=true;/);
  assert.match(source[0], /const n=\(listener&&listener\.context\)\|\|null;/);
  assert.match(source[0], /AUDIO_OUT_LATENCY/);
  assert.match(source[0], /isFinite\(n\.outputLatency\)/);
  assert.match(source[0], /Math\.min\(n\.outputLatency,0\.35\)/);
  const latency = (outputLatency) => vm.runInNewContext(`${source[0]}; audioLat();`, {
    listener: { context: { outputLatency } }, rawCtx: { baseLatency: 0.01 },
    _userOffsetSec: 0, AUDIO_OUT_LATENCY: true,
  });
  assert.equal(latency(0.03), 0.03);
  assert.equal(latency(1.2), 0.35);
  assert.equal(latency(Infinity), 0.01);
  assert.equal(latency(-0.1), 0.01);
  assert.equal(latency(undefined), 0.01);
});

test("reverb construction fails soft without publishing a partial graph", () => {
  const source = html.match(/function buildReverb\(\)\{[\s\S]*?\n\}/);
  assert.ok(source, "buildReverb is present as a testable named function");
  const input = { gain: {}, connect: () => { throw new Error("closed context"); } };
  const wet = { gain: {}, connect: () => {} };
  let gainCalls = 0;
  const context = vm.createContext({
    reverbInput: null,
    listener: {
      context: {
        createConvolver: () => ({ connect: () => {} }),
        createGain: () => (++gainCalls === 1 ? input : wet),
      },
      getInput: () => ({}),
    },
    makeIR: () => ({}),
  });
  assert.doesNotThrow(() => vm.runInContext(`${source[0]}; buildReverb();`, context));
  assert.equal(context.reverbInput, null);
  assert.match(html, /if\(!reverbInput && listener && !state\.running\)\{ try\{ buildReverb\(\); \}catch\(e\)\{\} \} else scheduleReverbBuild\(\);/);
});

test("the trackpad-safe old code pins the exact sequence, handlers, copy, and rider mutants", () => {
  const exactCode = "const _KONAMI=['KeyW','KeyW','KeyS','KeyS','KeyA','KeyD','KeyA','KeyD','MB0','Space'];";
  const handlerBlock = (source) => {
    const start = source.indexOf("const _KONAMI=");
    const keyStart = source.indexOf("document.addEventListener('keydown',(e)=>{", start);
    const keyEnd = source.indexOf("\n},true);", keyStart) + "\n},true);".length;
    const mouseStart = source.indexOf("document.addEventListener('mousedown',(e)=>{", keyEnd);
    const mouseEnd = source.indexOf("\n},true);", mouseStart) + "\n},true);".length;
    assert.ok(start >= 0 && keyStart > start && keyEnd > keyStart && mouseStart >= keyEnd && mouseEnd > mouseStart, "both pinned capture handlers are extractable");
    return { key: source.slice(keyStart, keyEnd), mouse: source.slice(mouseStart, mouseEnd) };
  };
  const assertContract = (source) => {
    assert.ok(source.includes(exactCode), "the exact trackpad sequence is pinned");
    const handlers = handlerBlock(source);
    assert.match(handlers.key, /const want=_KONAMI\[_konamiI\]/);
    assert.match(handlers.key, /if\(e\.code==='Space'\)\{/);
    assert.match(handlers.key, /if\(want==='Space'\)\{ _konamiI=0; _konamiGrad=true; e\.preventDefault\(\); setTrainPhase\(3\);/);
    assert.match(handlers.mouse, /if\(!_konamiLesson\(\) \|\| e\.button!==0\) return;/);
    assert.match(handlers.mouse, /if\(_KONAMI\[_konamiI\]==='MB0'\) _konamiI\+\+;\s+else _konamiI=0;/);
    assert.doesNotMatch(handlers.mouse, /MB2|button===2|preventDefault|stopImmediatePropagation|toggleSkyFreeze/, "right-click has no surviving capture or sky-freeze swallow arm");
    assert.match(source, /beginAs\(true\); \}\);   \/\/ always trai/, "the begin button is unconditional again — the code lives mid-lesson only");
    assert.match(source, /konamiTeach:'せんせいのひみつ · W W S S A D A D · 左 · スペース — つぎは じゅぎょうをとばせる'/);
    assert.match(source, /konamiTeach','SENSEI\\'S SECRET · W W S S A D A D · L · SPACE — next visit, skip the lesson'/);
    assert.match(source, /konamiToastNow:'月のせんせいは よそみ中 · まんげつの夜へ'/);
    assert.match(handlers.key, /T\('konamiToastNow','MOON SENSEI LOOKS AWAY · THE FULL NIGHT'\)/);
    assert.match(source, /if\(!_konamiGrad\)\{[^\n]*konamiTeach/, "honest graduation teaches the secret; code graduation does not");
    assert.match(source, /konamiTeach[^\n]*\), 2\)/, "the secret holds for two seconds via the slow-toast variant");
    assert.doesNotMatch(source, /localStorage[^\n]*_konami|_konami[^\n]*localStorage/, "the cheat is never persisted");
  };
  assertContract(html);

  const liveHandlers = handlerBlock(html);
  const mb2Survivor = html
    .replace(exactCode, "const _KONAMI=['KeyW','KeyW','KeyS','KeyS','KeyA','KeyD','KeyA','KeyD','MB2','MB0'];")
    .replace(liveHandlers.mouse, liveHandlers.mouse.replace(
      "  if(!_konamiLesson() || e.button!==0) return;",
      "  if(!_konamiLesson()) return;\n  if(e.button===2){ _konamiI++; e.preventDefault(); e.stopImmediatePropagation(); return; }",
    ));
  assert.notEqual(mb2Survivor, html, "the MB2-survivor mutant is constructible");
  assert.throws(() => assertContract(mb2Survivor), assert.AssertionError, "the pinned sequence and handler shape kill the MB2 survivor");

  const spaceNotCompleting = html.replace(liveHandlers.key, liveHandlers.key.replace(" e.preventDefault(); setTrainPhase(3);", " e.preventDefault();"));
  assert.notEqual(spaceNotCompleting, html, "the Space-not-completing mutant is constructible");
  assert.throws(() => assertContract(spaceNotCompleting), assert.AssertionError, "the key-handler contract kills Space without graduation");
});

test("the trackpad-safe old code keeps the shot live and completes only on Space", () => {
  const prefix = ['KeyW','KeyW','KeyS','KeyS','KeyA','KeyD','KeyA','KeyD'];
  const runPrefix = (source, count, click = false) => {
    const start = source.indexOf("let _konamiI=0, _konamiGrad=false;");
    const end = source.indexOf("if(beginTrainBtn) beginTrainBtn.addEventListener", start);
    assert.ok(start >= 0 && end > start, "the complete incantation listener block is extractable");
    const listeners = {}, calls = { phases: [], toasts: [], fires: 0, keyPrevents: 0, mousePrevents: 0, mouseStops: 0 };
    const context = vm.createContext({
      state: { running: true }, trainMode: true, templeActive: false,
      document: { addEventListener(name, handler) { listeners[name] = handler; } },
      isTypingTarget: () => false,
      setTrainPhase(phase) { calls.phases.push(phase); },
      showGhostToast(message) { calls.toasts.push(message); },
      T: (_key, fallback) => fallback,
    });
    vm.runInContext(source.slice(start, end), context);
    for (const code of prefix.slice(0, count)) listeners.keydown({ code, target: null, preventDefault() { calls.keyPrevents += 1; } });
    if (click) {
      const right = { button: 2, preventDefault() { calls.mousePrevents += 1; }, stopImmediatePropagation() { calls.mouseStops += 1; } };
      listeners.mousedown(right);
      const left = { button: 0, stopped: false, preventDefault() { calls.mousePrevents += 1; }, stopImmediatePropagation() { this.stopped = true; calls.mouseStops += 1; } };
      listeners.mousedown(left); if (!left.stopped) calls.fires += 1;
    }
    listeners.keydown({ code: 'Space', target: null, preventDefault() { calls.keyPrevents += 1; } });
    return calls;
  };
  const assertContract = (source) => {
    for (const count of [0, 1, 3, 5, 8]) {
      const calls = runPrefix(source, count);
      assert.deepEqual(calls.phases, [], `Space cannot graduate after prefix ${count}`);
      assert.deepEqual(calls.toasts, [], `Space cannot toast after prefix ${count}`);
      assert.equal(calls.keyPrevents, 0, `Space is not consumed after prefix ${count}`);
    }
    const complete = runPrefix(source, 8, true);
    assert.deepEqual({ phases: complete.phases, toasts: complete.toasts, keyPrevents: complete.keyPrevents }, { phases: [3], toasts: ['✦ MOON SENSEI LOOKS AWAY · THE FULL NIGHT'], keyPrevents: 1 }, "only the complete ten-step sequence graduates, toasts, and consumes Space");
    assert.deepEqual({ fires: complete.fires, mousePrevents: complete.mousePrevents, mouseStops: complete.mouseStops }, { fires: 1, mousePrevents: 0, mouseStops: 0 }, "the L-click propagates to the live canvas shot and right-click remains untouched");
  };
  assertContract(html);
  const progress = "_konamiI=(e.code===_KONAMI[_konamiI])?_konamiI+1:(e.code===_KONAMI[0]?1:0);";
  const mutation = html.replace(progress, `${progress}\n  if(_konamiI===3) setTrainPhase(3);`);
  assert.notEqual(mutation, html, "the third-step graduation mutant is constructible");
  assert.throws(() => assertContract(mutation), assert.AssertionError, "partial-prefix Space coverage kills injected setTrainPhase(3)");
  assert.doesNotThrow(() => assertContract(html), "the complete sequence passes reverted");
});

test("Save my sky remains inside pause settings and outside PLAY controls", () => {
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  assert.match(pauseBlock[0], /id="saveSkyDetails"/);
  assert.match(pauseBlock[0], /Optional\. Email a private link|Optional · play works without it/);
  assert.match(pauseBlock[0], /settings-tabs|data-tab="chart"/);
  assert.ok(html.indexOf('<div id="modePick"') > html.indexOf(pauseBlock[0]) + pauseBlock[0].length);
});

test("observer location controls sit under SKY MOTION inside the SKY panel", () => {
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  assert.match(pauseBlock[0], /id="playSettingsPanel"/);
  assert.match(pauseBlock[0], /id="skySettingsPanel"/);
  assert.match(pauseBlock[0], /id="chartSettingsPanel"/);
  assert.match(pauseBlock[0], /id="helpSettingsPanel"/);
  const locationBlock = pauseBlock[0].match(/<section id="observerLocation"[^>]*>[\s\S]*?<\/section>/);
  assert.ok(locationBlock, "observer controls are inside pause settings");
  assert.ok(pauseBlock[0].indexOf('id="skyMotionRow"') < pauseBlock[0].indexOf('id="observerLocation"'));
  // PLAY panel is separate from SKY panel
  assert.ok(pauseBlock[0].indexOf('id="playSettingsPanel"') < pauseBlock[0].indexOf('id="skySettingsPanel"'));
  assert.ok(pauseBlock[0].indexOf('id="skySettingsPanel"') < pauseBlock[0].indexOf('id="chartSettingsPanel"'));
  assert.ok(pauseBlock[0].indexOf('id="chartSettingsPanel"') < pauseBlock[0].indexOf('id="helpSettingsPanel"'));
  assert.match(locationBlock[0], /id="observerGeoButton"[^>]*>[\s\S]*USE MY LOCATION/i);
  assert.match(locationBlock[0], /id="observerLocationStatus"[^>]*role="status"[^>]*aria-live="polite"/i);

  const lat = locationBlock[0].match(/<input[^>]*id="observerLat"[^>]*>/i);
  const lon = locationBlock[0].match(/<input[^>]*id="observerLon"[^>]*>/i);
  assert.ok(lat && lon);
  assert.match(lat[0], /type="number"/i);
  assert.match(lat[0], /min="-90"/i);
  assert.match(lat[0], /max="90"/i);
  assert.match(lon[0], /min="-180"/i);
  assert.match(lon[0], /max="180"/i);
  assert.doesNotMatch(locationBlock[0], /\sname=/i, "native form serialization cannot leak coordinates");

  assert.match(html, /<script src="observer-location\.js"><\/script>[\s\S]*?<script src="local-sky\.js"><\/script>/);
});

test("observer acquisition is one-shot, fail-soft, and manual-safe", () => {
  const request = html.match(/function requestObserverGeolocation\(explicit\)[\s\S]*?\n\}/);
  assert.ok(request);
  assert.match(request[0], /!explicit && \(_skyObserver\|\|_observerGeoTriedSession\)/);
  assert.match(request[0], /markGeoTried\(localStorage\)/);
  assert.match(request[0], /navigator\.geolocation\.getCurrentPosition/);
  assert.match(request[0], /timeout:8000/);
  assert.match(request[0], /maximumAge:300000/);
  assert.match(request[0], /seq!==_observerGeoSeq/);
  assert.match(request[0], /!explicit&&_skyObserver&&_skyObserver\.source==='manual'/);
  assert.doesNotMatch(request[0], /fetch\(|queueCloudPrefs|enterRunning|startRun/);

  const manual = html.match(/function saveManualObserver\(\)[\s\S]*?\n\}/);
  assert.ok(manual);
  assert.match(manual[0], /coordinate\([^\n]*,-90,90\)/);
  assert.match(manual[0], /coordinate\([^\n]*,-180,180\)/);
  assert.match(manual[0], /\+\+_observerGeoSeq/);
  assert.match(manual[0], /persistSkyObserver\(lat,lon,'manual'\)/);

  assert.match(html, /if\(SKY_MODE!=='decorative'&&SKY_TIME==='natural'&&!hasSkyObserver\(\)\) runIdle\(\(\)=>\{ requestObserverGeolocation\(false\); \}/);
  const render = html.match(/function renderObserverSettings\(\)[\s\S]*?\n\}/);
  assert.ok(render);
  assert.match(render[0], /observerUi\.root\.hidden=decorative/);
  assert.match(render[0], /observerTheatreMode/);
  const status = html.match(/function observerStatusText\(\)[\s\S]*?\n\}/);
  assert.ok(status);
  assert.match(status[0], /observerSetPrompt/);
  assert.match(status[0], /observerGeoFailed/);
  assert.ok(status[0].indexOf("if(_observerNotice)") < status[0].indexOf("if(_skyObserver)"));

  for (const key of [
    "observerLocation", "observerGeo", "observerLat", "observerLon", "observerSave",
    "observerNaturalMode", "observerTheatreMode", "observerSetPrompt", "observerLocating",
    "observerGeoFailed", "observerManualInvalid", "observerSaveFailed",
  ]) assert.match(html, new RegExp(`${key}:`), `${key} is present in window.JA`);
});

test("natural uses a full local-sky attitude while theatre keeps the original sphere spin", () => {
  const attitude = html.match(/function applyNaturalSkyAttitude\(utcMs\)\{[\s\S]*?\n\}/);
  assert.ok(attitude);
  assert.match(attitude[0], /if\(!LOCAL_SKY_MATH\|\|!_skyObserver\) return false/);
  assert.match(attitude[0], /eclipticLocalToWorldMatrix\(_skyObserver\.lat,_skyObserver\.lon,new Date\(utcMs\),\{obliquityDeg:LOCAL_SKY_MATH\.J2000_OBLIQUITY_DEG\}\)/);
  assert.match(attitude[0], /_localSkyMatrix\.set\(m\[0\],m\[1\],m\[2\],0,m\[3\],m\[4\],m\[5\],0,m\[6\],m\[7\],m\[8\],0,0,0,0,1\)/);
  assert.match(attitude[0], /_qLocalSky\.setFromRotationMatrix\(_localSkyMatrix\)\.normalize\(\)/);
  assert.match(attitude[0], /skySphere\.quaternion\.copy\(_qLocalSky\)/);
  assert.match(attitude[0], /\+X=west, \+Y=zenith, \+Z=north/);

  const update = html.match(/function updateSky\(dt\)\{[\s\S]*?\n\}\nlet skyT=/);
  assert.ok(update);
  assert.match(update[0], /const skyTime=\(templeActive&&CFG\.skyTemple\.forceNaturalInTemple\)\?'natural':SKY_TIME/);
  assert.match(update[0], /else if\(skyTime==='theatre'\)\{ if\(!skyFrozen\) dayPhase=/);
  assert.match(update[0], /else \{ dayPhase=clockedDayPhase\(Date\.now\(\)\); skyFrozen=false; \}/);
  assert.match(update[0], /const localAttitude=skyTime==='natural'&&applyNaturalSkyAttitude\(Date\.now\(\)\)/);
  assert.match(update[0], /if\(!localAttitude\)[\s\S]*?_qSpin\.setFromAxisAngle\(SPH_POLE, sunA-_sunLonRad\)/);
  assert.match(update[0], /skySphere\.quaternion\.copy\(_qSpin\)\.multiply\(_qBase\)/);
  assert.match(update[0], /sunDir\.copy\(_lum\.sun\.glyph\.position\)\.applyQuaternion\(skySphere\.quaternion\)\.normalize\(\)/);

  const horizon = html.match(/function updateChartSky\(\)\{[\s\S]*?\n\}/);
  const pick = html.match(/function pickCelestial\(\)\{[\s\S]*?\n\}/);
  assert.ok(horizon && pick);
  assert.match(horizon[0], /applyQuaternion\(skySphere\.quaternion\)/);
  assert.match(pick[0], /applyQuaternion\(skySphere\.quaternion\)/);
});

test("natural right-click dismisses Listen but cannot mutate the sky freeze", () => {
  const freeze = html.match(/function toggleSkyFreeze\(\)\{[\s\S]*?\n\}/);
  assert.ok(freeze);
  const dismissIndex = freeze[0].indexOf("dismissListenIfOpen()");
  const naturalIndex = freeze[0].indexOf("SKY_TIME==='natural'");
  const mutationIndex = freeze[0].indexOf("skyFrozen=!skyFrozen");
  assert.ok(dismissIndex >= 0 && naturalIndex > dismissIndex && mutationIndex > naturalIndex);
  assert.match(freeze[0], /if\(SKY_MODE!=='decorative' && SKY_TIME==='natural'\)[\s\S]*?return;/);
  assert.match(html, /id="freezeDesc">dismiss sky note/);
  assert.doesNotMatch(html, /R-CLICK freezes the sky/);
});

test("Today's sky note control is chart-gated inside pause settings", () => {
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  const noteBlock = pauseBlock[0].match(/<(?:div|section) id="transitEssayBlock"[^>]*>[\s\S]*?<\/(?:div|section)>/);
  assert.ok(noteBlock, "transit essay controls are inside pause-only settings");
  assert.ok(pauseBlock[0].indexOf('id="transitEssayBlock"') > pauseBlock[0].indexOf('id="saveSkyDetails"'));
  assert.match(pauseBlock[0], /settings-tabs|data-tab="chart"/, "settings use tab panels");
  assert.match(noteBlock[0], /\shidden(?:\s|>|=)/i);
  const button = noteBlock[0].match(/<button[^>]*\bid="transitEssayButton"[^>]*>/i);
  assert.ok(button);
  assert.match(button[0], /\btype="button"/i);
  assert.match(button[0], /\bdisabled(?:\s|>|=)/i);
  assert.match(noteBlock[0], /id="transitEssayButtonLabel"[^>]*>TODAY(?:&apos;|&#39;|')S SKY NOTE</i);
  const status = noteBlock[0].match(/<[^>]+\bid="transitEssayStatus"[^>]*>/i);
  assert.ok(status);
  assert.match(status[0], /\brole="status"/i);
  assert.match(status[0], /\baria-live="polite"/i);
});

test("Today's sky brief is a chart-gated pause block with private copy controls", () => {
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  const briefBlock = pauseBlock[0].match(/<section id="skyBriefBlock"[^>]*>[\s\S]*?<\/section>/);
  assert.ok(briefBlock, "sky brief controls are inside pause-only settings");
  assert.ok(pauseBlock[0].indexOf('id="skyBriefBlock"') > pauseBlock[0].indexOf('id="saveSkyDetails"'));
  assert.match(briefBlock[0], /\shidden(?:\s|>|=)/i);
  assert.match(briefBlock[0], /id="skyBriefTitle"[^>]*>CHART \+ TRANSITS</i);

  const status = briefBlock[0].match(/<[^>]+\bid="skyBriefStatus"[^>]*>/i);
  assert.ok(status);
  assert.match(status[0], /\brole="status"/i);
  assert.match(status[0], /\baria-live="polite"/i);

  const preview = briefBlock[0].match(/<textarea[^>]*\bid="skyBriefPreview"[^>]*>/i);
  assert.ok(preview);
  assert.match(preview[0], /\breadonly(?:\s|>|=)/i);
  assert.match(preview[0], /\bhidden(?:\s|>|=)/i);
  assert.doesNotMatch(preview[0], /\bname=/i);

  const toggle = briefBlock[0].match(/<button[^>]*\bid="skyBriefToggle"[^>]*>/i);
  assert.ok(toggle, "chart+transits data can be collapsed");
  assert.match(toggle[0], /\btype="button"/i);
  assert.match(toggle[0], /\bhidden(?:\s|>|=)/i);
  assert.match(briefBlock[0], /id="skyBriefToggleLabel"[^>]*>SHOW DATA</i);

  const copy = briefBlock[0].match(/<button[^>]*\bid="skyBriefCopy"[^>]*>/i);
  assert.ok(copy);
  assert.match(copy[0], /\btype="button"/i);
  assert.match(copy[0], /\bdisabled(?:\s|>|=)/i);
  assert.match(briefBlock[0], /sky note stays in the button above/i);

  // Essay reader stays a separate control above the data export
  assert.ok(pauseBlock[0].indexOf('id="transitEssayBlock"') < pauseBlock[0].indexOf('id="skyBriefBlock"'));

  const shareBlock = html.match(/<div id="shareOverlay"[\s\S]*?<\/div>\s*<script>/);
  assert.ok(shareBlock);
  assert.doesNotMatch(shareBlock[0], /skyBrief|CHART \+ TRANSITS|COPY DATA/i);
});

test("HELP tab explains dojo, temple, and chart keys in context", () => {
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  assert.match(pauseBlock[0], /data-tab="help"/);
  assert.match(pauseBlock[0], /id="helpSettingsPanel"/);
  assert.match(pauseBlock[0], /id="helpDojoTitle"/);
  assert.match(pauseBlock[0], /id="helpTempleTitle"/);
  assert.match(pauseBlock[0], /id="helpChartTitle"/);
  assert.match(pauseBlock[0], /HOLD E \+ FIRE/);
  assert.match(pauseBlock[0], /mark a sky object/i);
  assert.match(pauseBlock[0], /E<\/b>\s*\(again, after a mark\)/i);
  assert.match(pauseBlock[0], /Enter<\/b>\s*— from dojo/i);
  assert.match(pauseBlock[0], /SHIFT\+E/);
  assert.match(pauseBlock[0], /ask the sky \(needs a saved chart/i);
  assert.match(pauseBlock[0], /EDIT CHART/);
  assert.match(pauseBlock[0], /NEW CHART/);
});

test("saved chart collapses birth fields behind EDIT / NEW", () => {
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  assert.match(pauseBlock[0], /id="saveSkySummary"/);
  assert.match(pauseBlock[0], /id="saveSkyFormWrap"/);
  assert.match(pauseBlock[0], /id="saveSkyEdit"/);
  assert.match(pauseBlock[0], /id="saveSkyNew"/);
  assert.match(pauseBlock[0], /id="saveSkyCancelEdit"/);
  assert.match(pauseBlock[0], /EDIT CHART/);
  assert.match(pauseBlock[0], /NEW CHART/);

  const render = html.match(/function skyRenderAccount\(keepStatus\)[\s\S]*?\n\}/);
  assert.ok(render);
  assert.match(render[0], /_skyChartEditing/);
  assert.match(render[0], /skySave\.summary\.hidden/);
  assert.match(render[0], /skySave\.formWrap\.hidden/);

  const begin = html.match(/function skyBeginChartEdit\(mode\)[\s\S]*?\n\}/);
  assert.ok(begin);
  assert.match(begin[0], /mode==='new'/);
  assert.match(begin[0], /skyClearForm\(\)/);
  assert.match(begin[0], /skyFillForm\(profile,true\)/);

  const cancel = html.match(/function skyCancelChartEdit\(\)[\s\S]*?\n\}/);
  assert.ok(cancel);
  assert.match(cancel[0], /_skyChartEditing=false/);

  assert.match(html, /skySave\.edit\.addEventListener\('click'/);
  assert.match(html, /skySave\.newBtn\.addEventListener\('click'/);
  assert.match(html, /skySave\.cancelEdit\.addEventListener\('click',skyCancelChartEdit\)/);

  const lon = pauseBlock[0].match(/<input[^>]*id="saveSkyLon"[^>]*>/i);
  assert.ok(lon);
  assert.match(lon[0], /min="-180"/i);
  assert.match(lon[0], /max="180"/i);
});

test("sky brief fetch is pause-only, fail-soft, and stale-account guarded", () => {
  const gate = html.match(/function skyBriefPauseOpen\(\)[\s\S]*?\n\}/);
  assert.ok(gate);
  assert.match(gate[0], /state\.started/);
  assert.match(gate[0], /!state\.running/);
  assert.match(gate[0], /!document\.hidden/);
  assert.match(gate[0], /overlay\.classList\.contains\('hidden'\)/);

  const fetchBrief = html.match(/async function fetchSkyBriefForPause\(\)[\s\S]*?\n\}/);
  assert.ok(fetchBrief);
  assert.ok(fetchBrief[0].indexOf("!skyBriefPauseOpen()") < fetchBrief[0].indexOf("ctl.getSkyBrief()"));
  assert.match(fetchBrief[0], /try\{[\s\S]*ctl\.getSkyBrief\(\)[\s\S]*\}catch\(error\)\{/);
  assert.ok((fetchBrief[0].match(/_skyBriefPhase='unavailable'/g) || []).length >= 2);
  assert.match(fetchBrief[0], /if\(!skyBriefRecordCurrent\(\)\)\{ _skyBrief=null/);
  assert.doesNotMatch(fetchBrief[0], /enqueue|setTimeout|enterRunning|startRun/);

  const renderBrief = html.match(/function renderSkyBriefUi\(\)[\s\S]*?\n\}/);
  assert.ok(renderBrief);
  assert.ok(renderBrief[0].indexOf("_skyBriefPhase==='unavailable'") < renderBrief[0].indexOf("TF('skyBriefReady'"));
  assert.match(renderBrief[0], /const eligible=skyBriefEligible\(\), ready=eligible&&skyBriefRecordCurrent\(\)/);
  assert.match(renderBrief[0], /expanded=ready&&_skyBriefExpanded/);
  assert.match(renderBrief[0], /preview\.hidden=!expanded/);
  assert.match(html, /skyBriefUi\.toggle\.addEventListener\('click',toggleSkyBriefExpanded\)/);

  const stale = html.match(/function skyBriefStillCurrent\(seq,user,generation\)[\s\S]*?\n\}/);
  assert.ok(stale);
  assert.match(stale[0], /seq===_skyBriefSeq/);
  assert.match(stale[0], /user===_skyAuthUser/);
  assert.match(stale[0], /skyBriefEligible\(\)/);
  assert.match(stale[0], /skyBriefPauseOpen\(\)/);
  assert.match(stale[0], /ctl\.state\.generation===generation/);

  const currentRecord = html.match(/function skyBriefRecordCurrent\(\)[\s\S]*?\n\}/);
  assert.ok(currentRecord);
  assert.match(currentRecord[0], /_skyBriefRecordUser===_skyAuthUser/);
  assert.match(currentRecord[0], /_skyBriefRecordGeneration===ctl\.state\.generation/);

  const pause = html.match(/function showPause\(\)[\s\S]*?\n\}\n\n\(function\(\)/);
  assert.ok(pause);
  assert.ok(pause[0].indexOf("overlay.classList.remove('hidden')") < pause[0].indexOf("fetchSkyBriefForPause()"));
  const animate = html.match(/function animate\(frameNow\)[\s\S]*?\/\* ========================= OVERLAY/);
  assert.ok(animate);
  assert.doesNotMatch(animate[0], /fetchSkyBriefForPause|getSkyBrief/);
  for (const combatPath of [
    html.match(/function fire\(\)[\s\S]*?\n\}/),
    html.match(/function wasdLanePress\(k\)[\s\S]*?\n\}/),
    html.match(/function enterRunning\(\)[\s\S]*?\n\}/),
    html.match(/function startRun\(viaPad\)[\s\S]*?\n\}/),
  ]) {
    assert.ok(combatPath);
    assert.doesNotMatch(combatPath[0], /getSkyBrief|fetchSkyBriefForPause|\bawait\b/);
  }

  const accept = html.match(/function skyAcceptAuthSession\(session\)[\s\S]*?\n\}/);
  const clear = html.match(/if\(skySave\.clear\)[\s\S]*?if\(skySave\.signOut\)/);
  assert.ok(accept);
  assert.ok(clear);
  assert.match(accept[0], /skyBriefReset\(\)/);
  assert.match(clear[0], /skyBriefReset\(\)/);
});

test("COPY DATA uses the full server text with clipboard fallback and localized chrome", () => {
  const render = html.match(/function renderSkyBriefUi\(\)[\s\S]*?\n\}/);
  assert.ok(render);
  assert.match(render[0], /preview\.value=ready\?_skyBrief\.text:''/);
  assert.doesNotMatch(render[0], /innerHTML|\.text\.trim|T\([^\n]*_skyBrief\.text/);

  const copy = html.match(/async function copySkyBrief\(\)[\s\S]*?\n\}/);
  assert.ok(copy);
  assert.match(copy[0], /navigator\.clipboard\.writeText\(record\.text\)/);
  assert.match(copy[0], /skyBriefUi\.preview\.select\(\)/);
  assert.match(copy[0], /document\.execCommand\('copy'\)===true/);
  assert.match(copy[0], /showGhostToast\(T\('skyBriefCopied','DATA COPIED'\)\)/);
  assert.ok(copy[0].indexOf("skyBriefPauseOpen()") < copy[0].indexOf("navigator.clipboard.writeText"));
  assert.ok(copy[0].indexOf("await navigator.clipboard.writeText(record.text)") < copy[0].lastIndexOf("skyBriefCopyStillCurrent(seq,user,generation,record)"));
  assert.ok(copy[0].lastIndexOf("skyBriefCopyStillCurrent(seq,user,generation,record)") < copy[0].indexOf("showGhostToast"));
  assert.match(html, /skyBriefUi\.copy\.addEventListener\('click',copySkyBrief\)/);
  assert.equal((html.match(/navigator\.clipboard\.writeText\(record\.text\)/g) || []).length, 1);
  assert.equal((html.match(/copySkyBrief/g) || []).length, 2, "data copy runs only from its user click handler");
  for (const key of ["skyBriefTitle", "skyBriefLoading", "skyBriefReady", "skyBriefUnavailable", "skyBriefCopy", "skyBriefCopied", "skyBriefShow", "skyBriefHide", "skyBriefPrivate"]) {
    assert.match(html, new RegExp(`${key}:`), `${key} is present in window.JA`);
  }
  for (const key of ["helpSettingsSummary", "saveSkyEdit", "saveSkyNew", "saveSkyCancelEdit"]) {
    assert.match(html, new RegExp(`${key}:`), `${key} is present in window.JA`);
  }
});

test("clipboard denial exercises the COPY DATA fallback without crossing a stale pause", async () => {
  const currentSource = html.match(/function skyBriefCopyStillCurrent\(seq,user,generation,record\)[\s\S]*?\n\}/);
  const copySource = html.match(/async function copySkyBrief\(\)[\s\S]*?\n\}/);
  assert.ok(currentSource);
  assert.ok(copySource);

  function contextFor(onWrite) {
    const events = [];
    const record = { status: "ready", text: "full server brief\nwith every section" };
    const context = {
      _skyBrief: record,
      _skyBriefSeq: 7,
      _skyAuthUser: "user-one",
      _skyProfileController: { state: { generation: 4 } },
      skyBriefEligible: () => true,
      skyBriefPauseOpen: () => true,
      skyBriefRecordCurrent: () => true,
      skyBriefUi: {
        preview: {
          hidden: true,
          focus: () => events.push("focus"),
          select: () => events.push("select"),
        },
        status: { textContent: "" },
      },
      navigator: { clipboard: { writeText: (text) => onWrite(text, events, context) } },
      document: {
        execCommand: (command) => {
          events.push(`exec:${command}`);
          return true;
        },
      },
      showGhostToast: (text) => events.push(`toast:${text}`),
      T: (_key, english) => english,
      TF: (_key, english, values) => english.replace("{keys}", values.keys),
    };
    vm.runInNewContext(`${currentSource[0]}\n${copySource[0]}\nthis.runCopy = copySkyBrief;`, context);
    return { context, events, record };
  }

  const fallback = contextFor(async (text, events) => {
    events.push(`write:${text}`);
    throw new Error("permission denied");
  });
  await fallback.context.runCopy();
  assert.deepEqual(fallback.events, [
    `write:${fallback.record.text}`,
    "focus",
    "select",
    "exec:copy",
    "toast:DATA COPIED",
  ]);

  let pauseOpen = true;
  const stale = contextFor(async (_text, events, context) => {
    events.push("write");
    pauseOpen = false;
    context.skyBriefPauseOpen = () => pauseOpen;
    throw new Error("permission denied after resume");
  });
  await stale.context.runCopy();
  assert.deepEqual(stale.events, ["write"], "resume suppresses fallback controls and toast");
});

test("pause reader has all private note fields and a non-resuming close control", () => {
  for (const id of [
    "transitEssayReader",
    "transitEssayReaderHeadline",
    "transitEssayReaderDate",
    "transitEssayReaderBody",
    "transitEssayReaderWatchpoints",
    "transitEssayReaderEpistemic",
    "transitEssayReaderClose",
  ]) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} exists exactly once`);
  }
  const reader = html.match(/<(?:div|section)[^>]*\bid="transitEssayReader"[^>]*>/);
  assert.ok(reader);
  assert.match(reader[0], /\b(?:hidden|class="[^"]*hidden)/i);
  const closeButton = html.match(/<button[^>]*\bid="transitEssayReaderClose"[^>]*>/i);
  assert.ok(closeButton);
  assert.match(closeButton[0], /\btype="button"/i);

  const closeHandler = html.match(/transitEssayUi\.close[^\n]*addEventListener\(['"]click['"][^\n]*/);
  assert.ok(closeHandler, "reader close has an explicit click handler");
  assert.match(closeHandler[0], /closeTransitEssayReader\(true\)/);
  const closeFunction = html.match(/function closeTransitEssayReader\(restoreFocus\)[\s\S]*?\n\}/);
  assert.ok(closeFunction);
  assert.doesNotMatch(closeFunction[0], /enterRunning|startRun|requestPointerLock|beginBtn\.click/);
});

test("model-authored transit essay fields are rendered as text, never HTML", () => {
  const render = html.match(/function openTransitEssayReader\(\)[\s\S]*?\n\}/);
  assert.ok(render);
  assert.match(render[0], /\.headline\.textContent=record\.headline/);
  assert.match(render[0], /record\.body\.split/);
  assert.match(render[0], /createElement\('p'\);\s*p\.textContent=/);
  assert.match(render[0], /record\.watchpoints/);
  assert.match(render[0], /createElement\('li'\);\s*li\.textContent=/);
  assert.match(render[0], /\.epistemic\.textContent=record\.epistemic/);
  assert.doesNotMatch(render[0], /\.innerHTML\s*=/);
});

test("transit essay polling is visible-tab-only, backed off, bounded, and terminal", () => {
  const policy = html.match(/const TRANSIT_ESSAY_POLL_DELAYS=\[([^\]]+)\],\s*TRANSIT_ESSAY_MAX_MS=(\d+);/);
  assert.ok(policy);
  const delays = policy[1].split(",").map((value) => Number(value.trim()));
  assert.deepEqual(delays, [8000, 10000, 12000, 15000]);
  assert.equal(Number(policy[2]), 180000);
  assert.ok(delays.every((delay, index) => delay >= 8000 && delay <= 15000 && (!index || delay >= delays[index - 1])));

  const schedule = html.match(/function transitEssaySchedulePoll\(seq\)[\s\S]*?\n\}/);
  assert.ok(schedule);
  assert.ok(schedule[0].indexOf("if(document.hidden) return") < schedule[0].indexOf("setTimeout"));
  assert.match(schedule[0], /TRANSIT_ESSAY_MAX_MS-\(Date\.now\(\)-_transitEssayStartedAt\)/);
  assert.match(schedule[0], /remaining<=0\)\{ transitEssayFinishUnavailable\(\)/);
  assert.match(schedule[0], /TRANSIT_ESSAY_POLL_DELAYS\[Math\.min\(_transitEssayPollStep/);

  const visibility = html.match(/function transitEssayVisibilityChanged\(\)[\s\S]*?\n\}/);
  assert.ok(visibility);
  assert.match(visibility[0], /if\(document\.hidden\)\{ transitEssayClearPollTimer\(\); return; \}/);
  assert.match(visibility[0], /transitEssayFlushReadyToast\(\)/);
  assert.match(visibility[0], /transitEssaySchedulePoll\(_transitEssaySeq\)/);
  const browserVisibility = html.match(/document\.addEventListener\('visibilitychange',[\s\S]*?\n\}\);/);
  assert.ok(browserVisibility);
  assert.match(browserVisibility[0], /transitEssayVisibilityChanged\(\)/);

  const terminal = html.match(/function transitEssayFinishUnavailable\(\)[\s\S]*?\n\}/);
  assert.ok(terminal);
  assert.match(terminal[0], /transitEssayClearPollTimer\(\)/);
  assert.match(terminal[0], /_transitEssayActive=false/);
  assert.match(terminal[0], /_transitEssayPhase='unavailable'/);
});

test("ready transit essay toast is deduplicated and emitted from one literal call site", () => {
  assert.equal((html.match(/showGhostToast\('SKY NOTE READY'\)/g) || []).length, 1);
  const flush = html.match(/function transitEssayFlushReadyToast\(\)[\s\S]*?\n\}/);
  assert.ok(flush);
  assert.ok(flush[0].indexOf("_transitEssayToastKeys.has(pending)") < flush[0].indexOf("showGhostToast('SKY NOTE READY')"));
  assert.ok(flush[0].indexOf("_transitEssayToastKeys.add(pending)") < flush[0].indexOf("showGhostToast('SKY NOTE READY')"));
  assert.match(flush[0], /document\.hidden/);
  assert.equal((html.match(/openTransitEssayReader/g) || []).length, 2, "reader opens only from its function and button handler");
});

test("native form fallback cannot serialize birth fields into the page URL", () => {
  const form = html.match(/<form id="saveSkyForm"[\s\S]*?<\/form>/);
  assert.ok(form);
  assert.doesNotMatch(form[0], /\sname=/i);
});

test("dojo submission allowlist contains no profile or birth fields", () => {
  const row = html.match(/const row=\{\s*client_id:[^;]+?\};/);
  assert.ok(row, "leaderboard row literal is present");
  const keys = [...row[0].matchAll(/(?:\{|,)\s*([a-z_]+)\s*:/g)].map((match) => match[1]);
  assert.deepEqual(keys, ["client_id", "name", "peak_bpm", "runtime", "far", "high", "streak", "kills"]);
  assert.doesNotMatch(row[0], /birth|\bplace\b|\blat\b|\blon\b|\btz\b|observer|profile|natal|essay|brief|sky.?note|skyBrief|cache_date|has_essay|headline|body|watchpoint|epistemic/i);
});

test("share links and dojo POST bodies cannot receive private study content", () => {
  const shareLink = html.match(/function shareLinkUrl\(\)\{[^}]*\}/);
  assert.ok(shareLink);
  assert.match(shareLink[0], /location\.origin\+location\.pathname/);
  assert.doesNotMatch(shareLink[0], /location\.(?:search|hash)|URLSearchParams|observer|aimdojo\.observer|essay|brief|sky.?note|skyBrief|cache_date|has_essay|headline|body|watchpoint|epistemic/i);

  const submit = html.match(/async function submitDojo\(\)[\s\S]*?function _localRuntime/);
  assert.ok(submit);
  assert.doesNotMatch(submit[0], /observer|aimdojo\.observer|essay|brief|sky.?note|skyBrief|cache_date|has_essay|headline|watchpoint|epistemic|birth|\bplace\b|\blat\b|\blon\b|\btz\b|profile|natal/i);

  const realtime = html.match(/function broadcastAim\(\)[\s\S]*?const REMOTE_UPDATE_STEP/);
  assert.ok(realtime);
  assert.doesNotMatch(realtime[0], /observer|aimdojo\.observer|\blat\b|\blon\b/i);

  const cloud = html.match(/const CLOUD_PREF_SELECT=[\s\S]*?let _cloudPrefsTimer/);
  assert.ok(cloud);
  assert.doesNotMatch(cloud[0], /observer|observer_lat|observer_lon/i);
});

test("token-bearing base is fixed config, never the public URL override", () => {
  const declaration = html.match(/const PERSONAL_API_BASE=[^;]+;/);
  const selector = html.match(/function selectConfiguredPersonalApiBase\(\)[\s\S]*?\n\}/);
  assert.ok(declaration);
  assert.ok(selector);
  assert.match(declaration[0], /selectConfiguredPersonalApiBase\(\)/);
  assert.match(selector[0], /selectPersonalApiBase\(CFG\.personalApi,CFG\.skyDay\.api\)/);
  assert.doesNotMatch(selector[0], /SKY_DAY_API_BASE|localStorage|location|CFG\.skyApi|\?skyApi/i);
});

test("orb blocking still wins before any celestial Listen pick", () => {
  const fn = html.match(/function skyListenTry\(\)[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.ok(fn[0].indexOf("_lsnOrbBlocksSky()") < fn[0].indexOf("pickCelestial()"));
});

test("a saved profile cannot inject chart geometry into decorative mode", () => {
  const fn = html.match(/function linkRemotePersonalSky\(pack\)[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /SKY_MODE==='decorative'\) return false/);
  assert.ok(fn[0].indexOf("SKY_MODE==='decorative'") < fn[0].indexOf("queueSkyGeometry"));
});

test("authenticated no-chart state quarantines every legacy personal pack", () => {
  const load = html.match(/async function skyLoadSavedProfile\(ticket\)[\s\S]*?\n\}/);
  assert.ok(load);
  assert.match(load[0], /_chartPackRank>=2\) downgradePersonalSky\(\)/);
  assert.match(html, /loadSkypack\(\)\.then\(p=>\{[\s\S]*?if\(_skyAuthSession\) return;/);
});

test("initial guest auth resolution preserves a requested legacy chart", () => {
  const handle = html.match(/function skyHandleSession\(session\)[\s\S]*?\n\}/);
  assert.ok(handle);
  const guestBranch = handle[0].match(/if\(!next\)\{[\s\S]*?return;\s*\}/);
  assert.ok(guestBranch);
  assert.doesNotMatch(guestBranch[0], /downgradePersonalSky/);
});

test("auth switches quarantine old profile state before exposing the new token", () => {
  const accept = html.match(/function skyAcceptAuthSession\(session\)[\s\S]*?\n\}/);
  assert.ok(accept);
  assert.ok(accept[0].indexOf("setAuthenticated(false)") < accept[0].indexOf("_skyAuthSession=session"));
  assert.ok(accept[0].indexOf("skyClearForm()") < accept[0].indexOf("_skyAuthSession=session"));
});

test("busy Save my sky requests disable controls and reject overlapping handlers", () => {
  const status = html.match(/function skySetStatus\(text,busy\)[\s\S]*?\n\}/);
  assert.ok(status);
  assert.match(status[0], /control\.disabled=!!busy/);
  assert.ok((html.match(/if\(_skyUiBusy\) return;/g) || []).length >= 3);
});

test("ordinary focused settings buttons do not strand gamepad resume", () => {
  const fn = html.match(/function padBeginBlocked\(\)[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.doesNotMatch(fn[0], /INPUT\|TEXTAREA\|SELECT\|BUTTON/);
  assert.match(fn[0], /chartSettingsPanel|saveSkyDetails/);
  assert.match(fn[0], /transitEssayReader/);
});

test("the void never schedules and never emits a floor beat ring", () => {
  const scheduler = html.match(/const beatIdx=i\/2;[\s\S]*?emitRing\(\); \}, time\); \}catch\(e\)\{[^\n]*\n/);
  assert.ok(scheduler, "the onGrid beat-ring scheduler is present");
  // Gated at the SCHEDULE (no Draw closure allocated on a void beat) AND inside the callback + its catch
  // fallback (the graduation flip: a ring scheduled one audio-lookahead before setTrainPhase(3)).
  assert.match(scheduler[0], /if\(\(beatIdx%2===0 \|\| state\.streak>=8\) && !moonlineVoid\(\)\)/);
  assert.equal((scheduler[0].match(/!templeActive&&!moonlineVoid\(\)\) emitRing\(\)/g) || []).length, 2);
});

test("beat rings alive at graduation fade on the floor dissolve's own blend", () => {
  const loop = html.match(/if\(state\.running && !templeActive && activeRingCount>0\)\{[\s\S]*?\n  \} else clearRings\(\);/);
  assert.ok(loop, "the animate beat-ring pass is present");
  // One timeline, no second duration: _mlBlend IS floorDissolveSec's ramp, and 0 opacity retires the pool.
  assert.match(loop[0], /const mlFade=moonlineVoid\(\)\?Math\.max\(0,1-_mlBlend\):1;/);
  assert.match(loop[0], /if\(mlFade<=0\) clearRings\(\);/);
  assert.match(loop[0], /r\.intensity\*\(1-ageB\/RING_LIFE\)\*mlFade\*RING_OP_SCALE/);
});

test("a void miss loses its floor ring and keeps its ballistic termination", () => {
  const spawn = html.match(/function spawnLandRing\(x,z\)\{\n[^\n]*\n/);
  assert.ok(spawn, "spawnLandRing is present");
  assert.match(spawn[0], /^function spawnLandRing\(x,z\)\{\n  if\(moonlineVoid\(\)\) return;/);

  // THE TREADMILL LAW: the gate is on the VISUAL, never on the y=0 termination that grades the miss.
  const update = html.match(/function updateProjectiles\(dt\)\{[\s\S]*?\n\}/);
  assert.ok(update, "the projectile update is present");
  const terminate = update[0].match(/const gift=!!\(GH_GIFT&&pr\.gift\);\n\s*if\(pr\.life>=CFG\.projLife \|\| pr\.pos\.y<=0\.04[^\n]*\n/);
  assert.ok(terminate, "the projectile termination line is present");
  assert.match(terminate[0], /\(!gift && \(Math\.abs\(pr\.pos\.x\)>ROOM_HALF_W \|\| Math\.abs\(pr\.pos\.z\)>ROOM_HALF_D\)\)/);
  assert.match(terminate[0], /if\(!gift && pr\.pos\.y<=0\.04 && \(!ML_ARC_VOID \|\| !moonlineVoid\(\)\)\) spawnLandRing\(pr\.pos\.x, pr\.pos\.z\); onWhiff\(gift\); retireProjectile\(i\); continue;/);
  assert.doesNotMatch(terminate[0].slice(0, terminate[0].indexOf("{")), /moonline|_mlBlend|roadLive/i);
});

test("the Temple sweeps both floor-ring pools, on every build", () => {
  const enter = html.match(/function enterSkyTemple\(options\)\{[\s\S]*?\n  hideArc\(\);/);
  assert.ok(enter, "enterSkyTemple's field teardown is present");
  assert.match(enter[0], /clearProjectiles\(\); clearRings\(\); clearLandRings\(\);/);
  const sweep = enter[0].match(/[^\n]*clearLandRings\(\)[^\n]*/)[0].split("//")[0];
  assert.doesNotMatch(sweep, /moonline|CFG\.moonline/i);   // a latent temple bug on any build — never gated
  assert.match(html, /function clearLandRings\(\)\{[^]*?for\(const lr of landRingPool\)\{ if\(lr\.active\)\{ lr\.active=false; lr\.mesh\.visible=false; \} \}/);
});
