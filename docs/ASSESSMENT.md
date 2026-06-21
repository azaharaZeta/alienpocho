# ASSESSMENT.md — Estructura de código de *Alien Pocho*

> Evaluación técnica independiente del estado del código, con foco en **separar
> responsabilidades, parametrizar la configuración y separar el motor de los datos del
> juego**. No es un plan cerrado: es el diagnóstico para decidir juntas qué hacer.
>
> Fecha: 2026-06-21 · Alcance: `engine.js`, `assets.js`, `game.js`, `index.html`,
> `assets-demo.html` (~1.670 líneas de fuente).
>
> **✅ ESTADO: refactor COMPLETO — Fases 0-5 implementadas y verificadas (2026-06-21).** ES
> modules bajo `src/` (sin globales ni ciclos de shell), datos del mapa en `data/rooms.js` +
> `world.js`, simulación en `physics.js`/`player.js`/`game.js`, presentación en `render.js`/
> `screens.js`/`main.js`, y parametrización fina: geometría compartida (puerta/zócalo/prop/robot)
> unificada en `config.js` y paleta en `palette.js` — física/estado ya NO dependen del dibujo. CSS
> en `styles.css`, red de seguridad `test/smoke.mjs` (13/13). Verificado en navegador (idéntico al
> baseline). El resto del documento describe el punto de partida (pre-refactor).

---

## 0. TL;DR (veredicto honesto)

**El código NO está "todo espagueti", y conviene decirlo claro.** Las funciones son
pequeñas, bien nombradas y muy comentadas; `engine.js` es un motor isométrico genuinamente
limpio y reutilizable. La intuición de "ficheros enormes" es correcta, pero el problema de
fondo no es el tamaño: son **dos cosas estructurales**.

1. **No hay sistema de módulos.** Todo son IIFEs globales (`ENGINE`, `AP`) + acoplamiento
   por *variables globales léxicas* entre `game.js` y el `<script>` inline de `index.html`.
   Esto crea un **ciclo de dependencias** (la simulación depende de la presentación y
   viceversa) y obliga a un orden de carga frágil. **Esta es la causa raíz**: mientras siga
   así, "separar en ficheros" solo añade más `<script>` y más fragilidad.

2. **Mezcla de capas dentro de los ficheros grandes.** `index.html` lleva ~470 líneas de JS
   (config + input + render + HUD + pantallas + bucle). `game.js` mezcla **datos del mapa**,
   física, entidad-jugador, estado y reglas. Aquí es donde tu instinto acierta de lleno.

**Recomendación de una línea:** migrar a **ES modules** (sin build, nativo en el navegador) y,
apoyándose en eso, **extraer config, datos del mapa y render** a sus propios módulos. Es un
refactor *mecánico y conservador* (no reescribir lógica), de bajo riesgo si se hace por pasos.

---

## 1. Inventario actual

| Fichero | Líneas | Rol declarado | Qué contiene de verdad |
|---|---:|---|---|
| `engine.js` | 174 | Motor iso genérico (`ENGINE`) | ✅ Limpio: color, proyector, `poly/box/honeycomb`, `depthSort`. Cero conocimiento del juego. |
| `assets.js` | 258 | Biblioteca de dibujo (`AP`) | Dibujo monocromo + **paletas de color (datos)** + **constantes de geometría compartidas** (`PROP`, `ROBOT`, `DOOR`). |
| `game.js` | 508 | Simulación | **Datos del mapa** (`buildWorld`) + física + entidad-jugador + estado + reglas + transiciones. **5 responsabilidades.** |
| `index.html` | 668 | Presentación + shell | CSS (~90) + HTML + **JS inline ~470**: `CFG`, `CONTROLS`, input, proyector, `render`, HUD, minimapa, pantallas, bucle, táctil, fullscreen. |
| `assets-demo.html` | 99 | Catálogo visual de assets | Útil; **reimplementa su propio depth-sort** en vez de usar `ENGINE.depthSort`. |

Sin `package.json`, sin build, sin tests. Se sirve con `python3 -m http.server 8123`.
Despliegue en Vercel. Caché del navegador se rompe a mano con `?v=N` en los `<script>`.

---

## 2. Diagnóstico priorizado

Etiquetas: 🔴 crítico (causa raíz) · 🟠 alto · 🟡 medio · 🟢 bajo · ✅ lo que está bien.

### 🔴 H1 — Ciclo de dependencias por globales (sin módulos)

El comentario de cabecera de `game.js:6-11` lo documenta con honestidad, pero describe un
**acoplamiento bidireccional**:

