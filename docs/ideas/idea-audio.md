# Idea — Audio (WebAudio) + toggle de silencio persistente

> **Estado: PENDIENTE — Prioridad BAJA.** Origen: IA, procesado 2026-06-27.

## Qué es
Efectos sencillos con WebAudio (saltar, coger, soltar, colocar circuito) + **toggle de silencio**
persistente (localStorage). El GDD (§10) ya lo contempla como "Audio (pendiente)... opcional".

## Viabilidad técnica
- **Encaje:** limpio y aislado. Un módulo `audio.js` (hoja) con synth WebAudio (sin assets de sonido), que
  el juego invoca en los eventos ya existentes (salto, pick/place en `game.js`/`player.js`).
- **Coste:** bajo-medio (diseñar los efectos retro). **Riesgo:** bajo, no toca física ni painter.

## Conveniencia
Baja-media. Aporta jugo retro y feedback, pero no desbloquea ni corrige nada. Encaja con la estética
Spectrum (beeps).

## Sugerencia
**Mantener como pulido tardío.** Hacerlo cuando el bucle (pantallas de victoria/game over) esté cerrado. Mantenerlo
**opcional y silenciable** desde el principio.
