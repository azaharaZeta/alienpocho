# Idea — Validador de solubilidad de la misión (test)

> **Estado: HECHA — 2026-06-29.** Origen: IA, procesado 2026-06-28.
> Implementado en `test/solve.mjs` (en `npm test`): flood-fill de alcanzabilidad multi-sala reutilizando la
> FÍSICA real (`canStandOn`/`supportHeight`) y la geometría de puerta (`doorSpan`) — sin modelo paralelo.
> Comprueba que cada zócalo es alcanzable a pie y que hay ≥ tantos circuitos ALCANZABLES de cada forma como
> zócalos la piden. Modelo acotado (no saltos/empuje/transmutación; el mapa actual es ground-only). **Ya pilló
> un bug real**: un zócalo de ALMACÉN tapiado por estanterías → reubicado. Ampliar el modelo si futuras
> mecánicas entran en el camino crítico.

## Qué es
Un test que **demuestre que la misión tiene solución**: una búsqueda (BFS/DFS sobre estados del puzzle) que
confirme que existe una secuencia de acciones que llena todos los zócalos. Eleva tu suite de "oráculo de
no-regresión de código" a **oráculo de no-regresión de diseño**: cada vez que edites `rooms.js`/`mission.js`,
el test avisa si has dejado el puzzle irresoluble.

## Viabilidad técnica
- **Encaje:** muy alineado con tu cultura de tests sin navegador (`smoke`/`painter`/`assets`/`mission` en
  `test/`). Ya tienes `test/mission.mjs` validando integridad misión↔mapa; esto es el paso siguiente.
- **Reto:** modelar el **espacio de estados** (posición robot + circuitos colocados/llevados + bloques movidos)
  y aplicar las reglas de [physics.js](../../src/physics.js)/[game.js](../../src/game.js) en modo headless. La
  física ya es **pura** y corre en Node (regla de oro del proyecto), así que es factible.
- **Coste:** medio-alto (depende de cuánta mecánica modeles). **Riesgo:** bajo (es test, no toca runtime).
  **Cuidado:** el espacio crece con mecánicas nuevas ([[idea-bloques-deslizantes]], [[idea-estacion-transmutacion]],
  [[idea-cintas-ascensores]]) → empezar con un modelo acotado.

## Conveniencia
Media-alta y **creciente**: cuanto más contenido añadas ([[idea-mas-salas-retos]]), más te protege. Es el
multiplicador que hace seguro meter salas sin romper la resolubilidad.

## Sugerencia
Empezar **acotado**: modelar solo coger/soltar circuitos y empujar bloques (lo que afecta a llenar zócalos),
con límite de profundidad. Ampliar el modelo a la par que añades mecánicas. Encadenar con
[[idea-estacion-transmutacion]] (que el solver entienda transmutar).
