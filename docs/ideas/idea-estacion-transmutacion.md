# Idea — Estación de transmutación de circuitos (trait `stateful`)

> **Estado: PENDIENTE — Prioridad MEDIA (estrena un trait ya reservado).** Origen: IA, procesado 2026-06-28.

## Qué es
Una máquina que **cambia la forma de un circuito** (cubo → pirámide → domo → cilindro). Abre puzzles del tipo
"el zócalo pide una pirámide y solo tienes un cubo: transfórmalo". Da combinatoria nueva **sin** añadir más
piezas al inventario.

## Viabilidad técnica
- **Encaje:** el trait `stateful` **ya existe en el registro y está sin usar** ([data/assets.js](../../src/data/assets.js)).
  Esta idea le da su primer uso real.
- Los circuitos ya son assets genéricos con `shape` y la misión ya razona por forma (`MISSION.requires` en
  [data/mission.js](../../src/data/mission.js)). Transmutar = cambiar el `shape`/asset de la instancia que
  lleva el robot al interactuar con la estación → reusa la interacción `carriable` de [game.js](../../src/game.js).
- **Coste:** medio (asset estación + drawer + regla de interacción + decidir el "mapa de transformación").
  **Riesgo:** bajo (no toca física ni painter; es estado de datos).

## Conveniencia
Media-alta: profundidad de puzzle con piezas que ya tienes. Hay que vigilar que el **validador de solubilidad**
([[idea-validador-solubilidad]]) entienda las transmutaciones, o el puzzle podría volverse irresoluble sin
avisar.

## Sugerencia
Diseñar primero el grafo de transformaciones (¿cíclico cubo→pir→domo→cil→cubo? ¿coste/limitado?) en datos.
Encadenarla con [[idea-validador-solubilidad]] para no romper la garantía de que la misión tiene solución.