- `game.js` **lee de la shell**: `CFG`, `ctx`, `P`, `pressed()`, `held()` — todos definidos
  *después*, en el inline de `index.html:161-243`.
- `index.html` **lee de game.js**: `game`, `player`, `entities`, `world`, `room`,
  `checkExits`, `resetGame`, `updateObjects`, `supportHeight`.

Es decir: **la simulación (capa baja) depende de la presentación (capa alta)** — dependencia
invertida — y a la vez la presentación depende de la simulación. Eso es un **ciclo**, y es la
definición de spaghetti a nivel de módulo: no puedes entender ni mover uno sin el otro, y no
hay contrato explícito. Funciona solo gracias al *late-binding* (las funciones se llaman
después de que todo esté cargado) y a un orden de `<script>` exacto.

**Consecuencia:** cualquier intento de "trocear" sin resolver esto multiplica los `<script>`,
los `?v=N` y la fragilidad de orden. Por eso H1 va primero.

### 🟠 H2 — `index.html` mezcla 4+ responsabilidades

~470 líneas de JS viven dentro del HTML (`index.html:155-665`):

- **Config**: `CFG` (`:161-197`), `CONTROLS` (`:203-209`), `ORIGIN` (`:213`).
- **Input**: teclado, flancos, `held/pressed` (`:221-235`).
- **Render de escena**: `render()` (`:279-346`), proyector por sala (`:247-254`), tema por
  sala (`:264-270`).
- **HUD**: `drawHUD`, `drawMinimap`, `drawCarrySlot`, `drawMiniRobot`, `drawSegBar`,
  `drawTitle` (`:362-526`).
- **Pantallas**: título + marco sci-fi + banner victoria (`:349-594`).
- **Bucle principal** + API de test (`:600-627`).
- Dos `<script>` más: controles táctiles (`:633-647`) y fullscreen (`:652-665`).

Es presentación legítima, pero **un fichero `.html` no es sitio para 470 líneas de lógica**.

### 🟠 H3 — Datos del mapa incrustados en el motor (lo que pediste)

`buildWorld()` (`game.js:36-110`) mezcla tres cosas que deberían estar separadas:

1. **Datos puros** (`:45-89`): cada sala como literal — `ink`, `w/h`, `exits`, `blocks`,
   `objects`, `sockets`. Esto es **contenido**, no código.
2. **Fábrica/validación** (`makeRoom`, `:22-34`): aplica límites, deriva `solid`.
3. **Algoritmo de layout** (`:94-107`): coloca salas en el plano para el minimapa.

Hoy el "mapa" no se puede editar sin tocar el fichero de la simulación. Separar **datos**
(declarativos) del **motor que los interpreta** (makeRoom + layout + física) es exactamente la
mejora que intuías, y la de mayor retorno para el diseño de niveles.

### 🟡 H4 — Configuración dispersa y constantes mágicas duplicadas

La config vive en **cuatro sitios** y hay constantes que **se repiten a mano** entre física y
dibujo (si cambias una y olvidas la otra, el juego se descuadra):

| Constante | Definida en | También usada/duplicada en | Riesgo |
|---|---|---|---|
| Paletas `INKS`/`INK2`/`ROBOT_INK` | `assets.js:24-27` | render/tema en index.html | Datos de color enterrados en la lib de dibujo |
| `DOOR` (T, POST_W, LINTEL_H) | `assets.js:69` | render de puertas (index.html) | — |
| `DOOR_HALF = 0.72` (hueco físico) | `game.js:145` | **debe coincidir** con `doorSpan = ±1.12` (index.html:286) y `DOOR.POST_W` | Geometría de puerta definida **3 veces** sin única fuente |
| `SOCKET_BASE_H = 0.2` | `game.js:173` | **debe coincidir** con la peana dibujada en `AP.socket` (`assets.js:157`) | Dos `0.2` independientes que han de ser iguales |
| `PROP` (HALF, H) | `assets.js:149` | colisión/empuje en física (`game.js`) | Geometría de colisión vive en la **lib de dibujo** |
| `ROBOT` (WID, DEP, H) | `assets.js:200` | `canStandOn`, `addDraws` (física) | Ídem |
| `CFG` (dims, física, salto, colores) | `index.html:161` | game.js entero | Mezcla dimensiones + física + paleta UI |

Además, **números mágicos de layout** sin nombre por todo el render/HUD: `66`, `134`, `+20`
(`projectorFor`), `MM=45/WS=26/INS=0.6` (minimapa), `hudY=224/slotCy=229/34/52/W-24/W-56`
(HUD), tamaños y posiciones del título y la pantalla de inicio. Esto es justo lo que querías
"sacar a parametrización".

