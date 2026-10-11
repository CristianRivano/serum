import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SynthEngine } from './audio/SynthEngine';

const initialState = {
  activeTab: 'OSC',
  preset: 'FX - Demon Woosh',
  master: 0.78,
  cutoff: 3600,
  resonance: 0.8,
  filterType: 'lowpass',
  filterOn: true,
  attack: 0.005,
  decay: 0.18,
  sustain: 0.7,
  release: 0.4,
  lfoOn: true,
  lfoShape: 'sine',
  lfoRate: 2.2,
  lfoDepth: 0.26,
  distortionOn: true,
  distortion: 0.18,
  delayOn: true,
  delayMix: 0.22,
  delayTime: 0.32,
  delayFeedback: 0.28,
  filterDrive: 0.28,
  filterMix: 0.8,
  macro: [0.22, 0.38, 0.64, 0.18, 0.46, 0.54, 0.28, 0.7],
  oscA: { on: true, wave: 'saw', level: 0.72, octave: 2, semitone: -4, detune: -41, pan: -0.12 },
  oscB: { on: true, wave: 'square', level: 0.48, octave: -2, semitone: -7, detune: 0, pan: 0.12 },
  sub: { on: true, wave: 'sine', level: 0.38, octave: -1, pan: 0 },
  oscC: { on: true, wave: 'triangle', level: 0.34, octave: -1, scan: 0.62, density: 0.48, length: 0.32, pan: 0 },
  noise: { on: true, level: 0.22, pan: 0 },
  filter2: { on: false, filterType: 'lowpass', cutoff: 5200, resonance: 0.5 },
};

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const formatValue = (value, unit = '') => `${typeof value === 'number' ? (Math.abs(value) >= 100 ? Math.round(value) : value.toFixed(2)) : value}${unit}`;

function Knob({ label, value, min = 0, max = 1, step = 0.01, onChange, color = 'cyan', valueText, compact = false }) {
  const startRef = useRef(null);
  const pct = ((value - min) / (max - min)) * 270 - 135;
  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = { y: event.clientY, value };
  };
  const onPointerMove = (event) => {
    if (!startRef.current) return;
    const delta = (startRef.current.y - event.clientY) * (max - min) / 160;
    const next = Math.round((startRef.current.value + delta) / step) * step;
    onChange(Math.min(max, Math.max(min, next)));
  };
  const onPointerUp = () => { startRef.current = null; };
  const onWheel = (event) => {
    event.preventDefault();
    const next = value + (event.deltaY < 0 ? step : -step) * Math.max(1, (max - min) / 0.5);
    onChange(Math.round(Math.min(max, Math.max(min, next)) / step) * step);
  };
  return (
    <div className={`knob-wrap ${compact ? 'compact' : ''}`}>
      <div
        className={`knob color-${color}`}
        style={{ '--angle': `${pct}deg` }}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') onChange(Math.min(max, value + step));
          if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') onChange(Math.max(min, value - step));
        }}
      ><span className="knob-marker" /></div>
      <span className="knob-label">{label}</span>
      {valueText !== undefined && <span className="knob-value">{valueText}</span>}
    </div>
  );
}

