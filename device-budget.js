(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AimDojoDeviceBudget = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function choice(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  // Resource policy is separate from the player's crunchy/smooth art choice.
  // Hints select a conservative starting budget; frame evidence can lower it at pause.
  function resolve(options = {}) {
    const params = new URLSearchParams(options.search || '');
    const mode = choice(params.get('performance'), ['auto', 'lean', 'full'],
      choice(options.preference, ['auto', 'lean', 'full'], 'auto'));
    const smallDevice = options.weak || (options.memory > 0 && options.memory <= 4) ||
      (options.cores > 0 && options.cores <= 4) || options.saveData;
    const constrained = mode === 'lean' || (mode === 'auto' && (options.mobile || smallDevice));
    const lean = mode === 'lean' || (mode === 'auto' && !!smallDevice);
    const frameChoice = choice(params.get('renderfps'), ['60', 'native'],
      choice(options.framePreference, ['60', 'native'], constrained ? '60' : 'native'));
    return Object.freeze({
      mode, constrained: !!constrained, lean,
      textureTier: constrained ? 'compact' : 'full',
      renderFps: frameChoice === '60' ? 60 : 0,
      // Spatialization remains an explicit listening experiment; no music is removed.
      panningModel: params.get('panning') === 'equalpower' ? 'equalpower' : 'HRTF',
    });
  }

  function dprBounds(options) {
    const { low, mobile, budget } = options;
    const device = Math.max(0.1, Number(options.deviceDpr) || 1);
    const max = Math.min(device, low ? 0.5 : budget.constrained ? 1 : mobile ? 1.25 : 1.5);
    const min = Math.min(max, low ? (budget.mode === 'full' ? 0.5 : 0.35) : budget.constrained ? 0.6 : mobile ? 0.8 : 0.9);
    const start = budget.lean ? Math.max(min, Math.min(max, low ? 0.4 : 0.8)) : max;
    return Object.freeze({ min, max, start });
  }

  // Called on every animation callback. Only drawing consumes the result; simulation,
  // input, and audio scheduling must continue even when this returns false.
  function createRenderGate(fps = 0) {
    let interval = fps > 0 ? 1000 / fps : 0, next = null;
    return {
      setFps(value) { interval = value > 0 ? 1000 / value : 0; next = null; },
      reset() { next = null; },
      due(now) {
        if (!interval) return true;
        if (next === null || now < next - interval * 2) { next = now + interval; return true; }
        if (now + 0.5 < next) return false;
        // Keep phase at 90/120/144 Hz; never catch up with a burst after a stall.
        next += Math.max(1, Math.floor((now + 0.5 - next) / interval) + 1) * interval;
        return true;
      },
    };
  }

  // A sustained slow run requests one lower rung for the next pause. Keeping the
  // backbuffer unchanged during play preserves aim cues and the authored pixel grid.
  function createQualityMonitor(bounds) {
    let average = 1 / 60, elapsed = 0, slow = 0, pending = null;
    return {
      get pending() { return pending; },
      sample(dt, running, current) {
        if (!running) {
          const result = pending;
          average = 1 / 60; elapsed = 0; slow = 0; pending = null;
          return result;
        }
        if (!Number.isFinite(dt) || dt <= 0) return null;
        const step = Math.min(dt, 0.1);
        elapsed += step;
        average += (step - average) * (1 - Math.exp(-step));
        if (elapsed < 3 || pending !== null) return null;
        slow = average > 1 / 45 ? slow + step : Math.max(0, slow - step * 2);
        if (slow >= 2 && current > bounds.min + 0.01) {
          pending = Math.max(bounds.min, Math.round((current - 0.1) * 100) / 100);
        }
        return null;
      },
    };
  }

  return Object.freeze({ resolve, dprBounds, createRenderGate, createQualityMonitor });
});
