import { useMemo, useRef, useState } from 'react';
import { Knob, Toggle } from './App.jsx';

const FX_TYPES = ['BODE', 'CHORUS', 'COMB', 'COMPRESSOR', 'CONVOLVE', 'DELAY', 'DISTORTION', 'EQ', 'FILTER', 'FLANGER', 'PHASER', 'REVERB', 'UTILITY'];
const SPLITTERS = ['L/H', 'L/M/H', 'M/S'];
const MOD_SOURCES = ['LFO 1', 'LFO 2', 'LFO 3', 'LFO 4', 'LFO 5', 'LFO 6', 'LFO 7', 'LFO 8', 'LFO 9', 'LFO 10', 'ENV 1', 'ENV 2', 'ENV 3', 'ENV 4', 'MACRO 1', 'VELOCITY', 'NOTE'];
const MOD_DESTINATIONS = ['OSC A WT POS', 'OSC A FM', 'OSC B LEVEL', 'OSC C SCAN', 'FILTER 1 CUTOFF', 'FILTER 2 RES', 'FX DELAY MIX', 'MASTER PAN'];

function Panel({ title, children, right }) { return <section className="advanced-panel"><div className="advanced-head"><strong>{title}</strong>{right && <span>{right}</span>}</div>{children}</section>; }
function Select({ value, onChange, children }) { return <select className="advanced-select" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>; }

