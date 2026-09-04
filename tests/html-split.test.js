"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { ROOT, html, main, sourceText, sourceFor } = require("./source.js");

const MAIN_TAG = '<script defer src="aim-dojo-main.js"></script>';
const ORDERED_SCRIPTS = [
  'src="observer-location.js"',
  'src="local-sky.js"',
  'src="sky-temple.js"',
  'src="sky-maps.js"',
  'src="save-my-sky.js"',
  'src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"',
  'defer src="aim-dojo-main.js"',
];

function assertSplitContract(indexSource) {
  assert.ok(Buffer.byteLength(indexSource, "utf8") < 150 * 1024, "index.html stays below the P4 150 KB budget");
  assert.equal(indexSource.split("aim-dojo-main.js").length - 1, 1, "the main asset is referenced exactly once");
  assert.ok(indexSource.includes(MAIN_TAG), "the main game loads as a deferred external script");
  let previous = -1;
  for (const script of ORDERED_SCRIPTS) {
    const current = indexSource.indexOf(script);
    assert.ok(current > previous, `${script} preserves module -> THREE -> main order`);
    previous = current;
  }
  assert.doesNotMatch(indexSource, /function threeBlock|function animate/, "large game functions stay out of index.html");
}

test("the HTML split preserves a small ordered shell and a parseable main asset", () => {
  assertSplitContract(html);
  assert.doesNotThrow(() => new vm.Script(main, { filename: "aim-dojo-main.js" }));
  assert.match(main, /^\(function\(\)\{\r?\n["']use strict["'];/);
  assert.match(main, /\}\)\(\);\r?\n\}\)\(\);\r?\n?$/);
  assert.equal(sourceFor("animate"), main, "function-oriented tests resolve the external game source");
  assert.ok(sourceText.startsWith(html) && sourceText.endsWith(main), "the compatibility source spans the shell and main asset");

  assert.throws(() => assertSplitContract(html.replace(MAIN_TAG, '<script src="aim-dojo-main.js"></script>')), assert.AssertionError);
  assert.throws(() => assertSplitContract(html.replace(MAIN_TAG, `<script>${main}</script>`)), assert.AssertionError);
  assert.throws(() => assertSplitContract(html.replace(MAIN_TAG, "")), assert.AssertionError);
});

test("tests and deployment headers honor the external main boundary", () => {
  const directReaders = fs.readdirSync(__dirname)
    .filter((name) => name.endsWith(".test.js"))
    .filter((name) => /readFileSync\([^\r\n]*index\.html/.test(fs.readFileSync(path.join(__dirname, name), "utf8")));
  assert.deepEqual(directReaders, [], "tests consume the shared shell + main source helper");

  const vercel = fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8");
  assert.match(vercel, /observer-location\|local-sky\|sky-temple\|sky-maps\|save-my-sky\|aim-dojo-main/,
    "the unhashed main asset revalidates with the other runtime scripts");
});
