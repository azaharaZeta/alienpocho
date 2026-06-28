# Bug — el bloque empujable de REACTOR no se puede empujar (le falta `z`)

> **Estado: RESUELTO — archivado 2026-06-28.** Lo absorbió la idea [[idea-coordenadas-unificadas]].

## Síntoma
En REACTOR (`data/rooms.js`, sala `"4,1"`) el bloque empujable `{ asset: "cube", ... movable }` no se podía
empujar.

## Causa
El objeto no traía `z`. `physics.objBox(o)` leía `o.z` en crudo (`z0: o.z, top: o.z + objTopH`), así que con
`z` indefinido la caja salía `top=NaN` → en `tryPush` la condición de selección era siempre false. Mismo
origen que mordía a los `computer` recién colocados.

## Arreglo (de raíz)
Resuelto al unificar coordenadas: **`world.js makeRoom` normaliza `z` a número (def. 0)** al clonar cada
objeto/zócalo/hazard → toda la cubeta llega a la física con `z` finito, no solo REACTOR. Verificado en preview:
el bloque trae ahora `z:0` numérico. Detalle completo en [[idea-coordenadas-unificadas]].

## Verificación
`npm test` (52 verdes, incl. empuje en suelo y en aire) + inspección de estado en preview.
Relacionado: [[bug-empuje-revalida-robot]] (misma zona `tryPush`, sigue abierto/teórico, aparte).
