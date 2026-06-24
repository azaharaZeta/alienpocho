# idea — Unificar el punto de anclaje de los assets

> Estado: **ANÁLISIS / sin implementar.** Viabilidad + recomendación técnica para que todos los assets
> colocables usen el MISMO punto de anclaje, en vez de "esquina para fijos / centro para móviles".
> Origen: propuesta de la usuaria (2026-06-24). Relacionado: idea de la usuaria en `ideas.md`
> ("todos los objetos deberían usar la misma lógica de posicionamiento… algunos bloques movibles") ·
> [[alien-pocho-assets-ssot]] · [[alien-pocho-assets-modularity]].

---

## 0. Veredicto

**Viable y de bajo riesgo.** Recomendación: **unificar todos los OBJETOS al anclaje `center`** (base
centrada). Hoy **el único objeto en esquina es `cube`**; el resto (`prop_*`, `socket`, `spikes`, `plant`,
`drone`, `computer`, `robot`) ya está centrado. Es decir: unificar = **tocar un solo asset (`cube`)**.

La estructura (suelo/paredes/puerta) es harina de otro costal (rejilla/borde, no "cosas con centro"): su
anclaje es casi vestigial. Recomiendo dejarla como está y justificar por qué.

---

## 1. El problema (diagnóstico)

| Anclaje | Assets | Cómo se coloca |
|---|---|---|
| **corner** (0,0,0) | `floor`, `wall1`, `wall2` (estructura) · **`cube`** (objeto) | índice de celda ENTERO (rejilla) |
| **center** (0.5,0.5,0) | `prop_*`, `socket`, `spikes`, `plant`, `drone`, `computer`, `robot` | punto continuo / `cx+0.5` |
| (sin anclaje) | `door` | cajas/ref explícitas por eje (variantes) |

La observación de la usuaria es correcta: **el anclaje NO debería depender de si el asset es móvil**. Hoy
parece que sí, pero el acoplamiento real es otro:

- El anclaje sigue a la **cubeta de colocación**, no a la movilidad: los **bloques de rejilla** (`room.blocks`)
  se colocan por índice entero y se anclan en esquina; los **objetos libres** (`room.objects`) se colocan por
  centro continuo (como el jugador) y se anclan en el centro.
- `cube` está en esquina **porque es la pieza-bloque de construcción** (se tesela en rejilla), no porque sea
  fijo. Y resulta que los bloques son justo los fijos → de ahí la falsa correlación "fijo = esquina".

Conclusión: hay **dos ejes** que hoy van pegados y deberían ser independientes:
1. **Anclaje** (dónde está el punto de referencia del asset). ← lo que pide unificar la usuaria.
2. **Cubeta/convención de colocación** (rejilla entera vs centro continuo). ← el acoplamiento que hace que
   "hacer `cube` movible" sea molesto (cambiar de cubeta + recoordenar).

---

## 2. Qué usa el anclaje (impacto)

- `assetRef(id)` → punto de anclaje iso (corner `{0,0,0}` / center `{0.5,0.5,0}`).
- `assetBox(id)` → AABB; con `center` la huella se centra en la celda, con `corner` se pone en (0,0).
- `world.roomThings` → coloca cada cubeta (blocks por `b.x`; objects por `o.x`; sockets/hazards por `cx+0.5`;
  `things` por `cx+0.5`/`cx` según anclaje). `placeAabb` deriva la caja de `assetBox`+`assetRef`.
- **Drawers**: dibujan en `t.x,t.y,t.z` (el anclaje). El encuadre del sprite (`minX,minY`) está **calibrado
  respecto al anclaje**.

---

## 3. Viabilidad de unificar a `center`

**Clave:** para una huella **1×1** (el `cube`), `assetBox` es **idéntica** con esquina o centro
(`0.5 − 1/2 = 0` ⇒ caja `[0,1]` en los dos casos). Solo cambia el **ref** (de `(0,0,0)` a `(0.5,0.5,0)`).
Por eso el cambio es contenido:

