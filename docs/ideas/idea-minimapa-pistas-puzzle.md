# Idea — Pistas de puzzle en el minimapa (zócalos pendientes / destino del circuito)

> **Estado: PENDIENTE — Prioridad MEDIA.** Origen: IA, procesado 2026-06-28.

## Qué es
Usar el minimapa como **ayuda de navegación del puzzle** en el laberinto flip-screen:
- Marcar las salas que **tienen zócalos sin rellenar** (queda algo por hacer ahí).
- Si llevas un circuito, **resaltar la sala de su zócalo destino** (dónde encaja lo que llevas).

## Estado actual (código)
- El minimapa (`drawMinimap`, [render.js:165-208](../../src/render.js)) ya recorre todas las salas
  (`world.rooms`) y pinta cada una como rectángulo + sus puertas; tiñe la sala actual distinta. Tiene todo
  el andamiaje para añadir un marcador por sala.
- Los zócalos y su estado están en los datos: `roomThings(room)` da los placements (con `requires`/`filled`),
  y `MISSION.requires` ([data/mission.js](../../src/data/mission.js)) sabe qué pide cada zócalo. El circuito
  que llevas es `game.carried`.

## Viabilidad técnica
- **Encaje:** limpio, solo presentación. Para cada sala, consultar si tiene algún zócalo con `!filled`
  (recorrer sus objetos) y pintar un punto/realce. Para el destino: con `game.carried`, buscar la sala cuyo
  zócalo `requires === carried` y `!filled`. **No toca física ni painter** → riesgo bajo.
- **Coste:** medio (hay que mirar el estado de los zócalos por sala; conviene un helper en `world`/`mission`
  que devuelva "salas con pendientes" para no meter lógica de datos en `render.js`).
- **Riesgo:** bajo. Cuidado de no recalcular en cada frame algo caro (las salas son ~17; barato igual).

## Conveniencia
**Media.** Mejora real de UX: el mapa es laberíntico (~17 salas) y sin reloj se explora a ojo; una pista
sutil reduce el deambular sin resolver el puzzle por el jugador (sigue sin decir la **forma**, solo "aquí
queda algo"). Alineado con la esencia (exploración flip-screen) y con que la UI es fija y estable.

## Sugerencia
**Mantener.** Hacerlo **después** del rediseño del HUD (para no recolocar dos veces) y, si se quiere, ligado
a la pantalla de victoria. Mantener la marca **discreta** (un punto en secundario) para no romper el look.
Exponer un helper de datos (p. ej. `roomsWithPending()` en `world`/`mission`) en vez de meter la consulta
en `render.js`.
