"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const maps = require("../sky-maps.js");

// SPEC_TEMPLE_ORBS.md §4.4 — body → equirectangular map table.
test("mapForBody returns the spec equirectangular path for every mapped body", () => {
  const expected = {
    sun: "assets/sky/2k_sun.jpg",
    moon: "assets/sky/2k_moon.jpg",
    mercury: "assets/sky/2k_mercury.jpg",
    venus: "assets/sky/2k_venus_atmosphere.jpg", // §9.5 atmosphere by default
    mars: "assets/sky/2k_mars.jpg",
    jupiter: "assets/sky/2k_jupiter.jpg",
    saturn: "assets/sky/2k_saturn.jpg",
    uranus: "assets/sky/2k_uranus.jpg",
    neptune: "assets/sky/2k_neptune.jpg",
  };
  for (const [body, rel] of Object.entries(expected)) {
    assert.equal(maps.mapForBody(body), rel, `${body} → ${rel}`);
    assert.equal(maps.hasMap(body), true, `${body} hasMap`);
  }
});

test("Venus resolves atmosphere by default and surface on request", () => {
  assert.equal(maps.mapForBody("venus"), "assets/sky/2k_venus_atmosphere.jpg");
  assert.equal(maps.mapForBody("venus", { venusMap: "atmosphere" }), "assets/sky/2k_venus_atmosphere.jpg");
  assert.equal(maps.mapForBody("venus", { venusMap: "surface" }), "assets/sky/2k_venus_surface.jpg");
});

test("body ids are canonicalized (case + surrounding whitespace)", () => {
  assert.equal(maps.mapForBody(" MARS "), "assets/sky/2k_mars.jpg");
  assert.equal(maps.mapForBody("Jupiter"), "assets/sky/2k_jupiter.jpg");
});

// Pluto ships as equirect/simple-cylindrical 2:1 (from plutocylindrical.jpg).
test("pluto maps to the shipped 2k equirect texture", () => {
  assert.equal(maps.mapForBody("pluto"), "assets/sky/2k_pluto.jpg");
  assert.equal(maps.hasMap("pluto"), true);
});

// SPEC §9.6 / §9.8 — unsupported/missing body returns null, NEVER throws.
test("unsupported or invalid bodies return null without throwing", () => {
  for (const body of ["north_node", "south_node", "unknown", "", "   ", "sunny"]) {
    assert.equal(maps.mapForBody(body), null, `${JSON.stringify(body)} → null`);
    assert.equal(maps.hasMap(body), false);
  }
  for (const junk of [null, undefined, 42, {}, [], NaN, true]) {
    assert.equal(maps.mapForBody(junk), null, `${String(junk)} → null`);
  }
});

// SPEC §9.4 — Saturn rings; Uranus also ships a faint sideways ring set.
test("Saturn and Uranus have ring maps; other bodies do not", () => {
  assert.equal(maps.RING.map, "assets/sky/2k_saturn_ring_alpha.png");
  assert.ok(maps.ringForBody("saturn"), "saturn has a ring");
  const u = maps.ringForBody("uranus");
  assert.ok(u, "uranus has a ring");
  assert.equal(u.map, "assets/sky/2k_uranus_ring_alpha.png");
  assert.ok(u.tiltX > 1.2, "uranus axis is roughly on its side (~90°)");
  assert.equal(maps.ringForBody("mars"), null);
  assert.equal(maps.ringForBody("jupiter"), null);
  assert.ok(maps.RING.outerScale > maps.RING.innerScale, "ring outer > inner");
});

test("milky-way shell path is the shipped equirectangular starfield", () => {
  assert.equal(maps.MILKY_PATH, "assets/sky/8k_stars_milky_way.jpg");
});

// SPEC §9.9 — never wire the ~15MB 8k mercury.
test("the table never references 8k_mercury", () => {
  const all = maps.allAssetPaths().join("\n");
  assert.ok(!/8k_mercury/.test(all), "no 8k_mercury path in the table");
});

