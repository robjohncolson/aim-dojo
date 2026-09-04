"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const { sourceText: html } = require("./source.js");

function realtimeBlock(source) {
  const start = source.indexOf("let rtCh=null, rtFailed=false");
  const end = source.indexOf("(function(){ const ni=gid('nameInput')", start);
  assert.ok(start >= 0 && end > start, "the realtime channel block is extractable");
  return source.slice(start, end);
}

function runRealtime(source) {
  const calls = { created: 0, channels: 0, subscribed: 0, removed: 0, unsubscribed: 0, tracked: 0, sent: 0, warned: 0 };
  let subscribeCallback = null;
  const channel = {
    on() { return this; },
    subscribe(callback) { calls.subscribed += 1; subscribeCallback = callback; return this; },
    track() { calls.tracked += 1; return Promise.resolve("ok"); },
    send() { calls.sent += 1; return Promise.resolve("ok"); },
    unsubscribe() { calls.unsubscribed += 1; return Promise.resolve("ok"); },
    presenceState() { return { local: [{}] }; },
  };
  const client = {
    channel() { calls.channels += 1; return channel; },
    removeChannel(value) { assert.equal(value, channel); calls.removed += 1; return Promise.resolve("ok"); },
  };
  const context = vm.createContext({
    Math, Number, Promise,
    window: { supabase: { createClient() { calls.created += 1; return client; } } },
    document: { createElement() { throw new Error("no remote element should be allocated"); }, body: { appendChild() {} } },
    console: { warn() { calls.warned += 1; } },
    performance: { now: () => 100 },
    state: { running: true, hits: 2, streak: 3 }, templeActive: false, yaw: 0.2, pitch: -0.1,
    SB_URL: "https://example.supabase.co", SB_KEY: "dead-key", SUPABASE_JS: "supabase.js",
    clientId: () => "client-1", playerName: () => "Guest-1", gid: () => null,
    loadScriptOnce: () => Promise.reject(new Error("unavailable")),
    projectDir() { throw new Error("empty remotes must short-circuit projection"); },
    setAimDir() { throw new Error("empty remotes must short-circuit aim work"); },
    _remoteDir: {}, viewCX: 0, viewCY: 0,
  });
  new vm.Script(`${realtimeBlock(source)}\nthis.api={loadRealtimeClient,initRealtime,realtimeFailQuiet,broadcastAim,updateRemotes,state:()=>({channel:rtCh,failed:rtFailed})};`, { filename: "realtime-fail-quiet.vm.js" }).runInContext(context);
  return { calls, client, context, callback: () => subscribeCallback };
}

async function mutationMustFail(assertContract, mutation, message) {
  assert.notEqual(mutation, html, `${message} is constructible`);
  await assert.rejects(() => assertContract(mutation), assert.AssertionError, message);
}

test("the legacy realtime channel keeps its feature, then fails quiet for the page after its first connection error or 401", async () => {
  const assertContract = async (source) => {
    assert.match(source, /if\(state\.running && !templeActive && rtCh\) broadcastAim\(\);/);
    assert.match(source, /if\(rtCh \|\| remotes\.size\) updateRemotes\(dt\);/);
    assert.match(source, /function broadcastAim\(\)\{ if\(!rtCh\) return;/);
    assert.match(source, /function updateRemotes\(dt\)\{\n  if\(remotes\.size===0\) return;/);

    const live = runRealtime(source);
    live.context.api.loadRealtimeClient();
    assert.deepEqual(live.calls, { created: 1, channels: 1, subscribed: 1, removed: 0, unsubscribed: 0, tracked: 0, sent: 0, warned: 0 });
    await live.callback()("SUBSCRIBED");
    live.context.api.broadcastAim();
    assert.equal(live.calls.tracked, 1, "a healthy channel still tracks presence");
    assert.equal(live.calls.sent, 1, "a healthy channel still broadcasts aim");

    const failed = runRealtime(source);
    failed.context.api.loadRealtimeClient();
    await failed.callback()("CHANNEL_ERROR");
    assert.deepEqual({ ...failed.context.api.state(), created: failed.calls.created, removed: failed.calls.removed, warned: failed.calls.warned }, { channel: null, failed: true, created: 1, removed: 1, warned: 1 });
    failed.context.api.loadRealtimeClient(); failed.context.api.initRealtime(); failed.context.api.loadRealtimeClient();
    await failed.callback()("CLOSED");
    failed.context.api.realtimeFailQuiet(failed.client, "again");
    assert.deepEqual({ created: failed.calls.created, subscribed: failed.calls.subscribed, removed: failed.calls.removed, warned: failed.calls.warned }, { created: 1, subscribed: 1, removed: 1, warned: 1 }, "the page-life latch blocks retry, teardown, and warning repeats");
    assert.doesNotThrow(() => failed.context.api.broadcastAim());
    assert.doesNotThrow(() => failed.context.api.updateRemotes(1));
    assert.equal(failed.calls.sent, 0, "channel absence stays outside gameplay and frame work");

    const unauthorized = runRealtime(source);
    unauthorized.context.api.loadRealtimeClient();
    await unauthorized.callback()("CONNECTING", { statusCode: "401" });
    unauthorized.context.api.loadRealtimeClient();
    assert.deepEqual({ created: unauthorized.calls.created, removed: unauthorized.calls.removed, warned: unauthorized.calls.warned, failed: unauthorized.context.api.state().failed }, { created: 1, removed: 1, warned: 1, failed: true }, "an explicit 401 trips the same one-way latch");
  };

  await assertContract(html);
  let mutation = html.replace("if(rtCh || rtFailed || !window.supabase) return;", "if(rtCh || !window.supabase) return;").replace("if(rtCh || rtFailed) return;", "if(rtCh) return;");
  await mutationMustFail(assertContract, mutation, "the retry oracle kills setup paths that ignore the page-life latch");
  mutation = html.replace("if(rtFailed) return;\n  rtFailed=true;", "rtFailed=true;");
  await mutationMustFail(assertContract, mutation, "the warning oracle kills a repeatable failure boundary");
  mutation = html.replace("st==='CHANNEL_ERROR' || ", "");
  await mutationMustFail(assertContract, mutation, "the connection-error oracle kills a channel error that does not latch");
  mutation = html.replace("const removal=dead&&sb&&typeof sb.removeChannel==='function'?sb.removeChannel(dead):(dead&&typeof dead.unsubscribe==='function'?dead.unsubscribe():null);", "const removal=null;");
  await mutationMustFail(assertContract, mutation, "the teardown oracle kills a latched channel left alive to reconnect");
});
