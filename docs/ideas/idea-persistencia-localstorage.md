# Idea — Persistencia mínima (localStorage)

> **Estado: PENDIENTE — Prioridad BAJA-MEDIA (habilitador de otras ideas).** Origen: IA, procesado 2026-06-28.

## Qué es
Guardar en `localStorage`: (a) **ajustes** (mute, CRT on/off, quizá remapeo de teclas) y (b) opcionalmente
**progreso** (circuitos ya colocados, sala actual) para "continuar partida". Hoy el juego arranca de cero en
cada carga (sin persistencia de ningún tipo).

## Viabilidad técnica
- **Encaje:** módulo hoja `storage.js` (lee/escribe JSON) que el juego consulta al arrancar y al cambiar un
  ajuste. No toca física ni painter.
- **Ajustes:** trivial (clave→valor). Es el **habilitador** del toggle de [[idea-audio]], del de
  [[idea-postproceso-crt]] y de cualquier opción.
- **Progreso:** más delicado por el reset. `makeRoom` **clona** los arrays mutables ([world.js](../../src/world.js))
  para que `resetGame` no arrastre estado; restaurar progreso significa **inyectar** estado guardado tras el
  clonado (aplicar circuitos colocados sobre el mundo recién armado). Factible pero hay que respetar ese flujo.
- **Coste:** ajustes bajo; progreso medio. **Riesgo:** bajo (ajustes), medio (progreso, por el reset).

## Conveniencia
Media: por sí solo es comodidad, pero **desbloquea** la parte "persistente" de varias ideas ya planteadas
(audio, CRT, pausa con opciones).

## Sugerencia
Hacer **primero solo ajustes** (mute/CRT) — barato y desbloquea toggles. Dejar "continuar partida" para cuando
el bucle de juego (victoria/derrota) esté cerrado. Versionar el JSON guardado (campo `v`) por si cambia el mapa.
