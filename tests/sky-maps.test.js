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

// SPEC §9.4 — Saturn is the only ringed body.
test("Saturn ring alpha map is the only ring", () => {
  assert.equal(maps.RING.map, "assets/sky/2k_saturn_ring_alpha.png");
  assert.ok(maps.ringForBody("saturn"), "saturn has a ring");
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
