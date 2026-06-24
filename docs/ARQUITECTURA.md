# ARQUITECTURA — Alien Pocho

Cómo está montado el juego (estado actual). Para el flujo de creación de assets, ver
[ASSETS.md](ASSETS.md); para el diseño, [GDD.md](GDD.md).

Vanilla JS + canvas, **ES modules nativos, sin build**. Capas separadas: **motor** (genérico) ·
**datos** (puros) · **simulación** (física/estado) · **presentación** (render). Sin globales de shell.

## Mapa de módulos (`src/`)
Dependencias en UNA dirección (hojas abajo → `main` arriba):

- **`data/assets.js`** — FUENTE ÚNICA de los assets (registro `ASSETS` + geometría + helpers). Datos puros, hoja.
- **`data/rooms.js`** — EL MAPA (salas como datos puros). Hoja.
- **`data/mission.js`** — LA MISIÓN/PUZZLE: `MISSION` (meta + `start` = arranque `{room,x,y,facing}`: `world.js` usa `start.room` como raíz del minimapa, `player.js`/`game.resetGame` la posición · `requires` = qué circuito pide cada zócalo, por `id`) + total de circuitos DERIVADO del mapa (`missionTotal`) + `missionComplete`. Tercera capa de datos (≠ assets/rooms). Hoja pura.
- **`palette.js`** — colores por sala (`INKS`/`INK2`/`ROBOT_INK`). Hoja.
- **`config.js`** — parámetros (`CFG`, `CONTROLS`, `SCENE`); re-exporta la geometría desde `data/assets.js`.
- **`engine.js`** — motor iso genérico: proyección, `box`/`poly`, painter `depthSort`.
- **`draw.js`** — dibujo `AP.*` + el motor genérico `AP.drawAsset` (vía `DRAWERS`). Usa engine + palette + registro.
- **`world.js`** — arma las salas (`makeRoom`/`buildWorld`) y expone `roomThings(room)` (lista uniforme de placements).
- **`physics.js`** — colisión / apoyo / empuje (puro, sobre `room`).
- **`player.js`** — entidad jugador · **`game.js`** — estado de partida + reglas + transiciones de sala.
- **`view.js`** / **`input.js`** — canvas+proyector+tema / teclado+táctil. **No tocan el DOM al importar** (solo en `init*()`) → los módulos corren en Node (tests).
- **`render.js`** — escena + HUD + minimapa · **`screens.js`** — título · **`main.js`** — bucle + arranque.

## Motor isométrico
- **Proyección 2:1** (`engine.js`): `P(x,y,z) = (ox + (x−y)·TW/2, oy + (x+y)·TH/2 − z·BH)`, con `TW=34, TH=17, BH=17`.
- **Painter `depthSort`**: orden por *separating-axis* con *gating* por solape en pantalla + **orden topológico
  (Kahn)** determinista. Desempate canónico estable (centro-z, luego profundidad de suelo) para pares
  ambiguos/interpenetrados → el orden NO depende del orden de entrada y respeta "lo de delante tapa lo de detrás".
- **Invariante** (determinismo + sin violaciones cuando el grafo es acíclico): lo fija `test/painter.mjs` (fuzz).
  ⚠️ Antes de tocar `depthSort`, correr `npm test`.

## Assets: registro único + motores ciegos al catálogo
**`src/data/assets.js` es la única fuente de verdad de los assets** (como `data/rooms.js` lo es del mapa).
Nadie más declara números de tamaño/anclaje/huella; se LEEN del registro (lo guarda `test/assets.mjs`).

Cada asset se describe a sí mismo:
- **`kind`** — qué ES: `structure` (suelo/pared/puerta) · `individual` (robot, enemigos) · `object` (lo demás).
- **`traits`** — propiedades INDEPENDIENTES y componibles (ausente = false): `solid` (física), `movable` (empuje),
  `carriable` (item), `falls` (gravedad), `hazard`, `receptacle` (+ activa al recibir), `stateful`, `controlled`.
