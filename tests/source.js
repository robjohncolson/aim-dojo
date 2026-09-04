"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const main = fs.readFileSync(path.join(ROOT, "aim-dojo-main.js"), "utf8");
const sourceText = `${html}\n${main}`;

function sourceFor(name) {
  const token = String(name || "");
  const marker = `function ${token}(`;
  if (main.includes(marker)) return main;
  if (html.includes(marker)) return html;
  if (main.includes(token)) return main;
  if (html.includes(token)) return html;
  throw new Error(`source token not found: ${token}`);
}

module.exports = { ROOT, html, main, sourceText, sourceFor };
