"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { sourceText: html } = require("./source.js");

const DEAD = [
  "avgReaction", "classifyPocket", "showTempleSignArt", "placeTempleSignArt", "starLitLevel",
  "showListenGhost", "eighthSec", "timingErrorMs", "setClassName", "liveCount",
  "decoyChance", "decoyDistMul", "lifeBeatsEff", "orbRed",
];

function assertSweep(source) {
  for (const name of DEAD) assert.equal(source.includes(name), false, `${name} stays retired from source and comments`);
}

function assertSurvivors(source) {
  assert.equal((source.match(/\bpushReaction\s*\(/g) || []).length, 3, "definition plus its two scoring call sites remain");
  assert.equal((source.match(/\bhideListenGhost\s*\(/g) || []).length, 2, "the one live hide call plus definition remain");
  assert.equal((source.match(/tg\.kind===2/g) || []).length, 4, "all defensive decoy behavior remains even though no roll elects one");
  assert.match(source, /specialOrbs:true, goldScore:2, multiHit:true, multiHitChance:0\.22/);
  assert.match(source, /goldDistMul:1\.35, goldSizeMul:0\.7/);
}

test("Wave 22 removes only the verified dead helpers and write-only fields", () => {
  assertSweep(html);
  for (const name of DEAD) assert.throws(() => assertSweep(`${html}\n${name}`), assert.AssertionError, `the oracle kills a reintroduced ${name}`);
});

test("the neighboring live helpers and defensive decoy branches remain intact", () => {
  assertSurvivors(html);
  const mutants = [
    html.replace("function pushReaction", "function retiredReaction"),
    html.replace("function hideListenGhost", "function retiredHideListenGhost"),
    html.replace("tg.kind===2", "tg.kind===3"),
  ];
  for (const mutant of mutants) assert.throws(() => assertSurvivors(mutant), assert.AssertionError, "the survivor oracle kills an adjacent deletion");
});
