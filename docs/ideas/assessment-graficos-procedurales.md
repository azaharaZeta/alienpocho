# Assessment — gráficos procedurales pendientes de migrar a SVG/PNG

**Objetivo declarado:** que todos los gráficos sean, eventualmente, SVG o PNG.
**Fecha:** 2026-06-24 · **Estado:** análisis + paredes/puertas YA migradas (ver §2).

> **Actualización 2026-06-25:** las **paredes** ya se dibujan como módulos SVG tira a tira (sin recorte;
> `draw.flatWall`) y la **puerta** como UN solo SVG (`door.svg`) generado por `tools/gen-doors.mjs` (el
> render la parte en 2 piezas-poste para la oclusión). Queda pendiente lo de siempre: **robot** (animado) y
> **suelo** (paramétrico, con el `files.svg:"example.svg"` fantasma a resolver), más el chrome 2D (fuera de alcance).

## 1. Situación actual

El runtime tiene **una sola vía de sprite** (`AP.drawSprite`, en `src/draw.js`):
carga PNG→SVG, cachea, tiñe por sala (multiply) y pinta con offset `(minX,minY)`.
Cualquier asset con `draw:"sprite"` + su `.svg` se dibuja por ahí **sin tocar
`render.js` ni la tool**. Sobre eso, el dibujo del juego se reparte en tres capas:

1. **Assets del registro** (`data/assets.js` → `DRAWERS` en [draw.js:293](../../src/draw.js)).
2. **Cáscara de sala** (suelo + paredes + puertas, en [render.js](../../src/render.js)).
3. **Chrome 2D** (HUD, minimapa, banner de victoria — overlay en píxeles de pantalla).

## 2. Inventario: qué se dibuja con sprite y qué es procedural

### Ya migrado a fichero (SVG, alguno con PNG)
- **Sprites planos** (`draw:"sprite"`): `prop_cube`, `prop_pyramid`, `prop_dome`,
  `prop_cylinder`, `spikes`, `plant`, `drone`, `computer`. ✅
- **`cube`**: PNG + SVG. ✅
- **`socket`**: peana desde `socket.svg`, teñida por estado; el circuito incrustado /
  fantasma son sprites compuestos encima. ✅ (composición, pero todo desde fichero)
- **`wall1`/`wall2`**: módulos SVG teselados celda a celda, **sin recorte** (`draw.flatWall`). ✅
- **`door`**: UN solo SVG (`door.svg`) generado por `tools/gen-doors.mjs` (3 cajas iso: postes + dintel;
  front y back = mismo dibujo, distinto ancla). El render lo parte en 2 piezas (postes) por el centro del
  vano. El vacío negro del vano lo pinta el render como **pre-pase de fondo** (`doorHole`), no es del SVG. ✅

### Todavía procedural (primitivas canvas)
| Qué | Dónde | Naturaleza | Por qué sigue procedural |
|-----|-------|-----------|--------------------------|
| **`robot` (Pocho)** | [draw.js:227-280](../../src/draw.js) | `box()`/`poly()` por pieza: pies, brazos, torso, cabeza, visor, ojos, pecho, antena | **Animado** (bob al andar, balanceo de brazos opuesto a piernas) + **4 vistas** + orden de pintado de brazos según cara. Es el caso difícil. |
| **`floor`** | [draw.js:151-154](../../src/draw.js) | quad negro + rejilla alterna por celda | Paramétrico por celda; se repite `w×h` veces/sala. Declara `files.svg:"example.svg"` pero **nunca se usa** (inconsistencia). |
| **`shadow`** | [draw.js:282-286](../../src/draw.js) | elipse | Trivial, bajo cada entidad. |
| **`doorHole`** | `draw.js` | polígono negro | Vacío del vano de la puerta de fondo; el render lo pinta como **pre-pase de fondo** (antes de las cajas con altura) para que el robot no quede tapado al cruzar. |
| **HUD** | [render.js:192-224](../../src/render.js)+ | barras segmentadas, "V" del marco, título "ALIEN POCHO" (strokeText+glow), casilla de carga, mini-robot de vidas | Overlay 2D en píxeles de pantalla. |
| **Minimapa** | [render.js:144-188](../../src/render.js) | rects (salas/puertas) + marco + nombre | Derivado del `world` en runtime; geometría dinámica. |
| **Banner victoria** | [render.js:89-100](../../src/render.js) | overlay + fillText | Texto. |

