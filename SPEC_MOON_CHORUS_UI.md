# Moon Chorus UI & Localization Spec

**Version:** 1.0 · 2026-07-10
**Story layer:** The Moon's Lost Chorus (see the story specification, v1.0)
**Scope:** Retheme every player-facing string to the story voice, and auto-localize to Japanese for `ja` browsers.
**Files touched:** `index.html` only. No assets, no build step, no dependencies, no server changes.

---

## 1. Goals / Non-goals

**Goals**
- Every player-facing surface speaks the story's language: Listener, Echoes, Moonline, the World Drum, the Full Night. No player-facing "AIM DOJO" / "QUAKE III" / kill-adjacent vocabulary.
- Japanese browsers (`navigator.language` starts with `ja`) get fully Japanese UI with zero English flash and correct CJK typography.
- The story must teach the mechanic (Step → Send → Land), per the story spec's acceptance test.

**Non-goals**
- No language selector, settings entry, or persistence — detection + URL override only (zen rule: no new UI).
- No renaming of internal identifiers: localStorage keys (`aimdojo.*`), Supabase table/columns, Railway endpoints, URL flags, repo, domain. The brand retheme is **display-only**.
- No new gameplay copy surfaces (no per-kill toasts — the story spec forbids toast spam).
- No other languages in this pass (the mechanism must trivially admit more later).

---

## 2. Identity decisions (adopted defaults — veto in review, not mid-implementation)

| Surface | Current | New |
|---|---|---|
| Display name (h1) | `AIM <acc>DOJO</acc>` | `MOON <acc>CHORUS</acc>` · ja: `月の<acc>合唱</acc>` |
| Eyebrow | `QUAKE III · RHYTHM TRAINER` | `THE MOON'S LOST CHORUS` · ja: `月の失われた合唱` (also removes the third-party trademark) |
| `<title>` / og / twitter | `Aim Dojo — Rhythm & Spatial Audio Trainer` | `Moon Chorus — Rhythm Aim Trainer` (meta stays EN for crawlers; tab title swaps at boot for ja) |
| Brand emoji | 🥋 (records button, board header, graduation toast) | ✦ everywhere |
| Tempo HUD label | `TEMPO` | `DRUM` · ja: `太鼓` (the World Drum; unit stays `bpm` both languages) |
| Touch fire button | `FIRE` | `SEND` · ja: `送る` |
| Player verbs | fire / shoot / kill | send / land / light (per story-spec verb list) |

**Principle: stats keep real units and plain labels; prose carries the story.** BPM, m:ss, `{n} m` distances, board columns `# / NAME / BPM / TIME` survive verbatim in both languages (ja keeps `BPM`, `bpm`, `ms` Latin — standard in Japanese games).

---

## 3. Mechanism

### 3.1 Language resolution (pre-paint)
Extend the **existing head inline script** (line ~9, the `aimdojo.seen` stamp — it already runs before any body content parses):

```js
var LANG=/(?:^|[?&#])en\b/.test(location.search+location.hash)?'en'
  :/(?:^|[?&#])ja\b/.test(location.search+location.hash)?'ja'
  :(/^ja/i.test((navigator.languages&&navigator.languages[0])||navigator.language||'')?'ja':'en');
document.documentElement.lang=LANG;
```
- Bounded-regex idiom matches `?hi`/`?low`. `?ja` / `?en` are testing overrides, never persisted.
- `html[lang=ja]` is the CSS hook; it is set before first paint, so fonts/tracking apply from frame one.

### 3.2 Dictionary — single source, defined before the card
English is **baked into the HTML/JS as the source of truth** (rethemed per §5). Japanese is one flat override object, `window.JA`, defined in a **small inline script placed immediately after the overlay card markup (before the three.js `<script src>` at ~line 308)**. That script:
1. defines `window.JA = { key: '…', … }` (all ja strings, static + dynamic);
2. if `LANG==='ja'`, immediately swaps the static card/HUD text (by element id / selector list) and `document.title` — this runs synchronously before the parser reaches the blocking three.js tag, so **ja users never paint English**.

