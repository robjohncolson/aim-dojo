"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { ROOT, sourceFor } = require("./source.js");
const { baselineSource, chipDefaults, extractFunction } = require("./chip-graph.js");

function humFunctions(source) {
  return ["pulseCoefficients", "pulseWave"].filter(name => source.includes("function " + name + "(")).map(name => extractFunction(source, name)).join("\n");
}
function mathContext(chip = {}) {
  const source = sourceFor("pulseCoefficients");
  const ctx = vm.createContext({ CFG: { chip: { ...chipDefaults, ...chip } }, Math, Number, Float32Array });
  vm.runInContext(humFunctions(source), ctx);
  return ctx;
}
function near(a, b, tolerance = 1e-7) {
  assert.ok(Math.abs(a - b) <= tolerance, a + " differs from " + b);
}

test("chip hum Fourier coefficients remove DC and preserve first-eighth pulse phase", () => {
  const { pulseCoefficients } = mathContext();
  const { real, imag } = pulseCoefficients(0.125, 32);
  assert.equal(real.length, 33);
  assert.equal(imag.length, 33);
  assert.equal(real[0], 0);
  assert.equal(imag[0], 0);
  for (let n = 1; n <= 32; n++) {
    near(real[n], 2 * Math.sin(2 * Math.PI * n * 0.125) / (Math.PI * n));
    near(imag[n], 2 * (1 - Math.cos(2 * Math.PI * n * 0.125)) / (Math.PI * n));
    if (n % 8 === 0) {
      near(real[n], 0, 1e-14);
      near(imag[n], 0, 1e-14);
    }
  }
  near(real[1], Math.SQRT2 / Math.PI);
  near(imag[1], (2 - Math.SQRT2) / Math.PI);
});

test("chip hum coefficients match independently sampled bipolar pulses", () => {
  const { pulseCoefficients } = mathContext();
  for (const duty of [0.125, 0.25, 0.5]) {
    const { real, imag } = pulseCoefficients(duty, 32);
    const samples = 32768;
    for (let n = 1; n <= 32; n++) {
      let a = 0, b = 0;
      for (let i = 0; i < samples; i++) {
        const t = (i + 0.5) / samples, y = t < duty ? 1 : -1;
        a += y * Math.cos(2 * Math.PI * n * t);
        b += y * Math.sin(2 * Math.PI * n * t);
      }
      near(real[n], 2 * a / samples, 2e-7);
      near(imag[n], 2 * b / samples, 2e-7);
    }
    const at = t => Array.from(real).reduce((y, a, n) => y + a * Math.cos(2 * Math.PI * n * t) + imag[n] * Math.sin(2 * Math.PI * n * t), 0);
    assert.ok(at(duty / 2) > 0.8 * (2 - 2 * duty), "HIGH stays in the first duty interval");
    assert.ok(at((duty + 1) / 2) < -0.8 * 2 * duty, "LOW occupies the rest of the period");
  }
});

test("chip hum wave is normalized and cached once per native context", () => {
  const { pulseWave } = mathContext();
  const calls = [];
  const nativeContext = () => ({
    createPeriodicWave(real, imag, options) {
      calls.push({ real, imag, options });
      return { context: this, call: calls.length };
    },
  });
  const first = nativeContext(), second = nativeContext();
  const wave = pulseWave(first);
  assert.equal(pulseWave(first), wave);
  assert.equal(calls.length, 1);
  assert.notEqual(pulseWave(second), wave);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.real.length, 33);
    assert.equal(call.imag.length, 33);
    assert.equal(call.options.disableNormalization, false);
    assert.equal(call.real[0], 0);
    assert.equal(call.imag[0], 0);
  }
});

