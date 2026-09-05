"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { ROOT, main, sourceFor } = require("./source.js");
const { baselineSource, extractFunction, checkOffGraph, checkPadGraph } = require("./chip-graph.js");

test("chip pad replaces only the polyphonic triangle with one pulse in the voice graph", () => {
  checkPadGraph(main, checkOffGraph(main, ROOT));
});

test("all ten pad sites retain baseline guards, notes, timing and velocity through padChord", () => {
  const baseline = baselineSource(ROOT);
  const names = ["doorCross", "themeBreath", "volleyNote", "bowEnterHold", "onGrid"];
  let count = 0;
  for (const name of names) {
    const original = extractFunction(baseline, name);
    const current = extractFunction(sourceFor(name), name);
    const calls = original.split("pad.triggerAttackRelease(").length - 1;
    count += calls;
    assert.equal(current.split("padChord(").length - 1, calls, name);
    assert.equal(current.includes("pad.triggerAttackRelease("), false, name);
    // A3's independently tested octave wrapper is the only prior change in these functions.
    const withoutBassWrapper = current.replace(/bassNote\(([^()]*)\)/g, "$1").replace(/\n  if\(CHIP_FIELD\) try\{ humFieldGrid\(time,ci,tier,i\); \}catch\(e\)\{\}/, "");
    assert.equal(withoutBassWrapper, original.replaceAll("pad.triggerAttackRelease(", "padChord("), name);
  }
  assert.equal(count, 10);
});

test("chip pad cleanup follows silent boundaries and remains inert when disabled", () => {
  const baseline = baselineSource(ROOT);
  function audioState(source, chip, running, temple, sound) {
    const calls = [];
    const ctx = vm.createContext({
      CHIP_PAD: chip, CHIP_FIELD: false, state: { running }, templeActive: temple, soundOn: sound,
      listener: { setMasterVolume: value => calls.push(["master", value]) },
      drumBus: {}, Tone: { Destination: {} }, window: { Tone: true },
      padChipStop: () => calls.push(["padStop"]),
    });
    vm.runInContext(extractFunction(source, "applyAudioState"), ctx);
    ctx.applyAudioState();
    return { calls, bus: ctx.drumBus.mute, destination: ctx.Tone.Destination.mute };
  }
  for (const running of [false, true]) for (const temple of [false, true]) for (const sound of [false, true]) {
    const reference = audioState(baseline, false, running, temple, sound);
    assert.deepEqual(audioState(main, false, running, temple, sound), reference);
    const actual = audioState(main, true, running, temple, sound);
    assert.equal(actual.calls.filter(c => c[0] === "padStop").length, Number(!(running && !temple && sound)));
    actual.calls = actual.calls.filter(c => c[0] !== "padStop");
    assert.deepEqual(actual, reference);
  }
  const teardown = extractFunction(sourceFor("teardownTransport"), "teardownTransport");
  assert.equal(teardown.replace(/\n  if\(CHIP_PAD\) padChipStop\(\);[^\n]*/, "").replace(/\n  if\(CHIP_FIELD\) try\{ humFieldStop\(\); \}catch\(e\)\{\}/, ""), extractFunction(baseline, "teardownTransport"));
});