The main game script reads the same object:
```js
const T=(k,en)=>(document.documentElement.lang==='ja'&&window.JA&&window.JA[k]!=null)?window.JA[k]:en;
```
Call as `T('coachP0','STEADY THE MOONLINE · tap the letter when the floor flashes')` — the EN string stays inline at the call site (grep-ability, zero indirection for the default language). Interpolation by `.replace('{n}',…)` only; no i18n framework.

### 3.3 CSS-only strings
`#lockBox::after content:'LOCK'` (line ~62), `#lockBox.decoy::after content:'AVOID'` (~65), `#windHud .wh-mag::before content:'WIND '` (~75) are unreachable by JS swaps. Add:
```css
html[lang=ja] #lockBox::after{content:'ロック'}
html[lang=ja] #lockBox.decoy::after{content:'よけて'}
html[lang=ja] #windHud .wh-mag::before{content:'風 '}  /* trailing space load-bearing */
```

### 3.4 Typography for ja (all under `html[lang=ja]`)
- **Font:** `Share Tech Mono` (Google Fonts, line ~19) has **no CJK glyphs**. Do **not** add a JP webfont. Override the variable — per-glyph fallback keeps Latin/digits in the mono identity while kana/kanji render natively:
  `html[lang=ja]{--mono:'Share Tech Mono',ui-monospace,'SF Mono',Menlo,Consolas,'Hiragino Kaku Gothic ProN','Yu Gothic Medium',Meiryo,'Noto Sans JP',monospace}`
- **Canvas text** (`drawWasdLane` readouts, any `hudCtx.font` literal) does not see CSS vars — when `lang==='ja'`, append the same JP stack in the canvas font string.
- **Tracking:** wide Latin tracking breaks CJK. Override: `.eyebrow{letter-spacing:.12em}` (from .34em), and cap every other player-facing `letter-spacing` at `.05em` for ja.
- **Line height:** `h1{line-height:1.15}` for ja (current `.96` clips kanji ascenders/descenders). Coach/lede `line-height:1.6`.
- **Overflow:** `#ghostToast`, `#hitFlash` are `white-space:nowrap` — keep ja toast strings ≤ ~14 characters; verify `#nameInput` (128px), `#resToggle` (150px min), board columns (48/56px) at ja glyph widths (ja strings are shorter but glyphs are wider).
- Opponent reticle names (`.liveRet::after content:attr(data-name)`, fed at ~line 2832) are user-generated — never translated, but the `--mono` override above must reach that selector so CJK player names render for everyone. Apply the JP fallback tail to `--mono` **unconditionally** (not just ja) so an EN player can see a Japanese opponent's name.

