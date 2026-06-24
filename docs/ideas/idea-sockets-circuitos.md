# idea — Rediseño de sockets y circuitos

> Estado: **IMPLEMENTADO ✅ (2026-06-24)** — análisis + implementación del rediseño de zócalos y
> circuitos. Origen: propuesta de la usuaria. Verificado: `npm test` (34 ✓) + preview en navegador
> (vacío con fantasma, lleno con base iluminada, oclusión correcta). Decisiones D1–D4 resueltas (§9).
> Relacionado: [[alien-pocho-assets-modularity]] · [[alien-pocho-assets-ssot]] · docs/AUDITORIA-MODULARIDAD.md.

---

## 0. TL;DR

La propuesta es **buena y está alineada** con el rumbo del proyecto (un solo socket genérico en vez de
cuatro, modularidad para circuitos futuros). Estoy de acuerdo en lo esencial. Tres matices/mejoras:

1. **Sí falta una tercera capa de datos.** Hoy "qué circuito pide cada socket" vive medio en `rooms.js`
   (campo `shape`) y la condición de victoria está **hardcodeada** (`circuitsTotal: 4` en `game.js`).
   Hay tres ejes distintos: **assets = qué SON**, **rooms = dónde ESTÁN**, **misión/puzzle = qué hay que
   LOGRAR**. Recomiendo hacer explícito el tercero, pero **ligero** (no sobre-ingeniería).
2. **Aviso de tamaños:** con los circuitos a 0.66 y el socket actual a 0.68, el socket **ya no es "un
   poco más grande"** (0.01 de margen). Para que haya reborde + indentación el socket **debe crecer**.
   Propongo números abajo.
3. **Mejor idea para el indicador:** en vez de un glifo dibujado por forma (cubo/pirámide/…), que el
   socket vacío muestre un **"fantasma" del propio circuito que pide** (su mismo sprite, atenuado). Así
   un circuito nuevo trae su indicador gratis, sin tocar el socket → cumple "aceptar circuitos futuros".

---

## 1. Cómo funciona HOY (estado actual)

| Pieza | Hoy |
|---|---|
| **Assets** | **4 sockets** (`socket_cube/pyramid/dome/cylinder`) + **4 circuitos** (`prop_cube/…`). Los 4 sockets son idénticos salvo el glifo `draw:"socket:<forma>"`. |
| **Tamaños** | `PROP = {HALF:0.28, H:0.5}` → circuito 0.56×0.56×0.5. `SOCKET = {BASE_H:0.2, HALF:0.34}` → peana 0.68×0.68×0.2. |
| **rooms.js** | `sockets:[{cx,cy,z,shape,active}]`. `shape` = la forma que acepta. |
| **world.roomThings** | Por socket emite `{asset:"socket_"+shape, …, active, aabb}`. La cima del aabb la da `socketTop(s)`. |
| **game.interact** | Llevando un circuito y plantado encima de un socket compatible (`shape===carried`) y libre → `active=true`, `carried=null`, `circuits++`. El circuito **desaparece** (no queda objeto). |
| **draw.socket** | Dibuja la peana (atenuada si inactiva, color pleno si activa) + un **glifo de línea** según forma. Si `active`, además dibuja el **sprite del circuito** encima (`drawSprite(propAsset(shape))`). |
| **physics.socketTop** | `z + BASE_H + (active ? PROP.H : 0)`. Al activarse, la cima sólida sube `PROP.H` → el robot se sube encima. |
| **Victoria** | `circuits >= circuitsTotal`, con `circuitsTotal: 4` **hardcodeado** en `game.js`. |

Observaciones clave para el rediseño:
- El circuito incrustado **hoy NO es un objeto**: es un dibujo que hace el drawer del socket. Conceptualmente
  hay **un** objeto (el socket "activo").
- El "qué forma pide" ya está fuera de `assets.js` (está en `rooms.js`), pero **selecciona qué asset usar**
  (`socket_cube`…), no es una config del socket genérico.
