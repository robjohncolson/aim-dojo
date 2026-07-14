(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AimDojoSkyMaps = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Temple Orbs asset table (SPEC_TEMPLE_ORBS.md §4.4). Pure data + helpers, NO THREE:
  // the tests run under node with no THREE, and every mesh/TextureLoader call lives in
  // index.html. Maps are equirectangular NASA-derived visualization textures; THREE
  // SphereGeometry default UVs already match equirectangular, so no reprojection here.
  var BASE = "assets/sky/";

  // Body id -> equirectangular map path. Venus is resolved separately so the caller can
  // pick the atmosphere ("sky look", default) or the surface map.
  var PLANET_MAPS = Object.freeze({
    sun: BASE + "2k_sun.jpg",
    moon: BASE + "2k_moon.jpg",
    mercury: BASE + "2k_mercury.jpg",
    venus: BASE + "2k_venus_atmosphere.jpg",
    mars: BASE + "2k_mars.jpg",
    jupiter: BASE + "2k_jupiter.jpg",
    saturn: BASE + "2k_saturn.jpg",
    uranus: BASE + "2k_uranus.jpg",
    neptune: BASE + "2k_neptune.jpg",
    // Simple cylindrical / equirectangular 2:1 (from plutocylindrical.jpg) — SphereGeometry UVs match.
    pluto: BASE + "2k_pluto.jpg",
  });

  var VENUS_MAPS = Object.freeze({
    atmosphere: BASE + "2k_venus_atmosphere.jpg",
    surface: BASE + "2k_venus_surface.jpg",
  });

  // Inner sky shell (the milky-way band the player sits inside). The "8k" name is the
  // upstream asset label; the shipped file is ~1.9 MB — safe to load on every tier.
  var MILKY_PATH = BASE + "8k_stars_milky_way.jpg";

  // Saturn rings: an alpha strip sampled across the ring width. innerScale/outerScale are
  // multiples of the globe radius.
  var RING = Object.freeze({
    body: "saturn",
    map: BASE + "2k_saturn_ring_alpha.png",
    innerScale: 1.25,
    outerScale: 2.35,
  });

  // Bodies deliberately without a map -> glyph + HUD only (never a globe).
  var NO_MAP = Object.freeze({ north_node: true, south_node: true });

  // Midpoint 13-sign ids (incl. Ophiuchus). Art is optional drop-in under assets/sky/zodiac/{id}.jpg|.png
  // Prefer square or landscape illustration; rendered on a sky-anchored plane BEHIND the stick figure.
  var SIGN_IDS = Object.freeze([
    "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra",
    "scorpio", "ophiuchus", "sagittarius", "capricorn", "aquarius", "pisces",
  ]);
  var ZODIAC_BASE = BASE + "zodiac/";
  var SIGN_MAPS = Object.freeze(SIGN_IDS.reduce(function (acc, id) {
    acc[id] = ZODIAC_BASE + id + ".jpg";
    return acc;
  }, Object.create(null)));
  // Optional PNG override path (checked second at runtime by the loader host if desired).
  var SIGN_MAPS_PNG = Object.freeze(SIGN_IDS.reduce(function (acc, id) {
    acc[id] = ZODIAC_BASE + id + ".png";
    return acc;
  }, Object.create(null)));

  function canonicalId(value) {
    if (typeof value !== "string") return null;
    var token = value.trim().toLowerCase();
    if (token === "scorpius") token = "scorpio";
    if (token === "capricornus") token = "capricorn";
    return token || null;
  }

  // The equirectangular map path for a body id, or null when the body has no map
  // (nodes, pluto), an unknown id, or a non-string. NEVER throws — a null return is the
  // contract for "glyph-only, no globe".
  function mapForBody(bodyId, options) {
    var id = canonicalId(bodyId);
    if (!id) return null;
    if (id === "venus") {
      var mode = options && options.venusMap === "surface" ? "surface" : "atmosphere";
      return VENUS_MAPS[mode];
    }
    return Object.prototype.hasOwnProperty.call(PLANET_MAPS, id) ? PLANET_MAPS[id] : null;
  }

  function hasMap(bodyId) {
    return mapForBody(bodyId) !== null;
  }

  // Conventional path for a sign's art (jpg). Missing file → loader fails soft; no throw.
  function mapForSign(signId) {
    var id = canonicalId(signId);
    return id && Object.prototype.hasOwnProperty.call(SIGN_MAPS, id) ? SIGN_MAPS[id] : null;
  }

  function mapForSignPng(signId) {
    var id = canonicalId(signId);
    return id && Object.prototype.hasOwnProperty.call(SIGN_MAPS_PNG, id) ? SIGN_MAPS_PNG[id] : null;
  }

  function hasSignMap(signId) {
    return mapForSign(signId) !== null;
  }

  function ringForBody(bodyId) {
    return canonicalId(bodyId) === RING.body ? RING : null;
  }

  // Segment counts per quality tier for the sky shell and the planet globe (SPEC §7).
  var SEGMENTS = Object.freeze({
    desktop: Object.freeze({ shell: Object.freeze([64, 32]), globe: Object.freeze([48, 32]) }),
    mobile: Object.freeze({ shell: Object.freeze([48, 24]), globe: Object.freeze([32, 24]) }),
    low: Object.freeze({ shell: Object.freeze([32, 16]), globe: Object.freeze([24, 16]) }),
  });

  function tierName(opts) {
    if (opts && opts.low) return "low";
    if (opts && opts.mobile) return "mobile";
    return "desktop";
  }

  // { widthSegments, heightSegments } for kind 'shell' | 'globe' at the caller's tier.
  function segmentsFor(kind, opts) {
    var tier = SEGMENTS[tierName(opts)] || SEGMENTS.desktop;
    var pair = kind === "shell" ? tier.shell : tier.globe;
    return { widthSegments: pair[0], heightSegments: pair[1] };
  }

  // Shipped required assets (planets + milky + rings). Zodiac art is optional drop-in — not required on disk.
  function allAssetPaths() {
    var seen = Object.create(null);
    var out = [];
    function add(p) { if (p && !seen[p]) { seen[p] = true; out.push(p); } }
    add(MILKY_PATH);
    add(RING.map);
    Object.keys(PLANET_MAPS).forEach(function (k) { add(PLANET_MAPS[k]); });
    Object.keys(VENUS_MAPS).forEach(function (k) { add(VENUS_MAPS[k]); });
    return out;
  }

  // Conventional zodiac art paths (may not exist until the artist drops files in).
  function allSignMapPaths() {
    var out = [];
    SIGN_IDS.forEach(function (id) {
      out.push(SIGN_MAPS[id]);
      out.push(SIGN_MAPS_PNG[id]);
    });
    return out;
  }

  return Object.freeze({
    BASE: BASE,
    PLANET_MAPS: PLANET_MAPS,
    VENUS_MAPS: VENUS_MAPS,
    MILKY_PATH: MILKY_PATH,
    RING: RING,
    NO_MAP: NO_MAP,
    SIGN_IDS: SIGN_IDS,
    ZODIAC_BASE: ZODIAC_BASE,
    SIGN_MAPS: SIGN_MAPS,
    SIGN_MAPS_PNG: SIGN_MAPS_PNG,
    SEGMENTS: SEGMENTS,
    mapForBody: mapForBody,
    hasMap: hasMap,
    mapForSign: mapForSign,
    mapForSignPng: mapForSignPng,
    hasSignMap: hasSignMap,
    ringForBody: ringForBody,
    segmentsFor: segmentsFor,
    allAssetPaths: allAssetPaths,
    allSignMapPaths: allSignMapPaths,
  });
});
