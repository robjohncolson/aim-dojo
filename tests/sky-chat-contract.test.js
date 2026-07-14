"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blockEnd(openIndex) {
  assert.equal(html[openIndex], "{", "block starts with an opening brace");
  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < html.length; i += 1) {
    const char = html[i];
    const next = html[i + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return i + 1;
  }

  assert.fail("unterminated JavaScript block");
}

function namedFunction(name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${regexEscape(name)}\\s*\\(`).exec(html);
  assert.ok(match, `${name} exists`);
  const open = html.indexOf("{", match.index + match[0].length);
  assert.notEqual(open, -1, `${name} has a body`);
  return html.slice(match.index, blockEnd(open));
}

function callbackBlock(marker) {
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `${marker} callback exists`);
  const open = html.indexOf("{", start + marker.length);
  assert.notEqual(open, -1, `${marker} callback has a body`);
  return html.slice(start, blockEnd(open));
}

function keyListenerContaining(anchor) {
  const anchorIndex = html.indexOf(anchor);
  assert.notEqual(anchorIndex, -1, `${anchor} key listener exists`);
  const single = html.lastIndexOf("document.addEventListener('keydown'", anchorIndex);
  const double = html.lastIndexOf('document.addEventListener("keydown"', anchorIndex);
  const start = Math.max(single, double);
  assert.ok(start >= 0, `${anchor} is inside a keydown listener`);
  const open = html.indexOf("{", start);
  assert.ok(open >= 0 && open < anchorIndex, `${anchor} is inside the listener callback`);
  return html.slice(start, blockEnd(open));
}

function indexBefore(source, first, second, message) {
  const left = source.search(first);
  const right = source.search(second);
  assert.ok(left >= 0, `${message}: first anchor exists`);
  assert.ok(right >= 0, `${message}: second anchor exists`);
  assert.ok(left < right, message);
}

const CHAT_PRIVATE = /(?:_skyChat|skyChat|skyTempleChat|sky[_-]?chat|thread_id|turn_id|\breply\b|\bmessage\b|\bfocus\b|\bturns\b)/i;

test("CFG.skyChat is the exact C2 client contract", () => {
  const match = html.match(/skyChat\s*:\s*\{([^{}]+)\}/);
  assert.ok(match, "CFG.skyChat exists");
  const value = vm.runInNewContext(`({${match[1]}})`);
  assert.deepEqual(JSON.parse(JSON.stringify(value)), {
    enabled: true,
    openKey: "KeyT",
    maxMessageChars: 500,
    pollMs: 3000,
    pollMaxMs: 90000,
  });
});

test("the Temple panel owns a safe, non-serializing ASK composer", () => {
  const panel = html.match(/<aside\s+id=["']skyTemplePanel["'][^>]*>[\s\S]*?<\/aside>/i);
  assert.ok(panel, "Sky Temple panel exists");
  const start = panel[0].search(/<section\s+class=["'][^"']*sky-temple-chat[^"']*["']\s+id=["']skyTempleChat["']/i);
  assert.ok(start >= 0, "chat is a section of the Temple panel");
  const end = panel[0].indexOf("</section>", start);
  assert.ok(end > start, "chat section closes inside the Temple panel");
  const chat = panel[0].slice(start, end + "</section>".length);

  assert.ok(panel[0].indexOf('id="skyTempleBody"') < start, "study body remains above dialogue");
  assert.match(chat, /id=["']skyTempleChat["'][^>]*\shidden(?:\s|>|=)/i);
  assert.match(chat, /id=["']skyTempleChatAsk["'][^>]*\btype=["']button["'][^>]*>[\s\S]*ASK THE SKY/i);
  assert.match(chat, /id=["']skyTempleChatDialog["'][^>]*\shidden(?:\s|>|=)/i);
  assert.match(chat, /id=["']skyTempleChatTurns["'][^>]*\brole=["']log["'][^>]*\baria-live=["']polite["']/i);
  assert.match(chat, /id=["']skyTempleChatStatus["'][^>]*\brole=["']status["'][^>]*\baria-live=["']polite["']/i);
  assert.match(chat, /<form[^>]*id=["']skyTempleChatForm["'][^>]*>/i);

  const input = chat.match(/<textarea[^>]*id=["']skyTempleChatInput["'][^>]*>/i);
  const send = chat.match(/<button[^>]*id=["']skyTempleChatSend["'][^>]*>/i);
  assert.ok(input && send, "composer has an input and SEND control");
  assert.match(input[0], /\bmaxlength=["']500["']/i);
  assert.match(send[0], /\btype=["']submit["']/i);
  assert.match(chat, /id=["']skyTempleChatEpistemic["'][^>]*>[\s\S]*symbolic[\s\S]*not predictions/i);
  assert.doesNotMatch(chat, /\sname\s*=/i, "native form serialization cannot capture chat text");
  assert.doesNotMatch(chat, /\baction\s*=|\bmethod\s*=/i, "chat has no native network fallback");
});

test("chat visibility, opening, and POST all require a live authenticated chart", () => {
  const access = namedFunction("skyChatAccessEligible");
  assert.match(access, /CFG\.skyChat\.enabled/);
  assert.match(access, /_skyAuthSession[\s\S]*access_token/);
  assert.match(access, /_skyProfileController/);
  assert.match(access, /authenticated/);
  assert.match(access, /hasChart/);
  assert.match(access, /postSkyChat/);
  assert.match(access, /getSkyChat/);
  assert.doesNotMatch(access, /_personalListenExpected/, "legacy Listen expectation cannot grant chat access");

  const temple = namedFunction("skyChatTempleEligible");
  assert.match(temple, /state\.running/);
  assert.match(temple, /templeActive/);
  assert.match(temple, /skyChatAccessEligible\s*\(/);

  const render = namedFunction("renderSkyChatUi");
  assert.match(render, /skyChatTempleEligible\s*\(/);
  assert.match(render, /\.root\.hidden\s*=\s*!\s*eligible|skyTempleChat[^;\n]*\.hidden\s*=\s*!\s*eligible/i);

  const open = namedFunction("openSkyChatComposer");
  indexBefore(open, /skyChatTempleEligible\s*\(/, /_templeChatOpen\s*=\s*true/, "eligibility is checked before opening");
  indexBefore(open, /skyChatTempleEligible\s*\(/, /exitPointerLock\s*\(/, "eligibility is checked before pointer unlock");
  assert.doesNotMatch(open, /_personalListenExpected/);

  const send = namedFunction("sendSkyChatQuestion");
  indexBefore(send, /skyChatTempleEligible\s*\(/, /postSkyChat\s*\(/, "auth + chart + Temple gate precedes POST");
  indexBefore(send, /_templeChatOpen/, /postSkyChat\s*\(/, "closed composers cannot POST");
  assert.doesNotMatch(send, /_personalListenExpected/, "legacy Listen state cannot authorize POST");
});

test("T is Temple-only and Esc closes the composer before typing/pause handling", () => {
  const openKey = keyListenerContaining("CFG.skyChat.openKey");
  assert.match(openKey, /e\.code\s*!==\s*CFG\.skyChat\.openKey/);
  assert.match(openKey, /e\.repeat/);
  assert.match(openKey, /!\s*templeActive|skyChatTempleEligible\s*\(/);
  assert.match(openKey, /isTypingTarget\s*\(\s*e\.target\s*\)/);
  assert.match(openKey, /skyChatAccessEligible\s*\(|skyChatTempleEligible\s*\(/);
  assert.match(openKey, /openSkyChatComposer\s*\(/);
  indexBefore(openKey, /isTypingTarget\s*\(/, /openSkyChatComposer\s*\(/, "typing guard precedes T open");
  indexBefore(openKey, /skyChat(?:Access|Temple)Eligible\s*\(/, /openSkyChatComposer\s*\(/, "access gate precedes T open");
  assert.doesNotMatch(openKey, /_personalListenExpected/);

  const escapeKey = keyListenerContaining("e.code!=='Escape'");
  assert.match(escapeKey, /_templeChatOpen/);
  assert.match(escapeKey, /closeSkyChatComposer\s*\(/);
  assert.match(escapeKey, /preventDefault\s*\(/);
  assert.match(escapeKey, /stopImmediatePropagation\s*\(/);
  indexBefore(escapeKey, /_templeChatOpen/, /isTypingTarget\s*\(/, "Esc closes chat even when its textarea has focus");
  indexBefore(escapeKey, /closeSkyChatComposer\s*\(/, /if\s*\(\s*templeActive\s*\)/, "composer close wins before Temple pause");
  assert.match(escapeKey, /_templeChatOpen[\s\S]*closeSkyChatComposer\s*\([\s\S]*?return\s*;/, "Esc returns after closing only the composer");
});

test("server turn text is rendered as text and chat runtime stays memory-only", () => {
  const render = namedFunction("renderSkyChatUi");
  assert.match(render, /document\.createElement\s*\(/, "turn rows use DOM builders");
  assert.match(render, /(?:textContent\s*=|setText\s*\([^,]+,)\s*[^;\n]*turn\.text/, "model text reaches only a text sink");
  assert.doesNotMatch(render, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/);

  const chatRuntime = [
    "skyChatAccessEligible", "skyChatTempleEligible", "renderSkyChatUi", "openSkyChatComposer",
    "closeSkyChatComposer", "sendSkyChatQuestion", "refreshSkyChatForTemple",
    "skyChatVisibilityChanged", "skyChatReset",
  ].map(namedFunction).join("\n");
  assert.doesNotMatch(chatRuntime, /localStorage|sessionStorage|queueCloudPrefs\s*\(|broadcastAim\s*\(|submitDojo\s*\(/,
    "private day dialogue remains session-memory state only");
});

test("send paints the optimistic question and listening state before POST", () => {
  const send = namedFunction("sendSkyChatQuestion");
  assert.match(send, /const\s+payload\s*=\s*\{\s*message\s*:\s*message\s*,\s*focus\s*:\s*currentSkyChatFocus\s*\(\s*\)\s*\}/);
  assert.doesNotMatch(send, /payload\.thread_id/, "POST lets the server bind the current civil-day thread");
  assert.match(send, /\{\s*role\s*:\s*['"]user['"]\s*,\s*text\s*:\s*message\s*,\s*focus\s*:\s*payload\.focus/);
  indexBefore(send, /_skyChat\.turns\s*=/, /_skyChat\.status\s*=\s*['"]pending['"]/, "optimistic user turn precedes pending state");
  indexBefore(send, /_skyChat\.status\s*=\s*['"]pending['"]/, /renderSkyChatUi\s*\(/, "pending state is rendered immediately");
  indexBefore(send, /renderSkyChatUi\s*\(/, /postSkyChat\s*\(/, "optimistic render precedes the network request");
  assert.match(send, /_skyChat\.optimistic\s*=\s*true/);
  assert.match(send, /_skyChat\.startedAt\s*=\s*Date\.now\s*\(\s*\)/);
  assert.match(send, /error\s*&&\s*error\.retryable[\s\S]*_skyChat\.status\s*=\s*['"]pending['"][\s\S]*skyChatSchedulePoll\s*\(/,
    "an ambiguous retryable POST failure keeps polling for a possibly accepted job");
  const apply = namedFunction("skyChatApplyEnvelope");
  assert.match(apply, /!hadOptimistic\s*\|\|\s*record\.status\s*===\s*['"]limited['"][\s\S]*_skyChat\.turns\s*=\s*\[\s*\]/,
    "an authoritative empty limited envelope removes the rejected optimistic line");

  const render = namedFunction("renderSkyChatUi");
  assert.match(render, /if\s*\(\s*_skyChat\.status\s*===\s*['"]pending['"]\s*\)/);
  assert.match(render, /sky-temple-chat-turn assistant pending/);
  assert.match(render, /textContent\s*=\s*T\s*\(\s*['"]skyChatListening['"]\s*,\s*['"]listening…['"]\s*\)/);
});

test("pending polling is visible-only, bounded to 3–4 seconds, and stops at pollMaxMs", () => {
  const schedule = namedFunction("skyChatSchedulePoll");
  assert.match(schedule, /_skyChat\.status\s*!==\s*['"]pending['"]/);
  assert.match(schedule, /Date\.now\s*\(\s*\)\s*-\s*\(\s*_skyChat\.startedAt/);
  assert.match(schedule, /elapsed\s*>=\s*CFG\.skyChat\.pollMaxMs/);
  assert.match(schedule, /_skyChat\.status\s*=\s*['"]unavailable['"]/);
  indexBefore(schedule, /document\.hidden/, /setTimeout\s*\(/, "hidden tabs cannot arm a poll timer");
  assert.match(schedule, /Math\.min\s*\(\s*4000\s*,\s*CFG\.skyChat\.pollMs\s*\+\s*Math\.min\s*\(\s*2\s*,\s*_skyChat\.pollStep\s*\)\s*\*\s*500\s*\)/,
    "backoff is 3000, 3500, then 4000ms");
  assert.match(schedule, /_skyChat\.pollTimer\s*=\s*setTimeout/);

  const poll = namedFunction("skyChatPoll");
  indexBefore(poll, /document\.hidden/, /getSkyChat\s*\(/, "hidden tabs cannot issue GET polls");
  assert.match(poll, /_skyChat\.status\s*!==\s*['"]pending['"]/);
  assert.match(poll, /CFG\.skyChat\.pollMaxMs/);

  const visibility = namedFunction("skyChatVisibilityChanged");
  assert.match(visibility, /if\s*\(\s*document\.hidden\s*\)\s*\{[\s\S]*skyChatClearPoll\s*\(\s*\)[\s\S]*return/);
  indexBefore(visibility, /document\.hidden/, /skyChatSchedulePoll\s*\(/, "only the visible branch resumes pending polling");
  assert.match(visibility, /_skyChat\.status\s*===\s*['"]pending['"]/);

  const browserVisibility = callbackBlock("document.addEventListener('visibilitychange'");
  assert.match(browserVisibility, /skyChatVisibilityChanged\s*\(\s*\)/);
});

test("composer pointer unlock is guarded and the next canvas click relocks without firing", () => {
  const open = namedFunction("openSkyChatComposer");
  indexBefore(open, /_templeEscapeGuard\s*=\s*true/, /exitPointerLock\s*\(/, "pointer-lock exit is armed as a composer transition");
  assert.match(open, /catch\s*\([^)]*\)\s*\{\s*_templeEscapeGuard\s*=\s*false/);

  const close = namedFunction("closeSkyChatComposer");
  assert.match(close, /skyChatDismissComposer\s*\(\s*\)/);
  assert.doesNotMatch(close, /requestPointerLock\s*\(/, "closing defers relock to the next canvas gesture");
  const dismiss = namedFunction("skyChatDismissComposer");
  assert.match(dismiss, /_templeChatOpen\s*=\s*false/);
  assert.match(dismiss, /_templeNeedsRelock\s*=\s*true/);
  assert.doesNotMatch(dismiss, /requestPointerLock\s*\(/, "the shared forced-close path also defers relock");
  const render = namedFunction("renderSkyChatUi");
  assert.match(render, /!eligible\s*&&\s*_templeChatOpen\s*\)\s*skyChatDismissComposer\s*\(\s*\)/,
    "auth/chart eligibility loss uses the same relock-safe close path");

  const pointerChange = callbackBlock("document.addEventListener('pointerlockchange'");
  indexBefore(pointerChange, /_templeEscapeGuard/, /exitRunning\s*\(/, "composer pointer unlock is consumed before pause handling");
  assert.match(pointerChange, /else\s+if\s*\(\s*_templeEscapeGuard\s*\)\s*\{[^{}]*_templeEscapeGuard\s*=\s*false[^{}]*_templeNeedsRelock\s*=\s*true[^{}]*\}/,
    "the guarded unlock branch requests a later relock without pausing");

  const fire = namedFunction("fire");
  indexBefore(fire, /_templeChatOpen/, /focusSkyTempleReticle\s*\(/, "open chat suppresses Temple focus fire");
  indexBefore(fire, /_templeChatOpen/, /spawnProjectile\s*\(/, "open chat suppresses combat fire");
  assert.match(fire, /if\s*\(\s*_templeChatOpen\s*\)\s*return/);

  const canvasMouse = callbackBlock("canvas.addEventListener('mousedown'");
  indexBefore(canvasMouse, /_templeChatOpen/, /closeSkyChatComposer\s*\(/, "canvas click first recognizes the composer");
  indexBefore(canvasMouse, /closeSkyChatComposer\s*\(/, /requestPointerLock\s*\(/, "canvas closes before requesting relock");
  indexBefore(canvasMouse, /requestPointerLock\s*\(/, /return\s*;/, "relock gesture is consumed");
  indexBefore(canvasMouse, /_templeChatOpen/, /fire\s*\(\s*\)/, "open-chat branch precedes every fire call");
  assert.match(canvasMouse, /_templeChatOpen[\s\S]*closeSkyChatComposer\s*\(\s*false\s*\)[\s\S]*return\s*;/);
});

test("pause preserves the day thread, while account/chart/full resets clear it", () => {
  const exitTemple = namedFunction("exitSkyTemple");
  indexBefore(exitTemple, /closeSkyChatComposer\s*\(\s*false\s*\)/, /snapshotTempleForResume\s*\(/, "pause closes the composer before taking the Temple snapshot");
  assert.doesNotMatch(exitTemple, /skyChatReset\s*\(|_skyChat\.(?:threadId|turns)\s*=/,
    "leaving or pausing Temple does not erase the in-memory day thread");

  const pause = namedFunction("exitRunning");
  assert.match(pause, /exitSkyTemple\s*\(\s*\{\s*forPause\s*:\s*true/);
  assert.doesNotMatch(pause, /skyChatReset\s*\(/);

  const restore = namedFunction("restoreTempleAfterResume");
  assert.match(restore, /enterSkyTemple\s*\(\s*\{\s*quiet\s*:\s*true\s*,\s*resumeFocus/);
  assert.doesNotMatch(restore, /skyChatReset\s*\(/);
  const enterTemple = namedFunction("enterSkyTemple");
  indexBefore(enterTemple, /setSkyTempleFocus\s*\(/, /refreshSkyChatForTemple\s*\(/, "restored focus is installed before the thread GET");
  assert.doesNotMatch(enterTemple, /skyChatReset\s*\(/);
  const refresh = namedFunction("refreshSkyChatForTemple");
  assert.match(refresh, /getSkyChat\s*\(\s*\)/,
    "Temple entry refreshes the current civil-day thread");
  assert.doesNotMatch(refresh, /getSkyChat\s*\(\s*_skyChat\.threadId/,
    "Temple entry cannot resurrect yesterday by id");
  const pendingPoll = namedFunction("skyChatPoll");
  assert.match(pendingPoll, /getSkyChat\s*\(\s*_skyChat\.threadId\s*\|\|\s*undefined\s*\)/,
    "the preserved id remains available for an active pending turn");

  const reset = namedFunction("skyChatReset");
  assert.match(reset, /skyChatDismissComposer\s*\(\s*\)/, "forced reset retains the deferred-relock path");
  assert.match(reset, /skyChatClearPoll\s*\(\s*\)/);
  assert.match(reset, /\+\+_skyChat\.seq/);
  assert.match(reset, /_skyChat\.threadId\s*=\s*null/);
  assert.match(reset, /_skyChat\.turns\s*=\s*\[\s*\]/);
  assert.match(reset, /_skyChat\.status\s*=\s*['"]none['"]/);
  assert.match(reset, /_skyChat\.optimistic\s*=\s*false/);

  const fullReset = namedFunction("resetSession");
  assert.match(fullReset, /skyChatReset\s*\(\s*\)/, "a fresh full run clears local dialogue state");

  const acceptSession = namedFunction("skyAcceptAuthSession");
  assert.match(acceptSession, /if\s*\(\s*next\s*!==\s*_skyAuthUser\s*\)\s*\{[\s\S]*skyChatReset\s*\(\s*\)/,
    "account switch/sign-out synchronously quarantines the prior thread");
  const handleSession = namedFunction("skyHandleSession");
  assert.match(handleSession, /if\s*\(\s*!next\s*\)\s*\{[\s\S]*skyChatReset\s*\(\s*\)[\s\S]*return/,
    "resolved guest state clears local dialogue");
  const signOut = callbackBlock("if(skySave.signOut) skySave.signOut.addEventListener('click'");
  assert.match(signOut, /_skyAuthClient\.auth\.signOut\s*\(\s*\)/);

  const clearChart = callbackBlock("if(skySave.clear) skySave.clear.addEventListener('click'");
  indexBefore(clearChart, /await\s+pending/, /skyChatReset\s*\(\s*\)/, "confirmed chart deletion clears local dialogue state");
  assert.match(clearChart, /const\s+pending\s*=\s*ctl\.clear\s*\(\s*\)/);
});

test("chat state cannot enter share, dojo, presence, leaderboard, or cloud-pref sinks", () => {
  const outbound = {
    share: namedFunction("linkUrl"),
    dojoSession: namedFunction("dojoSession"),
    leaderboardSubmit: namedFunction("submitDojo"),
    realtimeSetup: namedFunction("initRealtime"),
    presenceBroadcast: namedFunction("broadcastAim"),
    localPrefs: namedFunction("localPrefSnapshot"),
    cloudPrefs: namedFunction("queueCloudPrefs"),
  };
  for (const [name, source] of Object.entries(outbound)) {
    assert.doesNotMatch(source, CHAT_PRIVATE, `${name} contains no chat state or payload fields`);
  }

  assert.match(outbound.share, /location\.origin\s*\+\s*location\.pathname/);
  assert.doesNotMatch(outbound.share, /location\.(?:search|hash)|URLSearchParams/);

  const dojoRow = outbound.leaderboardSubmit.match(/const\s+row\s*=\s*\{([^{}]+)\}/);
  assert.ok(dojoRow, "leaderboard POST row is a literal allowlist");
  const dojoKeys = [...dojoRow[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)].map((match) => match[1]);
  assert.deepEqual(dojoKeys, ["client_id", "name", "peak_bpm", "runtime", "far", "high", "streak", "kills"]);

  const aimPayload = outbound.presenceBroadcast.match(/payload\s*:\s*\{([^{}]+)\}/);
  assert.ok(aimPayload, "realtime aim payload is a literal allowlist");
  const aimKeys = [...aimPayload[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)].map((match) => match[1]);
  assert.deepEqual(aimKeys, ["id", "n", "y", "p", "k", "s"]);

  const cloudSelect = html.match(/const\s+CLOUD_PREF_SELECT\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(cloudSelect, "cloud preference columns are explicit");
  assert.deepEqual(cloudSelect[1].split(","), [
    "sky_time", "wasd_hud", "offset_ms", "low_rez", "display_name",
    "dojo_sort", "sky_mode", "sound_on", "wasd_tap_text",
  ]);

  const cloudCallCount = (html.match(/queueCloudPrefs\s*\(/g) || []).length - 1;
  const cloudCalls = [...html.matchAll(/queueCloudPrefs\s*\(\s*\{([^{}]*)\}\s*\)/g)];
  assert.equal(cloudCalls.length, cloudCallCount, "every cloud-pref write uses a visible literal allowlist");
  const allowedCloudKeys = new Set(cloudSelect[1].split(","));
  for (const call of cloudCalls) {
    const keys = [...call[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)].map((match) => match[1]);
    assert.ok(keys.length > 0, "cloud-pref write has explicit keys");
    for (const key of keys) assert.ok(allowedCloudKeys.has(key), `cloud-pref key ${key} is public play state`);
  }

  const storageCalls = [...html.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(\s*(['"])([^'"]+)\1/g)];
  assert.ok(storageCalls.length > 0, "storage calls were audited");
  for (const call of storageCalls) {
    assert.doesNotMatch(call[2], /chat|thread|turn|reply|message|focus/i, `storage key ${call[2]} is not dialogue state`);
  }
});
