"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function namedFunction(name) {
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `${name} exists`);
  const next = html.slice(start + marker.length).search(/\nfunction\s+[A-Za-z_$][\w$]*\s*\(/);
  return next < 0 ? html.slice(start) : html.slice(start, start + marker.length + next);
}

const imageReadySource = namedFunction("_skyTexImageReady");
const loadSource = namedFunction("loadSkyTexture").split("\nconst _skyMapOpts=")[0];

function makeHarness({ bitmapDecode = true, createBitmap = true, bitmapLoader = true, bitmapThrow = false } = {}) {
  const calls = { bitmapConstructs: 0, bitmapLoads: [], bitmapOptions: [], textureLoads: [], warnings: [] };

  class Texture {
    constructor() {
      this.image = null;
      this.flipY = true;
      this.needsUpdate = false;
    }
  }

  class TextureLoader {
    load(url, onLoad, onProgress, onError) {
      const texture = new Texture();
      calls.textureLoads.push({ url, onLoad, onProgress, onError, texture });
      return texture;
    }
  }

  class ImageBitmapLoader {
    constructor() { calls.bitmapConstructs += 1; }
    setOptions(options) { calls.bitmapOptions.push(options); return this; }
    load(url, onLoad, onProgress, onError) {
      if (bitmapThrow) throw new Error("decode setup failed");
      calls.bitmapLoads.push({ url, onLoad, onProgress, onError });
    }
  }

  const THREE = { Texture, TextureLoader };
  if (bitmapLoader) THREE.ImageBitmapLoader = ImageBitmapLoader;
  const context = {
    CFG: { skyMaps: { bitmapDecode } },
    THREE,
    console: { warn: (...args) => calls.warnings.push(args) },
    skyAssetUrl: (url) => `https://assets.test/${url}`,
  };
  if (createBitmap) context.createImageBitmap = () => {};

  vm.runInNewContext(`
    const _skyTexLoader=new THREE.TextureLoader();
    let _skyBitmapLoader=null;
    const _skyTexCache=Object.create(null);
    const _skyTexWaiters=Object.create(null);
    ${imageReadySource}
    ${loadSource}
    globalThis.harness={ loadSkyTexture, _skyTexImageReady, _skyTexCache, _skyTexWaiters };
  `, context);

  return { calls, ...context.harness };
}

test("ImageBitmap decode preserves Texture identity, waiter fan-out, and cache hits", () => {
  const h = makeHarness();
  const ready = [];
  const first = h.loadSkyTexture("planet.jpg", (texture) => ready.push(["first", texture]));

  assert.equal(h.calls.textureLoads.length, 0, "active bitmap path never enters TextureLoader");
  assert.equal(h.calls.bitmapConstructs, 1);
  assert.equal(h.calls.bitmapLoads.length, 1);
  assert.deepEqual({ ...h.calls.bitmapOptions[0] }, { imageOrientation: "flipY", premultiplyAlpha: "none" });
  assert.equal(first.flipY, false, "decoded pixels are already vertically oriented");
  assert.equal(first.needsUpdate, false);
  assert.equal(h._skyTexImageReady(first), false, "empty placeholder is not ready");

  const second = h.loadSkyTexture("planet.jpg", (texture) => ready.push(["waiter", texture]));
  assert.equal(second, first, "in-flight callers share one Texture object");
  assert.equal(h.calls.bitmapLoads.length, 1, "in-flight cache hit does not decode twice");

  const bitmap = { width: 64, height: 32 };
  h.calls.bitmapLoads[0].onLoad(bitmap);
  assert.equal(first.image, bitmap);
  assert.equal(first.needsUpdate, true);
  assert.equal(h._skyTexImageReady(first), true);
  assert.deepEqual(ready.map(([label]) => label), ["first", "waiter"]);
  assert.ok(ready.every(([, texture]) => texture === first), "all callbacks receive the stable Texture wrapper");
  assert.equal(h._skyTexWaiters["https://assets.test/planet.jpg"], undefined, "waiters are released");

  let cached = null;
  assert.equal(h.loadSkyTexture("planet.jpg", (texture) => { cached = texture; }), first);
  assert.equal(cached, first, "ready cache hit resolves synchronously");
  assert.equal(h.calls.bitmapLoads.length, 1);
});

