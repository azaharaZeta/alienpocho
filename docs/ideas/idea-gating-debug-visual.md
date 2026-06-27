# Idea — Quitar (o "gatear") el debug visual `j`/`k`/`l` antes de publicar

> **Estado: PENDIENTE — Prioridad BAJA (tarea de pre-publicación).** Origen: IA, procesado 2026-06-27.

## Qué es
Los overlays de desarrollo (cubo de referencia / región estándar / punto de anclaje), conmutados por
`j`/`k`/`l`, viven **dentro del juego** (`render.js` → `drawDebug`; teclas en `config.js`). Son utillaje
temporal, no para el jugador. Antes de publicar: quitarlos o ponerlos tras un **gate** (flag de debug,
combinación oculta, build de desarrollo).

## Viabilidad técnica
- **Encaje:** trivial. Un flag `CFG.DEBUG` que condicione tanto el binding de teclas como `drawDebug`.
- **Coste:** muy bajo. **Riesgo:** nulo para la jugabilidad.

## Conveniencia
Baja **ahora** (el debug es útil en desarrollo, justo se ampliaron las cajas del robot), pero **necesaria
antes de publicar**. No tiene sentido hacerla hasta acercarse a una release.

## Sugerencia
**Mantener aparcada hasta la fase de publicación.** Preferible **gatear** (flag) sobre borrar, para no
perder la herramienta. Relacionada con que el debug aún visualiza tensiones abiertas del motor
([[idea-motor-bounds-visuales]], [[idea-robot-huella-cuadrada]]).
