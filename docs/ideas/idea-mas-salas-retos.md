# Idea — Más salas / retos que exploten las mecánicas nuevas

> **Estado: PENDIENTE — Prioridad BAJA-MEDIA (contenido, continua).** Origen: IA, procesado 2026-06-27.

## Qué es
Diseñar más salas/retos que aprovechen las mecánicas ya implementadas: **apilar/empujar objetos** para
alcanzar zócalos altos, **plataformas móviles**, y el **dron** (el asset `drone` ya existe en el registro,
sin comportamiento).

## Viabilidad técnica
- **Salas/retos con mecánicas existentes (apilar/empujar):** barato — es **editar datos** (`data/rooms.js`
  + `data/mission.js`), sin tocar lógica. Cuidado con vanos de puerta ([[alien-pocho-map-door-clearance]]) y
  dims PARES ([[alien-pocho-modular-walls-doors]]).
- **Plataformas móviles:** mecánica **nueva** (un sólido que se mueve y arrastra lo que tiene encima) → toca
  física/painter (orden de algo en movimiento) → coste medio-alto, **`npm test`**. Es media-idea aparte.
- **Dron con comportamiento:** hoy es solo sprite; darle patrulla lo emparenta con los enemigos
  ([[idea-enemigos-peligros-vidas]], aparcados). **Aviso al colocarlo por primera vez:** el `drone` arrastra
  una huella ELEVADA (anti-#2) que solo se ha ejercitado en tool/tests; verificar su oclusión/orden en escena
  real con `j`/`k`/`l` (ver el caveat en [[idea-motor-bounds-visuales]]).

## Conveniencia
Media para lo barato (más puzzles con lo que ya hay = más juego por poco coste). Las plataformas móviles y
el dron activo son features, no "más salas", y conviene separarlas.

## Sugerencia
**Dividir:** (a) **añadir salas/retos** con apilar/empujar = hacer ya, es datos; (b) **plataformas móviles**
y (c) **dron activo** = sacarlas a sus propias ideas cuando se aborden (ambas tocan motor/comportamiento).
Empezar por (a).

## Avance (2026-06-28)
- Se colocaron **5 ordenadores recogibles** (`computer`) en salas (NUDO, CRUCE, POZO, VERTEDERO, CISTERNA) —
  primer contenido que explota los recogibles genéricos. Recordatorio para futuras colocaciones de móviles/
  recogibles: usar coordenada CONTINUA `x,y` + `z` numérico (no `cx,cy`), o no se podrán coger/empujar (ver
  `bug-reactor-bloque-sin-z.md`).
- Sigue pendiente lo demás (apilar para zócalos altos, plataformas móviles, dron activo).
