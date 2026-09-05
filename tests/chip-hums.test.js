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

function captureHums(source, chipOn, kinds = [0, 1, 2, 3, 4], chip = {}) {
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
      cancelScheduledValues(at) { events.push({ op: "cancelScheduledValues", id, at }); },
      linearRampToValueAtTime(value, at) { events.push({ op: "linearRampToValueAtTime", id, value, at }); },
      setTargetAtTime(value, at, timeConstant) { events.push({ op: "setTargetAtTime", id, value, at, timeConstant }); },
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
      stop(...args) { events.push({ op: "stop", id, args }); },
      disconnect() { events.push({ op: "disconnect", id }); },
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
    CFG: { chip: { ...chipDefaults, ...chip }, sing: { goldOctDown: true, moverVibCents: 6, speedGlideMs: 80, callBoost: 1.3 } }, CHIP_HUMS: chipOn, Math: math, Number, Float32Array,
    THREE, listener, soundOn: true, reverbInput: { id: "reverbInput" }, pickPenta: () => 220,
    PENTA: [220, 277.18, 329.63, 440], singDegree: k => ({ 2: 3, 4: 2, 6: 0 })[k], singLive: () => true,
    quietAudioMatrixUpdates: (pa, recursive) => events.push({ op: "quietAudioMatrixUpdates", id: pa.id, recursive }),
  });
  const code = humFunctions(source) + "\n" + ["makeTargetSound", "voiceTargetSound", "singTargetSound", "stopTargetSound"].map(name => extractFunction(source, name)).join("\n");
  vm.runInContext(code, ctx);
  for (const kind of kinds) {
    const mesh = { add: pa => events.push({ op: "meshAdd", id: pa.id }) };
    const sound = ctx.makeTargetSound(mesh);
    assert.ok(sound, "makeTargetSound completed without swallowing a stub or construction failure");
    ctx.voiceTargetSound(sound, kind);
    if (kind === 1 && !chipOn) assert.ok(sound.osc2, "off-arm gold twin construction completed");
    if (kind === 4) assert.ok(sound.lfo2 && sound.lfo2Gain, "mover modulation construction completed");
    sounds.push(sound);
  }
  return { events, nodes, waves, sounds, nativeContext, ctx };
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

test("chip ping removes tremolo, sends and gold twin while preserving the gated positional route", () => {
  const actual = captureHums(sourceFor("makeTargetSound"), true);
  assert.equal(actual.waves.length, 1, "every orb ping shares one context-local wave");
  assert.equal(actual.waves[0].options.disableNormalization, false);
  near(actual.waves[0].real[1], 0);
  near(actual.waves[0].imag[1], 4 / Math.PI);
  assert.equal(actual.nodes.length, 34, "five bare six-node voices plus two nodes for each kind pitch-vibrato exception");
  assert.equal(actual.nodes.filter(node => node.name === "Oscillator").length, 7, "five carriers plus SPEED and MOVER pitch modulation only");
  assert.ok(!actual.events.some(event => event.op === "connect" && event.to === "reverbInput"));
  const attachments = actual.events.filter(event => event.op === "setPeriodicWave");
  assert.equal(attachments.length, actual.sounds.length);
  for (const sound of actual.sounds) {
    assert.equal(sound.osc.wave, actual.waves[0]);
    assert.equal(sound.ampGain.gain.value, 0.22);
    assert.equal(sound.lfo, null);
    assert.equal(sound.osc2, null);
    assert.equal(sound.send, null);
    assert.ok(!actual.events.some(event => event.op === "connect" && event.to === sound.ampGain.gain.id), "the chip amplitude has no modulation input");
    for (const [from, to] of [[sound.osc, sound.ampGain], [sound.ampGain, sound.lowpass], [sound.lowpass, sound.gateGain], [sound.gateGain, sound.outGain]]) {
      assert.ok(actual.events.some(event => event.op === "connect" && event.from === from.id && event.to === to.id));
    }
    assert.ok(actual.events.some(event => event.op === "setNodeSource" && event.id === sound.pa.id && event.source === sound.outGain.id));
  }
  for (const index of [0, 1, 2]) assert.equal(actual.sounds[index].lfo2, null, "ordinary/gold/decoy ping has no LFO of either kind");
  near(actual.sounds[3].lfo2.frequency.value, 4.875);
  near(actual.sounds[3].lfo2Gain.gain.value, 220 * 0.008);
  near(actual.sounds[4].lfo2.frequency.value, 0.7);
  near(actual.sounds[4].lfo2Gain.gain.value, 110 * 0.008);
  for (const index of [3, 4]) assert.ok(actual.events.some(event => event.op === "connect" && event.from === actual.sounds[index].lfo2Gain.id && event.to === actual.sounds[index].osc.frequency.id));
});

