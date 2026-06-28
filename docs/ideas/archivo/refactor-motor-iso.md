# Refactor del motor isométrico — assessment de excepciones + plan del motor genérico

**Fecha:** 2026-06-28 · **Estado:** ✅ IMPLEMENTADO / COMPLETO (el resultado vive en `ARQUITECTURA.md`; el "cómo" en §7) · Sustituye en alcance a
[assessment-motor-iso.md](assessment-motor-iso.md) (aquel describe el núcleo actual; esto plantea el motor
objetivo). Relacionado: [idea-motor-bounds-visuales.md](../idea-motor-bounds-visuales.md),
[idea-robot-huella-cuadrada.md](idea-robot-huella-cuadrada.md).

## Objetivo

Un motor isométrico **sólido, sencillo, estándar y GENÉRICO**: dibuja todo de atrás a adelante respetando la
profundidad, acepta objetos de **distintas alturas** y **apilados a distintas z**, y trata **todos los
elementos por igual** (robot, caja, circuito, planta, mesa o dragón) — **sin excepciones ni cálculos
especiales por tipo**. Todo lo type-specific vive en DATOS y en el callback de dibujo, nunca en el orden.

---

## 1. Qué está BIEN hoy (conservar)

- **Arquitectura de orden correcta**: orden parcial por *separating-axis* + **orden topológico** (Kahn), con
  gate de solape por **silueta hexagonal exacta** (no AABB de pantalla). Es justo lo que recomiendan las
  guías canónicas (shaunlebron, Bannalia). El comparador ingenuo `cmp(a,b)` —que rompe a casi todos los
  motores caseros porque la relación "está delante" **NO es transitiva**— ya está superado. **No reescribir
  esto.**
- **SSOT de assets** (`data/assets.js`): tamaños/anclaje/huella en un solo sitio. Base correcta para el
  modelo de datos del refactor.
- **Pipeline parcialmente unificado**: `roomShell` + `roomThings` entran al MISMO `depthSort` con `{aabb,
  draw}`. La idea es la correcta; el problema es que NO es del todo uniforme (ver §2).
- **Oráculo de fuzz** (`test/painter.mjs`, 30k escenas) + **guardarraíl anti-#2** (`test/assets.mjs`: la caja
  acota el sprite). Hay que APOYARSE en ellos durante el refactor.

---

## 2. El catálogo de EXCEPCIONES / chapuzas / bugs (lo que hay que matar)

### 2.1 El robot va por una vía APARTE del pipeline ⭐ (raíz)
Todo lo demás entra por `roomShell`/`roomThings` → `{aabb, AP.drawAsset}` ([render.js:96-100](../../../src/render.js)).
El robot NO: es una `entity` con su propio `player.addDraws` ([player.js:168](../../../src/player.js)) que
**construye su caja a mano** y llama a `AP.robot`/`AP.shadow`/carga directamente. Es la excepción por-tipo
más grande: el robot no es "un objeto más".

