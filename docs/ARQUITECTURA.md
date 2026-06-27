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
- **`world.js`** — arma las salas (`makeRoom`/`buildWorld`) y expone `roomThings(room)` (placements de lo colocable) y `roomShell(room)` (placements de la cáscara: paredes/puertas), ambas con `aabb` (huella: la MISMA caja para colisión Y painter).
- **`physics.js`** — colisión / apoyo / empuje (puro, sobre `room`); `roomSolids` = objetos sólidos **∪ cáscara** (paredes/puertas), todo como AABB (mismo cálculo).
- **`player.js`** — entidad jugador · **`game.js`** — estado de partida + reglas + transiciones de sala.
- **`view.js`** / **`input.js`** — canvas+proyector+tema / teclado+táctil. **No tocan el DOM al importar** (solo en `init*()`) → los módulos corren en Node (tests). `projectorFor` ancla el **pico frontal del suelo al centro-base de un marco FIJO 8×8** (la esquina `(w,h)` cae siempre en el mismo punto) → el marco del HUD queda centrado y estable en cualquier sala.
- **`render.js`** — escena + HUD + minimapa · **`screens.js`** — título · **`main.js`** — bucle + arranque. Minimapa **fijo a la derecha**, marcador/UI **fijo a la izquierda** (posición fija, ya no según el hueco).

## Motor isométrico
- **Proyección 2:1** (`engine.js`): `P(x,y,z) = (ox + (x−y)·TW/2, oy + (x+y)·TH/2 − z·BH)`, con `TW=34, TH=17, BH=17`.
- **Painter `depthSort`**: orden por *separating-axis* con *gating* por solape en pantalla (**silueta hexagonal exacta**, no el AABB de pantalla) + **orden topológico
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
  · **`offset`+`footMode`/`foot`** (ancla = esquina (0,0) + `offset`; `footMode` center/corner sitúa la huella) ·
  **`tile`/`tiles`** (encuadre de pared/puerta, en el registro) · **`variants`** (orientación: puerta eje x/y, robot ±x/±y).
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
- `render.js`: **TODO lo que tiene altura entra al painter por la MISMA vía** — la CÁSCARA (paredes/puertas,
  `world.roomShell`) y lo COLOCABLE (objetos, `world.roomThings`), cada placement con su caja + `AP.drawAsset`,
  más las entidades — y `depthSort` decide el orden atrás→adelante. **La cáscara ya NO se construye a mano**: sus
  cajas/anclaje salen del registro igual que las de los objetos (un solo pipeline). El painter ordena por la
  **MISMA huella** (`aabb`) que la colisión: UNA caja por asset → al "tocar", colisión y dibujo coinciden y el orden
  nunca es ambiguo (sin caja visual aparte). El suelo (z=0) y el **vacío negro del vano** de las puertas
  de fondo (`doorHole`) se pintan antes, al fondo (pre-pases). Las **paredes de fondo son MÓDULOS SVG**: `flatWall`
  tesela las tiras de panal celda a celda **sin recorte**; el muro se parte por su vano en tramos de celdas enteras
  (`wallSegs`), posible porque la **puerta ocupa 2 celdas exactas** (`DOOR.SPAN_HALF=1`) y las salas son de
  dimensión PAR ∈ {4,6,8} (`world.makeRoom`). La **puerta de fondo RETROCEDE** tras el plano del muro (inset,
  simétrico a la frontal que protruye) → el muro contiguo le tapa el marco lateral exterior. La **puerta es UN
  solo sprite** (`door.svg`; front/back = mismo dibujo, distinto ancla) pero el render la PARTE en 2 piezas
  (`roomShell` emite 2 placements-poste; el drawer recorta el sprite por el centro del vano, transparente) → cada
  poste se ordena por separado y el robot se intercala al cruzar (delante del poste cercano, detrás del lejano).
- `physics.roomSolids`: **FUENTE ÚNICA de sólidos** = objetos con trait `solid` (`roomThings`) **∪ la cáscara**
  (`roomShell`: paredes como su caja, puertas como sus **dos postes** dejando libre el vano = el antiguo `inDoor`
  exacto). Así paredes, puertas y bloques se colisionan EXACTAMENTE igual (AABB). `outOfBounds` queda solo como el
  **borde del mundo** (bordes exteriores abiertos x≥w/y≥h, sin muro dibujado), no como la colisión de un muro.
  Empuje (player) y gravedad (physics) operan por `movable`/`falls` vía **`thingHas`**; `game.interact` reconoce
  destinos/items por `receptacle`/`carriable`.

**Añadir un asset** = una entrada en `data/assets.js` (+ su `.svg` si es de sprite). Un asset de sprite no añade
ni una línea a `draw.js`; uno procedural añade solo su `drawer`. No se toca render, física ni la tool.

## Reglas (no romper)
- **Sin ciclos de import** salvo `player↔game` (resuelto: solo en call-time). No reintroducir globales.
- `view.js`/`input.js` no tocan el DOM al importar (solo en `init*()`).
- `makeRoom` **clona** los arrays mutables → `resetGame` no arrastra estado.
- Datos de assets SOLO en `data/assets.js`; datos del mapa SOLO en `data/rooms.js`. Cero geometría hardcodeada.
- `npm test` (smoke + painter + assets) antes de tocar física / painter / interacción de objetos.
