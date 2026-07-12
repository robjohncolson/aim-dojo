"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

test("every inline browser script parses", () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  assert.ok(scripts.length >= 2);
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `index-inline-${index + 1}.js` }));
  });
});

test("Save my sky remains inside pause settings and outside PLAY controls", () => {
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<details id="saveSkyDetails"[\s\S]*?<\/details>\s*<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  assert.match(pauseBlock[0], /Optional · play works without it/);
  assert.ok(html.indexOf('<div id="modePick"') > html.indexOf(pauseBlock[0]) + pauseBlock[0].length);
});

test("native form fallback cannot serialize birth fields into the page URL", () => {
  const form = html.match(/<form id="saveSkyForm"[\s\S]*?<\/form>/);
  assert.ok(form);
  assert.doesNotMatch(form[0], /\sname=/i);
});

test("dojo submission allowlist contains no profile or birth fields", () => {
  const row = html.match(/const row=\{\s*client_id:[^;]+?\};/);
  assert.ok(row, "leaderboard row literal is present");
  const keys = [...row[0].matchAll(/(?:\{|,)\s*([a-z_]+)\s*:/g)].map((match) => match[1]);
  assert.deepEqual(keys, ["client_id", "name", "peak_bpm", "runtime", "far", "high", "streak", "kills"]);
  assert.doesNotMatch(row[0], /birth|place|\blat\b|\blon\b|\btz\b|profile|natal/i);
});

test("token-bearing base is fixed config, never the public URL override", () => {
  const declaration = html.match(/const PERSONAL_API_BASE=[^;]+;/);
  const selector = html.match(/function selectConfiguredPersonalApiBase\(\)[\s\S]*?\n\}/);
  assert.ok(declaration);
  assert.ok(selector);
  assert.match(declaration[0], /selectConfiguredPersonalApiBase\(\)/);
  assert.match(selector[0], /selectPersonalApiBase\(CFG\.personalApi,CFG\.skyDay\.api\)/);
  assert.doesNotMatch(selector[0], /SKY_DAY_API_BASE|localStorage|location|CFG\.skyApi|\?skyApi/i);
});

test("orb blocking still wins before any celestial Listen pick", () => {
  const fn = html.match(/function skyListenTry\(\)[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.ok(fn[0].indexOf("_lsnOrbBlocksSky()") < fn[0].indexOf("pickCelestial()"));
});

test("a saved profile cannot inject chart geometry into decorative mode", () => {
  const fn = html.match(/function linkRemotePersonalSky\(pack\)[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /SKY_MODE==='decorative'\) return false/);
  assert.ok(fn[0].indexOf("SKY_MODE==='decorative'") < fn[0].indexOf("queueSkyGeometry"));
});

test("authenticated no-chart state quarantines every legacy personal pack", () => {
  const load = html.match(/async function skyLoadSavedProfile\(ticket\)[\s\S]*?\n\}/);
  assert.ok(load);
  assert.match(load[0], /_chartPackRank>=2\) downgradePersonalSky\(\)/);
  assert.match(html, /loadSkypack\(\)\.then\(p=>\{[\s\S]*?if\(_skyAuthSession\) return;/);
});

test("initial guest auth resolution preserves a requested legacy chart", () => {
  const handle = html.match(/function skyHandleSession\(session\)[\s\S]*?\n\}/);
  assert.ok(handle);
  const guestBranch = handle[0].match(/if\(!next\)\{[\s\S]*?return;\s*\}/);
  assert.ok(guestBranch);
  assert.doesNotMatch(guestBranch[0], /downgradePersonalSky/);
});

test("auth switches quarantine old profile state before exposing the new token", () => {
  const accept = html.match(/function skyAcceptAuthSession\(session\)[\s\S]*?\n\}/);
  assert.ok(accept);
  assert.ok(accept[0].indexOf("setAuthenticated(false)") < accept[0].indexOf("_skyAuthSession=session"));
  assert.ok(accept[0].indexOf("skyClearForm()") < accept[0].indexOf("_skyAuthSession=session"));
});

test("busy Save my sky requests disable controls and reject overlapping handlers", () => {
  const status = html.match(/function skySetStatus\(text,busy\)[\s\S]*?\n\}/);
  assert.ok(status);
  assert.match(status[0], /control\.disabled=!!busy/);
  assert.ok((html.match(/if\(_skyUiBusy\) return;/g) || []).length >= 3);
});

test("ordinary focused settings buttons do not strand gamepad resume", () => {
  const fn = html.match(/function padBeginBlocked\(\)[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.doesNotMatch(fn[0], /INPUT\|TEXTAREA\|SELECT\|BUTTON/);
  assert.match(fn[0], /saveSkyDetails/);
});
