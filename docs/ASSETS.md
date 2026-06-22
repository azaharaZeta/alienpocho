# ASSETS.md — Flujo de assets de Alien Pocho

Cómo se crean y mejoran los gráficos del juego. Resumen rápido: **Claude propone, la usuaria
afina el pixel, el juego tiñe y coloca.** Los assets nacen vectoriales (`src/assets.js`) y se
migran a **PNG editado a mano** caso por caso, cuando merece la pena.

> **Por qué este flujo.** El dibujo isométrico 3D es el punto flaco de Claude (la oclusión y la
> perspectiva se le tuercen). Así que su salida es solo un **borrador**: propone la forma a tamaño
> real y la usuaria pone el pixel bueno encima. División de trabajo según fortalezas.

---

## ⚠️ Principio rector (NO olvidar)

- **`tools/` es UTILLAJE DE DESARROLLO, NO es el juego.** La tool unificada [`tools/assets.html`](../tools/assets.html)
  (catálogo + visor/editor SVG; ver/crear SVG y descargar PNG neutro) y los generadores `gen-*.mjs` los
  usa **la usuaria** para autoría de assets. **No se publican** (ver [`.vercelignore`](../.vercelignore)),
  **no son funcionalidad del juego** y **NO entran en el análisis del juego** — van aparte.
- **El juego solo dibuja de DOS formas: PNG si existe; si no, SVG.** Nada más debería usarse en runtime.
- **El vector procedural (`AP.*` en `src/assets.js`) es RESIDUAL.** Hoy cumple tres papeles que NO son
  "el juego en producción": (a) es la **entrada de la tool** para generar SVG/PNG, (b) **fallback**
  mientras carga la imagen / en Node-tests, (c) **única vía** de los assets aún no migrados. El objetivo
  es que **desaparezca del runtime**. Los assets que todavía se dibujan procedural (robot, zócalo,
  pared/puerta paramétricas, domo, cilindro, suelo, columna) son **EXCEPCIONES pendientes de analizar y
  arreglar** → anotadas en [`docs/ideas/ideas.md`](ideas/ideas.md).

---

## Cómo dibuja el juego un asset (runtime)

1. **PNG** (preferente) — `assets/png/<id>.png`, silueta **neutra (grises)** editada a mano.
2. **SVG** (fallback) — `assets/svg/<id>.svg`, silueta neutra; se usa **si no hay PNG**.

En ambos casos el juego **tiñe** la silueta a la tinta de la sala (multiply) y la ancla en
`ref + (minX, minY)` a tamaño `w×h` (registro `SPRITES` en [`src/assets.js`](../src/assets.js); PNG y SVG
comparten ese encuadre). El vector procedural es solo el fallback residual descrito arriba, no una 3ª vía
deseada. Migrar un asset a PNG/SVG es **gradual y opcional**, asset por asset.

---

## La tubería (ver/crear SVG → PNG → juego)

1. **Ver o crear** el SVG en la tool [`tools/assets.html`](../tools/assets.html) (catálogo + visor/editor
   de assets; **NO pública**, **NO ejecuta funciones del juego** — solo carga ficheros):
   - **Asset existente**: pínchalo en el catálogo → el popup muestra su **SVG en modo lectura** y permite
     **descargar el PNG neutro**. Si es procedural (sin SVG), la tool lo avisa (no hay fichero que ver/exportar).
   - **Crear SVG**: botón **+ Crear SVG** → editor con un cubo a tamaño de juego; edítalo, ve el preview
     (neutro + teñido por paleta) y **descarga el `.svg` y el `.png` neutro**.
2. **PNG NEUTRO**: silueta en **grises sobre transparente** a **resolución de juego** (tamaño del `viewBox`).
3. **La usuaria edita/mejora el PNG** a mano (en grises: claro = brillo, oscuro = sombra; negro = línea)
   y, si le gusta, lo coloca ella en `assets/png/` (la tool solo descarga a local, no escribe en el repo).
4. **El juego lo tiñe y lo coloca**: lo carga, lo **tiñe a la tinta de la sala** (ver "Teñido") y lo dibuja
   anclado por su `(minX,minY)`. Se conserva el **monocromo-por-sala**.

---

## Convenciones (no romper)

### Resolución de juego CONSTANTE
El juego es pixelart a resolución fija. Cada asset se dibuja a su **tamaño nativo** (proyector
real: `TILE_W 34 · TILE_H 17 · BLOCK_H 17`, ver `POPT`/`CFG` en [`src/config.js`](../src/config.js))
y se escala con **vecino-más-próximo** (bloques nítidos).

- **El PNG se exporta a tamaño de juego** (un cubo = **34×34**). No se trabaja con PNG de más
  resolución: reescalar mete AA/borrosidad y rompe la rejilla de píxel. (Solo tendría sentido
  subir la resolución interna de TODO el juego — decisión aparte.)
