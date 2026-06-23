# AUDITORÍA — Datos de assets: hacia una FUENTE ÚNICA (`src/data`)

> **ESTADO (2026-06-23): IMPLEMENTADO.** Existe `src/data/assets.js` (registro `ASSETS` + geometría +
> helpers). `config.js` re-exporta la geometría; `assets.js` deriva `SPRITES` del registro y `pillar`/
> `drone`/`circuit` leen su huella/alto de él; `tools/assets.html` ya NO declara geometría (lee `assetBox/
> assetRef/assetFoot`). Guardarraíl + no-deriva en `test/assets.mjs` (29/29 tests verdes).
>
> **Divergencia `circuit r=0.26` vs `PROP.HALF=0.28`: RESUELTA** — decisión de la usuaria = *dibujar a la
> huella (0.28)*. El **procedural** `circuit` ya usa `PROP.HALF` (afecta domo/cilindro en juego + las 4
> formas en la tool). **Matiz:** `prop_cube`/`prop_pyramid` están MIGRADOS y se dibujan desde su **SVG**
> (generado a 0.26); el procedural es solo residual. `gen-svg.mjs` NO puede regenerarlos (su `prop` hace
> `drawSprite` sin fallback → SVG vacío en Node). Para que el cubo/pirámide del JUEGO también pasen a 0.28
> hay que **re-exportar esos dos SVG por el flujo de autoría** (la usuaria, con la tool). El registro ya
> dice 0.28 (huella/cubo de referencia); el SVG es lo que falta alinear a mano.

> Evaluación técnica independiente del **código fuente real** (no de la doc). Detona esta auditoría
> un hallazgo de la usuaria: hay **datos numéricos de posición y tamaño de assets hardcodeados en
> `tools/assets.html`**. Fecha: 2026-06-23. Alcance: todo el repo (`src/`, `assets/`, `tools/`, `docs/`).
> Esta auditoría **no modifica código**; propone el rediseño y su plan.

---

## 0. Veredicto y RED FLAG

**Hoy NO existe una fuente única de verdad para los assets.** La definición de cada asset (su tamaño,
su anclaje, su huella en el mundo, sus ficheros y su forma) está **fragmentada y duplicada en al menos
cuatro lugares**: `src/config.js`, `src/assets.js`, `assets/svg/manifest.json` y —de forma masiva—
`tools/assets.html`. Peor: **algunos valores existen SOLO como números mágicos** (pinchos, planta,
dron, columna, huella del zócalo) sin ningún sitio canónico, y su "definición" de facto vive en la
**tool**, que ni siquiera es el juego.

> ⛔ **NO es aceptable que parámetros numéricos de los assets estén hardcodeados en el código fuente
> (ni del juego ni de la tool).** Un número como `0.54` (lado de los pinchos) repetido a mano en dos
> mapas distintos de un HTML de utillaje es un **red flag**: cada vez que alguien (persona o agente)
> tiene que *deducir* el tamaño de un asset leyendo y cruzando varios ficheros, se quema esfuerzo de
> razonamiento que la arquitectura debería haber eliminado de raíz. El dato correcto se **lee**, no
> se **re-deriva**. La regla debe ser binaria: **un asset se define en UN sitio; todo lo demás lo
> importa.**

El refactor a ES modules (motor/datos/simulación separados) está bien hecho, y `config.js` ya centralizó
la **geometría compartida juego↔física** (ROBOT/PROP/DOOR/SOCKET/WALL_H). El problema es que ese
acierto **se quedó a medias**: cubre lo que comparten dibujo y física, pero **no** el resto del "carné de
identidad" del asset (sprite, anclaje, ficheros, huella de visualización), y la tool reconstruye todo eso
a mano en vez de leerlo.

---

## 1. ¿Qué ES un asset? (revisión del esquema propuesto)

La usuaria propone que cada asset declare: **tamaño · punto de anclaje · posición (x,y) del anclaje en el
PNG · referencia a sus ficheros SVG/PNG · función algorítmica (si aplica)**. Es correcto, pero **incompleto
y con una redundancia**. Esquema corregido (lo que el código demuestra que se necesita):

