const NOTE_MAP = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const FX_TYPES = ['BODE', 'CHORUS', 'COMB', 'COMPRESSOR', 'CONVOLVE', 'DELAY', 'DISTORTION', 'EQ', 'FILTER', 'FLANGER', 'PHASER', 'REVERB', 'UTILITY'];

export function noteToFrequency(note) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(note);
  if (!match) return 220;
  const midi = (Number(match[2]) + 1) * 12 + NOTE_MAP[match[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createCurve(amount = 0.4, samples = 2048) {
  const curve = new Float32Array(samples);
  const k = Math.max(1, amount * 28);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeImpulse(ctx, seconds = 1.4, decay = 2.4) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

function makeSample(ctx, kind = 'sample') {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const t = i / ctx.sampleRate;
      const env = Math.min(1, t * 35) * Math.pow(Math.max(0, 1 - t / 2), 1.5);
      const harmonic = kind === 'multisample' ? Math.sin(2 * Math.PI * 220 * t) + 0.42 * Math.sin(2 * Math.PI * 440 * t) + 0.18 * Math.sin(2 * Math.PI * 660 * t) : Math.sin(2 * Math.PI * 110 * t) * 0.7 + Math.sin(2 * Math.PI * 220 * t) * 0.25;
      data[i] = harmonic * env;
    }
  }
  return buffer;
}

function createChaosWave(ctx, type) {
  const size = 128;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  let x = 0.1; let y = 0; let z = 0;
  for (let i = 1; i < size; i += 1) {
    if (type === 'lorenz') {
      const dx = 10 * (y - x); const dy = x * (28 - z) - y; const dz = x * y - (8 / 3) * z;
      x += dx * 0.015; y += dy * 0.015; z += dz * 0.015;
    } else {
      const dx = -y - z; const dy = x + 0.2 * y; const dz = 0.2 + z * (x - 5.7);
      x += dx * 0.02; y += dy * 0.02; z += dz * 0.02;
    }
    imag[i] = Math.max(-1, Math.min(1, x / 18));
  }
  return ctx.createPeriodicWave(real, imag);
}

const waveMap = { sine: 'sine', triangle: 'triangle', saw: 'sawtooth', square: 'square' };

export class SynthEngine {
  constructor() {
    this.ctx = null;
    this.voices = new Map();
    this.params = null;
    this.nodes = null;
    this.sampleBuffer = null;
    this.multisampleBuffer = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.sampleBuffer = makeSample(this.ctx, 'sample');
      this.multisampleBuffer = makeSample(this.ctx, 'multisample');
      this.buildMasterChain();
      if (this.params) this.updateEffects(this.params);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  async loadSample(arrayBuffer, target = 'sample') {
    const ctx = this.ensureContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (target === 'multisample') this.multisampleBuffer = decoded;
    else this.sampleBuffer = decoded;
    return decoded.duration;
  }

  buildMasterChain() {
    const ctx = this.ctx;
    const input = ctx.createGain();
    const bus1Input = ctx.createGain();
    const bus2Input = ctx.createGain();
    const bus1Output = ctx.createGain();
    const bus2Output = ctx.createGain();
    const master = ctx.createGain();
    const analyser = ctx.createAnalyser();
    bus1Output.connect(master);
    bus2Output.connect(master);
    master.connect(analyser).connect(ctx.destination);
    this.nodes = { input, bus1Input, bus2Input, bus1Output, bus2Output, master, analyser, fx: [] };
    this.configureFx({ effects: [], fxRouting: 'series', activeBus: 1, master: 0.78 });
  }

  createEffect(type, config = {}) {
    const ctx = this.ctx;
    const input = ctx.createGain();
    const output = ctx.createGain();
    const nodes = { input, output, modulators: [] };
    const connect = (from, to) => from.connect(to);
    switch (type) {
      case 'BODE': {
        const carrier = ctx.createOscillator(); const amount = ctx.createGain();
        carrier.type = 'sine'; carrier.frequency.value = 18; amount.gain.value = 0.12;
        carrier.connect(amount).connect(input.gain); carrier.start(); nodes.modulators.push(carrier); connect(input, output); break;
      }
      case 'CHORUS':
      case 'FLANGER': {
        const delay = ctx.createDelay(0.2); const wet = ctx.createGain(); const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
        delay.delayTime.value = type === 'CHORUS' ? 0.028 : 0.006; wet.gain.value = type === 'CHORUS' ? 0.35 : 0.45; lfo.frequency.value = type === 'CHORUS' ? 0.65 : 0.18; lfoGain.gain.value = type === 'CHORUS' ? 0.012 : 0.004;
        lfo.connect(lfoGain).connect(delay.delayTime); connect(input, output); connect(input, delay); connect(delay, wet); connect(wet, output); lfo.start(); nodes.modulators.push(lfo); break;
      }
      case 'COMB': { const delay = ctx.createDelay(0.3); const fb = ctx.createGain(); delay.delayTime.value = 0.045; fb.gain.value = 0.62; connect(input, delay); connect(delay, fb); connect(fb, delay); connect(input, output); connect(delay, output); break; }
      case 'COMPRESSOR': { const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; connect(input, comp); connect(comp, output); break; }
      case 'CONVOLVE': { const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx, 1.1, 3.2); connect(input, conv); connect(conv, output); break; }
      case 'DELAY': { const delay = ctx.createDelay(1.5); const fb = ctx.createGain(); const wet = ctx.createGain(); delay.delayTime.value = config.time ?? 0.32; fb.gain.value = config.feedback ?? 0.3; wet.gain.value = config.mix ?? 0.3; connect(input, output); connect(input, delay); connect(delay, fb); connect(fb, delay); connect(delay, wet); connect(wet, output); break; }
      case 'DISTORTION': { const shaper = ctx.createWaveShaper(); shaper.curve = createCurve(config.amount ?? 0.35); shaper.oversample = '4x'; connect(input, shaper); connect(shaper, output); break; }
      case 'EQ': { const low = ctx.createBiquadFilter(); const mid = ctx.createBiquadFilter(); const high = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 180; mid.type = 'peaking'; mid.frequency.value = 1400; mid.Q.value = 0.8; high.type = 'highshelf'; high.frequency.value = 5000; connect(input, low); connect(low, mid); connect(mid, high); connect(high, output); break; }
      case 'FILTER': { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 4200; filter.Q.value = 0.8; connect(input, filter); connect(filter, output); break; }
      case 'PHASER': { let last = input; for (let i = 0; i < 4; i += 1) { const allpass = ctx.createBiquadFilter(); allpass.type = 'allpass'; allpass.frequency.value = 500 + i * 700; last.connect(allpass); last = allpass; } last.connect(output); break; }
      case 'REVERB': { const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx, 2.2, 2.1); const wet = ctx.createGain(); wet.gain.value = 0.38; connect(input, output); connect(input, conv); connect(conv, wet); connect(wet, output); break; }
      case 'UTILITY': { const gain = ctx.createGain(); const pan = ctx.createStereoPanner(); gain.gain.value = 1; connect(input, gain); connect(gain, pan); connect(pan, output); break; }
      default: connect(input, output);
    }
    return nodes;
  }

  configureFx(params) {
    if (!this.ctx || !this.nodes) return;
    const ctx = this.ctx;
    const n = this.nodes;
    n.fx.forEach((fx) => fx.nodes.modulators?.forEach((mod) => { try { mod.stop(); } catch { /* stopped */ } }));
    n.fx = [];
    n.bus1Input.disconnect(); n.bus2Input.disconnect();
    n.bus1Output.disconnect(); n.bus2Output.disconnect();
    n.input.disconnect();
    if (params.fxRouting === 'parallel') { n.input.connect(n.bus1Input); n.input.connect(n.bus2Input); } else n.input.connect(n.bus1Input);
    n.bus1Output.connect(n.master);
    n.bus2Output.connect(n.master);
    const effects = (params.effects?.length ? params.effects : FX_TYPES.map((type, i) => ({ id: i, type, on: false, bus: i % 2 + 1 }))).filter((fx) => fx.on !== false && FX_TYPES.includes(fx.type));
    const bus1 = effects.filter((fx) => fx.bus === 1).map((fx) => this.createEffect(fx.type, fx));
    const bus2 = effects.filter((fx) => fx.bus === 2).map((fx) => this.createEffect(fx.type, fx));
    const connectSplit = (source, target, splitter) => {
      if (splitter === 'L/H') {
        const low = ctx.createBiquadFilter(); const high = ctx.createBiquadFilter();
        low.type = 'lowpass'; low.frequency.value = 420; high.type = 'highpass'; high.frequency.value = 420;
        source.connect(low).connect(target); source.connect(high).connect(target);
      } else if (splitter === 'L/M/H') {
        const low = ctx.createBiquadFilter(); const mid = ctx.createBiquadFilter(); const high = ctx.createBiquadFilter();
        low.type = 'lowpass'; low.frequency.value = 220; mid.type = 'bandpass'; mid.frequency.value = 1200; mid.Q.value = 0.7; high.type = 'highpass'; high.frequency.value = 3800;
        source.connect(low).connect(target); source.connect(mid).connect(target); source.connect(high).connect(target);
      } else if (splitter === 'M/S') {
        const mid = ctx.createBiquadFilter(); const side = ctx.createBiquadFilter();
        mid.type = 'lowpass'; mid.frequency.value = 6000; side.type = 'highpass'; side.frequency.value = 600;
        source.connect(mid).connect(target); source.connect(side).connect(target);
      } else source.connect(target);
    };
    const connectChain = (source, chain, destination) => { if (!chain.length) source.connect(destination); else { connectSplit(source, chain[0].input, params.splitter); chain.forEach((fx, i) => fx.output.connect(chain[i + 1]?.input || destination)); } };
    if (params.fxRouting === 'parallel') { connectChain(n.bus1Input, bus1, n.bus1Output); connectChain(n.bus2Input, bus2, n.bus2Output); }
    else { connectChain(n.bus1Input, bus1, n.bus2Input); connectChain(n.bus2Input, bus2, n.bus2Output); }
    n.fx = [...bus1, ...bus2].map((nodes, i) => ({ type: effects[i]?.type, nodes }));
    n.master.gain.setTargetAtTime(params.master ?? 0.78, this.ctx.currentTime, 0.01);
  }

  updateEffects(params) {
    if (!this.ctx || !this.nodes) return;
    this.configureFx(params);
    this.nodes.master.gain.setTargetAtTime(params.master ?? 0.78, this.ctx.currentTime, 0.01);
  }

  setParams(params) {
    const topologyChanged = !this.params || this.params.fxRouting !== params.fxRouting || this.params.splitter !== params.splitter || JSON.stringify(this.params.effects) !== JSON.stringify(params.effects);
    this.params = params;
    if (this.ctx) {
      if (topologyChanged) this.updateEffects(params);
      this.voices.forEach((voice) => voice.update(params));
    }
  }

  createVoiceLfo(ctx, voice, lfoParams, index, params, now) {
    const lfo = ctx.createOscillator(); const depth = ctx.createGain();
    const shape = ['sine', 'triangle', 'square'].includes(lfoParams.shape) ? lfoParams.shape : 'sine';
    if (lfoParams.shape === 'lorenz' || lfoParams.shape === 'rossler') lfo.setPeriodicWave(createChaosWave(ctx, lfoParams.shape)); else lfo.type = shape;
    lfo.frequency.setValueAtTime(Math.min(1000, lfoParams.rate || 1), now); depth.gain.setValueAtTime((lfoParams.depth || 0) * (index === 0 ? 2400 : 850), now);
    lfo.connect(depth);
    const routes = params.matrix?.filter((route) => route.source === lfoParams.id) || [];
    routes.forEach((route) => { if (route.destination.includes('FILTER 1')) depth.connect(voice.filter.frequency); else if (route.destination.includes('FILTER 2')) depth.connect(voice.filter2.frequency); else if (route.destination.includes('PAN')) depth.connect(voice.pan.pan); else depth.connect(voice.filter.frequency); });
    if (!routes.length && index === 0) depth.connect(voice.filter.frequency);
    lfo.start(now); return { lfo, depth };
  }

  trigger(note, velocity = 0.9, params = this.params) {
    const ctx = this.ensureContext(); this.params = params; this.release(note);
    const now = ctx.currentTime; const freq = noteToFrequency(note);
    const voiceOut = ctx.createGain(); const filter = ctx.createBiquadFilter(); const filter2 = ctx.createBiquadFilter(); const filteredGain = ctx.createGain(); const bypassGain = ctx.createGain(); const amp = ctx.createGain(); const pan = ctx.createStereoPanner();
    const nodes = []; const envGains = [];
    const configureFilter = (node, config, enabled) => { node.type = config?.filterType || 'lowpass'; node.frequency.setValueAtTime(enabled ? (config.cutoff || 3600) : 20000, now); node.Q.setValueAtTime(config?.resonance || 0.8, now); };
    configureFilter(filter, params, params.filterOn !== false); configureFilter(filter2, params.filter2, params.filter2?.on === true);
    filteredGain.gain.value = params.filterOn === false ? 0 : (params.filterMix ?? 0.8); bypassGain.gain.value = params.filterOn === false ? 1 : 1 - (params.filterMix ?? 0.8);

    const addOsc = (key, type, level, octave = 0, detune = 0, panValue = 0) => {
      const config = params[key]; if (!config?.on || level <= 0) return;
      const mode = config.mode || 'wavetable'; const gain = ctx.createGain(); const panner = ctx.createStereoPanner(); gain.gain.value = level; panner.pan.value = panValue;
      if (mode === 'sample' || mode === 'multisample' || mode === 'granular') {
        const source = ctx.createBufferSource(); source.buffer = mode === 'multisample' ? this.multisampleBuffer : this.sampleBuffer; source.loop = mode === 'granular'; source.playbackRate.value = Math.max(0.25, Math.pow(2, octave) * (0.5 + (config.scan || 0.5))); source.detune.value = detune; source.connect(gain).connect(panner).connect(voiceOut); source.start(now); nodes.push({ source, gain, panner, key, mode });
      } else if (mode === 'spectral') {
        const source = ctx.createBufferSource(); source.buffer = this.sampleBuffer; source.loop = true; source.playbackRate.value = Math.max(0.25, Math.pow(2, octave)); const bands = [220, 440, 880, 1760]; const bandMix = ctx.createGain(); bandMix.gain.value = 0.2 + (config.warp1 || 0.2); source.connect(bandMix); bands.forEach((center, i) => { const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = center * (1 + (config.warp2 || 0.2) * i); band.Q.value = 5 + (config.scan || 0.5) * 10; bandMix.connect(band).connect(gain); }); gain.connect(panner).connect(voiceOut); source.start(now); nodes.push({ source, gain, panner, key, mode });
      } else {
        const osc = ctx.createOscillator(); osc.type = waveMap[config.wave] || type; osc.frequency.value = freq * Math.pow(2, octave); osc.detune.value = detune; if (config.phaseMemory === false) osc.detune.value += Math.random() * 18 - 9; osc.connect(gain).connect(panner).connect(voiceOut); osc.start(now); nodes.push({ osc, gain, panner, key, mode });
        if (config.warpType === 'FM' || config.warpType === 'PM') { const mod = ctx.createOscillator(); const modGain = ctx.createGain(); mod.frequency.value = freq * 2; modGain.gain.value = (config.warp1 || 0) * (config.warpType === 'FM' ? 120 : 0.8); mod.connect(modGain).connect(config.warpType === 'FM' ? osc.frequency : osc.detune); mod.start(now); nodes.push({ osc: mod, gain: modGain, panner, key: `${key}-warp` }); }
        if (config.warpType === 'RING') { const ring = ctx.createOscillator(); const ringGain = ctx.createGain(); ring.frequency.value = freq * 1.5; ringGain.gain.value = config.warp1 || 0.2; ring.connect(ringGain).connect(gain.gain); ring.start(now); nodes.push({ osc: ring, gain: ringGain, panner, key: `${key}-ring` }); }
      }
    };
    addOsc('oscA', 'sawtooth', (params.oscA?.level || 0.55) * 0.42, params.oscA?.octave || 0, params.oscA?.detune || 0, params.oscA?.pan || 0);
    addOsc('oscB', 'square', (params.oscB?.level || 0.3) * 0.34, params.oscB?.octave || -1, params.oscB?.detune || -7, params.oscB?.pan || 0);
    addOsc('sub', 'sine', (params.sub?.level || 0.2) * 0.34, (params.sub?.octave || -1) - 1, 0, params.sub?.pan || 0);
    addOsc('oscC', 'triangle', (params.oscC?.level || 0.3) * (0.2 + (params.oscC?.density || 0.5) * 0.3), params.oscC?.octave || -1, ((params.oscC?.scan || 0.5) - 0.5) * 800, params.oscC?.pan || 0);
    if (params.noise?.on) { const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1; const source = ctx.createBufferSource(); const gain = ctx.createGain(); const panner = ctx.createStereoPanner(); source.buffer = buffer; source.loop = true; gain.gain.value = params.noise.level * 0.08; panner.pan.value = params.noise.pan || 0; source.connect(gain).connect(panner).connect(voiceOut); source.start(now); nodes.push({ source, gain, panner, key: 'noise' }); }

    if (params.filterRouting === 'parallel') { voiceOut.connect(filter).connect(filteredGain); voiceOut.connect(filter2).connect(filteredGain); } else voiceOut.connect(filter).connect(filter2).connect(filteredGain);
    voiceOut.connect(bypassGain).connect(amp); filteredGain.connect(amp); amp.connect(pan).connect(this.nodes.input);
    const envelopes = params.envelopes || [{ attack: params.attack, decay: params.decay, sustain: params.sustain, release: params.release }];
    const env1 = envelopes[0] || {}; const attack = Math.max(0.002, env1.attack ?? 0.005); const decay = Math.max(0.01, env1.decay ?? 0.18); const sustain = Math.max(0.001, env1.sustain ?? 0.7); const peak = Math.max(0.02, velocity * 0.42);
    amp.gain.setValueAtTime(0.0001, now); amp.gain.linearRampToValueAtTime(peak, now + attack); amp.gain.linearRampToValueAtTime(peak * sustain, now + attack + decay);
    envelopes.slice(1, 4).forEach((env) => { const eg = ctx.createGain(); eg.gain.setValueAtTime(env.invert ? 1 : 0, now); eg.gain.linearRampToValueAtTime(env.invert ? 0 : 1, now + Math.max(0.002, env.attack || 0.02)); eg.gain.linearRampToValueAtTime(env.invert ? 1 - (env.sustain || 0.7) : (env.sustain || 0.7), now + (env.attack || 0.02) + (env.decay || 0.18)); if (env.id === 'ENV 2') eg.connect(filter.frequency); envGains.push(eg); });
    const voice = { nodes, filter, filter2, filteredGain, bypassGain, amp, pan, lfos: [], envGains, startedAt: now, update: (next) => { const t = ctx.currentTime; filter.type = next.filterType || 'lowpass'; filter.frequency.setTargetAtTime(next.filterOn === false ? 20000 : (next.cutoff || 3600), t, 0.012); filter.Q.setTargetAtTime(next.resonance || 0.8, t, 0.012); filter2.type = next.filter2?.filterType || 'lowpass'; filter2.frequency.setTargetAtTime(next.filter2?.on ? (next.filter2.cutoff || 5200) : 20000, t, 0.012); filter2.Q.setTargetAtTime(next.filter2?.resonance || 0.5, t, 0.012); filteredGain.gain.setTargetAtTime(next.filterOn === false ? 0 : (next.filterMix ?? 0.8), t, 0.012); bypassGain.gain.setTargetAtTime(next.filterOn === false ? 1 : 1 - (next.filterMix ?? 0.8), t, 0.012); nodes.forEach(({ gain, panner, key }) => { if (!gain) return; const cfg = next[key]; const mixerId = key === 'oscA' ? 'OSC A' : key === 'oscB' ? 'OSC B' : key === 'oscC' ? 'OSC C' : key.toUpperCase(); const mixer = next.mixer?.find((channel) => channel.id === mixerId); if (cfg?.level !== undefined) gain.gain.setTargetAtTime((mixer?.mute ? 0 : cfg.level * (mixer?.level ?? 1)) * 0.4, t, 0.012); if (panner && cfg?.pan !== undefined) panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, cfg.pan + (mixer?.pan ?? 0))), t, 0.012); }); }, release: () => { const t = ctx.currentTime; const releaseTime = Math.max(0.025, this.params?.release ?? this.params?.envelopes?.[0]?.release ?? 0.4); amp.gain.cancelScheduledValues(t); amp.gain.setTargetAtTime(0.0001, t, releaseTime / 4); window.setTimeout(() => { try { nodes.forEach(({ osc, source }) => (osc || source).stop()); voice.lfos.forEach(({ lfo }) => lfo.stop()); } catch { /* already stopped */ } }, releaseTime * 1000 + 80); } };
    voice.lfos = (params.lfos || []).slice(0, 10).filter((lfo) => lfo.on).map((lfo, index) => this.createVoiceLfo(ctx, voice, lfo, index, params, now));
    this.voices.set(note, voice); return voice;
  }

  release(note) { const voice = this.voices.get(note); if (!voice) return; voice.release(); this.voices.delete(note); }
  panic() { this.voices.forEach((voice) => voice.release()); this.voices.clear(); }
}
