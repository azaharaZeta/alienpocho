# Idea — Lógica de posicionamiento única para todos los objetos + bloques movibles

> **Estado: RESUELTA (implementada) — archivada 2026-06-28.** Origen: usuaria, procesado 2026-06-27.
> Anclaje unificado (`footMode:"center"` para todos) + empuje genérico por trait `movable` ya en el código.
> Reabrir solo si aparece un bloque que se ancle distinto o no se pueda empujar.

## Qué pedía
Que **todos** los objetos usen la misma lógica de posicionamiento, sean movibles o no (la usuaria sospechaba
que los objetos van al **centro** del tile y los **bloques** a un **extremo**, con dibujado distinto), e
**implementar que algunos bloques sean movibles** empujándolos.

## Hallazgo (estado real del código)
Ambas partes parecen **ya resueltas**:
- **Anclaje unificado:** `cube` y los props (`prop_cube`, `prop_pyramid`, `prop_dome`, `prop_cylinder`),
  socket, etc. usan **todos** `footMode: "center"` + `offset: { x: 0.5, y: 0.5 }`
  ([assets.js:98-139](../../../src/data/assets.js)). No hay ya bloques anclados "a un extremo": la huella se
  deriva igual para todos (`assetBox`/`assetRef`). Coincide con [[alien-pocho-assets-modularity]] (anclaje
  unificado, objetos `center`).
- **Bloques movibles:** el GDD §2 marca "Empujar bloques ✅ Implementado por trait `movable` de **instancia**;
  usado en puzzles (p. ej. REACTOR)". El empuje es genérico por trait (`thingHas(o,"movable")`), así que
  cualquier instancia (bloque incluido) puede declararse movable sin tocar lógica.

## Conveniencia / sugerencia
La intención de la idea ya está cubierta por refactores previos (cubeta única `objects` + traits +
anclaje unificado). **Sugerencia:** la usuaria **verifica en preview** que el comportamiento es el esperado
(un bloque marcado `movable` se empuja igual que un circuito) y, si es así, **archivar** este fichero a
`docs/ideas/archivo/`. Si aparece algún bloque que aún se ancle distinto o no se pueda empujar, reabrir con
el caso concreto.
