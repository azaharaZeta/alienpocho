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
- `engine.js` — MOTOR iso genérico `ENGINE.*` (proyección, `box`/`poly`/`honeycomb`,
  `darken`/`lighten` y el painter `depthSort`, con gating por solape en pantalla). Sin nada
  específico del juego.
- `assets.js` — biblioteca de dibujo `AP.*` (monocromo, una tinta por sala); usa `ENGINE`.
- `game.js` — SIMULACIÓN: salas/`buildWorld`, entidades (`player`+`entities[]`), física
  (`roomSolids`/`blocksHoriz`/`supportHeight`), objetos físicos (`tryPush`/`interact`),
  estado `game`, `checkExits`, `resetGame`. Lee `CFG`/`ctx`/`P`/`pressed`/`held` de la shell.
- `index.html` — PRESENTACIÓN + shell: `CFG`, input, proyector, `render`, HUD (iconos SVG),
  pantallas, bucle `loop`, controles táctiles, layout por orientación, pantalla completa.
- `assets-demo.html` — catálogo visual de assets.
- Carga de scripts: `engine.js` → `assets.js` → `game.js` → bloque inline de `index.html`
  (con `?v=N` para romper caché del navegador; subir N al editar).
- Pruebas: `python3 -m http.server 8123` (`.claude/launch.json`).

## 🐞 Bugs conocidos
- (ninguno pendiente ahora mismo)

## 💡 Ideas aportadas por la usuaria
> Volcado libre de ideas (algunas sensatas, otras locas). **No son órdenes ni están
> priorizadas**: son material para analizar y estudiar cuando toque. Solo las edita un humano.
-  Definir juego de colores de la UI (botones y textos) alineado con el color  de la sala. Por ej: botones del mismo color que la sala. Textos en un color secundario. Sala azul, color secundario=morado (el actual). Y así.
- Mejorar paneles de pared. Que en lugar de dibujar los hexagonos rotos de la parte de arriba, directamente no se dibujen.
- Mejorar estéticamente los bloques-cubo. Las esquinas hacerlas más pronunciadas, y transparentes.
- Añadirle algun detalle más al robot. Está muy bien como está, solo sería añadirle algún detallito en el cuerpo.
- Habitaciones rectangulares (pasillos)
- Esta es gorda: Convertir el juego en un roguelike. Cada run, mapa random, ubicaciones random.

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

### Mecánicas de objetos físicos (ya en marcha)
- Los circuitos son OBJETOS físicos: se empujan, se llevan, se apilan y se suben encima. Los
  zócalos activados vuelven a ser sólidos. Queda **rediseñar los puzzles por sala** para
  exigir estas mecánicas (ahora las posiciones son provisionales/accesibles sin reto).

## 🧰 Calidad / técnica (no bloquea)
- Cachear las paredes: `honeycomb` se recalcula cada frame ([assets.js](assets.js)); si crece
  el nº de salas/paredes, dibujarlas a un canvas offscreen.
- Afinar a gusto `CFG.JUMP_*` / `CFG.WALK` (distancias/alturas de salto y velocidad).
- Añadir un `CLAUDE.md` breve (arranque, mapa de ficheros, reglas "no romper").
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
