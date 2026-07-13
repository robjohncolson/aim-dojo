"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SkyProfileError,
  normalizeNatalInput,
  cleanApiBase,
  selectPersonalApiBase,
  isPersonalSkypack,
  normalizeTransitEssayResponse,
  createPersonalSkyController,
} = require("../save-my-sky.js");

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function personalPack() {
  return {
    schema_version: 2,
    type: "skypack",
    privacy: "user_private",
    projection: "ecliptic_band_v2",
    natal_id: "user-one",
    sign_band: [{ id: "sagittarius", glyph: "♐", lon_start_j2000: 240, lon_end_j2000: 270 }],
    natal_ghosts: [{ id: "sun", lon_j2000: 247.1 }],
    movers: [{ id: "sun", name: "Sun", glyph: "☉", sign: "sagittarius", lon_j2000: 251.2 }],
    resonances: [],
    same_body_delta: [],
    resonance_rank: [],
  };
}

function validBirth(overrides = {}) {
  return {
    date: "1983-11-29",
    time: "22:24",
    timeUnknown: false,
    timezone: "Asia/Tokyo",
    latitude: "35.68",
    longitude: "139.69",
    placeLabel: " Tokyo, Japan ",
    ...overrides,
  };
}

function readyTransitEssay(overrides = {}) {
  return {
    schema_version: 1,
    type: "personal_transit_essay",
    status: "ready",
    cache_date: "2026-07-12",
    headline: "A wider pattern comes into view",
    body: "Several strands of the present sky can be held together without forcing a single conclusion.",
    watchpoints: ["Compare the tightest contacts before naming a theme."],
    epistemic: "symbolic study notes, not predictions",
    model: "test-transit-model",
    source: "ai-deepseek",
    generated_at: "2026-07-12T02:00:00+00:00",
    ...overrides,
  };
}

test("save posts only normalized natal fields and activates personal mode", async () => {
  const calls = [];
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example/",
    getAccessToken: () => "jwt-one",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (init.method === "POST") {
        return response(200, { ...JSON.parse(init.body), skypack: personalPack() });
      }
      return response(200, personalPack());
    },
  });
  controller.setAuthenticated(true);

  const state = await controller.save({ ...validBirth(), ignored: "never sent" });

  assert.equal(state.hasChart, true);
  assert.equal(state.personalMode, true);
  assert.ok(isPersonalSkypack(state.pack));
  assert.equal(calls.length, 1, "embedded skypack should avoid a second request");
  assert.equal(calls[0].url, "https://sidereal.example/api/me/natal");
  assert.equal(state.profile.skypack, undefined);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    birth_date: "1983-11-29",
    birth_time: "22:24:00",
    time_unknown: false,
    tz: "Asia/Tokyo",
    lat: 35.68,
    lon: 139.69,
    place_label: "Tokyo, Japan",
  });
  assert.equal(calls[0].init.headers.Authorization, "Bearer jwt-one");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.credentials, "omit");
});

test("save falls back to GET skypack when the POST response has no pack", async () => {
  const calls = [];
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example/",
    getAccessToken: () => "jwt-one",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (init.method === "POST") return response(200, JSON.parse(init.body));
      return response(200, personalPack());
    },
  });
  controller.setAuthenticated(true);
  const state = await controller.save(validBirth());
  assert.equal(state.personalMode, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "https://sidereal.example/api/me/skypack");
});

test("unknown time is sent as null and coordinates must be a valid pair", () => {
  assert.deepEqual(normalizeNatalInput(validBirth({ timeUnknown: true })), {
    birth_date: "1983-11-29",
    birth_time: null,
    time_unknown: true,
    tz: "Asia/Tokyo",
    lat: 35.68,
    lon: 139.69,
    place_label: "Tokyo, Japan",
  });
  assert.equal(normalizeNatalInput(validBirth({ time: "", timeUnknown: false })).time_unknown, true);
  assert.throws(
    () => normalizeNatalInput(validBirth({ longitude: "" })),
    (error) => error instanceof SkyProfileError && error.code === "validation"
  );
  assert.throws(() => normalizeNatalInput(validBirth({ latitude: 91 })), /latitude/);
  assert.throws(() => normalizeNatalInput(validBirth({ date: "2026-02-30" })), /YYYY-MM-DD/);
});

