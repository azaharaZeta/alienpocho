# ASSETS.md — Flujo de assets de Alien Pocho

Cómo se crean y mejoran los gráficos del juego. Resumen rápido: **Claude propone, la usuaria
afina el pixel, el juego tiñe y coloca.** Los assets nacen vectoriales (`src/draw.js`) y se
migran a **PNG editado a mano** caso por caso, cuando merece la pena.

> **Por qué este flujo.** El dibujo isométrico 3D es el punto flaco de Claude (la oclusión y la
> perspectiva se le tuercen). Así que su salida es solo un **borrador**: propone la forma a tamaño
> real y la usuaria pone el pixel bueno encima. División de trabajo según fortalezas.

---

## ⚠️ Principio rector (NO olvidar)

- **`tools/` es UTILLAJE DE DESARROLLO, NO es el juego.** La tool [`tools/tool-assets.html`](../tools/tool-assets.html)
  (catálogo + visor/editor SVG; ver/crear SVG y descargar PNG neutro) la usa **la usuaria** para autoría de
  assets. **No se publica** (ver [`.vercelignore`](../.vercelignore)) ni cuenta en el análisis del juego.
- **El juego solo dibuja de DOS formas: PNG si existe; si no, SVG.** Nada más debería usarse en runtime.
- **Los assets-sprite ya NO tienen fallback procedural.** Cada uno se dibuja SOLO desde su fichero
  (PNG→SVG) por la vía única `AP.drawSprite`; mientras la imagen carga, no se pinta (de ahí la idea de
  **precargar**, ver [`docs/ideas/ideas.md`](ideas/ideas.md)).
- **El dibujo procedural (`AP.*` en `src/draw.js`) queda solo para lo que NO es un sprite fijo**: robot
  (animado) y la cáscara estructural (suelo/pared/puerta, paramétricas por tamaño de sala). Es
  además la entrada con la que la tool genera el SVG inicial. El objetivo a futuro es reducir el procedural
  al mínimo imprescindible (lo animado/paramétrico). El **zócalo** ya NO es procedural: su peana es
  `socket.svg` y el drawer solo COMPONE sprites (peana teñida por estado + circuito/fantasma), sin `box`/`poly`.

---

## Cómo dibuja el juego un asset (runtime)

1. **PNG** (preferente) — `assets/png/<id>.png`, silueta **neutra (grises)** editada a mano.
2. **SVG** (fallback) — `assets/svg/<id>.svg`, silueta neutra; se usa **si no hay PNG**.

En ambos casos el juego **tiñe** la silueta a la tinta de la sala (multiply) y la ancla en
`ref + (minX, minY)` a tamaño `w×h` (el encuadre `sprite{w,h,minX,minY}` está en el registro
[`src/data/assets.js`](../src/data/assets.js); PNG y SVG lo comparten). Migrar un asset a PNG/SVG es
**gradual y opcional**, asset por asset.

---

## La tubería (ver/crear SVG → PNG → juego)

