# AUDITORÍA — Modularidad: desacoplar render / tool / física del CATÁLOGO de assets

> **ESTADO (2026-06-23): IMPLEMENTADO (fases 1-7).** El registro `ASSETS` declara `group`/`behavior`/
> `physics`/`label`/`variants.state`. Capa de drawers normalizada `AP.drawAsset(ctx,P,placement,col)`.
> `world.roomThings(room)` = lista uniforme de placements (mapeo cubetas→assets, en VIVO). `render.js`
> dibuja lo colocable con UN bucle genérico (cáscara suelo/pared/puerta = capa aparte, por decisión).
> `physics.roomSolids` genérico por `physics.solid`. `game.interact` identifica por `behavior`
> (carriable/target). La tool construye el catálogo con `assetsByGroup()` (cero `GROUPS`/draws
> hardcodeados). Guardarraíl en `test/assets.mjs` (render/física no nombran assets colocables). `npm test`
> = 34/34; juego y tool verificados en navegador. **Matices:** el robot muestra 2 vistas (huellas eje x/y)
> en vez de 4 facings; los zócalos muestran solo el estado inactivo en el preview (simplificaciones de la
> tool, no del juego).

> Evaluación técnica del **código real** (2026-06-23). Continúa a [`AUDITORIA-ASSETS.md`](AUDITORIA-ASSETS.md)
> (que centralizó los *datos* de assets en `src/data/assets.js`). Aquí el foco es **las COMPETENCIAS**:
> hoy varios módulos "conocen" el catálogo concreto de assets y hay que tocarlos al añadir uno.
> Objetivo pedido por la usuaria: **crear un asset nuevo NO debe obligar a tocar `render.js` ni la tool**.
> Esta auditoría **no modifica código**; propone el rediseño y su plan.

---

## 0. Veredicto y principio

`AUDITORIA-ASSETS.md` resolvió el *qué* (los números viven en un sitio). Queda el *quién dibuja / quién
decide física / quién agrupa*: esas competencias **siguen mezcladas**. Hoy, añadir un asset nuevo obliga a
editar **5 sitios** además del registro: `render.js` (un bucle de dibujo), `physics.js` (si es sólido),
`world.js` (clonar su array), `game.js` (su comportamiento) y `tools/assets.html` (su grupo + su preview).

> 🎯 **Principio rector: cada módulo, UNA competencia.**
> - **`render.js` = motor de dibujado genérico.** Sabe proyectar, ordenar por profundidad y pintar *una
>   caja con su función de dibujo*. **NO** debe saber qué es un "zócalo" o un "circuito".
> - **`physics.js` = motor de colisión genérico.** Sabe resolver huellas sólidas. **NO** debe enumerar
>   "bloques + objetos + zócalos".
> - **El asset se define a sí mismo por completo** (en el registro `src/data/assets.js`): su **tipo**, su
>   **dibujo**, sus **características físicas** (sólido, empujable, transportable, peligro…), su
>   **comportamiento por defecto** y su **grupo** de catálogo.
> - **La tool agrupa los assets por el metadato del propio asset**, no por una lista escrita a mano.
>
> Regla operativa: **añadir un asset = tocar SOLO su declaración (+ su SVG + su función de dibujo).**
> Nada más debería enterarse.

---

## 1. El acoplamiento HOY (quién "conoce" el catálogo)

### 1a. `render.js` — un bucle por categoría (debería ser genérico)
[`src/render.js:46-76`](../src/render.js) arma el painter con **un bucle hardcodeado por cada tipo**, y
cada uno **recalcula la caja a mano** (con offsets literales / `AP.PROP.HALF`) y **llama a la función AP
concreta**:
```js
for (const bl of room.blocks)  … AP.cube(…)                 // box3(bl.x, bl.y, …)
for (const hz of room.hazards) … AP.spikes(…)               // box3(hz.cx+0.2, …, 0.5)   ← magia
for (const s  of room.sockets) … AP.socket(…, s.shape, …)   // box3(s.cx+0.16, …, socketTop(s))
for (const o  of room.objects) … AP.prop(…, o.shape, …)     // box3(…, AP.PROP.H)
```
Más suelo/paredes/puertas también hardcodeados (`:31-40`, `:67-76`). **Un asset nuevo ⇒ un bucle nuevo
aquí.** Además, la caja del painter (`box3`) **duplica** la huella que ya vive en el registro
(`assetBox`): render no la lee, la recompone.

### 1b. `physics.js` — enumera qué categorías son sólidas
[`roomSolids` (`src/physics.js:48-62`)](../src/physics.js) recorre **bloques + objetos + zócalos** con
cajas a medida; los **pinchos NO son sólidos** por decisión cableada en el código, no por un atributo del
asset. **Un asset sólido nuevo ⇒ editar `roomSolids`.** La "solidez" es una **característica del asset**,
pero vive en la física.