test("chip hum construction has explicit native pulse and unchanged sine off arms", () => {
  const main = sourceFor("makeTargetSound");
  const base = extractFunction(main, "makeTargetSound");
  const kind = extractFunction(main, "voiceTargetSound");
  assert.match(base, /CHIP_HUMS/);
  assert.match(kind, /CHIP_HUMS/);
  assert.match(base, /osc\.setPeriodicWave\(pulseWave\(ctx\)\)/);
  assert.doesNotMatch(kind, /o2\.setPeriodicWave/);
  assert.match(base, /osc\.type\s*=\s*['"]sine['"]/);
  assert.match(kind, /o2\.type\s*=\s*['"]sine['"]/);
});

test("chip ping register transposes initial picks and every sung kind without collapsing pitch intervals", () => {
  const source = sourceFor("makeTargetSound"), kinds = [0, 1, 2, 3, 4];
  for (const humOctave of [-2, -1, 0]) {
    const actual = captureHums(source, true, kinds, { humOctave });
    const reference = captureHums(baselineSource(ROOT), false, kinds);
    const factor = 2 ** humOctave;
    for (let index = 0; index < kinds.length; index++) {
      const sound = actual.sounds[index], oldSound = reference.sounds[index], kind = kinds[index];
      near(sound.osc.frequency.value, oldSound.osc.frequency.value * factor);
      for (const k of [2, 4, 6, 2]) {
        const start = actual.events.length;
        actual.ctx.singTargetSound(sound, kind, k, true);
        const expected = actual.ctx.PENTA[actual.ctx.singDegree(k)] * factor * (kind === 1 ? 0.5 : 1);
        if (kind === 3) {
          assert.ok(actual.events.slice(start).some(event => event.op === "linearRampToValueAtTime" && event.id === sound.osc.frequency.id && Math.abs(event.value - expected) < 1e-9), "SPEED glide ends in the transposed degree");
          assert.ok(actual.events.slice(start).some(event => event.op === "setValueAtTime" && event.id === sound.osc.frequency.id && Math.abs(event.value - expected * 0.94387) < 1e-9), "SPEED pickup preserves its semitone ratio");
        } else near(sound.osc.frequency.value, expected);
        if (sound.lfo2Gain) near(sound.lfo2Gain.gain.value, expected * (2 ** (6 / 1200) - 1));
      }
    }
  }
});

test("chip ping stop handles absent tremolo and still stops kind pitch vibrato", () => {
  for (const chipOn of [false, true]) {
    const actual = captureHums(sourceFor("makeTargetSound"), chipOn);
    for (const sound of actual.sounds) {
      const before = actual.events.length;
      actual.ctx.stopTargetSound(sound);
      const stopped = actual.events.slice(before).filter(event => event.op === "stop").map(event => event.id);
      const expected = [sound.osc, sound.lfo, sound.osc2, sound.lfo2].filter(Boolean).map(node => node.id);
      assert.deepEqual(stopped, expected, "cleanup reaches every constructed oscillator despite absent optional nodes");
      assert.equal(sound.stopped, true);
      if (sound.send) assert.ok(actual.events.slice(before).some(event => event.op === "disconnect" && event.id === sound.send.id));
      const after = actual.events.length;
      actual.ctx.stopTargetSound(sound);
      assert.equal(actual.events.length, after, "stopping twice does not reschedule disposed oscillators");
    }
  }
});

test("chip hum auditions clamp boot-only duty, discrete octave and gain without enabling hums", () => {
  const source = sourceFor("resolveHum"), ctx = vm.createContext({});
  vm.runInContext(extractFunction(source, "resolveHum"), ctx);
  const resolve = search => { const cfg = { ...chipDefaults }; ctx.resolveHum(search, cfg); return cfg; };
  assert.deepEqual(resolve(""), chipDefaults);
  const custom = resolve("?chip=lead,dry,bass,hums&humDuty=0.25&humOct=-2&humGain=0.4");
  assert.equal(custom.humDuty, 0.25);
  assert.equal(custom.humOctave, -2);
  assert.equal(custom.humGain, 0.4);
  assert.equal(custom.hums, false, "audition values never turn a voice on");
  const high = resolve("?humDuty=99&humOct=99&humGain=99");
  assert.equal(high.humDuty, 0.5); assert.equal(high.humOctave, 0); assert.equal(high.humGain, 0.6);
  const low = resolve("#humDuty=-99&humOct=-99&humGain=-99");
  assert.equal(low.humDuty, 0.05); assert.equal(low.humOctave, -2); assert.equal(low.humGain, 0.05);
  assert.equal(resolve("?humOct=-1.2").humOctave, -1);
  assert.equal(resolve("?humOct=-1.8").humOctave, -2);
  assert.equal(resolve("?humOct=%2D2").humOctave, -2);
  for (const invalid of ["", "oops", "Infinity", "NaN", "%broken"]) {
    assert.deepEqual(resolve("?humDuty=" + invalid + "&humOct=" + invalid + "&humGain=" + invalid), chipDefaults);
  }
  assert.match(source, /resolveHum\(location\.search\+location\.hash,CFG\.chip\)/);
});

test("accepted lead dry bass defaults keep the square ping an explicit audition", () => {
  const source = sourceFor("resolveHum"), literal = source.match(/\bchip:(\{[^\n]+?\})/);
  assert.ok(literal);
  const actual = vm.runInNewContext("(" + literal[1] + ")");
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), chipDefaults);
  assert.equal(actual.lead && actual.dry && actual.bass, true);
  assert.equal(actual.hums, false);
  assert.equal(actual.pad, false);
  assert.equal(actual.humDuty, 0.5);
  assert.equal(actual.humOctave, -1);
  assert.equal(actual.humGain, 0.22);
});