- **`group`/`label`** (catálogo) · **`draw`** (clave de dibujo) · **`files`** (svg/png) · **`sprite`** (`w,h,minX,minY`)
  · **`anchor`/`footAnchor`/`foot`** (huella en celdas) · **`variants`** (orientación: puerta eje x/y, robot ±x/±y).
- Helpers: `assetBox`/`assetRef`/`assetFoot`/`assetRegion` · `assetKind`/`assetHas`/`assetTraits`/`assetTint` ·
  `assetsByGroup`/`assetViews`/`assetLabel` · `socketTop`.

**Render y física son GENÉRICOS (no enumeran tipos):**
- `draw.js` tiene `DRAWERS` (uno por clave `draw`, con un `sprite` genérico que vale para cualquier asset de imagen)
  y `AP.drawAsset(ctx,P,placement,col)`. Dibujar un asset = `drawAsset`, sin saber cuál es.
- `world.roomThings(room)` mapea las cubetas del mapa (`objects`/`sockets`/`hazards`) a una lista uniforme de
  placements `{asset, x, y, z, aabb, src?}` (en vivo: los móviles se mueven, los zócalos se llenan). **`objects`
  es la cubeta ÚNICA de lo colocable no-estructural** (bloques + circuitos + ordenadores…): el COMPORTAMIENTO lo
  deciden los TRAITS (del asset, o de instancia vía `o.traits`), NO la cubeta — un `cube` es fijo por defecto y
  empujable si la instancia añade `movable`/`falls`. Posición por celda (`cx,cy`) o continua (`x,y`); `h` = pila.
  El **zócalo es UN asset genérico** (`socket`); qué circuito pide lo decide la MISIÓN (`MISSION.requires[id]`)
  y `filled` (lo puesto) es estado de partida. El circuito incrustado lo dibuja el drawer del socket con el sprite del propio circuito
  (lleno = a color; vacío = fantasma del que pide) → un circuito nuevo no toca el socket.
- `render.js`: **TODO lo que tiene altura entra al painter como cajas** — cáscara (paredes/puertas) + lo COLOCABLE
  (`roomThings` + `aabb` + `drawAsset`) + entidades — y `depthSort` decide el orden atrás→adelante (solo el suelo,
  z=0, se pinta antes). Las **paredes de fondo se PARTEN por su vano** (`flatWall(...,paint=[c0,c1])`, con el panal
  anclado al muro completo para no desfasarse) y la **puerta de fondo RETROCEDE** tras el plano del muro (inset
  `y<0`/`x<0`, simétrico a la frontal que protruye hacia fuera) → el muro contiguo, delante, le tapa el marco
  lateral exterior. Modelo 3D correcto de un vano: hueco en el muro + marco que recede, ordenado por profundidad.
- `physics.roomSolids`: incluye los placements con trait `solid`; empuje (player) y gravedad (physics) operan por
  `movable`/`falls` vía **`thingHas`** (trait de asset O de instancia), con la huella propia. `game.interact`
  reconoce destinos/items por `receptacle`/`carriable`.

**Añadir un asset** = una entrada en `data/assets.js` (+ su `.svg` si es de sprite). Un asset de sprite no añade
ni una línea a `draw.js`; uno procedural añade solo su `drawer`. No se toca render, física ni la tool.

## Reglas (no romper)
- **Sin ciclos de import** salvo `player↔game` (resuelto: solo en call-time). No reintroducir globales.
- `view.js`/`input.js` no tocan el DOM al importar (solo en `init*()`).
- `makeRoom` **clona** los arrays mutables → `resetGame` no arrastra estado.
- Datos de assets SOLO en `data/assets.js`; datos del mapa SOLO en `data/rooms.js`. Cero geometría hardcodeada.
- `npm test` (smoke + painter + assets) antes de tocar física / painter / interacción de objetos.
