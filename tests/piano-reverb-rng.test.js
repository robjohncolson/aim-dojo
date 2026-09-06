"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { extractFunction } = require("./chip-graph.js");

// Revised R4: piano omits IR and its random draws; a different opening is accepted.
// The historical arm calls the real IR builder at its former init boundary.
// It is diagnostic only: no discarded-draw substitute or application edit.
// Peripheral Tone/UI mocks do not establish native-audio or browser performance.
const functions = ["makeIR", "buildReverb", "scheduleReverbBuild", "initAudio",
  "startRun", "enterRunning", "exitRunning", "resetSession", "makeWasdCombo"];
const program = functions.map(name => extractFunction(main, name)).join("\n");

function pianoReverbRngHarness(sampleRate, mode = "piano", wind = false, options = {}) {
  const events = [], buffers = [], scheduled = [], instruments = [];
  const counts = { random: 0, convolvers: 0, gains: 0, irDraws: 0, atCombo: null };
  let seed = 0x12345678;
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    counts.random++;
    return seed / 0x100000000;
  };
  const noop = () => {};
  const native = {
    state: "running", sampleRate,
    createConvolver() { counts.convolvers++; return { connect: noop }; },
    createGain() { counts.gains++; return { gain: { value: 0 }, connect: noop }; },
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      buffers.push({ channels, length, rate });
      return { getChannelData: channel => data[channel] };
    },
  };
  const Tone = { start: () => events.push("Tone.start"), getContext: () => ({ rawContext: native }) };
  for (const name of ["FMSynth", "Synth", "NoiseSynth", "PolySynth", "Volume", "Filter"]) {
    Tone[name] = function (...args) {
      instruments.push({ type: name, args: JSON.parse(JSON.stringify(args)), randomAtConstruction: counts.random });
      events.push("Tone." + name);
      this.connect = () => this;
      this.toDestination = () => this;
    };
  }
  const classList = { add: noop, remove: noop };
  const window = { Tone };
  if (options.idle) window.requestIdleCallback = (fn, settings) => {
    scheduled.push({ kind: "idle", fn, delay: settings.timeout });
    return scheduled.length;
  };
  const context = vm.createContext({
    Math: math, Tone, window, PIANO: mode !== "legacy", MOBILE: true, LOW: true,
    CFG: { pianoNativeContext: false, pianoFirstUse: true, chorus: { on: false },
      nightCard: { on: false }, deal: { on: false }, stars: { on: false },
      wind, windMin: 0.2, windMax: 0.8, wasdComboLen: 8, startBpm: 28, rangeStart: 11 },
    // Fresh initialization, not initAudio's already-initialized return.
    audioInit: false, toneReady: false, rawCtx: null, listener: null,
    reverbInput: null, reverbQueued: false,
    state: { started: false, needsReset: false, running: !!options.running },
    templeActive: false, trainMode: false, rhythmGeneration: 0, _windFlag: false,
    targets: [], events: [], _resolved: new Set(), bonusLocks: [], _bowHits: [],
    ML_WALL_ECHO: false, ML_DOOR_CROSS: true, DOOR_WHOOSH_DB: -24,
    _themeReveal: false, _templeResumeWanted: false, trainCoachEl: null,
    document: { body: { classList } }, overlay: { classList }, touchUI: { classList },
    localStorage: { setItem: noop }, clock: { getDelta: noop },
    setTimeout: (fn, delay) => { scheduled.push({ kind: "timeout", fn, delay }); return scheduled.length; },
    pianoPatch: () => ({}), pocketLive: () => false, pianoWarmStartRun: () => false,
    loadDojoBests: () => ({}), specialOrbsLive: () => false,
    showToneBlock: reason => assert.fail("Unexpected audio/start failure: " + reason),
  });
  // Listener UUID and actual Tone noise-buffer randomness are excluded equally
  // from compared arms; the actual application IR and combo functions run.
  context.ensureListener = () => {
    if (!context.listener) context.listener = { context: native, getInput: () => ({}) };
  };
  for (const name of ["applyAudioState", "cancelLockRetry", "clearTempleResume",
    "closeTransitEssayReader", "syncTransport", "reconcileTargetSounds",
    "skyChatReset", "pickTheme", "senseiArm", "dealCompute", "applyCloudWind",
    "clearProjectiles", "clearRings", "resetFlock", "resetPocketState", "fillReset",
    "tickVolReset", "bowReset", "voiceReset", "volleyReset", "teardownTransport",
    "applySenseiFull", "showTrainCoach", "ghostSessionStart", "ensureRhythm", "renderPrimary",
    "pianoWarmAfterUnlock", "abortFlickBonus", "clearListen", "pocketUpdateLawHud", "showPause"]) {
    context[name] = noop;
  }
  vm.runInContext(program, context);

  if (mode === "historical") {
    const currentInit = context.initAudio;
    context.initAudio = (...args) => {
      // Former piano boundary: construct the unchanged IR before Tone and reset.
      // The second ensureListener in currentInit is idempotent.
      context.ensureListener();
      if (!context.reverbInput && context.listener && !context.state.running) context.buildReverb();
      else context.scheduleReverbBuild();
      return currentInit(...args);
    };
  }
  for (const name of functions) {
    const actual = context[name];
    context[name] = (...args) => {
      events.push(name);
      if (name === "makeWasdCombo") counts.atCombo = counts.random;
      const before = counts.random;
      const result = actual(...args);
      if (name === "makeIR") counts.irDraws += counts.random - before;
      return result;
    };
  }

  const run = { context, events, counts, buffers, scheduled, instruments,
    nextValues: () => Array.from({ length: 8 }, math.random),
    flushNext: () => { assert.ok(scheduled.length, "a deferred callback exists"); scheduled.shift().fn(); } };
  if (options.start !== false) {
    context.startRun();
    assert.equal(context.audioInit, true, "actual initAudio completes fresh graph initialization");
    assert.equal(context.toneReady, true);
    assert.equal(context.state.running, true, "actual start/reset chain enters running");
    run.opening = { combo: Array.from(context._combo), wind: [context.windX, context.windZ] };
    run.drawsAfterStart = counts.random;
    run.next = run.nextValues();
  }
  return run;
}

