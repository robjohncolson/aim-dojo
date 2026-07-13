(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AimDojoLocalSky = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEG_TO_RAD = Math.PI / 180;
  var RAD_TO_DEG = 180 / Math.PI;
  var J2000_JULIAN_DATE = 2451545.0;
  var J2000_OBLIQUITY_DEG = 23.439291111;
  var VECTOR_EPSILON = 1e-14;

  function finiteNumber(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(name + " must be a finite number");
    }
    return value;
  }

  function boundedNumber(value, name, minimum, maximum) {
    value = finiteNumber(value, name);
    if (value < minimum || value > maximum) {
      throw new RangeError(name + " must be between " + minimum + " and " + maximum + " degrees");
    }
    return value;
  }

  function validDate(value) {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new TypeError("utcDate must be a valid Date");
    }
    return value;
  }

  function normalizeDegrees(value) {
    value = finiteNumber(value, "angle");
    var result = value % 360;
    return result < 0 ? result + 360 : result;
  }

  function signedDegrees(value) {
    var result = normalizeDegrees(value);
    return result >= 180 ? result - 360 : result;
  }

  function clampUnit(value) {
    return Math.max(-1, Math.min(1, value));
  }

  function julianDate(utcDate) {
    return validDate(utcDate).getTime() / 86400000 + 2440587.5;
  }

  // IAU 1976 mean obliquity polynomial. Its sub-arcminute long-range residual is
  // well below Local Sky v1's degree-scale target.
  function meanObliquityDegrees(utcDate) {
    var centuries = (julianDate(utcDate) - J2000_JULIAN_DATE) / 36525;
    var arcseconds =
      21.448 -
      46.815 * centuries -
      0.00059 * centuries * centuries +
      0.001813 * centuries * centuries * centuries;
    return 23 + 26 / 60 + arcseconds / 3600;
  }

  function obliquityDegrees(value) {
    if (value === undefined || value === null) return J2000_OBLIQUITY_DEG;
    value = finiteNumber(value, "obliquityDeg");
    if (value <= 0 || value >= 90) {
      throw new RangeError("obliquityDeg must be greater than 0 and less than 90 degrees");
    }
    return value;
  }

  function eclipticToEquatorial(lonDeg, latDeg, obliquityDegValue) {
    lonDeg = normalizeDegrees(lonDeg);
    latDeg = boundedNumber(latDeg, "ecliptic latitude", -90, 90);
    var epsilonDeg = obliquityDegrees(obliquityDegValue);
    var longitude = lonDeg * DEG_TO_RAD;
    var latitude = latDeg * DEG_TO_RAD;
    var epsilon = epsilonDeg * DEG_TO_RAD;
    var cosLatitude = Math.cos(latitude);
    var eclipticX = cosLatitude * Math.cos(longitude);
    var eclipticY = cosLatitude * Math.sin(longitude);
    var eclipticZ = Math.sin(latitude);
    var equatorialX = eclipticX;
    var equatorialY = eclipticY * Math.cos(epsilon) - eclipticZ * Math.sin(epsilon);
    var equatorialZ = eclipticY * Math.sin(epsilon) + eclipticZ * Math.cos(epsilon);
    var planar = Math.hypot(equatorialX, equatorialY);
    var raDeg = planar < VECTOR_EPSILON
      ? 0
      : normalizeDegrees(Math.atan2(equatorialY, equatorialX) * RAD_TO_DEG);
    var decDeg = Math.asin(clampUnit(equatorialZ)) * RAD_TO_DEG;
    return {
      raDeg: raDeg,
      decDeg: decDeg,
      obliquityDeg: epsilonDeg,
    };
  }

  function equatorialToEcliptic(raDeg, decDeg, obliquityDegValue) {
    raDeg = normalizeDegrees(raDeg);
    decDeg = boundedNumber(decDeg, "declination", -90, 90);
    var epsilonDeg = obliquityDegrees(obliquityDegValue);
    var rightAscension = raDeg * DEG_TO_RAD;
    var declination = decDeg * DEG_TO_RAD;
    var epsilon = epsilonDeg * DEG_TO_RAD;
    var cosDeclination = Math.cos(declination);
    var equatorialX = cosDeclination * Math.cos(rightAscension);
    var equatorialY = cosDeclination * Math.sin(rightAscension);
    var equatorialZ = Math.sin(declination);
    var eclipticX = equatorialX;
    var eclipticY = equatorialY * Math.cos(epsilon) + equatorialZ * Math.sin(epsilon);
    var eclipticZ = -equatorialY * Math.sin(epsilon) + equatorialZ * Math.cos(epsilon);
    var planar = Math.hypot(eclipticX, eclipticY);
    var lonDeg = planar < VECTOR_EPSILON
      ? 0
      : normalizeDegrees(Math.atan2(eclipticY, eclipticX) * RAD_TO_DEG);
    var latDeg = Math.asin(clampUnit(eclipticZ)) * RAD_TO_DEG;
    return {
      lonDeg: lonDeg,
      latDeg: latDeg,
      obliquityDeg: epsilonDeg,
    };
  }

  function gmstDegrees(utcDate) {
    var jd = julianDate(utcDate);
    var centuries = (jd - J2000_JULIAN_DATE) / 36525;
    return normalizeDegrees(
      280.46061837 +
        360.98564736629 * (jd - J2000_JULIAN_DATE) +
        0.000387933 * centuries * centuries -
        (centuries * centuries * centuries) / 38710000
    );
  }

  // Longitude is geographic longitude, positive east of Greenwich.
  function localSiderealTimeDegrees(utcDate, observerLonDeg) {
    observerLonDeg = boundedNumber(observerLonDeg, "observer longitude", -180, 180);
    return normalizeDegrees(gmstDegrees(utcDate) + observerLonDeg);
  }

  function equatorialToHorizontal(raDeg, decDeg, observerLatDeg, observerLonDeg, utcDate) {
    raDeg = normalizeDegrees(raDeg);
    decDeg = boundedNumber(decDeg, "declination", -90, 90);
    observerLatDeg = boundedNumber(observerLatDeg, "observer latitude", -90, 90);
    observerLonDeg = boundedNumber(observerLonDeg, "observer longitude", -180, 180);
    validDate(utcDate);

    var localSiderealTimeDeg = localSiderealTimeDegrees(utcDate, observerLonDeg);
    var hourAngleDeg = signedDegrees(localSiderealTimeDeg - raDeg);
    var hourAngle = hourAngleDeg * DEG_TO_RAD;
    var declination = decDeg * DEG_TO_RAD;
    var latitude = observerLatDeg * DEG_TO_RAD;
    var cosDeclination = Math.cos(declination);

    // ENU components. Azimuth is measured from north through east: N=0,
    // E=90, S=180, W=270, matching the convention used by planetaria.
    var east = -cosDeclination * Math.sin(hourAngle);
    var up =
      Math.sin(declination) * Math.sin(latitude) +
      cosDeclination * Math.cos(latitude) * Math.cos(hourAngle);
    var north =
      Math.sin(declination) * Math.cos(latitude) -
      cosDeclination * Math.sin(latitude) * Math.cos(hourAngle);
    var horizontalLength = Math.hypot(east, north);
    var altDeg = Math.asin(clampUnit(up)) * RAD_TO_DEG;
    var azDeg = horizontalLength < VECTOR_EPSILON
      ? 0
      : normalizeDegrees(Math.atan2(east, north) * RAD_TO_DEG);

    return {
      altDeg: altDeg,
      azDeg: azDeg,
      hourAngleDeg: hourAngleDeg,
      localSiderealTimeDeg: localSiderealTimeDeg,
      east: east,
      up: up,
      north: north,
    };
  }

  function eclipticToHorizontal(
    lonDeg,
    latDeg,
    observerLatDeg,
    observerLonDeg,
    utcDate,
    obliquityDegValue
  ) {
    validDate(utcDate);
    var epsilonDeg = obliquityDegValue === undefined || obliquityDegValue === null
      ? meanObliquityDegrees(utcDate)
      : obliquityDegrees(obliquityDegValue);
    var equatorial = eclipticToEquatorial(lonDeg, latDeg, epsilonDeg);
    var horizontal = equatorialToHorizontal(
      equatorial.raDeg,
      equatorial.decDeg,
      observerLatDeg,
      observerLonDeg,
      utcDate
    );
    horizontal.raDeg = equatorial.raDeg;
    horizontal.decDeg = equatorial.decDeg;
    horizontal.obliquityDeg = epsilonDeg;
    return horizontal;
  }

  function worldZAxis(value) {
    value = value === undefined || value === null ? "north" : value;
    if (value !== "north" && value !== "south") {
      throw new RangeError('zAxis must be "north" or "south"');
    }
    return value;
  }

  function worldXAxis(value) {
    value = value === undefined || value === null ? "west" : value;
    if (value !== "east" && value !== "west") {
      throw new RangeError('xAxis must be "east" or "west"');
    }
    return value;
  }

  function horizontalDirection(altDeg, azDeg, options) {
    altDeg = boundedNumber(altDeg, "altitude", -90, 90);
    azDeg = normalizeDegrees(azDeg);
    if (options !== undefined && (options === null || typeof options !== "object" || Array.isArray(options))) {
      throw new TypeError("options must be an object");
    }
    var xAxis = worldXAxis(options && options.xAxis);
    var zAxis = worldZAxis(options && options.zAxis);
    var altitude = altDeg * DEG_TO_RAD;
    var azimuth = azDeg * DEG_TO_RAD;
    var horizontal = Math.cos(altitude);
    var north = horizontal * Math.cos(azimuth);
    return {
      // THREE's right-handed world uses +X west, +Y up, +Z north by default.
      // The astronomical azimuth remains north-through-east, so east is -X.
      x: (xAxis === "east" ? 1 : -1) * horizontal * Math.sin(azimuth),
      y: Math.sin(altitude),
      z: zAxis === "north" ? north : -north,
    };
  }

  // Conventional display helper from the spec: +X east, +Y up, +Z north.
  // It is useful for readings, but this E/U/N axis order is left-handed and
  // therefore must not be converted to a THREE.Quaternion.
  function horizontalEnuDirection(altDeg, azDeg) {
    return horizontalDirection(altDeg, azDeg, { xAxis: "east", zAxis: "north" });
  }

  // This is intentionally identical to index.html's sphere-local placement:
  // +X = ecliptic lon 0, +Y = ecliptic north, and -Z = lon 90.
  function eclipticLocalDirection(lonDeg, latDeg) {
    lonDeg = normalizeDegrees(lonDeg);
    latDeg = boundedNumber(latDeg, "ecliptic latitude", -90, 90);
    var longitude = lonDeg * DEG_TO_RAD;
    var latitude = latDeg * DEG_TO_RAD;
    var cosLatitude = Math.cos(latitude);
    return {
      x: Math.cos(longitude) * cosLatitude,
      y: Math.sin(latitude),
      z: -Math.sin(longitude) * cosLatitude,
    };
  }

  function multiplyMatrix3(left, right) {
    var result = new Array(9);
    for (var row = 0; row < 3; row += 1) {
      for (var column = 0; column < 3; column += 1) {
        result[row * 3 + column] =
          left[row * 3] * right[column] +
          left[row * 3 + 1] * right[3 + column] +
          left[row * 3 + 2] * right[6 + column];
      }
    }
    return result;
  }

  function matrixOptions(options, utcDate) {
    if (options !== undefined && (options === null || typeof options !== "object" || Array.isArray(options))) {
      throw new TypeError("options must be an object");
    }
    return {
      xAxis: worldXAxis(options && options.xAxis),
      zAxis: worldZAxis(options && options.zAxis),
      obliquityDeg:
        options && options.obliquityDeg !== undefined
          ? obliquityDegrees(options.obliquityDeg)
          : meanObliquityDegrees(utcDate),
    };
  }

  // Row-major matrix from index.html's ecliptic-local vectors to world vectors.
  // The default THREE frame is right-handed +X=west, +Y=up, +Z=north. This
  // preserves the game's boot view toward -Z=south while astronomical azimuth
  // remains north-through-east. Requesting +X=east,+Z=north produces the useful
  // but orientation-reversing conventional E/U/N display matrix.
  function eclipticLocalToWorldMatrix(observerLatDeg, observerLonDeg, utcDate, options) {
    observerLatDeg = boundedNumber(observerLatDeg, "observer latitude", -90, 90);
    observerLonDeg = boundedNumber(observerLonDeg, "observer longitude", -180, 180);
    validDate(utcDate);
    var settings = matrixOptions(options, utcDate);
    var theta = localSiderealTimeDegrees(utcDate, observerLonDeg) * DEG_TO_RAD;
    var latitude = observerLatDeg * DEG_TO_RAD;
    var epsilon = settings.obliquityDeg * DEG_TO_RAD;
    var sinTheta = Math.sin(theta);
    var cosTheta = Math.cos(theta);
    var sinLatitude = Math.sin(latitude);
    var cosLatitude = Math.cos(latitude);
    var eastSign = settings.xAxis === "east" ? 1 : -1;
    var northSign = settings.zAxis === "north" ? 1 : -1;

    // Conventional equatorial XYZ -> display world [east, up, north|south].
    var equatorialToWorld = [
      eastSign * -sinTheta,
      eastSign * cosTheta,
      0,
      cosLatitude * cosTheta,
      cosLatitude * sinTheta,
      sinLatitude,
      northSign * -sinLatitude * cosTheta,
      northSign * -sinLatitude * sinTheta,
      northSign * cosLatitude,
    ];
    // Existing sphere-local [x,y,z] -> equatorial XYZ. The local vector for
    // ecliptic longitude 90 degrees is -Z, hence the signs in columns Y/Z.
    var localEclipticToEquatorial = [
      1,
      0,
      0,
      0,
      -Math.sin(epsilon),
      -Math.cos(epsilon),
      0,
      Math.cos(epsilon),
      -Math.sin(epsilon),
    ];
    return multiplyMatrix3(equatorialToWorld, localEclipticToEquatorial);
  }

  function matrix3(value) {
    if (!Array.isArray(value) || value.length !== 9) {
      throw new TypeError("matrix must be a nine-number row-major array");
    }
    for (var index = 0; index < value.length; index += 1) {
      finiteNumber(value[index], "matrix[" + index + "]");
    }
    return value;
  }

  function vector3(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("vector must be an object with finite x, y, and z");
    }
    return {
      x: finiteNumber(value.x, "vector.x"),
      y: finiteNumber(value.y, "vector.y"),
      z: finiteNumber(value.z, "vector.z"),
    };
  }

  function applyMatrix3(matrix, vector) {
    matrix = matrix3(matrix);
    vector = vector3(vector);
    return {
      x: matrix[0] * vector.x + matrix[1] * vector.y + matrix[2] * vector.z,
      y: matrix[3] * vector.x + matrix[4] * vector.y + matrix[5] * vector.z,
      z: matrix[6] * vector.x + matrix[7] * vector.y + matrix[8] * vector.z,
    };
  }

  function eclipticLocalToWorldBasis(observerLatDeg, observerLonDeg, utcDate, options) {
    var matrix = eclipticLocalToWorldMatrix(observerLatDeg, observerLonDeg, utcDate, options);
    var settings = matrixOptions(options, utcDate);
    var rightHanded = (settings.xAxis === "west") !== (settings.zAxis === "south");
    return {
      matrix: matrix,
      x: { x: matrix[0], y: matrix[3], z: matrix[6] },
      y: { x: matrix[1], y: matrix[4], z: matrix[7] },
      z: { x: matrix[2], y: matrix[5], z: matrix[8] },
      xAxis: settings.xAxis,
      zAxis: settings.zAxis,
      handedness: rightHanded ? "right" : "left",
      obliquityDeg: settings.obliquityDeg,
    };
  }

  return Object.freeze({
    J2000_JULIAN_DATE: J2000_JULIAN_DATE,
    J2000_OBLIQUITY_DEG: J2000_OBLIQUITY_DEG,
    normalizeDegrees: normalizeDegrees,
    signedDegrees: signedDegrees,
    julianDate: julianDate,
    meanObliquityDegrees: meanObliquityDegrees,
    eclipticToEquatorial: eclipticToEquatorial,
    equatorialToEcliptic: equatorialToEcliptic,
    gmstDegrees: gmstDegrees,
    localSiderealTimeDegrees: localSiderealTimeDegrees,
    equatorialToHorizontal: equatorialToHorizontal,
    eclipticToHorizontal: eclipticToHorizontal,
    horizontalDirection: horizontalDirection,
    horizontalEnuDirection: horizontalEnuDirection,
    eclipticLocalDirection: eclipticLocalDirection,
    eclipticLocalToWorldMatrix: eclipticLocalToWorldMatrix,
    eclipticLocalToWorldBasis: eclipticLocalToWorldBasis,
    applyMatrix3: applyMatrix3,
  });
});