// SPEC §7 — per-tier segment counts, lower on LOW/MOBILE.
test("segmentsFor scales down for mobile and low tiers", () => {
  const dShell = maps.segmentsFor("shell", {});
  const mShell = maps.segmentsFor("shell", { mobile: true });
  const lShell = maps.segmentsFor("shell", { low: true });
  assert.ok(dShell.widthSegments >= mShell.widthSegments, "desktop ≥ mobile shell");
  assert.ok(mShell.widthSegments >= lShell.widthSegments, "mobile ≥ low shell");
  assert.ok(lShell.widthSegments >= 8 && lShell.heightSegments >= 4, "low shell still renders");
  assert.deepEqual(maps.segmentsFor("shell", { low: true, mobile: true }), lShell, "low wins over mobile");
  const dGlobe = maps.segmentsFor("globe", {});
  const lGlobe = maps.segmentsFor("globe", { low: true });
  assert.ok(dGlobe.widthSegments >= lGlobe.widthSegments, "desktop ≥ low globe");
});

// SPEC §9.1 / §9.10 — every referenced asset is present on disk (tracked, not gitignored).
test("every referenced map exists on disk", () => {
  for (const rel of maps.allAssetPaths()) {
    const abs = path.join(__dirname, "..", rel);
    assert.ok(fs.existsSync(abs), `missing asset: ${rel}`);
  }
});

// Zodiac art paths are conventional drop-ins (optional on disk — not required assets).
test("mapForSign covers all 13 Midpoint signs under assets/sky/zodiac/", () => {
  assert.equal(maps.SIGN_IDS.length, 13);
  assert.ok(maps.SIGN_IDS.includes("ophiuchus"));
  for (const id of maps.SIGN_IDS) {
    assert.equal(maps.mapForSign(id), `assets/sky/zodiac/${id}.jpg`);
    assert.equal(maps.mapForSignPng(id), `assets/sky/zodiac/${id}.png`);
    assert.equal(maps.hasSignMap(id), true);
  }
  assert.equal(maps.mapForSign("scorpius"), "assets/sky/zodiac/scorpio.jpg", "scorpius alias");
  assert.equal(maps.mapForSign("capricornus"), "assets/sky/zodiac/capricorn.jpg", "capricornus alias");
  assert.equal(maps.mapForSign("not-a-sign"), null);
  // Optional drop-ins: allSignMapPaths must NOT force the required-asset disk check.
  const required = new Set(maps.allAssetPaths());
  for (const p of maps.allSignMapPaths()) {
    assert.ok(!required.has(p), `zodiac path ${p} must stay optional`);
  }
});

// Midpoint spans size the always-on art belt (days of year ∝ lengthDeg).
test("SIGN_SPANS drive mid longitudes, days, and non-overlapping art angles", () => {
  let sum = 0;
  for (const id of maps.SIGN_IDS) {
    const span = maps.signSpan(id);
    assert.ok(span, id);
    sum += span.lengthDeg;
    const mid = maps.midLonForSign(id);
    assert.ok(mid >= 0 && mid < 360, `${id} mid in range`);
    const days = maps.daysForSign(id);
    assert.ok(days > 0 && days < 60, `${id} days sane`);
    // art angular width proportional to span but strictly under the sign's own length
    const ang = maps.artAngularDegForSign(id, { fill: 0.62 });
    assert.ok(ang > 0 && ang < span.lengthDeg, `${id} art under span`);
  }
  assert.ok(Math.abs(sum - 360) < 0.02, "Midpoint lengths sum to 360°");
  // Virgo longest, Ophiuchus among shortest → art sizes preserve order
  assert.ok(
    maps.artAngularDegForSign("virgo") > maps.artAngularDegForSign("ophiuchus"),
    "longer signs get larger art"
  );
  // Neighbor half-widths do not exceed half the mid-to-mid gap (no clip along ecliptic)
  for (let i = 0; i < maps.SIGN_IDS.length; i++) {
    const a = maps.SIGN_IDS[i];
    const b = maps.SIGN_IDS[(i + 1) % maps.SIGN_IDS.length];
    const sa = maps.signSpan(a);
    const sb = maps.signSpan(b);
    const gap = (sa.lengthDeg + sb.lengthDeg) / 2;
    const half = maps.artAngularDegForSign(a) / 2 + maps.artAngularDegForSign(b) / 2;
    assert.ok(half < gap * 0.98, `${a}/${b} art halves under mid-gap`);
  }
});
