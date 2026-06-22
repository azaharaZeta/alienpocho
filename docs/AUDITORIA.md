# AUDITORÍA TÉCNICA — *Alien Pocho*

> Evaluación técnica independiente del **código fuente** (la doc se contrasta, no se asume).
> Foco prioritario pedido por la usuaria: **(1) motor isométrico** y **(2) assets isométricos**;
> además, barrido de todo el proyecto buscando errores **funcionales, técnicos, de performance**
> y posibles mejoras.
>
> Fecha: 2026-06-22 · Alcance del JUEGO: `src/` + `assets/` + `test/`. **`tools/` NO es el juego**
> (utillaje de desarrollo de la usuaria, no se publica; ver [`docs/ASSETS.md`](ASSETS.md)); se menciona
> solo como herramienta de autoría de assets, no como funcionalidad del juego.
> Método: lectura completa del código, ejecución de `npm test` (13/13 ✓), **regeneración de los
> generadores de assets para detectar deriva**, y **reproducción empírica del comportamiento del
> painter con scripts** (los resultados se citan literalmente). Esta auditoría NO modifica código.

---

## 0. Veredicto en una página

El refactor de arquitectura (ES modules, separación motor/datos/simulación/presentación, fuente
única de geometría) está **bien hecho y vigente** — lo que documenta `ASSESSMENT.md` se corresponde
con el código real. El problema **no es de organización**, es de **dos subsistemas concretos**:

