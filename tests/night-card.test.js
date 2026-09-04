"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const { sourceText: html } = require("./source.js");

function extractFunction(source, name) {
  const match = source.match(new RegExp(`function ${name}\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${name} is extractable`);
  return match[0];
}

function replaceFunction(source, name, mutate) {
  const before = extractFunction(source, name);
  const after = mutate(before);
  assert.notEqual(after, before, `${name} mutation is constructible`);
  return source.replace(before, after);
}

function mutationMustFail(assertContract, mutation, message) {
  assert.notEqual(mutation, html, `${message} is constructible`);
  assert.throws(() => assertContract(mutation), assert.AssertionError, message);
}

function cardBlock(source) {
  const match = source.match(/\/\* ---- NIGHT CARDS \(wave 5a, parcel O\) ----[\s\S]*?(?=\nfunction onGrid\()/);
  assert.ok(match, "the Night Card block is extractable");
  return match[0];
}

test("Night Card capture starts only after the Bow has ended on the report card", () => {
  const assertContract = (source) => {
    const hold = extractFunction(source, "bowEnterHold");
    assert.doesNotMatch(hold, /cardSave|cardPaint|cardCaptureSchedule|toBlob|toDataURL/, "the ceremony owns no card work");
    const pause = extractFunction(source, "showPause");
    const reportAt = pause.indexOf("overlay.classList.remove('hidden');");
    const saveAt = pause.indexOf("if(state.needsReset) cardSave();");
    const scheduleAt = pause.indexOf("cardCaptureSchedule();", saveAt);
    assert.ok(reportAt >= 0 && saveAt > reportAt && scheduleAt > saveAt, "the visible completed-session report precedes save and scheduling");
    const capture = extractFunction(source, "cardCaptureSchedule");
    assert.match(capture, /if\(state\.running \|\| \(state\.started&&!state\.needsReset\)\) return;/, "live and merely-paused sessions cannot capture");
    const idleAt = capture.indexOf("runIdle(()=>{");
    const paintAt = capture.indexOf("cardPaint();");
    const encodeAt = capture.indexOf("cv.toBlob(");
    assert.ok(idleAt >= 0 && paintAt > idleAt && encodeAt > paintAt, "idle owns paint then asynchronous encode");
  };
  assertContract(html);
  const mutation = replaceFunction(html, "bowEnterHold", (fn) => fn.replace("  if(CFG.chorus.on)", "  cardPaint();\n  if(CFG.chorus.on)"));
  mutationMustFail(assertContract, mutation, "the timing oracle kills capture restored inside the ceremony");
});

test("idle capture paints once and publishes only the asynchronous PNG Blob", () => {
  const assertContract = (source) => {
    const block = cardBlock(source);
    const capture = extractFunction(source, "cardCaptureSchedule");
    assert.doesNotMatch(block, /toDataURL/, "no synchronous canvas encoder survives");
    assert.equal((capture.match(/cardPaint\(\);/g) || []).length, 1, "one idle paint");
    assert.equal((capture.match(/cv\.toBlob\(/g) || []).length, 1, "one asynchronous PNG encode");
    assert.match(capture, /_cardBlob=blob;\s*cardOffer\(\);/, "the offer follows Blob publication");
  };
  assertContract(html);
  const events = [];
  let idle = null;
  const rec = { d: "2026-08-23" };
  const blob = { type: "image/png" };
  const canvas = {
    toBlob(callback, type) {
      events.push(["toBlob", type]);
      callback(blob);
    },
  };
  const context = vm.createContext({
    CFG: { nightCard: { on: true } },
    state: { running: true, started: true, needsReset: false },
    _cardCaptureQueued: false,
    _cardCaptureSeq: 0,
    _cardBlob: null,
    cardFresh() { events.push("fresh"); return rec; },
    cardOffer() { events.push("offer"); },
    cardCanvasEl() { events.push("canvas"); return canvas; },
    cardPaint() { events.push("paint"); },
    runIdle(callback, delay, timeout) { events.push(["idle", delay, timeout]); idle = callback; },
  });
  new vm.Script(`${extractFunction(html, "cardCaptureSchedule")}\nthis.schedule=cardCaptureSchedule;`).runInContext(context);
  context.schedule();
  assert.equal(idle, null, "a live session cannot even queue capture");
  assert.doesNotMatch(events.join("|"), /paint|toBlob/);
  context.state.running = false;
  context.state.needsReset = true;
  context.schedule();
  assert.equal(typeof idle, "function");
  assert.doesNotMatch(events.join("|"), /paint|toBlob/, "queueing itself does no canvas work");
  idle();
  assert.deepEqual(events.slice(-5), ["canvas", "paint", ["toBlob", "image/png"], "fresh", "offer"]);
  assert.equal(context._cardBlob, blob);
  const mutation = replaceFunction(html, "cardCaptureSchedule", (fn) => fn.replace("cv.toBlob(", "cv.toDataURL("));
  mutationMustFail(assertContract, mutation, "the encoder oracle kills restoration of synchronous toDataURL");
});

test("copy and download reuse the captured Blob and revoke the download URL", async () => {
  const assertContract = (source) => {
    const layout = source.match(/function cardDateText\(d\)\{[\s\S]*?(?=\nfunction cardDownload\()/);
    assert.ok(layout);
    assert.equal(layout[0].length, 6880, "the card painter and filename block keeps its byte length (re-pinned 2026-09-03: SPEC_THE_INVITATION parcel B adds the link line + cardLinkText)");
    assert.equal(crypto.createHash("sha256").update(layout[0]).digest("hex"), "c8e929af207b50c3a3fef30861c3312663d2ef8a458f1eb3984ba40022959771", "layout, pixels, and filename stay byte-preserved");
    const download = extractFunction(source, "cardDownload");
    assert.match(download, /u=URL\.createObjectURL\(blob\);/);
    assert.match(download, /URL\.revokeObjectURL\(u\)/);
    assert.doesNotMatch(extractFunction(source, "cardCopy"), /cardPaint|toBlob|toDataURL/, "sharing reuses the captured Blob");
  };
  assertContract(html);
  const events = [];
  const writes = [];
  const notes = [];
  const blob = { type: "image/png" };
  const body = {
    appendChild(node) { events.push("append"); node.parentNode = this; },
    removeChild(node) { events.push("remove"); node.parentNode = null; },
  };
  const anchor = { parentNode: null, style: {}, click() { events.push("click"); } };
  const urlApi = {
    createObjectURL(value) { events.push(["create", value]); return "blob:night-card"; },
    revokeObjectURL(value) { events.push(["revoke", value]); },
  };
  class ClipboardItem {
    constructor(data) { this.data = data; }
  }
  const context = vm.createContext({
    _cardBlob: blob,
    cardFresh: () => ({ d: "2026-08-23" }),
    cardFileName: () => "moon-chorus-2026-08-23.png",
    cardNote: (message) => notes.push(message),
    T: (_key, fallback) => fallback,
    window: { URL: urlApi, ClipboardItem },
    URL: urlApi,
    ClipboardItem,
    navigator: { clipboard: { write(items) { writes.push(items); return Promise.resolve(); } } },
    document: { createElement: () => anchor, body },
    setTimeout(callback, delay) { events.push(["timer", delay]); callback(); },
  });
  new vm.Script(`${extractFunction(html, "cardDownload")}\n${extractFunction(html, "cardCopy")}\nthis.download=cardDownload;this.copy=cardCopy;`).runInContext(context);
  context.download();
  assert.equal(anchor.download, "moon-chorus-2026-08-23.png");
  assert.equal(anchor.href, "blob:night-card");
  assert.deepEqual(events.filter((event) => Array.isArray(event) && event[0] === "create"), [["create", blob]]);
  assert.deepEqual(events.filter((event) => Array.isArray(event) && event[0] === "revoke"), [["revoke", "blob:night-card"]]);
  assert.ok(events.includes("click"));
  assert.ok(events.includes("remove"));
  context.copy();
  await Promise.resolve();
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0].data["image/png"], blob);
  assert.match(notes.at(-1), /CARD COPIED/);
  const mutation = replaceFunction(html, "cardDownload", (fn) => fn.replace("    setTimeout(()=>{ try{ URL.revokeObjectURL(u); }catch(e){} }, 4000);\n", ""));
  mutationMustFail(assertContract, mutation, "the Blob URL oracle kills a download that never revokes its object URL");
});

test("nightCard.on false performs no capture, DOM lookup, listener wiring, storage, or offer", () => {
  const assertContract = (source) => {
    const block = cardBlock(source);
    assert.match(source, /<button class="ghost" id="nightCardBtn" style="display:none">/, "the shipped button starts absent");
    assert.match(block, /\(function\(\)\{\n  if\(!CFG\.nightCard\.on\) return;/, "listener initialization exits on the raw knob");
    assert.match(extractFunction(source, "cardCaptureSchedule"), /\{\n  if\(!CFG\.nightCard\.on \|\|/, "capture exits on the raw knob");
    assert.match(extractFunction(source, "showPause"), /if\(CFG\.nightCard\.on\)\{\n    if\(state\.needsReset\) cardSave\(\);\n    cardCaptureSchedule\(\);\n  \}/, "the report card reads no Night Card state while off");
    assert.match(source, /if\(CFG\.nightCard\.on\) cardCaptureSchedule\(\);\nif\(SKY_MODE/, "boot capture is raw-knob guarded");
    assert.match(source, /if\(CFG\.nightCard\.on\) cardStar\(id\);/);
    assert.match(source, /if\(CFG\.nightCard\.on\) _cardStars\.length=0;/);
  };
  assertContract(html);
  const initializer = cardBlock(html).match(/\(function\(\)\{\n  if\(!CFG\.nightCard\.on\) return;[\s\S]*?\n\}\)\(\);/);
  assert.ok(initializer);
  let touched = 0;
  const initContext = vm.createContext({ CFG: { nightCard: { on: false } }, gid() { touched++; throw new Error("off knob touched the DOM"); } });
  assert.doesNotThrow(() => new vm.Script(initializer[0]).runInContext(initContext));
  const captureContext = vm.createContext({
    CFG: { nightCard: { on: false } },
    _cardCaptureQueued: false,
    _cardBlob: null,
    cardFresh() { touched++; throw new Error("off knob opened storage"); },
    runIdle() { touched++; throw new Error("off knob queued capture"); },
  });
  new vm.Script(`${extractFunction(html, "cardCaptureSchedule")}\ncardCaptureSchedule();`).runInContext(captureContext);
  assert.equal(touched, 0);
  const mutation = html.replace("  if(!CFG.nightCard.on) return;", "  if(false) return;");
  mutationMustFail(assertContract, mutation, "the off-knob oracle kills listener initialization without the raw guard");
});