function assertPianoWithoutReverb(run) {
  assert.equal(run.events.includes("buildReverb"), false, "piano never calls the builder");
  assert.equal(run.events.includes("scheduleReverbBuild"), false, "piano never calls the scheduler");
  assert.equal(run.events.includes("makeIR"), false);
  assert.equal(run.buffers.length, 0);
  assert.equal(run.counts.convolvers, 0);
  assert.equal(run.counts.gains, 0);
  assert.equal(run.counts.irDraws, 0);
  assert.equal(run.context.reverbInput, null);
  assert.equal(run.context.reverbQueued, false);
  assert.equal(run.scheduled.length, 0);
}

// Six historical rate/wind comparisons retain the diagnosis of the changed stream.
for (const sampleRate of [44100, 48000, 96000]) {
  for (const wind of [false, true]) {
    test("piano accepts changed opening after historical IR removal at " + sampleRate + " Hz, wind " + wind, () => {
      const historical = pianoReverbRngHarness(sampleRate, "historical", wind);
      const piano = pianoReverbRngHarness(sampleRate, "piano", wind);
      const legacy = pianoReverbRngHarness(sampleRate, "legacy", wind);
      const irDraws = 2 * Math.floor(sampleRate * 2.2);
      assert.deepEqual(historical.events.filter(name => functions.includes(name)),
        ["startRun", "initAudio", "buildReverb", "makeIR", "enterRunning", "resetSession", "makeWasdCombo"]);
      assert.equal(historical.counts.irDraws, irDraws);
      assert.equal(historical.counts.atCombo, irDraws + (wind ? 2 : 0));
      assert.equal(historical.drawsAfterStart, irDraws + (wind ? 2 : 0) + 6);

      assertPianoWithoutReverb(piano);
      assert.equal(piano.drawsAfterStart, (wind ? 2 : 0) + 6, "no IR or replacement draw loop");
      assert.notDeepEqual(piano.opening.combo, historical.opening.combo);
      assert.notDeepEqual(piano.next, historical.next);
      if (wind) assert.notDeepEqual(piano.opening.wind, historical.opening.wind);
      assert.equal(piano.opening.combo.length, piano.context.CFG.wasdComboLen);
      for (let i = 0; i < piano.opening.combo.length; i += 4) {
        assert.deepEqual(piano.opening.combo.slice(i, i + 4).sort(), [0, 1, 2, 3],
          "actual makeWasdCombo still returns balanced valid four-key blocks");
      }

      assert.equal(legacy.counts.irDraws, irDraws);
      assert.equal(legacy.counts.convolvers, 1);
      assert.equal(legacy.counts.gains, 2);
      assert.deepEqual(legacy.buffers, [{ channels: 2, length: irDraws / 2, rate: sampleRate }]);
      assert.deepEqual(legacy.opening, historical.opening, "legacy retains the old IR-dependent picks");
      assert.deepEqual(legacy.next, historical.next, "legacy retains the isolated old output stream");
      assert.ok(legacy.events.indexOf("makeIR") < legacy.events.indexOf("Tone.start"));
      assert.ok(legacy.events.indexOf("Tone.NoiseSynth") < legacy.events.indexOf("makeWasdCombo"));
      const noise = legacy.instruments.filter(node => node.type === "NoiseSynth");
      assert.deepEqual(noise.map(node => node.args[0]), [
        { noise: { type: "white" }, envelope: { attack: .001, decay: .05, sustain: 0 } },
        { noise: { type: "brown" }, envelope: { attack: .001, decay: .04, sustain: 0, release: .02 } },
      ]);
      assert.deepEqual(noise.map(node => node.randomAtConstruction), [irDraws, irDraws],
        "legacy IR precedes both existing NoiseSynth option/constructor calls");
    });
  }
}