## 3. Lectura de la situación

La migración a fichero **ya está hecha para todo el contenido del mundo que es
estático o teñible**: props, peligros, decoración, zócalo, paredes y puertas. Lo
que queda procedural cae en tres categorías con viabilidad muy distinta:

- **(A) Animado / multi-vista:** el robot. No es "un dibujo", es un rig.
- **(B) Paramétrico / teselado:** suelo (y, en parte, paredes ya resueltas por
  teselado). Sustituir por una imagen única rompe el escalado a tamaño de sala.
- **(C) Chrome 2D:** HUD, minimapa, banner. No son "assets del mundo"; son UI
  que depende de estado y geometría calculados cada frame.

## 4. Viabilidad por caso

### Robot Pocho — viable pero con coste, **no recomendado a corto plazo**
- **Sprite estático no sirve:** perdería bob + balanceo. Habría que pasar a
  **sprite-sheet** (N frames × 4 vistas) o SVG con piezas animadas por transform.
- **Encaja en la arquitectura:** existe `extraFiles`/composición; se podría añadir
  un drawer `spritesheet` que elija frame por `walkPhase` y vista por `facing`.
- **Coste real:** producir y mantener los frames, sincronizar la fase de marcha,
  conservar la esencia (ver [GDD] y memoria `alien-pocho-fidelity`). El procedural
  actual ya cumple el objetivo estético con 0 assets que mantener.
- **Veredicto:** técnicamente viable; **bajo ROI**. Dejar procedural salvo que se
  quiera rediseñar a Pocho de forma deliberada.

### Suelo — viable y barato, **recomendado**
- Es la incoherencia más limpia de cerrar: `floor` ya declara `files.svg` pero
  dibuja procedural y el SVG no se usa.
- **Dos caminos:** (a) un sprite de **una celda** romboidal teñible, pintado por
  celda igual que hoy (cambio mínimo, drawer `sprite` ya existe); (b) borrar el
  `files.svg` fantasma y asumir el suelo como procedural "oficial".
- **Recomendación:** decidir A o B y eliminar la inconsistencia. La rejilla tenue
  por celda y el tinte por sala se conservan en ambos.

### Sombra / doorHole — **dejar procedural**
- Son primitivas auxiliares (elipse, polígono negro), no "assets". Convertirlas a
  fichero añade I/O y caché sin beneficio visual. No forman parte del objetivo real.

### HUD / minimapa / banner — **fuera de alcance**
- No son gráficos del mundo: son **UI dependiente de estado y geometría** (vidas,
  contador de circuitos, salas/puertas del `world`, nombre de sala). No se pueden
  "exportar a PNG" sin perder su naturaleza dinámica. A lo sumo, **iconos sueltos**
  del HUD (carita de vidas, marco) podrían ser sprites; el layout seguirá siendo código.

## 5. Recomendación

El objetivo "todo SVG/PNG" **ya está cumplido para los assets del mundo**. Lo
sensato es **acotar el objetivo** a "todo asset de contenido es fichero" y tratar
aparte robot (animación) y chrome (UI):

1. **Cerrar el suelo** (quick win): decidir sprite-de-celda vs. procedural oficial,
   y eliminar el `files.svg:"example.svg"` fantasma de `floor`. — *bajo riesgo,
   correr `npm test` (toca registro de assets).*
2. **Aparcar el robot** salvo decisión de rediseño: si se hace, sprite-sheet +
   drawer `spritesheet` nuevo, sin tocar `render.js`.
3. **Excluir explícitamente** del objetivo: sombra, doorHole y todo el chrome 2D
   (HUD/minimapa/banner), documentándolo para no reabrirlo.

> Nota: cualquier cambio en `draw.js`/registro de assets exige `npm test`
> (`assets.mjs` valida fuente única registro⇄artefactos; `painter.mjs` el orden iso).