test("Listen gets the current Bearer token and never sends natal_id", async () => {
  let token = "jwt-old";
  let seen;
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => token,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return response(200, { personal: { available: true } });
    },
  });
  controller.setAuthenticated(true);
  token = "jwt-current";

  await controller.getListen({
    kind: "body",
    body: "uranus",
    sign: "gemini",
    tz: "America/New_York",
    natal_id: "must-not-leak",
    when: "2026-07-12T12:00:00Z",
  });

  const url = new URL(seen.url);
  assert.equal(url.pathname, "/api/sky-listen");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["body", "kind", "sign", "tz"]);
  assert.equal(url.searchParams.has("natal_id"), false);
  assert.equal(url.searchParams.has("when"), false);
  assert.equal(seen.init.headers.Authorization, "Bearer jwt-current");
  assert.equal(seen.init.cache, "no-store");
});

test("transit essay responses are validated before UI code receives them", () => {
  const pending = {
    schema_version: 1,
    type: "personal_transit_essay",
    status: "pending",
    cache_date: "2026-07-12",
  };
  const ready = readyTransitEssay();

  assert.deepEqual(normalizeTransitEssayResponse(pending), pending);
  assert.deepEqual(normalizeTransitEssayResponse(ready), ready);
  assert.deepEqual(
    normalizeTransitEssayResponse({ ...pending, status: "none", body: "must be ignored" }),
    { ...pending, status: "none" }
  );
  assert.deepEqual(
    normalizeTransitEssayResponse({ ...pending, status: "unavailable", headline: "must be ignored" }),
    { ...pending, status: "unavailable" }
  );
  assert.deepEqual(
    normalizeTransitEssayResponse({
      ...pending,
      status: "failed",
      detail: "Transit essay generation failed.",
    }),
    {
      ...pending,
      status: "failed",
      detail: "Transit essay generation failed.",
    }
  );
  // Optional detail is accepted (sanitized length only); missing detail gets a default.
  assert.equal(
    normalizeTransitEssayResponse({ ...pending, status: "failed" }).detail,
    "Transit essay generation failed."
  );
  assert.equal(
    normalizeTransitEssayResponse({
      ...pending,
      status: "failed",
      detail: "  temporary worker issue  ",
    }).detail,
    "temporary worker issue"
  );

  for (const invalid of [
    null,
    [],
    { ...pending, schema_version: 2 },
    { ...pending, type: "public_transit_essay" },
    { ...pending, status: "queued" },
    { ...pending, cache_date: "07/12/2026" },
    readyTransitEssay({ headline: "" }),
    readyTransitEssay({ headline: "<b>Injected heading</b>" }),
    readyTransitEssay({ body: null }),
    readyTransitEssay({ body: "<script>bad()</script>".padEnd(90, "x") }),
    readyTransitEssay({ watchpoints: "look closer" }),
    readyTransitEssay({ watchpoints: ["one", "two", "three", "four", "five", "six"] }),
    readyTransitEssay({ watchpoints: ["valid", 2] }),
    readyTransitEssay({ watchpoints: ["same", " SAME "] }),
    readyTransitEssay({ epistemic: "" }),
    readyTransitEssay({ generated_at: "not-a-date" }),
  ]) {
    assert.throws(
      () => normalizeTransitEssayResponse(invalid),
      (error) => error instanceof SkyProfileError && error.code === "invalid_response"
    );
  }
});

