"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const temple = require("../sky-temple.js");

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", name), "utf8"));
}

function approx(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected} ± ${tolerance}, received ${actual}`
  );
}

test("v2 skypack aspects merge ranked order with resonance motion and placement data", () => {
  const pack = fixture("fixtures/skypack_mock.json");
  pack.schema_version = 2;
  pack.projection = "ecliptic_band_v2";
  pack.resonance_rank = [...pack.resonances]
    .sort((left, right) =>
      left.orb / left.orb_limit - right.orb / right.orb_limit ||
      left.transit_body.localeCompare(right.transit_body) ||
      left.natal_point.localeCompare(right.natal_point) ||
      left.aspect_id.localeCompare(right.aspect_id)
    )
    .map((row, index) => ({
      transit_body: row.transit_body,
      natal_point: row.natal_point,
      aspect_id: row.aspect_id,
      aspect_glyph: row.aspect_glyph,
      orb: row.orb,
      orb_limit: row.orb_limit,
      rank: index + 1,
    }));
  const records = temple.normalizeAspectRecords(pack, { maxLines: 3 });

  assert.deepEqual(records.map((record) => record.key), [
    "sun|moon|conjunction",
    "mars|mercury|square",
    "venus|jupiter|opposition",
  ]);
  assert.deepEqual(records.map((record) => record.rank), [1, 2, 3]);
  assert.deepEqual(records.map((record) => record.sourceRank), [1, 2, 3]);

  const first = records[0];
  approx(first.orbDeg, 0.2);
  approx(first.normalizedOrb, first.orbDeg / first.orbLimitDeg);
  approx(first.tightness, 1 - first.normalizedOrb);
  assert.equal(first.motionLabel, "applying");
  assert.equal(first.transit.label, "Sun");
  assert.equal(first.transit.signLabel, "Gemini");
  assert.equal(first.transit.retro, false);
  assert.equal(first.natal.label, "Moon");
  assert.equal(first.natal.signLabel, "Gemini");
});

test("v1 skypack falls back to deterministic normalized-orb sorting", () => {
  const records = temple.normalizeAspectRecords(fixture("fixtures/skypack_mock.json"), 10);

  assert.deepEqual(records.map((record) => record.key), [
    "sun|moon|conjunction",
    "mars|mercury|square",
    "venus|jupiter|opposition",
    "moon|sun|conjunction",
    "saturn|north_node|sextile",
    "jupiter|pluto|trine",
  ]);
  assert.equal(records[0].sourceRank, null);
  assert.equal(records[0].motionLabel, "applying");
  assert.equal(records[2].applying, null);
  assert.equal(records[2].motionLabel, null);
  assert.equal(records[3].motionLabel, "separating");
});

test("aspect normalization enforces the configured and hard draw caps", () => {
  const pack = fixture("fixtures/skypack_mock.json");
  const ids = ["conjunction", "opposition", "trine", "square", "sextile"];
  const glyphs = { conjunction: "☌", opposition: "☍", trine: "△", square: "□", sextile: "⚹" };
  pack.resonances = [];
  for (const mover of pack.movers) {
    for (const natal of pack.natal_ghosts) {
      if (pack.resonances.length >= 30) break;
      const aspectId = ids[pack.resonances.length % ids.length];
      pack.resonances.push({
        transit_body: mover.id,
        natal_point: natal.id,
        aspect_id: aspectId,
        aspect_glyph: glyphs[aspectId],
        separation: 60,
        orb: 0.1 + pack.resonances.length * 0.01,
        orb_limit: 8,
        applying: null,
      });
    }
    if (pack.resonances.length >= 30) break;
  }
  assert.equal(temple.normalizeAspectRecords(pack, { maxLines: 5 }).length, 5);
  assert.equal(temple.normalizeAspectRecords(pack, { maxLines: 999 }).length, 24);
  assert.equal(temple.normalizeAspectRecords(pack, { maxLines: 0 }).length, 0);
  assert.equal(
    temple.normalizeAspectRecords({ type: "skyday", privacy: "public", movers: pack.movers, natal_ghosts: pack.natal_ghosts, resonances: pack.resonances }).length,
    0,
    "public sky cannot mint transit-to-natal lines even from malformed look-alike rows"
  );
});

test("closed labels and numeric validation make body and aspect panel data safe", () => {
  const pack = {
    type: "skypack",
    privacy: "local_only",
    movers: [{
      id: "mars",
      name: "<unsafe transit name>",
      glyph: "<unsafe glyph>",
      lon_j2000: 10,
      sign: "gemini",
      degree_in_sign: 12.34,
      retro: true,
    }],
    natal_ghosts: [{
      id: "moon",
      name: "<unsafe natal name>",
      glyph: "<unsafe glyph>",
      lon_j2000: 100,
      sign: "virgo",
      degree_in_sign: 8.76,
      house: 4,
    }],
    resonances: [
      { transit_body: "mars", natal_point: "moon", aspect_id: "square", orb: 1.2, orb_limit: 7, applying: true },
      { transit_body: "mars", natal_point: "moon", aspect_id: "square", orb: 0.6, orb_limit: 7, applying: false },
      { transit_body: "mars", natal_point: "moon", aspect_id: "invented", orb: 0.1, orb_limit: 7, applying: true },
      { transit_body: "mars", natal_point: "moon", aspect_id: "trine", orb: Infinity, orb_limit: 7, applying: true },
      { transit_body: "mars", natal_point: "moon", aspect_id: "sextile", orb: 8, orb_limit: 7, applying: true },
    ],
    resonance_rank: [{ transit_body: "mars", natal_point: "moon", aspect_id: "square", rank: 9 }],
    natal_id: "must-not-enter-panel-data",
    location: { lat: 38, lon: -84.5 },
  };

  const records = temple.normalizeAspectRecords(pack);
  assert.equal(records.length, 1, "duplicate identity keeps only its tightest valid record");
  const record = records[0];
  assert.equal(record.orbDeg, 0.6);
  assert.equal(record.transit.label, "Mars");
  assert.equal(record.transit.glyph, "♂");
  assert.equal(record.natal.label, "Moon");
  assert.equal(record.natal.glyph, "☽");
  assert.equal(record.sourceRank, 9);

  const transitPanel = temple.bodyPanelData(record.transit);
  assert.deepEqual(transitPanel, {
    kind: "transit",
    title: "♂ Mars",
    placement: "Gemini · 12.3° · Rx",
  });
  assert.deepEqual(temple.bodyPanelData(record.natal), {
    kind: "natal",
    title: "☽ Moon (natal)",
    placement: "Virgo · 8.8° · house 4",
  });
  assert.deepEqual(temple.aspectPanelData(record), {
    kind: "aspect",
    title: "Transit Mars square natal Moon",
    detail: "orb 0.6° · separating",
    transitPlacement: "Gemini · 12.3° · Rx",
    natalPlacement: "Virgo · 8.8° · house 4",
    rank: 1,
  });

  const panelJson = JSON.stringify(temple.aspectPanelData(record));
  assert.doesNotMatch(panelJson, /unsafe|natal_id|latitude|longitude|38|-84\.5/);

  const forged = temple.aspectPanelData({
    ...record,
    aspectLabel: "<unsafe aspect>",
    transit: { ...record.transit, label: "<unsafe transit>", signLabel: "<unsafe sign>" },
    natal: { ...record.natal, label: "<unsafe natal>" },
  });
  assert.equal(forged.title, "Transit Mars square natal Moon");
  assert.doesNotMatch(JSON.stringify(forged), /unsafe/);
});

test("body normalization canonicalizes legacy signs and omits invalid optional values", () => {
  const natal = temple.normalizeBodyRecord({
    id: "sun",
    lon_j2000: -1,
    sign: "scorpius",
    degree_in_sign: Infinity,
    house: 13,
  }, "natal");
  assert.equal(natal.lonJ2000, 359);
  assert.equal(natal.sign, "scorpio");
  assert.equal(natal.signLabel, "Scorpio");
  assert.equal(natal.degreeInSign, null);
  assert.equal(natal.house, null);
  assert.equal(temple.normalizeBodyRecord({ id: "unknown", lon_j2000: 0 }, "transit"), null);
  const offlineSun = temple.normalizeBodyRecord({ id: "sun", lon_j2000: 123.46 }, "transit");
  assert.equal(temple.bodyPanelData(offlineSun).placement, "ecliptic 123.5°");
});

test("Sky Chat focus snapshots contain only canonical server selectors", () => {
  const aspect = temple.skyChatFocusSnapshot({
    kind: "aspect",
    record: {
      transit: { id: "Mars", label: "private display label", lonJ2000: 12 },
      natal: { id: "Moon", house: 4 },
      aspectId: "Square",
      orbDeg: 0.4,
    },
  });
  assert.deepEqual(aspect, {
    kind: "aspect",
    body: "mars",
    natal_point: "moon",
    aspect_id: "square",
  });
  assert.deepEqual(
    temple.skyChatFocusSnapshot({ kind: "natal", id: "Sun", body: { house: 9 } }),
    { kind: "natal", natal_point: "sun" }
  );
  assert.deepEqual(
    temple.skyChatFocusSnapshot({ kind: "body", pick: { id: "Venus", meta: { lon: 44 } } }),
    { kind: "body", body: "venus" }
  );
  assert.deepEqual(
    temple.skyChatFocusSnapshot({ kind: "sign", pick: { id: "Scorpius", meta: { lon: 220 } } }),
    { kind: "sign", sign: "scorpio" }
  );
  assert.deepEqual(
    temple.skyChatFocusSnapshot(undefined, { kind: "body", id: "Jupiter", world: { x: 1 } }),
    { kind: "body", body: "jupiter" }
  );
  assert.deepEqual(
    temple.skyChatFocusSnapshot(null, { kind: "body", id: "Jupiter" }),
    { kind: "sky" }
  );
  assert.deepEqual(temple.skyChatFocusSnapshot({ kind: "aspect", record: {} }, null), { kind: "sky" });
  assert.doesNotMatch(JSON.stringify(aspect), /label|lon|orb|house|private/i);
});

test("ray-to-segment distance handles intersection, parallel, behind, and point segments", () => {
  const intersection = temple.rayToSegment(
    [0, 0, 0],
    [0, 0, 10],
    [-2, 0, 5],
    [2, 0, 5]
  );
  approx(intersection.distance, 0);
  approx(intersection.rayT, 5);
  approx(intersection.segmentT, 0.5);

  const parallel = temple.rayToSegment(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 2 },
    { x: 1, y: 0, z: 7 }
  );
  approx(parallel.distance, 1);
  approx(parallel.rayT, 2);

  const behind = temple.rayToSegment([0, 0, 0], [0, 0, 1], [-1, 0, -2], [1, 0, -2]);
  approx(behind.distance, 2);
  approx(behind.rayT, 0);

  const point = temple.rayToSegment([0, 0, 0], [0, 0, 1], [1, 0, 4], [1, 0, 4]);
  approx(point.distance, 1);
  approx(point.rayT, 4);
  assert.equal(temple.rayToSegment([0, 0, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1]), null);
});

test("segment picking respects the reticle threshold and returns the closest line", () => {
  const segments = [
    { id: "near-ray", start: [0.3, 0, 4], end: [0.3, 0, 6] },
    { id: "closest-ray", start: [0.1, 0, 8], end: [0.1, 0, 10] },
    { id: "behind", start: [-1, 0, -3], end: [1, 0, -3] },
  ];
  assert.equal(temple.pickRaySegment([0, 0, 0], [0, 0, 1], segments, 0.05), null);
  const hit = temple.pickRaySegment([0, 0, 0], [0, 0, 1], segments, 0.2);
  assert.equal(hit.index, 1);
  assert.equal(hit.segment.id, "closest-ray");
  approx(hit.distance, 0.1);
  approx(hit.rayT, 8);
});
