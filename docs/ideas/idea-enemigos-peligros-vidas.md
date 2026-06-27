# Idea — Enemigos, peligros letales y vidas

> **Estado: 🅿️ APARCADA (quizá en el futuro).** Origen: IA. Decisión sostenida de la usuaria: los enemigos
> están aparcados ([[alien-pocho-fidelity]]). Procesado 2026-06-27.

## Qué es
El sistema de daño/supervivencia del GDD (§6), hoy sin implementar:
- **Pinchos letales:** hoy decorativos (`room.hazards` + `AP.spikes`). Tocarlos = perder vida.
- **Enemigos:** patrulla simple (ida/vuelta o ciclo de celdas); contacto = perder vida.
- **Vidas:** `game.lives` baja al recibir daño; reaparición con breve invulnerabilidad; Game Over a 0.

## Viabilidad técnica
- **Pinchos letales:** barato — ya existen como decoración; añadir detección de contacto (AABB con la huella
  del robot) y resta de vida.
- **Enemigos:** medio — entidades móviles nuevas con patrulla; entran al **mismo painter** (cajas → `depthSort`,
  ya soporta entidades) y a la detección de contacto. **`npm test`** (oráculo painter).
- **Vidas + reaparición:** medio — estado en `game.js`, reaparición en la entrada de sala (la entrada ya la
  conoce `data/mission.js`/`world.js`), invulnerabilidad temporal. Conecta con
  [[idea-pantallas-victoria-gameover]] (Game Over) y el HUD (carita de vidas, ya dibujada).

## Conveniencia
Aporta el pilar "acción" del puzzle-acción, pero la usuaria lo mantiene **aparcado** a propósito: el foco
actual es el motor y el puzzle. No emprender sin decisión explícita de la usuaria.

## Sugerencia
**Mantener aparcada.** Si se reactiva, orden natural: pinchos letales (lo más barato) → vidas + reaparición
+ Game Over → enemigos en patrulla. El dron ([[idea-mas-salas-retos]]) sería el primer enemigo natural.