test("signed chart enqueues and polls the private transit essay with no request body", async () => {
  const calls = [];
  let token = "jwt-old";
  const pending = {
    schema_version: 1,
    type: "personal_transit_essay",
    status: "pending",
    cache_date: "2026-07-12",
  };
  const ready = readyTransitEssay();
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example/",
    getAccessToken: () => token,
    fetchImpl: async (url, init) => {
      if (url.endsWith("/api/me/natal")) return response(200, { birth_date: "1983-11-29" });
      if (url.endsWith("/api/me/skypack")) return response(200, personalPack());
      calls.push({ url, init });
      return response(200, init.method === "POST" ? pending : ready);
    },
  });
  controller.setAuthenticated(true);
  await controller.load();
  token = "jwt-current";

  assert.deepEqual(await controller.enqueueTransitEssay(), pending);
  assert.deepEqual(await controller.getTransitEssay(), ready);

  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map(({ url, init }) => [url, init.method]),
    [
      ["https://sidereal.example/api/me/transit-essay", "POST"],
      ["https://sidereal.example/api/me/transit-essay", "GET"],
    ]
  );
  for (const { init } of calls) {
    assert.equal(init.headers.Authorization, "Bearer jwt-current");
    assert.equal(init.headers.Accept, "application/json");
    assert.equal(init.headers["Content-Type"], undefined);
    assert.equal(init.body, undefined);
    assert.equal(init.cache, "no-store");
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
  }
});

test("guest and authenticated no-chart transit essay calls fail before fetch", async () => {
  let calls = 0;
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => null,
    fetchImpl: async () => {
      calls += 1;
      return response(500, {});
    },
  });

  for (const method of ["enqueueTransitEssay", "getTransitEssay"]) {
    await assert.rejects(
      controller[method](),
      (error) => error instanceof SkyProfileError && error.code === "not_authenticated"
    );
  }
  controller.setAuthenticated(true);
  for (const method of ["enqueueTransitEssay", "getTransitEssay"]) {
    await assert.rejects(
      controller[method](),
      (error) => error instanceof SkyProfileError && error.code === "no_chart"
    );
  }
  assert.equal(calls, 0);
});

test("a committed profile is distinguishable when the follow-up pack fails", async () => {
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => "jwt",
    fetchImpl: async (_url, init) =>
      init.method === "POST" ? response(200, { birth_date: "1983-11-29" }) : response(503, {}),
  });
  controller.setAuthenticated(true);

  await assert.rejects(controller.save(validBirth()), (error) => error.code === "service_unavailable");
  assert.equal(controller.state.hasChart, true);
  assert.equal(controller.state.personalMode, false);
  assert.equal(controller.state.lastSaveCommitted, true);
});

test("400 responses surface the server detail as a validation error", async () => {
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => "jwt",
    fetchImpl: async () => response(400, { detail: "tz must be an IANA timezone name" }),
  });
  controller.setAuthenticated(true);

  await assert.rejects(controller.save(validBirth()), (error) => {
    assert.equal(error.code, "validation");
    assert.equal(error.status, 400);
    assert.match(error.message, /IANA timezone/i);
    return true;
  });
  assert.equal(controller.state.lastSaveCommitted, false);
});

test("a failed edit does not masquerade as a newly committed profile", async () => {
  let failPost = false;
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => "jwt",
    fetchImpl: async (_url, init) => {
      if (init.method === "POST") return failPost ? response(503, {}) : response(200, { birth_date: "1983-11-29" });
      return response(200, personalPack());
    },
  });
  controller.setAuthenticated(true);
  await controller.save(validBirth());
  failPost = true;

  await assert.rejects(controller.save(validBirth({ placeLabel: "Osaka" })), (error) => error.code === "service_unavailable");
  assert.equal(controller.state.hasChart, true);
  assert.equal(controller.state.personalMode, true);
  assert.equal(controller.state.lastSaveCommitted, false);
});

test("guest load and Listen make zero private requests", async () => {
  let calls = 0;
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => null,
    fetchImpl: async () => {
      calls += 1;
      return response(500, {});
    },
  });

  assert.equal((await controller.load()).personalMode, false);
  await assert.rejects(controller.getListen({ body: "sun" }), (error) => error.code === "not_authenticated");
  assert.equal(calls, 0);
});

