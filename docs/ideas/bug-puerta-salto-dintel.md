# Bug — El robot atraviesa el marco superior (dintel) de la puerta con salto alto

> **Estado: ABIERTO — Prioridad ALTA** (corrección, no mejora). Origen: BUGS CONOCIDOS, procesado 2026-06-27.

## Síntoma
Con un salto **alto** (`JUMP_HIGH`), el robot atraviesa el **marco superior** de la puerta. Debería **chocar
con el dintel y caer**.

## Causa (análisis)
`physics.roomSolids()` mete las puertas como **sus dos postes, dejando libre el vano** (para que el robot se
intercale al cruzar). El **dintel** (la franja superior del marco, por encima del hueco de paso) **no entra
como sólido**. La colisión horizontal (`physics.blocksHoriz`) solo frena si la **cima** de un sólido queda por
encima del pie; como ahí no hay sólido a la altura del dintel, el robot saltando alto pasa por el hueco
completo, incluido el tramo que el dibujo muestra como marco.

## Arreglo (esbozo)
Añadir a `roomSolids` un **sólido de dintel** para la puerta: una caja sobre el vano, desde `z` del dintel
hasta el alto del muro (`WALL_H`), con su huella en las 2 celdas del vano. Así `blocksHoriz` frena al robot
cuando su pie (saltando) supera la altura del paso, y la gravedad lo hace caer. El **vano de paso** (parte
baja) sigue libre → cruzar a pie no cambia.

- **Toca física** (`roomSolids`, geometría de puerta en `data/assets.js`/`world.js`) → **`npm test`** antes y
  después (oráculo del painter + guardarraíles de assets).
- Verificar en preview: cruzar a pie OK, salto alto en el vano → choca y cae; que el dintel-sólido **no**
  bloquee el paso normal ni rompa la oclusión de los postes.

## No es "directo de resolver"
Requiere razonar la geometría del dintel y no romper ni el cruce ni la oclusión → por eso tiene ficha propia.
