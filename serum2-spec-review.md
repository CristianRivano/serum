# Revisión de especificaciones de Serum 2

Fuentes oficiales consultadas:

- https://xferrecords.com/products/serum-2
- https://xferrecords.com/web-manual/serum-2/welcome
- https://static.xferrecords.com/Serum%202%20What's%20New.pdf

## Capacidades oficiales relevantes

Serum 2 combina síntesis wavetable, subtractiva, multisample, sample, granular y spectral. Tiene tres osciladores principales con cinco modos, además de sub y noise dedicados. Incluye hasta 10 LFO, cuatro envolventes, ocho macros, matriz de modulación, dos filtros con routing serie/paralelo, mixer, arpegiador, clip sequencer, keyboard mapping, voicing y un sistema FX con dos buses, 13 efectos y tres splitters.

## Estado de Serum Lab

Cubierto de forma funcional: React con estado centralizado, tres fuentes visuales principales, sub, noise, filtro doble en interfaz, ADSR de amplitud, un LFO, ocho macros, teclado virtual polifónico, distorsión waveshaper, delay feedback, guardado local de presets y layout responsive.

Parcial: OSC C todavía genera un oscilador triangle simplificado y no un motor granular real; los dos filtros tienen controles, pero faltan routing paralelo/serie seleccionable y una arquitectura de mezcla equivalente; las macros tienen ocho knobs y algunas asignaciones, pero no hay matriz editable de destinos; la envolvente sólo implementa ADSR de amplitud; el teclado no implementa transposición, escala, swing, arp ni oscillator mapping.

Ausente: modos sample, multisample/SFZ y spectral; edición avanzada de wavetable, dual warp, FM/PD/ring modulation; LFO 2–10, herramientas de dibujo y modos chaos Lorenz/Rossler; ENV 2–4, BPM/invert/legato; mixer dedicado; arpegiador; clip sequencer; matrix; dos buses FX, 13 efectos y splitters; presets/browsing avanzado, undo/redo completo y drag-and-drop de módulos.