| Campo | Qué es | Hoy vive en |
|---|---|---|
| `id` | nombre canónico (`cube`, `prop_dome`, `door`, `robot`…) | disperso (claves de SPRITES, de GROUPS, nombres en mapas) |
| **2D — encuadre del sprite** | | |
| `w`, `h` | tamaño del raster en px de juego | `assets.js:SPRITES` **y** `manifest.json` (duplicado) |
| `minX`, `minY` | offset del bbox respecto al punto de referencia `P(coords)` | `assets.js:SPRITES` |
| *(anclaje en el PNG)* | píxel del PNG donde cae el punto de mundo = **`(−minX, −minY)`** | **DERIVADO**, no se almacena |
| `svg`, `png` | ficheros (o convención `id.svg` / `id.png`) | implícito (`/assets/{svg,png}/{id}.{ext}`) + `manifest.json` |
| **3D — huella en el mundo** | | |
| `box {x,y,z,w,l,h}` | AABB en celdas (para painter, física y cubo de referencia) | `config.js` (parcial) + `tools` (rehecho a mano) |
| `anchor` | convención del punto 0: **esquina** `(0,0,0)` vs **centro-base** `(0.5,0.5,0)` | solo en la cabeza de quien lo escribió + `tools:REF` |
| `variants` | huella que **rota con la orientación** (robot, puerta eje x/eje y) | `assets.js` (robot) + `tools` (rehecho) |
| `draw` | función procedural `AP.*` (forma algorítmica, si no hay PNG/SVG) | `assets.js` |

**Dos correcciones al esquema de la usuaria:**

1. **"Posición x,y del anclaje en el PNG" NO debe almacenarse**: es exactamente `(−minX, −minY)`. Guardar
   un dato derivado invita a que diverja. El esquema almacena `minX/minY` (el offset del bbox) y *deriva*
   el píxel-ancla. (Ver `drawSprite` en `src/assets.js`, que dibuja en `ref + (minX,minY)`.)
2. **Falta lo 3D**: tamaño y anclaje del **sprite 2D** no bastan. El asset también tiene una **huella en
   el mundo** (`box` w×l×h en celdas), una **convención de anclaje** (esquina vs centro) y, en algunos
   casos, **variantes por orientación**. Eso lo consumen el painter (`depthSort`), la física
   (`physics.js`) y el cubo/región del visor. Hoy es justo lo que la tool re-hardcodea.

---

## 2. Inventario: dónde vive HOY cada dato (4 fuentes)

### Fuente A — `src/config.js` (geometría compartida juego↔física)
- `PROP {HALF:0.28, H:0.5}` (`:79`), `ROBOT {WID:0.50, DEP:0.33, H:1.50}` (`:82`),
  `DOOR {T:0.34, POST_W:0.40, LINTEL_H:0.46, SPAN_HALF:1.12}` (`:87`), `SOCKET {BASE_H:0.2}` (`:90`),
  `WALL_H:3` (`:94`).
- ✅ Bien: es la única fuente de estas medidas para `assets.js` y `physics.js`.
- ⚠️ Pero NO es un "registro de assets": son constantes sueltas de geometría, sin `id`, sin `w/h/minX/minY`,
  sin ficheros. Y **no cubre** pinchos/planta/dron/columna/huella-de-zócalo.

### Fuente B — `src/assets.js`
- `SPRITES` (`:38`): `{minX,minY,w,h}` SOLO de los 5 migrados (`cube, prop_cube, prop_pyramid, spikes, plant`).
- **Números mágicos dentro de cada función procedural**: `pillar` usa `m = 0.2` (`:198`); `circuit` usa
  `r = 0.26` (`:203`); domo `rr = 0.34`; cilindro `ch = 0.5`; robot `armW=0.075`, `fw=0.13`… Estos definen la
  FORMA (parte legítima de la función), pero **el tamaño/huella resultante no está declarado en ningún sitio
  legible** — hay que *ejecutar mentalmente* la función para saber cuánto ocupa un dron o una planta.

### Fuente C — `assets/svg/manifest.json`
- Por fichero: `{name, file, w, h}`. El `w/h` **duplica** el de `SPRITES` (cube 34×34 en ambos, etc.).
- Lo genera `tools/gen-svg.mjs`; lo lee la tool para auto-descubrir SVG sueltos.

### Fuente D — `tools/assets.html`  ← el detonante
Re-declara a mano **toda** la geometría de assets, en cuatro mapas + las cajas embebidas en `GROUPS`:
- `GU` (`:336`): ancho×largo×alto en celdas — **incluye magia que no está en config**:
  `"Columna": {0.6,0.6,2.2}`, `"Pinchos": {0.54,0.54,0.5}`, `"Planta": {0.32,0.32,0.5}`,
  `"Dron": {0.32,0.32,0.28}`.
- `guSocket` (`:345`): `{0.68,0.68,…}` — el `0.68` **no existe en `config.SOCKET`**.
- `BOX` (`:348`): AABB de cada asset, otra vez a mano: `"Columna": x:0.2,y:0.2,w:0.6,l:0.6,h:2.2`,
  `"Pinchos": x:0.5-0.27,…,w:0.54`, `"Planta"`, `"Dron"`, etc. El `0.2` de la columna **re-deriva** el
  `m=0.2` de `AP.pillar` (¡copiado a mano!); el `0.27` re-deriva el lado de los pinchos.
