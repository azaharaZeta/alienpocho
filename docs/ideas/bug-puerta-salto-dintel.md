# Bug — El robot atraviesa la viga (dintel) de la puerta al saltar

> **Estado: RESUELTO (2026-06-27) — pendiente de confirmación visual en partida.** Candidato a archivar.
> Origen: BUGS CONOCIDOS (caso horizontal) + hallazgo de la usuaria (caso vertical).

## Síntomas
Tres formas del mismo tema (corrección del dintel):
1. **Horizontal (física):** con un salto **alto** que avanza, el robot atravesaba el **marco superior** y
   cruzaba por encima del paso.
2. **Vertical (física):** estando **bajo la puerta**, al saltar recto hacia arriba la cabeza atravesaba la
   viga (los dos cachos del dintel) en vez de toparla.
3. **Oclusión (painter):** al saltar bajo la puerta, el **sprite del robot se dibujaba ENCIMA de la viga**
   en vez de quedar oculto tras ella (la cabeza tapaba el dintel).

## Causa
`physics.roomSolids()` metía las puertas solo como sus **dos postes**, dejando el vano libre a TODA altura
(no había sólido en la franja del dintel). Además:
- `blocksHoriz` solo miraba la **cima** del sólido, no su base → no sabía representar un obstáculo elevado.
- El bloque Z de `player.js` solo aterrizaba al **bajar** (`vz<=0`); subiendo no había **tope de techo**, así
  que el salto atravesaba cualquier sólido por encima.
- **Oclusión:** la puerta entraba al painter como **2 piezas (postes)**, y cada una **dibujaba el sprite
  entero recortado a su mitad** → la viga la pintaban los postes (caja **baja, al extremo**). Con el robot en
  el **centro** del vano, su caja ordenaba por delante del poste cercano → tapaba la media-viga. Es la
  limitación #2 del painter ([[idea-motor-bounds-visuales]]): se pintan píxeles fuera de la caja de orden.

## Arreglo (HECHO)
1. **Dintel sólido** (`world.js` `roomShell`): la puerta emite ahora una caja extra para el dintel — banda
   superior del vano `z ∈ [WALL_H − DOOR.LINTEL_H, WALL_H]`, a lo ancho de las 2 celdas. Deja libre el hueco
   bajo para cruzar a pie.
2. **`blocksHoriz` respeta la base** (`physics.js`): bloquea si `top > pie+STEP` **y** `z0 < cabeza` → un
   sólido elevado (el dintel) deja pasar por debajo de pie pero frena la cabeza en salto.
3. **Colisión de techo** (`physics.ceilingHeight` + `player.js`): subiendo (`vz>0`), si la cabeza fuese a
   entrar en un sólido por encima, se corta el ascenso a ras de su base y se anula `vz` → la gravedad lo baja
   (topetazo). `ceilingHeight` es el simétrico de `supportHeight`.
4. **Dintel como PIEZA propia del painter** (`world.roomShell` + `draw.js`): la puerta emite ahora una 3ª
   pieza para la viga, ordenada por **su** caja (alta, ancho completo) → `depthSort` la pinta DELANTE de la
   cabeza del robot (la ocluye). Se dibuja recortando el sprite a la **silueta hexagonal** de esa caja (el
   mismo hexágono que `ENGINE.box`). Acotado a la puerta; el motor no cambia. Es una aplicación local de la
   idea de `bounds` (caja de orden ≠ huella) solo para el dintel.

## Verificación
`npm test` verde (suite completa; el oráculo `roomShell` de `smoke.mjs` se actualizó a 3 piezas/puerta).
Sondas sobre una puerta real:
- **Física:** cruzar a pie ✅ · salto bajo pasa por debajo ✅ · salto alto horizontal **choca** ✅ · postes
  intactos ✅. Salto vertical bajo el dintel: la cabeza topa exacto en `z0=2.54` (no atraviesa); en campo
  abierto llega a 2.75 sin cambios. El tope cubre **todo el ancho** del vano (los dos cachos).
- **Oclusión (painter):** `depthSort([robot, dintel])` → `[ROBOT, DINTEL]` (el dintel se pinta el último =
  delante → ocluye), determinista (igual con la entrada invertida); `depthSort([robot, poste])` → el robot se
  sigue intercalando. Falta confirmación visual en partida (el freeze peleaba con el flip-screen).

## Cierre
Archivar a `docs/ideas/archivo/` cuando la usuaria confirme el topetazo en partida.