test("clear prevents a stale load response from relinking the chart", async () => {
  let resolveNatal;
  const natalResponse = new Promise((resolve) => {
    resolveNatal = resolve;
  });
  const calls = [];
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => "jwt",
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method });
      if (init.method === "DELETE") return response(204);
      if (url.endsWith("/api/me/natal")) return natalResponse;
      return response(200, personalPack());
    },
    timeoutMs: 1000,
  });
  controller.setAuthenticated(true);

  const loading = controller.load();
  await Promise.resolve();
  const clearing = controller.clear();
  await clearing;
  resolveNatal(response(200, { birth_date: "1983-11-29" }));
  await loading;

  assert.equal(controller.state.hasChart, false);
  assert.equal(controller.state.personalMode, false);
  assert.equal(calls.filter((call) => call.url.endsWith("/api/me/skypack")).length, 0);
  assert.equal(calls.filter((call) => call.method === "DELETE").length, 1);
});

test("a failed clear preserves the active chart state", async () => {
  let failDelete = false;
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => "jwt",
    fetchImpl: async (_url, init) => {
      if (init.method === "DELETE") return failDelete ? response(503, {}) : response(204);
      if (init.method === "POST") return response(200, { birth_date: "1983-11-29" });
      return response(200, personalPack());
    },
  });
  controller.setAuthenticated(true);
  await controller.save(validBirth());
  failDelete = true;

  await assert.rejects(controller.clear(), (error) => error.code === "service_unavailable");
  assert.equal(controller.state.hasChart, true);
  assert.equal(controller.state.personalMode, true);
});

test("request timeout remains active while the response body is read", async () => {
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => "jwt",
    timeoutMs: 10,
    fetchImpl: async (_url, init) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    }),
  });
  controller.setAuthenticated(true);

  await assert.rejects(controller.load(), (error) => error.code === "timeout");
});

test("sign-out prevents a stale save response from relinking the chart", async () => {
  let resolveSave;
  const saveResponse = new Promise((resolve) => {
    resolveSave = resolve;
  });
  let packCalls = 0;
  const controller = createPersonalSkyController({
    baseUrl: "https://sidereal.example",
    getAccessToken: () => "jwt",
    fetchImpl: async (url, init) => {
      if (url.endsWith("/api/me/skypack")) packCalls += 1;
      if (init.method === "POST") return saveResponse;
      return response(200, personalPack());
    },
    timeoutMs: 1000,
  });
  controller.setAuthenticated(true);

  const saving = controller.save(validBirth());
  await Promise.resolve();
  controller.setAuthenticated(false);
  resolveSave(response(200, validBirth()));
  await saving;

  assert.equal(controller.state.authenticated, false);
  assert.equal(controller.state.hasChart, false);
  assert.equal(controller.state.personalMode, false);
  assert.equal(packCalls, 0);
});

test("API base is fixed, normalized, and limited to safe origins", () => {
  assert.equal(cleanApiBase(" https://sidereal.example/// "), "https://sidereal.example");
  assert.equal(cleanApiBase("http://127.0.0.1:8742/"), "http://127.0.0.1:8742");
  assert.equal(cleanApiBase("https://sidereal.example/v1/"), "https://sidereal.example/v1");
  assert.throws(() => cleanApiBase("http://sidereal.example"), (error) => error.code === "configuration");
  assert.throws(() => cleanApiBase("//sidereal.example"), (error) => error.code === "configuration");
  assert.throws(() => cleanApiBase("https://user:secret@sidereal.example"), /credentials/);
  assert.throws(() => cleanApiBase("https://sidereal.example?target=evil"), /query/);
  assert.equal(selectPersonalApiBase("", "https://sidereal.example"), "https://sidereal.example");
  assert.throws(
    () => selectPersonalApiBase("http://wrong.example", "https://sidereal.example"),
    (error) => error.code === "configuration"
  );
  assert.equal(isPersonalSkypack({ ...personalPack(), privacy: "local_only" }), false);
});