1. **Motor isométrico — el painter `depthSort` es la pieza débil, y la sospecha de la usuaria es
   correcta.** La *proyección* iso (2:1) es impecable. Lo que falla es el **orden de pintado**:
   el algoritmo es un *separating-axis* jerárquico con *gating* por solape en pantalla y un
   *topological sort* que **NO detecta ciclos**. **He reproducido ciclos reales** entre cajas que
   **sí** se solapan en pantalla — incluida una configuración **realista de juego** (robot subido a
   un bloque + objeto + bloque adyacente). En esos casos el resultado **depende del orden de entrada**
   y **viola un "detrás" real** → exactamente el síntoma reportado ("lo lejano tapa lo cercano en
   algunas circunstancias"). No es "espagueti", pero sí un algoritmo **heurístico con fallos
   demostrables**, y los comentarios que lo defienden como "robusto" son optimistas.

2. **Assets isométricos — la sospecha es correcta a medias.** Las **coordenadas/tamaños de los
   sprites migrados son CONSISTENTES** (verifiqué que `SPRITES`/`WALL_TILES`/`DOOR_TILES` coinciden
   exactamente con lo que emiten los generadores, y el anclaje `ref+(minX,minY)` es correcto). Lo que
   está mal es otra cosa: **(a)** hay **deriva** — `cube.svg` versionado **no coincide** con lo que
   hoy dibuja `AP.cube` (le faltan los chaflanes), y **no existe ningún guardarraíl** que lo detecte;
   **(b)** los **dos métodos que conviven divergen** — la pared en SVG usa hexágonos *pointy-top* y el
   *fallback* vectorial (`honeycomb`) usa *flat-top*, así que la pared **cambia de forma** al cargar el
   sprite; **(c)** solo `cube` tiene PNG curado a mano: el resto son **auto-trazados** del vector
   (placeholders), y varios assets (`spikes`, `plant`, `drone`, `pillar`) **no los usa ninguna sala**.

3. **El resto del proyecto está sano**, con cabos sueltos menores: **18 de 21 colores de `CFG.COL`
   están muertos**, `roomSolids()` se **re-asigna en cada llamada** (varias por frame), y los tests
   **no cubren el render ni el caso de ciclo** del painter.

**Recomendación de cabecera:** no reescribir el proyecto. **Sí** intervenir el painter (es la causa
del problema #1 y, por herencia, de parte del #2) y **sanear el flujo de assets** con un guardarraíl
de deriva y unificación de los dos métodos. Detalle y plan abajo.

Etiquetas de severidad: 🔴 crítico · 🟠 alto · 🟡 medio · 🟢 bajo · ✅ correcto (preservar).

---

## 1. Motor isométrico

### 1.1 Lo que está BIEN (✅ — no tocar)

- **Proyección iso 2:1 correcta.** [`engine.js:32-36`](../src/engine.js) — `p(x,y,z) = (ox+(x−y)·TW/2,
  oy+(x+y)·TH/2 − z·BH)` con `TW=34, TH=17, BH=17`. Es la proyección dimétrica clásica, bien
  parametrizada y compartida por dibujo y lógica (`POPT`). **La "perspectiva" en sí no está rota.**
- **El AABB de pantalla del painter es correcto.** [`engine.js:150-156`](../src/engine.js) — los
  extremos de la caja proyectada caen en las esquinas opuestas; verificado a mano y por script.
- **El *gating* por solape en pantalla es una buena idea** [`engine.js:157-165`](../src/engine.js):
  evita crear aristas entre cajas que no se tapan, lo que elimina la **mayoría** de los ciclos
  espurios. (Pero no todos — ver 1.2.)
- **El proyector se recentra por sala** ([`view.js:30-37`](../src/view.js)) y mantiene el encuadre en
  salas rectangulares. Correcto.

### 1.2 🔴 M1 — `depthSort` puede generar CICLOS entre cajas que se solapan en pantalla → oclusión incorrecta silenciosa

Es **la causa raíz del síntoma reportado**. El comparador [`engine.js:132-147`](../src/engine.js) es un
*separating-axis* **jerárquico** (primero x, luego y, luego z): devuelve un orden en cuanto encuentra
**un** eje que separa las cajas. Eso significa que solo devuelve "sin relación" (`0`) cuando las cajas
se interpenetran en los 3 ejes; en cualquier otro caso da una dirección. Con 3+ cajas, esas direcciones
**pueden formar un ciclo** (A detrás de B, B detrás de C, C detrás de A).

El comentario [`engine.js:124-128`](../src/engine.js) afirma que el *gating* por pantalla evita los
ciclos. **Es falso en general.** Buscando por fuerza bruta encontré ciclos en los que **las tres cajas
SÍ se solapan en pantalla** (luego el *gating* no las descarta). Ejemplo reproducido:

```
A x[2,5] y[2,5] z[1,3]
B x[0,3] y[3,4] z[4,5]
C x[0,2] y[4,7] z[2,3]
order(A,B)=−1  order(B,C)=−1  order(C,A)=−1   → ciclo A<B<C<A, y las 3 solapan en pantalla
depthSort([A,B,C]) → A>B>C      depthSort([C,A,B]) → C>A>B   (¡depende del orden de entrada!)
```

Y lo más importante para este juego: **el ciclo aparece con geometría realista**. Reproducido con
cubos unidad (1×1×1), un robot (huella ±0.32, alto 1.5) y un objeto suelto (±0.28, alto 0.5):

```
Bloque  x[3,4] y[3,4] z[0,1]      (suelo)
Robot   x[2.63,3.27] y[2.9,3.54] z[1,2.5]   (subido a un bloque, asomado al borde)
Objeto  x[2.44,3] y[3.56,4.12] z[1,1.5]     (circuito en alto)
order = [−1,−1,−1]  → ciclo. depthSort → Bloque>Robot>Objeto ; con otra entrada → Objeto>Bloque>Robot
```

Esta configuración (robot encima de un bloque + objeto en alto + bloque vecino) es **justo la mecánica
de apilar/subirse que la usuaria quiere conservar**. Por eso el fallo se ve "en algunas circunstancias":
al moverse el robot, entra y sale de estas configuraciones y la oclusión **salta**.

### 1.3 🔴 M2 — El *topological sort* NO detecta ciclos (degradación silenciosa y no determinista)

[`engine.js:166-170`](../src/engine.js): el DFS marca `state` 0/1/2 y empuja en post-orden, pero **no
trata las back-edges**. Si hay un ciclo, no avisa ni lo rompe de forma controlada: simplemente produce
**un** orden arbitrario que **viola al menos una arista** "detrás". Consecuencias:

- El resultado **depende del orden en que se insertan las cajas** en `render.js` (ver 1.6) → el mismo
  fotograma podría pintarse distinto si cambiara el orden de inserción; y configuraciones casi idénticas
  (el robot 1 px más allá) pueden caer en distinto orden → **parpadeo/pop**.
- No hay forma de saber, desde el código, que el orden devuelto es inconsistente. Es un fallo **mudo**.

### 1.4 🟠 M3 — Caja AABB ÚNICA para objetos extensos o no convexos

El painter ordena **una caja por objeto**. El *separating-axis* sobre AABBs solo es exacto si los
objetos son **convexos y separables por un eje**. Dos casos reales lo rompen:

- **Puerta del frente como una sola losa** [`render.js:69-76`](../src/render.js): el marco entero
  (vano incluido) entra como **una** caja a lo ancho del muro. El truco "se intercala solo"
  [`render.js:68`](../src/render.js) funciona cuando el robot está claramente delante/detrás, pero
  cuando está **a medio cruzar** (su huella parte el plano de la puerta) no hay separación por ejes y
  el orden cae en el desempate → el poste puede taparlo o no de forma inestable.
- **Objetos en "L" / muros largos**: cualquier figura que envuelva a otra no se puede ordenar con un
  solo AABB. Hoy no hay salas en "L", pero `PENDIENTES.md` lo contempla; conviene saberlo antes.

### 1.5 🟢 M4 — Caja de orden del robot más estrecha que su dibujo — **REVISADO: NO es bug (2026-06-22)**

Diagnóstico inicial (análisis estático): la caja de profundidad usa la huella de colisión `±PRAD = ±0.32`
([`player.js:169-186`](../src/player.js)) mientras el robot se dibuja más ancho (torso `±0.50`, brazos
`~0.535`, antena ~7 px sobre el techo `z+1.5`), así que parecía que hombros/brazos se ocluirían mal.

**Al REPRODUCIRLO en el navegador, no se sostiene.** La caja estrecha es **correcta y necesaria**:
- La **colisión** garantiza que la huella del robot NUNCA solapa la de un bloque → `order()` los separa
  sin ambigüedad y, como el robot se dibuja **como una sola pieza** a su profundidad correcta, el voladizo
  de los hombros sale bien contra el bloque adyacente (verificado: robot delante y detrás de un bloque).
- **Ensanchar la caja a la silueta (±0.50) ROMPE el orden**: la caja ancha interpenetra el bloque de
  delante → par ambiguo → desempate por centro-Z → el robot (más alto) gana el frente y se pinta sobre un
  bloque que está delante (reproducido). Por eso la caja estrecha es deliberada y debe quedarse así.
- La **antena** (única parte realmente fuera de la caja, en z) es inofensiva hoy: para ocluirse mal haría
  falta algo *encima* del robot (drones/techos) que aún no existe. Decisión: el robot es un TODO (caja +
  brazos); no se ensancha ni se parte en sub-cajas. Si llegan elementos elevados, subir solo el techo de
  la caja a `≈ z+1.95` (cambio de 1 línea, sin efecto en la separación horizontal).

### 1.6 🟡 M5 — Orden de inserción y desempates

El orden de las cajas que entran al painter está fijado en [`render.js:42-76`](../src/render.js)
(bloques → hazards → zócalos → objetos → entidades → puertas del frente). Como el topo-sort no es
estable ante ciclos (M2), ese orden de inserción **influye en el resultado** en los casos
problemáticos. El desempate final del comparador [`engine.js:142-146`](../src/engine.js) (por centro Z,
luego por profundidad) es razonable para empates *exactos*, pero no resuelve los ciclos de 1.2.

### 1.7 Recomendaciones para el motor

Tres niveles, de menor a mayor ambición (no excluyentes):

- **(A) Parche robusto y barato (bajo riesgo):**
  1. **Detectar ciclos** en el topo-sort (estados gris/negro; al hallar una *back-edge*, romper la
     arista "más débil" — p. ej. la de menor diferencia de profundidad — de forma determinista). Con
     esto el painter deja de ser mudo y se vuelve **estable**.
  2. **Igualar la caja de orden del robot a su silueta** (o, mejor, **dividir el robot en sub-cajas**:
     torso, cada brazo, cada pie, cabeza). Resuelve M4 sin tocar la colisión.
  3. **Partir la puerta del frente en sus piezas** (2 postes + dintel como cajas independientes, igual
     que ya hace el *fallback* vectorial), en vez de una losa única. Resuelve M3 para puertas.

- **(B) Descomposición en sub-cajas convexas (recomendado):** que **todo** lo que entra al painter sean
  cajas pequeñas, convexas y aproximadamente unitarias. Los bloques ya se parten por capa
  ([`render.js:46-50`](../src/render.js)); aplicar el mismo criterio al robot y a las puertas hace que
  el *separating-axis* + *gating* sea **fiable casi siempre** (los ciclos requieren solapes 3D que con
  piezas convexas pequeñas casi no ocurren). Bajo-medio riesgo, alto retorno.

- **(C) Orden canónico por celda (la solución "de libro" para iso de rejilla):** como casi todo vive en
  una rejilla, ordenar por celda con la regla canónica iso (de atrás a delante por `x+y`, y dentro de
  la celda por `z`), tratando las entidades continuas por su celda/esquina máxima. Para cajas unitarias
  es **demostrablemente correcto** y O(n log n). Es un rediseño del painter, pero el juego es pequeño y
  encaja con la rejilla actual. Reservar para si (A)+(B) no bastan o si llega el roguelike/salas en "L".

> En cualquier caso, **mantener `engine.js` como motor genérico** y **añadir un test de invariante**
> del painter (ver 5.3) antes de tocarlo, como ya hace la red de seguridad para la física.

---

## 2. Assets isométricos

### 2.1 Lo que está BIEN (✅)

- **El flujo SVG/PNG está bien diseñado.** Generadores deterministas desde las funciones reales
  (`gen-svg`/`gen-walls`/`gen-doors`), teñido por *multiply* equivalente a `darken`, anclaje por bbox,
  *fallback* a vector si el sprite no cargó o no hay DOM (Node/tests). Es un buen sistema para que
  ambos métodos convivan, como pide la usuaria.
- **Las coordenadas y tamaños de los sprites migrados son CORRECTOS.** Regeneré los tres generadores y
  los registros coinciden **exactamente** con las constantes versionadas:
  `SPRITES` ([`assets.js:38-44`](../src/assets.js)), `WALL_TILES` ([`assets.js:80-83`](../src/assets.js))
  y `DOOR_TILES` ([`assets.js:125-128`](../src/assets.js)). El anclaje `ref+(minX,minY)` y el teselado
  cizallado de la pared (paso por tesela = 1 celda iso) son matemáticamente correctos. **La sospecha de
  "tamaños/coordenadas mal" no se confirma para los sprites migrados.**

### 2.2 🟠 A1 — Deriva de assets: `cube.svg` no coincide con el código, y no hay guardarraíl

Al ejecutar `node tools/gen-svg.mjs`, **solo `cube.svg` cambió** respecto a lo versionado: al
`cube.svg` del repo **le faltan los 4 chaflanes** ("bordes mordidos") que `AP.cube` sí dibuja hoy
([`assets.js:166-179`](../src/assets.js)). Es decir, el SVG versionado es **una versión vieja** del
cubo. Como en juego el cubo usa el PNG editado a mano (`assets/png/cube.png`, único PNG que existe), el
SVG obsoleto **solo se vería si faltara el PNG** — pero el problema de fondo es que **nada garantiza que
los SVG estén en sync** con `assets.js`. Es deriva silenciosa esperando a morder.

> **Fix:** test de "no-deriva" que ejecuta los generadores en un dir temporal y falla si difieren de los
> versionados (ver 5.3). Y regenerar `cube.svg` ahora.

### 2.3 🟠 A2 — La pared tiene un fallback procedural que NO coincide con su imagen

Al dibujar la pared, `flatWall()` ([`assets.js`](../src/assets.js)) tiene dos caminos en RUNTIME:
- **Vía buena**: blittea el tile de imagen `assets/svg/wall1.svg` (PNG→SVG) teselado a lo largo del muro
  (`fillWall`). El juego solo pega la imagen.
- **Fallback residual**: si la imagen no ha cargado (primeros frames, o si fallara), cae a `honeycomb()`
  ([`engine.js:89-90`](../src/engine.js)), que dibuja un panal **distinto** al de la imagen (otra
  orientación de hexágono y un radio `p.TW·0.40` sin relación con el de la imagen).

Resultado: la pared arranca con el panal del *fallback* y **salta** al de la imagen al cargar → **pop
visual** (y queda en el fallback equivocado si la imagen fallara). El `honeycomb` procedural es la 3ª vía
residual (ver [`docs/ASSETS.md`](ASSETS.md)). **Fix recomendado**: que la pared use SOLO la imagen
(PNG→SVG) — precargar la textura al arrancar y quitar el `honeycomb` del runtime — en vez de mantener dos
dibujos del mismo muro. (Cómo se genera la imagen es cosa de la tool, fuera del juego.)

### 2.4 🟡 A3 — Solo `cube` está curado; el resto son auto-trazados, y varios no se usan

- `assets/png/` contiene **un único PNG**: `cube.png`. Los demás migrados (`prop_cube`, `prop_pyramid`,
  `spikes`, `plant`) caen a su **SVG auto-trazado** del vector — fieles, pero **placeholders** sin
  retoque artístico. "Los assets no están todos bien definidos" = en gran parte esto.
- **Assets sin uso en ninguna sala** (`data/rooms.js`): `AP.spikes` está cableado en
  [`render.js:52-54`](../src/render.js) pero **ninguna sala define `hazards`**, así que nunca se dibuja;
  y `AP.plant`, `AP.drone`, `AP.pillar` no los referencia el render (solo el catálogo). Son **assets de
  escaparate**. Conviene decidir: usarlos o marcarlos explícitamente como "demo".

### 2.5 🟡 A4 — La oclusión de los sprites hereda el bug del painter

El anclaje del sprite es correcto (2.1), pero el sprite ocupa **la misma caja de orden** que el vector,
así que **arrastra M1/M3/M4**: un sprite migrado se ocluirá mal exactamente en los mismos casos que el
vector. Mejorar el dibujo del asset **no** arregla la perspectiva; eso es del painter (sección 1). Es
importante no confundir los dos frentes: **assets ≠ oclusión**.

### 2.6 🟢 A5 — Costuras de 1 px en el teselado de pared

[`assets.js:111-116`](../src/assets.js) tesela con `Math.round` sobre un anclaje que avanza en pasos
de medio píxel (la cizalla iso sube 8.5 px por tesela). El redondeo alterna y puede dejar **costuras de
1 px** entre teselas. Menor; se mitiga dibujando la pared completa a un *canvas* offscreen una vez por
sala (lo que `PENDIENTES.md` ya anota como mejora de cache).

### 2.7 🟢 A6 — Cubos apilados = dos sprites con costura intermedia

Un bloque de `h:2` se pinta como **dos sprites de cubo** apilados ([`render.js:46-50`](../src/render.js)),
así que aparece una **línea de contorno negra a media altura**. Si se busca un bloque alto "de una
pieza", haría falta un sprite por altura o dibujar solo las caras externas. Estético; puede ser
intencional.

---

## 3. Otros hallazgos por capa (funcional / técnico)

### 3.1 Física (`physics.js`)

- 🟡 **T1 — `roomSolids(room)` re-asigna un array nuevo en CADA llamada** ([`physics.js:46-58`](../src/physics.js))
  y se llama **varias veces por frame**: `blocksHoriz` ([:75](../src/physics.js)), `supportHeight`
  ([:84](../src/physics.js), y otra vez en `player.addDraws` [:179](../src/player.js)), `canStandOn`,
  `objBlocked`, y `objSupport` **por cada objeto** en `updateObjects`. Además crea un `objBox` por
  objeto en cada una. A la escala actual es inocuo, pero es **basura por frame** evitable: construir
  `roomSolids` **una vez por frame** y pasarlo. Ver 4 (performance).
- ✅ La separación física pura sobre `room` (sin jugador) está bien planteada y es testeable.
- 🟢 `STEP = 0.08` como altura "salvable andando" y el empuje en plano son coherentes; sin observaciones
  funcionales.

### 3.2 Estado y reglas (`game.js`)

- 🟢 **T2 — `game.lightYears`** se actualiza cada frame ([`main.js:52`](../src/main.js)) pero **no se
  muestra** y no afecta a nada (cosmético, ya anotado en `PENDIENTES.md`). Código vivo sin efecto.
- ✅ `interact`, `checkExits` y `resetGame` están cubiertos por tests y son correctos; `makeRoom` clona
  los arrays mutables (sin fuga de estado entre partidas) — verificado por el test de reset.

### 3.3 Configuración (`config.js`)

- 🟠 **T3 — 18 de 21 claves de `CFG.COL` están MUERTAS.** Solo se usan `bg` (2×) y `hud` (2×). Sin uso:
  `floorLine, floorFill, floorFill2, top, left, right, edge, shadow, botTop, botLeft, botRight,
  botDark, botEdge, hudDim, hudBright, roomName, accent, accentDim` ([`config.js:26-45`](../src/config.js)).
  Son **restos del modelo de color pre-refactor** (rampa de 3 tonos). Los assets tiñen con
  `darken(col,·)` y el suelo usa literales (`"#020303"`). Limpiarlas reduce ruido y confusión.

### 3.4 Render / HUD (`render.js`)

- 🟢 **T4 — El suelo se pinta celda a celda cada frame** ([`render.js:31-33`](../src/render.js)) con un
  `poly` por baldosa. Correcto (z=0 nunca ocluye, pre-pase), pero candidato a cache offscreen junto con
  las paredes si crece el tamaño de sala.
- ✅ HUD/minimapa: lógica de anclaje por triángulo y plano cenital correcta y autocontenida.

### 3.5 Entrada, vista, pantallas, main

- ✅ `input.js`/`view.js` difieren el DOM a `init*()` (permite tests en Node) — respetado.
- 🟢 **T5 — `assets-demo.html`** reimplementa parte del pipeline de render (no usa `ENGINE.depthSort`,
  dibuja vistas sueltas). Es un catálogo, no el juego, así que **puede divergir** de cómo se ve en
  partida (sobre todo en oclusión). Útil, pero no es oráculo fiel.

---

## 4. Performance

A la escala actual (1 jugador, pocas cajas por sala, 320×240) **no hay problema de rendimiento
percibible**. Notas para cuando crezca (roguelike, más objetos/enemigos):

| Punto | Coste hoy | Cuándo importa | Acción |
|---|---|---|---|
| `roomSolids()` re-alloc por llamada (T1) | ~3-5 arrays/frame + `objBox` | Muchos objetos/entidades | Construir 1×/frame y compartir |
| `depthSort` O(n²) construyendo adyacencia | Trivial (n pequeño) | n de cajas alto | Bucketing por celda (opción 1.7-C) |
| Suelo + paredes redibujados cada frame (T4/A5) | 1 `poly`/baldosa | Salas grandes | Cache offscreen por sala (ya en `PENDIENTES`) |
| Teñido de sprites/paredes | Cacheado por color ✅ | — | OK (máx 6 paletas) |

Ningún punto es urgente; el más "gratis" es T1.

---

## 5. Pruebas y guardarraíles

### 5.1 Lo que hay (✅)
`test/smoke.mjs` (13/13) cubre mundo, física, transición de salas, coger/colocar, gravedad de objetos y
no-fuga de estado en reset. Buen oráculo de no-regresión para la **lógica pura**.

### 5.2 Huecos
- **No se prueba el painter en su caso difícil.** El único test de `depthSort`
  ([`smoke.mjs:66-74`](../test/smoke.mjs)) usa 2 cajas trivialmente separadas. **No** hay test de
  ciclo, de no-determinismo ni de invariante de oclusión.
- **No se prueba la deriva de assets** (A1). Nada falla cuando el SVG versionado se queda viejo.
- **No se prueba el render** (lógico: necesita canvas), pero sí se puede testear el **contrato del
  painter** sin dibujar.

### 5.3 Guardarraíles recomendados (orden de retorno)
1. **Test de deriva de assets:** ejecutar los generadores a un tmp y `assert` de igualdad con
   `assets/svg/*`. Mata A1 para siempre.
2. **Test de invariante del painter:** para una lista de cajas, comprobar que el orden devuelto **no
   viola ninguna arista "detrás" entre cajas que se solapan en pantalla**; y que es **determinista**
   ante permutación de la entrada. Con esto, cualquier intervención del motor (sección 1) se hace con
   red.
3. (Tras el fix) **Casos de regresión** con las configuraciones de ciclo reproducidas en esta auditoría.

---

## 6. Tabla priorizada

| ID | Sev. | Área | Problema | Acción sugerida |
|---|---|---|---|---|
| **M1** | 🔴 | Motor | `depthSort` cicla con cajas que solapan en pantalla (reproducido, incl. caso realista) | Painter robusto (1.7 A/B/C) |
| **M2** | 🔴 | Motor | El topo-sort no detecta ciclos → orden mudo y no determinista | Detección + rotura determinista de aristas |
| **M3** | 🟠 | Motor | Caja AABB única para puerta-losa / objetos no convexos | Partir en sub-cajas convexas |
| **M4** | 🟢 | Motor/Assets | ~~Caja de orden del robot < silueta~~ — **REVISADO: NO-BUG** (ver §1.5) | Ninguna: la caja estrecha es correcta; ensancharla rompe el orden |
| **A1** | 🟠 | Assets | `cube.svg` derivado del código; sin guardarraíl | Regenerar + test de no-deriva |
| **A2** | 🟠 | Assets | Pared SVG (pointy-top) ≠ fallback `honeycomb` (flat-top) | Unificar orientación/radio |
| **T3** | 🟠 | Config | 18/21 `CFG.COL` muertos | Eliminar claves sin uso |
| **A3** | 🟡 | Assets | Solo `cube` curado; `spikes/plant/drone/pillar` sin uso real | Curar o marcar como demo |
| **A4** | 🟡 | Assets | Sprites heredan el bug de oclusión del painter | (se resuelve en sección 1) |
| **M5** | 🟡 | Motor | Orden de inserción influye en casos de ciclo | (se resuelve con M2) |
| **T1** | 🟡 | Perf | `roomSolids()` re-alloc por llamada | Construir 1×/frame |
| **T2** | 🟢 | Reglas | `lightYears` vivo sin efecto | Mostrarlo o quitarlo |
| **A5/A6** | 🟢 | Assets | Costuras 1 px en pared / línea media en cubos apilados | Cache offscreen / sprite por altura |
| **T4/T5** | 🟢 | Render | Suelo redibujado cada frame · catálogo no usa el painter real | Cache · alinear demo |

---

## 7. Plan recomendado (bajo riesgo, por bloques)

1. **Red de seguridad primero** (5.3-1 y 5.3-2): test de no-deriva de assets + test de invariante del
   painter. Sin esto, tocar el motor es a ciegas.
2. **Motor — parche (A):** detección de ciclos en el topo-sort + puerta en piezas. Resuelve M1/M2/M3 con
   riesgo bajo. Verificar con los tests del paso 1. (M4 quedó descartado: la caja del robot NO se toca.)
3. **Assets — saneado:** regenerar `cube.svg`, unificar el panal (A2), decidir destino de los assets sin
   uso (A3). Limpiar `CFG.COL` (T3).
4. **(Opcional, si hace falta más)** Motor — descomposición plena en sub-cajas (B) o rediseño a orden
   canónico por celda (C), de cara al roguelike/salas en "L".
5. **Performance** (T1) cuando se note, no antes.

**Lo que NO recomiendo:** reescribir el proyecto ni el motor desde cero. La proyección, la arquitectura
y la lógica de juego son sólidas; el daño está localizado en el **orden de pintado** y en el **flujo de
assets**, y ambos se arreglan por partes con guardarraíles.

---

### Anexo — Verificaciones realizadas para esta auditoría
- `npm test` → 13/13 ✓.
- Regeneración de `gen-svg.mjs` / `gen-walls.mjs` / `gen-doors.mjs`: registros == constantes en
  `assets.js`; **única deriva: `cube.svg`** (restaurado tras comprobar; árbol de git limpio).
- Reproducción del ciclo del painter (cajas genéricas y geometría realista de juego) con scripts ad-hoc;
  resultados citados literalmente en 1.2.
- Auditoría de uso de `CFG.COL.*` y de los assets por sala (`data/rooms.js`).
