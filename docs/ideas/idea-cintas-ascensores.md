# Idea — Cintas transportadoras y ascensores (traits `conveyor` / `lift`)

> **Estado: PENDIENTE — Prioridad MEDIA (feature de motor; antes en [[idea-mas-salas-retos]]).** Origen: IA, procesado 2026-06-28.

## Qué es
Superficies que **mueven lo que tienen encima**: una **cinta** desplaza objetos/robot en una dirección;
un **ascensor/plataforma** los sube/baja en `z`. Desbloquea zócalos altos sin depender solo de apilar y da
puzzles de timing suave (sin reloj global).

## Viabilidad técnica
- **Encaje:** es la "plataforma móvil" que ya se identificó como feature a separar en [[idea-mas-salas-retos]].
  La clave: aplicar al apoyado el delta de la superficie. La física ya identifica el apoyo
  (`supportHeight`/`objSupport`, [physics.js](../../src/physics.js)); falta arrastrar lo que descansa encima.
- **El punto delicado** es un **sólido en movimiento**: el painter ordena por la huella (`aabb`) y hoy todo lo
  sólido está quieto salvo el robot. Un sólido que se mueve hay que ordenarlo cada frame por su posición real
  (ya lo hace el robot, así que el camino existe) y revalidar que no aplaste al robot. Toca física + painter →
  **`npm test` obligatorio**.
- **Coste:** medio-alto. **Riesgo:** medio (orden/colisión de algo que se mueve).

## Conveniencia
Media-alta: abre verticalidad y movimiento, muy "Filmation". Pero es la mecánica más cara de las nuevas.

## Sugerencia
Hacer **ascensor antes que cinta** (movimiento en `z` puro, trayecto fijo ida/vuelta) — es más fácil de razonar
que el arrastre horizontal. Reusar el tratamiento del robot como "sólido que se reordena cada frame". Sacarlo de
[[idea-mas-salas-retos]] (queda aquí su análisis).
