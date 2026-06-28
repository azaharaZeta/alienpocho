# Idea — Silueta "x-ray" del robot cuando queda oculto

> **Estado: PENDIENTE — Prioridad MEDIA.** Origen: IA, procesado 2026-06-28.

## Qué es
Cuando una pared, puerta o bloque alto **tapa al robot**, dibujar su **contorno/silueta** por encima para no
perderlo de vista. Recurso clásico del isométrico Filmation (y del propio *Alien 8*).

## Viabilidad técnica
- **Encaje:** el painter **ya conoce el orden** atrás→adelante (`depthSort`, [engine.js](../../src/engine.js)):
  se sabe qué placements quedan delante del robot y solapan su caja. Si hay oclusión, repintar la silueta del
  robot (contorno o relleno semitransparente) como pasada final en [render.js](../../src/render.js).
- **Detección:** comparar la `aabb`/región proyectada del robot con la de los objetos ordenados después que él.
  El andamiaje de cajas ya existe (es lo que usan los overlays `j/k/l`).
- **Coste:** medio. **Riesgo:** bajo (es una pasada de dibujo extra; no toca física ni el orden real).

## Conveniencia
Media-alta: evita el "¿dónde está Pocho?" detrás de muros, especialmente con paredes de fondo y puertas.
Complementa la [[idea-sombra-robot]] (una da altura, la otra da posición cuando está tapado).

## Sugerencia
Empezar con **contorno simple** solo cuando la oclusión supere un umbral (evitar parpadeo en solapes mínimos).
Validar contra escena real con `j/k/l`, como manda [[idea-motor-bounds-visuales]].