- Ya hay un par de **roturas leves de SSOT**: `circuitsTotal:4` hardcodeado y los `0.34` literales en
  `draw.socket` (deberían ser `SOCKET.HALF`).

---

## 2. Análisis de requisitos (propuesta de la usuaria, punto por punto)

| # | Requisito | Valoración | Notas |
|---|---|---|---|
| R1 | El socket debe ser **un único asset**. | ✅ De acuerdo | Los 4 sockets son redundantes. Colapsar a `socket`. |
| R2 | El dibujo que indica **qué circuito pide** = config por instancia, no del asset. | ✅ De acuerdo | Pasa a ser dato de instancia (`requires`). El asset queda genérico. |
| R3 | El socket debe **aceptar circuitos nuevos** en el futuro. | ✅ De acuerdo | Núcleo de la modularidad. Con socket genérico + `requires` por instancia, un circuito nuevo = 0 cambios en el socket. |
| R4 | El circuito que pide **no se define en `assets.js`**; se decide "en el juego". ¿Falta algo en `/data`? | ✅ De acuerdo + **propuesta** | Ver §3. Sí: una capa de **misión/puzzle** ligera. |
| R5 | Al colocar, **se mantienen los dos objetos** (socket + circuito incrustado). | ✅ De acuerdo (con matiz) | Ver §5: dos caminos (Path 1 / Path 2). El circuito **deja de destruirse**: su identidad se guarda en `socket.filled`. |
| R6 | El socket **más grande** que el circuito, con **indentación cuadrada** genérica; **la base se ilumina** al recibirlo. | ✅ De acuerdo + **aviso de tamaños** | Ver §4. El socket debe crecer; la base ya "ilumina" hoy (se puede reforzar con glow). |
| R7 | Circuitos **un pelín más grandes: 0.66×0.66×0.66**. | ✅ De acuerdo | Ver §4. `PROP = {HALF:0.33, H:0.66}`. Hay que reescalar el sprite px en proporción. |

**No veo nada que rechazar.** Las únicas cosas que añado son: la capa de misión (§3), los números de
tamaño concretos (§4), y la mejora del indicador-fantasma (§6).

---

## 3. La pregunta importante: ¿falta una capa de datos? (R4)

**Sí, y es la mejor intuición de la propuesta.** Hoy mezclamos dos cosas en `rooms.js` (el "dónde") con
una tercera que está implícita/hardcodeada (el "qué hay que lograr"):

```
assets.js   →  QUÉ SON las cosas      (identidad, física, dibujo)        ← genérico, ya está
rooms.js    →  DÓNDE están            (layout de salas, conexiones)       ← ya está
¿puzzle?    →  QUÉ hay que LOGRAR     (qué pide cada socket, victoria,
                                       y a futuro: dependencias/historia) ← hoy disperso/hardcodeado
```

### Propuesta (ligera, sin sobre-ingeniería)

- **`requires` por socket** → se queda **en `rooms.js`**, sobre la instancia del socket. Es dato espacial
  ("el socket que está AQUÍ acepta un cubo"); el socket ya necesita su placement ahí de todos modos.
- **Condición de victoria** → dejar de hardcodear `circuitsTotal:4`. Como mínimo **derivarla** (contar
  sockets del mundo). Opcionalmente, un fichero **`src/data/mission.js`** (o `puzzle.js`) como hogar de la
  meta y, a futuro, de dependencias entre puzzles e hitos de historia.

**Recomendación:** empezar por **derivar el total** (mata el hardcode, coste casi nulo) y **reservar
`mission.js`** para cuando haya metas más ricas (gating de puertas, multi-paso, historia). Esto es
especialmente relevante para el **roguelike** que está en ideas (mapa random): ahí querrás **desacoplar el
puzzle del layout** — los sockets se colocan al azar pero la misión (cuántos/cuáles circuitos, dependencias)
se define aparte. La capa de misión es donde crece esa lógica.

