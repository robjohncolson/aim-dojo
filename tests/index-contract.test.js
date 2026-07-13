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
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  assert.match(pauseBlock[0], /<details id="saveSkyDetails"[\s\S]*?<\/details>/);
  assert.match(pauseBlock[0], /Optional · play works without it/);
  assert.ok(html.indexOf('<div id="modePick"') > html.indexOf(pauseBlock[0]) + pauseBlock[0].length);
});

test("Today's sky note control is chart-gated inside pause settings", () => {
  const pauseBlock = html.match(/<div id="settingsBox"[^>]*>[\s\S]*?<\/div>\s*<!-- Always enter through Moonline training/);
  assert.ok(pauseBlock);
  const noteBlock = pauseBlock[0].match(/<(?:div|section) id="transitEssayBlock"[^>]*>[\s\S]*?<\/(?:div|section)>/);
  assert.ok(noteBlock, "transit essay controls are inside pause-only settings");
  assert.ok(pauseBlock[0].indexOf('id="transitEssayBlock"') > pauseBlock[0].indexOf('id="saveSkyDetails"'));
  assert.match(noteBlock[0], /\shidden(?:\s|>|=)/i);
  const button = noteBlock[0].match(/<button[^>]*\bid="transitEssayButton"[^>]*>/i);
  assert.ok(button);
  assert.match(button[0], /\btype="button"/i);
  assert.match(button[0], /\bdisabled(?:\s|>|=)/i);
  assert.match(noteBlock[0], /id="transitEssayButtonLabel"[^>]*>TODAY(?:&apos;|&#39;|')S SKY NOTE</i);
  const status = noteBlock[0].match(/<[^>]+\bid="transitEssayStatus"[^>]*>/i);
  assert.ok(status);
  assert.match(status[0], /\brole="status"/i);
  assert.match(status[0], /\baria-live="polite"/i);
});

test("pause reader has all private note fields and a non-resuming close control", () => {
  for (const id of [
    "transitEssayReader",
    "transitEssayReaderHeadline",
    "transitEssayReaderDate",
    "transitEssayReaderBody",
    "transitEssayReaderWatchpoints",
    "transitEssayReaderEpistemic",
    "transitEssayReaderClose",
  ]) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} exists exactly once`);
  }
  const reader = html.match(/<(?:div|section)[^>]*\bid="transitEssayReader"[^>]*>/);
  assert.ok(reader);
  assert.match(reader[0], /\b(?:hidden|class="[^"]*hidden)/i);
  const closeButton = html.match(/<button[^>]*\bid="transitEssayReaderClose"[^>]*>/i);
  assert.ok(closeButton);
  assert.match(closeButton[0], /\btype="button"/i);

  const closeHandler = html.match(/transitEssayUi\.close[^\n]*addEventListener\(['"]click['"][^\n]*/);
  assert.ok(closeHandler, "reader close has an explicit click handler");
  assert.match(closeHandler[0], /closeTransitEssayReader\(true\)/);
  const closeFunction = html.match(/function closeTransitEssayReader\(restoreFocus\)[\s\S]*?\n\}/);
  assert.ok(closeFunction);
  assert.doesNotMatch(closeFunction[0], /enterRunning|startRun|requestPointerLock|beginBtn\.click/);
});

test("model-authored transit essay fields are rendered as text, never HTML", () => {
  const render = html.match(/function openTransitEssayReader\(\)[\s\S]*?\n\}/);
  assert.ok(render);
  assert.match(render[0], /\.headline\.textContent=record\.headline/);
  assert.match(render[0], /record\.body\.split/);
  assert.match(render[0], /createElement\('p'\);\s*p\.textContent=/);
  assert.match(render[0], /record\.watchpoints/);
  assert.match(render[0], /createElement\('li'\);\s*li\.textContent=/);
  assert.match(render[0], /\.epistemic\.textContent=record\.epistemic/);
  assert.doesNotMatch(render[0], /\.innerHTML\s*=/);
});

test("transit essay polling is visible-tab-only, backed off, bounded, and terminal", () => {
  const policy = html.match(/const TRANSIT_ESSAY_POLL_DELAYS=\[([^\]]+)\],\s*TRANSIT_ESSAY_MAX_MS=(\d+);/);
  assert.ok(policy);
  const delays = policy[1].split(",").map((value) => Number(value.trim()));
  assert.deepEqual(delays, [8000, 10000, 12000, 15000]);
  assert.equal(Number(policy[2]), 180000);
  assert.ok(delays.every((delay, index) => delay >= 8000 && delay <= 15000 && (!index || delay >= delays[index - 1])));

  const schedule = html.match(/function transitEssaySchedulePoll\(seq\)[\s\S]*?\n\}/);
  assert.ok(schedule);
  assert.ok(schedule[0].indexOf("if(document.hidden) return") < schedule[0].indexOf("setTimeout"));
  assert.match(schedule[0], /TRANSIT_ESSAY_MAX_MS-\(Date\.now\(\)-_transitEssayStartedAt\)/);
  assert.match(schedule[0], /remaining<=0\)\{ transitEssayFinishUnavailable\(\)/);
  assert.match(schedule[0], /TRANSIT_ESSAY_POLL_DELAYS\[Math\.min\(_transitEssayPollStep/);

  const visibility = html.match(/function transitEssayVisibilityChanged\(\)[\s\S]*?\n\}/);
  assert.ok(visibility);
  assert.match(visibility[0], /if\(document\.hidden\)\{ transitEssayClearPollTimer\(\); return; \}/);
  assert.match(visibility[0], /transitEssayFlushReadyToast\(\)/);
  assert.match(visibility[0], /transitEssaySchedulePoll\(_transitEssaySeq\)/);
  const browserVisibility = html.match(/document\.addEventListener\('visibilitychange',[\s\S]*?\n\}\);/);
  assert.ok(browserVisibility);
  assert.match(browserVisibility[0], /transitEssayVisibilityChanged\(\)/);

  const terminal = html.match(/function transitEssayFinishUnavailable\(\)[\s\S]*?\n\}/);
  assert.ok(terminal);
  assert.match(terminal[0], /transitEssayClearPollTimer\(\)/);
  assert.match(terminal[0], /_transitEssayActive=false/);
  assert.match(terminal[0], /_transitEssayPhase='unavailable'/);
});

test("ready transit essay toast is deduplicated and emitted from one literal call site", () => {
  assert.equal((html.match(/showGhostToast\('SKY NOTE READY'\)/g) || []).length, 1);
  const flush = html.match(/function transitEssayFlushReadyToast\(\)[\s\S]*?\n\}/);
  assert.ok(flush);
  assert.ok(flush[0].indexOf("_transitEssayToastKeys.has(pending)") < flush[0].indexOf("showGhostToast('SKY NOTE READY')"));
  assert.ok(flush[0].indexOf("_transitEssayToastKeys.add(pending)") < flush[0].indexOf("showGhostToast('SKY NOTE READY')"));
  assert.match(flush[0], /document\.hidden/);
  assert.equal((html.match(/openTransitEssayReader/g) || []).length, 2, "reader opens only from its function and button handler");
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
  assert.doesNotMatch(row[0], /birth|\bplace\b|\blat\b|\blon\b|\btz\b|profile|natal|essay|sky.?note|headline|body|watchpoint|epistemic/i);
});

test("share links and dojo POST bodies cannot receive essay content", () => {
  const shareLink = html.match(/function linkUrl\(\)\{[^}]*\}/);
  assert.ok(shareLink);
  assert.match(shareLink[0], /location\.origin\+location\.pathname/);
  assert.doesNotMatch(shareLink[0], /location\.(?:search|hash)|URLSearchParams|essay|sky.?note|headline|body|watchpoint|epistemic/i);

  const submit = html.match(/async function submitDojo\(\)[\s\S]*?function _localRuntime/);
  assert.ok(submit);
  assert.doesNotMatch(submit[0], /essay|sky.?note|headline|watchpoint|epistemic|birth|\bplace\b|\blat\b|\blon\b|\btz\b|profile|natal/i);
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
  assert.match(fn[0], /transitEssayReader/);
});

test("groove pocket language is wired (CFG, machine, floor cue, HUD)", () => {
  assert.match(html, /groovePocket\s*:\s*true/);
  assert.match(html, /pocketEstablishBeats\s*:\s*10/);
  assert.match(html, /pocketSampleBeats\s*:\s*4/);
  assert.match(html, /pocketHoldSets\s*:\s*4/);
  assert.match(html, /pocketAccFloor\s*:\s*0\.70/);
  assert.match(html, /function pocketOnMain\b/);
  assert.match(html, /function classifyPocket\b/);
  assert.match(html, /function resetPocketState\b/);
  assert.match(html, /id="pocketHud"/);
  // floor peak phase follows pocket ideal; open-window stays absolute (no pocketIdeal on fire early)
  assert.match(html, /cueI=pocketLive\(\)\?pocketIdeal\(pocketCueId\(\)\)/);
  assert.doesNotMatch(html, /grooveFireEarlyBeat\s*=\s*pocketIdeal|grooveFireEarlyBeat.*pocketCueId/);
  // trainer keeps pocket machine off
  assert.match(html, /function pocketLive\(\)\{ return !!\(CFG\.groovePocket && CFG\.wasdRhythm && CFG\.grooveGroove && !trainMode && !MOBILE\); \}/);
});
