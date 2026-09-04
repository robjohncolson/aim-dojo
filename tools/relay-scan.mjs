#!/usr/bin/env node
// THE RELAY SCAN (SPEC_THE_INVITATION parcel D). Lists the nights currently on the Ghost Relay so a friend's first
// night can be found without hand-querying buckets. Node 18+, no dependencies.
//
//   node tools/relay-scan.mjs                      # throwaway scan token: YOUR OWN night is listed too
//   node tools/relay-scan.mjs --token <32 hex>     # a real token: that token's night is excluded (the relay's law)
//   node tools/relay-scan.mjs --api https://host   # another relay base (the game does NOT follow ?skyApi; neither does this)
//   node tools/relay-scan.mjs --json               # machine-readable rows
//
// LAWS. (1) This tool never reads the user's stored token from anywhere — a token arrives only on the command line.
// (2) This tool never calls the mail endpoint: GET on it is read-once and would destroy unread mail. A source test
// pins the absence of that path literal. (3) Reads are sequential: the relay allows 8 concurrent reads and 120 per
// minute per address; 24 sequential GETs are far under both. (4) The relay returns at most 4 nearest nights per
// query (n ≤ 4), so a bucket holding more than 4 nights shows its 4 most recent — stated on the summary line.

import { randomBytes } from "node:crypto";

const DEFAULT_API = "https://sidereal-production.up.railway.app";
const GHOSTS_PATH = "/api/ghosts";
const BUCKETS = 24;
const PER_QUERY = 4;
const TIMEOUT_MS = 8000;
const SMOKE_DUR_MAX = 50;           // short-duration heuristic, not proof that a night is synthetic
const SIGILS = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

function parseArgs(argv) {
  const out = { api: DEFAULT_API, token: "", json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--api") out.api = String(argv[++i] || "");
    else if (a === "--token") out.token = String(argv[++i] || "");
    else if (a === "--help" || a === "-h") { out.help = true; }
    else throw new Error("unknown argument: " + a);
  }
  return out;
}

export function scanToken(given) {
  if (given) {
    if (!/^[0-9a-f]{32}$/.test(given)) throw new Error("--token must be 32 lowercase hex characters");
    return given;
  }
  return randomBytes(16).toString("hex");
}

export function isSmoke(bytes, dur) {
  // Real nights overlap the expired wave-16/17 probe sizes; bytes alone cannot identify a smoke.
  return Number.isFinite(dur) && dur < SMOKE_DUR_MAX;
}

export function rowFor(item) {
  const a = item && item.artifact ? item.artifact : {};
  const bytes = Buffer.byteLength(JSON.stringify(a), "utf8");
  const dur = Number(a.dur);
  const moon = Number.isInteger(a.moonBucket) && a.moonBucket >= 0 && a.moonBucket < 8 ? a.moonBucket : -1;
  return {
    id: String(item.id || "").slice(0, 8),
    lon: Number(item.lonBucket),
    postedAt: String(item.postedAt || ""),
    date: String(a.date || ""),
    sigil: moon >= 0 ? SIGILS[moon] : "·",
    dur: Number.isFinite(dur) ? Math.round(dur) : null,
    targets: Array.isArray(a.targets) ? a.targets.length : 0,
    taps: Array.isArray(a.taps) ? a.taps.length : 0,
    fires: Array.isArray(a.fires) ? a.fires.length : 0,
    bytes,
    smoke: isSmoke(bytes, dur),
  };
}

async function fetchBucket(api, token, lon) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(api + GHOSTS_PATH + "?lon=" + lon + "&n=" + PER_QUERY, {
      headers: { "X-Ghost-Token": token },
      signal: ctl.signal,
    });
    if (!res.ok) return { error: "HTTP " + res.status, ghosts: [] };
    const body = await res.json();
    return { error: null, ghosts: Array.isArray(body && body.ghosts) ? body.ghosts : [] };
  } catch (e) {
    return { error: e && e.name === "AbortError" ? "timeout" : String((e && e.message) || e), ghosts: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function scan({ api, token }) {
  const base = api.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) throw new Error("--api must be an http(s) base URL");
  const seen = new Map();
  const errors = [];
  for (let lon = 0; lon < BUCKETS; lon++) {
    const { error, ghosts } = await fetchBucket(base, token, lon);
    if (error) { errors.push("lon " + lon + ": " + error); continue; }
    for (const item of ghosts) {
      if (!item || typeof item.id !== "string" || seen.has(item.id)) continue;
      seen.set(item.id, rowFor(item));
    }
  }
  const rows = [...seen.values()].sort((a, b) => (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0));
  return { rows, errors };
}

function pad(s, n, right) {
  s = String(s);
  return right ? s.padStart(n) : s.padEnd(n);
}

function printTable(rows, errors) {
  const head = [pad("id", 8), pad("lon", 3, true), pad("posted", 20), pad("date", 10), "sig", pad("dur", 5, true), pad("tg", 4, true), pad("tap", 4, true), pad("fire", 4, true), pad("bytes", 6, true), ""].join("  ");
  console.log(head);
  for (const r of rows) {
    console.log([
      pad(r.id, 8), pad(r.lon, 3, true), pad(r.postedAt.slice(0, 19), 20), pad(r.date, 10), r.sigil,
      pad(r.dur == null ? "?" : r.dur, 5, true), pad(r.targets, 4, true), pad(r.taps, 4, true), pad(r.fires, 4, true),
      pad(r.bytes, 6, true), r.smoke ? "SMOKE" : "",
    ].join("  "));
  }
  const real = rows.filter((r) => !r.smoke).length;
  console.log("");
  console.log(rows.length + " nights on the relay · " + real + " look human · at most " + PER_QUERY + " shown per bucket (the relay's n cap)");
  for (const e of errors) console.log("  ! " + e);
}

const isMain = process.argv[1] && /relay-scan\.mjs$/.test(process.argv[1]);
if (isMain) {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(String(e.message || e)); process.exit(2); }
  if (args.help) {
    console.log("usage: node tools/relay-scan.mjs [--token <32hex>] [--api <base>] [--json]");
    process.exit(0);
  }
  const token = scanToken(args.token);
  scan({ api: args.api, token }).then(({ rows, errors }) => {
    if (args.json) console.log(JSON.stringify({ rows, errors }, null, 2));
    else printTable(rows, errors);
    process.exit(errors.length === BUCKETS ? 1 : 0);
  }, (e) => { console.error(String((e && e.message) || e)); process.exit(1); });
}