### 3.5 Song-name display mapping
`activeTheme.name` (`MOONLIGHT`) is **both** the display string (♪ flash, pause lede, ★ PEAK/LONGEST) **and** the `aimdojo.songBest` localStorage key. Introduce `songDisplay(name)` → ja: `MOONLIGHT→月光` (Beethoven's Moonlight Sonata is 月光 in Japan) — used at every display site; the storage key and leaderboard payloads keep `MOONLIGHT` verbatim.

---

## 4. Never translate / never touch

| Category | Items |
|---|---|
| Physical keys | `MOUSE · WASD · L-CLICK · ESC · W/A/S/D` keycap chips, `#wasdGlyph` lane letters (JIS keyboards are QWERTY; the existing `getLayoutMap` localization at ~line 434 already handles non-QWERTY — do not touch) |
| Storage keys | every `aimdojo.*` localStorage key (renaming = all players lose prefs/bests) |
| Wire format | Supabase `aimdojo_dojo` table + `client_id/name/peak_bpm/runtime/far/high/streak/kills`, Railway `/dojo` |
| URL flags | `?hi ?low ?fps ?wind` (+ new `?ja ?en`) |
| User content | player names, `Guest-{xxxx}` fallback (it is stored data other clients render), gamepad id strings |
| Units/format | `bpm`, `ms`, `m`/`ft`, `m:ss`, `{n} fps · dpr` (dev overlay — excluded from translation entirely) |
| Operator copy | `TIME needs Supabase column runtime — run supabase-dojo-runtime.sql` (admin repair hint; keep verbatim both languages) |

**Dormant strings — delete, don't translate:** `FLICK / lock on the beat` (flickBonus off), `★ NEW RECORD` flash (no callers), the `showToneBlock('challenge')` branch (daily removed). Removing them is in scope; translating them is not.

---

## 5. String catalog (current → new EN → JA)

Legend: **[C]** = coupling/caution note. `{…}` = interpolation, keep verbatim. JA copy is kid-plain (age ~8), kana-leaning for rare kanji (きき手・こだま・またたき), no keigo. **Native-speaker review of the JA column is a release gate — it is draft copy.**

### 5.1 Head / meta (EN static for crawlers; tab title swaps at boot for ja)
| Surface | New EN | JA (boot swap) |
|---|---|---|
| `<title>` | Moon Chorus — Rhythm Aim Trainer | 月の合唱 — リズムエイム・トレーナー |
| meta/og/twitter descriptions | Before the first dinosaur, the Moon kept a song. Steady the Moonline, send rainbow links, and land them on each Echo's listening blink. Browser-only, no install. | — (meta stays EN) |

### 5.2 Start card
| id | New EN | JA |
|---|---|---|
| `#ovEyebrow` | THE MOON'S LOST CHORUS | 月の失われた合唱 |
| `#ovTitle` | MOON `<acc>`CHORUS`</acc>` | 月の`<acc>`合唱`</acc>` |
| `#ovLede` (first visit) | Before the first dinosaur, the Moon kept a song made from every mind it had met. Then the Great Silence scattered those voices across Earth inside locked Echo Orbs. You are the new Listener. **Step on the flashing letter** to steady the Moonline. **Send through the gap** so your rainbow link lands when an orb glows. Bring the lost voices home. | 恐竜より昔、月は 出会ったすべての心の声で ひとつの歌を守っていた。やがて「大いなる沈黙」が、その声たちを閉じた《こだま玉》にとじこめ、地球じゅうに散らした。きみは新しい「きき手」。**光る文字を踏んで**、月の糸をととのえよう。**あいだにリンクを送って**、玉が光るあいだに届けよう。失われた声を、家へ。 |
| `#ovLede` (returning, via `html.seen` variant — new) | Step on the flash. Send through the gap. Land on the glow. | 踏む。送る。ひかる。 |
| `#ovLede` (mobile) | Send your rainbow link early enough to land while the Echo glows. Training starts with close Echoes and long blinks — no letters on touch. | 虹のリンクを早めに送って、こだまが光るあいだに届けよう。れんしゅうは近くのこだまから。 |
| `#phonesNote` | 🎧 Headphones help — the World Drum lives in your ears. Sound on. | 🎧 ヘッドホンがおすすめ。世界の太鼓は耳の中に。音を出してね。 |
| keys: MOUSE | turn & aim | まわして ねらう |
| keys: WASD | STEP on the flashing letter — steadies the Moonline | 光った文字を踏む — 月の糸がととのう |
| keys: L-CLICK | SEND through the gap — land it while the Echo glows | あいだに送る — こだまが光るうちに届ける |
| keys: ESC | pause | ポーズ |
| `#modeQ` | First night here? | はじめての夜? |
| `#beginTrain` | ▶ I'M NEW — WAKE THE MOONLINE | ▶ はじめて — 月の糸をおしえて |
| `#beginFull` | I KNOW THIS — THE FULL NIGHT | もう知ってる — 満ちる夜へ |
| `#beginBtn` (RESUME state) | ▶ RESUME | ▶ つづける |
| `#recordsBtn` | ✦ RECORDS | ✦ きろく |
| `#shareBtn` | ⧉ SHARE | ⧉ シェア |

**[C]** The four `showToneBlock` error strings reference the gate buttons by name — they must be updated in the same commit and routed through `T()` so the labels can never diverge (EN: "Tap **I'M NEW** or **I KNOW THIS** again…"; JA: 「はじめて」か「もう知ってる」をもういちど押してね…).

### 5.3 Trainer coach lines (canonical, from the story spec)
| Call site | New EN | JA |
|---|---|---|
| phase 0 | STEADY THE MOONLINE · tap the letter when the floor flashes | 月の糸をととのえて · 床が光ったら その文字を踏む |
| phase 0 progress | Steps {n}/{N} · match the floor flash | 踏めた {n}/{N} · 床の色に合わせて |
| phase 1 desktop | SEND THROUGH THE GAP · your link must LAND while the Echo glows | あいだに送って · こだまが光るあいだにリンクを届ける |
| phase 1 mobile | SEND THE LINK · make it LAND while the Echo glows | リンクを送って · 光るあいだに届けて |
| phase 1 progress | Voices {n}/{N} · keep the steps steady | 声 {n}/{N} · 足もとも忘れずに |
| phase 2 desktop | FAR ECHOES NEED AN EARLIER SEND · keep the letters steady | 遠いこだまには早めに送る · 文字も踏みつづけて |
| phase 2 mobile | FAR ECHOES NEED AN EARLIER SEND · lead the link | 遠いこだまには早めに送る · 先を読んで |
| phase 2 progress | Far voices {n}/{N} · then the Full Night | 遠い声 {n}/{N} · つぎは満ちる夜 |
| graduation coach (ephemeral) | THE CHORUS REMEMBERS YOU · MOON SENSEI OPENS THE FULL NIGHT | 合唱はきみをおぼえた · 月先生が満ちる夜をひらく |
| graduation toast | ✦ THE FULL NIGHT | ✦ 満ちる夜 |
| trainer-start toast | MOONLINE TRAINING | 月の糸のけいこ |

### 5.4 In-game HUD
| Surface | New EN | JA |
|---|---|---|
| `#speedLabel` | DRUM | 太鼓 |
| `#speedVal` | {n}`bpm` | unchanged |
| lockBox `LOCK` / `AVOID` (CSS) | LOCK / AVOID | ロック / よけて (CSS override, §3.3) |
| `WIND ` (CSS) | WIND  | 風  |
| DECOY popup + sub | NOT A VOICE · let it pass | にせもの · 撃たないで |
| MISS popup + sub (orb expiry) | FADED · listen for the next | きえた · つぎの声を聞こう |
| hitFlash `◎ {d} ▲ {h}` | unchanged | unchanged |
| tank counter `{hp}` | unchanged | unchanged |
| canvas tap readouts PERFECT/AHEAD/BEHIND | PERFECT / AHEAD {n}ms / BEHIND {n}ms | ぴったり / はやい {n}ms / おそい {n}ms **[C]** canvas font per §3.4 |
| sky freeze toasts | 🌅 SKY FROZEN / SKY RESUMED | 🌅 空をとめた / 空がうごく |
| `#fireBtn` + aria | SEND / "Send the link" | 送る / リンクを送る |
| `#pauseBtn` aria | Pause | ポーズ |
| `#muteBtn` title+aria (♪/× glyphs unchanged) | Toggle sound | 音の切りかえ |

### 5.5 Pause card
| Surface | New EN | JA |
|---|---|---|
| eyebrow (full) | THE NIGHT WAITS | 夜は待っている |
| eyebrow (trainer) | MOONLINE · STEP {n} | 月の糸 · ステップ{n} |
| title (full) | LISTENER'S `<acc>`REPORT`</acc>` | きき手の`<acc>`きろく`</acc>` |
| title (trainer) | KEEP `<acc>`LISTENING`</acc>` | つづけて`<acc>`きこう`</acc>` |
| lede (full) | ♪ {song} · {m:ss} · peak {bpm} bpm | ♪ {songDisplay} · {m:ss} · さいこう {bpm} bpm |
| lede (trainer p0) | Training · {m:ss} · steps {n}/{N} | けいこ · {m:ss} · 踏めた {n}/{N} |
| lede (trainer p1-2) | Training · {m:ss} · voices {n} | けいこ · {m:ss} · 声 {n} |
| chips | TIME IN THE NIGHT / FINAL BPM / PEAK BPM | 夜にいた時間 / さいごのBPM / さいこうのBPM |

### 5.6 Records / share / settings
| Surface | New EN | JA |
|---|---|---|
| board header | ✦ CHORUS RECORDS | ✦ 合唱のきろく |
| columns `# NAME BPM TIME` | unchanged | unchanged |
| your best line | your best · {m:ss} · {bpm} bpm | じぶんのベスト · {m:ss} · {bpm} bpm |
| empty board | the chorus is quiet — be the first voice | まだ誰もいない — 最初の声になろう |
| board offline (×2 call sites, ~2919+2921+2934) | chorus board offline ({status}) / — network error | きろくに届かない ({status}) / — 通信エラー |
| ★ PEAK / ★ LONGEST flashes | ★ PEAK · {songDisplay} · {bpm} bpm / ★ LONGEST · {songDisplay} · {m:ss} | ★ さいこう · 月光 · {bpm} bpm / ★ さいちょう · 月光 · {m:ss} |
| ♪ song flash | ♪ {songDisplay} | ♪ 月光 |
| local bests cleared toast | local bests cleared | ベストを消した |
| share eyebrow / h1 / lede | SHARE · RUNS IN ANY BROWSER / SHARE THE `<acc>`NIGHT`</acc>` / Send this link to anyone — the night opens instantly in the browser, nothing to install. **Scan the code** or **copy the link**. | シェア · どのブラウザでも / 夜を`<acc>`シェア`</acc>` / このリンクを送るだけ — ブラウザですぐ開く。インストール不要。**コードを読み取る**か、**リンクをコピー**してね。 |
| copy states | LINK COPIED ✓ / PRESS ⌘/CTRL+C TO COPY | コピーした ✓ / ⌘/CTRL+C でコピーしてね |
| QR alt | QR code for {url} | {url} のQRコード |
| settings labels RESOLUTION / AUDIO OFFSET / resToggle states / calibrate strings | unchanged EN (functional) | 画質 / 音のずれ / 「LOW ▸ タップでHIGH」「HIGH ▸ タップでLOW」 / 🎧 タップから自動調整 / つづき §5.7 |

### 5.7 Calibration + tone-block (ja)
- hints: `W/A/S/D をビートに合わせて踏んでから、調整してね` · `{n}回ぶん記録 — タップで自動設定` · `まだ足りない — もう少し踏んでから` · `{±n}ms を {n}回から適用 → 合計 {n}ms`
- tone-block (start): `音が出なかった。「はじめて」か「もう知ってる」をもういちど押してね。ダメならこのページの音のブロックを解除して。` — same pattern for load/loading/pad variants; pad adds `(つづきはSTARTでも)`.
- gamepad toasts: `🎮 {id}` unchanged; fallback literal `gamepad`→`ゲームパッド`; ` ⚠ unmapped`→` ⚠ 未対応`.

---

## 6. Traps (each verified against the code)

1. **Pre-paint order:** card markup (≈248-306) parses **before** the blocking three.js tag (≈308). The JA swap script must sit between them or ja users flash English. The head script handles only `lang`/`title`.
2. **JS rewrites beat static swaps:** `ovEyebrow/ovTitle/ovLede/beginBtn/keysRow` are all rewritten at runtime (pause ≈2984-2993, mobile ≈2689-2691, tone-block ≈2718-2723). Every rewrite site must go through `T()` — a static-only pass leaves the pause card English.
3. **`html.seen` lede variant is new:** implement as two spans inside `#ovLede` toggled by the existing `html.seen` CSS, mirroring how `.keys`/`.phones` already hide (line ~141). Do not add JS.
4. **Duplicated literals:** `dojo board offline ({status})` exists at TWO call sites (~2919, ~2921); `{n} ms` is written at three (~2662/2679/2683); `bpm` unit exists in markup AND JS (~237/2301); mute glyph in markup AND JS (~240/3008). Extraction must hit all sites — grep counts per literal before and after.
5. **`songBest` key vs display** (§3.5): translating the stored name would fork every player's per-song bests. Display-map only.
6. **`Guest-{xxxx}` names** go over the wire and render on other clients — never localized.
7. **aria-live coach** (`#trainCoach`): swapped strings are announced by screen readers — keep ja lines short; no mid-line HTML.
8. **Emoji/glyphs** (♪ × ❙❙ ✦ ◎ ▲ 🎧 ⧉ ★) are language-neutral — never in the dictionary.
9. **Trainer records-gating bug (pre-existing, separate ticket):** trainer sessions currently submit to records (`submitDojo` has no `trainMode` gate and graduation doesn't reset `state.t`). Do not entangle with this spec; land it separately.

---

## 7. Acceptance tests

1. **Detection matrix:** `ja-JP` browser → ja; `en-US` → en; `?ja` on en browser → ja; `?en` on ja browser → en; flags survive the resolution-toggle reload (it strips only `low/hi`).
2. **No-flash:** load with DevTools locale `ja-JP`, throttle to Slow 3G — first painted card is Japanese (record frames).
3. **Coupling:** trigger all tone-block variants (block autoplay; pad path) — button names inside the copy match the rendered buttons, both languages.
4. **Coverage sweep:** play a full loop in ja — gate → trainer p0/p1/p2 → graduation → pause → records → share → mute → calibrate → resolution toggle: zero English (except Latin-by-design: units, keycaps, player names, `{id}`).
5. **Typography:** ja h1 unclipped (line-height); no toast overflow at 14-char strings; `#nameInput`/board columns/`#resToggle` don't wrap or clip; eyebrow tracking readable; CJK opponent names render for EN users too (unconditional font tail, §3.4).
6. **CSS strings:** lock an orb (ロック), lock a decoy (よけて), run `?wind&ja` (風 {n}).
7. **Integrity:** localStorage keys, Supabase payloads, and leaderboard rendering byte-identical to pre-change (diff a captured POST body); `MOONLIGHT` still the stored song key while ♪ 月光 shows.
8. **Story test (from the story spec):** after one ja trainer run, a Japanese-reading tester answers the six questions (why tap / when send / when land / why early / what's the clank / what happens on success) in story terms.
9. **Regression:** `?en` output diff vs pre-change EN build shows ONLY the intended retheme copy changes — no layout, mechanic, or timing diffs; `node --check` on extracted script passes.

---

## 8. Rollout

1. **Commit 1 — EN retheme:** all §5 "New EN" copy + dormant-string deletion + `T()` plumbing (no-op for EN). Ship, eyeball.
2. **Commit 2 — JA layer:** head lang stamp, `window.JA`, post-card swap script, `html[lang=ja]` CSS block, canvas font, `songDisplay()`. Test via `?ja`.
3. **JA native review** of the dictionary is a release gate for announcing to Japanese players; the mechanism ships regardless (draft copy beats no copy, and `?en` is always available).
4. Rollback: each commit is copy-only and independently revertable.

## 9. Out of scope

Voice-over, lore panels, cutscenes (story spec forbids), other languages, RTL, server-side locale, renaming domain/repo/db, translating the README/leaderboard SQL, furigana rendering, and any change to gameplay constants or the render loop.