// Seventh historical diagnostic: retries do not repeat the former IR allocation.
test("historical IR and legacy still build once; current piano retries and pause build nothing", () => {
  for (const mode of ["historical", "legacy", "piano"]) {
    const run = pianoReverbRngHarness(48000, mode);
    const before = run.counts.random;
    run.context.exitRunning();
    run.context.initAudio();
    run.context.initAudio();
    assert.equal(run.counts.random, before);
    assert.equal(run.buffers.length, mode === "piano" ? 0 : 1);
    assert.equal(run.counts.convolvers, mode === "piano" ? 0 : 1);
    assert.equal(run.scheduled.length, 0);
    if (mode === "piano") assertPianoWithoutReverb(run);
  }
});

for (const idle of [false, true]) {
  test("piano initialization during running and pause never queues reverb, idle API " + idle, () => {
    const run = pianoReverbRngHarness(48000, "piano", false, { start: false, running: true, idle });
    run.context.initAudio();
    run.context.initAudio();
    run.context.exitRunning();
    run.context.initAudio();
    assert.equal(run.context.audioInit, true);
    assert.equal(run.counts.random, 0, "even pre-combo initialization spends no IR draws");
    assertPianoWithoutReverb(run);
  });

  test("legacy paused exit schedules the original IR with " + (idle ? "requestIdleCallback" : "setTimeout"), () => {
    const run = pianoReverbRngHarness(48000, "legacy", false, { start: false, running: true, idle });
    run.context.ensureListener();
    run.context.exitRunning();
    assert.equal(run.buffers.length, 0, "exit schedules work rather than building synchronously");
    assert.equal(run.context.reverbQueued, true);
    assert.equal(run.scheduled.length, 1);
    assert.equal(run.scheduled[0].kind, idle ? "idle" : "timeout");
    assert.equal(run.scheduled[0].delay, 120);
    run.flushNext();
    assert.equal(run.counts.irDraws, 211200);
    assert.equal(run.counts.convolvers, 1);
    assert.equal(run.buffers.length, 1);
    assert.equal(run.context.reverbQueued, false);
    run.context.initAudio();
    assert.equal(run.buffers.length, 1, "later legacy init reuses the scheduled graph");
  });
}

test("legacy initialization during running defers IR until the run stops", () => {
  const run = pianoReverbRngHarness(48000, "legacy", false, { start: false, running: true });
  run.context.initAudio();
  assert.equal(run.events.includes("scheduleReverbBuild"), true);
  assert.equal(run.buffers.length, 0);
  assert.equal(run.scheduled[0].delay, 1200);
  run.flushNext();
  assert.equal(run.buffers.length, 0, "callback does not construct IR during a live run");
  assert.equal(run.scheduled[0].delay, 900);
  run.context.state.running = false;
  run.flushNext();
  assert.equal(run.buffers.length, 0, "retry schedules the original delayed builder");
  run.flushNext();
  assert.equal(run.counts.irDraws, 211200);
  assert.equal(run.buffers.length, 1);
  assert.equal(run.counts.convolvers, 1);
});