### 2.2 La caja de ORDEN = la caja de COLISIÓN (no hay caja visual de orden) ⭐⭐ (causa del bug)
El motor ordena por la MISMA `aabb` que usa la física. Para los objetos del registro coincide (huella =
colisión = sort, y el anti-#2 garantiza `foot ⊇ sprite`). **Para el robot NO**: ordena por `±PRAD`
([player.js:174](../../../src/player.js)), su caja de **colisión** (estrecha, para colarse por huecos), que **NO
envuelve su sprite** (los hombros sobresalen ~4px). → El gate de solape "pierde" oclusiones reales (robot
elevado tras un poste) → mal orden. **Invariante violada** (ver §3).
*Intentos fallidos (revertidos):* ensanchar esa caja (cuadrado ±WID, o `(WID+DEP)/2`) **arregla** el caso del
poste pero **rompe otros**: la caja ancha SOBRE-reclama la huella → interpenetra cajas vecinas (p. ej. el
robot detrás de una caja baja: al solaparse en planta, el desempate por z lo mete delante). Es el síntoma de
fondo: **un sprite que sobresale de su huella NO cabe en una sola AABB sin romper algo** (§3).

### 2.3 Pre-pase `doorHole` (vacío negro de puertas de fondo)
El negro del vano se pinta **fuera del painter**, a mano, antes de las cajas con altura
([render.js:85-86](../../../src/render.js), `AP.doorHole`) para que no tape al robot al cruzar. Es un parche que
existe porque el negro, como caja normal, ganaría el desempate. Chapuza por-asset.

### 2.4 La puerta se parte a mano en 3 piezas con clipping
La puerta es UN sprite que el render trocea en **poste-L + poste-R + dintel** con recorte de rectángulo y de
**silueta hexagonal** (`drawDoorSprite` con `half`, [draw.js:111-129](../../../src/draw.js); piezas en
[world.js:135-145](../../../src/world.js)). Es decomposición ad-hoc, hecha SOLO para la puerta.

### 2.5 La pared es un "slab largo"
Una pared de fondo es UNA caja por fila con `foot.l = 0` (plano de grosor cero,
[world.js:95-99](../../../src/world.js) `placeShellAabb`), dibujada por tiras (`flatWall`) pero **ordenada como
bloque único** → el problema del "slab largo" (#3 del assessment viejo): puede quedar a la vez detrás de un
objeto y delante de otro.

### 2.6 Dos clases de dibujo (procedural vs sprite) conviviendo
`robot`, `floor`, `shadow`, `doorHole` se dibujan **procedurales** (primitivas canvas); el resto desde
**sprite** (`AP.drawSprite`). El painter llama `AP.drawAsset` para placements, pero el robot llama `AP.robot`
por su vía. Mezcla de caminos.

### 2.7 Heurísticos de desempate y de ciclos (no canónicos)
`cmp` desempata por **centro-z** ([engine.js:129-133](../../../src/engine.js)) y los ciclos se rompen forzando
la caja de **menor grado** ([engine.js:142-144](../../../src/engine.js)). Funcionan y son deterministas, pero no
son lo canónico (partición de SCC + split). El desempate por centro-z es además quien mete al robot elevado
delante cuando falta la arista (§2.2).

### 2.8 Hardcodes sueltos
Carga del circuito estira la caja del robot a `z+2.2` a mano ([player.js:172](../../../src/player.js)); el suelo
declara un `files.svg:"example.svg"` fantasma; etc.

---

## 3. La RAÍZ (de la investigación de motores iso estándar)

Fuentes: shaunlebron *Drawing isometric boxes in the correct order*; Bannalia *Filmation math*; mazebert
*Isometric depth sorting*; Tuts+ *moving platforms*; Wikipedia *Painter's algorithm / Filmation*.

1. **La relación "está delante" es un orden PARCIAL y NO transitivo.** A delante de B y B delante de C **no**
   implica A delante de C. Por eso un `sort()` con comparador es **inválido** de raíz → hay que hacer orden
   **topológico** (ya lo hacemos). ✅
2. **LA INVARIANTE** de cualquier painter por cajas: *la caja que ordena debe ENVOLVER los píxeles que el
   sprite dibuja*. Si un sprite pinta fuera de su caja, dos objetos pueden ocluirse en pantalla sin que sus
   cajas se toquen → no se crea la arista → mal orden. (Es exactamente el anti-#2 del proyecto.) **El robot la
   viola** (§2.2).
3. **El gate de solape debe medir la SILUETA (hexágono), no el AABB de pantalla.** Tres ejes (la vertical de
   pantalla + dos diagonales) bastan y son exactos para la proyección 2:1. ✅ (ya está).
4. **Tensión del "overhang"**: un sprite **más ancho/alto que su huella** (hombros del robot, copa de una
   planta, dron que flota) **no cabe en una sola AABB** sin elegir veneno:
   - caja = huella → no envuelve el sprite → gate pierde oclusiones (bug §2.2);
   - caja = sprite → sobre-reclama la huella → interpenetra vecinos → desempate ambiguo (regresión §2.2).
   Las dos soluciones estándar para esto son **(A)** que los sprites **no sobresalgan su huella** (la huella
   ES el contorno dibujado) o **(B)** **trocear en celdas unidad** (cada trozo es 1×1×1 y el overhang vive en
   la celda que le toca).
5. **Ciclos** (3 objetos que se ocluyen en círculo): son reales pero raros. Canónico: o **ignorar** (lo que
   hizo Filmation; el DFS con `visited` ya no peta) o **partir** el grupo (Tarjan SCC + split/clip). No hace
   falta resolverlos para el bug del robot (ahí el orden NO es cíclico; solo falta la arista).

**Conclusión:** el motor (topológico + hexágono) es el correcto y estándar. Los bugs vienen de **(a)** no
respetar la invariante para el robot, **(b)** meterlo por una vía aparte, y **(c)** los parches de la cáscara
(doorHole / puerta partida a mano / slab). El refactor NO es reescribir el motor: es **uniformizar el modelo
de datos** para que TODO entre igual y cumpla la invariante.

---

## 4. El motor objetivo (genérico, sin excepciones)

### 4.1 Un único modelo de DRAWABLE para TODO
Una sola lista de `{ sortBox, draw(ctx,P) }` para suelo, pared, puerta, bloque, circuito, zócalo, **robot** y
futuros enemigos/dragones. **Se elimina la vía `entity.addDraws`**: el robot produce su `{sortBox, draw}`
exactamente igual que un placement (su posición la lleva la entidad, pero el painter no sabe que es "el
robot"). Una sola `depthSort`, un solo camino de dibujo (`drawAsset`/callback).

### 4.2 Separar SORT (visual) de COLLISION (física) en el registro
Dos cajas por asset, derivadas del registro, **default iguales** (coste cero para casi todo):
- `collision` = huella física (la actual `foot`). La usa `physics`.
- `sort`/`bounds` = caja VISUAL que **envuelve el sprite**. La usa el painter (gate + order + tiebreak).
- Para casi todos: `sort = collision = foot` (y el anti-#2 ya garantiza `foot ⊇ sprite`).
- Para el robot: `collision = ±PRAD` (gameplay: colarse por huecos), `sort =` su huella visual (envuelve los
  hombros). **El dron** (flota) y la **planta** (copa ancha) usan también un `sort` propio honesto.

### 4.3 La invariante, con guardarraíl para TODOS
Generalizar el anti-#2 a "`sort ⊇ sprite`" para todo asset (incl. entidades). El robot es **procedural** → o
se mide su silueta y se valida aparte, o (mejor a futuro) **el robot pasa a sprite/sprite-sheet** y entra en
el mismo guardarraíl de píxel que el resto.

### 4.4 Resolver el overhang (decisión de diseño — la importante)
La tensión del §3.4 hay que zanjarla con UNA regla general, no caso a caso:
- **Opción A — huellas honestas (recomendada para entidades/objetos):** que la huella de orden = el contorno
  dibujado. Para el robot: su `sort` = ancho visual (los hombros). Para que NO interpenetre vecinos, lo que
  importa es que esa caja sea su **silueta real** (ni más ni menos) y que el motor ordene por separating-axis
  sobre ella. Donde el sprite sobresale de verdad de su huella física, **la huella de orden manda** y la
  física sigue con la suya. (Esto es justo lo que el proyecto intentó para el robot pero como excepción
  suelta; aquí se hace como REGLA del modelo: todo objeto tiene `sort` visual.)
- **Opción B — trocear la cáscara (paredes/puertas) en celdas unidad:** cada celda de pared/puerta es un
  drawable 1×1 que entra al MISMO pipeline con su caja honesta. Esto **mata de golpe** las chapuzas 2.3
  (doorHole), 2.4 (puerta partida a mano) y 2.5 (slab largo): el vano, los postes y el dintel son celdas
  normales, ordenadas por el painter como todo lo demás. (Es el enfoque "decompose into cells", estándar en
  motores de tile.)
- **Recomendación:** A para objetos/entidades (cada uno con su `sort` visual honesto) **+** B para la cáscara
  (trocear pared/puerta por celda). Así no queda NINGÚN camino especial: ni `entity.addDraws`, ni pre-pase
  `doorHole`, ni split manual de puerta, ni slab.

### 4.5 Ciclos
DFS con `visited` (ignorar, como ahora) de momento. Dejar documentado el upgrade a **Tarjan SCC + split**
para cuando aparezca un ciclo real visible (no es el caso del bug del robot).

### 4.6 Lo que se ELIMINA al terminar
`player.addDraws` como vía especial · pre-pase `doorHole` · `drawDoorSprite` con `half`/clipping · el slab de
pared · el hardcode `z+2.2` (pasa a ser el `sort` de la entidad con carga). El motor (`engine.depthSort`) casi
no cambia: solo ordena por `sort` en vez de por `aabb`; la física sigue con `collision`.

---

## 5. Plan por fases (cada fase: `npm test` verde + verificación visual)

1. **Modelo de datos `sort` ≠ `collision`** (sin cambiar comportamiento todavía): añadir `sort`/`bounds` al
   registro (default = `foot`); `world.roomThings`/`roomShell` emiten DOS cajas por placement; `render`
   ordena por `sort`, `physics` usa `collision`. Generalizar el guardarraíl a `sort ⊇ sprite`. (Para todo
   coincide → 0 cambios visuales; valida que el oráculo sigue verde con la doble caja.)
2. **El robot, uniforme**: el robot produce `{sort, draw}` por el mismo camino que un placement (matar
   `entity.addDraws` como excepción). `collision = ±PRAD`, `sort =` su silueta visual honesta. Verificar el
   bug del poste Y que NO interpenetra cajas vecinas (escena de CRUCE). Igual para dron/planta.
3. **Trocear la cáscara por celda** (pared/puerta): cada celda un drawable normal. Eliminar `doorHole`
   pre-pase, el split manual de puerta y el slab. Verificar cruces de puerta (oclusión del robot entre
   postes y bajo el dintel) sin parches.
4. **Limpieza**: quitar hardcodes (carry, `example.svg` fantasma), unificar drawers, revisar `cmp`/ciclos.
5. **(Opcional, futuro)** robot a sprite/sprite-sheet → entra en el guardarraíl de píxel como el resto; o
   Tarjan SCC si aparece un ciclo real.

---

## 6. Lo que NO se toca
La proyección 2:1, la SSOT de assets, la arquitectura **topológica + hexágono** (es la estándar correcta), el
oráculo de fuzz. **Nunca** volver a un `sort()` con comparador (la relación no es transitiva). **Nunca** un
cálculo de orden ramificado por tipo de objeto.

## 7. Progreso y HALLAZGO CLAVE

**Hecho (2026-06-28), genérico y validado:**
- **Desempate `cmp` estandarizado** ([engine.js](../../../src/engine.js)): de "centro-z primero" a **profundidad
  x+y (atrás→adelante), altura z secundaria** — el desempate iso canónico. `cmp` solo decide pares SIN arista,
  nunca contradice la oclusión inequívoca. Oráculo de fuzz (30k) verde.
- **Pared troceada por tile** ([world.js](../../../src/world.js) `roomShell`): cada tramo de muro es una caja
  LOCAL, no un slab de toda la fila (§2.5 resuelto). `npm test` 42/42.

**HALLAZGO CLAVE (lo que invalida §4.2 tal como estaba escrito):** intenté dar al robot una caja de ORDEN
**más ancha** que su colisión (= su silueta/huella, para que envolviera el sprite). **NO funciona** y se
revirtió. Demostrado empíricamente: como el robot se DIBUJA más ancho (hombros ±WID=0.5) que su COLISIÓN
(±PRAD=0.32), CUALQUIER caja de orden que envuelva el sprite **sobresale del cuerpo real del robot**; cuando
está pegado a una pared/caja, esa caja cruza **al otro lado** (p. ej. x<0, tras la pared) → el motor lo
ordena DETRÁS. Es decir: **un objeto cuyo sprite es más ancho que su huella de colisión NO se puede ordenar
con UNA sola caja** (envolver el sprite → sobresale e interpenetra vecinos; ceñir al cuerpo → pierde
oclusiones). Esto causó los bugs de "robot tras pared/caja"; revertir a ±PRAD los quitó (pero devuelve el bug
del poste).

**RESUELTO (2026-06-28) — robot = objeto uniforme:** se reconcilió **dibujo = colisión = orden** del robot en
**UNA sola caja**, definida por `ROBOT.WID` (semiancho de hombros). `CFG.PRAD = ROBOT.WID` ([config.js](../../../src/config.js)),
y `player.addDraws` ordena por esa misma ±PRAD. Como colisión = orden, la caja **nunca cruza** al otro lado de
una pared/caja (la colisión lo impide) → **sin overhang**. `WID` se ajustó a **0.35** (un pelín más fino que el
dibujo original de 0.5) para que el robot, ya más "gordo" que el viejo radio de colisión 0.32, **siga cabiendo
holgado por las puertas** (ventana de cruce ~0.45 celdas) sin tocar el arte de la puerta. Resultado: el robot
pasa por el painter **como un objeto más**, sin código por tipo, y **TODOS** los bugs de orden (poste, pared,
caja, en cualquier sala incl. CONDUCTO) desaparecen. Validado: 0 mis-orders en barrido de sala, ventana de
puerta cómoda, `npm test` 42/42. Las ideas [idea-robot-huella-cuadrada.md](idea-robot-huella-cuadrada.md)
(unificar la huella) y el caso "robot" de [idea-motor-bounds-visuales.md](../idea-motor-bounds-visuales.md) quedan
así **resueltas**.

**Drawer de la PUERTA unificado (2026-06-28):** las 3 piezas de la puerta (poste L, poste R, dintel) recortan
ahora el sprite a la **silueta hexagonal de SU caja** (`drawDoorSprite`, [draw.js](../../../src/draw.js)) — el
mismo mecanismo que ya usaba el dintel. Antes los postes se recortaban por el **centro del vano** (`Xc`), y en
la puerta del eje y (espejada, `scale(-1,1)`) ese corte + el espejo descuadraban qué poste se dibujaba en cada
mitad → el poste cercano salía con el orden del lejano → robot "delante del marco" SOLO en la puerta derecha.
Con el recorte por silueta, cada pieza dibuja su trozo en su caja, independiente del espejo → arreglado.
Validado: orden 0 mis-orders, test por hexágono 0 píxeles del robot sobre el poste dcho.

> **Actualización posterior (2026-06-28): la pieza `doorHole` del painter se ELIMINÓ del todo.** El cuadro negro
> se dibujaba en el plano y=0 mientras el sprite de la puerta de fondo retrocede −T → desalineado ~3px, "mordía"
> el marco (bug "pegote"). Ahora el vano del sprite (transparente) deja ver el fondo negro del canvas con la forma
> exacta del hueco; el robot cruza siempre por y>0 (delante), así que no hace falta pieza en el painter. Lo de
> abajo queda como histórico.

**Fase 3 — HECHA (2026-06-28): pre-pase `doorHole` eliminado.** El vacío negro del vano de las puertas de
FONDO ya NO se pinta a mano antes del painter: se emite como una **pieza más de la cáscara** (`world.roomShell`,
`half:"hole"`, caja inset en y<0/x<0, alto bajo el dintel, **no sólida**) y entra al `depthSort` como todo lo
demás. El nuevo `cmp` (x+y) lo ordena SOLO detrás del robot (que está en y>0) → ya no hace falta el truco de
"pintar al fondo primero". `render.js` queda con **un único** pre-pase legítimo: el **suelo** (z=0, que nunca
ocluye). Validado: el vacío se ordena detrás del robot al cruzar (en las 3 posiciones de cruce), se ve el negro
por la puerta y el robot se pinta encima; `npm test` 42/42. Se limpiaron además los imports muertos de
`render.js` (`WALL_H`, `doorSpan`).

**Estado del motor:** uniforme. Solo el suelo (z=0) es backdrop; TODO lo que tiene altura —pared (troceada por
celda), puerta (postes + dintel + vacío), objetos, zócalos y robot— entra al MISMO `depthSort` como `{caja,
draw}`, ordenado por separating-axis + silueta hexagonal + topológico, sin código por tipo ni pre-pases de
oclusión. La puerta se emite en piezas (no es un slab → no necesita trocearse más). **Refactor completo.**
