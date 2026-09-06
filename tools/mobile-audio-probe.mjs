#!/usr/bin/env node
// Native Web Audio A/B for the two shared orb pianos. Never loads the game,
// preferences, or user data. Run separately from performance captures.
// node tools/mobile-audio-probe.mjs --out <new-directory>
// --check extracts current source without launching a browser.
// COLDLOAD_MODULES and CHROME_PATH can override existing browser dependencies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function extractPiano(root) {
  const runtimeFile = path.join(root, 'aim-dojo-main.js');
  const bytes = fs.readFileSync(runtimeFile), source = bytes.toString('utf8');
  const {extractFunction} = createRequire(import.meta.url)(path.join(root, 'tests/chip-graph.js'));
  const configText = source.match(/^\s+piano:(\{[^\r\n]+?\}),\s*\/\//m)?.[1];
  if (!configText) throw Error('Cannot extract the actual piano configuration');
  const config = vm.runInNewContext('(' + configText + ')', Object.create(null), {timeout: 100});
  const helpers = Object.fromEntries(['pianoPatch', 'pianoFieldBuild'].map(name => [name, extractFunction(source, name)]));
  if (!helpers.pianoFieldBuild.includes('panner.panningModel=PIANO_PANNING')) {
    throw Error('Expected the current PIANO_PANNING comparison hook in pianoFieldBuild');
  }
  const program = Object.values(helpers).join('\n');
  new vm.Script(program, {filename: 'extracted-mobile-piano.js'});
  return {config, program, metadata: {runtimeFile, runtimeSha256: hash(bytes),
    helpers: Object.fromEntries(Object.entries(helpers).map(([name, text]) => [name, {sha256: hash(text), text}]))}};
}

