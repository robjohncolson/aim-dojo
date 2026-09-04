"use strict";

// THE RELAY SCAN (SPEC_THE_INVITATION parcel D): the tool lists nights; it must never be able to touch mail.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const TOOL = path.join(__dirname, "..", "tools", "relay-scan.mjs");
const source = fs.readFileSync(TOOL, "utf8");

test("the scan tool never names the mail endpoint (GET there is read-once and destroys unread mail)", () => {
  assert.ok(!/ghost-mail/.test(source), "no ghost-mail literal anywhere in the tool");
  assert.ok(!/localStorage|aimdojo\.ghostToken/.test(source), "the user's stored token is never read");
  assert.ok(/X-Ghost-Token/.test(source), "the relay's header contract is the only credential channel");
});

test("smoke detection and row shaping", async () => {
  const mod = await import("file://" + TOOL.replace(/\\/g, "/"));
  assert.equal(mod.isSmoke(2338, 200), true, "the 2338-byte smoke ghost is a smoke regardless of duration");
  assert.equal(mod.isSmoke(2010, 200), true, "an ease-probe within 20 B of 2000 is a smoke");
  assert.equal(mod.isSmoke(2426, 162), false, "the user's first real night (2,426 B, 162 s) is human");
  assert.equal(mod.isSmoke(2426, 46), true, "a 46 s night is below the human floor");
  const row = mod.rowFor({ id: "0123456789abcdef0123456789abcdef", lonBucket: 21, postedAt: "2026-08-23T11:00:00Z",
    artifact: { v: 1, date: "2026-08-23", moonBucket: 1, bpm0: 20, dur: 162.4, bpmCurve: [[0, 20]], targets: new Array(16).fill([0, 0, 0, 0, 0, null]), taps: new Array(58).fill([0, 0, 0]), fires: new Array(25).fill([0, 0, 0, 0]) } });
  assert.equal(row.id, "01234567");
  assert.equal(row.sigil, "🌒");
  assert.equal(row.dur, 162);
  assert.deepEqual([row.targets, row.taps, row.fires], [16, 58, 25]);
  assert.equal(row.smoke, false);
  assert.equal(mod.rowFor({ id: "x", artifact: { moonBucket: 9 } }).sigil, "·", "an unreadable bucket shows no sigil");
  assert.throws(() => mod.scanToken("nothex"), /32 lowercase hex/);
  assert.match(mod.scanToken(""), /^[0-9a-f]{32}$/, "a throwaway token is minted when none is given");
});
