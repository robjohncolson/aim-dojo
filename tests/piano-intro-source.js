"use strict";
const assert = require("node:assert/strict");

const legacyTicks = [
  "      if(tick && andStep) tick.triggerAttackRelease(i===1?1760:1480,'32n',time, trainPhase===0?0.95:0.7);",
  "      if(tick && i===0) tick.triggerAttackRelease(2093,'32n',time, 0.55);   // soft downbeat (shot pocket) — quieter in phase 0 so the letter pocket owns attention"
].join("\n");
const pianoTicks = [
  "      if(PIANO){",
  "        if(tick && i%2===0) tick.triggerAttackRelease(i===0?2093:1568,'32n',time,0.55);   // count the main beats; the learner alone plays the lower answer between them",
  "      }else{",
  legacyTicks,
  "      }"
].join("\n");

function pianoIntroOff(source) {
  assert.equal(source.split(pianoTicks).length, 2, "exactly one isolated piano lesson tick branch exists");
  return source.replace(pianoTicks, legacyTicks);
}

module.exports = { pianoIntroOff };
