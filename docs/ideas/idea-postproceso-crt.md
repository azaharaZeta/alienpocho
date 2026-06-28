# Idea — Post-proceso CRT / scanlines opcional

> **Estado: PENDIENTE — Prioridad BAJA (pulido estético, toggleable).** Origen: IA, procesado 2026-06-28.

## Qué es
Un filtro **opcional** sobre el canvas (scanlines + leve viñeta/glow, quizá ligera aberración) que refuerza la
estética ZX Spectrum / CRT. Activable/desactivable y persistente.

## Viabilidad técnica
- **Encaje:** una **pasada final** sobre el canvas en [render.js](../../src/render.js)/[main.js](../../src/main.js),
  después de pintar la escena y el HUD. Puede ser un overlay (líneas semitransparentes + gradiente radial) sin
  WebGL — Canvas 2D basta para scanlines y viñeta.
- **Coste:** bajo (efecto simple 2D). **Riesgo:** muy bajo (no toca lógica; solo dibuja encima). Persistencia
  del toggle vía [[idea-persistencia-localstorage]].
- **Aviso:** mantenerlo **opcional y por defecto suave** — un CRT agresivo daña la legibilidad del monocromo.

## Conveniencia
Baja como prioridad, pero alto retorno estético para el coste. Refuerza la identidad visual sin tocar gameplay.

## Sugerencia
Pulido tardío. Implementarlo como **toggle** desde el principio (como el mute de [[idea-audio]]). Probar que no
emborrona los sprites a la resolución de juego (320×240 escalado).
