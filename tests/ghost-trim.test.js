"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");
const { main } = require("./source.js");
const { extractFunction } = require("./chip-graph.js");

const families = ["bpmCurve", "targets", "taps", "fires"];
const trimSource = extractFunction(main, "ghostRecordTrim").replace(/\r\n/g, "\n");
const hash = value => createHash("sha256").update(value).digest("hex");

// Independent deliberately slow oracle: serialize the actual shrinking wrapper after each
// head removal. No byte arithmetic, global sort, cursor, or production trim call is used.
function legacyTrimOracle(record, mail, limit) {
  const wrapper = { ghost: record, mail: Array.isArray(mail) ? mail : [] };
  let serialized = JSON.stringify(wrapper);
  while (serialized.length > limit) {
    let selected = null;
    for (const name of families) {
      const row = record[name][0];
      if (row && row[0] < (selected ? record[selected][0][0] : Infinity)) selected = name;
    }
    if (selected === null) break;
    record[selected].shift();
    serialized = JSON.stringify(wrapper);
  }
  return serialized;
}

function trimHarness(record, fast, limit) {
  const counts = { full: 0, row: 0, other: 0 };
  const rows = new Set(families.flatMap(name => record[name]));
  const json = { stringify(value, ...rest) {
    if (value === record || value && value.ghost === record) counts.full++;
    else if (rows.has(value)) counts.row++;
    else counts.other++;
    return JSON.stringify(value, ...rest);
  } };
  const c = vm.createContext({ JSON: json, GH_FAST_TRIM: fast, GH_MAX_BYTES: limit });
  vm.runInContext(trimSource, c);
  return { run: mail => c.ghostRecordTrim(record, mail), counts };
}

function compareTrim(input, mail, limit, fast = true) {
  const expectedRecord = structuredClone(input);
  const expected = legacyTrimOracle(expectedRecord, structuredClone(mail), limit);
  const record = structuredClone(input), actualMail = structuredClone(mail);
  const refs = Object.fromEntries(families.map(name => [name, record[name]]));
  const rowRefs = Object.fromEntries(families.map(name => [name, record[name].slice()]));
  const splices = Object.fromEntries(families.map(name => [name, 0]));
  if (fast) for (const name of families) {
    Object.defineProperty(refs[name], "shift", { value() { assert.fail("fast trim must not shift each removed row"); } });
    Object.defineProperty(refs[name], "splice", { value(...args) {
      splices[name]++; return Array.prototype.splice.apply(this, args);
    } });
  }
  const h = trimHarness(record, fast, limit), json = h.run(actualMail);
  assert.equal(json, expected, "complete serialized wrapper matches the independent oracle");
  assert.equal(json, JSON.stringify({ ghost: record, mail: Array.isArray(actualMail) ? actualMail : [] }));
  assert.deepEqual(Object.keys(record), Object.keys(input), "record property order is preserved");
  assert.deepEqual(actualMail, mail, "trim never alters mail");
  let dropped = 0;
  for (const name of families) {
    assert.equal(record[name], refs[name], `${name} array identity survives trimming`);
    const cut = input[name].length - record[name].length; dropped += cut;
    assert.equal(cut, input[name].length - expectedRecord[name].length, name);
    record[name].forEach((row, index) => assert.equal(row, rowRefs[name][cut + index], `${name} retains original row objects in suffix order`));
    if (fast) assert.ok(splices[name] <= 1, `${name} is compacted at most once`);
  }
  if (fast) assert.ok(h.counts.full <= 2, "fast trim serializes the full wrapper/record at most twice");
  else assert.equal(h.counts.full, dropped + 1, "the off path retains its original one-serialization-per-drop behavior");
  if (JSON.stringify({ ghost: input, mail: Array.isArray(mail) ? mail : [] }).length <= limit) {
    assert.equal(dropped, 0); assert.equal(h.counts.full, 1, "under-limit input returns after its first serialization");
  }
  return { json, record, counts: h.counts, dropped };
}

