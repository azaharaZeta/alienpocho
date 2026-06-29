# Idea — Empujar objetos con otros ENCIMA (la pila viaja con ellos)

> **Estado: HECHA 2026-06-29.** Origen: usuaria. "Es necesario poder mover objetos que tengan otros
> objetos encima, que deberán seguir encima. Por ejemplo, empujar una mesa que tiene encima un monitor.
> Actualmente, la mesa no se deja mover."

## Problema
`tryPush` (player.js) movía SOLO el objeto empujado y validaba el destino con `objBlocked`, que rechaza si
la huella destino solapa cualquier sólido cuya cima quede por encima de la base del objeto. Un objeto que
**descansa encima** (monitor en z=1 sobre la mesa) es sólido y su huella cae dentro de la de la mesa → al
intentar mover la mesa, el monitor contaba como obstáculo → "la mesa no se deja mover".

## Solución
La PILA viaja con el objeto y se EXCLUYE del chequeo de colisión:
- `physics.ridersOf(room, base)` — conjunto TRANSITIVO de lo que descansa sobre `base` (solapa en planta y su
  base está a la cima del de abajo), y lo que descansa sobre eso, etc.
- `physics.objBlocked(room, obj, nx, ny, exclude)` — nuevo parámetro `exclude` (Set): ignora el propio objeto
  Y los miembros de su pila (no se auto-bloquean entre ellos).
- `player.tryPush` — al empujar `target`, forma `group = {target, ...ridersOf}`; el destino debe estar libre
  para CADA miembro (excluyendo al grupo); si cabe, mueve todo el grupo + el robot el mismo `step`. Los riders
  conservan su `z` (la mesa no cambia de altura al deslizarse) → siguen encima; la gravedad los mantiene.

Si un rider no cabe en su destino (toca pared), se bloquea el empuje completo (correcto: no puedes meter la
mesa donde el monitor chocaría).

## Verificación
- LAB: `ridersOf(mesa) = [monitor]`; empujar +y antes bloqueado, ahora libre y el monitor viaja con la mesa.
- `npm test` verde (no afecta a colisión del robot, gravedad ni caída; `objBlocked` sin `exclude` = comportamiento previo).

## Relacionado
Misma tanda que el bug "objetos movibles que no se mueven" (CRUCE silla∩mesa, solape AUTORIZADO): reubicada +
guardarraíl en `test/mission.mjs` (ningún par de sólidos se solapa a la misma altura).
