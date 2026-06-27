# Assessment — Motor isométrico

Estado del motor iso (proyección + orden de pintado) y **ruta de mejora** sin parches.
Complementa [ARQUITECTURA.md](../ARQUITECTURA.md) (cómo está montado) y el GDD (qué se quiere).

## Veredicto

**No es un motor en precario ni espagueti.** La base es la correcta "de libro": orden por
*separating-axis* + **orden topológico (Kahn)** con desempate determinista y rotura de ciclos, todo
cubierto por un oráculo de fuzz de 30k escenas (`test/painter.mjs`). Eso es justo lo que recomiendan las
guías serias; el listón del comparador ingenuo `cmp(a,b)` (que rompe a casi todos los motores caseros) ya
está superado.

Los bugs de profundidad **no vienen de la arquitectura**, vienen de **3 huecos concretos y acotados** en
cómo el painter mide el solape y qué caja ordena. Conclusión operativa: **refinar el núcleo, no
reescribirlo.** Un rewrite tiraría una base sana.

## Contraste con el estado del arte

Referencia canónica del problema: [shaunlebron — *Drawing isometric boxes in the correct
order*](https://shaunlebron.github.io/IsometricBlocks/) ([HN](https://news.ycombinator.com/item?id=12309863));
también [Isometric Depth Sorting (mazebert)](https://mazebert.com/forum/news/isometric-depth-sorting--id775/)
y [Isometric Depth Sorting for Moving Platforms (tuts+)](https://gamedevelopment.tutsplus.com/tutorials/isometric-depth-sorting-for-moving-platforms--cms-30226).

| Concepto | Guía canónica | Motor actual |
|---|---|---|
| Relación delante/detrás | Separación por eje (x,y menor = más cerca; z mayor = más cerca); 1er eje que separa decide | ✅ Idéntico (`engine.js` `order()`) |
| Orden global | Grafo "está-detrás" + **orden topológico** | ✅ Kahn determinista (`engine.js`) |
| Test de **solape en pantalla** | **Silueta = hexágono** (3 ejes) | ❌ **AABB de pantalla** (2 ejes) (`engine.js` `overlapScr`) |
| Ciclos reales | Detectar SCC (Tarjan) y **partir/clipar** | ⚠️ Romper forzando la de menor grado |
| Mapas grandes | **Trocear** suelos/paredes largos por celda | ⚠️ La pared es un **slab largo** por fila |

## Hallazgos (las causas reales)

### 1. El gate de solape mide el rectángulo, no el hexágono ⭐ (raíz de los ciclos falsos)
En iso la silueta de una caja es un **hexágono** (3 pares de aristas: las dos diagonales y la vertical). El
gate (`engine.js` `overlapScr`) aprueba un par si se solapan sus **AABB de pantalla**: testea el eje
horizontal `sx = x−y` (sí es un eje del hexágono) y la **extensión vertical** `sy` (que **no** lo es).
Faltan los **dos ejes diagonales**. Resultado: admite pares cuyos hexágonos **no se tocan** → aristas de
precedencia espurias → **ciclos falsos** → salta el rompe-ciclos y corrompe el orden de un par que sí era
real. Es el bug "se ve bien en una sala y mal en otra".

Arreglo exacto (~6 líneas). Con el proyector actual (TW=2·TH, BH=TH) dos cajas se solapan en pantalla **si y
solo si** se solapan sus tres intervalos:

```
(x − y): [x0−y1, x1−y0]
(x − z): [x0−z1, x1−z0]
(y − z): [y0−z1, y1−z0]
```

Son los tres normales a las aristas del hexágono; con la misma proyección, 3 ejes son *necesarios y
suficientes* (SAT exacto). Si cambian las proporciones, `z` se escala por `BLOCK_H/TILE_H`.

### 2. El painter ordena la HUELLA de colisión, pero dibuja SPRITES que no caben en esa caja ⭐⭐ (el más visible)
Decisión deliberada: "una caja por asset, la MISMA para colisión y painter". Elegante para la colisión, pero
ahí está la tensión de fondo: la colisión quiere la *huella*; el painter quiere la *silueta de lo que se
pinta*. Solo coinciden si el sprite es tan grande como su huella. No lo son en:
- **Pared**: huella `l:0` (plano de grosor cero), tile `h:60px`, `minY:−51`.
- **Planta**: huella `0.32×0.32×0.5`, sprite `8×13`, `minY:−11` (las hojas sobresalen).
- **Dron**: flota (`z:0.6`), sprite `minY:−22`.
- **Robot con carga**: se dibuja hasta `z+1.6`; la caja de orden se estira a mano (`player.js`) — parche que
  delata justo este problema.

El painter ordena bien *la caja*, pero **blitea píxeles fuera de ella** → un sprite alto detrás repinta sobre
uno bajo delante. Típico "la planta/pared tapa al robot sin sentido".

### 3. La cáscara entra como slabs largos (problema del "slab largo")
Una pared de fondo es **una sola caja** que recorre toda la fila con `l:0`. Un slab largo puede quedar
*detrás* de un objeto y *delante* de otro a la vez → fuerza ciclos. Y ya se **dibuja por tiras celda a
celda** (`draw.flatWall`); solo el **orden** la trata como bloque único. Desajuste innecesario.

### 4. El oráculo de tests hereda la misma aproximación → es ciego al hallazgo #1
`test/painter.mjs` define "correcto" con el **mismo** gate AABB que el motor. Las escenas con ciclo falso se
clasifican como "cíclicas" y el test **no exige 0 violaciones** justo en los casos que se ven mal. Subir el
gate al test hexagonal **arregla el motor y endurece el oráculo a la vez**.

### 5. Heurísticos razonables pero no canónicos
Desempate por *centro-z* y corte de ciclos por *menor grado*: funcionan y son deterministas, pero no son lo
que recomiendan las guías (partición de las SCC). Baja prioridad: solo importa si quedan ciclos **reales**
tras 1–3.

### Deuda colateral (no es bug, pero va contra "elegante")
`physics.roomSolids()` reconstruye cáscara+objetos **en cada consulta** y se llama varias veces por frame
(`blocksHoriz`, `supportHeight`, `objSupport`). Construir **una vez por frame/sala**.

## Ruta de mejora

**Norte:** el motor ordena por una **caja-silueta genérica** que el render *garantiza* que acota los píxeles
dibujados; la física sigue usando la **huella de colisión**. Ambas derivadas del registro (SSOT intacta). El
motor sigue **ciego a los assets**.

1. **Gate exacto hexagonal** — 3 intervalos (#1) + **mismo gate en el test**. ROI altísimo, riesgo bajo. *Empezar aquí.*
2. **Separar caja-de-orden (silueta visual) de huella** (#2) — `bounds` visual por asset (default = `foot`);
   render ordena por `bounds`, física con `foot`. Borra el parche de `player.js`.
3. **Trocear la cáscara por celda** (#3) — una caja de orden por celda (ya se dibuja así). Mata el slab largo.
4. **Revisar los pre-pases** (`doorHole`) a la luz de 2–3 — simplificar o formalizar como fondo z=0.
5. **Endurecer el oráculo** — caso real (planta/pared sobre robot) rojo→verde; invariante "el orden respeta
   la silueta visual, no la huella".
6. **(Solo si quedan ciclos reales tras 1–3)** rotura por partición (Tarjan SCC + split).
7. **Limpieza** — cachear `roomSolids`/placements una vez por frame.

Cada paso es **independiente y desplegable**, con su test, y ninguno toca la capa de datos ni reintroduce
dependencias de assets en el motor.

## Lo que NO se toca
La proyección 2:1, la SSOT de assets, el **pipeline único** cáscara+objetos+entidades hacia un solo
`depthSort`, y Kahn. Eso es lo que hace el motor reutilizable; está bien planteado.

## Estado (progreso)
- **Paso 1 — HECHO**: gate del painter por silueta hexagonal exacta + oráculo endurecido (red→green). Era el
  bug de corrección real (commit `motor iso: gate de painter por silueta hexagonal…`).
- **Paso 2/5 — HECHO (lean)**: medido todo el mapa, la huella ya acota el sprite (≤0.85px) → #2 no se
  manifiesta. En vez del refactor se añadió el **guardarraíl anti-#2** (`test/assets.mjs`, ≤2px) y se dio
  huella honesta al dron (único divergente). El refactor completo (`bounds` visual ≠ huella) queda
  documentado como idea: [idea-motor-bounds-visuales.md](idea-motor-bounds-visuales.md).
- **Paso 3 (pared slab) y Paso 4 (doorHole) — APLAZADOS**: hoy son benignos (las paredes van siempre
  estrictamente detrás → sin ciclos). Recogidos en la idea de `bounds`.
- **Paso 7 (cachear `roomSolids` por frame) — HECHO**: la cáscara (invariante en partida) se memoiza por sala
  (`world.roomShell`, WeakMap); los objetos (mutan) se dejan frescos. Limpieza, sin cambio de comportamiento.
- **Extra (debug)**: el overlay del robot pinta ahora su **caja de colisión/orden** (verde) junto a la huella
  visual (roja) → hace visible que el robot se dibuja más ancho que su caja de orden (análogo del #2 para
  entidades; ver la idea de `bounds` y [idea-robot-huella-cuadrada.md](idea-robot-huella-cuadrada.md)).
