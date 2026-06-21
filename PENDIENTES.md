# PENDIENTES.md — Alien Pocho

Solo tareas **por hacer**. Sin históricos ni cosas ya resueltas.
Contexto y diseño: [GDD.md](GDD.md) · investigación del original: [RESEARCH.md](RESEARCH.md).

## Ficheros (orientación)
- `engine.js` — MOTOR iso genérico `ENGINE.*` (proyección, `box`/`poly`/`honeycomb`,
  `darken`/`lighten` y el painter `depthSort`). Sin nada específico del juego.
- `assets.js` — biblioteca de dibujo `AP.*` (monocromo, una tinta por sala); usa `ENGINE`.
- `game.js` — SIMULACIÓN: salas/`buildWorld`, entidades (`player`+`entities[]`), física,
  estado `game`, `interact`, `checkExits`, `resetGame`. Lee `CFG`/`ctx`/`P`/`pressed`/`held`
  de la shell; expone sus símbolos como globales del realm.
- `index.html` — PRESENTACIÓN + shell: `CFG`, input, proyector, `render`, HUD, pantallas,
  bucle `loop`, controles táctiles.
- `assets-demo.html` — catálogo visual de assets.
- Carga de scripts: `engine.js` → `assets.js` → `game.js` → bloque inline de `index.html`.
  (Se comparten globales léxicos entre scripts del mismo realm: igual que `ENGINE`/`AP`.)
- Pruebas: `python3 -m http.server 8123` (`.claude/launch.json`).
  Debug: `window.__pocho = { player, entities, game, room, world }` desde la consola.

## 🐞 Bugs conocidos
- (ninguno pendiente ahora mismo)

## 🔜 Roadmap

### Fase 6 — Peligros, enemigos y vidas
> Infra lista: el jugador ya es una ENTIDAD en `entities[]` (con `update`/`addDraws`).
> Pinchos y enemigos se añaden como entidades nuevas que implementen esos dos métodos;
> el bucle las actualiza y el painter las ordena solo. Verificar mecánicas con fuentes
> de *Alien 8* antes de fijar valores (daño, invulnerabilidad, patrón de patrulla).
- **Pinchos letales**: hoy decorativos (`room.hazards` + `AP.spikes`). Tocarlos = perder
  vida. Ya hay pinchos colocados en PUENTE.
- **Enemigos**: patrulla simple (ida/vuelta o ciclo de celdas); contacto = perder vida.
- **Vidas**: `game.lives` baja al recibir daño; **reaparición** en la entrada de la sala
  con breve invulnerabilidad; **Game Over** a 0 vidas.

### Fase 7 — Reloj como límite real
- **AÑOS LUZ**: la variable `game.lightYears` existe pero **ya no se muestra** en el HUD
  (se quitó del marcador). Reintroducirlo como cuenta atrás real → **Game Over al llegar
  a 0**, con su propio indicador.

### Fase 8 — Presentación y pulido
- **Pantallas** de victoria y game over con entidad propia (hoy solo banner). El menú
  de inicio (estado `title`) ya existe con marco sci-fi; reutilizar su estilo para ellas.
- **Audio** WebAudio (saltar, coger, colocar, daño) + toggle de silencio persistente.
- **Más salas / más retos**: plataformas móviles; dron teledirigido (`AP.drone` ya existe).

## 🧰 Calidad / técnica (no bloquea)
- Cachear las paredes: `honeycomb` se recalcula cada frame ([assets.js](assets.js)); si
  crece el nº de salas/paredes, dibujarlas a un canvas offscreen.
- Afinar a gusto `CFG.JUMP_*` / `CFG.WALK` (distancias/alturas de salto y velocidad).
- Separación por capas COMPLETA: `engine.js` (motor) · `assets.js` (dibujo) ·
  `game.js` (simulación) · `index.html` (presentación + shell).
- Añadir un `CLAUDE.md` breve (arranque, mapa de ficheros, reglas "no romper").
- Robustez móvil: la orientación se fuerza con `transform: rotate(90deg)`; probar en
  dispositivo real.

## ⚠️ No romper (restricciones de diseño)
- **Fidelidad estricta a *Alien 8*** (memoria del proyecto): verificar mecánicas con
  fuentes antes de implementar.
- Estética: **monocromo, una tinta por sala + negro** (sin rampas de 3 tonos). Robot =
  tinta de la sala. Paredes **planas** teseladas (no cubos). Puertas con **marco** 3D.
- Movimiento **píxel a píxel pero tipo tanque** (no 8 direcciones libres).
- Puzzle de circuitos en **ciclo entre salas**: cada sala da una forma y pide otra;
  mantener **resoluble** (un circuito a la vez) al añadir salas.