> **Decisión abierta D1:** ¿`mission.js` ya, o de momento solo derivar `circuitsTotal` y dejar `mission.js`
> para más adelante? (Recomiendo: derivar ahora, `mission.js` cuando haga falta.)

---

## 4. Tamaños y geometría (R6, R7)

### Aviso

Circuito 0.66 vs socket actual 0.68 → **0.01 de margen por lado**. Imposible meter reborde + indentación.
**El socket tiene que crecer.**

### Valores IMPLEMENTADOS (socket 0.9 por petición de la usuaria; afinables a ojo en la tool)

```js
// src/data/assets.js
export const PROP   = { HALF: 0.33, H: 0.66 };                 // circuito 0.66×0.66×0.66 (antes 0.28/0.5)
export const SOCKET = { BASE_H: 0.24, HALF: 0.45,             // peana 0.90×0.90×0.24 (antes 0.20/0.34)
                        RECESS_HALF: 0.35, RECESS_DEPTH: 0.14 }; // cavidad 0.70×0.70, hundida 0.14
```

Derivados (todo se LEE del registro, nada hardcodeado):
- **Reborde** visible por lado = `HALF − RECESS_HALF` = 0.10.
- **Holgura** cavidad↔circuito por lado = `RECESS_HALF − PROP.HALF` = 0.02 (entra "justo").
- **Base del circuito incrustado** z = `z + BASE_H − RECESS_DEPTH` (= z+0.10); su **cima** = +0.66 → z+0.76.
- **`socketTop` (lleno)** = `z + BASE_H − RECESS_DEPTH + PROP.H`. Subida al colocar = `PROP.H − RECESS_DEPTH` = 0.52.
- ⚠️ **`BASE_H ≤ CFG.STEP` (0.24 ≤ 0.25):** la peana VACÍA tiene que ser subible andando para plantarse
  encima y colocar el circuito (el robot no anda hacia algo más alto que `STEP`). Por eso no subí la peana
  a 0.30 como proponía el borrador. Lo fija `test/smoke.mjs` ("STEP permite subir a la peana").

**Sprites de los circuitos** (visual): subidos ~1.22× en el registro + `manifest.json` (cube 18→22, etc.);
el SVG vectorial escala limpio vía `drawImage` (NO se tocó el arte). Verificado: no hay regenerador de
manifest, así que registro==manifest basta (lo guarda `test/assets.mjs`).

```js
// physics / assets — nueva socketTop (la indentación resta a la subida)
export function socketTop(s) {
  const base = (s.z || 0) + SOCKET.BASE_H;
  return s.filled ? base - SOCKET.RECESS_DEPTH + PROP.H : base;
}
```

### Reescalado del sprite del circuito

Los `prop_*` se dibujan desde sprite (px). Si crece la huella (mundo) pero no el sprite (px), el dibujo
queda más pequeño que su caja física. Hay que **escalar el sprite ~1.18×** (0.66/0.56) y reencuadrar
`minX/minY` en proporción (p. ej. `prop_cube` 18→~22 px). El `.svg` es vectorial → reescala limpio; se
**reexporta el PNG por la tool** ([[alien-pocho-png-asset-workflow]]). La huella (física) cambia al toque al
editar `PROP`; el sprite (visual) se ajusta aparte. Lo guarda el test `manifest ⇄ registro`.

---

## 5. Modelo de "dos objetos" (R5): dos caminos

La usuaria quiere que **persistan socket y circuito**. En el **modelo de datos** ambos persisten en los dos
caminos: el circuito **deja de destruirse**; su identidad se guarda en `socket.filled`. La diferencia es si
el circuito incrustado es, además, **un placement propio** o lo **pinta el socket**.

### Path 1 — socket = objeto combinado (RECOMENDADO para el primer corte)
- `socket.filled` guarda el circuito colocado (token o `null`). No se destruye nada.
- El **drawer del socket** dibuja el circuito incrustado con **su propio sprite** (`drawSprite(propAsset(filled))`),
  ya en su sitio dentro de la indentación + base iluminada. Vacío → fantasma del `requires` atenuado.
