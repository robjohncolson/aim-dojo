"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const maps = require("../sky-maps.js");
const root = path.join(__dirname, "..");
const compact = { textureTier: "compact" };

// Read JPEG frame dimensions from the actual shipped bytes, not the manifest.
function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, "JPEG start marker");
  let offset = 2;
  while (offset < bytes.length) {
    assert.equal(bytes[offset++], 0xff, "JPEG segment marker");
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= bytes.length, "valid JPEG segment length");
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  assert.fail("JPEG has no supported frame header");
}

function imageInfo(relative) {
  const bytes = fs.readFileSync(path.join(root, relative));
  return { ...jpegSize(bytes), bytes: bytes.length };
}

test("compact maps cover every globe and both Venus appearances without changing defaults", () => {
  for (const body of Object.keys(maps.PLANET_MAPS)) {
    const fullPath = maps.mapForBody(body);
    const compactPath = maps.mapForBody(` ${body.toUpperCase()} `, compact);
    assert.equal(fullPath, maps.PLANET_MAPS[body]);
    assert.match(compactPath, /^assets\/sky\/compact\/[a-z-]+\.jpg$/);
    assert.notEqual(compactPath, fullPath);
    assert.equal(maps.mapForBody(body, { textureTier: "unknown" }), fullPath);
    const full = imageInfo(fullPath);
    const reduced = imageInfo(compactPath);
    assert.deepEqual({ width: reduced.width, height: reduced.height }, { width: 512, height: 256 });
    assert.ok(reduced.width * reduced.height <= full.width * full.height / 16,
      `${body}: compact base texture area is at most one sixteenth of full`);
    assert.ok(reduced.bytes < full.bytes / 4, `${body}: compact download is less than one quarter of full`);
  }
  const surface = maps.mapForBody("venus", { ...compact, venusMap: "surface" });
  assert.equal(surface, "assets/sky/compact/venus-surface.jpg");
  assert.deepEqual(jpegSize(fs.readFileSync(path.join(root, surface))), { width: 512, height: 256 });
  assert.equal(maps.mapForBody("venus", { ...compact, venusMap: "invalid" }), maps.mapForBody("venus", compact));
  for (const invalid of ["north_node", "south_node", "unknown", "constructor", "__proto__", "", null, 42, {}]) {
    assert.equal(maps.mapForBody(invalid, compact), null, "unsupported bodies remain glyph-only");
  }
});

test("compact Milky Way uses a 2 MiB base RGBA8 texture and preserves the full path", () => {
  assert.equal(maps.milkyPath(), maps.MILKY_PATH);
  assert.equal(maps.milkyPath({ textureTier: "full" }), maps.MILKY_PATH);
  assert.equal(maps.milkyPath({ textureTier: "unknown" }), maps.MILKY_PATH);
  const full = imageInfo(maps.milkyPath());
  const reduced = imageInfo(maps.milkyPath(compact));
  assert.deepEqual({ width: reduced.width, height: reduced.height }, { width: 1024, height: 512 });
  assert.equal(reduced.width * reduced.height * 4, 2 * 1024 * 1024);
  assert.ok(reduced.width * reduced.height <= full.width * full.height / 9);
  assert.ok(reduced.bytes < full.bytes / 4);
});

test("tier asset lists are complete, unique and retain shared rings", () => {
  const paths = maps.allAssetPaths(compact);
  assert.equal(paths.length, new Set(paths).size);
  assert.ok(paths.includes(maps.milkyPath(compact)));
  for (const body of Object.keys(maps.PLANET_MAPS)) assert.ok(paths.includes(maps.mapForBody(body, compact)));
  assert.ok(paths.includes(maps.mapForBody("venus", { ...compact, venusMap: "surface" })));
  for (const body of ["saturn", "uranus"]) assert.ok(paths.includes(maps.ringForBody(body).map));
  for (const relative of paths) assert.ok(fs.existsSync(path.join(root, relative)), relative);
  assert.equal(paths.filter((p) => p.includes("/compact/")).length, 12);
  assert.ok(maps.allAssetPaths().every((p) => !p.includes("/compact/")), "legacy asset list stays full-size");
});

test("compact provenance manifest matches the shipped assets and retained original bytes", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/sky/compact/manifest.json"), "utf8"));
  const paths = new Set(maps.allAssetPaths(compact).filter((p) => p.endsWith(".jpg")));
  assert.equal(manifest.assets.length, paths.size);
  for (const entry of manifest.assets) {
    assert.ok(paths.delete(entry.compact.path), "each compact map is represented exactly once");
    for (const record of [entry.source, entry.compact]) {
      const bytes = fs.readFileSync(path.join(root, record.path));
      assert.equal(bytes.length, record.bytes, record.path);
      assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), record.sha256, record.path);
      assert.deepEqual(jpegSize(bytes), { width: record.width, height: record.height }, record.path);
      assert.equal(record.width, record.height * 2, "equirectangular 2:1 aspect retained");
    }
  }
  assert.equal(paths.size, 0);
});
