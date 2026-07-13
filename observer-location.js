(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AimDojoObserver = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const KEYS = Object.freeze({
    lat: "aimdojo.observerLat",
    lon: "aimdojo.observerLon",
    source: "aimdojo.observerSource",
    updatedAt: "aimdojo.observerUpdatedAt",
    geoTried: "aimdojo.observerGeoTried",
  });
  const SOURCES = Object.freeze(["geo", "manual", "default"]);

  function coordinate(value, min, max) {
    if (typeof value === "string" && value.trim() === "") return null;
    const number = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(number) || number < min || number > max) return null;
    return Object.is(number, -0) ? 0 : number;
  }

  function normalizeObserver(value) {
    if (!value || typeof value !== "object") return null;
    const lat = coordinate(value.lat, -90, 90);
    const lon = coordinate(value.lon, -180, 180);
    const source = typeof value.source === "string" ? value.source : "";
    const updatedAt = Number(value.updatedAt);
    if (lat === null || lon === null || !SOURCES.includes(source)) return null;
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
    return Object.freeze({ lat, lon, source, updatedAt: Math.trunc(updatedAt) });
  }

  function readObserver(storage) {
    if (!storage || typeof storage.getItem !== "function") return null;
    try {
      return normalizeObserver({
        lat: storage.getItem(KEYS.lat),
        lon: storage.getItem(KEYS.lon),
        source: storage.getItem(KEYS.source),
        updatedAt: storage.getItem(KEYS.updatedAt),
      });
    } catch (_error) {
      return null;
    }
  }

  function saveObserver(storage, value) {
    const observer = normalizeObserver(value);
    if (!observer) throw new RangeError("Invalid observer location");
    if (!storage || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
      throw new TypeError("Observer storage is unavailable");
    }
    // Invalidate the record first and commit updatedAt last. If storage fills or
    // becomes unavailable mid-write, the next read fails closed instead of mixing
    // a new coordinate with an older still-valid timestamp.
    storage.removeItem(KEYS.updatedAt);
    storage.setItem(KEYS.lat, String(observer.lat));
    storage.setItem(KEYS.lon, String(observer.lon));
    storage.setItem(KEYS.source, observer.source);
    storage.setItem(KEYS.updatedAt, String(observer.updatedAt));
    return observer;
  }

  function hasGeoTried(storage) {
    try {
      return !!storage && storage.getItem(KEYS.geoTried) === "1";
    } catch (_error) {
      return false;
    }
  }

  function markGeoTried(storage) {
    try {
      if (storage && typeof storage.setItem === "function") storage.setItem(KEYS.geoTried, "1");
    } catch (_error) {}
  }

  return Object.freeze({
    KEYS,
    SOURCES,
    coordinate,
    normalizeObserver,
    readObserver,
    saveObserver,
    hasGeoTried,
    markGeoTried,
  });
});
