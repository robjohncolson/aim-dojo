#!/usr/bin/env node
// THE COLD LOAD, MEASURED (SPEC_THE_INVITATION parcel C). A friend's first impression is the seconds before PLAY
// lights. This measures them on the real site with an empty cache, and doubles as a boot smoke (page errors and
// console errors are printed). No __dbg: production origin, pure DOM observation.
//
//   node tools/coldload.mjs                              # https://aim-dojo.vercel.app/ · both profiles · 5 runs each
//   node tools/coldload.mjs --url http://127.0.0.1:8931/index.html --profile desktop --runs 1
//   node tools/coldload.mjs --profile friend --runs 3
//
// puppeteer-core is NOT a repo dependency: point COLDLOAD_MODULES at a node_modules that has it (or install it
// beside this file). Chrome: --chrome <path> or CHROME_PATH; the usual Windows/Linux paths are tried.
//
// Numbers (per run): T_play = ms until #beginTrain is enabled (setGateReady true) · bytes = encoded bytes received
// before T_play · T_frame = ms from a synthetic PLAY click to the first animation frame after the start card hides ·
// worst = the longest frame in the 5 s after that. Budget (friend profile): T_play ≤ 4000 · T_frame ≤ 1500 · bytes ≤ 1.5 MB.

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const PROFILES = {
  desktop: { cpu: 1, net: null },
  friend: { cpu: 4, net: { downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8, latency: 40, offline: false } },
};
const BUDGET = { tPlay: 4000, tFrame: 1500, bytes: 1.5 * 1024 * 1024 };
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function parseArgs(argv) {
  const out = { url: "https://aim-dojo.vercel.app/", profiles: ["desktop", "friend"], runs: 5, chrome: "", headful: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.url = String(argv[++i] || "");
    else if (a === "--profile") out.profiles = [String(argv[++i] || "")];
    else if (a === "--runs") out.runs = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--chrome") out.chrome = String(argv[++i] || "");
    else if (a === "--headful") out.headful = true;
    else throw new Error("unknown argument: " + a);
  }
  for (const p of out.profiles) if (!PROFILES[p]) throw new Error("unknown profile: " + p);
  return out;
}

function loadPuppeteer() {
  const base = process.env.COLDLOAD_MODULES ? path.join(process.env.COLDLOAD_MODULES, "x.js") : import.meta.url;
  try { return createRequire(base)("puppeteer-core"); }
  catch (e) { throw new Error("puppeteer-core not found — set COLDLOAD_MODULES to a node_modules dir that has it (" + (e && e.message) + ")"); }
}

function median(xs) { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; }

async function oneRun(browser, url, profile) {
  const context = await browser.createBrowserContext();   // a fresh context = an empty cache: the friend's first visit
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e && e.message || e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0, 200)); });
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  let bytes = 0, bytesAtPlay = null;
  cdp.on("Network.loadingFinished", (ev) => { bytes += ev.encodedDataLength || 0; });
  if (profile.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
  if (profile.net) await cdp.send("Network.emulateNetworkConditions", profile.net);
  await page.setViewport({ width: 1280, height: 800 });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  let tPlay = null;
  try {
    await page.waitForFunction(() => { const b = document.getElementById("beginTrain"); return !!b && !b.disabled; }, { timeout: 45000, polling: 50 });
    tPlay = Date.now() - t0; bytesAtPlay = bytes;
  } catch (e) { errors.push("PLAY never enabled within 45 s"); }
  let tFrame = null, worst = null;
  if (tPlay !== null) {
    await page.evaluate(() => {
      window.__cl = { click: performance.now(), first: null, worst: 0, last: null, frames: 0 };
      const ov = document.getElementById("overlay");
      const tick = (now) => {
        const s = window.__cl;
        if (s.first === null && ov && (ov.classList.contains("hidden") || getComputedStyle(ov).display === "none" || getComputedStyle(ov).visibility === "hidden")) s.first = now;
        if (s.first !== null) { if (s.last !== null) s.worst = Math.max(s.worst, now - s.last); s.last = now; s.frames++; }
        if (s.first === null || now - s.first < 5000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.click("#beginTrain").catch(() => {});
    await new Promise((r) => setTimeout(r, 7000));
    const s = await page.evaluate(() => window.__cl);
    if (s && s.first !== null) { tFrame = Math.round(s.first - s.click); worst = Math.round(s.worst); }
    else errors.push("start card never hid after PLAY (pointer lock may be unavailable headless — T_frame unmeasured)");
  }
  await context.close();
  return { tPlay, bytes: bytesAtPlay, tFrame, worst, errors };
}

const isMain = process.argv[1] && /coldload\.mjs$/.test(process.argv[1]);
if (isMain) {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(String(e.message || e)); process.exit(2); }
  const puppeteer = loadPuppeteer();
  const chrome = args.chrome || CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  if (!chrome) { console.error("no Chrome found — pass --chrome <path>"); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath: chrome, headless: !args.headful, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--no-first-run"] });
  let failed = false;
  try {
    for (const name of args.profiles) {
      const runs = [];
      for (let i = 0; i < args.runs; i++) runs.push(await oneRun(browser, args.url, PROFILES[name]));
      const med = (k) => median(runs.map((r) => r[k]).filter((v) => v !== null && v !== undefined));
      const row = { profile: name, runs: args.runs, T_play_ms: med("tPlay"), bytes_before_play: med("bytes"), T_frame_ms: med("tFrame"), worst_frame_ms: med("worst") };
      const over = name === "friend" && ((row.T_play_ms ?? Infinity) > BUDGET.tPlay || (row.T_frame_ms ?? 0) > BUDGET.tFrame || (row.bytes_before_play ?? Infinity) > BUDGET.bytes);
      console.log(`| ${name} | ${args.runs} | ${row.T_play_ms ?? "?"} ms | ${row.bytes_before_play == null ? "?" : (row.bytes_before_play / 1024).toFixed(0) + " KB"} | ${row.T_frame_ms ?? "?"} ms | ${row.worst_frame_ms ?? "?"} ms |${over ? " OVER BUDGET" : ""}`);
      const errs = [...new Set(runs.flatMap((r) => r.errors))];
      for (const e of errs) console.log("  ! " + e);
      if (errs.some((e) => /pageerror|never enabled/.test(e))) failed = true;
    }
    console.log("columns: profile | runs | T_play (median) | bytes before PLAY | T_frame | worst frame in first 5 s · budget (friend): T_play ≤ 4000 ms, T_frame ≤ 1500 ms, bytes ≤ 1536 KB");
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
}