- `boxSocket` (`:360`): `x:0.16, w:0.68` — números mágicos exclusivos de la tool.
- `REF` (`:364`) + `refCenter` (`:370`): convención de anclaje por nombre, otra vez a mano.
- Cajas **por vista** embebidas en `GROUPS`: puerta (`:173,:177,:181`) y robot (`:207`) construyen su
  `box` con expresiones sobre `DOOR.*`/`ROBOT.*`. Al menos parten de config, pero **la lógica de
  construcción del AABB está duplicada** entre la tool y lo que hace `physics.js`/el dibujo.
- `DEFAULT_SVG` (`:652`): coordenadas del cubo (`-17, 17, 8.5`) hardcodeadas.

> **Síntoma claro de la enfermedad:** para saber el tamaño del **dron** hoy hay que mirar en
> `tools/assets.html` (`GU`/`BOX`), porque **no está en `config.js` ni en `SPRITES`**. La tool —utillaje
> que ni se publica— se ha convertido sin querer en la "definición" de varios assets. Eso es exactamente
> lo que hay que invertir.

### Mapa de duplicación (mismo dato, varias copias)

| Dato | A `config` | B `assets.js` | C `manifest` | D `tools` |
|---|:--:|:--:|:--:|:--:|
| `cube` w/h (34×34) | | ✅ SPRITES | ✅ | ✅ (deriva) |
| Huella prop (0.28) | ✅ PROP.HALF | ✅ circuit `r` (≈, distinto!) | | ✅ boxProp/guProp |
| Robot WID/DEP | ✅ | ✅ (dibujo) | | ✅ BOX/GU/variants |
| Puerta SPAN/T | ✅ | ✅ | (door_*.svg) | ✅ box×3 |
| **Pinchos 0.54/0.5** | ❌ | mágico interno | ✅ (w/h px) | ✅ GU+BOX |
| **Planta/Dron** | ❌ | mágico interno | (plant) | ✅ GU+BOX |
| **Columna 0.6/2.2/0.2** | ❌ | mágico (`m=0.2`) | | ✅ GU+BOX |
| **Zócalo huella 0.68/0.16** | ❌ (solo BASE_H) | — | | ✅ guSocket/boxSocket |
| Anclaje (esquina/centro) | ❌ | implícito en `draw` | | ✅ REF |

Nótese un peligro extra: **`PROP.HALF=0.28` (huella física) ≠ `circuit r=0.26` (radio de dibujo)**. Son
dos números distintos para "el tamaño del circuito" que ya **han divergido**. Es precisamente lo que una
fuente única previene.

---

## 3. Arquitectura objetivo: `src/data/assets.js` como ÚNICA fuente

Crear, junto a `src/data/rooms.js`, un **registro declarativo de assets**: datos puros (sin DOM, sin
canvas), importable tanto por el juego como por la tool y los generadores.

```js
// src/data/assets.js  (BORRADOR de forma; números reales = los que hoy están dispersos)
export const ASSETS = {
  cube: {
    sprite: { w: 34, h: 34, minX: -17, minY: -17 },   // anclaje-px derivado: (−minX,−minY)=(17,17)
    box:    { w: 1, l: 1, h: 1 }, anchor: "corner",     // huella en celdas + convención
    files:  { svg: "cube.svg", png: "cube.png" },       // (o convención id.{ext})
    draw:   "cube",                                      // clave de la función AP.* (forma algorítmica)
  },
  prop_dome: {
    sprite: { /* w,h,minX,minY cuando se migre */ },
    box: { w: 0.56, l: 0.56, h: 0.5 }, anchor: "center", // ← hoy ESTO solo vive en la tool
    files: { svg: null, png: null }, draw: "circuit:dome",
  },
  robot: {
    box: { w: 1.0, l: 0.66, h: 1.5 }, anchor: "center",
    variants: { axisX: { w: 0.66, l: 1.0 }, axisY: { w: 1.0, l: 0.66 } }, // huella que ROTA
    draw: "robot",
  },
  door: { /* box por eje (axisX/axisY), anchor, files door_front/back, draw "door" */ },
  // … pinchos, planta, dron, columna, zócalos, suelo, pared(wall1/wall2) …
};
```

**Principios:**
- **Números crudos solo aquí.** `config.js` conserva las constantes de *gameplay* puras (velocidad,
  `PRAD`, `STEP`, tamaño de tesela), pero la **geometría de assets** (ROBOT/PROP/DOOR/SOCKET/WALL_H y
  todos los demás) pasa a derivarse del registro, o el registro pasa a ser su hogar. (Decisión a tomar:
  fusionar en `assets.js` o que `assets.js` importe de `config`. Recomiendo **`src/data/assets.js` como
  hogar de la geometría de assets**, y `config.js` se queda con lo no-asset.)