1. **Ver o crear** el SVG en la tool [`tools/tool-assets.html`](../tools/tool-assets.html) (catálogo + visor/editor
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
  **nunca** un re-render del vector a otra resolución. Aplica a la tool [`tools/tool-assets.html`](../tools/tool-assets.html)
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
función del asset y `(minX,minY)` (del registro) es el offset del *bounding box*. Mismo encaje que el
vector → el painter (`depthSort`) ocupa la misma caja.

### Carpetas y publicación
- `assets/png/` — PNG finales (editados a mano). **SE PUBLICAN**.
- `assets/svg/` — SVG fuente/fallback + `manifest.json`. **SE PUBLICAN** (el juego los carga en
  runtime como fallback).
- `tools/` — la tool de assets. **NO se publica** (en [`.vercelignore`](../.vercelignore)).

---

## El sistema de sprites en el juego

Vive en [`src/draw.js`](../src/draw.js) (no en `render.js`): así un asset migrado se dibuja igual
desde cualquier sitio que llame a su `AP.*`.

- **Parámetro global** `ASSET_USE_PNG` en [`src/config.js`](../src/config.js): si `true`, un asset
  migrado usa su PNG (`assets/png/<name>.png`) si existe; si no, su SVG (`assets/svg/<name>.svg`).
  Si `false`, siempre el SVG.
- **Encuadre del sprite** (`{ minX, minY, w, h }`) por asset: en el registro `src/data/assets.js`
  (`AP.SPRITES` en draw.js lo deriva de ahí).
- **`drawSprite(name, ctx, ref, col)`**: carga (PNG→SVG) y rasteriza a `w×h` (cacheado), tiñe por
  `col` (multiply, cacheado) y dibuja en `ref+(minX,minY)`. Devuelve `false` si **no está migrado**,
  **aún carga** o **no hay DOM** (Node/tests) → el llamador pinta el **vector** (degradado elegante).
- **Guarda** en cada `AP.*` migrado, p. ej.:
  `function cube(ctx,p,cx,cy,cz,col){ if (drawSprite("cube", ctx, p(cx,cy,cz), col)) return; /* vector */ }`

### Sin generadores (todo es fichero fuente)
> 🗑️ **Los generadores `gen-svg.mjs`/`gen-doors.mjs`/`gen-walls.mjs` se ELIMINARON (2026-06-23).** Los dos
> primeros generaban el SVG ejecutando `AP.*`, pero los assets ya están migrados a sprite (`AP.*` solo hace
> `drawSprite`) → en Node dibujaban VACÍO y **machacaban** los SVG buenos. `gen-walls` aún funcionaba (panal
> procedural), pero las tiras de pared `wall1/2.svg` ya están versionadas y se editan a mano como cualquier
> otro asset. **La fuente de cada SVG es ahora el propio fichero** (editado a mano o creado con la tool); no
> se regeneran ejecutando funciones. En `tools/` solo queda `tool-assets.html`.

### La tool lee del registro (sin listas a mano)
- [`tools/tool-assets.html`](../tools/tool-assets.html) toma **todos** los assets de `src/data/assets.js`
  tal cual, los agrupa por su `group` y muestra sus `traits`. Cada asset se dibuja con el motor genérico
  `AP.drawAsset` (la tool no sabe de nombres ni tipos). El **SVG-fuente** y el **export-PNG** existen solo
  para los assets con `files`; de los procedurales la tool avisa "sin SVG".

---

## Estado actual

- ✅ Tool unificada `tools/tool-assets.html` (catálogo + visor/editor SVG). Es lo único en `tools/`.
- ✅ **Migrados** (sprite SVG; `draw:"sprite"`): `cube` (+`cube.png` editado a mano), `prop_cube`,
  `prop_pyramid`, `prop_dome`, `prop_cylinder`, `spikes`, `plant`, `computer`, `drone`. Al migrarlos
  se borró su dibujo procedural (`drone()`, el router `prop()` y `circuit()`).
- ✅ **Zócalo** (`socket`, 2026-06-24): la peana+indentación migrada a `socket.svg`; mantiene drawer propio
  (`draw:"socket"`) porque COMPONE varios sprites según estado (peana teñida vacío/lleno + circuito o
  fantasma). Sin `box`/`poly`. Patrón para assets CON ESTADO: la forma en SVG, el código solo la composición.
- ✅ **Ruta ÚNICA de sprites**: todo objeto-sprite (en sala, encima de un zócalo, en brazos del robot
  o en el icono del HUD) se pinta SIEMPRE por `AP.drawSprite(name, ctx, ref, col)` (`ref` = punto de
  pantalla). Se alcanza vía `drawAsset` (salas) o por llamada directa (zócalo/brazos/HUD); el mapeo
  forma→asset es `propAsset()` en [`src/data/assets.js`](../src/data/assets.js). Ya no hay `circuit()`.
- ⬜ **No migrables aún** (no son sprites fijos): robot (animado) y los paramétricos (pared, suelo, puerta).
  Ideas en [ideas/ideas.md](ideas/ideas.md) sobre cómo "fijarlos".
