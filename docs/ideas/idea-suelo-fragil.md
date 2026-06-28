# Idea — Suelo frágil que se rompe (trait `crumbling`)

> **Estado: PENDIENTE — Prioridad BAJA.** Origen: IA, procesado 2026-06-28.

## Qué es
Casillas de suelo (o losetas-asset) que **se rompen al pisarlas** y caen, creando huecos de un solo uso.
Genera rutas irreversibles y puzzles de orden ("¿por dónde paso primero?").

## Viabilidad técnica
- **Encaje:** combina dos cosas que ya existen — detección de "quién apoya encima"
  (`supportHeight`/`objSupport`) y el trait `falls` (gravedad de móviles en `updateObjects`,
  [physics.js](../../src/physics.js)). La loseta se marca como pisada y, tras un instante, pasa a `falls`.
- **Sutileza:** el suelo z=0 hoy es un pre-pase de fondo en [render.js](../../src/render.js), no un colocable.
  Para que una loseta sea frágil tiene que ser un **asset colocable** (entra al painter como los demás), no el
  suelo procedural. Eso ya es posible (es un asset más), pero hay que modelarlo como objeto, no como fondo.
- **Coste:** medio. **Riesgo:** bajo-medio (vigilar que el robot pierda apoyo correctamente al romperse;
  **`npm test`**).

## Conveniencia
Baja-media: vistoso y buen puzzle, pero sin telegrafiado claro frustra. **Depende mucho** de la
[[idea-sombra-robot]] (ver dónde vas a pisar) para ser justo en proyección isométrica.

## Sugerencia
No abordar hasta tener la **sombra del robot**. Reusar `falls` en lugar de inventar caída propia.
