# Idea — `files: {svg, png}` → un solo `filename` (resolver extensión en runtime)

> **Estado: ✅ IMPLEMENTADA (2026-06-28).** Origen: usuaria. Ver "Resultado" al final.

## Qué pide
En `data/assets.js`, sustituir el bloque `files: { svg: "<nombre>.svg", png: "<nombre>.png" }` por algo tipo
`filename: "<nombre>"` (sin extensión). En runtime: buscar primero `.png` y, si no existe, `.svg`.

## Estado actual (código)
Cada asset declara `files: { svg, png }` ([assets.js:72-139](../../src/data/assets.js)); muchos tienen
`png: null` (solo SVG). Lo consume `AP.drawSprite` (`src/draw.js`, vía PNG→SVG) y lo valida
`test/assets.mjs` (fuente única registro ⇄ artefactos).

## Viabilidad técnica
- **Encaje:** es una simplificación de SSOT alineada con el proyecto ([[alien-pocho-assets-ssot]]).
- **Coste:** medio — el dato es uno, pero tiene **varios consumidores** que tocar a la vez: el registro
  (`assets.js`), el resolutor de sprites (`draw.js`), el **test** `assets.mjs` (que hoy casa svg/png con los
  artefactos), y la **tool** `tools/tool-assets.html`.
- **Riesgo:** medio. **Toca el registro de assets** → **`npm test`** (assets.mjs). Punto fino: "buscar si
  existe el PNG" en runtime implica un **probe** (intentar cargar y caer al SVG) o un manifiesto; decidir
  cuál para no meter I/O frágil ni 404 en consola.
- **Matiz `floor`:** ✅ resuelto (2026-06-28) — ya no hay `example.svg` fantasma; `floor` declara
  `files.svg:"floor.svg"` y se dibuja desde fichero como el resto. Deja de ser un caso especial para esta idea.

## Conveniencia
Media. Es **limpieza** (menos ruido por asset, menos formas de declarar mal), no contenido jugable. Buen ROI
de mantenimiento si se hace bien; bajo si introduce probes frágiles.

## Sugerencia
**Mantener, pero decidir primero el mecanismo de resolución** (probe en runtime vs. manifiesto vs. mantener
una pista explícita de extensión). Hacerlo junto al saneo del `floor` fantasma. Correr `npm test`.

## Resultado (implementación 2026-06-28)
Resultó que el cargador **ya derivaba el nombre del id** (probaba `/<id>.png` → `/<id>.svg`); `files` solo lo
usaban el test y la tool, y `files.svg` era siempre `"<id>.svg"`. Así que se **eliminó `files`** por completo:
- **El id ES el nombre.** Helper nuevo `assetFiles(id)` (en `data/assets.js`) deriva `{ svg:"<id>.svg",
  png:"<id>.png"|null }`; devuelve `null` para procedurales (sin sprite/tile/tiles, p. ej. `robot`).
- **Flag `png: true`** solo en los assets con PNG editado en disco (`cube`, `door`, `wall1`). El cargador
  (`draw.js`) solo intenta el PNG si el asset lo declara → **se acabaron los ~10 × 404** de PNG inexistentes
  en consola/red (mejora tangible, además de la limpieza).
- Consumidores actualizados a `assetFiles`: cargador/precarga (`draw.js`), test (`assets.mjs`) y la tool
  (`tool-assets.html`); se quitó el `extraFiles` vestigial.
- Verificado: `npm test` verde (16 assets); el juego renderiza igual (cube/door/wall1 desde PNG, resto SVG);
  la recarga post-fix **no genera 404 nuevos**.