// Portable deterministic reproduction of the two synthetic P0 cases. These quantizers and
// property/row order are frozen from 912961a; locked input hashes catch generator drift.
function p0CappedFixture(tied = false) {
  const duration = 7200, caps = { bpmCurve: 200, targets: 1200, taps: 2400, fires: 1200 };
  const quantize = value => Math.round(Math.max(0, +value || 0) * 1000) / 1000;
  const at = (index, count) => quantize(tied ? Math.floor(index / 2) * duration / (count + 1) : (index + 1) * (duration - 5) / (count + 1));
  const yaw = value => {
    const wrapped = ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return Math.max(-Math.PI, Math.min(Math.PI, Math.round(wrapped * 10000) / 10000));
  };
  const pitch = value => Math.max(-88 * Math.PI / 180, Math.min(88 * Math.PI / 180, Math.round(value * 10000) / 10000));
  const ghost = { v: 1, date: "2026-09-05", moonBucket: 4, bpm0: 28, dur: duration, bpmCurve: [], targets: [], taps: [], fires: [] };
  for (let i = 0; i < caps.bpmCurve; i++) ghost.bpmCurve.push([at(i, caps.bpmCurve), 28 + (i % 13) * 2.5]);
  for (let i = 0; i < caps.targets; i++) {
    const t = at(i, caps.targets), hit = i % 5 !== 0;
    ghost.targets.push([t, i % 4, 10000 + i, quantize(t + 3), hit ? 1 : 0, hit ? quantize(t + 2.125) : null]);
  }
  for (let i = 0; i < caps.taps; i++) ghost.taps.push([at(i, caps.taps), i % 4, [-1, 56, 78, 100][i % 4]]);
  for (let i = 0; i < caps.fires; i++) ghost.fires.push([at(i, caps.fires), yaw(Math.sin(i * .173) * Math.PI), pitch(Math.cos(i * .239) * .91), i % 5 ? 1 : 0]);
  const mail = tied ? Array.from({ length: 64 }, (_, i) => [quantize((i + 1) * duration / 65), i % 4]) : [];
  return { ghost, mail };
}

test("fast trim is enabled by default and its off body remains byte-identical to the P0 function", () => {
  assert.match(main, /\bghostTrimFast:1\b/);
  assert.match(main, /const GH_FAST_TRIM=CFG\.ghostTrimFast!==0;/);
  const branch = extractFunction(trimSource.replace("if(GH_FAST_TRIM)", "function fastTrimBranch()"), "fastTrimBranch")
    .replace("function fastTrimBranch()", "if(GH_FAST_TRIM)");
  assert.ok(trimSource.includes(`  ${branch}\n`), "the fast path is a separate removable branch");
  const off = trimSource.replace(`  ${branch}\n`, "");
  assert.equal(hash(off), "28709cb95d1e961b65873f024b8ed6901dcecc1204f95eb87cc9d678f0d92c0c");
  assert.match(main, /GH_CAP_BPM=200, GH_CAP_TARGETS=1200, GH_CAP_TAPS=2400, GH_CAP_FIRES=1200, GH_CAP_MAIL=64, GH_MAX_BYTES=100000;/);
});

test("trim matches every cut boundary, including a family's final row and empty-array punctuation", () => {
  const record = { v: 1, bpmCurve: [[0, 28], [0, 30]], targets: [[0, 1, 22, 3, 0, null]], taps: [[0, 2, 100], [1, 0, -1]], fires: [[0, -.125, .5, 1]] };
  const mail = [[1, 2]], cursor = structuredClone(record), budgets = new Set([0, 1]);
  let json = JSON.stringify({ ghost: cursor, mail });
  while (true) {
    for (const offset of [-1, 0, 1]) budgets.add(json.length + offset);
    const next = legacyTrimOracle(cursor, mail, json.length - 1);
    if (next === json) break;
    json = next;
  }
  for (const budget of budgets) for (const fast of [false, true]) compareTrim(record, mail, budget, fast);
});

test("equal timestamps retain family priority followed by original row order", () => {
  const record = { bpmCurve: [[0, "b0"], [0, "b1"]], targets: [[0, "target"]], taps: [[0, "tap"]], fires: [[0, "fire"]] };
  const initial = JSON.stringify({ ghost: record, mail: [] });
  const one = compareTrim(record, [], initial.length - 1);
  assert.deepEqual(one.record.bpmCurve, [[0, "b1"]]);
  assert.deepEqual(one.record.targets, record.targets);
  const two = compareTrim(record, [], one.json.length - 1);
  assert.equal(two.record.bpmCurve.length, 0); assert.equal(two.record.targets.length, 1);
  const three = compareTrim(record, [], two.json.length - 1);
  assert.equal(three.record.targets.length, 0); assert.equal(three.record.taps.length, 1);
});