### 1c. `world.js` — clona arrays con nombre fijo
[`makeRoom` (`src/world.js:27-35`)](../src/world.js) clona exactamente `blocks/objects/sockets/hazards`.
**Una categoría nueva ⇒ otra línea de clonado** (y si no, el estado se arrastra entre partidas).

### 1d. `game.js` — comportamiento atado a "objects/sockets"
[`interact` (`src/game.js:30-65`)](../src/game.js) codifica "coger/soltar/encajar circuito" mirando
`room.objects` y `room.sockets` y `shape`. El **comportamiento** (transportable, casilla-destino) **no lo
declara el asset**: está incrustado en las reglas.

### 1e. `data/rooms.js` — el mapa habla en categorías, no en assets
El mapa declara cubetas separadas (`blocks/objects/sockets/hazards`) en vez de "coloca el asset X en
(x,y,z)". El **tipo** del asset está implícito en *en qué array* lo metes.

### 1f. `tools/assets.html` — la agrupación vive en la TOOL
[`GROUPS` (`tools/assets.html`)](../tools/assets.html) es una lista hardcodeada de categorías
("Terreno y estructura", "Circuitos", "Zócalos"…) **con la función de preview de cada item embebida**.
**Un asset nuevo ⇒ editarlo aquí** o cae sin agrupar en "Otros sprites". El **grupo** es un atributo del
asset, pero lo decide la tool.

### Resumen del acoplamiento

| Para añadir un asset nuevo hoy hay que tocar… | Por qué (competencia mal ubicada) |
|---|---|
| `render.js` | sabe dibujar cada tipo concreto + recompone su caja |
| `physics.js` | enumera qué tipos son sólidos |
| `world.js` | clona arrays con nombre fijo |
| `game.js` | el comportamiento está incrustado, no declarado |
| `data/rooms.js` | el mapa habla por categorías, no por asset-id |
| `tools/assets.html` | la agrupación + el preview viven en la tool |

---

## 2. Qué le falta al registro para absorber esas competencias

`src/data/assets.js` hoy declara: `draw`, `files`, `sprite`, `anchor`, `foot`, `variants`. Le falta el
"resto del carné": **tipo, grupo, física y comportamiento.** Esquema ampliado propuesto:

```js
computer: {
  group: "Decoración",            // ← la TOOL agrupa por esto (y el orden de grupos puede ser otro campo)
  draw: "computer",               // función de dibujo (clave → AP[...])
  files: { svg: "computer.svg" }, sprite: { … }, anchor: "center", foot: { w:.5, l:.5, h:.7 },
  physics: { solid: true, climbable: false },   // ← lo lee roomSolids; nada de enumerar tipos
  behavior: "static",             // "static" | "carriable" | "target" | "hazard" | "block" …
}
```
- **`group`** → la tool construye el catálogo agrupando por este campo (con un orden de grupos declarado
  una vez). Cero `GROUPS` hardcodeado.
- **`physics`** (`solid`, `climbable`, huella = `foot`) → `roomSolids` se vuelve genérico: incluye todo
  *placement* cuyo asset sea `solid`, con la caja derivada de `assetBox`.
- **`behavior`** → reemplaza las reglas atadas a "objects/sockets" por un atributo declarado. (Migrar el
  comportamiento es lo más delicado; ver §4, fase tardía.)

---

## 3. Arquitectura objetivo (competencias separadas)

**Modelo de sala uniforme.** La sala pasa de "varias cubetas tipadas" a **una lista de *placements***:
```js
things: [ { asset: "cube", x, y, z }, { asset: "socket_dome", x, y, z, state:{active:false} },
          { asset: "prop_dome", x, y, z }, { asset: "computer", x, y } … ]
```
(Se puede migrar gradualmente manteniendo las cubetas viejas como *azúcar* que se expande a `things`.)

**`render.js` → motor genérico.** Un único bucle:
```js
for (const t of room.things) {
  const a = ASSETS[t.asset], box = placeBox(a, t);     // caja painter desde foot+anchor (assetBox)
  draws.push({ ...box, draw: () => AP[a.draw](ctx, P, t, colOf(a, room)) });
}
for (const it of ENGINE.depthSort(draws, P)) it.draw();
```
Render ya no nombra `cube/socket/prop`: recibe assets y los pinta. Suelo/paredes/puertas se modelan como
*placements* de assets "estructura" (o como una capa estructural fina) → también dejan de ser código ad-hoc.

**Firma de dibujo NORMALIZADA.** Hoy cada `AP.*` tiene firma distinta (`socket` recibe `shape,active`;
`door` recibe `axis,span,hole`; `prop` recibe `shape`). Para el dispatch genérico, unificar a
**`draw(ctx, P, placement, col)`**, y que cada función lea su estado de `placement` (`placement.state`,
`placement.shape`, `placement.axis`…). Es el cambio mecánico más extenso, pero es lo que permite
`AP[a.draw](…)` sin `switch`.

**`physics.js` → genérico por atributo.** `roomSolids` recorre `things`, filtra `ASSETS[t.asset].physics
.solid`, y usa `assetBox` para la huella. Sin enumerar categorías. (Zócalo con estado: su `top` lo da una
función del asset, no un `if` en física.)