function captureHums(source, chipOn, kinds = [0, 1, 2, 3, 4]) {
  const events = [], nodes = [], waves = [], sounds = [];
  const math = Object.create(Math);
  math.random = () => 0.25;
  function param(id, initial) {
    let current = initial;
    return {
      id,
      get value() { return current; },
      set value(value) { current = value; events.push({ op: "value", id, value }); },
      setValueAtTime(value, at) { events.push({ op: "setValueAtTime", id, value, at }); },
      exponentialRampToValueAtTime(value, at) { events.push({ op: "exponentialRampToValueAtTime", id, value, at }); },
    };
  }
  function node(name) {
    const id = "n" + nodes.length;
    let type = name === "Oscillator" ? "sine" : "lowpass";
    const instance = {
      id, name,
      get type() { return type; },
      set type(value) { type = value; events.push({ op: "type", id, value }); },
      connect(other) {
        assert.ok(other && other.id, "native connection has a recorded destination");
        events.push({ op: "connect", from: id, to: other.id });
        return other;
      },
      start(...args) { events.push({ op: "start", id, args }); },
      setPeriodicWave(wave) {
        assert.ok(waves.includes(wave), "native oscillator receives this context's PeriodicWave");
        type = "custom";
        this.wave = wave;
        events.push({ op: "setPeriodicWave", id, wave: wave.id });
      },
    };
    if (name === "Gain") instance.gain = param(id + ".gain", 1);
    if (name === "Oscillator" || name === "BiquadFilter") instance.frequency = param(id + ".frequency", 440);
    nodes.push(instance);
    events.push({ op: "construct", id, name });
    return instance;
  }
  const nativeContext = {
    currentTime: 100,
    createOscillator: () => node("Oscillator"),
    createGain: () => node("Gain"),
    createBiquadFilter: () => node("BiquadFilter"),
    createPeriodicWave(real, imag, options) {
      const wave = { id: "wave" + waves.length, real, imag, options };
      waves.push(wave);
      events.push({ op: "createPeriodicWave", id: wave.id });
      return wave;
    },
  };
  const listener = { context: nativeContext };
  const THREE = {
    PositionalAudio: function (owner) {
      assert.equal(owner, listener);
      const instance = node("PositionalAudio");
      for (const method of ["setRefDistance", "setRolloffFactor", "setDistanceModel", "setMaxDistance"]) {
        instance[method] = value => { events.push({ op: method, id: instance.id, value }); };
      }
      instance.setNodeSource = sourceNode => { events.push({ op: "setNodeSource", id: instance.id, source: sourceNode.id }); };
      return instance;
    },
  };
  const ctx = vm.createContext({
    CFG: { chip: { ...chipDefaults } }, CHIP_HUMS: chipOn, Math: math, Number, Float32Array,
    THREE, listener, soundOn: true, reverbInput: { id: "reverbInput" }, pickPenta: () => 220,
    quietAudioMatrixUpdates: (pa, recursive) => events.push({ op: "quietAudioMatrixUpdates", id: pa.id, recursive }),
  });
  const code = humFunctions(source) + "\n" + extractFunction(source, "makeTargetSound") + "\n" + extractFunction(source, "voiceTargetSound");
  vm.runInContext(code, ctx);
  for (const kind of kinds) {
    const mesh = { add: pa => events.push({ op: "meshAdd", id: pa.id }) };
    const sound = ctx.makeTargetSound(mesh);
    assert.ok(sound, "makeTargetSound completed without swallowing a stub or construction failure");
    ctx.voiceTargetSound(sound, kind);
    if (kind === 1) assert.ok(sound.osc2, "gold twin construction completed");
    if (kind === 4) assert.ok(sound.lfo2 && sound.lfo2Gain, "mover modulation construction completed");
    sounds.push(sound);
  }
  return { events, nodes, waves, sounds, nativeContext };
}

test("chip hum off arm exactly preserves baseline native nodes, parameters and routing", () => {
  const actual = captureHums(sourceFor("makeTargetSound"), false);
  const reference = captureHums(baselineSource(ROOT), false);
  assert.deepEqual(actual.events, reference.events);
  assert.equal(actual.waves.length, 0);
  assert.ok(!Object.keys(actual.nativeContext).some(key => /chip.*wave/i.test(key)), "off does not allocate the new wave cache");
  for (const sound of actual.sounds) {
    assert.equal(sound.osc.type, "sine");
    assert.equal(sound.ampGain.gain.value, 0.55);
    if (sound.osc2) assert.equal(sound.osc2.type, "sine");
  }
});

test("chip hum on changes only base/gold waveform and amplitude, sharing one native wave", () => {
  const actual = captureHums(sourceFor("makeTargetSound"), true);
  const reference = captureHums(baselineSource(ROOT), false);
  assert.equal(actual.waves.length, 1, "every base oscillator and gold twin shares one context-local wave");
  assert.equal(actual.waves[0].options.disableNormalization, false);
  assert.equal(actual.nodes.length, reference.nodes.length, "no extra audio nodes are allocated");
  const oscillatorIds = new Set(reference.sounds.flatMap(sound => [sound.osc.id, ...(sound.osc2 ? [sound.osc2.id] : [])]));
  const amplitudeIds = new Set(reference.sounds.map(sound => sound.ampGain.gain.id));
  const expected = reference.events.filter(event => !(event.op === "type" && oscillatorIds.has(event.id))).map(event =>
    event.op === "value" && amplitudeIds.has(event.id) && event.value === 0.55 ? { ...event, value: 0.32 } : event);
  const retained = actual.events.filter(event => event.op !== "createPeriodicWave" && event.op !== "setPeriodicWave");
  assert.deepEqual(retained, expected, "LFO, filter, dry gain, gate, reverb send, panner, gold and mover setup stay exact");
  const attachments = actual.events.filter(event => event.op === "setPeriodicWave");
  assert.equal(attachments.length, oscillatorIds.size);
  assert.deepEqual(new Set(attachments.map(event => event.id)), oscillatorIds);
  for (const sound of actual.sounds) {
    assert.equal(sound.osc.wave, actual.waves[0]);
    assert.equal(sound.ampGain.gain.value, 0.32);
    if (sound.osc2) assert.equal(sound.osc2.wave, actual.waves[0]);
    assert.equal(sound.lfo.type, "sine", "tremolo never becomes a pulse");
    if (sound.lfo2) assert.equal(sound.lfo2.type, "sine", "mover modulation stays sine");
  }
});

test("chip hum construction has explicit native pulse and unchanged sine off arms", () => {
  const main = sourceFor("makeTargetSound");
  const base = extractFunction(main, "makeTargetSound");
  const kind = extractFunction(main, "voiceTargetSound");
  assert.match(base, /CHIP_HUMS/);
  assert.match(kind, /CHIP_HUMS/);
  assert.match(base, /osc\.setPeriodicWave\(pulseWave\(ctx\)\)/);
  assert.match(kind, /o2\.setPeriodicWave\(pulseWave\(ctx\)\)/);
  assert.match(base, /osc\.type\s*=\s*['"]sine['"]/);
  assert.match(kind, /o2\.type\s*=\s*['"]sine['"]/);
});

