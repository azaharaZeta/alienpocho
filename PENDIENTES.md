# PENDIENTES.md — Alien Pocho

> **Rumbo del proyecto (actualizado).** Alien Pocho nació como homenaje/reconstrucción de
> *Alien 8*, pero **a partir de ahora diverge**: exploramos jugabilidades propias y hacemos
> evolucionar el juego sin atarnos a reproducir el original. Se conserva la **ESENCIA**
> —gráficos (iso monocromo), pantallas, personaje (robot Pocho) y controles tipo tanque—;
> el resto (reglas de puzzle, objetos, salas, mecánicas) es libre de cambiar.
>
> Lo de abajo **ya NO es un roadmap obligatorio**: es un POOL de ideas/direcciones posibles,
> **sin orden ni compromiso**. El orden de exploración lo decide la usuaria sobre la marcha.

Solo cosas **por hacer** o **por explorar**. Contexto y diseño: [GDD.md](GDD.md) ·
investigación del original: [RESEARCH.md](RESEARCH.md).

## Ficheros (orientación)
> Refactor de estructura COMPLETO (Fases 0-5 de [ASSESSMENT.md](ASSESSMENT.md)): ES modules
> bajo `src/`, sin globales ni ciclos de shell, simulación y presentación troceadas, y geometría/
> paleta unificadas en `config.js`/`palette.js` (fuente única). Red de seguridad: `npm test`.
- `src/config.js` — PARÁMETROS (fuente única): `CFG` (dims/física/salto/colores UI), `CONTROLS`,
  `ORIGIN`, `POPT` y la GEOMETRÍA compartida `DOOR`/`PROP`/`ROBOT`/`SOCKET`/`SCENE`. Hoja.
- `src/palette.js` — colores del juego (`INKS`/`INK2`/`ROBOT_INK`). Hoja.
- `src/engine.js` — MOTOR iso genérico `ENGINE.*` (proyección, `box`/`poly`/`honeycomb`,
  `darken`/`lighten` y el painter `depthSort` con gating por solape). Sin nada del juego.
- `src/assets.js` — biblioteca de dibujo `AP.*` (monocromo); usa `engine` + `palette` + `config`.
- `src/input.js` — teclado + flancos + `held`/`pressed` + táctil. DOM diferido a `init*()`.
- `src/view.js` — `ctx` del canvas + proyector `P` (binding vivo) + tema. DOM diferido a init.
- `src/data/rooms.js` — EL MAPA como DATOS puros (salas, bloques, objetos, zócalos, salidas;
  paleta por índice). Editar niveles aquí, sin tocar lógica.
- `src/world.js` — motor de mundo: `makeRoom` (límites + clona arrays mutables) + `buildWorld`
  + layout cenital. Consume `data/rooms.js`.
- `src/physics.js` — FÍSICA pura (geometría/colisión sobre `room`, sin jugador): `roomSolids`/
  `blocksHoriz`/`supportHeight`/`canStandOn`/`objBlocked`/`objSupport`/`updateObjects`. Usa `CFG`/`AP`.
- `src/player.js` — ENTIDAD jugador: `player`, `entities[]`, control tanque (`update`), empuje
  (`tryPush`), dibujo (`addDraws`). Importa física + input + view + game (uso en call-time).
- `src/game.js` — ESTADO + REGLAS: `game`, `interact` (coger/colocar + victoria), `world`,
  `room`, `checkExits`, `resetGame`. Importa física + player + world.
- `src/render.js` — RENDER de escena (suelo+paredes+cajas por profundidad) + HUD + minimapa +
  banner de victoria. Expone `render(room)`; lee estado de game.js, dibuja con AP/engine/view.
- `src/screens.js` — pantallas de no-juego: `drawTitleScreen(now, pal)` (título). Paleta por parámetro.
- `src/main.js` — ARRANQUE + bucle `loop` (título↔juego), `init*()`, fullscreen, `window.__pocho`.
  Único `<script type="module">` de `index.html`.
- `index.html` — markup + `styles.css`. `styles.css` — estilos de la shell (layout/mandos).
- `assets-demo.html` — catálogo visual de assets (importa `src/assets.js` como módulo).
- `test/smoke.mjs` — oráculo de no-regresión (mundo/painter/física/objetos). `npm test`.
- Carga: ES modules nativos (sin build). Requiere servir por http (no `file://`).
- Pruebas/arranque: `npm run serve` o `python3 -m http.server 8123` (`.claude/launch.json`).

## 🐞 Bugs conocidos
- (ninguno pendiente ahora mismo)