**La tool → agrupa por `group`.** El catálogo se construye iterando `ASSETS` y agrupando por
`a.group`; el preview se genera con `AP[a.draw]` + `assetBox` (igual que el juego). Se borra `GROUPS` y los
draws embebidos. Añadir un asset aparece **solo y en su grupo**, sin tocar la tool.

**Frontera de competencias (resumen):**

| Módulo | Competencia ÚNICA | NO le incumbe |
|---|---|---|
| `data/assets.js` | declarar QUÉ es cada asset (tipo, dibujo, física, comportamiento, grupo) | cómo se pinta el píxel / cómo se ordena |
| `assets.js` (`AP.*`) | CÓMO se dibuja la forma de un asset | dónde está, si es sólido, en qué sala |
| `render.js` | proyectar + ordenar + pintar cajas genéricas | qué assets existen |
| `physics.js` | resolver colisión/apoyo de huellas | qué assets existen |
| `tools/assets.html` | mostrar/agrupar/exportar leyendo el registro | declarar geometría o grupos |

> **Nota sobre "todo en assets.js".** La parte **declarativa** del asset (tipo/física/comportamiento/grupo)
> va en `src/data/assets.js` (datos puros). La **función de dibujo** es CÓDIGO: vive en `src/assets.js` y
> el registro la referencia por su clave `draw`. Así "el asset se define en un sitio" (datos) sin meter
> lógica de canvas en un fichero de datos. (Opcional a futuro: co-localizar ambos por asset.)

---

## 4. Plan por fases (incremental, `npm test` en cada una)

1. **Fase 1 — Enriquecer el registro (sin consumirlo aún).** Añadir `group`, `physics`, `behavior` a cada
   asset de `ASSETS`. Test verde (solo añade datos). Extender `test/assets.mjs` para exigir que todo asset
   declare `group` y `physics`.
2. **Fase 2 — Tool agrupa por `group`.** Reescribir el catálogo de `tools/assets.html` para agrupar por
   `a.group` (orden de grupos declarado una vez en el registro) y generar el preview desde `AP[a.draw]`.
   Borrar `GROUPS`/draws embebidos. **Resultado: añadir un asset ya no toca la tool.**
3. **Fase 3 — Normalizar la firma `draw(ctx,P,placement,col)`.** Adaptar cada `AP.*` y sus llamadas. Es el
   paso con más superficie; apóyate en el painter test + revisión visual del juego (título + cada sala).
4. **Fase 4 — Render genérico.** Introducir `room.things` (las cubetas viejas se expanden a `things` en
   `world.js`). `render.js` pasa a un único bucle genérico; se elimina el código por-categoría. Suelo/
   paredes/puertas → placements de "estructura".
5. **Fase 5 — Física genérica.** `roomSolids` itera `things` por `physics.solid` + `assetBox`. Quitar la
   enumeración de categorías. (Las reglas de `game.js`/comportamiento se migran a `behavior` aquí o en una
   fase 6 aparte — es lo más arriesgado; conviene hacerlo al final y con tests de juego dedicados.)
6. **Fase 6 — Guardarraíl.** `test/assets.mjs`: fallar si `render.js`/`physics.js` mencionan nombres de
   asset concretos (`AP.cube`, `room.blocks`, …) → garantiza que siguen genéricos.

**Riesgos:**
- **Painter/oclusión**: tocar cómo se arman las cajas roza la pieza frágil (`depthSort`). Correr el painter
  test y verificar oclusión iso en el juego y en la tool tras la fase 3-4.
- **Comportamiento (carry/place/win)**: migrar `interact` a `behavior` puede alterar reglas; hacerlo último,
  con cobertura de smoke tests (coger/soltar/encajar/ganar ya están testeados).
- **Pureza/sin ciclos**: `data/assets.js` sigue hoja; `render`/`physics` importan el registro (ya pueden).
- **Estructura (suelo/paredes/puertas)**: son "asset" especiales (paramétricos, dependen del tamaño de
  sala). Decidir si entran como placements o como una capa estructural fina; no forzar el modelo.

---

## 5. Definición de "hecho"

- **Añadir un asset = editar SOLO `src/data/assets.js` (+ su `.svg` + su función `AP.*`).** Aparece en el
  juego (si una sala lo coloca) y en la tool (en su grupo) **sin tocar `render.js`, `physics.js`,
  `world.js` ni la tool**.
- `render.js` y `physics.js` **no nombran ningún asset concreto** (lo verifica un test).
- La tool agrupa por el `group` del registro; sin `GROUPS` hardcodeado.
- El **tipo, la física y el comportamiento por defecto** de un asset se leen de su declaración.

> En una frase: hoy el motor conoce el catálogo; el objetivo es que **el catálogo se describa a sí mismo y
> el motor sea ciego al contenido** — que `render`/`physics`/tool funcionen igual con 8 assets que con 80.
