# Idea — Bloques deslizantes (trait `slippery`)

> **Estado: PENDIENTE — Prioridad BAJA-MEDIA (variante de empuje).** Origen: IA, procesado 2026-06-28.

## Qué es
Un bloque que, al empujarlo, **se desliza en línea recta hasta chocar** con un sólido o el borde (estilo
sokoban sobre hielo), en vez de avanzar una celda. Puzzles de "colócalo en el sitio exacto calculando el tope".

## Viabilidad técnica
- **Encaje:** reusa el empuje y la colisión que ya tienes. Hoy `tryPush`/empuje avanza el `movable` un paso;
  con trait `slippery` el objeto repite el avance hasta que `blocksHoriz`/`objBlocked` ([physics.js](../../src/physics.js))
  diga que choca. Asset nuevo o trait añadido a `cube`.
- **Coste:** bajo-medio (un bucle de avance + decidir si el desliz es instantáneo o animado por frames).
  **Riesgo:** medio — si se anima el desliz, el objeto está "en movimiento" varios frames → verificar orden
  del painter y revalidación de colisión. Correr **`npm test`**. Ojo con [[bug-empuje-revalida-robot]].

## Conveniencia
Media: aporta un sabor de puzzle distinto y reconocible con muy poco motor nuevo. Combina con
[[idea-placas-de-presion]] (deslizar el bloque hasta la placa).

## Sugerencia
Empezar con **desliz instantáneo** (sin animación): elimina el riesgo de painter y prueba la mecánica. Animar
después si convence. Mantenerlo como trait opcional de `cube`, no un asset aparte.