## 💡 Ideas aportadas por la usuaria
> Volcado libre de ideas (algunas sensatas, otras locas). **No son órdenes ni están
> priorizadas**: son material para analizar y estudiar cuando toque. Solo las edita un humano.
- Mejorar estéticamente los bloques-cubo. Las esquinas hacerlas más pronunciadas, y transparentes.
- Añadirle manitas al robot
- Mejorar las puertas, darles formas más trabajadas.
- Esta es gorda: Convertir el juego en un roguelike. Cada run, mapa random, ubicaciones random.
- Intercambiar las posiciones de botón de avanzar y de salto

## 🧭 Direcciones posibles (ideas, sin orden ni obligación)
> Antes esto era un "roadmap por fases". Ahora son ideas a tomar (o no) cuando apetezca.

### 🅿️ Enemigos, peligros y vidas — APARCADO (quizá en el futuro)
> **No se trabaja ahora.** Se deja anotado por si más adelante encaja.
> Infra ya lista: el jugador es una ENTIDAD en `entities[]` (con `update`/`addDraws`); un
> enemigo/pincho letal sería otra entidad que implemente esos métodos y el painter los ordena solo.
- **Pinchos letales**: hoy decorativos (`room.hazards` + `AP.spikes`). Tocarlos = perder vida.
- **Enemigos**: patrulla simple (ida/vuelta o ciclo de celdas); contacto = perder vida.
- **Vidas**: `game.lives` baja al recibir daño; reaparición con breve invulnerabilidad; Game Over a 0.

### Reloj "AÑOS LUZ" como límite real
- La variable `game.lightYears` existe pero no se muestra. Idea: cuenta atrás real con su
  indicador → Game Over al llegar a 0.

### Presentación y pulido
- **Pantallas** de victoria y game over con entidad propia (hoy solo banner); reutilizar el
  estilo del menú de inicio (estado `title`).
- **Audio** WebAudio (saltar, coger, soltar, colocar) + toggle de silencio persistente.
- **Más salas / retos** que exploten las mecánicas nuevas (apilar/empujar objetos para
  alcanzar zócalos altos); plataformas móviles; dron (`AP.drone` ya existe).

### Salas / espacios
- ✅ **Salas rectangulares (pasillos)**: `makeRoom` admite `w`/`h` con LÍMITES (w,h ∈ [3,13] y
  **w+h ≤ 16**, recortados si se exceden). El proyector se centra por sala y el marco del HUD
  sigue el pico del rombo; los iconos (circuitos/vidas) caben en los extremos probados (8×8,
  13×3, 3×13, 12×4). `checkExits` recoloca en la puerta de la sala destino (tamaños distintos).
  Sala de demo `PASILLO` (12×4) colgando de REACTOR por la derecha (`xp`).
- 🔜 **Formas más complejas** (giros, L, cruces): hoy la huella es un rectángulo único. Para
  giros/L habría que componer la sala de varios rectángulos (multi-celda) y revisar suelo,
  paredes, colisión y el painter. Es el siguiente paso natural si se quiere variedad.

### Mecánicas de objetos físicos (ya en marcha)
- Los circuitos son OBJETOS físicos: se empujan, se llevan, se apilan y se suben encima. Los
  zócalos activados vuelven a ser sólidos. Queda **rediseñar los puzzles por sala** para
  exigir estas mecánicas (ahora las posiciones son provisionales/accesibles sin reto).

## 🧰 Calidad / técnica (no bloquea)
- Cachear las paredes: `honeycomb` se recalcula cada frame ([assets.js](assets.js)); si crece
  el nº de salas/paredes, dibujarlas a un canvas offscreen.
- Afinar a gusto `CFG.JUMP_*` / `CFG.WALK` (distancias/alturas de salto y velocidad).
- ✅ `CLAUDE.md` breve (arranque, mapa de ficheros, reglas "no romper") — hecho.
- Robustez móvil: layout por orientación con CSS Grid (vertical: pantalla arriba + mandos
  abajo; horizontal: mandos a los lados) + botón de pantalla completa / PWA. Probar en
  dispositivo real.

## 🧬 Esencia a mantener (al evolucionar, esto se conserva)
- **Estética**: monocromo, una tinta por sala + negro (sin rampas de 3 tonos). Robot = tinta
  de la sala. Paredes **planas** teseladas (no cubos). Puertas con **marco** 3D. Iconos line-art.
- **Render iso**: painter por cajas (`depthSort`) robusto (orden jerárquico x→y→z + gating por
  solape en pantalla para evitar ciclos).
- **Controles tipo tanque**: girar 90° izq/dcha + avanzar recto + saltar; movimiento píxel a
  píxel (no 8 direcciones libres).
- **Personaje**: el robot Pocho y sus 4 vistas.
- **Pantallas / flip-screen** entre salas.
- Todo lo demás (reglas de puzzle, qué objetos hay, número y forma de salas, límites de
  tiempo, modos de juego) **es libre de cambiar**.
