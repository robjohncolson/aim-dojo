"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function namedFunction(name) {
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `${name} exists`);
  const next = html.slice(start + marker.length).search(/\nfunction\s+[A-Za-z_$][\w$]*\s*\(/);
  return next < 0 ? html.slice(start) : html.slice(start, start + marker.length + next);
}

function indexBefore(source, first, second, message) {
  const left = source.search(first);
  const right = source.search(second);
  assert.ok(left >= 0, `${message}: first anchor is present`);
  assert.ok(right >= 0, `${message}: second anchor is present`);
  assert.ok(left < right, message);
}

function templeFunctions() {
  const names = [...html.matchAll(/function\s+([A-Za-z_$][\w$]*Temple[A-Za-z_$\d]*)\s*\(/g)]
    .map((match) => match[1]);
  return [...new Set(names)].map(namedFunction).join("\n");
}

test("Sky Temple config and fixed investigation shell stay opt-in and data-first", () => {
  const cfg = html.match(/skyTemple\s*:\s*\{[^}]+\}/);
  assert.ok(cfg, "CFG.skyTemple exists");
  for (const contract of [
    /enabled\s*:\s*true/,
    /enterKey\s*:\s*['"]KeyE['"]/,
    /selectRequiresHold\s*:\s*true/,
    /forceNaturalInTemple\s*:\s*true/,
    /maxAspectLines\s*:\s*24/,
    /legacyListenCard\s*:\s*false/,
    /ritualSpeech\s*:\s*false/,
  ]) assert.match(cfg[0], contract);

  assert.match(html, /<script src="sky-temple\.js"><\/script>/);
  assert.match(html, /const SKY_TEMPLE_DATA\s*=\s*window\.AimDojoSkyTemple\s*\|\|\s*null/);

  const panel = html.match(/<aside id="skyTemplePanel"[\s\S]*?<\/aside>/);
  assert.ok(panel, "temple has its own fixed panel");
  assert.match(panel[0], /role="status"/);
  assert.match(panel[0], /aria-live="polite"/);
  assert.match(panel[0], /aria-hidden="true"/);
  assert.match(panel[0], /id="skyTempleTitle"/);
  assert.match(panel[0], /id="skyTempleMeta"/);
  assert.match(panel[0], /id="skyTempleBody"/, "full study copy lives in the temple body pane");
  assert.doesNotMatch(panel[0], /skyListenCard|essay|DeepSeek/i);

  const templeCss = html.match(/body\.temple-active\s+:is\([^)]+\)\s*\{[^}]+\}/);
  assert.ok(templeCss, "temple has a dedicated HUD suppression rule");
  for (const id of ["#beatRing", "#pocketLaw", "#wasdHud", "#wasdGlyph", "#timing", "#trainCoach"])
    assert.match(templeCss[0], new RegExp(id.replace("#", "\\#")));
});

