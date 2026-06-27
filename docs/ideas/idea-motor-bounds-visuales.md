# Idea — `bounds` visual ≠ huella de colisión (motor iso)

**Estado: PENDIENTE** (no urgente). Mitigación lean ya implementada; este refactor se activa cuando un
asset NECESITE que su silueta de dibujo difiera de verdad de su caja de colisión.

Contexto: [assessment-motor-iso.md](assessment-motor-iso.md) (hallazgo #2).

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

## Relación con otros pendientes
Misma raíz "caja de render ≠ caja de colisión":
- **#3 — pared como slab largo**: trocear la cáscara por celda para ORDENAR (ya se dibuja por tiras).
- **doorHole** (pre-pase del vano de fondo): hoy es un parche para que el negro no gane el desempate del
  painter; con `sort` propio podría formalizarse.
- **robot con carga**: hoy `player.addDraws` estira la caja a mano hasta `z+2.2`; sería un `sort` natural.

## Cuándo activarlo
Cuando aparezca el primer asset con colisión ≠ silueta irreconciliable, o al abordar #3/doorHole. Mientras
tanto, el guardarraíl mantiene el invariante con una sola caja.
