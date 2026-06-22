# ASSETS.md — Flujo de assets de Alien Pocho

Cómo se crean y mejoran los gráficos del juego. Resumen rápido: **Claude propone, la usuaria
afina el pixel, el juego tiñe y coloca.** Los assets nacen vectoriales (`src/assets.js`) y se
migran a **PNG editado a mano** caso por caso, cuando merece la pena.

> **Por qué este flujo.** El dibujo isométrico 3D es el punto flaco de Claude (la oclusión y la
> perspectiva se le tuercen). Así que su salida es solo un **borrador**: propone la forma a tamaño
> real y la usuaria pone el pixel bueno encima. División de trabajo según fortalezas.

---

## Las dos fuentes de un asset

1. **Vector (por defecto)** — funciones `AP.*` en [`src/assets.js`](../src/assets.js). Monocromas:
   se dibujan con `col` y el juego pasa la tinta de la sala. Es lo que hay hoy para casi todo.
2. **PNG editado** — una silueta rasterizada en `assets/png/` que sustituye al vector de ese
   asset (lo que el JUEGO usa en runtime). Se usa cuando queremos un dibujo más cuidado.
3. **SVG fuente** — para assets NUEVOS (no procedurales), su fuente vectorial vive como fichero
   en `assets/svg/<nombre>.svg`, listado en [`assets/svg/manifest.json`](../assets/svg/manifest.json).
   **Lo escribe/edita Claude** (con sus herramientas de fichero); la tool lo carga para generar el PNG.
   El SVG es solo AUTORÍA: el juego nunca renderiza SVG, usa el PNG.

Conviven: migrar a PNG es **gradual y opcional**, asset por asset. El resto sigue en vector.

---

## La tubería (propuesta → PNG → juego)

1. **Proponer** en la tool [`tools/svg2png.html`](../tools/svg2png.html) (navegador, sin
   dependencias, NO se publica). El selector "objeto" ofrece tres fuentes:
   - **Objeto del juego** → se **renderiza su función real** `AP.*` (NUNCA replicar el dibujo a
     mano: replicar deriva del original y mete bugs).
   - **SVG-fichero** → carga un `assets/svg/*.svg` (del `manifest.json`), editable en el textarea
     para previsualizar; para **persistir**, se copia y lo escribe Claude en el fichero (o se edita
     en un editor). El runtime sigue siendo el PNG que se exporta.
   - **SVG libre** → boceto rápido sin fichero.
2. **Exportar PNG NEUTRO**: silueta en **escala de grises sobre transparente**, a **resolución de
   juego** (ver abajo). Se obtiene renderizando con tinta **blanca** (`darken(blanco, f) = gris f`).
3. **La usuaria edita/mejora el PNG** a mano (en grises: claro = brillo, oscuro = sombra; negro =
   línea). Lo deja en `assets/png/`.
4. **El juego lo tiñe y lo coloca**: lo carga, lo **tiñe a la tinta de la sala** (ver "Teñido") y
   lo dibuja anclado igual que el vector. Se conserva el **monocromo-por-sala**.

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
  **nunca** un re-render del vector a otra resolución. Aplica a la tool y a
  [`assets-demo.html`](../assets-demo.html) (helper `renderViewPixel` / `drawViewGame`).

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
Como `assets.js` es puro, corre **sin navegador**: `node tools/gen-svg.mjs`. Los SVG salen idénticos al
vector por construcción. También **reescribe `assets/svg/manifest.json`** (merge, conserva entradas
manuales) → el manifiesto queda siempre en sync con los ficheros reales.

### Las herramientas leen la situación REAL (sin listas a mano)
- **svg2png** se llena del `manifest.json` (los SVG que existen) + modo "SVG libre". No hardcodea assets.
- **assets-demo** muestra la comparativa SVG/PNG leyendo `AP.SPRITES` (registro real) + los ficheros;
  y **auto-descubre** cualquier sprite de `AP.SPRITES` que no tenga ficha curada en `GROUPS`. Las recetas
  de los assets **paramétricos** (pared, puerta, columna…) siguen en `GROUPS` porque no se pueden
  auto-derivar (hay que decirle medidas/encuadre); pero su DIBUJO siempre sale de la función `AP.*` real.

---

## Estado actual

- ✅ Tool `tools/svg2png.html` + generador `tools/gen-svg.mjs`.
- ✅ **Migrados** (sprite SVG fiel + PNG si existe): `cube`, `prop_cube`, `prop_pyramid`, `spikes`,
  `plant`. El bloque usa además `assets/png/cube.png` (editado a mano).
- ⬜ **No migrables aún** (no son sprites fijos): robot (animado), props domo/cilindro (cristal/curvos),
  zócalo (con estado), y los paramétricos (pared, suelo, puerta, columna). Ver idea en
  [PENDIENTES.md](PENDIENTES.md) sobre cómo "fijarlos".