- Física: el **socket es el sólido** (su `aabb` llega a `socketTop`, circuito incluido). `socketTop` gestiona
  el subirse encima. **Cero conceptos nuevos** en física/interacción.
- ✅ Cumple los 7 requisitos. **Blast radius mínimo.** El circuito ya se dibuja con su sprite (DRY), así que
  un circuito nuevo no toca el socket.

### Path 2 — circuito incrustado como placement propio (evolución)
- `roomThings` emite **dos** placements: el socket + el circuito incrustado (con `inert:true`), dibujado por
  el bucle genérico, depth-sorteado por separado.
- Requiere **un flag genérico `inert`** que ignoren `roomSolids` (para no duplicar sólido) y `game.interact`
  (para no poder "sacarlo" sin querer), porque reusamos un asset con traits (`prop_*` es carriable/movable) en
  un rol inerte.
- Ventaja: separación más "real"; mejor base si el circuito debe **poder sacarse** o tener comportamiento
  propio. Coste: el flag + sus guardas. Beneficio **visual** marginal (van concéntricos: mismo resultado).

**Recomendación:** **Path 1 ahora.** Es lo correcto en altura: cumple todo, mantiene el motor simple y honra
"dos objetos" en datos (socket + identidad del circuito) y en pantalla (ambos se ven). Saltar a Path 2 solo
si se decide que **colocar es reversible** (sacar circuitos).

> **Decisión abierta D2:** ¿Colocar es **permanente** (como hoy) o **reversible** (se puede sacar el circuito)?
> Si reversible → empuja hacia Path 2 y cambia la victoria (hay que tener todos puestos a la vez, no contar).
> (Recomiendo: permanente por ahora.)

---

## 6. Indicador "qué pide" (R2, R3): fantasma en vez de glifo

Hoy el socket dibuja un **glifo de línea** distinto por forma (un `if shape==="cube"…` en el drawer). Eso es
un mapa forma→glifo **hardcodeado**: un circuito nuevo obligaría a añadirle su glifo.

**Mejor:** el socket **vacío** muestra el **propio sprite del circuito que pide**, atenuado/fantasma, dentro de
la indentación. **Lleno:** el sprite a color pleno + base iluminada.

- Cumple R2 (indicador = config: `requires`), R3 (circuito nuevo trae su indicador gratis) y es **más bonito y
  coherente** (lo que vas a meter es lo que ves en gris). Elimina el `if` por forma del drawer.

---

## 7. Diseño técnico (fichero por fichero)

| Fichero | Cambio |
|---|---|
| **`src/data/assets.js`** | `PROP`/`SOCKET` nuevos (§4). **Borrar** `socket_cube/pyramid/dome/cylinder`; **añadir** un `socket` genérico (`draw:"socket"`, `traits:{solid,receptacle,stateful}`, foot `HALF*2`). `socketTop` con indentación. |
| **`src/data/rooms.js`** | En cada socket: `shape`→**`requires`**, `active`→**`filled:null`**. (Doc del fichero al día.) |
| **`src/world.js`** | `roomThings`: socket → `asset:"socket"` con `requires`/`filled`. (Path 2: además emitir el circuito incrustado `inert`.) |
| **`src/game.js`** | `interact`: emparejar por `requires===carried` y `!filled`; al colocar `filled=carried` (no destruir). **`circuitsTotal` derivado** (contar sockets del mundo) en vez de `4`. |
| **`src/physics.js`** | `socketTop` nueva (vía registro). (Path 2: `roomSolids` ignora `inert`.) |
| **`src/draw.js`** | Drawer `socket(ctx,p,x,y,z,requires,filled,col)`: peana + **indentación cuadrada** + base **iluminada** si `filled` + circuito (sprite) lleno, o **fantasma** del `requires`. Quitar el `if` por forma. Usar `SOCKET.HALF` (no `0.34`). |
| **`src/config.js`** | Nada (re-exporta `PROP`/`SOCKET` solo). |
| **tools/tool-assets.html** | **Nada de código** (es genérica). Mostrará 1 "Zócalo" en vez de 4. |
| **assets PNG** | Reexportar `prop_*` ~1.18× (§4). |
| **docs** | GDD §5 (puzzle), ASSETS.md y ARQUITECTURA.md (mención de sockets). |

