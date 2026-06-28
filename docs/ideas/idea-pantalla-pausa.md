# Idea — Pantalla / overlay de pausa

> **Estado: PENDIENTE — Prioridad BAJA-MEDIA.** Origen: IA, procesado 2026-06-28.

## Qué es
Una **pausa** (tecla dedicada, p. ej. P o Escape) que congele el juego y muestre un overlay con el listado
de controles y, opcionalmente, el estado (circuitos x/total). Reutiliza el estilo de la pantalla de título.

## Estado actual (código)
- La máquina de estados es `game.state` (`"title"`/jugando…) en [game.js:21](../../src/game.js); el bucle
  está en `main.js`. No hay estado de pausa.
- El estilo de pantalla ya existe: `screens.drawSciFiFrame`/`drawTitleScreen` ([screens.js](../../src/screens.js)).
- Las teclas son datos en `CONTROLS` ([config.js:55-65](../../src/config.js)); añadir `pause` es una línea.

## Viabilidad técnica
- **Encaje:** limpio. Un estado `"paused"` que el bucle respete (no actualiza física, solo dibuja la escena
  congelada + overlay) y un binding de tecla. **No toca física ni painter** (solo deja de llamar al update).
- **Coste:** bajo-medio (estado + overlay + tecla). **Riesgo:** bajo.
- Reaprovecha el listado de controles de [[idea-controles-en-menu]] (un solo helper que pinte la tabla de
  teclas, usado en título y en pausa).

## Conveniencia
**Baja-media.** Comodidad, no contenido. Tiene más sentido **después** de tener el listado de controles del
menú (comparten el render de la tabla de teclas). Encaja con la esencia (juego sin reloj → pausar no afecta
al diseño).

## Sugerencia
**Mantener como pulido tardío**, junto a [[idea-controles-en-menu]] (comparten el render de controles) y a
las pantallas de victoria/game-over ([[idea-pantallas-victoria-gameover]]), que también viven en la capa de
pantallas/estados.