### 🟡 H5 — `game.js` mezcla física + entidad + estado + reglas

Aunque cada función es limpia, el fichero apila cuatro sub-sistemas:

- **Física pura** (colisión/apoyo/empuje/gravedad): `inDoor`, `outOfBounds`, `roomSolids`,
  `overlapsBox`, `blocksHoriz`, `supportHeight`, `canStandOn`, `objBlocked`, `objSupport`,
  `tryPush`, `updateObjects` (`:140-293`).
- **Entidad jugador**: estado + `player.update` + `player.addDraws` (`:118-416`).
- **Estado de partida y reglas**: `game`, `interact`, condición de victoria (`:113`, `:428-471`).
- **Mundo y transiciones**: `world`, `checkExits`, `resetGame` (`:476-508`).

Son fronteras naturales para trocear en `physics.js` / `player.js` / `game-state.js` / `world.js`.

### 🟢 H6 — `assets.js` mezcla datos (paleta) con código (dibujo)

Las paletas (`INKS/INK2/ROBOT_INK`, `assets.js:24-27`) son **datos de diseño**, no dibujo.
Conviven con las funciones de render de assets. Extraerlas a `palette.js` (o `config`) las hace
editables sin tocar la lib y rompe la dependencia "render → lib de dibujo para saber colores".

### 🟢 H7 — Duplicación menor

- `assets-demo.html:86-93` ordena su escena con un `sort` por profundidad propio en lugar de
  `ENGINE.depthSort`. Diverge del motor real (puede pintar distinto que el juego).
- `?v=N` manual en tres `<script>` (`index.html:152-154`): síntoma de no tener paso de build;
  fácil de olvidar (la propia memoria del proyecto recuerda "subir N al editar").

### 🟢 H8 — Sin red de seguridad ni guía

- Existe un hook de test (`window.__pocho`, `index.html:627`) pero **no hay tests** que lo usen.
- No hay `CLAUDE.md` (de hecho está en `.gitignore`); `PENDIENTES.md` ya pedía añadir uno.
  Un refactor estructural es el momento ideal para fijar el "mapa de ficheros" y reglas.

### ✅ Lo que está BIEN (no tocar / preservar)

- **`engine.js`**: motor iso genérico, sin acoplamiento al juego, API clara. Es el modelo a
  seguir para el resto.
- **El *concepto* de capas** (engine → assets → game → shell) es correcto; falla la *ejecución*
  (globales, inline, datos mezclados), no la idea.
- **`depthSort`** (painter topológico con *gating* por solape en pantalla) es sofisticado y
  está verificado. **Es lógica delicada: refactor solo mecánico, sin tocar el algoritmo.**
- **Densidad de comentarios** alta y útil (en español). Preservarla al mover código.

---

## 3. Mapa de dependencias

**Hoy (de facto)** — la flecha ⟲ marca el ciclo:

```
engine.js (ENGINE) ─────────────┐
   ▲                            │ (descendente, OK)
assets.js (AP) ─ usa ENGINE     │
   ▲                            │
game.js (game/player/world…) ───┘
   │  ▲                          usa CFG, ctx, P, pressed, held  ⟲ (ASCENDENTE: mal)
   │  └───────────────────────────────────────────────┐
   ▼                                                    │
index.html inline (CFG, CONTROLS, input, render, HUD) ──┘
        usa game, player, world, room, checkExits…  (descendente, OK)
```

**Objetivo** — flujo en una sola dirección, sin ciclos (config y datos en la base, `main` arriba):

```
config.js   palette.js   data/rooms.js        ← datos + parámetros (hojas, no importan nada)
    ▲           ▲             ▲
engine.js ──────┘             │
    ▲                         │
assets.js ─ usa engine+palette│
    ▲                         │
physics.js   world.js ─ usa data+config
    ▲           ▲
player.js ─ usa physics+assets+input
    ▲
game.js (estado/reglas) ─ usa world+physics+player
input.js   render.js   screens.js ─ usan assets+engine+config (+ leen estado)
    ▲           ▲           ▲
    └──────── main.js ──────┘   ← orquesta input+game+render+bucle
```

---

## 4. Arquitectura objetivo propuesta

ES modules nativos (`<script type="module">`), **sin build**. `index.html` queda como markup +
CSS enlazada + un único `import` de arranque.

