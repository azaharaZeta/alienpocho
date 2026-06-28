# Idea — Replay determinista (grabar inputs) + atract-mode

> **Estado: PENDIENTE — Prioridad BAJA (herramienta + presentación).** Origen: IA, procesado 2026-06-28.

## Qué es
Grabar la **secuencia de inputs** de una partida para poder **reproducirla** exactamente. Usos: (1) reproducir
bugs jugables de forma fiable, (2) demos/regresiones jugables, (3) **atract-mode**: el título reproduce una
partida fantasma mientras nadie juega (puro arcade retro).

## Viabilidad técnica
- **Encaje:** el bucle es **delta-time** y el painter es **determinista** (invariante en `test/painter.mjs`).
  Para un replay 100% fiel hay que reproducir el mismo `dt` por frame (o grabar inputs por frame de tiempo
  fijo). El input ya está centralizado: estado de teclado + flancos en [input.js](../../src/input.js).
- **Grabar:** volcar las acciones (held/pressed por frame) a un array; **reproducir:** alimentar ese array en
  lugar de leer el teclado real.
- **Atract-mode:** el título ([screens.js](../../src/screens.js)) entra en modo "playing" con input de replay
  en vez de esperar tecla.
- **Coste:** medio. **Riesgo:** medio — el determinismo exige fijar el `dt` (hoy se *clampa* pero varía por
  frame); quizá un modo "tiempo fijo" para grabación/reproducción.

## Conveniencia
Baja como prioridad directa, pero es **infraestructura**: facilita depurar regresiones jugables y da un toque
arcade muy de la época con el atract-mode.

## Sugerencia
Si se aborda, empezar por fijar un **timestep determinista** (acumulador de tiempo fijo) — beneficia también a
la estabilidad de la física. El atract-mode es el "premio" una vez tienes grabación fiable.
