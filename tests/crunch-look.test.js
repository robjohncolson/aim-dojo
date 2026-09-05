"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { sourceFor } = require("./source.js");
const source = sourceFor("detectWeakGPU");
const resolver = source.match(/const LOW =[^;]+;/)[0];
const bounds = source.match(/const DPR_MAX =[^;]+;/)[0];

function resolve(search, pref, cfg, weak) {
  const context = vm.createContext({ location: { search, hash: "" }, _lowPref: pref, CFG: cfg, WEAK: weak });
  return new vm.Script(`${resolver}\nLOW`).runInContext(context);
}

function dpr(low, weak, crunchLook, device = 1, mobile = false) {
  const context = vm.createContext({ LOW: low, WEAK: weak, CFG: { crunchLook }, DEVICE_DPR: device, MOBILE: mobile });
  return Array.from(new vm.Script(`${bounds}\n[DPR_MAX,DPR_MIN]`).runInContext(context));
}

test("crunch look preserves URL and saved preference precedence", () => {
  assert.match(resolver, /CFG\.crunchLook===true/);
  const rows = [
    ["?hi&low", "1", { crunchLook: true, lowRez: true }, true, false],
    ["?low", "0", { crunchLook: false, lowRez: false }, false, true],
    ["", "1", { crunchLook: false, lowRez: false }, false, true],
    ["", "0", { crunchLook: true, lowRez: true }, true, false],
    ["", null, { crunchLook: true, lowRez: false }, false, true],
    ["", null, { crunchLook: false, lowRez: true }, false, true],
    ["", null, { crunchLook: false, lowRez: false }, true, true],
    ["", null, { crunchLook: false, lowRez: false }, false, false],
  ];
  for (const [search, pref, cfg, weak, expected] of rows) assert.equal(resolve(search, pref, cfg, weak), expected);
});

test("disabled crunch resolver reproduces every legacy preference combination", () => {
  for (const search of ["", "?hi", "?low", "?hi&low"])
    for (const pref of [null, "0", "1", "other"])
      for (const weak of [false, true])
        for (const lowRez of [false, true]) {
          const expected = search.includes("hi") ? false : search.includes("low") ? true : pref === "1" ? true : pref === "0" ? false : lowRez || weak;
          assert.equal(resolve(search, pref, { crunchLook: false, lowRez }, weak), expected);
        }
});

test("authored chalk fixes strong-device DPR while weak and disabled ranges remain adaptive", () => {
  assert.deepEqual(dpr(true, false, true), [.5, .5]);
  assert.deepEqual(dpr(true, true, true), [.5, .4]);
  assert.deepEqual(dpr(true, false, false), [.5, .4]);
  assert.deepEqual(dpr(true, true, false), [.5, .4]);
  assert.deepEqual(dpr(true, false, true, .3), [.3, .3]);
  assert.deepEqual(dpr(false, false, true, 2), [1.5, .9]);
  assert.deepEqual(dpr(false, true, true, 2, true), [1.25, .8]);
});

test("hardware probe is shared and remembered visitor capacities are identical on every device", () => {
  assert.match(source, /const WEAK = detectWeakGPU\(\);/);
  assert.doesNotMatch(resolver, /detectWeakGPU\(/);
  for (const [name, count] of [["GH_VISITOR_COUNT", 3], ["GH_VISITOR_FETCH_COUNT", 4]]) {
    const assignment = source.match(new RegExp(`\\b${name}=([^,;]+)`))[1];
    assert.equal(Number(assignment), count);
    assert.doesNotMatch(assignment, /\b(?:LOW|WEAK)\b/);
  }
  assert.doesNotMatch(source, /\bGH_(?:LOW_|HIGH_)?(?:TARGET|BURST)_MAX\b/);
});
