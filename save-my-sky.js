(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AimDojoSaveMySky = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function SkyProfileError(code, message, options) {
    Error.call(this, message);
    this.name = "SkyProfileError";
    this.message = message;
    this.code = code;
    this.status = options && Number.isInteger(options.status) ? options.status : null;
    this.retryable = !!(options && options.retryable);
    if (Error.captureStackTrace) Error.captureStackTrace(this, SkyProfileError);
  }
  SkyProfileError.prototype = Object.create(Error.prototype);
  SkyProfileError.prototype.constructor = SkyProfileError;

  function failValidation(message) {
    throw new SkyProfileError("validation", message);
  }

  function pick(raw, names) {
    for (var i = 0; i < names.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(raw, names[i])) return raw[names[i]];
    }
    return undefined;
  }

  function requiredText(value, name, maxLength) {
    if (typeof value !== "string" || !value.trim()) {
      failValidation(name + " is required");
    }
    var text = value.trim();
    if (text.length > maxLength) failValidation(name + " is too long");
    return text;
  }

  function validCalendarDate(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    var parts = text.split("-").map(Number);
    var probe = new Date(0);
    probe.setUTCHours(0, 0, 0, 0);
    probe.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
    return (
      probe.getUTCFullYear() === parts[0] &&
      probe.getUTCMonth() === parts[1] - 1 &&
      probe.getUTCDate() === parts[2]
    );
  }

  function normalizeTime(value) {
    if (typeof value !== "string") failValidation("birth time must use HH:MM");
    var text = value.trim();
    var match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] || 0) > 59) {
      failValidation("birth time must use HH:MM");
    }
    return match[3] === undefined ? text + ":00" : text;
  }

  function optionalCoordinate(value, name) {
    if (value === undefined || value === null || value === "") return null;
    var number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) failValidation(name + " must be a number");
    return number;
  }

  function normalizeNatalInput(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      failValidation("birth details must be an object");
    }

    var birthDate = requiredText(pick(raw, ["birth_date", "birthDate", "date"]), "birth date", 10);
    if (!validCalendarDate(birthDate)) failValidation("birth date must use YYYY-MM-DD");

    var rawTime = pick(raw, ["birth_time", "birthTime", "time"]);
    var rawUnknown = pick(raw, ["time_unknown", "timeUnknown", "unknownTime"]);
    if (rawUnknown !== undefined && typeof rawUnknown !== "boolean") {
      failValidation("unknown time must be true or false");
    }
    var timeUnknown = rawUnknown === true || rawTime === undefined || rawTime === null || rawTime === "";
    var birthTime = timeUnknown ? null : normalizeTime(rawTime);

    var tz = requiredText(pick(raw, ["tz", "timezone"]), "timezone", 128);
    var lat = optionalCoordinate(pick(raw, ["lat", "latitude"]), "latitude");
    var lon = optionalCoordinate(pick(raw, ["lon", "longitude"]), "longitude");
    if ((lat === null) !== (lon === null)) failValidation("latitude and longitude must be provided together");
    if (lat !== null && (lat < -90 || lat > 90)) failValidation("latitude must be between -90 and 90");
    if (lon !== null && (lon < -180 || lon > 180)) failValidation("longitude must be between -180 and 180");

    var rawPlace = pick(raw, ["place_label", "placeLabel", "place"]);
    if (rawPlace === undefined || rawPlace === null) rawPlace = "";
    if (typeof rawPlace !== "string") failValidation("place label must be text");
    var placeLabel = rawPlace.trim();
    if (placeLabel.length > 240) failValidation("place label is too long");

    return {
      birth_date: birthDate,
      birth_time: birthTime,
      time_unknown: timeUnknown,
      tz: tz,
      lat: lat,
      lon: lon,
      place_label: placeLabel,
    };
  }

  function cleanApiBase(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new SkyProfileError("configuration", "Personal sky API is not configured");
    }
    var url;
    try {
      url = new URL(value.trim());
    } catch (_) {
      throw new SkyProfileError("configuration", "Personal sky API URL is invalid");
    }
    var localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) {
      throw new SkyProfileError("configuration", "Personal sky API must use HTTPS");
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new SkyProfileError("configuration", "Personal sky API URL must not contain credentials, a query, or a fragment");
    }
    var path = url.pathname.replace(/\/+$/, "");
    return url.origin + (path === "/" ? "" : path);
  }

  function selectPersonalApiBase(personalApi, skyDayApi) {
    if (typeof personalApi === "string" && personalApi.trim()) return cleanApiBase(personalApi);
    return cleanApiBase(skyDayApi);
  }

  function isPersonalSkypack(pack) {
    var arrays = ["sign_band", "movers", "natal_ghosts", "resonances", "same_body_delta", "resonance_rank"];
    var moverIds = Object.create(null);
    var moversValid = !!(pack && Array.isArray(pack.movers) && pack.movers.length) && pack.movers.every(function (item) {
      if (!item || typeof item.id !== "string" || !item.id || typeof item.lon_j2000 !== "number" || !Number.isFinite(item.lon_j2000)) return false;
      moverIds[item.id] = true;
      return true;
    });
    var ghostsValid = !!(pack && Array.isArray(pack.natal_ghosts) && pack.natal_ghosts.length) && pack.natal_ghosts.every(function (item) {
      return !!(item && typeof item.id === "string" && moverIds[item.id] && typeof item.lon_j2000 === "number" && Number.isFinite(item.lon_j2000));
    });
    return !!(
      pack &&
      typeof pack === "object" &&
      !Array.isArray(pack) &&
      pack.type === "skypack" &&
      pack.privacy === "user_private" &&
      (pack.schema_version === 2 || pack.schema_version === "2") &&
      (pack.projection === "ecliptic_band_v2" || pack.projection === "ecliptic_dome_v1") &&
      typeof pack.natal_id === "string" &&
      pack.natal_id.length > 0 &&
      arrays.every(function (name) { return Array.isArray(pack[name]); }) &&
      pack.sign_band.length > 0 &&
      moversValid &&
      ghostsValid
    );
  }

  function normalizeTransitEssayResponse(raw) {
    function invalid() {
      throw new SkyProfileError(
        "invalid_response",
        "Personal sky returned an invalid transit essay",
        { retryable: true }
      );
    }

    function cleanText(value, minLength, maxLength) {
      if (typeof value !== "string") invalid();
      var text = value.trim();
      if (text.length < minLength || text.length > maxLength || text.indexOf("<") !== -1 || text.indexOf(">") !== -1) {
        invalid();
      }
      return text;
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid();
    if (raw.schema_version !== 1 || raw.type !== "personal_transit_essay") invalid();
    if (["pending", "ready", "failed", "unavailable", "none"].indexOf(raw.status) === -1) invalid();
    if (typeof raw.cache_date !== "string" || !validCalendarDate(raw.cache_date)) invalid();

    var result = {
      schema_version: 1,
      type: "personal_transit_essay",
      status: raw.status,
      cache_date: raw.cache_date,
    };
    if (raw.status === "failed") {
      if (raw.detail !== "Transit essay generation failed.") invalid();
      result.detail = "Transit essay generation failed.";
      return result;
    }
    if (raw.status !== "ready") return result;

    result.headline = cleanText(raw.headline, 1, 120);
    result.body = cleanText(raw.body, 80, 4000);
    if (!Array.isArray(raw.watchpoints) || raw.watchpoints.length > 5) invalid();
    var seen = Object.create(null);
    result.watchpoints = raw.watchpoints.map(function (value) {
      var item = cleanText(value, 1, 240);
      var key = item.toLowerCase();
      if (seen[key]) invalid();
      seen[key] = true;
      return item;
    });
    if (raw.epistemic !== "symbolic study notes, not predictions") invalid();
    result.epistemic = raw.epistemic;
    result.model = cleanText(raw.model, 1, 240);
    result.source = cleanText(raw.source, 1, 120);
    if (typeof raw.generated_at !== "string" || !raw.generated_at.trim() || !Number.isFinite(Date.parse(raw.generated_at))) invalid();
    result.generated_at = raw.generated_at.trim();
    return result;
  }

  function createPersonalSkyController(options) {
    options = options || {};
    var baseUrl = cleanApiBase(options.baseUrl);
    var fetchImpl = options.fetchImpl;
    if (!fetchImpl && typeof fetch === "function") fetchImpl = fetch.bind(globalThis);
    if (typeof fetchImpl !== "function") {
      throw new SkyProfileError("configuration", "Fetch is unavailable");
    }
    if (typeof options.getAccessToken !== "function") {
      throw new SkyProfileError("configuration", "An access-token provider is required");
    }
    var timeoutMs = Number(options.timeoutMs);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) timeoutMs = 8000;

    var state = {
      authenticated: false,
      profile: null,
      pack: null,
      hasChart: false,
      personalMode: false,
      lastSaveCommitted: false,
      generation: 0,
    };

    function resetProfile() {
      state.profile = null;
      state.pack = null;
      state.hasChart = false;
      state.personalMode = false;
      state.lastSaveCommitted = false;
    }

    function setAuthenticated(value) {
      var authenticated = value === true;
      if (!authenticated) {
        state.generation += 1;
        state.authenticated = false;
        resetProfile();
      } else if (!state.authenticated) {
        state.generation += 1;
        state.authenticated = true;
        resetProfile();
      }
      return state;
    }

    function isCurrent(generation) {
      return state.authenticated && state.generation === generation;
    }

    function staleOrThrow(error, generation) {
      if (!isCurrent(generation)) return state;
      throw error;
    }

    async function currentToken() {
      var token;
      try {
        token = await options.getAccessToken();
      } catch (_) {
        throw new SkyProfileError("not_authenticated", "Sign in again to link your sky");
      }
      if (typeof token !== "string" || !token.trim() || /[\r\n]/.test(token)) {
        throw new SkyProfileError("not_authenticated", "Sign in again to link your sky");
      }
      return token.trim();
    }

    async function request(path, requestOptions) {
      requestOptions = requestOptions || {};
      var token = await currentToken();
      var headers = {
        Accept: "application/json",
        Authorization: "Bearer " + token,
      };
      if (requestOptions.body !== undefined) headers["Content-Type"] = "application/json";
      var aborter = typeof AbortController === "function" ? new AbortController() : null;
      var timer = aborter ? setTimeout(function () { aborter.abort(); }, timeoutMs) : null;
      try {
        var response = await fetchImpl(baseUrl + path, {
          method: requestOptions.method || "GET",
          headers: headers,
          body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          signal: aborter ? aborter.signal : undefined,
        });
        if (requestOptions.allow404 && response.status === 404) return null;
        if (!response.ok) {
          var status = Number.isInteger(response.status) ? response.status : null;
          var authFailure = status === 401 || status === 403;
          var retryable = status === 408 || status === 429 || (status !== null && status >= 500);
          var validationFailure = status === 400 || status === 422;
          var detail = null;
          try {
            var errorBody = await response.json();
            if (errorBody && typeof errorBody.detail === "string" && errorBody.detail.trim()) {
              detail = errorBody.detail.trim().slice(0, 180);
            } else if (errorBody && Array.isArray(errorBody.detail) && errorBody.detail.length) {
              var first = errorBody.detail[0];
              if (first && typeof first.msg === "string" && first.msg.trim()) detail = first.msg.trim().slice(0, 180);
            }
          } catch (_) {
            detail = null;
          }
          throw new SkyProfileError(
            authFailure
              ? "not_authenticated"
              : validationFailure
                ? "validation"
                : retryable
                  ? "service_unavailable"
                  : "request_failed",
            authFailure
              ? "Sign in again to link your sky"
              : validationFailure
                ? detail || "Check date, time, timezone, and place"
                : retryable
                  ? detail || "Personal sky is unavailable"
                  : detail || "Personal sky request was not accepted",
            { status: status, retryable: retryable }
          );
        }
        if (response.status === 204 || requestOptions.noContent) return null;
        try {
          return await response.json();
        } catch (error) {
          if (error && error.name === "AbortError") throw error;
          throw new SkyProfileError("invalid_response", "Personal sky returned an unreadable response", { retryable: true });
        }
      } catch (error) {
        if (error && error.name === "AbortError") throw new SkyProfileError("timeout", "Personal sky timed out", { retryable: true });
        if (error instanceof SkyProfileError) throw error;
        throw new SkyProfileError("network", "Personal sky is unavailable", { retryable: true });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    async function load() {
      if (!state.authenticated) return state;
      state.lastSaveCommitted = false;
      var generation = ++state.generation;
      var profile;
      try {
        profile = await request("/api/me/natal", { allow404: true });
      } catch (error) {
        return staleOrThrow(error, generation);
      }
      if (!isCurrent(generation)) return state;
      if (profile === null) {
        resetProfile();
        return state;
      }
      state.profile = profileWithoutPack(profile, profile);
      state.hasChart = true;
      state.pack = null;
      state.personalMode = false;

      if (profile && isPersonalSkypack(profile.skypack)) {
        return activatePack(profile.skypack, generation);
      }

      var pack;
      try {
        pack = await request("/api/me/skypack", {});
      } catch (error) {
        return staleOrThrow(error, generation);
      }
      return activatePack(pack, generation);
    }

    function profileWithoutPack(profile, fallback) {
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        return fallback || null;
      }
      if (!Object.prototype.hasOwnProperty.call(profile, "skypack")) return profile;
      var clean = {};
      Object.keys(profile).forEach(function (key) {
        if (key !== "skypack") clean[key] = profile[key];
      });
      return clean;
    }

    async function activatePack(pack, generation) {
      if (!isCurrent(generation)) return state;
      if (!isPersonalSkypack(pack)) {
        throw new SkyProfileError("invalid_response", "Personal sky returned an invalid chart", { retryable: true });
      }
      state.pack = pack;
      state.personalMode = true;
      return state;
    }

    async function save(raw) {
      state.lastSaveCommitted = false;
      var payload = normalizeNatalInput(raw);
      if (!state.authenticated) {
        throw new SkyProfileError("not_authenticated", "Sign in to save your sky");
      }
      var generation = ++state.generation;
      var profile;
      try {
        profile = await request("/api/me/natal", { method: "POST", body: payload });
      } catch (error) {
        return staleOrThrow(error, generation);
      }
      if (!isCurrent(generation)) return state;
      state.profile = profileWithoutPack(profile, payload) || payload;
      state.hasChart = true;
      state.pack = null;
      state.personalMode = false;
      state.lastSaveCommitted = true;

      // Prefer the pack embedded in the save response; fall back to GET /api/me/skypack.
      if (profile && isPersonalSkypack(profile.skypack)) {
        return activatePack(profile.skypack, generation);
      }

      var pack;
      try {
        pack = await request("/api/me/skypack", {});
      } catch (error) {
        return staleOrThrow(error, generation);
      }
      return activatePack(pack, generation);
    }

    async function clear() {
      var wasAuthenticated = state.authenticated;
      var generation = ++state.generation;
      if (!wasAuthenticated) {
        resetProfile();
        return state;
      }
      try {
        await request("/api/me/natal", { method: "DELETE", noContent: true });
      } catch (error) {
        return staleOrThrow(error, generation);
      }
      if (isCurrent(generation)) resetProfile();
      return state;
    }

    async function getListen(params) {
      if (!state.authenticated) {
        throw new SkyProfileError("not_authenticated", "Sign in to link your sky");
      }
      params = params && typeof params === "object" ? params : {};
      var query = new URLSearchParams();
      ["kind", "body", "sign", "tz"].forEach(function (name) {
        var value = params[name];
        if (typeof value === "string" && value.trim()) query.set(name, value.trim());
      });
      var suffix = query.toString();
      return request("/api/sky-listen" + (suffix ? "?" + suffix : ""), {});
    }

    function requireTransitEssayAccess() {
      if (!state.authenticated) {
        throw new SkyProfileError("not_authenticated", "Sign in to read today's sky note");
      }
      if (!state.hasChart) {
        throw new SkyProfileError("no_chart", "Save your sky before requesting today's sky note");
      }
    }

    async function enqueueTransitEssay() {
      requireTransitEssayAccess();
      return normalizeTransitEssayResponse(await request("/api/me/transit-essay", { method: "POST" }));
    }

    async function getTransitEssay() {
      requireTransitEssayAccess();
      return normalizeTransitEssayResponse(await request("/api/me/transit-essay", {}));
    }

    return {
      state: state,
      setAuthenticated: setAuthenticated,
      load: load,
      save: save,
      clear: clear,
      getListen: getListen,
      enqueueTransitEssay: enqueueTransitEssay,
      getTransitEssay: getTransitEssay,
    };
  }

  return {
    SkyProfileError: SkyProfileError,
    normalizeNatalInput: normalizeNatalInput,
    cleanApiBase: cleanApiBase,
    selectPersonalApiBase: selectPersonalApiBase,
    isPersonalSkypack: isPersonalSkypack,
    normalizeTransitEssayResponse: normalizeTransitEssayResponse,
    createPersonalSkyController: createPersonalSkyController,
  };
});