test("held E is a hard gate before celestial selection and Echo combat keeps priority", () => {
  const select = namedFunction("skyListenTry");
  indexBefore(select, /_skySelectHeld/, /_lsnOrbBlocksSky\s*\(/, "held-E guard precedes combat arbitration");
  indexBefore(select, /_lsnOrbBlocksSky\s*\(/, /pickCelestial\s*\(/, "Echo blocking precedes every sky pick");
  assert.match(select, /selectRequiresHold/);
  assert.match(select, /!\s*_skySelectHeld/);
  assert.match(select, /if\s*\(\s*_lsnOrbBlocksSky\s*\(\s*\)\s*\)\s*return\s+false/);

  const fire = namedFunction("fire");
  indexBefore(fire, /skyListenTry\s*\(/, /spawnProjectile\s*\(/, "selection arbitration precedes projectile launch");
  assert.match(fire, /if\s*\(\s*!\s*state\.running\s*\)\s*return/);

  const selectFeedback = namedFunction("startListen");
  assert.match(selectFeedback, /_skySel\s*=\s*pick/);
  assert.match(selectFeedback, /goldFigure\s*\(/);
  assert.match(selectFeedback, /emphasizeListenGlyphs\s*\(/);
  indexBefore(selectFeedback, /legacyListenCard/, /showListenCard\s*\(/, "legacy study card remains behind its false-by-default flag");
  indexBefore(selectFeedback, /legacyListenCard/, /fetchListen\s*\(/, "personal essay fetch remains behind the legacy flag");

  const clear = namedFunction("clearListen");
  assert.match(clear, /_skySel\s*=\s*null/);
  assert.match(select, /!\s*pick[\s\S]*clearListen\s*\(/, "held-E empty sky clears the mark");
});

test("E press/release state separates hold-to-select from tap-to-enter", () => {
  assert.match(html, /let\s+templeActive\s*=\s*false[^;]*_skySelectHeld\s*=\s*false[^;]*_skySelectUsed\s*=\s*false[^;]*_skySel\s*=\s*null/);

  const heldWrite = html.search(/_skySelectHeld\s*=\s*true/);
  const releasedOffset = heldWrite < 0 ? -1 : html.slice(heldWrite + 1).search(/_skySelectHeld\s*=\s*false/);
  const releasedWrite = releasedOffset < 0 ? -1 : heldWrite + 1 + releasedOffset;
  assert.ok(heldWrite >= 0, "KeyE keydown records the held state");
  assert.ok(releasedWrite >= 0, "KeyE keyup clears the held state");

  const keyRegion = html.slice(Math.max(0, heldWrite - 800), Math.min(html.length, releasedWrite + 1200));
  assert.match(keyRegion, /CFG\.skyTemple\.enterKey/);
  assert.match(keyRegion, /INPUT\|TEXTAREA\|SELECT|INPUT\|SELECT\|TEXTAREA/);
  assert.match(keyRegion, /isContentEditable/);
  assert.match(keyRegion, /_skySelectUsed/);
  assert.match(keyRegion, /enterSkyTemple\s*\(/);
  assert.match(keyRegion, /exitSkyTemple\s*\(/);

  const clearAnchor = html.indexOf("// X clears temple focus");
  assert.ok(clearAnchor >= 0, "pointer-lock-safe X handling is documented at its input boundary");
  const clearEnd = html.indexOf("\n});", clearAnchor);
  const clearRegion = html.slice(clearAnchor, clearEnd < 0 ? clearAnchor + 900 : clearEnd + 4);
  assert.match(clearRegion, /KeyX/);
  assert.match(clearRegion, /if\s*\(\s*templeActive\s*\)[\s\S]*clearSkyTempleFocus\s*\(/);
  assert.match(clearRegion, /else\s+if\s*\(\s*dismissListenIfOpen\s*\(\s*\)\s*\)/,
    "outside temple X clears the gold selection instead of changing modes");
});

test("enter and exit form a reversible no-combat temple shell", () => {
  const enter = namedFunction("enterSkyTemple");
  assert.match(enter, /CFG\.skyTemple\.enabled/);
  assert.match(enter, /state\.running/);
  assert.match(enter, /_skySel/);
  assert.match(enter, /templeActive\s*=\s*true/);
  assert.match(enter, /rhythmGeneration\s*\+\+/);
  assert.match(enter, /skyFrozen\s*=\s*false/);
  assert.match(enter, /abortFlickBonus\s*\(/);
  assert.match(enter, /clearProjectiles\s*\(/);
  assert.match(enter, /targets/);
  assert.match(enter, /temple-active/);
  assert.match(enter, /syncTransport\s*\(/);

  const exit = namedFunction("exitSkyTemple");
  assert.match(exit, /templeActive\s*=\s*false/);
  assert.match(exit, /temple-active/);
  assert.match(exit, /syncTransport\s*\(/);
  assert.match(exit, /_templeFocus\s*=\s*null/);

  const transport = namedFunction("syncTransport");
  assert.match(transport, /templeActive/);
  assert.match(transport, /Transport\.start\s*\(\s*\)/, "Temple cannot inherit a delayed future Transport start");
  assert.match(transport, /Transport\.pause\s*\(/);

  const grid = namedFunction("onGrid");
  indexBefore(grid, /templeActive/, /spawnRhythmOrb\s*\(/, "temple spawn guard precedes every rhythm-orb path");
  assert.match(grid, /rhythmEpoch\s*===\s*rhythmGeneration/, "pre-Temple draw callbacks are generation-guarded");

  const fire = namedFunction("fire");
  indexBefore(fire, /templeActive/, /spawnProjectile\s*\(/, "temple investigation consumes fire before combat launch");
  assert.match(fire, /templeActive[\s\S]*?(?:focus|pick)[A-Za-z]*SkyTemple/i);

  const exitRun = namedFunction("exitRunning");
  assert.match(exitRun, /forPause\s*:\s*true/, "pause remembers temple so RESUME can restore it");
  assert.match(exitRun, /exitSkyTemple\s*\(/);

  const enterRun = namedFunction("enterRunning");
  assert.match(enterRun, /_templeResumeWanted[\s\S]*restoreTempleAfterResume/, "resume re-enters temple with prior selection");
  assert.doesNotMatch(enterRun, /if\s*\(\s*templeActive\s*\)\s*exitSkyTemple/, "resume must not wipe temple on the way in");
});

test("temple forces live natural sky, hides floors, and cannot freeze", () => {
  const update = namedFunction("updateSky");
  assert.match(update, /templeTarget\s*=\s*templeActive\s*\?\s*1\s*:\s*0/);
  assert.match(update, /skyOpen\s*=\s*templeActive\s*\?\s*1\s*:\s*_templeBlend/, "full sphere opens the moment temple is active");
  assert.match(update, /setHorizonOpen\s*\(\s*skyOpen\s*\)/);
  assert.match(update, /baseFloor\.visible\s*=\s*!\s*templeActive/, "dojo keeps opaque base floor; temple hard-hides it");
  assert.match(update, /baseFloor\.material\.transparent\s*=\s*false/, "dojo floor must stay opaque (no look-up black)");
  assert.match(update, /dayFloor\.visible\s*=\s*!\s*templeActive/);
  assert.match(update, /nightGrid\.visible\s*=\s*!\s*templeActive/);
  indexBefore(update, /templeActive\s*&&\s*CFG\.skyTemple\.forceNaturalInTemple/, /['"]natural['"]\s*:\s*SKY_TIME/, "temple natural override is chosen before the ordinary sky mode");
  assert.match(update, /skyTime\s*===\s*['"]natural['"][\s\S]*applyNaturalSkyAttitude/);
  assert.match(update, /dayPhase\s*=\s*clockedDayPhase\s*\(\s*Date\.now\s*\(\s*\)\s*\)[\s\S]*skyFrozen\s*=\s*false/);

  // Arena base floor is opaque MeshBasicMaterial (not transparent:true).
  assert.match(html, /baseFloor\s*=\s*new THREE\.Mesh\([\s\S]*?MeshBasicMaterial\(\{color:0x0c0a14\}\)/);

  const freeze = namedFunction("toggleSkyFreeze");
  indexBefore(freeze, /templeActive/, /skyFrozen\s*=\s*!\s*skyFrozen/, "temple no-freeze guard precedes the only freeze mutation");

  assert.match(html, /Escape[\s\S]{0,900}templeActive[\s\S]{0,900}exitRunning\s*\(/,
    "Esc while in temple pauses (with temple memory) rather than dumping to dojo");
});

test("temple opens the full celestial sphere underfoot instead of a black void", () => {
  assert.match(html, /function setHorizonOpen\s*\(/);
  assert.match(html, /uHzOpen/);
  assert.match(html, /uTemple/);
  assert.match(html, /_hzFadeMats/);

  const chart = namedFunction("updateChartSky");
  assert.match(chart, /hzOpen\s*=\s*templeActive\s*\?\s*1\s*:\s*_templeBlend/);
  assert.match(chart, /hz\s*\+\s*\(1\s*-\s*hz\)\s*\*\s*hzOpen/, "CPU sprite horizon hide opens with temple");
  assert.match(chart, /depthTest\s*=\s*!\s*templeActive/, "sprites stop depth-testing the vanished floor plane");

  const hzMat = namedFunction("horizonFadeMat");
  assert.match(hzMat, /uHzOpen/);
  assert.match(hzMat, /mix\s*\(\s*smoothstep[\s\S]*1\.0[\s\S]*uHzOpen/, "GPU sticks/aspects open with temple");

  const enter = namedFunction("enterSkyTemple");
  assert.match(enter, /setHorizonOpen\s*\(\s*1\s*\)/);
  assert.match(enter, /baseFloor\.visible\s*=\s*false/);

  const exit = namedFunction("exitSkyTemple");
  assert.match(exit, /baseFloor\.visible\s*=\s*true/);
  assert.match(exit, /setHorizonOpen\s*\(\s*0\s*\)/);
  assert.match(exit, /transparent\s*=\s*false/);

  const geometry = namedFunction("rebuildSkyTempleGeometry");
  assert.match(geometry, /eclipticDir\s*\(\s*lon\s*,\s*0\s*\)/, "ecliptic great-circle anchors the full sphere read");

  const pick = namedFunction("pickCelestial");
  assert.match(pick, /openSphere\s*=\s*templeActive/);
  assert.match(pick, /!openSphere\s*&&\s*_lsnW\.y\s*<\s*HZ_HI/, "dojo still horizon-culls; temple picks underfoot bodies");

  const aspect = namedFunction("pickSkyTempleAspect");
  assert.doesNotMatch(aspect, /segmentPoint\.y\s*<\s*HZ_LO/, "aspect pick no longer drops underfoot chords");

  const natal = namedFunction("pickSkyTempleNatal");
  assert.doesNotMatch(natal, /y\s*<\s*HZ_HI/, "natal ghosts under the former floor stay selectable");
});

test("personal aspect chords are capped, first-class, and rendered only through the temple panel", () => {
  const build = namedFunction("buildChartSky");
  assert.match(build, /normalizeAspectRecords\s*\(/);
  assert.match(build, /maxLines\s*:\s*CFG\.skyTemple\.maxAspectLines/);
  assert.match(build, /templeGhosts/);
  assert.match(build, /aspects\s*:\s*aspects/);

  const geometry = namedFunction("rebuildSkyTempleGeometry");
  assert.match(geometry, /meta\.aspects/);
  assert.match(geometry, /Math\.min\(\s*24\s*,\s*CFG\.skyTemple\.maxAspectLines/);
  assert.match(geometry, /new THREE\.LineSegments\s*\(/);
  assert.match(geometry, /_templeNatal\.push\s*\(/);

  const focus = namedFunction("focusSkyTempleReticle");
  indexBefore(focus, /pickSkyTempleAspect\s*\(/, /pickSkyTempleNatal\s*\(/,
    "aspect chords win over natal ghosts");
  indexBefore(focus, /pickSkyTempleNatal\s*\(/, /pickCelestial\s*\(/,
    "natal ghosts win over ordinary body/sign picking");
  assert.match(focus, /setSkyTempleFocus\(\{kind:'body'/, "body focus is set even when normalize is sparse");

  const panel = namedFunction("renderSkyTemplePanel");
  assert.match(panel, /aspectPanelData\s*\(/);
  assert.match(panel, /bodyPanelData\s*\(/);
  assert.match(panel, /\.textContent\s*=/);
  assert.doesNotMatch(panel, /\.innerHTML\s*=/);

  const study = namedFunction("fillTempleStudy");
  assert.match(study, /yourChartHdr|YOUR CHART/);
  assert.match(study, /skyNowHdr|SKY · NOW/);
  assert.match(study, /skySealsHdr|TRANSIT SEALS/);
  assert.match(study, /_lsnLine\s*\(/);
  assert.doesNotMatch(study, /\.innerHTML\s*=/);

  const request = namedFunction("requestTempleStudy");
  assert.match(request, /glossaryListenData\s*\(/);
  assert.match(request, /fetchListen\s*\(/);

  const fetch = namedFunction("fetchListen");
  assert.match(fetch, /paintStudySurface|fillTempleStudy|templeActive/);

  const downgrade = namedFunction("downgradePersonalSky");
  assert.match(downgrade, /templeActive[\s\S]*_templeFocus\s*=\s*null[\s\S]*rebuildSkyTempleGeometry\s*\(/,
    "chart deletion/sign-out cannot leave private chords or panel focus in Temple");
});

test("temple chrome stays lore-silent and excludes private birth/location data", () => {
  const overlayStart = html.indexOf('<div id="overlay">');
  const bodyStart = html.indexOf("<body>");
  assert.ok(bodyStart >= 0 && overlayStart > bodyStart);
  const inRunMarkup = html.slice(bodyStart, overlayStart);
  const templePanel = html.match(/<aside id="skyTemplePanel"[\s\S]*?<\/aside>/)[0];
  const forbiddenLore = /I love you|I(?:'|’)m sorry|Thank you|Please forgive me|Ho.?oponopono/i;
  assert.doesNotMatch(inRunMarkup, forbiddenLore);
  assert.doesNotMatch(templeFunctions(), forbiddenLore);

  assert.doesNotMatch(templePanel, /birth|latitude|longitude|place_label|timezone|natal_id|DeepSeek/i);
  const templeCode = templeFunctions();
  assert.doesNotMatch(templeCode, /birth_date|birth_time|place_label|DeepSeek/i);
  assert.doesNotMatch(templeCode, /speechSynthesis|SpeechSynthesis|new\s+Audio\s*\(/);
  assert.doesNotMatch(templeCode, /showListenCard/,
    "temple investigation never reopens the legacy dojo Listen chip");
  assert.match(templeCode, /fetchListen|requestTempleStudy|fillTempleStudy/,
    "temple reuses the study data path (glossary + personal desk) inside its own panel");
});

test("selection and temple focus never enter outbound share, dojo, realtime, or cloud payloads", () => {
  const outbound = ["linkUrl", "dojoSession", "broadcastAim", "localPrefSnapshot"]
    .map(namedFunction)
    .join("\n");
  assert.doesNotMatch(outbound, /_skySel|_templeFocus|templeActive|natal_id|birth_date|birth_time|place_label|_skyObserver/);

  const cloudColumns = html.match(/const CLOUD_PREF_SELECT\s*=\s*['"][^'"]+['"]/);
  assert.ok(cloudColumns);
  assert.doesNotMatch(cloudColumns[0], /temple|natal|birth|lat|lon|observer/i);
});