function AudioFileLoader({ engine }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState('Ningún archivo cargado');
  const [dragging, setDragging] = useState(false);

  const loadFile = async (file) => {
    if (!file) return;
    const isAudio = file.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|m4a|aac|aiff?)$/i.test(file.name);
    if (!isAudio) {
      setStatus('Selecciona un archivo de audio válido (WAV, MP3, OGG, FLAC o M4A).');
      return;
    }
    setStatus(`Cargando ${file.name}…`);
    try {
      const duration = await engine.loadSample(await file.arrayBuffer(), 'sample');
      setStatus(`Cargado: ${file.name} · ${duration.toFixed(2)} s`);
    } catch {
      setStatus('No se pudo leer el audio. Prueba con WAV, MP3, OGG, FLAC o M4A.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const openPicker = () => inputRef.current?.click();
  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  return <div className={`sample-loader ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } }} tabIndex={0} role="group" aria-label="Cargar archivo de audio">
    <div className="sample-loader-copy"><strong>CARGAR AUDIO</strong><span>Arrastra un archivo aquí o selecciónalo desde tu dispositivo.</span><small>WAV · MP3 · OGG · FLAC · M4A · AAC</small></div>
    <button type="button" className="audio-pick-button" onClick={openPicker}>Seleccionar archivo</button>
    <input ref={inputRef} className="audio-input" type="file" accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac" onChange={(event) => loadFile(event.target.files?.[0])} />
    <span className="sample-loader-status" role="status" aria-live="polite">{status}</span>
  </div>;
}

function OscillatorModes({ state, setState, engine }) {
  const setMode = (key, mode) => setState((p) => ({ ...p, [key]: { ...p[key], mode } }));
  return <Panel title="ADVANCED OSCILLATOR MODES" right="3 PRIMARY OSCILLATORS · 5 ENGINES">
    <div className="advanced-grid osc-mode-grid">{['oscA', 'oscB', 'oscC'].map((key, index) => <div className="advanced-card" key={key}><div className="advanced-card-title"><span className="led led-lime" /><strong>{key.toUpperCase()}</strong><span className="chip">{state[key]?.mode || 'wavetable'}</span></div><div className="mode-buttons">{['wavetable', 'sample', 'multisample', 'granular', 'spectral'].map((mode) => <button key={mode} className={(state[key]?.mode || 'wavetable') === mode ? 'selected' : ''} onClick={() => setMode(key, mode)}>{mode}</button>)}</div><div className="advanced-knobs"><Knob label="PHASE" value={state[key]?.phase ?? 0.5} onChange={(v) => setState((p) => ({ ...p, [key]: { ...p[key], phase: v } }))} valueText={`${Math.round((state[key]?.phase ?? 0.5) * 360)}°`} compact /><Knob label="WARP 1" value={state[key]?.warp1 ?? 0.2} onChange={(v) => setState((p) => ({ ...p, [key]: { ...p[key], warp1: v } }))} valueText={`${Math.round((state[key]?.warp1 ?? 0.2) * 100)}`} compact /><Knob label="WARP 2" value={state[key]?.warp2 ?? 0.35} onChange={(v) => setState((p) => ({ ...p, [key]: { ...p[key], warp2: v } }))} valueText={`${Math.round((state[key]?.warp2 ?? 0.35) * 100)}`} compact /></div><div className="warp-row"><Select value={state[key]?.warpType || 'FM'} onChange={(warpType) => setState((p) => ({ ...p, [key]: { ...p[key], warpType } }))}>{['FM', 'PM', 'PD', 'RING', 'DISTORT', 'OFF'].map((x) => <option key={x}>{x}</option>)}</Select><label><input type="checkbox" checked={state[key]?.phaseMemory ?? true} onChange={(e) => setState((p) => ({ ...p, [key]: { ...p[key], phaseMemory: e.target.checked } }))} /> PHASE MEMORY</label></div></div>)}</div><AudioFileLoader engine={engine} />
  </Panel>;
}

function LfoPanel({ state, setState }) {
  const shapes = ['sine', 'triangle', 'square', 'random', 'lorenz', 'rossler'];
  return <Panel title="LFO MATRIX" right="10 SOURCES · DRAW · CHAOS">
    <div className="lfo-bank">{state.lfos.map((lfo, index) => <div className={`lfo-cell ${lfo.on ? 'active' : ''}`} key={lfo.id}><div className="lfo-cell-head"><Toggle checked={lfo.on} onChange={(v) => setState((p) => ({ ...p, lfos: p.lfos.map((x) => x.id === lfo.id ? { ...x, on: v } : x) }))} label={`Activar ${lfo.id}`} /><strong>{lfo.id}</strong></div><Select value={lfo.shape} onChange={(shape) => setState((p) => ({ ...p, lfos: p.lfos.map((x) => x.id === lfo.id ? { ...x, shape } : x) }))}>{shapes.map((shape) => <option key={shape}>{shape}</option>)}</Select><Knob label="RATE" value={lfo.rate} min={0.01} max={1000} step={0.01} onChange={(rate) => setState((p) => ({ ...p, lfos: p.lfos.map((x) => x.id === lfo.id ? { ...x, rate } : x) }))} valueText={`${lfo.rate.toFixed(lfo.rate < 10 ? 2 : 0)} Hz`} compact /><Knob label="DEPTH" value={lfo.depth} onChange={(depth) => setState((p) => ({ ...p, lfos: p.lfos.map((x) => x.id === lfo.id ? { ...x, depth } : x) }))} valueText={`${Math.round(lfo.depth * 100)}`} compact /></div>)}</div>
  </Panel>;
}

function EnvelopePanel({ state, setState }) {
  return <Panel title="ENVELOPES" right="4 COMPLETE ADSR SOURCES"><div className="envelope-bank">{state.envelopes.map((env) => <div className="advanced-card envelope-card" key={env.id}><div className="advanced-card-title"><strong>{env.id}</strong><label><input type="checkbox" checked={env.bpm} onChange={(e) => setState((p) => ({ ...p, envelopes: p.envelopes.map((x) => x.id === env.id ? { ...x, bpm: e.target.checked } : x) }))} /> BPM</label><label><input type="checkbox" checked={env.invert} onChange={(e) => setState((p) => ({ ...p, envelopes: p.envelopes.map((x) => x.id === env.id ? { ...x, invert: e.target.checked } : x) }))} /> INV</label></div><div className="advanced-knobs"><Knob label="ATK" value={env.attack} min={0.001} max={4} step={0.001} onChange={(v) => setState((p) => ({ ...p, envelopes: p.envelopes.map((x) => x.id === env.id ? { ...x, attack: v } : x) }))} valueText={`${env.attack.toFixed(2)}s`} compact /><Knob label="DEC" value={env.decay} min={0.01} max={4} step={0.01} onChange={(v) => setState((p) => ({ ...p, envelopes: p.envelopes.map((x) => x.id === env.id ? { ...x, decay: v } : x) }))} valueText={`${env.decay.toFixed(2)}s`} compact /><Knob label="SUS" value={env.sustain} onChange={(v) => setState((p) => ({ ...p, envelopes: p.envelopes.map((x) => x.id === env.id ? { ...x, sustain: v } : x) }))} valueText={`${Math.round(env.sustain * 100)}`} compact /><Knob label="REL" value={env.release} min={0.01} max={5} step={0.01} onChange={(v) => setState((p) => ({ ...p, envelopes: p.envelopes.map((x) => x.id === env.id ? { ...x, release: v } : x) }))} valueText={`${env.release.toFixed(2)}s`} compact /></div></div>)}</div></Panel>;
}

function MatrixPanel({ state, setState }) {
  return <Panel title="MODULATION MATRIX" right={`${state.matrix.length} ROUTES · DRAG VALUES`}><div className="matrix-table"><div className="matrix-row matrix-header"><span>SOURCE</span><span>DESTINATION</span><span>AMOUNT</span><span>CURVE</span><span /></div>{state.matrix.map((row) => <div className="matrix-row" key={row.id}><Select value={row.source} onChange={(source) => setState((p) => ({ ...p, matrix: p.matrix.map((x) => x.id === row.id ? { ...x, source } : x) }))}>{MOD_SOURCES.map((x) => <option key={x}>{x}</option>)}</Select><Select value={row.destination} onChange={(destination) => setState((p) => ({ ...p, matrix: p.matrix.map((x) => x.id === row.id ? { ...x, destination } : x) }))}>{MOD_DESTINATIONS.map((x) => <option key={x}>{x}</option>)}</Select><Knob label="AMT" value={row.amount} min={-1} max={1} step={0.01} onChange={(amount) => setState((p) => ({ ...p, matrix: p.matrix.map((x) => x.id === row.id ? { ...x, amount } : x) }))} valueText={row.amount.toFixed(2)} compact /><Select value={row.curve} onChange={(curve) => setState((p) => ({ ...p, matrix: p.matrix.map((x) => x.id === row.id ? { ...x, curve } : x) }))}>{['linear', 'exp', 'bipolar', 'step'].map((x) => <option key={x}>{x}</option>)}</Select><button className="icon-button" onClick={() => setState((p) => ({ ...p, matrix: p.matrix.filter((x) => x.id !== row.id) }))}>×</button></div>)}<button className="add-button" onClick={() => setState((p) => ({ ...p, matrix: [...p.matrix, { id: Date.now(), source: 'LFO 1', destination: 'FILTER 1 CUTOFF', amount: 0.25, curve: 'linear' }] }))}>+ ADD ROUTE</button></div></Panel>;
}

function MixerPanel({ state, setState }) {
  return <Panel title="MIXER" right="OSCILLATORS · FILTERS · TWO FX BUSES"><div className="mixer-grid">{state.mixer.map((channel) => <div className="mixer-channel" key={channel.id}><strong>{channel.id}</strong><div className="meter-column"><i style={{ height: `${20 + channel.level * 75}%` }} /></div><Knob label="LEVEL" value={channel.level} onChange={(level) => setState((p) => ({ ...p, mixer: p.mixer.map((x) => x.id === channel.id ? { ...x, level } : x) }))} valueText={`${Math.round(channel.level * 100)}`} compact /><Knob label="PAN" value={(channel.pan + 1) / 2} onChange={(v) => setState((p) => ({ ...p, mixer: p.mixer.map((x) => x.id === channel.id ? { ...x, pan: v * 2 - 1 } : x) }))} valueText={channel.pan.toFixed(2)} compact /><label><input type="checkbox" checked={!channel.mute} onChange={(e) => setState((p) => ({ ...p, mixer: p.mixer.map((x) => x.id === channel.id ? { ...x, mute: !e.target.checked } : x) }))} /> ON</label></div>)}</div></Panel>;
}

function SequencerPanel({ state, setState }) {
  const [dragged, setDragged] = useState(null);
  const [playing, setPlaying] = useState(false);
  const scaleOptions = ['Chromatic', 'Major', 'Minor', 'Dorian', 'Pentatonic'];
  return <Panel title="ARP + CLIP SEQUENCER" right="TEMPO-SYNCED · 16 STEPS"><div className="seq-toolbar"><button className={playing ? 'selected' : ''} onClick={() => setPlaying(!playing)}>{playing ? '■ STOP' : '▶ PLAY'}</button><Knob label="BPM" value={state.tempo} min={40} max={240} step={1} onChange={(tempo) => setState((p) => ({ ...p, tempo }))} valueText={`${state.tempo}`} compact /><Select value={state.arp.mode} onChange={(mode) => setState((p) => ({ ...p, arp: { ...p.arp, mode } }))}>{['OFF', 'UP', 'DOWN', 'UP/DOWN', 'RANDOM', 'CHORD'].map((x) => <option key={x}>{x}</option>)}</Select><Select value={state.arp.rate} onChange={(rate) => setState((p) => ({ ...p, arp: { ...p.arp, rate } }))}>{['1/1', '1/2', '1/4', '1/8', '1/16'].map((x) => <option key={x}>{x}</option>)}</Select><Select value={state.keyboard.scale} onChange={(scale) => setState((p) => ({ ...p, keyboard: { ...p.keyboard, scale } }))}>{scaleOptions.map((x) => <option key={x}>{x}</option>)}</Select><Knob label="TRANS" value={state.keyboard.transpose + 24} min={0} max={48} step={1} onChange={(v) => setState((p) => ({ ...p, keyboard: { ...p.keyboard, transpose: v - 24 } }))} valueText={`${state.keyboard.transpose}`} compact /><Knob label="SWING" value={state.keyboard.swing} onChange={(swing) => setState((p) => ({ ...p, keyboard: { ...p.keyboard, swing } }))} valueText={`${Math.round(state.keyboard.swing * 100)}`} compact /></div><div className="step-grid">{state.clip.steps.map((step, index) => <button key={step.id} draggable onDragStart={() => setDragged(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragged === null || dragged === index) return; setState((p) => { const steps = [...p.clip.steps]; const [item] = steps.splice(dragged, 1); steps.splice(index, 0, item); return { ...p, clip: { ...p.clip, steps } }; }); setDragged(null); }} className={step.on ? 'selected' : ''} onClick={() => setState((p) => ({ ...p, clip: { ...p.clip, steps: p.clip.steps.map((x) => x.id === step.id ? { ...x, on: !x.on } : x) } }))}><span>{index + 1}</span><b style={{ height: `${20 + step.velocity * 70}%` }} /></button>)}</div><div className="keyboard-routing"><label>OSC MAPPING</label>{['A', 'B', 'C', 'SUB', 'NOISE'].map((osc) => <button key={osc} className={state.keyboard.mapping.includes(osc) ? 'selected' : ''} onClick={() => setState((p) => ({ ...p, keyboard: { ...p.keyboard, mapping: p.keyboard.mapping.includes(osc) ? p.keyboard.mapping.filter((x) => x !== osc) : [...p.keyboard.mapping, osc] } }))}>{osc}</button>)}</div></Panel>;
}

function EffectsAdvancedPanel({ state, setState }) {
  const [dragged, setDragged] = useState(null);
  const move = (from, to) => setState((p) => { const effects = [...p.effects]; const [item] = effects.splice(from, 1); effects.splice(to, 0, item); return { ...p, effects }; });
  return <Panel title="FX ARCHITECTURE" right="13 EFFECTS · 3 SPLITTERS · DUAL BUS"><div className="bus-routing"><button className={state.fxRouting === 'series' ? 'selected' : ''} onClick={() => setState((p) => ({ ...p, fxRouting: 'series' }))}>SERIES</button><button className={state.fxRouting === 'parallel' ? 'selected' : ''} onClick={() => setState((p) => ({ ...p, fxRouting: 'parallel' }))}>PARALLEL</button><button onClick={() => setState((p) => ({ ...p, activeBus: p.activeBus === 1 ? 2 : 1 }))}>BUS {state.activeBus} ACTIVE</button><span>BUS 1 → BUS 2 → MASTER</span></div><div className="fx-order">{state.effects.map((fx, index) => <div key={fx.id} className={`effect-chip ${fx.on ? 'on' : ''}`} draggable onDragStart={() => setDragged(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragged !== null && dragged !== index) move(dragged, index); setDragged(null); }}><Toggle checked={fx.on} onChange={(on) => setState((p) => ({ ...p, effects: p.effects.map((x) => x.id === fx.id ? { ...x, on } : x) }))} label={`Activar ${fx.type}`} tone="cyan" /><strong>{fx.type}</strong><span>BUS {fx.bus}</span><button onClick={() => setState((p) => ({ ...p, effects: p.effects.filter((x) => x.id !== fx.id) }))}>×</button></div>)}</div><div className="splitter-row"><span>SPLITTERS</span>{SPLITTERS.map((splitter) => <button key={splitter} className={state.splitter === splitter ? 'selected' : ''} onClick={() => setState((p) => ({ ...p, splitter }))}>SPLITTER {splitter}</button>)}<button className="add-button" onClick={() => setState((p) => ({ ...p, effects: [...p.effects, { id: Date.now(), type: 'UTILITY', on: true, bus: p.activeBus }] }))}>+ ADD EFFECT</button></div></Panel>;
}


const makePresetEffects = (active) => FX_TYPES.map((type, index) => ({ id: index + 1, type, on: active.includes(type), bus: index % 2 + 1 }));

const PRESET_LIBRARY = [
  { name: 'FX - Demon Woosh', category: 'FX', description: 'Barrido agresivo con distorsión, delay y movimiento de filtro.', tags: ['WAVETABLE', 'MOTION'], patch: { cutoff: 3600, resonance: 0.8, attack: 0.005, decay: 0.18, sustain: 0.7, release: 0.4, lfoOn: true, lfoRate: 2.2, lfoDepth: 0.26, distortionOn: true, distortion: 0.18, delayOn: true, delayMix: 0.22, oscA: { on: true, wave: 'saw', level: 0.72, octave: 2, semitone: -4, detune: -41, pan: -0.12 }, oscB: { on: true, wave: 'square', level: 0.48, octave: -2, semitone: -7, detune: 0, pan: 0.12 }, effects: makePresetEffects(['DELAY', 'DISTORTION', 'REVERB']) } },
  { name: 'INIT — Clean Slate', category: 'INIT', description: 'Punto de partida limpio para diseñar un sonido desde cero.', tags: ['INIT', 'BASIC'], patch: { cutoff: 7200, resonance: 0.25, attack: 0.01, decay: 0.32, sustain: 0.65, release: 0.28, lfoOn: false, distortionOn: false, delayOn: false, oscA: { on: true, wave: 'saw', level: 0.55, octave: 0, semitone: 0, detune: 0, pan: 0 }, oscB: { on: false, wave: 'square', level: 0.3, octave: -1, semitone: 0, detune: 0, pan: 0 }, sub: { on: false, wave: 'sine', level: 0.2, octave: -1, pan: 0 }, effects: makePresetEffects([]) } },
  { name: 'Deep Sub Bass', category: 'BASS', description: 'Subgrave compacto con filtro cerrado y saturación controlada.', tags: ['SUB', 'MONO'], patch: { cutoff: 620, resonance: 1.6, attack: 0.004, decay: 0.22, sustain: 0.72, release: 0.24, lfoOn: false, distortionOn: true, distortion: 0.28, delayOn: false, oscA: { on: true, wave: 'saw', level: 0.82, octave: -1, semitone: 0, detune: -8, pan: 0 }, oscB: { on: false, wave: 'square', level: 0.2, octave: -2, semitone: 0, detune: 0, pan: 0 }, sub: { on: true, wave: 'sine', level: 0.9, octave: -2, pan: 0 }, effects: makePresetEffects(['DISTORTION', 'COMPRESSOR']) } },
  { name: 'Glass Pluck', category: 'KEYS', description: 'Ataque cristalino y decay corto para líneas rítmicas y arpegios.', tags: ['PLUCK', 'BRIGHT'], patch: { cutoff: 5200, resonance: 0.9, attack: 0.002, decay: 0.28, sustain: 0.16, release: 0.22, lfoOn: true, lfoRate: 5.2, lfoDepth: 0.12, distortionOn: false, delayOn: true, delayMix: 0.3, oscA: { on: true, wave: 'triangle', level: 0.68, octave: 1, semitone: 0, detune: 6, pan: -0.1 }, oscB: { on: true, wave: 'sine', level: 0.22, octave: 2, semitone: 0, detune: 0, pan: 0.1 }, effects: makePresetEffects(['DELAY', 'CHORUS']) } },
  { name: 'Analog Memory', category: 'PAD', description: 'Capa cálida y lenta con vibrato suave y cola envolvente.', tags: ['WARM', 'SLOW'], patch: { cutoff: 2400, resonance: 0.55, attack: 0.42, decay: 1.2, sustain: 0.82, release: 1.8, lfoOn: true, lfoRate: 0.7, lfoDepth: 0.16, distortionOn: false, delayOn: true, delayMix: 0.36, oscA: { on: true, wave: 'saw', level: 0.42, octave: 0, semitone: 0, detune: -12, pan: -0.22 }, oscB: { on: true, wave: 'triangle', level: 0.36, octave: 0, semitone: 7, detune: 10, pan: 0.22 }, effects: makePresetEffects(['CHORUS', 'REVERB', 'DELAY']) } },
  { name: 'Granular Motion', category: 'TEXTURE', description: 'Textura granular con densidad modulada y movimiento estéreo.', tags: ['GRANULAR', 'LFO'], patch: { cutoff: 4100, resonance: 1.1, attack: 0.08, decay: 0.6, sustain: 0.58, release: 0.8, lfoOn: true, lfoRate: 3.6, lfoDepth: 0.34, distortionOn: false, delayOn: true, delayMix: 0.42, oscA: { on: true, wave: 'sine', level: 0.24, octave: 0, semitone: 0, detune: 0, pan: -0.3 }, oscB: { on: false, wave: 'square', level: 0.2, octave: -1, semitone: 0, detune: 0, pan: 0.3 }, oscC: { on: true, wave: 'triangle', mode: 'granular', level: 0.68, octave: -1, scan: 0.72, density: 0.8, length: 0.45, pan: 0 }, effects: makePresetEffects(['DELAY', 'REVERB', 'FLANGER']) } },
  { name: 'Spectral Glass', category: 'TEXTURE', description: 'Brillo espectral con modulación lenta y profundidad digital.', tags: ['SPECTRAL', 'AIR'], patch: { cutoff: 6800, resonance: 0.65, attack: 0.12, decay: 0.8, sustain: 0.66, release: 1.1, lfoOn: true, lfoRate: 1.4, lfoDepth: 0.2, distortionOn: false, delayOn: true, delayMix: 0.28, oscA: { on: true, wave: 'sine', mode: 'spectral', level: 0.5, octave: 1, semitone: 0, detune: 0, pan: -0.18 }, oscB: { on: true, wave: 'triangle', level: 0.28, octave: 2, semitone: 7, detune: 0, pan: 0.18 }, effects: makePresetEffects(['CHORUS', 'DELAY', 'REVERB']) } },
];

function PresetBrowser({ state, setState }) {
  const [category, setCategory] = useState('ALL');
  const categories = ['ALL', ...new Set(PRESET_LIBRARY.map((preset) => preset.category))];
  const query = state.presetSearch.trim().toLowerCase();
  const visiblePresets = PRESET_LIBRARY.filter((preset) => {
    const matchesQuery = !query || `${preset.name} ${preset.description} ${preset.tags.join(' ')}`.toLowerCase().includes(query);
    return matchesQuery && (category === 'ALL' || preset.category === category);
  });
  const selectPreset = (preset) => setState((current) => ({ ...current, ...preset.patch, preset: preset.name }));
  const current = PRESET_LIBRARY.find((preset) => preset.name === state.preset) || PRESET_LIBRARY[0];
  return <Panel title="PRESET BROWSER" right={`${PRESET_LIBRARY.length} SONIDOS · CARGA INSTANTÁNEA`}>
    <div className="preset-browser-head">
      <div><span className="preset-eyebrow">SONIDO ACTUAL</span><strong>{current.name}</strong><p>{current.description}</p></div>
      <span className="preset-current-tag">{current.category}</span>
    </div>
    <div className="preset-browser-tools"><input aria-label="Buscar sonidos" placeholder="Buscar sonidos..." value={state.presetSearch} onChange={(e) => setState((p) => ({ ...p, presetSearch: e.target.value }))} /><div className="preset-categories" role="list" aria-label="Categorías de presets">{categories.map((item) => <button type="button" key={item} className={item === category ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    <div className="preset-list">{visiblePresets.map((preset) => <button type="button" key={preset.name} className={`preset-card ${state.preset === preset.name ? 'selected' : ''}`} onClick={() => selectPreset(preset)} aria-pressed={state.preset === preset.name}><span className="preset-card-top"><strong>{preset.name}</strong><span>{preset.category}</span></span><small>{preset.description}</small><em>{preset.tags.join(' · ')}</em><b>LOAD →</b></button>)}</div>
    {!visiblePresets.length && <div className="preset-empty">No se encontraron sonidos para “{state.presetSearch}”.</div>}
  </Panel>;
}

export default function AdvancedPanels({ state, setState, engine }) {
  const [tab, setTab] = useState('OSC MODES');
  const tabs = ['OSC MODES', 'MIX', 'LFO', 'ENV', 'MATRIX', 'ARP/CLIP', 'FX', 'PRESETS'];
  const content = useMemo(() => ({
    'OSC MODES': <OscillatorModes state={state} setState={setState} engine={engine} />,
    MIX: <MixerPanel state={state} setState={setState} />,
    LFO: <LfoPanel state={state} setState={setState} />,
    ENV: <EnvelopePanel state={state} setState={setState} />,
    MATRIX: <MatrixPanel state={state} setState={setState} />,
    'ARP/CLIP': <SequencerPanel state={state} setState={setState} />,
    FX: <EffectsAdvancedPanel state={state} setState={setState} />,
    PRESETS: <PresetBrowser state={state} setState={setState} />,
  }), [state, setState]);
  return <section className="advanced-shell"><div className="advanced-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>{content[tab]}</section>;
}