- **Toda vista grande es un ZOOM pixelado** del render nativo (`imageSmoothingEnabled = false`),
  **nunca** un re-render del vector a otra resolución. Aplica a la tool [`tools/assets.html`](../tools/assets.html)
  (helpers `renderViewPixel` / `drawViewGame`).

### Teñido (mantener el monocromo-por-sala)
El PNG es una **silueta neutra (grises)** y el juego la tiñe en draw-time por **multiplicación**:

```
dibuja PNG → globalCompositeOperation "multiply" + fillRect(tinta) → "destination-in" + redibuja PNG
```

Esto equivale exactamente a `darken(tinta, f)` (lo mismo que hace el vector), así que conserva el
sombreado. Se cachea por tinta. Ver `tintedCubePng()` en [`src/render.js`](../src/render.js).

### Anclaje (automático)
Cada sprite se ancla en `P(coords) + (minX, minY)`, donde `(coords)` son los argumentos de la
función del asset y `(minX,minY)` es el offset del *bounding box* (lo calcula el generador, ver
abajo). Mismo encaje que el vector → el painter (`depthSort`) no cambia (ocupa la misma caja).

### Carpetas y publicación
- `assets/png/` — PNG finales (editados a mano). **SE PUBLICAN**.
- `assets/svg/` — SVG fuente/fallback + `manifest.json`. **SE PUBLICAN** (el juego los carga en
  runtime como fallback).
- `tools/` — tool + generador. **NO se publica** (en [`.vercelignore`](../.vercelignore)).

---

## El sistema de sprites en el juego

Vive en [`src/assets.js`](../src/assets.js) (no en `render.js`): así un asset migrado se dibuja igual
desde cualquier sitio que llame a su `AP.*`.

- **Parámetro global** `ASSET_USE_PNG` en [`src/config.js`](../src/config.js): si `true`, un asset
  migrado usa su PNG (`assets/png/<name>.png`) si existe; si no, su SVG (`assets/svg/<name>.svg`).
  Si `false`, siempre el SVG.
- **Registro `SPRITES`** en `assets.js`: por asset, `{ minX, minY, w, h }`.
- **`drawSprite(name, ctx, ref, col)`**: carga (PNG→SVG) y rasteriza a `w×h` (cacheado), tiñe por
  `col` (multiply, cacheado) y dibuja en `ref+(minX,minY)`. Devuelve `false` si **no está migrado**,
  **aún carga** o **no hay DOM** (Node/tests) → el llamador pinta el **vector** (degradado elegante).
- **Guarda** en cada `AP.*` migrado, p. ej.:
  `function cube(ctx,p,cx,cy,cz,col){ if (drawSprite("cube", ctx, p(cx,cy,cz), col)) return; /* vector */ }`

### Generar los SVG (fieles, sin dibujar a mano)
[`tools/gen-svg.mjs`](../tools/gen-svg.mjs) (Node) pasa a cada `AP.*` un **ctx grabador** que registra
los polígonos que pinta la función (con tinta blanca) y emite el `.svg` + el registro `{minX,minY,w,h}`.
Como `assets.js` es puro, corre **sin navegador**: `node tools/gen-svg.mjs`.

> ⚠️ **OJO (tras quitar el procedural de los migrados):** `gen-svg.mjs`/`gen-doors.mjs` generan el SVG
> ejecutando la función `AP.*`. Para los assets YA migrados (cube, prop_cube/pyramid, spikes, plant, pared,
> puerta) esa función ya no dibuja nada (solo `drawSprite`) → **ejecutar el generador produciría un SVG
> VACÍO y machacaría el bueno. NO correrlos para esos.** Su SVG es ahora la fuente; se edita con
> `tools/assets.html` (Crear SVG / a mano). Los generadores solo sirven ya para assets aún procedurales.

### La tool lee la situación REAL (sin listas a mano)
- [`tools/assets.html`](../tools/assets.html) muestra el catálogo completo: lista los SVG del
  `manifest.json` + auto-descubre los sprites de `AP.SPRITES`. Para poder VERLOS, los assets procedurales
  se renderizan (única forma de mostrar robot/zócalo/domo/…); pero el **SVG-fuente** y el **export-PNG**
  solo existen para los assets con SVG — de los procedurales la tool avisa "sin SVG".

---

## Estado actual

- ✅ Tool unificada `tools/assets.html` (catálogo + visor/editor SVG) + generadores `tools/gen-*.mjs` (dev).
- ✅ **Migrados** (sprite SVG fiel + PNG si existe): `cube`, `prop_cube`, `prop_pyramid`, `spikes`,
  `plant`. El bloque usa además `assets/png/cube.png` (editado a mano).
- ⬜ **No migrables aún** (no son sprites fijos): robot (animado), props domo/cilindro (cristal/curvos),
  zócalo (con estado), y los paramétricos (pared, suelo, puerta, columna). Ver idea en
  [PENDIENTES.md](PENDIENTES.md) sobre cómo "fijarlos".