| Aspecto | ¿Cambia al pasar `cube` a center? |
|---|---|
| AABB del cube (1×1) | **No** (misma caja `[x,x+1]`). |
| Física (`roomSolids`, apoyo, colisión) | **No** (usa la `aabb`, idéntica). |
| Painter (`depthSort`) | **No** (usa la `aabb`). |
| Datos del mapa (`rooms.js`) | **No** (los `blocks` siguen con índice entero; world añade `+0.5`). |
| `world.roomThings` (bucle de blocks) | **Sí, 1 línea**: colocar el cube en `b.x+0.5, b.y+0.5` (como sockets/hazards). |
| Dibujo de `cube` | **Sí**: recalibrar el ancla del sprite (ver §5). |
| Tests | El test "anclaje center/corner" usa `cube` como ejemplo de esquina → pasaría a center; el ejemplo de esquina lo daría la estructura (`floor`). Smoke tests de bloques (caja `[2,3]`) **siguen pasando**. |

**Por qué `center` y no `corner`:** si unificáramos a esquina habría que recalibrar **~7 sprites** (todos los
centrados) y re-modelar empuje/apilado/soltar (game/physics asumen centro, igual que el jugador). Unificar a
**centro** toca **solo `cube`**. Centro es además el "lugar natural" de una cosa y ya es la convención de
móviles + jugador + física.

---

## 4. La estructura (suelo/paredes/puerta): dejar como está

- `floor` es una baldosa por celda; `wall1/2` son **planos de borde** (`foot.l = 0`, grosor cero); `door`
  abarca el límite entre celdas y usa **cajas/ref por eje**. "Centro" no significa nada útil para un plano de
  borde o un vano.
- Se dibujan en la **capa estructural** de `render.js` con coordenadas explícitas, **no** por el anclaje
  genérico. Su campo `anchor:"corner"` solo afecta a la **preview de la tool**.
- Recomendación: **mantener la estructura en rejilla/borde**. La unificación es de OBJETOS (cosas con huella y
  centro), que es exactamente lo que le molesta a la usuaria.

---

## 5. Recalibrar el sprite de `cube` (el único trabajo "de arte")

Al mover el ref de esquina `(0,0,0)` a centro `(0.5,0.5,0)`, el punto de pantalla baja `(0, +8.5px)`
(`(0.5+0.5)·TILE_H/2`). Para que el cube se dibuje en el mismo sitio:

- **`minY`: −17 → −25.5** (sube el blit 8.5px). **`minX` y `w/h` no cambian** (sigue 34×34) → **`manifest.json`
  intacto** (solo guarda w/h).
- Dos formas:
  - **(a) rápida:** cambiar solo `minY` en el registro; `cube.svg`/`cube.png` no se tocan (se reblitean en la
    nueva posición; sin recorte, el raster es el cubo completo). Coste: queda `registro.minY ≠ viewBox` solo
    para cube (ningún test lo exige; cube renderiza bien).
  - **(b) limpia:** reposicionar el `(0,0)` dentro de `cube.svg` (centro de la base) y reexportar `cube.png`,
    manteniendo `registro == viewBox`. Coste: una micro-edición de arte (dominio de la usuaria / la tool).
- Recomiendo (a) para empezar (cero arte, reversible) y (b) si más adelante se quiere la coherencia total.

---

## 6. Recomendación e implementación

### Fase 1 — Unificar anclaje a `center` — ✅ IMPLEMENTADO (2026-06-24)
1. ✅ `data/assets.js`: `cube.anchor` `corner` → `center`; sprite `minY −17 → −25.5` (w/h 34×34 sin cambio).
2. ✅ `cube.svg`: paths desplazados −8.5 en y + viewBox `-17 -25.5 34 34` (mantiene `registro == viewBox`).
   `cube.png` **no se tocó** (se reblitea solo; el raster es el mismo cubo).
