"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const THREE_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" onerror="window.__threeFailed=1"></script>';
const GUARD = "if(typeof THREE==='undefined'){ threeBlock(); return; }";

function closingBrace(source, openAt) {
  let depth = 0, quote = "", lineComment = false, blockComment = false;
  for (let index = openAt; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index += 1; } continue; }
    if (quote) { if (char === "\\") index += 1; else if (char === quote) quote = ""; continue; }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return index;
  }
  throw new Error("unclosed function");
}

function extractFunction(source, name) {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} is defined before the game guard`);
  const openAt = source.indexOf("{", match.index + match[0].length);
  return source.slice(match.index, closingBrace(source, openAt) + 1);
}

function assertSource(source) {
  assert.ok(source.includes(THREE_TAG), "the blocking CDN tag records its own failure");
  const open = source.indexOf(`(function(){\n${GUARD}`);
  assert.ok(open >= 0, "the guard is literally the first statement of the game IIFE");
  const firstThree = source.indexOf("new THREE.", open);
  assert.ok(firstThree > open && source.indexOf(GUARD, open) < firstThree, "the guard precedes every THREE construction");
  assert.ok(source.indexOf("function threeBlock()") < open, "the fail-soft renderer is defined before the guard");
  const block = extractFunction(source, "threeBlock");
  assert.match(block, /T\('threeFailedHtml','<b>The sky did not load\.<\/b> Check your connection or unblock cdnjs, then reload\.'\)/);
  assert.doesNotMatch(block, /\bgid\(|setGateReady|beginTrainBtn|\bIS_JA\b/, "the failure path depends on nothing initialized after the guard");
}

function runBoot(source, { japanese = false, three = false, missing = false } = {}) {
  const lede = { innerHTML: "original" }, button = { disabled: false, style: {} };
  const context = vm.createContext({
    window: { JA: { threeFailedHtml: "<b>星空を読みこめなかった。</b>通信かブロックを確かめて、ページを読みなおしてね。" } },
    document: {
      documentElement: { lang: japanese ? "ja" : "en" },
      getElementById(id) { if (missing) return null; return id === "ovLede" ? lede : (id === "beginTrain" ? button : null); },
    },
    lede, button, pastGuard: false,
  });
  if (three) context.THREE = {};
  const block = extractFunction(source, "threeBlock");
  new vm.Script(`${block}\n(function(){\n${GUARD}\npastGuard=true;\n})();`, { filename: "three-cdn-guard.vm.js" }).runInContext(context);
  return context;
}

function assertFailure(world, line) {
  assert.equal(world.pastGuard, false, "no game initialization runs without THREE");
  assert.equal(world.lede.innerHTML, line);
  assert.deepEqual({ disabled: world.button.disabled, opacity: world.button.style.opacity, cursor: world.button.style.cursor }, { disabled: true, opacity: "0.45", cursor: "wait" });
}

test("the Three.js tag and first-statement guard protect every constructor", () => {
  assertSource(html);
  const mutants = [
    html.replace(' onerror="window.__threeFailed=1"', ""),
    html.replace(`${GUARD}\n`, ""),
    html.replace("if(typeof THREE==='undefined')", "if(window.__threeFailed)"),
  ];
  for (const mutant of mutants) assert.throws(() => assertSource(mutant), assert.AssertionError, "the source oracle kills a weakened boot boundary");
});

test("missing THREE renders the English or Japanese start-card message and leaves PLAY disabled", () => {
  assertFailure(runBoot(html), "<b>The sky did not load.</b> Check your connection or unblock cdnjs, then reload.");
  assertFailure(runBoot(html, { japanese: true }), "<b>星空を読みこめなかった。</b>通信かブロックを確かめて、ページを読みなおしてね。");
  assert.doesNotThrow(() => runBoot(html, { missing: true }), "a damaged or partial card still fails soft");
  const normal = runBoot(html, { three: true });
  assert.equal(normal.pastGuard, true); assert.equal(normal.lede.innerHTML, "original"); assert.equal(normal.button.disabled, false, "a normal load passes without touching the card or gate");

  const enabled = html.replace("b.disabled=true", "b.disabled=false");
  assert.throws(() => assertFailure(runBoot(enabled), "<b>The sky did not load.</b> Check your connection or unblock cdnjs, then reload."), assert.AssertionError, "the behavior oracle kills an enabled PLAY button");
  const wrongKey = html.replace("T('threeFailedHtml'", "T('toneFailedHtml'");
  assert.throws(() => assertFailure(runBoot(wrongKey, { japanese: true }), "<b>星空を読みこめなかった。</b>通信かブロックを確かめて、ページを読みなおしてね。"), assert.AssertionError, "the behavior oracle kills a miswired Japanese key");
});
