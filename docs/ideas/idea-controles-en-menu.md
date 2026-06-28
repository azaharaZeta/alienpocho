# Idea — Listar los controles de teclado en el menú principal

> **Estado: PENDIENTE — Prioridad MEDIA (quick win).** Origen: usuaria, procesado 2026-06-28.

## Qué pide
En la **pantalla de título**, mostrar la lista de controles de teclado (girar, avanzar, saltar, usar).

## Estado actual (código)
- La pantalla de título la dibuja `screens.drawTitleScreen` ([screens.js:37-78](../../src/screens.js)):
  marco sci-fi, logo neón "ALIEN/POCHO", mascota robot, créditos y prompt "PULSA UN BOTON PARA EMPEZAR".
  Hay espacio libre en la mitad inferior.
- Las teclas son datos: `CONTROLS` en [config.js:55-65](../../src/config.js)
  (`turnLeft/turnRight/forward/jump/use`, cada una con varios códigos).

## Viabilidad técnica
- **Encaje:** limpio y aislado. Añadir un bloque de texto en `drawTitleScreen` que liste las acciones.
  Lo ideal: **derivarlo de `CONTROLS`** (mapear código→glifo, p. ej. `ArrowLeft`→"←", `Space`→"ESPACIO")
  para que no se desincronice si se reasignan teclas; o, más simple, un texto fijo legible (las teclas casi
  no cambian). Recomendado lo primero si el mapeo código→glifo es corto.
- **Coste:** bajo. **Riesgo:** nulo (solo presentación de la pantalla de título; no toca juego ni física).
- Cuidar el encuadre: el título ya tiene logo + mascota + créditos + prompt; ubicar los controles sin
  amontonar (posiblemente columna a un lado o bloque bajo la mascota).

## Conveniencia
**Media-alta** para una de coste tan bajo: el juego usa control tipo tanque (no obvio), así que listar las
teclas en el menú ayuda a quien entra por primera vez. Alineado con el GDD (§9 ya documenta la tabla de
controles) y la esencia retro (los juegos Spectrum listaban teclas en la pantalla de carga).

## Sugerencia
**Mantener; quick win.** Implementar en `screens.js`, derivando de `CONTROLS` si el mapeo código→glifo sale
barato. Se complementa con [[idea-pantalla-pausa]] (mismo listado reutilizable en pausa).