test("bitmapDecode zero and missing platform support retain the legacy TextureLoader path", () => {
  for (const options of [
    { bitmapDecode: false },
    { createBitmap: false },
    { bitmapLoader: false },
  ]) {
    const h = makeHarness(options);
    let ready = null;
    const texture = h.loadSkyTexture("milky.jpg", (value) => { ready = value; });
    assert.equal(h.calls.textureLoads.length, 1);
    assert.equal(h.calls.bitmapLoads.length, 0);
    assert.equal(h.calls.bitmapConstructs, 0);
    assert.equal(texture, h.calls.textureLoads[0].texture);
    h.calls.textureLoads[0].onLoad(texture);
    assert.equal(ready, texture);
  }
  assert.match(loadSource, /_skyTexLoader\.load\(resolved,/,
    "the shipped loader call remains available as a literal fallback contract");
});

test("bitmap failures clear both cache aliases and fail soft", () => {
  const h = makeHarness();
  let errors = 0;
  const texture = h.loadSkyTexture("missing.jpg", null, () => { errors += 1; });
  h.calls.bitmapLoads[0].onError();

  assert.equal(errors, 1);
  assert.equal(h._skyTexCache["missing.jpg"], undefined);
  assert.equal(h._skyTexCache["https://assets.test/missing.jpg"], undefined);
  assert.equal(h.calls.warnings.length, 1);
  assert.notEqual(h.loadSkyTexture("missing.jpg", null, () => {}), texture,
    "a retry gets a fresh placeholder after the failed one is evicted");
  assert.equal(h.calls.bitmapLoads.length, 2, "a later request may retry the failed map");

  const throwing = makeHarness({ bitmapThrow: true });
  let thrownErrors = 0;
  assert.equal(throwing.loadSkyTexture("throw.jpg", null, () => { thrownErrors += 1; }), null);
  assert.equal(thrownErrors, 1);
  assert.equal(throwing._skyTexCache["throw.jpg"], undefined);
  assert.equal(throwing._skyTexCache["https://assets.test/throw.jpg"], undefined);
  assert.equal(throwing.calls.warnings.length, 1);
});

test("readiness accepts complete DOM images, ImageBitmaps, and enhancement canvases", () => {
  const { _skyTexImageReady: ready } = makeHarness();
  assert.equal(ready(null), false);
  assert.equal(ready({ image: { complete: false, naturalWidth: 32, width: 32, height: 16 } }), false);
  assert.equal(ready({ image: { complete: true, naturalWidth: 32, width: 32, height: 16 } }), true);
  assert.equal(ready({ image: { complete: true, naturalWidth: 0, width: 0, height: 16 } }), false);
  assert.equal(ready({ image: { width: 32, height: 16 } }), true, "ImageBitmap is ready without .complete");
  assert.equal(ready({ image: { width: 32, height: 0 } }), false);

  const enhance = namedFunction("enhancePlanetTexture");
  assert.match(enhance, /img\.naturalWidth\|\|img\.width/);
  assert.match(enhance, /img\.naturalHeight\|\|img\.height/);
  assert.match(enhance, /ctx\.drawImage\(img,0,0,w,h\)/,
    "the contrast pass accepts ImageBitmap through CanvasRenderingContext2D.drawImage");
  assert.match(enhance, /out\.flipY=tex\.flipY/,
    "the enhanced CanvasTexture inherits the source orientation instead of flipping a bitmap twice");
});

test("bitmap decode source pins the off-thread orientation and stable wrapper invariants", () => {
  for (const contract of [
    /CFG\.skyMaps\.bitmapDecode/,
    /typeof createImageBitmap===['"]function['"]/,
    /new THREE\.Texture\(\)/,
    /tex\.flipY=false/,
    /imageOrientation:['"]flipY['"]/,
    /premultiplyAlpha:['"]none['"]/,
    /tex\.image=bitmap; tex\.needsUpdate=true/,
    /fn\(tex\)/,
  ]) assert.match(loadSource, contract);
});
