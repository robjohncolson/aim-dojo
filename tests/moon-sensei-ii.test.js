"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function closingDelimiter(source, openAt, open = "{", close = "}") {
  let depth = 0, quote = "", lineComment = false, blockComment = false;
  for (let index = openAt; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index += 1; } continue; }
    if (quote) { if (char === "\\") index += 1; else if (char === quote) quote = ""; continue; }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === open) depth += 1;
    if (char === close && --depth === 0) return index;
  }
  throw new Error(`unclosed ${open} at ${openAt}`);
}

function extractFunction(source, name) {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} is present as a testable named function`);
  const openAt = source.indexOf("{", match.index + match[0].length);
  return source.slice(match.index, closingDelimiter(source, openAt) + 1);
}

function extractLine(re, what) {
  const match = html.match(re); assert.ok(match, `${what} is present`); return match[0];
}

const SENSEI_SOURCE = [
  extractLine(/const SENSEI2_KEY=[^\n]+/, "Sensei II constants"),
  extractLine(/const SENSEI2_EN=[^\n]+/, "Sensei II English lines"),
  extractLine(/let _sensei2Seen=null;/, "Sensei II page memory"),
  extractFunction(html, "sensei2Empty"),
  extractFunction(html, "sensei2Load"),
  extractFunction(html, "sensei2Speak"),
].join("\n");

const JA = {
  sensei2Mercy: "壁がひらく · なさけの一小節 · 息をして",
  sensei2Fill: "ドラムフィル · あわてず 言い切る",
  sensei2Bow: "構えを解けば 礼になる · 夜はみずから終わる",
  sensei2Star: "声がかえった · あの星はもう きみのもの",
};

function senseiWorld({ raw, knob = 1, train = false, temple = false, japanese = false, failRead = false, failWrite = false } = {}) {
  const store = new Map(), calls = [], touches = [];
  if (raw !== undefined) store.set("aimdojo.sensei2", raw);
  const context = vm.createContext({
    CFG: { sensei2: knob }, trainMode: train, templeActive: temple,
    localStorage: {
      getItem(key) { touches.push(["get", key]); if (failRead) throw new Error("read refused"); return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { touches.push(["set", key]); if (failWrite) throw new Error("write refused"); store.set(key, String(value)); },
    },
    T: (key, fallback) => (japanese ? JA[key] : fallback),
    showTrainCoach: (line, ephemeral) => calls.push([line, ephemeral]),
    store, calls, touches,
  });
  new vm.Script(`${SENSEI_SOURCE}\nthis.speak=sensei2Speak; this.load=sensei2Load;`).runInContext(context);
  return context;
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }

test("Moon Sensei II persists exactly four accretion-only once-ever lessons", () => {
  assert.match(html, /\bsensei2:1(?:,|\s)/, "the shipped kill-switch is one flat literal");
  const world = senseiWorld();
  assert.equal(world.speak("mercy"), true);
  assert.equal(world.speak("mercy"), false, "the same event cannot speak twice in one page life");
  assert.equal(world.speak("fill"), true); assert.equal(world.speak("bow"), true); assert.equal(world.speak("star"), true);
  assert.equal(world.speak("other"), false, "unknown names cannot grow the envelope");
  assert.deepEqual(plain(world.calls), [
    ["THE WALL OPENS · MERCY · BREATHE", true],
    ["A DRUM FILL · STATE IT, DON'T FLURRY", true],
    ["HOLSTER TO BOW · THE NIGHT ENDS ON PURPOSE", true],
    ["A VOICE CARRIED HOME · THAT STAR IS YOURS NOW", true],
  ]);
  assert.ok(world.calls.every(([line]) => !/[\r\n]/.test(line)), "every lesson obeys the one-line surface");
  assert.deepEqual(JSON.parse(world.store.get("aimdojo.sensei2")), { v: 1, seen: { mercy: 1, fill: 1, bow: 1, star: 1 } });

  const carried = senseiWorld({ raw: JSON.stringify({ v: 1, seen: { mercy: 1, fill: 0, bow: 0, star: 1 } }) });
  assert.equal(carried.speak("mercy"), false); assert.equal(carried.speak("fill"), true);
  assert.deepEqual(JSON.parse(carried.store.get("aimdojo.sensei2")), { v: 1, seen: { mercy: 1, fill: 1, bow: 0, star: 1 } }, "a new mark cannot clear an old one");
});

test("the Sensei II envelope rejects every shape the game cannot write", () => {
  const seen = { mercy: 0, fill: 0, bow: 0, star: 0 };
  const invalid = [
    "{", JSON.stringify([]), JSON.stringify({ v: 2, seen }), JSON.stringify({ v: 1 }),
    JSON.stringify({ v: 1, seen, extra: 1 }), JSON.stringify({ v: 1, seen: { ...seen, extra: 0 } }),
    JSON.stringify({ v: 1, seen: { ...seen, mercy: true } }), JSON.stringify({ v: 1, seen: { ...seen, fill: "1" } }),
  ];
  for (const raw of invalid) {
    const world = senseiWorld({ raw });
    assert.deepEqual(plain(world.load()), seen, `invalid envelope is forgotten: ${raw}`);
    assert.equal(world.speak("bow"), true);
    assert.deepEqual(JSON.parse(world.store.get("aimdojo.sensei2")), { v: 1, seen: { mercy: 0, fill: 0, bow: 1, star: 0 } }, "the next real event repairs with the canonical shape");
  }
});

test("the kill-switch, trainer and Temple touch neither storage nor coach; blocked storage still cannot repeat", () => {
  for (const options of [{ knob: 0 }, { train: true }, { temple: true }]) {
    const world = senseiWorld(options);
    assert.equal(world.speak("mercy"), false); assert.deepEqual(plain(world.touches), []); assert.deepEqual(plain(world.calls), []);
  }
  const blocked = senseiWorld({ failRead: true, failWrite: true });
  assert.equal(blocked.speak("mercy"), true); assert.equal(blocked.speak("mercy"), false);
  assert.deepEqual(plain(blocked.calls), [["THE WALL OPENS · MERCY · BREATHE", true]], "memory marks before a refused write");
});

test("all four Japanese drafts are wired through T and remain one line", () => {
  for (const [key, line] of Object.entries(JA)) {
    assert.ok(html.includes(`${key}:'${line}'`), `${key} is present in the flat JA table`);
    assert.ok(!/[\r\n]/.test(line));
  }
  const world = senseiWorld({ japanese: true });
  for (const kind of ["mercy", "fill", "bow", "star"]) world.speak(kind);
  assert.deepEqual(plain(world.calls.map((call) => call[0])), Object.values(JA));
});

test("the four hooks observe their existing authorities, with the Bow lesson before commit", () => {
  const grid = extractFunction(html, "onGrid"), spawn = extractFunction(html, "spawnTarget"), bow = extractFunction(html, "bowClock");
  assert.match(grid, /wasMercy=tideMercy/); assert.match(grid, /if\(tideMercy && !wasMercy\) sensei2Speak\('mercy'\);/);
  assert.ok(grid.indexOf("tideMercy = cb>=rise+peak") < grid.indexOf("sensei2Speak('mercy')"), "the mercy hook follows the tide's own writer");
  assert.match(spawn, /targets\.push\(tg\);\n  if\(tg\.fill16>=0\) sensei2Speak\('fill'\);/);
  assert.ok(spawn.indexOf("if(tg.fill16>=0) sensei2Speak('fill')") > spawn.indexOf("tg.expireAt=state.t+lifeF"), "only a final, surviving fill tag teaches");
  assert.match(bow, /const threshold=Math\.max\(\(B\.holsterBeats\|\|0\)\*\(60\/Math\.max\(20,state\.bpm\)\), B\.holsterMinSec\|\|0\);/);
  assert.ok(bow.indexOf("sensei2Speak('bow')") < bow.indexOf("bowCommit()"), "the half-threshold line precedes the Bow");

  function bowWorld(bpm) {
    const events = [], context = vm.createContext({
      Math, CFG: { bow: { holsterBeats: 8, holsterMinSec: 12 } }, state: { bpm }, _bow: { idle: 0 },
      bowHolding: () => false, bowLive: () => true, bowUpdate() {}, sensei2Speak: () => events.push("lesson"), bowCommit: () => events.push("commit"), events,
    });
    new vm.Script(`${bow}\nthis.step=bowClock;`).runInContext(context); return context;
  }
  const slow = bowWorld(20); slow.step(11.99); assert.deepEqual(plain(slow.events), []); slow.step(0.01); assert.deepEqual(plain(slow.events), ["lesson"], "half of the 24 s beat threshold");
  const min = bowWorld(60); min.step(6); assert.deepEqual(plain(min.events), ["lesson"], "half of the 12 s minimum threshold");
  const leap = bowWorld(20); leap.step(24); assert.deepEqual(plain(leap.events), ["lesson", "commit"], "even a long frame speaks before commit");
});

test("a star teaches only when a live drain raises it to level one, never during teardown", () => {
  const drain = extractFunction(html, "starFlyDrain"), clear = extractFunction(html, "starFlyClear");
  assert.doesNotMatch(clear, /sensei2Speak/, "pause, Temple and reset teardown cannot collide with the threshold");
  const levels = { debtOld: 1 }, grants = [], lessons = [];
  const context = vm.createContext({
    Math, CFG: { stars: { lineBeats: 1 } }, state: { bpm: 60 }, reduceMotion: true, _STAR_FLY_MAX: 0,
    _starDebt: ["debtFresh", "debtOld"], _starDebtDue: 0,
    _starPend: [{ id: "pendFresh", due: 0, from: {} }], _starPendPool: [], _starFly: [], _starFlyPool: [], _starLitIdx: {},
    starLitGain(id) { levels[id] = (levels[id] || 0) + 1; grants.push(id); return levels[id]; },
    sensei2Speak(kind) { lessons.push(kind); }, levels, grants, lessons,
  });
  new vm.Script(`${drain}\nstarFlyDrain(1);`).runInContext(context);
  assert.deepEqual(plain(grants), ["debtFresh", "debtOld", "pendFresh"], "debt remains first and every due return is paid once");
  assert.deepEqual(plain(lessons), ["star", "star"], "both drain branches observe level one while an already-lit star stays quiet");
});
