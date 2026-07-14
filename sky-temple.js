(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AimDojoSkyTemple = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_MAX_ASPECT_LINES = 24;
  var HARD_MAX_ASPECT_LINES = 24;
  var EPSILON = 1e-12;

  // Display strings are closed over the skypack contract. Pack-provided labels
  // never reach temple chrome, so malformed/private input cannot inject markup.
  var BODY_INFO = Object.freeze({
    sun: Object.freeze({ label: "Sun", glyph: "☉" }),
    moon: Object.freeze({ label: "Moon", glyph: "☽" }),
    mercury: Object.freeze({ label: "Mercury", glyph: "☿" }),
    venus: Object.freeze({ label: "Venus", glyph: "♀" }),
    mars: Object.freeze({ label: "Mars", glyph: "♂" }),
    jupiter: Object.freeze({ label: "Jupiter", glyph: "♃" }),
    saturn: Object.freeze({ label: "Saturn", glyph: "♄" }),
    uranus: Object.freeze({ label: "Uranus", glyph: "♅" }),
    neptune: Object.freeze({ label: "Neptune", glyph: "♆" }),
    pluto: Object.freeze({ label: "Pluto", glyph: "♇" }),
    north_node: Object.freeze({ label: "North Node", glyph: "☊" }),
    south_node: Object.freeze({ label: "South Node", glyph: "☋" }),
  });

  var ASPECT_INFO = Object.freeze({
    conjunction: Object.freeze({ label: "conjunction", glyph: "☌" }),
    opposition: Object.freeze({ label: "opposition", glyph: "☍" }),
    trine: Object.freeze({ label: "trine", glyph: "△" }),
    square: Object.freeze({ label: "square", glyph: "□" }),
    sextile: Object.freeze({ label: "sextile", glyph: "⚹" }),
  });

  var SIGN_LABELS = Object.freeze({
    aries: "Aries",
    taurus: "Taurus",
    gemini: "Gemini",
    cancer: "Cancer",
    leo: "Leo",
    virgo: "Virgo",
    libra: "Libra",
    scorpio: "Scorpio",
    ophiuchus: "Ophiuchus",
    sagittarius: "Sagittarius",
    capricorn: "Capricorn",
    aquarius: "Aquarius",
    pisces: "Pisces",
  });

  function canonicalToken(value, maxLength) {
    if (typeof value !== "string" || value.length > maxLength) return null;
    var token = value.trim().toLowerCase();
    return token || null;
  }

  function canonicalBody(value) {
    var token = canonicalToken(value, 32);
    return token && Object.prototype.hasOwnProperty.call(BODY_INFO, token) ? token : null;
  }

  function canonicalAspect(value) {
    var token = canonicalToken(value, 32);
    return token && Object.prototype.hasOwnProperty.call(ASPECT_INFO, token) ? token : null;
  }

  function canonicalSign(value) {
    var token = canonicalToken(value, 32);
    if (token === "scorpius") token = "scorpio";
    if (token === "capricornus") token = "capricorn";
    return token && Object.prototype.hasOwnProperty.call(SIGN_LABELS, token) ? token : null;
  }

  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function wrapDegrees(value) {
    var number = finiteNumber(value);
    return number === null ? null : ((number % 360) + 360) % 360;
  }

  function optionalDegree(value) {
    var number = finiteNumber(value);
    return number !== null && number >= 0 && number <= 360 ? number : null;
  }

  function optionalHouse(raw) {
    var value = raw && raw.house !== undefined ? raw.house : raw && raw.natal_house;
    var number = finiteNumber(value);
    return number !== null && Number.isInteger(number) && number >= 1 && number <= 12 ? number : null;
  }

  function normalizeBodyRecord(raw, kind) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    if (kind !== "transit" && kind !== "natal") return null;
    var id = canonicalBody(raw.id);
    var lonJ2000 = wrapDegrees(raw.lon_j2000);
    if (!id || lonJ2000 === null) return null;
    var info = BODY_INFO[id];
    var sign = canonicalSign(raw.sign);
    return {
      kind: kind,
      key: kind + ":" + id,
      id: id,
      label: info.label,
      glyph: info.glyph,
      lonJ2000: lonJ2000,
      sign: sign,
      signLabel: sign ? SIGN_LABELS[sign] : null,
      degreeInSign: optionalDegree(raw.degree_in_sign),
      retro: kind === "transit" && typeof raw.retro === "boolean" ? raw.retro : null,
      house: kind === "natal" ? optionalHouse(raw) : null,
    };
  }

  function indexBodies(rows, kind) {
    var result = Object.create(null);
    if (!Array.isArray(rows)) return result;
    for (var index = 0; index < rows.length; index += 1) {
      var body = normalizeBodyRecord(rows[index], kind);
      if (body && !result[body.id]) result[body.id] = body;
    }
    return result;
  }

  function aspectKey(transitBody, natalPoint, aspectId) {
    return transitBody + "|" + natalPoint + "|" + aspectId;
  }

  function rankedSourceMap(rows) {
    var result = Object.create(null);
    if (!Array.isArray(rows)) return result;
    for (var index = 0; index < rows.length; index += 1) {
      var raw = rows[index];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      var transitBody = canonicalBody(raw.transit_body);
      var natalPoint = canonicalBody(raw.natal_point);
      var aspectId = canonicalAspect(raw.aspect_id);
      var rank = finiteNumber(raw.rank);
      if (!transitBody || !natalPoint || !aspectId || rank === null || !Number.isInteger(rank) || rank < 1) continue;
      var key = aspectKey(transitBody, natalPoint, aspectId);
      if (result[key] === undefined || rank < result[key]) result[key] = rank;
    }
    return result;
  }

  function normalizeMaxLines(options) {
    var raw = typeof options === "number" ? options : options && options.maxLines;
    if (raw === undefined || raw === null) return DEFAULT_MAX_ASPECT_LINES;
    var number = finiteNumber(raw);
    if (number === null) return DEFAULT_MAX_ASPECT_LINES;
    return Math.max(0, Math.min(HARD_MAX_ASPECT_LINES, Math.floor(number)));
  }

  function normalizeAspectRecord(raw, movers, natalGhosts, sourceRanks, sourceIndex) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var transitId = canonicalBody(raw.transit_body);
    var natalId = canonicalBody(raw.natal_point);
    var aspectId = canonicalAspect(raw.aspect_id);
    var transit = transitId && movers[transitId];
    var natal = natalId && natalGhosts[natalId];
    if (!transit || !natal || !aspectId) return null;

    var orb = finiteNumber(raw.orb);
    var orbLimit = finiteNumber(raw.orb_limit);
    if (orb === null || orbLimit === null || orb < 0 || orbLimit <= 0 || orb > orbLimit) return null;
    var separation = finiteNumber(raw.separation);
    if (separation === null || separation < 0 || separation > 180) separation = null;
    var applying = typeof raw.applying === "boolean" ? raw.applying : null;
    var normalizedOrb = orb / orbLimit;
    var key = aspectKey(transitId, natalId, aspectId);
    var aspect = ASPECT_INFO[aspectId];

    return {
      kind: "aspect",
      key: key,
      transit: transit,
      natal: natal,
      aspectId: aspectId,
      aspectLabel: aspect.label,
      aspectGlyph: aspect.glyph,
      separationDeg: separation,
      orbDeg: orb,
      orbLimitDeg: orbLimit,
      normalizedOrb: normalizedOrb,
      tightness: Math.max(0, Math.min(1, 1 - normalizedOrb)),
      applying: applying,
      motionLabel: applying === true ? "applying" : applying === false ? "separating" : null,
      sourceRank: sourceRanks[key] === undefined ? null : sourceRanks[key],
      sourceIndex: sourceIndex,
    };
  }

  function compareAspects(left, right) {
    return (
      left.normalizedOrb - right.normalizedOrb ||
      (left.transit.id < right.transit.id ? -1 : left.transit.id > right.transit.id ? 1 : 0) ||
      (left.natal.id < right.natal.id ? -1 : left.natal.id > right.natal.id ? 1 : 0) ||
      (left.aspectId < right.aspectId ? -1 : left.aspectId > right.aspectId ? 1 : 0) ||
      left.sourceIndex - right.sourceIndex
    );
  }

  function normalizeAspectRecords(pack, options) {
    var maxLines = normalizeMaxLines(options);
    if (!pack || typeof pack !== "object" || Array.isArray(pack) || maxLines === 0) return [];
    // A public skyday deliberately carries empty personal arrays. Requiring the
    // private skypack envelope prevents accidental lines if a malformed public
    // response ever includes look-alike rows.
    if (pack.type !== "skypack" || (pack.privacy !== "local_only" && pack.privacy !== "user_private")) return [];
    var movers = indexBodies(pack.movers, "transit");
    var natalGhosts = indexBodies(pack.natal_ghosts, "natal");
    var sourceRanks = rankedSourceMap(pack.resonance_rank);
    var rows = Array.isArray(pack.resonances) ? pack.resonances : [];
    var unique = Object.create(null);

    for (var index = 0; index < rows.length; index += 1) {
      var record = normalizeAspectRecord(rows[index], movers, natalGhosts, sourceRanks, index);
      if (!record) continue;
      var prior = unique[record.key];
      if (!prior || compareAspects(record, prior) < 0) unique[record.key] = record;
    }

    var records = Object.keys(unique).map(function (key) { return unique[key]; });
    records.sort(compareAspects);
    return records.slice(0, maxLines).map(function (record, index) {
      var clean = Object.assign({}, record, { rank: index + 1 });
      delete clean.sourceIndex;
      return clean;
    });
  }

  function fixedDegree(value, digits) {
    var number = finiteNumber(value);
    if (number === null) return null;
    var places = finiteNumber(digits);
    places = places === null ? 1 : Math.max(0, Math.min(2, Math.floor(places)));
    return number.toFixed(places) + "°";
  }

  function placementText(body, options) {
    if (!body || typeof body !== "object") return "";
    var parts = [];
    var sign = canonicalSign(body.sign);
    if (sign) parts.push(SIGN_LABELS[sign]);
    var degree = fixedDegree(optionalDegree(body.degreeInSign), options && options.digits);
    if (degree) parts.push(degree);
    if (!sign && !degree) {
      var longitude = fixedDegree(wrapDegrees(body.lonJ2000), options && options.digits);
      if (longitude) parts.push("ecliptic " + longitude);
    }
    if (body.kind === "transit" && body.retro === true) parts.push("Rx");
    var house = optionalHouse(body);
    if (body.kind === "natal" && house !== null) parts.push("house " + house);
    return parts.join(" · ");
  }

  function bodyPanelData(body, options) {
    if (!body || (body.kind !== "transit" && body.kind !== "natal")) return null;
    var id = canonicalBody(body.id);
    if (!id) return null;
    var info = BODY_INFO[id];
    return {
      kind: body.kind,
      title: info.glyph + " " + info.label + (body.kind === "natal" ? " (natal)" : ""),
      placement: placementText(body, options),
    };
  }

  function aspectPanelData(record, options) {
    if (!record || record.kind !== "aspect" || !record.transit || !record.natal) return null;
    var transitId = canonicalBody(record.transit.id);
    var natalId = canonicalBody(record.natal.id);
    var aspectId = canonicalAspect(record.aspectId);
    if (!transitId || !natalId || !aspectId) return null;
    var transitInfo = BODY_INFO[transitId];
    var natalInfo = BODY_INFO[natalId];
    var aspectInfo = ASPECT_INFO[aspectId];
    var detail = [];
    var orbValue = finiteNumber(record.orbDeg);
    var orb = orbValue !== null && orbValue >= 0 ? fixedDegree(orbValue, options && options.digits) : null;
    if (orb) detail.push("orb " + orb);
    if (record.motionLabel === "applying" || record.motionLabel === "separating") detail.push(record.motionLabel);
    return {
      kind: "aspect",
      title: "Transit " + transitInfo.label + " " + aspectInfo.label + " natal " + natalInfo.label,
      detail: detail.join(" · "),
      transitPlacement: placementText(record.transit, options),
      natalPlacement: placementText(record.natal, options),
      rank: Number.isInteger(record.rank) && record.rank > 0 ? record.rank : null,
    };
  }

  function skyChatFocusSnapshot(focus, selection) {
    var selectionFallback = focus === undefined;
    focus = focus && typeof focus === "object" && !Array.isArray(focus) ? focus : null;
    selection = selection && typeof selection === "object" && !Array.isArray(selection) ? selection : null;

    if (focus && focus.kind === "aspect" && focus.record) {
      var transitBody = canonicalBody(focus.record.transit && focus.record.transit.id);
      var natalPoint = canonicalBody(focus.record.natal && focus.record.natal.id);
      var aspectId = canonicalAspect(focus.record.aspectId);
      if (transitBody && natalPoint && aspectId) {
        return {
          kind: "aspect",
          body: transitBody,
          natal_point: natalPoint,
          aspect_id: aspectId,
        };
      }
    }
    if (focus && focus.kind === "natal") {
      var natalId = canonicalBody(focus.id || (focus.body && focus.body.id));
      if (natalId) return { kind: "natal", natal_point: natalId };
    }
    if (focus && focus.kind === "body") {
      var bodyId = canonicalBody(
        (focus.body && focus.body.id) || (focus.pick && focus.pick.id)
      );
      if (bodyId) return { kind: "body", body: bodyId };
    }
    if (focus && focus.kind === "sign") {
      var signId = canonicalSign(focus.pick && focus.pick.id);
      if (signId) return { kind: "sign", sign: signId };
    }
    if (selectionFallback && selection && selection.kind === "body") {
      var selectedBody = canonicalBody(selection.id);
      if (selectedBody) return { kind: "body", body: selectedBody };
    }
    if (selectionFallback && selection && selection.kind === "sign") {
      var selectedSign = canonicalSign(selection.id);
      if (selectedSign) return { kind: "sign", sign: selectedSign };
    }
    return { kind: "sky" };
  }

  function vector(value) {
    if (!value || typeof value !== "object") return null;
    var x = finiteNumber(Array.isArray(value) ? value[0] : value.x);
    var y = finiteNumber(Array.isArray(value) ? value[1] : value.y);
    var z = finiteNumber(Array.isArray(value) ? value[2] : value.z);
    return x === null || y === null || z === null ? null : { x: x, y: y, z: z };
  }

  function addScaled(base, direction, amount) {
    return {
      x: base.x + direction.x * amount,
      y: base.y + direction.y * amount,
      z: base.z + direction.z * amount,
    };
  }

  function dot(left, right) {
    return left.x * right.x + left.y * right.y + left.z * right.z;
  }

  function subtract(left, right) {
    return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  // Closest points between a forward ray and a finite segment. Inputs may be
  // plain {x,y,z}, THREE.Vector3 instances, or numeric triples.
  function rayToSegment(rayOrigin, rayDirection, segmentStart, segmentEnd) {
    var origin = vector(rayOrigin);
    var direction = vector(rayDirection);
    var start = vector(segmentStart);
    var end = vector(segmentEnd);
    if (!origin || !direction || !start || !end) return null;

    var directionLengthSq = dot(direction, direction);
    if (directionLengthSq <= EPSILON) return null;
    var inverseDirectionLength = 1 / Math.sqrt(directionLengthSq);
    direction = {
      x: direction.x * inverseDirectionLength,
      y: direction.y * inverseDirectionLength,
      z: direction.z * inverseDirectionLength,
    };

    var edge = subtract(end, start);
    var edgeLengthSq = dot(edge, edge);
    var fromStart = subtract(origin, start);
    var b = dot(direction, edge);
    var d = dot(direction, fromStart);
    var e = dot(edge, fromStart);
    var candidates = [];

    function candidate(rayT, segmentT) {
      rayT = Math.max(0, rayT);
      segmentT = clamp01(segmentT);
      var rayPoint = addScaled(origin, direction, rayT);
      var segmentPoint = addScaled(start, edge, segmentT);
      var delta = subtract(rayPoint, segmentPoint);
      var distanceSq = dot(delta, delta);
      candidates.push({
        distance: Math.sqrt(Math.max(0, distanceSq)),
        distanceSq: Math.max(0, distanceSq),
        rayT: rayT,
        segmentT: segmentT,
        rayPoint: rayPoint,
        segmentPoint: segmentPoint,
      });
    }

    if (edgeLengthSq <= EPSILON) {
      candidate(-d, 0);
    } else {
      var denominator = edgeLengthSq - b * b;
      if (denominator > EPSILON) {
        var rayT = (b * e - edgeLengthSq * d) / denominator;
        var segmentT = (e - b * d) / denominator;
        if (rayT >= 0 && segmentT >= 0 && segmentT <= 1) candidate(rayT, segmentT);
      }
      candidate(0, e / edgeLengthSq);
      candidate(-d, 0);
      candidate(b - d, 1);
    }

    candidates.sort(function (left, right) {
      return left.distanceSq - right.distanceSq || left.rayT - right.rayT || left.segmentT - right.segmentT;
    });
    return candidates[0] || null;
  }

  function pickRaySegment(rayOrigin, rayDirection, segments, maxDistance) {
    if (!Array.isArray(segments)) return null;
    var threshold = finiteNumber(maxDistance);
    threshold = threshold !== null && threshold >= 0 ? threshold : Infinity;
    var thresholdSq = threshold * threshold;
    var best = null;

    for (var index = 0; index < segments.length; index += 1) {
      var segment = segments[index];
      if (!segment || typeof segment !== "object") continue;
      var hit = rayToSegment(
        rayOrigin,
        rayDirection,
        segment.start !== undefined ? segment.start : segment.a,
        segment.end !== undefined ? segment.end : segment.b
      );
      if (!hit || hit.distanceSq > thresholdSq) continue;
      if (!best || hit.distanceSq < best.distanceSq - EPSILON ||
          (Math.abs(hit.distanceSq - best.distanceSq) <= EPSILON && hit.rayT < best.rayT)) {
        best = Object.assign({ index: index, segment: segment }, hit);
      }
    }
    return best;
  }

  return Object.freeze({
    DEFAULT_MAX_ASPECT_LINES: DEFAULT_MAX_ASPECT_LINES,
    HARD_MAX_ASPECT_LINES: HARD_MAX_ASPECT_LINES,
    BODY_INFO: BODY_INFO,
    ASPECT_INFO: ASPECT_INFO,
    SIGN_LABELS: SIGN_LABELS,
    canonicalBody: canonicalBody,
    canonicalAspect: canonicalAspect,
    canonicalSign: canonicalSign,
    normalizeBodyRecord: normalizeBodyRecord,
    normalizeAspectRecords: normalizeAspectRecords,
    fixedDegree: fixedDegree,
    placementText: placementText,
    bodyPanelData: bodyPanelData,
    aspectPanelData: aspectPanelData,
    skyChatFocusSnapshot: skyChatFocusSnapshot,
    rayToSegment: rayToSegment,
    pickRaySegment: pickRaySegment,
  });
});
