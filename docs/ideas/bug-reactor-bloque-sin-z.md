# Bug — el bloque empujable de REACTOR no se puede empujar (le falta `z`)

> **Estado: ABIERTO — confirmado, NO reproducido por la usuaria. Prioridad BAJA-MEDIA.**
> Diagnosticado 2026-06-28 (mientras se hacía el empuje en salto). También se levantó como tarea de fondo
> (chip), pero queda aquí para que no se pierda.

## Síntoma
En REACTOR (`data/rooms.js`, sala `"4,1"`) hay un bloque marcado como empujable:
`{ asset: "cube", x: 5.5, y: 3.5, traits: { movable: true, falls: true } }`. **No se puede empujar.**

## Causa (confirmada por código + eval en preview)
Ese objeto NO trae `z`. `physics.objBox(o)` lee `o.z` en crudo (`z0: o.z, top: o.z + objTopH(o)`), así que
con `z` indefinido la caja sale `z0=undefined, top=NaN`. En `player.tryPush`, la condición
`b.z0 <= feetZ+STEP && b.top > feetZ+STEP` es entonces SIEMPRE false → el bloque nunca se selecciona como
objetivo de empuje. (Verificado: `objBox(cube).top === NaN`, `pushableAtGround === false`.)

Es el MISMO origen que mordió a los `computer` recién colocados: los objetos **móviles/recogibles** deben
declararse con coordenada CONTINUA (`x,y`) y `z` numérico, porque `objBox` los lee tal cual (a diferencia de
`placeAabb`/render, que sí hacen `o.z||0`). Los circuitos funcionan porque siempre traen `z`.

## Arreglos posibles (elegir uno, NO ambos)
1. **Mínimo (datos):** añadir `z: 0` al bloque empujable de REACTOR.
2. **Raíz (recomendado):** que `physics.objBox` use `o.z || 0` (y revisar `updateObjects`, que también lee
   `o.z` directo). Blinda toda la cubeta, no solo REACTOR. **Esto lo absorbe la idea "coordenadas unificadas"**
   (ver `ideas.md` → IDEAS USUARIA): si se procesa esa idea, este bug se resuelve de paso.

## Riesgo / verificación
Toca física/empuje → **`npm test`** + verificar en preview que en REACTOR el bloque se empuja y que el puzzle
del DOMO (empujar el bloque y saltar) vuelve a ser resoluble, sin romper la gravedad de otros objetos.

Relacionado: [[bug-empuje-revalida-robot]] (misma zona, `tryPush`).