- **`manifest.json` deja de ser fuente**: o se elimina (la tool lee `ASSETS`), o `gen-svg.mjs` lo emite
  como artefacto derivado de `ASSETS` (nunca editado a mano).
- **`SPRITES` desaparece de `assets.js`**: pasa a ser `ASSETS[id].sprite`. `assets.js` solo aporta las
  **funciones de dibujo** (`AP.*`), que leen sus parámetros de `ASSETS` en vez de llevar magia dentro.
- **`tools/assets.html` no declara NADA**: borra `GU/BOX/REF/guProp/guSocket/boxProp/boxSocket/refCenter`
  y las cajas embebidas en `GROUPS`; las construye **leyendo `ASSETS`**. El cubo/región/anclaje del visor
  salen de los mismos datos que usa el painter.
- **El cubo de referencia y la huella de física comparten origen.** Si la huella del robot rota, rota en
  un solo sitio (`variants`), y tanto el visor como (si algún día lo necesita) la física lo ven igual.

**Quién lee qué (después):**
- `physics.js`, `render.js`, `world.js` → `ASSETS` (huellas, alturas, anclajes).
- `assets.js` (`AP.*`) → `ASSETS` (tamaños/parametros de forma).
- `tools/assets.html`, `tools/gen-*.mjs` → `ASSETS` (catálogo, cajas, manifest derivado).
- **Cero literales numéricos de assets fuera de `src/data/assets.js`.**

---

## 4. Plan de migración (incremental, con red de seguridad)

`npm test` (smoke + painter) es el oráculo de no-regresión: correrlo en **cada** fase.

1. **Fase A — Crear el registro sin romper nada.** Añadir `src/data/assets.js` con los datos *actuales*
   (copiados 1:1 desde config/assets/tool). Reexportar desde `config.js` los `PROP/ROBOT/DOOR/SOCKET/WALL_H`
   *derivados del registro* para no tocar a sus consumidores todavía. Test verde = equivalencia.
2. **Fase B — Migrar la tool.** `tools/assets.html` deja de declarar `GU/BOX/REF/...`; los deriva de
   `ASSETS`. Es el punto que disparó la auditoría y el de mayor ganancia visible. (La tool ya importa de
   `src/`, así que es directo.) Verificar visualmente cubo/región/anclaje de cada asset.
3. **Fase C — Migrar el juego.** `assets.js` (`AP.*`) y `physics.js`/`render.js` leen de `ASSETS`; se
   eliminan los números mágicos internos que sean *interfaz* (huellas, alturas), dejando dentro solo lo
   que es puramente *forma de dibujo*. Test verde.
4. **Fase D — Derivados.** `manifest.json` pasa a generarse desde `ASSETS` (o se elimina). `SPRITES` se
   borra de `assets.js`. Añadir un **test de deriva**: que `manifest`/PNG existentes cuadren con `ASSETS`.
5. **Fase E — Guardarraíl.** Test/lint que **falle si aparece un literal numérico de geometría** en
   `tools/assets.html` o en los consumidores (heurística: prohibir `\d+\.\d+` en los mapas de assets).

**Riesgos / cuidado:**
- `assets.js` debe seguir **puro** (sin DOM) para correr en Node (tests). `src/data/assets.js` también puro. ✅
- No reintroducir ciclos: `data/assets.js` es **hoja** (no importa de `assets.js`/`physics.js`); todos
  dependen de él hacia abajo. (Igual que `data/rooms.js`.)
- La huella de física del robot hoy es un **cuadrado simétrico `PRAD`** (no usa WID/DEP); el registro debe
  modelar *ambas* huellas (visual orientada vs colisión simétrica) sin fundirlas por error.
- `prop r=0.26` vs `PROP.HALF=0.28`: al unificar, **decidir el valor correcto** (probablemente igualar) y
  documentar el porqué; no copiar la divergencia.

---

## 5. Definición de "hecho"

- Existe `src/data/assets.js` y es el **único** sitio con números de tamaño/posición/anclaje de assets.
- `tools/assets.html` no contiene **ningún** literal geométrico de asset (los lee todos).
- `assets.js`/`physics.js`/`render.js` no contienen geometría de asset duplicada; la importan.
- `manifest.json` y `SPRITES` son **derivados** (o eliminados), con test de deriva.
- Añadir un asset nuevo = **editar un solo fichero de datos** (como añadir una sala = editar `rooms.js`).

> En una frase: **los assets deben tener el mismo trato que el mapa.** El mapa ya vive solo en
> `src/data/rooms.js` y nadie lo re-hardcodea; los assets merecen exactamente lo mismo en
> `src/data/assets.js`.
