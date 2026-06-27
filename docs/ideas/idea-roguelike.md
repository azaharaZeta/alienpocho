# Idea — Convertir el juego en roguelike (mapa y ubicaciones aleatorias por run)

> **Estado: APARCADA — "norte lejano", NO emprender ahora.** Origen: usuaria ("esta es gorda"),
> procesado 2026-06-27.

## Qué pide
Que cada partida (run) genere un **mapa aleatorio** con **ubicaciones aleatorias** de circuitos, zócalos y
objetos. Cambio de género: de puzzle laberíntico hecho a mano a roguelike procedural.

## Viabilidad técnica
- **Encaje parcial con la arquitectura:** a favor, los datos ya están separados en capas puras
  (`data/rooms.js` = mapa, `data/mission.js` = puzzle, `data/assets.js` = piezas) y `world.js` ya **arma**
  el mundo desde esos datos. Un generador procedural produciría esas mismas estructuras → en teoría no toca
  motor ni física.
- **Lo difícil de verdad:** generar mapas **resolubles**. Hay que garantizar que cada circuito sea
  alcanzable, cada zócalo accesible, los vanos de puerta libres ([[alien-pocho-map-door-clearance]]),
  dimensiones de sala PARES ∈ {4,6,8} ([[alien-pocho-modular-walls-doors]]), y que el puzzle tenga solución
  (un solver/validador). Eso es un proyecto en sí.
- **Coste:** ALTO (generador + validador de solubilidad + balance). Riesgo: medio-alto, pero contenido en la
  capa de datos.

## Conveniencia
**Ambivalente.** Choca con la esencia actual (homenaje a *Alien 8*: salas **diseñadas a mano**, puzzle
autoral). El proyecto es libre de evolucionar ([[alien-pocho-fidelity]]), pero esto es un **cambio de
género**, no una mejora incremental. Aporta rejugabilidad a costa del diseño cuidado de cada sala.

## Sugerencia
**Aparcar como visión a largo plazo**, no como tarea próxima. Si algún día se aborda, hacerlo **incremental**:
primero un generador de **layout de salas** validado, luego colocación aleatoria de objetos sobre mapas fijos,
y solo al final puzzle procedural con solver. Decisión de la usuaria sobre si el juego quiere ir por ahí.