### Tests / guardarraíles
- `npm test` debe seguir verde. Los tests son **genéricos** (no nombran `socket_*`), así que colapsar 4→1 no
  rompe nada estructural; sí cambian los datos de `rooms.js`.
- ⚠️ Tocamos **`socketTop` (física) e `interact` (interacción de objetos)** → correr `npm test` antes y después
  (regla del proyecto).
- **Opcional:** test nuevo que valide que cada `socket.requires` de `rooms.js` apunta a un circuito existente.

### Oclusión iso (punto flaco recurrente — [[alien-pocho-iso-occlusion]])
Verificar SIEMPRE en `tools/tool-assets.html` y en juego:
- El **reborde frontal** del socket debe **tapar** la parte baja-frontal del circuito incrustado.
- El circuito (z mayor) se pinta **después** de la peana (mismo centro → el painter ya ordena por z; ok).
- Con el circuito a 0.66 (mayor huella), revisar que **paredes/objetos vecinos** lo ocluyan bien y que no
  "asome" por el borde del socket.

---

## 8. Plan por fases (cuando se apruebe)

0. `npm test` baseline (verde).
1. **Tamaños:** `PROP`/`SOCKET` nuevos + reescalar sprite `prop_*`. Verificar circuitos sueltos (coger/soltar/
   apilar/empujar/caer) con el nuevo tamaño. `npm test`.
2. **Socket único:** borrar los 4, añadir `socket` genérico; `rooms.js` `requires`/`filled`; `world`/`game`/
   `physics`/`draw` al nuevo modelo (Path 1). Indicador-fantasma. `npm test`.
3. **Indentación + base iluminada:** drawer del socket con cavidad cuadrada y glow al llenarse. Verificar
   oclusión en la tool.
4. **Victoria derivada:** matar `circuitsTotal:4` (contar sockets). (Opcional: `mission.js`.)
5. Limpieza de comentarios/doc (skills `limpiar-comentarios` / `limpiar-doc`).

---

## 9. Decisiones (resueltas con la usuaria)

- **D1 — Capa de misión:** ✅ **SÍ, `src/data/mission.js` ya.** Descriptor `MISSION` + `missionTotal` (total
  derivado del mapa) + `missionComplete`. `game.circuitsTotal` ya no se hardcodea.
- **D2 — ¿Permanente o reversible?** ✅ **Permanente** (Path 1). La usuaria quiere hacerlo **reversible en una
  fase siguiente** → ahí se evaluará Path 2 + cambio de la condición de victoria.
- **D3 — Moneda del puzzle:** ✅ **Token de forma** (`"cube"`…), genérico vía `propAsset`.
- **D4 — Indicador:** ✅ **Fantasma** del circuito que pide (sprite atenuado, `globalAlpha 0.30`).

---

## 10. Estado

**IMPLEMENTADO ✅.** Ficheros: `data/assets.js`, `data/rooms.js`, `data/mission.js` (nuevo), `world.js`,
`game.js`, `draw.js`, `assets/svg/manifest.json`, `test/smoke.mjs` (oráculo al modelo nuevo). `physics.js` no
necesitó cambios (`socketTop` vive en `assets.js`). Verificado: `npm test` (34 ✓) + preview (vacío con
fantasma, lleno con base iluminada, oclusión correcta).

**Pendiente (fase siguiente, a petición de la usuaria):** colocar **reversible** (poder sacar el circuito) →
modelo Path 2 (§5) + recalcular victoria (todos puestos a la vez). Al cerrarlo, archivar en `docs/ideas/archivo/`.
