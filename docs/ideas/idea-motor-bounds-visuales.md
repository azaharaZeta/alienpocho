# Idea — `bounds` visual ≠ huella de colisión (motor iso)

**Estado: LATENTE** (sin trabajo pendiente). Las motivaciones originales (robot, slab de pared, doorHole) ya
se resolvieron por el refactor del motor (2026-06-28, ver sección "Relación con otros pendientes"); esta idea
solo se reactiva si aparece un asset cuya silueta de dibujo difiera **de verdad** de su caja de colisión.

Contexto: [assessment-motor-iso.md](archivo/assessment-motor-iso.md) (hallazgo #2).

## Problema
Hoy hay **UNA caja por asset** (`foot` → `assetBox` → `aabb`) que sirve a la vez para:
- **física** (colisión/apoyo/empuje: `physics.roomSolids`), y
- **painter** (orden de profundidad: `render` → `depthSort`).

Pero el painter debería ordenar por la **silueta de lo que se dibuja** (los píxeles del sprite), y la física
por la **huella de colisión**. Solo coinciden si el sprite es ~tan grande como su huella. Divergen en:
sprites que sobresalen (planta con copa ancha sobre tallo fino), objetos **flotantes** (dron), o la **pared
plana** (`l:0`, sprite alto). Si divergen, ordenar por la huella deja píxeles fuera de la caja → mis-orden.

## Mitigación actual (lean, YA hecha)
Mientras colisión == silueta sea aceptable, basta mantener la huella **honesta** (que envuelva el sprite):
- Medido en TODO el mapa, lo colocable cae ≤0.85px → el bug no se manifiesta.
- `test/assets.mjs` → **guardarraíl anti-#2**: la caja de orden (huella) debe ACOTAR el sprite (≤2px). Un
  asset nuevo que se salga (planta grande, dron…) lo caza el test → se le da huella honesta.
- El único divergente real (el dron, que flota) se arregló dándole una huella elevada que envuelve su sprite.

Esto **no** resuelve el caso en que colisión y silueta deban diferir DE VERDAD (p. ej. un dron **sólido** bajo
el que quieres pasar andando: su colisión está arriba pero su silueta llega al suelo; o la pared plana).

## El refactor
Separar las dos cajas, ambas derivadas del registro, **default iguales** (cero coste para casi todo):
1. Registro: añadir `bounds` opcional (caja VISUAL en celdas, mismo esquema que `foot`; ausente ⇒ `= foot`).
   Helper `assetVizBox(id)` (default `assetBox`).
2. `world.roomThings`/`roomShell`: emitir por placement **dos** cajas — `aabb` (colisión, de `foot`) y `sort`
   (visual, de `bounds`). Hoy `sort === aabb` para casi todos.
3. `render`: ordenar por `t.sort` (cae a `t.aabb`). `physics`: seguir con `t.aabb`. El **motor no cambia**
   (sigue recibiendo cajas; ciego a los assets).
4. Guardarraíl: pasar a exigir `bounds ⊇ sprite` (en vez de `foot ⊇ sprite`).

## Relación con otros pendientes (TODOS resueltos por el refactor del motor, 2026-06-28)
Misma raíz "caja de render ≠ caja de colisión". Lo que motivaba esta idea YA se resolvió, por otra vía:
- **#3 — pared como slab largo**: ✅ HECHO. `world.roomShell` trocea el muro por celda (cada tramo su caja),
  no un slab de toda la fila.
- **doorHole** (vano de fondo): ✅ HECHO. Ya no es pre-pase: entra al painter como pieza de la cáscara
  (`half:"hole"`, no sólida) y el desempate x+y lo ordena detrás del robot.
- **robot (entidad)**: ✅ RESUELTO, pero **NO** con dos cajas (`sort` ≠ `collision`) como planteaba esta idea,
  sino **unificando** colisión = orden = dibujo en UNA sola caja `±PRAD = ROBOT.WID` (se afinó `WID` para que
  el robot quepa por las puertas). El "overhang" se eliminó haciendo que el sprite NO sea más ancho que su
  huella, en vez de darle una caja de orden aparte. Ver [refactor-motor-iso.md](archivo/refactor-motor-iso.md)
  §7 y [idea-robot-huella-cuadrada.md](archivo/idea-robot-huella-cuadrada.md) (RESUELTA, archivada).

## Cuándo activarlo
Solo si aparece un asset con colisión ≠ silueta **irreconciliable de verdad** (p. ej. un **dron sólido** bajo
el que quieras pasar andando: colisión arriba, silueta hasta el suelo). Para ese caso, separar `sort`/`bounds`
de `collision` sigue siendo la solución correcta. Mientras tanto, con una sola caja honesta (guardarraíl
anti-#2) basta: esta idea queda **latente**, sin trabajo pendiente salvo que surja ese asset.

## Caveat del `drone` (absorbido del listado de BUGS, 2026-06-28)
El asset `drone` ([assets.js:133-137](../../src/data/assets.js)) ya arrastra el manejo especial de **huella
ELEVADA** (`foot.z=0.45`) que envuelve su sprite flotante — la mitigación anti-#2 descrita arriba. Hoy ese
caso **solo se ejercita en tool/tests**: el `drone` no se coloca en ninguna sala, así que **no es un defecto
activo**. Cuando se coloque por primera vez (ligado a [[idea-mas-salas-retos]] — "dron activo"), **verificar
en escena real** su oclusión/orden con los overlays `j`/`k`/`l` antes de darlo por bueno; si su silueta y su
huella divergen de verdad (dron sólido bajo el que pasar), es justamente el disparador para activar este
refactor. Se retira del listado de BUGS y queda registrado aquí como caveat.
