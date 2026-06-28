# Idea — Placas de presión (trait `weighted` / `pressable`)

> **Estado: PENDIENTE — Prioridad MEDIA (mecánica de puzzle barata).** Origen: IA, procesado 2026-06-28.

## Qué es
Una casilla que se **activa cuando tiene peso encima** (el robot **o** un bloque empujado) y dispara un
efecto: abrir/cerrar una puerta, bajar una barrera, encender un zócalo a distancia, revelar una ruta. Es el
ladrillo clásico del puzzle isométrico y reaprovecha lo que ya tienes (empujar bloques sobre la placa).

## Viabilidad técnica
- **Encaje:** muy limpio vía traits. La física **ya sabe qué hay encima**: `supportHeight`/`objSupport` en
  [physics.js](../../src/physics.js) calculan el apoyo. La placa solo necesita preguntar "¿algún sólido/entidad
  me apoya en mi celda?". Asset nuevo en [data/assets.js](../../src/data/assets.js) con trait `pressable` +
  un drawer (placa hundida/elevada).
- **El "efecto"** es la única pieza nueva de lógica: un pequeño enlace placa→objetivo (p. ej. `target` en la
  instancia de `rooms.js`, como ya hace `socket` con `id`/`requires`). Una puerta condicional lee ese estado
  en `roomSolids` (poste presente/ausente).
- **Coste:** bajo-medio. **Riesgo:** bajo si el efecto es "puerta abierta/cerrada" (toca `roomSolids`, correr
  **`npm test`** por el painter/colisión).

## Conveniencia
Alta para el coste: multiplica el diseño de puzzles **sin** añadir mecánicas de acción (respeta el aparcado de
[[idea-enemigos-peligros-vidas]]). Combina de maravilla con apilar/empujar ([[idea-mas-salas-retos]]) y con
[[idea-bloques-deslizantes]].

## Sugerencia
Buen **primer candidato de mecánica nueva**: es la que más juego da por menos código y no rompe la esencia.
Empezar con el par mínimo *placa → una puerta de la misma sala*; dejar efectos cross-sala para después.