```
index.html              # solo markup + <link rel=stylesheet> + <script type=module src=src/main.js>
styles.css              # todo el CSS actual (extraído del <style>)
src/
  config.js             # CFG (dims, física, salto), CONTROLS, ORIGIN, constantes de layout/HUD,
                         #   y la geometría COMPARTIDA (door, socket, prop, robot) — única fuente
  palette.js            # INKS, INK2, ROBOT_INK  (datos de color)
  engine.js             # (igual que hoy) iso + color + depthSort   ← ya está limpio
  assets.js             # AP.* dibujo; importa engine + palette + config(geometría)
  data/
    rooms.js            # EL MAPA: definición declarativa de salas (datos puros, sin lógica)
  world.js              # makeRoom + buildWorld + layout  (motor que CONSUME data/rooms.js)
  physics.js            # colisión, apoyo, empuje, gravedad de objetos
  player.js             # entidad jugador: estado + update + addDraws
  game.js               # estado de partida, interact, reglas de victoria, checkExits, resetGame
  input.js              # teclado + flancos + held/pressed + binding táctil
  render.js             # render(room) de escena + HUD + minimapa
  screens.js            # pantalla de título + banner de victoria + marco sci-fi
  main.js               # bucle rAF, tema por sala, fullscreen, bootstrap, window.__pocho
```

~13 módulos JS + html + css. Si parece demasiado grano para el tamaño del juego, se puede
**colapsar** sin perder la idea: `physics.js`+`player.js`+`game.js` → un `sim/` ; `render.js`+
`screens.js` → un `ui/`. Lo **irrenunciable** son tres cortes:

1. **config/datos fuera** (config.js, palette.js, data/rooms.js).
2. **render/HUD/pantallas fuera del HTML**.
3. **romper el ciclo** moviendo `CFG`/`input`/proyector a módulos que *ambos* lados importen.

---

## 5. Separación "motor vs datos" (lo que pediste, concretado)

| | **DATOS** (declarativo, editable sin saber programar) | **MOTOR** (código que interpreta los datos) |
|---|---|---|
| Mapa | `data/rooms.js`: salas con `ink/w/h/exits/blocks/objects/sockets/name` | `world.js`: `makeRoom` (límites, `solid`), `buildWorld`, `layout` |
| Color | `palette.js`: `INKS/INK2/ROBOT_INK` | `assets.js`, `render.js` consumen la paleta |
| Tuning | `config.js`: física, salto, dims, geometría de puerta/socket/prop | `physics.js`, `assets.js` consumen los parámetros |

Ejemplo de cómo quedaría el dato de una sala (puro, sin lógica):

```js
// data/rooms.js
export const ROOMS = {
  "0,0": { name: "ENTRADA", paletteIndex: 0, w: 8, h: 8,
    exits: { xp: "1,0" },
    blocks:  [{ x: 2, y: 2, z: 0, h: 1 }],
    objects: [{ x: 3.5, y: 5.5, z: 0, shape: "cube" }],
    sockets: [{ cx: 6, cy: 5, z: 0, shape: "cube" }] },
  // …
};
export const START = "0,0";
```

Ventaja inmediata: editar niveles (o, más adelante, **generarlos** para la idea "roguelike" de
`PENDIENTES.md`) pasa a ser producir este objeto de datos — el motor no cambia.

---

## 6. Parametrización: qué constantes sacar y a dónde

1. **Unificar geometría compartida** en `config.js` como **única fuente**, y que tanto física
   como dibujo la importen:
   - Puerta: hoy `DOOR_HALF` (game.js), `doorSpan ±1.12` (index.html) y `DOOR.POST_W/T`
     (assets.js) describen **la misma puerta** por separado. → un solo `DOOR = { width, postW,
     lintelH, thickness }` del que se derivan hueco físico y dibujo.
   - Socket: `SOCKET_BASE_H` (game.js) y la peana `0.2` de `AP.socket` (assets.js) → un solo
     `SOCKET.baseH`.
   - `PROP` y `ROBOT` (dims de colisión + dibujo) → a `config.js`; `assets.js` y `physics.js`
     los importan (rompe "física depende de la lib de dibujo").
2. **Nombrar los números mágicos de layout** (`projectorFor`, minimapa, HUD, título) como
   constantes en `config.js` (p. ej. `HUD.iconY`, `MINIMAP.size`, `SCENE.originY`,
   `SCENE.verticalDrop`). Hoy son literales sin explicación repartidos por el render.