function Toggle({ checked, onChange, label, tone = 'cyan' }) {
  return <button className={`toggle ${checked ? `is-on tone-${tone}` : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked} title={label}><span /></button>;
}

function SectionTitle({ led = 'cyan', children, right }) {
  return <div className="section-title"><span className={`led led-${led}`} /> <strong>{children}</strong>{right && <span className="section-right">{right}</span>}</div>;
}

function WavePreview({ type = 'saw', color = 'lime' }) {
  const paths = { saw: 'M4 38 L28 7 L52 38 L76 7 L100 38', square: 'M4 37 L4 9 L33 9 L33 37 L63 37 L63 9 L96 9', triangle: 'M4 37 L28 8 L53 37 L77 8 L96 37', sine: 'M4 23 C15 2 27 2 39 23 S63 44 75 23 S87 2 96 23' };
  return <svg className={`wave-preview wave-${color}`} viewBox="0 0 100 46" preserveAspectRatio="none"><path d={paths[type] || paths.saw} /></svg>;
}

function OscillatorCard({ name, state, onChange, accent = 'lime', wavetable = 'AT Furthrrrr Mood Symmetry', sub = false }) {
  const update = (key, value) => onChange({ ...state, [key]: value });
  return (
    <section className={`module osc-card accent-${accent} ${!state.on ? 'module-off' : ''}`}>
      <div className="module-head"><div className="module-name"><Toggle checked={state.on} onChange={(v) => update('on', v)} label={`Activar ${name}`} tone={accent === 'cyan' ? 'cyan' : 'lime'} /><strong>{name}</strong><span className="chip">{sub ? 'SUB' : 'WAVETABLE'}</span></div><span className="module-menu">⋮</span></div>
      {!sub && <div className="wavetable-row"><span className="tiny-icon">◒</span><span>{wavetable}</span><span>⌄</span></div>}
      <div className="param-row">
        <span>OCT <b>{state.octave > 0 ? `+${state.octave}` : state.octave}</b></span>
        {!sub && <span>SEM <b>{state.semitone > 0 ? `+${state.semitone}` : state.semitone}</b></span>}
        {!sub && <span>FIN <b>{state.detune}</b></span>}
        <span>CRS <b>{sub ? '—' : '64.00'}</b></span>
      </div>
      <div className="wave-box"><WavePreview type={state.wave} color={accent} /><span className="wave-frame">{sub ? 'SUB OSCILLATOR' : '3D WT FRAME 01 / 64'}</span></div>
      <div className="wave-selectors">{['sine', 'triangle', 'saw', 'square'].map((wave) => <button key={wave} className={state.wave === wave ? 'selected' : ''} onClick={() => update('wave', wave)} aria-label={`Onda ${wave}`}><WavePreview type={wave} color={state.wave === wave ? accent : 'muted'} /></button>)}</div>
      <div className="knob-grid">
        <Knob label="WT POS" value={state.level} onChange={(v) => update('level', v)} color={accent} valueText={`${Math.round(state.level * 100)}`} compact />
        <Knob label="UNISON" value={state.unison ?? 0.44} onChange={(v) => update('unison', v)} color="muted" valueText={`${Math.round((state.unison ?? 0.44) * 4) + 1}`} compact />
        <Knob label="DETUNE" value={Math.abs(state.detune || 0) / 100} onChange={(v) => update('detune', Math.round(v * 100))} color={accent} valueText={state.detune ?? 0} compact />
        <Knob label="PAN" value={(state.pan + 1) / 2} onChange={(v) => update('pan', v * 2 - 1)} color={accent} valueText={state.pan?.toFixed(2) ?? '0'} compact />
        <Knob label="LEVEL" value={state.level} onChange={(v) => update('level', v)} color={accent} valueText={`${Math.round(state.level * 100)}`} compact />
      </div>
    </section>
  );
}

function FilterCard({ state, onChange, second = false }) {
  const update = (key, value) => onChange({ ...state, [key]: value });
  return <section className={`module filter-card ${!state.on ? 'module-off' : ''}`}>
    <div className="module-head"><div className="module-name"><Toggle checked={state.on} onChange={(v) => update('on', v)} label="Activar filtro" /><strong>FILTER {second ? '2' : '1'}</strong><span className="chip">{state.filterType === 'lowpass' ? 'MG LOW 12' : state.filterType.toUpperCase()}</span></div><span className="module-menu">⌄</span></div>
    <div className="filter-display"><div className="filter-curve" style={{ '--cutoff': `${Math.max(8, Math.min(94, Math.log(state.cutoff / 80) / Math.log(18000 / 80) * 88))}%` }} /><span>FILTER RESPONSE</span></div>
    <div className="filter-types">{['lowpass', 'highpass', 'bandpass'].map((type) => <button key={type} className={state.filterType === type ? 'selected' : ''} onClick={() => update('filterType', type)}>{type === 'lowpass' ? 'LP' : type === 'highpass' ? 'HP' : 'BP'}</button>)}</div>
    <div className="knob-grid filter-knobs"><Knob label="CUTOFF" value={state.cutoff} min={80} max={18000} step={10} onChange={(v) => update('cutoff', v)} color="cyan" valueText={`${Math.round(state.cutoff)} Hz`} compact /><Knob label="RES" value={state.resonance} max={20} step={0.1} onChange={(v) => update('resonance', v)} color="cyan" valueText={state.resonance.toFixed(1)} compact /><Knob label="DRIVE" value={state.filterDrive ?? 0.28} onChange={(v) => update('filterDrive', v)} color="muted" valueText={`${Math.round((state.filterDrive ?? 0.28) * 100)}`} compact /><Knob label="MIX" value={state.filterMix ?? 0.8} onChange={(v) => update('filterMix', v)} color="muted" valueText={`${Math.round((state.filterMix ?? 0.8) * 100)}`} compact /></div>
  </section>;
}

function ModPanel({ state, setState }) {
  const update = (key, value) => setState((prev) => ({ ...prev, [key]: value }));
  const updateMacro = (index, value) => setState((prev) => {
    const next = { ...prev, macro: prev.macro.map((item, i) => i === index ? value : item) };
    const assignments = [
      ['sub', 'level', value], ['oscC', 'level', value], ['noise', 'level', value], ['distortion', null, value],
      ['filterDrive', null, value], ['lfoRate', null, 0.5 + value * 12], ['cutoff', null, 300 + value * 10500], ['delayMix', null, value],
    ];
    const [target, key, mapped] = assignments[index];
    if (key) next[target] = { ...next[target], [key]: mapped };
    else next[target] = mapped;
    return next;
  });
  return <section className="mod-panel">
    <div className="mod-tabs"><div className="mod-tab macros-tab"><span>MACROS</span></div>{['ENV 1', 'ENV 2', 'ENV 3', 'LFO'].map((tab) => <button key={tab} className={`mod-tab ${tab === 'LFO' ? 'active' : ''}`}>{tab}{tab === 'LFO' && <span className="mod-ring" />}</button>)}</div>
    <div className="mod-body">
      <div className="macro-grid">{state.macro.map((value, index) => <Knob key={index} label={['SUB', 'GRANULAR', 'NOISE', 'FM', 'SHAPER', 'SPD', 'WHOOSH', 'DELAY'][index]} value={value} onChange={(v) => updateMacro(index, v)} color={index % 2 ? 'cyan' : 'lime'} valueText={`${Math.round(value * 100)}`} compact />)}</div>
      <div className="envelope-canvas"><div className="canvas-label">ENV 1 • AMPLITUDE</div><svg viewBox="0 0 500 180" preserveAspectRatio="none"><defs><linearGradient id="envFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity=".28" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs><path d="M0 162 L0 18 L120 18 C150 18 160 155 225 155 L500 155 L500 162 Z" fill="url(#envFill)" /><path d="M0 18 L120 18 C150 18 160 155 225 155 L500 155" fill="none" stroke="#20d3ee" strokeWidth="3" /></svg><div className="time-labels"><span>0.5 ms</span><span>0.0 ms</span><span>1.00 s</span><span>0.0 dB</span><span>446 ms</span></div></div>
      <div className="lfo-canvas"><div className="canvas-label">LFO • FILTER CUTOFF</div><svg viewBox="0 0 360 180" preserveAspectRatio="none"><path d="M0 110 C44 24 82 24 120 110 S198 196 240 110 S318 24 360 110" fill="none" stroke="#38bdf8" strokeWidth="3" /><circle cx="120" cy="110" r="5" fill="#eaf7ff" /><circle cx="240" cy="110" r="5" fill="#eaf7ff" /></svg><div className="lfo-controls"><Toggle checked={state.lfoOn} onChange={(v) => update('lfoOn', v)} label="Activar LFO" /><select value={state.lfoShape} onChange={(e) => update('lfoShape', e.target.value)}><option value="sine">SINE</option><option value="triangle">TRIANGLE</option><option value="square">SQUARE</option></select><Knob label="RATE" value={state.lfoRate} min={0.1} max={18} step={0.1} onChange={(v) => update('lfoRate', v)} color="cyan" valueText={`${state.lfoRate.toFixed(1)} Hz`} compact /><Knob label="DEPTH" value={state.lfoDepth} onChange={(v) => update('lfoDepth', v)} color="cyan" valueText={`${Math.round(state.lfoDepth * 100)}`} compact /></div></div>
    </div>
    <div className="adsr-row"><Knob label="ATK" value={state.attack} min={0.001} max={1} step={0.001} onChange={(v) => update('attack', v)} color="cyan" valueText={`${Math.round(state.attack * 1000)} ms`} compact /><Knob label="DEC" value={state.decay} min={0.01} max={2} step={0.01} onChange={(v) => update('decay', v)} color="cyan" valueText={`${state.decay.toFixed(2)} s`} compact /><Knob label="SUS" value={state.sustain} onChange={(v) => update('sustain', v)} color="cyan" valueText={`${Math.round(state.sustain * 100)}`} compact /><Knob label="REL" value={state.release} min={0.02} max={2} step={0.01} onChange={(v) => update('release', v)} color="cyan" valueText={`${state.release.toFixed(2)} s`} compact /></div>
  </section>;
}

function EffectsRack({ state, setState }) {
  const update = (key, value) => setState((prev) => ({ ...prev, [key]: value }));
  return <section className="fx-rack">
    <div className="fx-rack-title"><span className="led led-cyan" /><strong>FX BUS</strong><span>REALTIME INSERTS · ROUTED AFTER FILTER 2</span></div>
    <div className={`fx-module ${!state.distortionOn ? 'module-off' : ''}`}><div className="fx-module-head"><Toggle checked={state.distortionOn} onChange={(v) => update('distortionOn', v)} label="Activar distorsión" tone="cyan" /><strong>DISTORTION</strong><span className="chip">WAVESHAPER 4X</span></div><div className="fx-module-body"><div className="fx-graph distortion-graph"><span>SATURATION</span><i style={{ height: `${22 + state.distortion * 70}%` }} /></div><Knob label="DRIVE" value={state.distortion} onChange={(v) => update('distortion', v)} color="cyan" valueText={`${Math.round(state.distortion * 100)}`} compact /><Knob label="MIX" value={state.distortionOn ? 0.55 : 0} onChange={(v) => update('distortionOn', v > 0.01)} color="cyan" valueText="55" compact /></div></div>
    <div className={`fx-module ${!state.delayOn ? 'module-off' : ''}`}><div className="fx-module-head"><Toggle checked={state.delayOn} onChange={(v) => update('delayOn', v)} label="Activar delay" tone="cyan" /><strong>DELAY</strong><span className="chip">FEEDBACK STEREO</span></div><div className="fx-module-body"><div className="fx-graph delay-graph"><span>TIME {Math.round(state.delayTime * 1000)} ms</span><i style={{ left: `${state.delayMix * 90}%` }} /></div><Knob label="MIX" value={state.delayMix} onChange={(v) => update('delayMix', v)} color="cyan" valueText={`${Math.round(state.delayMix * 100)}`} compact /><Knob label="TIME" value={state.delayTime} min={0.02} max={1.2} step={0.01} onChange={(v) => update('delayTime', v)} color="cyan" valueText={`${Math.round(state.delayTime * 1000)} ms`} compact /><Knob label="FDBK" value={state.delayFeedback} onChange={(v) => update('delayFeedback', v)} color="cyan" valueText={`${Math.round(state.delayFeedback * 100)}`} compact /></div></div>
  </section>;
}

function Piano({ engine, params }) {
  const [pressed, setPressed] = useState(new Set());
  const whiteNotes = ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'];
  const blackOffsets = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26];
  const keyDown = useCallback((note) => { if (pressed.has(note)) return; setPressed((old) => new Set(old).add(note)); engine.trigger(note, 0.9, params); }, [engine, params, pressed]);
  const keyUp = useCallback((note) => { setPressed((old) => { const next = new Set(old); next.delete(note); return next; }); engine.release(note); }, [engine]);
  useEffect(() => () => { engine.panic(); }, [engine]);
  return <div className="keyboard-shell"><div className="keyboard-labels"><span>CLIP</span><span>ARP</span><span>TRANSPOSE: <b>0</b></span><span>KEY: —</span><span>SCALE: Major</span><span>SWING: OFF</span></div><div className="piano" onPointerLeave={() => { pressed.forEach((note) => engine.release(note)); setPressed(new Set()); }}>{whiteNotes.map((note) => <button key={note} className={`white-key ${pressed.has(note) ? 'pressed' : ''}`} onPointerDown={() => keyDown(note)} onPointerUp={() => keyUp(note)} onPointerCancel={() => keyUp(note)}><span>{note.startsWith('C') ? note : ''}</span></button>)}{blackOffsets.map((whiteIndex) => { const note = whiteNotes[whiteIndex]; return <button key={`${note}-black`} className={`black-key ${pressed.has(note) ? 'pressed' : ''}`} style={{ left: `calc(${(whiteIndex + 1) * (100 / whiteNotes.length)}% - 8px)` }} onPointerDown={(e) => { e.stopPropagation(); keyDown(note); }} onPointerUp={() => keyUp(note)} onPointerCancel={() => keyUp(note)} aria-label={`Tecla negra ${note}`} />; })}</div></div>;
}

export default function App() {
  const [state, setState] = useState(initialState);
  const engine = useMemo(() => new SynthEngine(), []);
  const [status, setStatus] = useState('READY');
  useEffect(() => { engine.setParams(state); }, [engine, state]);
  const updateOsc = (key, value) => setState((prev) => ({ ...prev, [key]: value }));
  const setParam = (key, value) => setState((prev) => ({ ...prev, [key]: value }));
  const start = () => { engine.ensureContext(); setStatus('AUDIO ACTIVE'); };
  const savePreset = () => { localStorage.setItem('serum-lab-preset', JSON.stringify(state)); setStatus('PRESET SAVED'); setTimeout(() => setStatus('READY'), 1400); };
  const loadPreset = () => { const saved = localStorage.getItem('serum-lab-preset'); if (saved) { setState(JSON.parse(saved)); setStatus('PRESET LOADED'); setTimeout(() => setStatus('READY'), 1400); } };
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span>SERUM</span><em>2</em><small>LAB</small></div>
      <nav className="mode-tabs">{['OSC', 'MIX', 'FX', 'MATRIX', 'GLOBAL'].map((tab) => <button key={tab} className={state.activeTab === tab ? 'active' : ''} onClick={() => setParam('activeTab', tab)}><i />{tab}</button>)}</nav>
      <div className="preset"><button onClick={loadPreset} title="Cargar preset">▣</button><strong>{state.preset}</strong><span>ARTIST: <b>Endov Lane</b></span><button onClick={() => setParam('preset', state.preset === 'FX - Demon Woosh' ? 'INIT — Clean Slate' : 'FX - Demon Woosh')}>⌄</button></div>
      <div className="top-actions"><button onClick={savePreset}>↶</button><button onClick={() => setState(initialState)}>↷</button><button onClick={start} className="menu-button">{status} ⌄</button><Knob label="MAIN" value={state.master} onChange={(v) => setParam('master', v)} color="cyan" valueText="" compact /></div>
    </header>
    <div className="subnav"><span className="session-dot" /> {status === 'AUDIO ACTIVE' ? 'AudioContext online · polyphony 32' : 'Click MAIN o toca el teclado para iniciar audio'}<span className="meter"><i style={{ height: `${18 + state.master * 42}%` }} /><i style={{ height: `${10 + state.lfoDepth * 60}%` }} /></span></div>
    <div className="upper-grid">
      <OscillatorCard name="SUB" state={state.sub} onChange={(v) => updateOsc('sub', v)} accent="lime" sub />
      <OscillatorCard name="OSC A" state={state.oscA} onChange={(v) => updateOsc('oscA', v)} accent="lime" />
      <OscillatorCard name="OSC B" state={state.oscB} onChange={(v) => updateOsc('oscB', v)} accent="lime" wavetable="Default Shapes" />
      <section className={`module granular-card ${!state.oscC.on ? 'module-off' : ''}`}><div className="module-head"><div className="module-name"><Toggle checked={state.oscC.on} label="Activar granular" onChange={(v) => updateOsc('oscC', { ...state.oscC, on: v })} tone="lime" /><strong>OSC C</strong><span className="chip">GRANULAR</span></div><span>⌄</span></div><div className="wavetable-row"><span>Alu Slap</span><span>⌄</span></div><div className="granular-wave"><WavePreview type={state.oscC.wave} color="lime" /><span>ONE-SHOT · FRAME {Math.round(state.oscC.scan * 64)}</span></div><div className="knob-grid"><Knob label="SCAN" value={state.oscC.scan} onChange={(v) => updateOsc('oscC', { ...state.oscC, scan: v })} color="lime" valueText={`${Math.round(state.oscC.scan * 100)}`} compact /><Knob label="DENS" value={state.oscC.density} onChange={(v) => updateOsc('oscC', { ...state.oscC, density: v })} color="lime" valueText={`${Math.round(state.oscC.density * 100)}`} compact /><Knob label="LENGTH" value={state.oscC.length} onChange={(v) => updateOsc('oscC', { ...state.oscC, length: v })} color="lime" valueText={`${Math.round(state.oscC.length * 100)}`} compact /><Knob label="LEVEL" value={state.oscC.level} onChange={(v) => updateOsc('oscC', { ...state.oscC, level: v })} color="lime" valueText={`${Math.round(state.oscC.level * 100)}`} compact /></div></section>
      <section className={`module noise-card ${!state.noise.on ? 'module-off' : ''}`}><div className="module-head"><div className="module-name"><Toggle checked={state.noise.on} label="Activar ruido" onChange={(v) => updateOsc('noise', { ...state.noise, on: v })} tone="lime" /><strong>NOISE</strong><span className="chip">White</span></div><span>⌄</span></div><div className="noise-display"><WavePreview type="sine" color="muted" /><span>STEREO {Math.round(state.noise.pan * 100)}</span></div><div className="knob-grid"><Knob label="PAN" value={(state.noise.pan + 1) / 2} onChange={(v) => updateOsc('noise', { ...state.noise, pan: v * 2 - 1 })} color="lime" valueText={state.noise.pan.toFixed(2)} compact /><Knob label="LEVEL" value={state.noise.level} onChange={(v) => updateOsc('noise', { ...state.noise, level: v })} color="lime" valueText={`${Math.round(state.noise.level * 100)}`} compact /></div></section>
      <FilterCard state={state} onChange={(v) => setState((prev) => ({ ...prev, ...v }))} />
      <FilterCard state={state.filter2} onChange={(v) => updateOsc('filter2', v)} second />
    </div>
    <ModPanel state={state} setState={setState} />
    <EffectsRack state={state} setState={setState} />
    <div className="bottom-strip"><div className="pitch-wheels"><div className="wheel"><span>PITCH</span><i style={{ top: '35%' }} /></div><div className="wheel"><span>MOD</span><i style={{ top: `${60 - state.lfoDepth * 30}%` }} /></div></div><Piano engine={engine} params={state} /><div className="engine-badge"><strong>SERUM 2 ENGINE</strong><span>DSP 96kHz · 64-BIT</span><button onClick={() => engine.panic()}>PANIC</button></div></div>
    <footer className="footer-note"><span>Serum Lab / React component playground</span><span><b>Web Audio API</b> · LFO modulation · waveshaper distortion · feedback delay</span></footer>
  </main>;
}