// This function is serialized into the browser. Both arms execute the same
// extracted builder, FM patch, note schedule, and gain automation. Only the
// existing PIANO_PANNING constant differs. Dry channels tap before the panners.
async function renderPianoComparison(app, repeats) {
  const rate = 48000, seconds = 6;
  const cases = ['left', 'right', 'duet'];
  const results = [], audio = {};
  const assert = (value, message) => { if (!value) throw Error(message); };
  const sampleHash = async samples => {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', samples.buffer));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const rms = samples => Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  const peak = samples => samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const pcm = channels => {
    const data = new Uint8Array(channels[0].length * channels.length * 2), view = new DataView(data.buffer);
    let clipped = 0;
    for (let i = 0; i < channels[0].length; i++) for (let c = 0; c < channels.length; c++) {
      const sample = channels[c][i];
      if (Math.abs(sample) > 1) clipped++;
      view.setInt16((i * channels.length + c) * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
    }
    let binary = '';
    for (let offset = 0; offset < data.length; offset += 16384) binary += String.fromCharCode(...data.subarray(offset, offset + 16384));
    return {base64: btoa(binary), clipped};
  };
  // Context warm-up is discarded. HRTF's database can be lazy-loaded by Chrome;
  // allow a real-time warm pass before rendering so an empty early HRTF buffer
  // cannot masquerade as successful spatial audio.
  const warm = new AudioContext();
  const warmPanner = warm.createPanner(); warmPanner.panningModel = 'HRTF';
  warmPanner.connect(warm.destination);
  const warmOsc = warm.createOscillator(), mute = warm.createGain(); mute.gain.value = 0;
  warmOsc.connect(mute); mute.connect(warmPanner); warmOsc.start();
  await warm.resume(); await new Promise(resolve => setTimeout(resolve, 300));
  warmOsc.stop(); await warm.close();

  for (let repeat = 0; repeat < repeats; repeat++) for (const fixture of cases) {
    const order = repeat % 2 ? ['equalpower', 'HRTF'] : ['HRTF', 'equalpower'];
    let reference;
    for (const model of order) {
      const native = new OfflineAudioContext(4, rate * seconds, rate);
      native.listener.forwardX.value = 0; native.listener.forwardY.value = 0; native.listener.forwardZ.value = -1;
      native.listener.upX.value = 0; native.listener.upY.value = 1; native.listener.upZ.value = 0;
      const merge = native.createChannelMerger(4), stereo = native.createGain(), split = native.createChannelSplitter(2);
      stereo.connect(split); split.connect(merge, 0, 2); split.connect(merge, 1, 3); merge.connect(native.destination);
      const counts = {oscillators: 0, panners: 0, gains: 0};
      for (const [method, key] of [['createOscillator', 'oscillators'], ['createPanner', 'panners'], ['createGain', 'gains']]) {
        const factory = native[method].bind(native);
        native[method] = (...args) => { counts[key]++; return factory(...args); };
      }
      const listener = {context: native, getInput: () => stereo};
      const build = new Function('Tone', 'CFG', 'listener', 'PIANO_PANNING', app.program + '\nreturn pianoFieldBuild;');
      const field = {}, started = performance.now();
      assert(build(Tone, {piano: app.config}, listener, model)(field, native), 'Actual piano builder failed');
      const constructionMs = performance.now() - started;
      const topology = field.voices.map((voice, i) => {
        voice.gain.connect(merge, 0, i);
        voice.gain.gain.setValueAtTime(0.24, 0);
        voice.panner.positionX.setValueAtTime(i ? 8 : -8, 0);
        voice.panner.positionY.setValueAtTime(0, 0);
        voice.panner.positionZ.setValueAtTime(-8, 0);
        return {model: voice.panner.panningModel, gain: voice.gain.gain.value,
          refDistance: voice.panner.refDistance, maxDistance: voice.panner.maxDistance,
          rolloffFactor: voice.panner.rolloffFactor, distanceModel: voice.panner.distanceModel,
          patch: voice.osc.get()};
      });
      const notes = [];
      for (let i = 0; i < 2; i++) {
        if (fixture === 'left' && i || fixture === 'right' && !i) continue;
        for (let n = 0; n < 3; n++) {
          const at = 0.1 + n * 1.2 + (fixture === 'duet' ? i * 0.3 : 0);
          const pitch = [220, 275, 330][n] * (i ? 1.5 : 1);
          field.voices[i].osc.triggerAttackRelease(pitch, 0.35, at, 0.65);
          notes.push({voice: i, pitch, at, duration: 0.35, velocity: 0.65});
        }
      }
      const renderStart = performance.now(), buffer = await native.startRendering(), renderMs = performance.now() - renderStart;
      const channels = Array.from({length: 4}, (_, i) => buffer.getChannelData(i));
      const dryHashes = await Promise.all(channels.slice(0, 2).map(sampleHash));
      const energy = channels.map(rms), peaks = channels.map(peak);
      assert(energy[2] > 0 && energy[3] > 0, 'Spatial output must be audible in both channels');
      assert(peaks.every(value => Number.isFinite(value) && value < 1), 'Fixture must remain finite and unclipped');
      if (fixture === 'left') assert(energy[2] > energy[3] * 1.1, model + ' left bearing was lost');
      if (fixture === 'right') assert(energy[3] > energy[2] * 1.1, model + ' right bearing was lost');
      const invariant = JSON.stringify({counts, dryHashes, notes,
        topology: topology.map(({model: ignored, ...rest}) => rest)});
      if (reference) assert(invariant === reference, 'Panning comparison changed dry audio, topology, gain, or note scheduling');
      reference = invariant;
      if (!repeat) {
        const wav = pcm(channels.slice(2)); assert(!wav.clipped, 'Listening WAV must not clip');
        audio[fixture + '-' + model.toLowerCase()] = wav.base64;
      }
      results.push({repeat, fixture, model, constructionMs, renderMs, counts, topology, notes, dryHashes, rms: energy, peaks,
        bearingDb: 20 * Math.log10(energy[2] / energy[3])});
      Tone.getContext().off('tick', field.pianoTick);
      for (const voice of field.voices) { voice.osc.dispose(); voice.gain.disconnect(); voice.panner.disconnect(); }
      field.toneContext.dispose();
    }
  }
  return {sampleRate: rate, seconds, repeats, results, audio, checks: {
    sameDryWaveforms: true, sameVoiceAndNodeCounts: true, samePatchGainAndNotes: true,
    leftAndRightBearingsPreserved: true, finiteUnclippedOutput: true}};
}

function wavFile(base64, sampleRate) {
  const pcm = Buffer.from(base64, 'base64'), header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function main() {
  const options = {root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out: null, check: false, repeats: 3,
    modules: process.env.COLDLOAD_MODULES || 'C:/Users/rober/AppData/Local/Temp/aim-dojo-parcel-e-puppeteer/node_modules',
    tone: 'C:/Users/rober/AppData/Local/Temp/aim-dojo-chip-test-draft/Tone-14.8.49.js',
    chrome: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i].replace(/^--/, '');
    if (key === 'check') options.check = true;
    else if (Object.hasOwn(options, key) && process.argv[i + 1]) options[key] = process.argv[++i];
    else throw Error('Unknown or incomplete option: ' + process.argv[i]);
  }
  options.root = path.resolve(options.root); options.repeats = Number(options.repeats);
  if (!Number.isInteger(options.repeats) || options.repeats < 1 || options.repeats > 5) throw Error('--repeats must be 1 through 5');
  const app = extractPiano(options.root);
  if (options.check) { console.log(JSON.stringify({checked: true, browserLaunched: false, ...app.metadata})); return; }
  if (!options.out) throw Error('Pass a new --out directory');
  options.out = path.resolve(options.out);
  if (fs.existsSync(options.out) || options.out.split(path.sep).some(part => part.toLowerCase() === 'state')) throw Error('Output must be new and outside state/');
  const tone = fs.readFileSync(options.tone);
  if (hash(tone) !== '1261cdd3331d826237e7b0b954b5ed7d2381c8df4331d2018acea8c7a64a9a7b') throw Error('Expected pinned Tone 14.8.49 bytes');
  const server = http.createServer((request, response) => {
    if (request.url === '/Tone.js') response.writeHead(200, {'Content-Type': 'application/javascript'}).end(tone);
    else if (request.url === '/') response.writeHead(200, {'Content-Type': 'text/html'}).end('<!doctype html><title>Orb piano native audio comparison</title><script src="/Tone.js"></script>');
    else response.writeHead(404).end();
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const puppeteer = createRequire(path.join(path.resolve(options.modules), 'package.json'))('puppeteer-core');
    browser = await puppeteer.launch({executablePath: options.chrome, headless: true,
      args: ['--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required']});
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error.stack || error)));
    await page.goto('http://127.0.0.1:' + server.address().port, {waitUntil: 'load'});
    const capture = await page.evaluate(renderPianoComparison, app, options.repeats);
    if (errors.length) throw Error(errors.join('\n'));
    const {audio, ...result} = capture;
    const timing = Object.fromEntries(['HRTF', 'equalpower'].map(model => {
      const samples = result.results.filter(row => row.model === model).map(row => row.renderMs).sort((a, b) => a - b);
      return [model, {samples, medianMs: samples[Math.floor(samples.length / 2)]}];
    }));
    const manifest = {started: new Date().toISOString(), ...app.metadata,
      harnessSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))), toneSha256: hash(tone),
      browser: await browser.version(), userAgent: await page.evaluate(() => navigator.userAgent),
      classification: 'Native desktop offline audio correctness and cost comparison; not mobile CPU, sustained FPS, battery, or listening approval.',
      limits: ['Extracts actual current piano builder and patch. The complete scene, accompaniment, transport, input, and HRTF listener motion are not exercised.',
        'OfflineAudioContext runs faster than real time. Its render duration cannot be converted to real-time audio-thread savings.',
        'A/B changes acoustic filtering by design. Matching dry waveforms and directional RMS do not establish perceptual equivalence.',
        'HRTF remains the default pending a listening and sustained real-time performance check on physical weaker hardware.']};
    fs.mkdirSync(options.out, {recursive: true});
    fs.writeFileSync(path.join(options.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(options.out, 'results.json'), JSON.stringify({...result, timing}, null, 2) + '\n');
    for (const [name, bytes] of Object.entries(audio)) fs.writeFileSync(path.join(options.out, name + '.wav'), wavFile(bytes, capture.sampleRate));
    fs.writeFileSync(path.join(options.out, 'README.md'), '# Orb piano panning comparison\n\n' +
      manifest.classification + '\n\nBoth arms use the same extracted FM builder, note schedule and gain. Dry samples match exactly. Left/right cues survive both models. The stereo WAVs intentionally retain their original levels; use headphones to compare character and bearing.\n\n' +
      'Listen to `left-hrtf.wav` / `left-equalpower.wav`, `right-hrtf.wav` / `right-equalpower.wav`, and `duet-hrtf.wav` / `duet-equalpower.wav`.\n\n' +
      'In the actual game, compare `?panning=hrtf` with `?panning=equalpower` on the same physical phone. Keep the music, aim, and game settings equal. Audio quality still requires a human listening check. No automatic panning fallback is enabled.\n\n' +
      manifest.limits.map(limit => '- ' + limit).join('\n') + '\n');
    console.log(JSON.stringify({out: options.out, checks: result.checks, timing, classification: manifest.classification}));
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}

await main();
