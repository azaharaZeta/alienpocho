# Idea — Rediseño del HUD / layout de UI fija

> **Estado: PENDIENTE — Prioridad ALTA.** Origen: usuaria, procesado 2026-06-28.
> Depende en parte de [[idea-objetos-recogibles-genericos]] (la etiqueta del objeto recogido necesita
> que todo recogible tenga `name`).

## Qué pide
Ahora que las salas son ≤8 en ambos ejes y se centran en un marco fijo (pico frontal al centro), la UI
**ya no necesita adaptarse al hueco**: es fija. Sobre esa base, reorganizar el HUD:

1. **Revisar/limpiar código obsoleto de resize de la UI** (UI que se recolocaba "según el hueco").
2. **Título "Alien Pocho" arriba a la izquierda.** Que no colisione con la info de debug → mover el debug
   **debajo del título** (o donde no moleste).
3. **Vidas → a la derecha.**
4. **Contador de circuitos desligado del visor del objeto recogido:** llevarlo a otra zona del UI con un
   label tipo **"Circuitos activados"**.
5. **Objeto recogido → a la izquierda**, con un **label con el nombre del objeto** (requiere
   [[idea-objetos-recogibles-genericos]]).
6. **(Bug que se resuelve aquí)** La representación del objeto recogido **no cabe en su cuadro**
   (`drawCarrySlot`): rehacer el encuadre del visor al recolocarlo.

## Estado actual (código)
- HUD: [render.js:210-272](../../src/render.js) (`drawHUD`/`drawStat`/`drawTitle`/`drawCarrySlot`/`drawMiniRobot`).
  Hoy todo el marcador va **abajo a la izquierda** dentro de la "V" del marco: título "ALIEN POCHO" en la
  fila inferior, y encima **dos filas apiladas**: `[casilla del objeto] N/M` (circuitos) y `[mini-robot] ×N`
  (vidas). El **contador de circuitos comparte fila con el visor del objeto** ([render.js:239-240](../../src/render.js)).
- Overlay de debug j/k/l: [render.js:60-63](../../src/render.js) escribe "DEBUG …" en la **esquina sup-izq**
  (x=6,y=6) → ahí es donde la usuaria quiere el título; por eso pide reubicar el debug.
- Visor del objeto: `drawCarrySlot` ([render.js:132-141](../../src/render.js)) recorta el sprite a un marco
  de semilado 9 px y lo dibuja con un offset fijo (`cy+4`) → de ahí que algunas formas **no quepan**.
- Proyector y posiciones fijas: `view.projectorFor` ([view.js:28-34](../../src/view.js)) ya ancla el pico
  frontal al centro de un marco fijo 8×8; minimapa fijo a la derecha y marcador a la izquierda
  ([render.js:163-208](../../src/render.js)). El cap de salas ≤8 (PAR ∈ {4,6,8}) lo fuerza `world.makeRoom`.

### Sobre el "código obsoleto de resize"
Grep del runtime (`src/`, `index.html`): **no quedan listeners de resize ni recolocación de UI "según el
hueco"**. El canvas es fijo 320×240 (escala por CSS) y la UI ya está fija (minimapa derecha, marcador
izquierda, proyector de marco fijo). La parte de "limpiar resize" está, de hecho, **casi absorbida** por el
refactor del marco fijo; queda **confirmar** que no hay restos al recolocar las piezas (sobre todo en
`drawHUD`, donde las `y` se calculan a partir del pico `fc = P(room.w, room.h, 0)` — eso es estable, no
"resize", pero conviene revisarlo al mover bloques).

## Viabilidad técnica
- **Encaje:** acotado a **presentación** (`render.js` HUD + quizá `screens.js` si el título se unifica).
  **No toca física ni el painter `depthSort`** → riesgo de regresión bajo (no requiere `npm test` por
  física, aunque conviene correrlo igualmente: es barato).
- **Coste:** medio (es relayout + repensar el visor del objeto para que quepa). El punto 5 (label de nombre)
  **bloquea hasta** tener `name` por asset → ver [[idea-objetos-recogibles-genericos]].
- **Riesgo:** bajo. El único cuidado: el debug overlay y el título no deben pisarse (resolver moviendo el
  texto de debug a una franja propia bajo el título).

## Conveniencia
**Alta.** Es lo que la usuaria está mirando ahora mismo; el HUD actual está saturado (contador pegado al
visor) y mezcla conceptos (circuitos colocados ≠ objeto que llevas). Reordenarlo aclara el juego y prepara
el terreno para objetos recogibles variados. Alineado con la esencia retro (HUD tipo Alien 8, GDD §7).

## Sugerencia
**Mantener, como una de las primeras tareas.** Orden propuesto:
1. Hacer/avanzar [[idea-objetos-recogibles-genericos]] (da el `name` y el modelo de recogido genérico).
2. Relayout del HUD: título sup-izq + debug debajo; vidas a la derecha; "Circuitos activados" en su propia
   zona; visor del objeto a la izquierda con su label, **rehaciendo `drawCarrySlot` para que cualquier
   sprite quepa** (resolver el bug del cuadro de paso).
3. Confirmar de paso que no queda lógica de resize obsoleta.

## Nota de bug absorbido
El bug conocido *"la representación del objeto recogido no cabe en su cuadro"* se resuelve dentro de esta
idea (punto 6): no se trata como bug aparte. Se retira del listado de BUGS.
