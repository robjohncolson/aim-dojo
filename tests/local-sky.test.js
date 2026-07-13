"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const sky = require("../local-sky.js");

function approx(actual, expected, tolerance = 1e-9, message = "") {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message || "values differ"}: expected ${expected} ± ${tolerance}, received ${actual}`
  );
}

function angularDifference(left, right) {
  return Math.abs(sky.signedDegrees(left - right));
}

function determinant3(matrix) {
  return (
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
  );
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function assertVector(actual, expected, tolerance = 1e-10) {
  approx(actual.x, expected.x, tolerance, "vector x");
  approx(actual.y, expected.y, tolerance, "vector y");
  approx(actual.z, expected.z, tolerance, "vector z");
}

test("ecliptic/equatorial conversion matches cardinal J2000 vectors and round-trips", () => {
  const epsilon = sky.J2000_OBLIQUITY_DEG;
  const equinox = sky.eclipticToEquatorial(0, 0);
  approx(equinox.raDeg, 0);
  approx(equinox.decDeg, 0);

  const northernSolstice = sky.eclipticToEquatorial(90, 0);
  approx(northernSolstice.raDeg, 90);
  approx(northernSolstice.decDeg, epsilon);

  const southernSolstice = sky.eclipticToEquatorial(270, 0);
  approx(southernSolstice.raDeg, 270);
  approx(southernSolstice.decDeg, -epsilon);

  for (const [lonDeg, latDeg] of [[17.25, -4.5], [145, 38], [359.9, -72]]) {
    const equatorial = sky.eclipticToEquatorial(lonDeg, latDeg);
    const ecliptic = sky.equatorialToEcliptic(
      equatorial.raDeg,
      equatorial.decDeg,
      equatorial.obliquityDeg
    );
    assert.ok(angularDifference(ecliptic.lonDeg, lonDeg) < 1e-9);
    approx(ecliptic.latDeg, latDeg, 1e-9);
  }
});

test("Julian date, GMST, and east-positive LST match the J2000 reference", () => {
  const j2000 = new Date("2000-01-01T12:00:00.000Z");
  approx(sky.julianDate(j2000), 2451545, 1e-12);
  approx(sky.gmstDegrees(j2000), 280.46061837, 1e-9);
  approx(sky.localSiderealTimeDegrees(j2000, 0), 280.46061837, 1e-9);
  approx(sky.localSiderealTimeDegrees(j2000, 30), 310.46061837, 1e-9);
  approx(sky.localSiderealTimeDegrees(j2000, -90), 190.46061837, 1e-9);
  approx(sky.meanObliquityDegrees(j2000), sky.J2000_OBLIQUITY_DEG, 1e-9);
});

test("equatorial to horizontal uses azimuth north through east", () => {
  const utcDate = new Date("2000-01-01T12:00:00.000Z");
  const lst = sky.localSiderealTimeDegrees(utcDate, 0);

  const southMeridian = sky.equatorialToHorizontal(lst, 20, 40, 0, utcDate);
  approx(southMeridian.altDeg, 70, 1e-9);
  approx(southMeridian.azDeg, 180, 1e-9);

  const eastHorizon = sky.equatorialToHorizontal(lst + 90, 0, 0, 0, utcDate);
  approx(eastHorizon.altDeg, 0, 1e-9);
  approx(eastHorizon.azDeg, 90, 1e-9);
  assert.ok(eastHorizon.east > 0);

  const westHorizon = sky.equatorialToHorizontal(lst - 90, 0, 0, 0, utcDate);
  approx(westHorizon.altDeg, 0, 1e-9);
  approx(westHorizon.azDeg, 270, 1e-9);
  assert.ok(westHorizon.east < 0);

  const northPole = sky.equatorialToHorizontal(0, 90, 38, 0, utcDate);
  approx(northPole.altDeg, 38, 1e-9);
  approx(northPole.azDeg, 0, 1e-9);
});

test("horizontal direction documents the right-handed THREE world convention", () => {
  // World: +X west, +Y zenith, +Z north. Astronomical azimuth still grows eastward.
  assertVector(sky.horizontalDirection(0, 0), { x: 0, y: 0, z: 1 });
  assertVector(sky.horizontalDirection(0, 90), { x: -1, y: 0, z: 0 });
  assertVector(sky.horizontalDirection(0, 180), { x: 0, y: 0, z: -1 });
  assertVector(sky.horizontalDirection(0, 270), { x: 1, y: 0, z: 0 });
  assertVector(sky.horizontalDirection(90, 123), { x: 0, y: 1, z: 0 });

  // Conventional E/U/N remains available for non-quaternion readings.
  assertVector(sky.horizontalEnuDirection(0, 90), { x: 1, y: 0, z: 0 });
});

test("default ecliptic-local attitude is a proper THREE rotation", () => {
  const utcDate = new Date("2026-07-13T19:00:00.000Z");
  const basis = sky.eclipticLocalToWorldBasis(38, -84.5, utcDate);
  assert.equal(basis.xAxis, "west");
  assert.equal(basis.zAxis, "north");
  assert.equal(basis.handedness, "right");
  approx(determinant3(basis.matrix), 1, 1e-12);
  approx(dot(basis.x, basis.y), 0, 1e-12);
  approx(dot(basis.x, basis.z), 0, 1e-12);
  approx(dot(basis.y, basis.z), 0, 1e-12);
  approx(dot(basis.x, basis.x), 1, 1e-12);
  approx(dot(basis.y, basis.y), 1, 1e-12);
  approx(dot(basis.z, basis.z), 1, 1e-12);
  assertVector(cross(basis.x, basis.y), basis.z, 1e-12);
});

test("attitude maps existing eclipticDir vectors to direct local-sky directions", () => {
  const utcDate = new Date("2026-07-13T19:00:00.000Z");
  const latitude = 38;
  const longitude = -84.5;
  const matrix = sky.eclipticLocalToWorldMatrix(latitude, longitude, utcDate, {
    obliquityDeg: sky.J2000_OBLIQUITY_DEG,
  });

  for (const [lonDeg, latDeg] of [[0, 0], [90, 0], [111.027785, -0.002962], [245, 21]]) {
    const local = sky.eclipticLocalDirection(lonDeg, latDeg);
    const transformed = sky.applyMatrix3(matrix, local);
    const horizontal = sky.eclipticToHorizontal(
      lonDeg,
      latDeg,
      latitude,
      longitude,
      utcDate,
      sky.J2000_OBLIQUITY_DEG
    );
    const direct = sky.horizontalDirection(horizontal.altDeg, horizontal.azDeg);
    assertVector(transformed, direct, 1e-12);
  }
});

test("Lexington summer afternoon Sun is high and agrees with Swiss reference", () => {
  // Swiss reference at this instant/location: altitude 66.9148°, azimuth 230.6216°.
  // The pack coordinate is J2000 while this v1 client path deliberately omits
  // precession/nutation, leaving a sub-degree residual within the spec tolerance.
  const horizontal = sky.eclipticToHorizontal(
    111.027785,
    -0.002962,
    38,
    -84.5,
    new Date("2026-07-13T19:00:00.000Z"),
    sky.J2000_OBLIQUITY_DEG
  );
  approx(horizontal.altDeg, 66.9148, 1);
  assert.ok(angularDifference(horizontal.azDeg, 230.6216) <= 1);
  assert.ok(horizontal.altDeg > 60, "mid-afternoon Sun is high, not near the horizon");

  const world = sky.horizontalDirection(horizontal.altDeg, horizontal.azDeg);
  assert.ok(world.x > 0, "southwest Sun is west (+X)");
  assert.ok(world.y > 0, "afternoon Sun is above the horizon (+Y)");
  assert.ok(world.z < 0, "southwest Sun is south (-Z)");
});

test("high-latitude winter Sun stays below the local horizon", () => {
  // Tromso near local solar noon at the December solstice (polar night).
  const horizontal = sky.eclipticToHorizontal(
    270,
    0,
    69.6492,
    18.9553,
    new Date("2026-12-21T11:00:00.000Z")
  );
  approx(horizontal.altDeg, -3.13, 0.5);
  assert.ok(horizontal.altDeg < 0, "winter-solstice Sun remains below the horizon");
});

test("astronomy helpers reject non-finite, out-of-range, and ambiguous inputs", () => {
  assert.throws(() => sky.julianDate(new Date("bad")), /valid Date/);
  assert.throws(() => sky.julianDate("2026-07-13T19:00:00Z"), /valid Date/);
  assert.throws(() => sky.eclipticToEquatorial("90", 0), /finite number/);
  assert.throws(() => sky.eclipticToEquatorial(90, 91), /between -90 and 90/);
  assert.throws(() => sky.equatorialToHorizontal(0, -91, 0, 0, new Date()), /declination/);
  assert.throws(() => sky.equatorialToHorizontal(0, 0, 90.1, 0, new Date()), /observer latitude/);
  assert.throws(() => sky.equatorialToHorizontal(0, 0, 0, 180.1, new Date()), /observer longitude/);
  assert.throws(() => sky.horizontalDirection(91, 0), /altitude/);
  assert.throws(() => sky.horizontalDirection(0, 0, { xAxis: "east-ish" }), /xAxis/);
  assert.throws(() => sky.horizontalDirection(0, 0, { zAxis: "forward" }), /zAxis/);
  assert.throws(() => sky.applyMatrix3([1, 0], { x: 0, y: 0, z: 0 }), /nine-number/);
});
