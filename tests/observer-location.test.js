"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const observerPrefs = require("../observer-location.js");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

test("observer coordinates accept only finite latitude/longitude ranges", () => {
  assert.equal(observerPrefs.coordinate("38.0406", -90, 90), 38.0406);
  assert.equal(observerPrefs.coordinate("-84.5037", -180, 180), -84.5037);
  assert.equal(observerPrefs.coordinate(-90, -90, 90), -90);
  assert.equal(observerPrefs.coordinate(180, -180, 180), 180);

  for (const invalid of ["", "  ", "north", Infinity, -Infinity, NaN, "1e9999"]) {
    assert.equal(observerPrefs.coordinate(invalid, -90, 90), null);
  }
  assert.equal(observerPrefs.coordinate(90.0001, -90, 90), null);
  assert.equal(observerPrefs.coordinate(-180.0001, -180, 180), null);
});

test("observer storage round-trips only the local model fields", () => {
  const storage = memoryStorage();
  const saved = observerPrefs.saveObserver(storage, {
    lat: 38.0406,
    lon: -84.5037,
    source: "manual",
    updatedAt: 1_789_000_000_123,
    email: "must-not-persist@example.com",
  });

  assert.deepEqual(saved, {
    lat: 38.0406,
    lon: -84.5037,
    source: "manual",
    updatedAt: 1_789_000_000_123,
  });
  assert.ok(Object.isFrozen(saved));
  assert.deepEqual(storage.snapshot(), {
    "aimdojo.observerLat": "38.0406",
    "aimdojo.observerLon": "-84.5037",
    "aimdojo.observerSource": "manual",
    "aimdojo.observerUpdatedAt": "1789000000123",
  });
  assert.deepEqual(observerPrefs.readObserver(storage), saved);
});

test("partial or corrupted observer preferences fail closed to no location", () => {
  const keys = observerPrefs.KEYS;
  assert.equal(observerPrefs.readObserver(memoryStorage({
    [keys.lat]: "38",
    [keys.source]: "manual",
    [keys.updatedAt]: "123",
  })), null);
  assert.equal(observerPrefs.readObserver(memoryStorage({
    [keys.lat]: "91",
    [keys.lon]: "-84.5",
    [keys.source]: "manual",
    [keys.updatedAt]: "123",
  })), null);
  assert.throws(() => observerPrefs.saveObserver(memoryStorage(), {
    lat: 38,
    lon: -84.5,
    source: "remote",
    updatedAt: 123,
  }), /Invalid observer location/);
});

test("an interrupted observer write cannot leave a mixed record valid", () => {
  const keys = observerPrefs.KEYS;
  const backing = memoryStorage({
    [keys.lat]: "40",
    [keys.lon]: "-75",
    [keys.source]: "geo",
    [keys.updatedAt]: "100",
  });
  let writes = 0;
  const interrupted = {
    getItem: backing.getItem,
    removeItem: backing.removeItem,
    setItem(key, value) {
      writes += 1;
      if (writes === 3) throw new Error("quota");
      backing.setItem(key, value);
    },
  };

  assert.throws(() => observerPrefs.saveObserver(interrupted, {
    lat: 38,
    lon: -84.5,
    source: "manual",
    updatedAt: 200,
  }), /quota/);
  assert.equal(observerPrefs.readObserver(interrupted), null);
  assert.equal(backing.snapshot()[keys.updatedAt], undefined);
});

test("the automatic geolocation attempt has a persistent one-shot guard", () => {
  const storage = memoryStorage();
  assert.equal(observerPrefs.hasGeoTried(storage), false);
  observerPrefs.markGeoTried(storage);
  assert.equal(observerPrefs.hasGeoTried(storage), true);
  assert.equal(storage.snapshot()["aimdojo.observerGeoTried"], "1");
});

test("a stored location that disagrees with the device time zone is recognised as stale", () => {
  const boston = { lat: 42.36, lon: -71.06, source: "geo", updatedAt: 100 };
  const tokyoOffsetMin = -540;   // JST: getTimezoneOffset() === -540
  const bostonEdtOffsetMin = 240; // EDT: +240
  assert.equal(observerPrefs.timezoneDisagrees(boston, tokyoOffsetMin), true, "Boston record on a JST device");
  assert.equal(observerPrefs.timezoneDisagrees(boston, bostonEdtOffsetMin), false, "Boston record at home");
  const kashgar = { lat: 39.47, lon: 75.99, source: "geo", updatedAt: 100 };
  assert.equal(observerPrefs.timezoneDisagrees(kashgar, -480), false, "western China on UTC+8 stays inside the tolerance");
  const kiritimati = { lat: 1.87, lon: -157.4, source: "geo", updatedAt: 100 };
  assert.equal(observerPrefs.timezoneDisagrees(kiritimati, -840), false, "UTC+14 vs longitude -157 wraps around the date line");
  assert.equal(observerPrefs.timezoneDisagrees(null, -540), false, "no record is never stale");
  assert.equal(observerPrefs.timezoneDisagrees(boston, NaN), false, "an unknown device offset never invalidates");
});

test("clearing the observer forgets the record and re-arms the one-shot geo attempt", () => {
  const storage = memoryStorage();
  observerPrefs.saveObserver(storage, { lat: 42.36, lon: -71.06, source: "geo", updatedAt: 100 });
  observerPrefs.markGeoTried(storage);
  assert.ok(observerPrefs.readObserver(storage));
  assert.equal(observerPrefs.clearObserver(storage), true);
  assert.equal(observerPrefs.readObserver(storage), null);
  assert.equal(observerPrefs.hasGeoTried(storage), false);
});