test("unsorted families keep head-only selection instead of globally sorting their timestamps", () => {
  const record = { bpmCurve: [[9, "later head"], [0, "earlier tail"]], targets: [[4, "first"]], taps: [[6, "second"]], fires: [] };
  const limit = JSON.stringify({ ghost: record, mail: [] }).length - 1;
  for (const fast of [false, true]) {
    const result = compareTrim(record, [], limit, fast);
    assert.deepEqual(result.record.bpmCurve, record.bpmCurve, "the earlier tail cannot overtake its own head");
    assert.equal(result.record.targets.length, 0); assert.equal(result.record.taps.length, 1);
  }
});

test("Unicode, escapes, null-like row values and record property order use JSON code units", () => {
  const record = { label: "星🌙\ud800\"\\\n", taps: [[0, "夜🌌\udfff", undefined, NaN, Infinity, -0]], date: "2026-09-05",
    fires: [[1, "echo"]], bpmCurve: [[2, 28]], targets: [], metadata: { z: "最後", a: "first" } };
  const mail = [[1, "郵便🌙"]], initial = JSON.stringify({ ghost: record, mail });
  assert.ok(Buffer.byteLength(initial, "utf8") > initial.length);
  for (const fast of [false, true]) {
    assert.equal(compareTrim(record, mail, initial.length, fast).json, initial, "exact code-unit budget is already small enough");
    compareTrim(record, mail, initial.length - 1, fast);
    compareTrim(record, mail, 0, fast);
  }
});

test("mail is never removed and non-array mail normalizes to the existing empty array", () => {
  const record = { bpmCurve: [[0, 28]], targets: [], taps: [], fires: [] };
  for (const mail of [undefined, null, "ignored", { untouched: true }, [[1, "x".repeat(1024)]]]) {
    for (const fast of [false, true]) {
      const result = compareTrim(record, mail, 1, fast);
      assert.equal(result.record.bpmCurve.length, 0);
      assert.ok(result.json.length > 1, "unremovable wrapper/mail may still exceed an impossible budget");
    }
  }
});

test("non-selectable head timestamps retain the original stopping behavior even after other rows are cut", () => {
  for (const record of [
    { bpmCurve: [[Infinity, 28]], targets: [[NaN, "held"]], taps: [], fires: [] },
    { bpmCurve: [[Infinity, 28], [0, 30]], targets: [[0, "remove"]], taps: [[2, "remove"]], fires: [] },
  ]) for (const fast of [false, true]) compareTrim(record, [], 1, fast);
});

for (const [tied, inputHash, outputHash, units, lengths] of [
  [false, "cea53379da35f1d402da9864ce11a7074361e0dbc5020fc3ea2550920a369731", "2c6ef1777a34a7dfa2bb32db0c75634a73f992980248f41abd596ff0315ea365", 99966, [166, 994, 1989, 995]],
  [true, "38f35d30199bc2585ccf5c8f4f05359e46938210d5a9829db2b914632b3a9786", "87e34a503e4244a5b787dd541c047c7fde2a23aa9b37edd8b807c073a8cd935e", 99975, [164, 991, 1984, 992]],
]) test(`fast trim reproduces locked P0 capped output${tied ? " with mail and ties" : ""} using at most two full serializations`, () => {
  const wrapper = p0CappedFixture(tied);
  assert.equal(hash(JSON.stringify(wrapper)), inputHash, "portable synthetic input matches the captured P0 bytes");
  const record = wrapper.ghost, refs = families.map(name => record[name]), original = families.map(name => record[name].slice());
  const mail = JSON.stringify(wrapper.mail), h = trimHarness(record, true, 100000), json = h.run(wrapper.mail);
  assert.equal(hash(json), outputHash, "the complete JSON matches the locked P0 output hash");
  assert.equal(json.length, units); assert.equal(h.counts.full, 2);
  assert.equal(JSON.stringify(wrapper.mail), mail);
  families.forEach((name, index) => {
    assert.equal(record[name], refs[index]); assert.equal(record[name].length, lengths[index]);
    const start = original[index].length - lengths[index];
    record[name].forEach((row, rowIndex) => assert.equal(row, original[index][start + rowIndex]));
  });
});