3. ✅ `world.js`: el bucle de `blocks` coloca el cube en `b.x+0.5, b.y+0.5` (como sockets/hazards).
4. ✅ `test/assets.mjs`: el test de anclaje usa `floor` como `corner` y `cube`(ref 0.5,0.5)/`spikes` como `center`.
5. ✅ `npm test` (34 ✓) + preview: el bloque se dibuja en el MISMO píxel (el `+0.5` y el `minY −25.5` se
   cancelan; invariante exacta). La "cintura" del bloque es el arte de `cube.png`, no un bug.

Resultado: **ningún objeto se ancla distinto por ser móvil o fijo.** "computer fijo" = quitarle traits
(ya funciona; sigue centrado). "cube movible" = ya no cambia de anclaje.

### Fase 2 — Unificar la CUBETA de colocación — ✅ IMPLEMENTADO (2026-06-24)
La cubeta `blocks` se FUNDIÓ en `objects` (y la genérica `things`, que no se usaba, también) → **una sola lista**
de lo colocable no-estructural. El comportamiento lo deciden los TRAITS, no la cubeta:
- `data/rooms.js`: ya no hay `blocks`; los bloques son `{ asset:"cube", cx, cy, z?, h? }` dentro de `objects`.
- `world.roomThings`: un único bucle sobre `objects` (asset/shape, `cx,cy` o `x,y`, `h` = pila); borrados los
  bucles de `blocks` y `things`. `makeRoom` ya no clona `blocks`/`things`.
- **Traits por INSTANCIA**: `world.thingHas(o,trait)` = traits del asset **O** de `o.traits`. La simulación
  (empuje en `player`, gravedad en `physics`) usa `thingHas`. Así un `cube` (solo `solid`) es fijo, y
  `{ asset:"cube", x, y, traits:{ movable:true, falls:true } }` es un **bloque empujable** — sin cambiar de
  cubeta ni de asset. Verificado en preview (inyectado un bloque movable → `thingHas` da movable/falls = true).
- Tests `smoke.mjs` actualizados (ENTRADA ahora tiene bloque+circuito en `objects`). `npm test` (34 ✓).

Resultado: **"hacer un bloque movible" = añadir el trait** (instancia), sin mover de cubeta ni recoordenar.
`sockets`/`hazards` siguen como cubetas propias (semántica especial: puzzle / decoración).

> **Distinción clave:** Fase 1 arregla el **anclaje** (la queja literal). Fase 2 arregla la **cubeta** (que
> "hacer un bloque movible" sea solo añadir un trait). Se pueden hacer por separado.

---

## 7. Riesgos / impacto

- **Muy contenido**: AABB del cube no cambia ⇒ física, painter y datos del mapa **intactos**. Solo cambian la
  colocación del bloque (1 línea) y la calibración del sprite del cube.
- **Tool**: el cube se previsualiza centrado (como el resto). Sin cambios de código (es genérica).
- **No hay assets multi-celda móviles** hoy ⇒ ningún caso raro de huella grande con centro.

## 8. Incidental detectado — ✅ RESUELTO (2026-06-24)

`makeRoom` construía `room.solid` (Set de celdas sólidas por índice, desde `blocks`) pero **ya no lo leía
nadie** (la física usa `roomSolids` genérico desde `roomThings`). Era **código muerto** del refactor anterior.
**Eliminado** (`new Set()` + bucle + `solid,` del return + comentario de cabecera de `world.js`).

---

## 9. Estado

**FASES 1 y 2 IMPLEMENTADAS ✅ — idea CERRADA** (2026-06-24). Anclaje de objetos unificado a `center` (Fase 1)
+ cubeta única `objects` con comportamiento por traits de asset o instancia (Fase 2). `room.solid` y la cubeta
`things` eliminados. Ficheros: `data/assets.js`, `assets/svg/cube.svg`, `data/rooms.js`, `world.js`, `physics.js`,
`player.js`, `test/assets.mjs`, `test/smoke.mjs` + docs (CLAUDE/ARQUITECTURA). `npm test` (34 ✓) + preview
(regresión OK; bloque movable por instancia verificado). Cubre la idea de la usuaria en `ideas.md` ("misma
lógica de posicionamiento + bloques movibles"). → Mover a `docs/ideas/archivo/` en la próxima limpieza de docs.
