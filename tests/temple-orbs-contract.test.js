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

// SPEC §6 / §9 — CFG.skyMaps present, flat, and temple-first.
test("CFG.skyMaps is a flat literal with the spec keys", () => {
  const cfg = html.match(/skyMaps\s*:\s*\{[^}]+\}/);
  assert.ok(cfg, "CFG.skyMaps exists as a flat (nested-brace-free) literal");
  for (const contract of [
    /enabled\s*:\s*true/,
    /milkyPath\s*:\s*['"]assets\/sky\/8k_stars_milky_way\.jpg['"]/,
    /dojoShell\s*:\s*false/, // §9.7 dojo stays glyph-first by default
    /templeShellOpacity\s*:\s*1\b/,
    /globeEnabled\s*:\s*true/,
    /globeAngularDeg\s*:\s*[0-9.]+/,
    /spinRadPerSec\s*:\s*[0-9.]+/,
    /saturnRings\s*:\s*true/,
    /venusMap\s*:\s*['"]atmosphere['"]/, // §9.5
    /signArtEnabled\s*:\s*true/,
    /signArtAngularDeg\s*:\s*[0-9.]+/,
    /signArtShellFrac\s*:\s*[0-9.]+/,
    /signArtOpacity\s*:\s*[0-9.]+/,
  ]) assert.match(cfg[0], contract);
});

test("sky-maps.js module is included and consumed with graceful fallback", () => {
  assert.match(html, /<script src="sky-maps\.js"><\/script>/);
  assert.match(html, /const SKY_MAPS\s*=\s*window\.AimDojoSkyMaps\s*\|\|\s*null/);
});

// SPEC §9.2 / §0 — milky shell is a BackSide sphere parented to skySphere.
test("milky shell is a BackSide sphere parented under skySphere", () => {
  const src = namedFunction("ensureMilkyShell");
  assert.match(src, /side\s*:\s*THREE\.BackSide/);
  assert.match(src, /new THREE\.SphereGeometry/);
  assert.match(src, /skySphere\.add\(milkyShell\)/);
  assert.match(src, /fog\s*:\s*false/);
});

// Planet globe sits on the celestial sphere (sky-anchored), not as a reticle HUD overlay.
test("planet globe is a FrontSide sphere parented under skySphere (sky-anchored, not reticle HUD)", () => {
  const src = namedFunction("ensureGlobeRig");
  assert.match(src, /side\s*:\s*THREE\.FrontSide/);
  assert.match(src, /new THREE\.SphereGeometry/);
  assert.match(src, /skySphere\.add\(globeRoot\)/);
  assert.ok(!/_templeGroup\.add\(globeRoot\)/.test(src), "globe must not be a _templeGroup child (it gets material-disposed on rebuild)");
  assert.ok(!/scene\.add\(globeRoot\)/.test(src), "globe is sky-anchored, not a free scene HUD prop");

  const place = namedFunction("placeTempleGlobe");
  assert.match(place, /templeGlobeAnchorLocal/);
  assert.match(place, /globeAngularDeg|Math\.tan/);
  assert.doesNotMatch(place, /camera\.quaternion/, "must not track the aim reticle");
});

// SPEC §9.4 — Saturn rings via RingGeometry + alpha map.
test("Saturn rings use RingGeometry + the alpha map", () => {
  assert.match(html, /new THREE\.RingGeometry/);
  const src = namedFunction("showTempleGlobe");
  assert.match(src, /saturn/);
  assert.match(src, /RING\.map/);
  assert.match(src, /alphaMap/);
});

// SPEC §5 / §9.6 — temple-only globe gate: body focus shows, everything else hides.
test("globe shows only on transit-body focus; other focuses hide it", () => {
  const src = namedFunction("setSkyTempleFocus");
  assert.match(src, /showTempleGlobe\(/);
  assert.match(src, /hideTempleGlobe\(\)/);
  indexBefore(src, /kind\s*===\s*['"]body['"]/, /showTempleGlobe\(/, "body kind guards the globe show");
});

// Zodiac art: sign focus shows a sky-anchored plane behind sticks; body/other hide it.
test("sign art plane shows on sign focus and is sky-anchored behind sticks", () => {
  const focus = namedFunction("setSkyTempleFocus");
  assert.match(focus, /showTempleSignArt\(/);
  assert.match(focus, /hideTempleSignArt\(\)/);
  indexBefore(focus, /kind\s*===\s*['"]sign['"]/, /showTempleSignArt\(/, "sign kind guards the art show");

  const ensure = namedFunction("ensureSignArtRig");
  assert.match(ensure, /new THREE\.PlaneGeometry/);
  assert.match(ensure, /skySphere\.add\(signArtRoot\)/);
  assert.match(ensure, /AdditiveBlending/, "art glows into the milky shell, not as an opaque sticker");
  assert.ok(!/_templeGroup\.add\(signArtRoot\)/.test(ensure), "sign art must not be a _templeGroup child");

  const place = namedFunction("placeTempleSignArt");
  assert.match(place, /templeSignAnchorLocal/);
  assert.match(place, /signArtShellFrac|shellRadius/);
  assert.doesNotMatch(place, /camera\.quaternion/, "must not track the aim reticle");

  const show = namedFunction("showTempleSignArt");
  assert.match(show, /mapForSign/);
  assert.match(show, /mapForSignPng/);
  indexBefore(show, /mapForSignPng/, /mapForSign\(/, "prefer alpha PNG before JPEG fallback");
});

// SPEC §9.7 — exit temple hides the globe (exit bypasses setSkyTempleFocus).
test("exitSkyTemple hides the focus globe", () => {
  const src = namedFunction("exitSkyTemple");
  assert.match(src, /hideTempleGlobe\(\)/);
  assert.match(src, /hideTempleSignArt\(\)/, "exit also drops zodiac sign art");
});

// SPEC §9.8 — missing texture degrades to glyph-only without throwing.
test("texture loader guards errors and degrades silently", () => {
  const src = namedFunction("loadSkyTexture");
  assert.match(src, /try\s*\{/);
  assert.match(src, /console\.warn/);
  assert.match(src, /_skyTexLoader\.load\(/);
});

// SPEC §9.9 — index.html never wires the ~15MB 8k mercury.
test("index.html never references 8k_mercury", () => {
  assert.ok(!/8k_mercury/.test(html), "no 8k_mercury anywhere in index.html");
});

// SPEC §6 — procedural dome clouds duck by the temple blend so the equirect map reads.
test("dome clouds are ducked by the temple blend", () => {
  const src = namedFunction("updateSky");
  assert.match(src, /cloudDuck/);
  assert.match(src, /_templeBlend/);
  assert.match(src, /updateTempleOrbs\(/, "updateSky drives the temple-orbs per-frame update");
});
