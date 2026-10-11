const NOTE_MAP = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

export function noteToFrequency(note) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(note);
  if (!match) return 220;
  const midi = (Number(match[2]) + 1) * 12 + NOTE_MAP[match[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createCurve(amount = 0.4, samples = 44100) {
  const curve = new Float32Array(samples);
  const k = Math.max(1, amount * 28);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

const waveMap = { sine: 'sine', triangle: 'triangle', saw: 'sawtooth', square: 'square' };

export class SynthEngine {
  constructor() {
    this.ctx = null;
    this.voices = new Map();
    this.params = null;
    this.nodes = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.buildMasterChain();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  buildMasterChain() {
    const ctx = this.ctx;
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const distortion = ctx.createGain();
    const delay = ctx.createDelay(1.5);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    const output = ctx.createGain();
    const analyser = ctx.createAnalyser();

    shaper.oversample = '4x';
    input.connect(dry).connect(output);
    input.connect(shaper).connect(distortion).connect(delay).connect(wet).connect(output);
    delay.connect(feedback).connect(delay);
    output.connect(analyser).connect(ctx.destination);

    this.nodes = { input, dry, shaper, distortion, delay, feedback, wet, output, analyser };
    this.updateEffects({ distortionOn: true, distortion: 0.18, delayOn: true, delayMix: 0.22, delayTime: 0.32, delayFeedback: 0.28, master: 0.78 });
  }

  updateEffects(params) {
    if (!this.ctx || !this.nodes) return;
    const now = this.ctx.currentTime;
    const n = this.nodes;
    n.shaper.curve = createCurve(params.distortion ?? 0.18);
    n.distortion.gain.setTargetAtTime(params.distortionOn ? 0.55 + (params.distortion ?? 0) * 1.4 : 0, now, 0.01);
    n.delay.delayTime.setTargetAtTime(params.delayTime ?? 0.32, now, 0.01);
    n.feedback.gain.setTargetAtTime(params.delayOn ? (params.delayFeedback ?? 0.28) * 0.82 : 0, now, 0.01);
    n.wet.gain.setTargetAtTime(params.delayOn ? (params.delayMix ?? 0.22) : 0, now, 0.01);
    n.dry.gain.setTargetAtTime(1 - (params.delayOn ? (params.delayMix ?? 0.22) * 0.22 : 0), now, 0.01);
    n.output.gain.setTargetAtTime(params.master ?? 0.78, now, 0.01);
  }

  setParams(params) {
    this.params = params;
    if (this.ctx) {
      this.updateEffects(params);
      this.voices.forEach((voice) => voice.update(params));
    }
  }

  trigger(note, velocity = 0.9, params = this.params) {
    const ctx = this.ensureContext();
    this.params = params;
    this.release(note);
    const now = ctx.currentTime;
    const freq = noteToFrequency(note);
    const voiceOut = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const filter2 = ctx.createBiquadFilter();
    const filteredGain = ctx.createGain();
    const bypassGain = ctx.createGain();
    const amp = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const nodes = [];

    const setFilter = (node, config, enabled = true) => {
      node.type = config?.filterType || 'lowpass';
      node.frequency.setValueAtTime(enabled && config?.on !== false ? (config.cutoff || 3600) : 20000, now);
      node.Q.setValueAtTime((config?.resonance || 0.8) + (params.filterDrive || 0) * 2, now);
    };
    setFilter(filter, params, params.filterOn !== false);
    setFilter(filter2, params.filter2, params.filter2?.on === true);
    filteredGain.gain.setValueAtTime(params.filterOn === false ? 0 : (params.filterMix ?? 0.8), now);
    bypassGain.gain.setValueAtTime(params.filterOn === false ? 1 : 1 - (params.filterMix ?? 0.8), now);

    lfo.type = params.lfoShape || 'sine';
    lfo.frequency.setValueAtTime(params.lfoRate || 2.2, now);
    lfoGain.gain.setValueAtTime((params.lfoOn ? params.lfoDepth || 0 : 0) * 2400, now);
    lfo.connect(lfoGain).connect(filter.frequency);

    const addOsc = (key, type, level, octave = 0, detune = 0, pan = 0) => {
      if (!params[key]?.on || level <= 0) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      osc.type = waveMap[params[key].wave] || type;
      osc.frequency.setValueAtTime(freq * Math.pow(2, octave), now);
      osc.detune.setValueAtTime(detune, now);
      gain.gain.setValueAtTime(level, now);
      panner.pan.setValueAtTime(pan, now);
      osc.connect(gain).connect(panner).connect(voiceOut);
      osc.start(now);
      nodes.push({ osc, gain, panner, key });
    };

    const addNoise = () => {
      if (!params.noise?.on || params.noise.level <= 0) return;
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(params.noise.level * 0.08, now);
      panner.pan.setValueAtTime(params.noise.pan || 0, now);
      source.connect(gain).connect(panner).connect(voiceOut);
      source.start(now);
      nodes.push({ source, gain, panner, key: 'noise' });
    };

    addOsc('oscA', 'sawtooth', (params.oscA?.level || 0.55) * 0.42, params.oscA?.octave || 0, params.oscA?.detune || 0, params.oscA?.pan || 0);
    addOsc('oscB', 'square', (params.oscB?.level || 0.3) * 0.34, params.oscB?.octave || -1, params.oscB?.detune || -7, params.oscB?.pan || 0);
    addOsc('sub', 'sine', (params.sub?.level || 0.2) * 0.34, (params.sub?.octave || -1) - 1, 0, params.sub?.pan || 0);
    addOsc('oscC', 'triangle', (params.oscC?.level || 0.3) * (0.2 + (params.oscC?.density || 0.5) * 0.3), params.oscC?.octave || -1, ((params.oscC?.scan || 0.5) - 0.5) * 800, params.oscC?.pan || 0);
    addNoise();

    voiceOut.connect(filter).connect(filter2).connect(filteredGain).connect(amp);
    voiceOut.connect(bypassGain).connect(amp);
    amp.connect(this.nodes.input);

    const attack = Math.max(0.002, params.attack ?? 0.005);
    const decay = Math.max(0.01, params.decay ?? 0.18);
    const sustain = Math.max(0.001, params.sustain ?? 0.7);
    const peak = Math.max(0.02, velocity * 0.42);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(peak, now + attack);
    amp.gain.linearRampToValueAtTime(peak * sustain, now + attack + decay);
    lfo.start(now);

    const voice = {
      nodes, filter, filter2, filteredGain, bypassGain, amp, lfo, lfoGain, voiceOut, startedAt: now,
      update: (next) => {
        const t = ctx.currentTime;
        filter.type = next.filterType || 'lowpass';
        filter.frequency.setTargetAtTime(next.filterOn === false ? 20000 : (next.cutoff || 3600), t, 0.012);
        filter.Q.setTargetAtTime((next.resonance || 0.8) + (next.filterDrive || 0) * 2, t, 0.012);
        filter2.type = next.filter2?.filterType || 'lowpass';
        filter2.frequency.setTargetAtTime(next.filter2?.on ? (next.filter2.cutoff || 5200) : 20000, t, 0.012);
        filter2.Q.setTargetAtTime(next.filter2?.resonance || 0.5, t, 0.012);
        filteredGain.gain.setTargetAtTime(next.filterOn === false ? 0 : (next.filterMix ?? 0.8), t, 0.012);
        bypassGain.gain.setTargetAtTime(next.filterOn === false ? 1 : 1 - (next.filterMix ?? 0.8), t, 0.012);
        lfo.frequency.setTargetAtTime(next.lfoRate || 2.2, t, 0.012);
        lfoGain.gain.setTargetAtTime((next.lfoOn ? next.lfoDepth || 0 : 0) * 2400, t, 0.012);
        nodes.forEach(({ gain, panner, key }) => {
          if (key === 'oscA') { gain.gain.setTargetAtTime((next.oscA?.level || 0) * 0.42, t, 0.012); panner.pan.setTargetAtTime(next.oscA?.pan || 0, t, 0.012); }
          if (key === 'oscB') { gain.gain.setTargetAtTime((next.oscB?.level || 0) * 0.34, t, 0.012); panner.pan.setTargetAtTime(next.oscB?.pan || 0, t, 0.012); }
          if (key === 'sub') { gain.gain.setTargetAtTime((next.sub?.level || 0) * 0.34, t, 0.012); panner.pan.setTargetAtTime(next.sub?.pan || 0, t, 0.012); }
          if (key === 'oscC') { gain.gain.setTargetAtTime((next.oscC?.level || 0) * (0.2 + (next.oscC?.density || 0.5) * 0.3), t, 0.012); panner.pan.setTargetAtTime(next.oscC?.pan || 0, t, 0.012); }
          if (key === 'noise') { gain.gain.setTargetAtTime((next.noise?.on ? next.noise.level : 0) * 0.08, t, 0.012); panner.pan.setTargetAtTime(next.noise?.pan || 0, t, 0.012); }
        });
      },
      release: () => {
        const t = ctx.currentTime;
        const releaseTime = Math.max(0.025, this.params?.release ?? 0.4);
        amp.gain.cancelScheduledValues(t);
        amp.gain.setTargetAtTime(0.0001, t, releaseTime / 4);
        window.setTimeout(() => {
          try { nodes.forEach(({ osc, source }) => (osc || source).stop()); lfo.stop(); } catch { /* already stopped */ }
        }, releaseTime * 1000 + 80);
      },
    };
    this.voices.set(note, voice);
    return voice;
  }

  release(note) {
    const voice = this.voices.get(note);
    if (!voice) return;
    voice.release();
    this.voices.delete(note);
  }

  panic() {
    this.voices.forEach((voice) => voice.release());
    this.voices.clear();
  }
}
