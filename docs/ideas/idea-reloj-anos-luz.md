# Idea — Reloj "años luz" (cuenta atrás global) + Game Over por tiempo

> **Estado: PENDIENTE — Prioridad ALTA.** Origen: IA (procesado 2026-06-27). Es un hueco del **bucle
> principal** definido en el GDD, no un adorno.

## Qué es
El GDD lo da por núcleo del juego:
- §1 Visión / bucle: "colocar todos [los circuitos] → **victoria antes de que el reloj de años luz llegue a 0**".
- §7 HUD: "**AÑOS LUZ** restantes en un recuadro destacado (cuenta atrás), a la derecha".
- §8 Estados: "**Game Over:** 0 vidas **o reloj a 0**".

Pero en §11 (Estado) no aparece, y no hay mecánica de tiempo en `game.js`. O sea: **falta implementarlo**.

## Viabilidad técnica
- **Encaje:** limpio. Un contador en el estado de partida (`game.js`), decrementado por `dt` en el bucle
  (`main.js`), reseteado en `resetGame`. Game Over cuando llega a 0 (reusa el camino de Game Over que pidan
  las vidas/pantallas).
- **Coste:** bajo-medio. Lógica trivial; el grueso es el HUD (ya hay sitio reservado "AÑOS LUZ" en
  `render.js`) y decidir el valor inicial (parámetro en `CFG`, a afinar jugando).
- **Riesgo:** bajo. No toca física ni painter. Sí toca reglas de victoria/derrota → coordinar con
  [[idea-pantallas-victoria-gameover]].
- **Dependencia conceptual:** el Game Over como estado depende de tener (o no) vidas/pantallas; puede
  implementarse el reloj solo (a 0 → estado game over aunque sea banner provisional).

## Conveniencia
Alta: cierra el bucle de juego prometido y da **tensión/objetivo temporal** al puzzle, que hoy no tiene
presión. Totalmente alineado con la esencia (homenaje al "reloj" del original).

## Sugerencia
**Mantener e implementar pronto.** Empezar por: `CFG.LIGHTYEARS` inicial + decremento por `dt` +
condición de derrota + pintar la cuenta atrás en el hueco del HUD. Afinar el valor jugando.
