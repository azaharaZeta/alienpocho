# Idea — Coordenadas UNIFICADAS para todos los assets

> **Estado: RESUELTA (implementada) — archivada 2026-06-28.** Origen: usuaria (pedida varias veces).

## Qué pedía
UNA sola forma de definir y manejar la posición de cualquier asset, sin convenciones distintas por tipo.
Antes convivían dos: índice de celda `cx,cy` (objetos fijos, sockets, hazards; el código sumaba 0.5) y
centro continuo `x,y`+`z` (móviles/recogibles, como el jugador). `physics.objBox` solo entendía la continua
→ fuente de bugs (computer/REACTOR sin `z` daban `NaN`, ver [[bug-reactor-bloque-sin-z]]).

## Qué se hizo
Convención ÚNICA continua para TODO lo colocable (objects, sockets, hazards): `x,y` = ancla en el mundo
(centro para los assets `center`, que son todos los `object`) + `z` opcional (def. 0). Sin `cx,cy`.
- **`data/rooms.js`**: convertido por completo (`cx → x=cx+0.5`, `cy → y=cy+0.5`, `z` omitido = suelo).
  Cabecera reescrita a una sola convención.
- **`world.js` `makeRoom`**: NORMALIZA `z` a número (def. 0) al clonar — **punto ÚNICO** que blinda toda la
  cubeta. Física (`objBox`/`objSupport`/`objBlocked`/`updateObjects`) y render leen `o.z` sin defensas
  dispersas → mata la clase de bug del objeto sin `z` (resuelve [[bug-reactor-bloque-sin-z]] de raíz).
- **`world.js` `roomThings`**: los 3 bucles leen `o.x/o.y/o.z` directos (fuera el ternario `cx` y el `offset`).
- **`physics.js`**: sin cambios (con `z` garantizado, ya leía bien).
- **Guardarraíl** (`test/smoke.mjs`): aserción de que ningún placeable usa `cx/cy` y que `x,y` son números +
  que `makeRoom` deja `z` finito. Bloquea regresiones a la convención vieja.

## Por qué fue seguro (motor intacto)
El **motor iso (`engine.js`) nunca vio `cx/cy`**: trabaja sobre `aabb` en coordenadas de mundo. La dualidad
vivía solo en datos + capa de interpretación (`world.js`). La conversión `cx+0.5` es EXACTAMENTE lo que el
resto del código ya asumía (los `smoke` ya probaban con literales continuos 2.5/4.5/5.5). Cero excepciones
por asset añadidas al motor — fiel al criterio "motor sólido, sin parches".

## Verificación
51→52 tests verdes (incl. smoke completo). En preview: ENTRADA renderiza con la plataforma/circuito/zócalo en
su sitio; el bloque empujable de REACTOR ahora trae `z:0` numérico. Relacionada: la idea archivada
[[idea-posicionamiento-unificado-bloques-movibles]] (anclaje `center` unificado, que habilitó esta conversión).