3. **`CFG.COL`** (colores de UI) puede quedarse en `config.js`, pero conviene distinguir lo que
   es **paleta de juego** (en `palette.js`) de lo que es **chrome de UI** (HUD/marco).

---

## 7. Plan de migración (incremental y conservador)

Principio rector: **mover, no reescribir**. La lógica delicada (`depthSort`, física, salto) se
traslada **byte a byte**; cada fase deja el juego ejecutable y se verifica antes de seguir.

- **Fase 0 — Red de seguridad (antes de tocar nada).**
  Aprovechar `window.__pocho` para 4-5 *smoke tests* de comportamiento (cruzar puerta, recoger/
  soltar objeto, activar zócalo, salto corto/largo, condición de victoria). Sirve de oráculo
  para detectar regresiones en cada fase. *Riesgo: nulo.*

- **Fase 1 — ES modules + extraer CSS.**
  `index.html` → markup + `styles.css` + `<script type="module">`. Convertir `ENGINE`/`AP` a
  `export`. Romper **H1**: `CFG`, `CONTROLS`, input y proyector salen a `config.js` + `input.js`
  que *ambos* lados importan → desaparece el ciclo. *Riesgo: medio (orden de carga), pero
  mecánico.* Bonus: adiós a `?v=N` (los módulos versionan por URL del import / cache headers).

- **Fase 2 — Separar datos del mapa (H3).**
  Extraer literales de salas a `data/rooms.js`; dejar `world.js` con `makeRoom`+`buildWorld`+
  `layout`. *Riesgo: bajo (es mover datos).* Aquí ya se nota la mejora que buscabas.

- **Fase 3 — Trocear la simulación (H5).**
  `game.js` → `physics.js` + `player.js` + `game.js` (estado/reglas). *Riesgo: bajo-medio.*

- **Fase 4 — Sacar render del HTML (H2).**
  `render.js` + `screens.js` + `main.js`. *Riesgo: bajo (mover funciones).*

- **Fase 5 — Parametrización fina (H4/H6) y limpieza (H7/H8).**
  Unificar geometría compartida, nombrar mágicos, `palette.js`, alinear `assets-demo.html` con
  `ENGINE.depthSort`, añadir `CLAUDE.md` con el nuevo mapa de ficheros. *Riesgo: bajo.*

Fases 1 y 2 son las de mayor retorno. Se pueden parar tras la 2 y ya se habrá resuelto lo
esencial de tu petición.

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper la física/painter al mover código (lógica afinada, "0 violaciones") | Fase 0 (smoke tests) + mover **sin editar** + verificar tras cada fase |
| ES modules requieren servidor (no `file://` por CORS) | Ya se usa `http.server`/Vercel; documentarlo. No rompe el "sin build" del GDD |
| Orden de carga / dependencias circulares ocultas al modularizar | El grafo objetivo (§3) es acíclico; si algo no encaja, revela un acoplamiento que **conviene** ver |
| Sobre-fragmentar para ~1.670 líneas | Estructura colapsable (§4); empezar por los 3 cortes irrenunciables |
| Perder el contexto de los comentarios | Mover comentarios junto a su código; no es una reescritura |

---

## 9. Decisiones para la usuaria

1. **¿Migramos a ES modules?** Es el cambio que desbloquea todo lo demás (rompe el ciclo H1).
   Alternativa sin módulos: mantener globales y solo trocear ficheros — *no recomendado*,
   porque conserva la fragilidad de orden y no rompe el ciclo.
2. **Granularidad**: ¿~13 módulos (§4) o versión colapsada (`sim/` + `ui/`)?
3. **Alcance ahora**: ¿hacemos solo **Fases 0-2** (config + datos del mapa, el corazón de tu
   petición) o el refactor completo **0-5**?
4. **Red de seguridad**: ¿invertimos en los smoke tests de Fase 0 antes de mover? (Recomendado.)

---

## 10. Recomendación

Hacer **Fases 0 → 1 → 2** como primer bloque acordado: instala la red de seguridad, mata el
ciclo de dependencias con ES modules y **separa los datos del mapa del motor** — que es,
textualmente, lo que pediste. Es bajo riesgo (mover, no reescribir), deja el juego ejecutable
en cada paso, y al terminarlo la estructura ya será sana. Las Fases 3-5 (trocear simulación,
sacar render del HTML, parametrización fina) se abordan después, sin prisa, una a una.

Lo que **no** recomiendo: una reescritura. El motor es bueno, la lógica es correcta y está
verificada; el problema es de *organización y acoplamiento*, y eso se arregla moviendo piezas
con cuidado, no empezando de cero.
