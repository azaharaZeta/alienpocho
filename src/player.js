/* =============================================================================
   ALIEN POCHO — ENTIDAD JUGADOR (player.js)
   -----------------------------------------------------------------------------
   El robot Pocho: estado, control TIPO TANQUE (girar 90° + avanzar + saltar), empuje
   de objetos y su dibujo (addDraws). Es una ENTIDAD: implementa update()/addDraws(),
   que el bucle (main.js) llama; añadir enemigos sería otra entidad con esos métodos.

   Usa la FÍSICA (physics.js) para colisión/apoyo, el INPUT (input.js) y, en tiempo de
   ejecución, el estado/reglas de game.js (game, interact, resetGame). La dependencia
   con game.js es cíclica pero SOLO se usa dentro de funciones (call-time), no al cargar.
   ============================================================================= */
"use strict";

import { CFG } from "./config.js";
import { AP } from "./assets.js";
import { pressed, held } from "./input.js";
import { ctx, P } from "./view.js";
import { blocksHoriz, supportHeight, objBox, overlapsBox, objBlocked } from "./physics.js";
import { game, interact, resetGame } from "./game.js";

export const player = {
  x: 1.5, y: 6.5, z: 0,        // posición
  vz: 0, vx: 0, vy: 0,         // velocidades (vx,vy solo durante el salto)
  onGround: true,
  facing: 3,                   // 0:+x  1:+y  2:-x  3:-y  (mira a -y = NE)
  turnTimer: 0,                // tiempo restante de la animación de giro
  walkPhase: 0,                // fase de la animación de caminar
  moving: false,
  jumpPending: false,          // salto "cargándose" (decidiendo corto/largo)
  jumpPendTime: 0,
  jdx: 0, jdy: 0               // dirección fijada al iniciar el salto
};

/* Las 4 direcciones de mirada, alineadas a los ejes del suelo.
   (Las dimensiones del sprite viven en AP.ROBOT, compartidas con assets.js.) */
const DIRS = [
  { dx: 1, dy: 0 },   // 0: +x  (abajo-derecha)
  { dx: 0, dy: 1 },   // 1: +y  (abajo-izquierda)
  { dx: -1, dy: 0 },  // 2: -x  (arriba-izquierda)
  { dx: 0, dy: -1 }   // 3: -y  (arriba-derecha)
];

/* Empuje: si justo delante (a la altura del pie) hay un objeto, intenta deslizarlo
   `step` en la dirección de avance. Si el destino está libre, mueve objeto y robot
   juntos (avance suave). Devuelve true si empujó. */
function tryPush(room, dir, step, feetZ) {
  const probeX = player.x + dir.dx * (CFG.PRAD + 0.04);
  const probeY = player.y + dir.dy * (CFG.PRAD + 0.04);
  let target = null;
  for (const o of room.objects) {
    const b = objBox(o);
    // Empujable solo si está A TU NIVEL: su BASE en/por debajo de tus pies (b.z0 ≤ feetZ+STEP)
    // y su cima por encima (es un obstáculo). Así NO empujas un objeto que está en alto
    // (p. ej. sobre una plataforma) cuando pasas por debajo.
    if (b.z0 <= feetZ + CFG.STEP && b.top > feetZ + CFG.STEP && overlapsBox(b, probeX, probeY)) { target = o; break; }
  }
  if (!target) return false;
  const nx = target.x + dir.dx * step, ny = target.y + dir.dy * step;
  if (objBlocked(room, target, nx, ny)) return false;
  target.x = nx; target.y = ny;
  player.x += dir.dx * step; player.y += dir.dy * step;
  return true;
}

/* player.update() — Modelo de control TIPO TANQUE (fiel a Alien 8 / Knight Lore):
   - girar 90° a izquierda/derecha (siempre alineado a los ejes del suelo)
   - avanzar en línea recta en la dirección que se mira
   - saltar en la dirección que se mira; dos tipos: corto/bajo y largo/alto
   El jugador es una ENTIDAD: el bucle actualiza entities[] y hace UNA vez por frame
   el snapshot de teclas para los flancos (por eso aquí ya no se guarda prevKeys). */
player.update = function (room, dt) {
  // Tras la victoria, el juego se detiene: cualquier acción reinicia la partida.
  if (game.won) {
    if (pressed("jump") || pressed("use") || pressed("forward")) resetGame();
    return;
  }
  const turnLeft  = pressed("turnLeft");
  const turnRight = pressed("turnRight");
  const forward   = held("forward");
  const jumpNow   = pressed("jump");
  const jumpHeld  = held("jump");

  // Giro en curso o salto cargándose → bloquea otras acciones
  if (player.turnTimer > 0) player.turnTimer -= dt;
  const busy = player.turnTimer > 0;

  // --- Inicio de salto: queda "pendiente" mientras se decide corto/largo ---
  if (player.onGround && !busy && !player.jumpPending && jumpNow) {
    player.jumpPending = true;
    player.jumpPendTime = 0;
    player.jdx = DIRS[player.facing].dx;
    player.jdy = DIRS[player.facing].dy;
  }
  const locked = busy || player.jumpPending;

  // --- Giro de 90° (solo en el suelo, si no está bloqueado) ---
  if (player.onGround && !locked) {
    if (turnLeft)       { player.facing = (player.facing + 3) % 4; player.turnTimer = CFG.TURN_TIME; }
    else if (turnRight) { player.facing = (player.facing + 1) % 4; player.turnTimer = CFG.TURN_TIME; }
  }
  const dir = DIRS[player.facing];

  // --- Resolución del salto de un botón (tap = bajo/corto, mantener = alto/largo) ---
  if (player.jumpPending) {
    player.jumpPendTime += dt;
    const launch = (J) => {
      player.vz = J.vz;
      player.vx = player.jdx * J.vh;
      player.vy = player.jdy * J.vh;
      player.onGround = false;
      player.jumpPending = false;
    };
    if (!jumpHeld) launch(CFG.JUMP_LOW);                            // soltó pronto → corto/bajo
    else if (player.jumpPendTime >= CFG.JUMP_TAP_TIME) launch(CFG.JUMP_HIGH); // mantenido → largo/alto
  }

  // --- Avance recto en el suelo (con EMPUJE de objetos) ---
  player.moving = false;
  if (player.onGround && !locked && forward) {
    const step = CFG.WALK * dt;
    const nx = player.x + dir.dx * step;
    const ny = player.y + dir.dy * step;
    if (!blocksHoriz(room, nx, ny, player.z)) {
      player.x = nx; player.y = ny; player.moving = true;
      player.walkPhase += dt * 12;
    } else if (tryPush(room, dir, step, player.z)) {
      // chocó con un objeto y lo empujó: el robot avanza pegado a él (también
      // mientras llevas otro encima de la cabeza).
      player.moving = true; player.walkPhase += dt * 12;
    }
  }

  // --- Desplazamiento horizontal en el aire (impulso del salto) ---
  // Si el avance choca con un bloque a la altura actual del pie, NO anulamos la
  // velocidad: simplemente no avanzamos ese eje este frame y reintentamos. Así,
  // al pegarte a un bloque y saltar, el arco te sube por encima de su cima y, al
  // superarla, el avance se reanuda y aterrizas ENCIMA (como en el Alien 8 real).
  if (!player.onGround && (player.vx !== 0 || player.vy !== 0)) {
    const nx = player.x + player.vx * dt;
    const ny = player.y + player.vy * dt;
    if (!blocksHoriz(room, nx, player.y, player.z)) player.x = nx;
    if (!blocksHoriz(room, player.x, ny, player.z)) player.y = ny;
  }

  // --- Gravedad / eje Z ---
  player.vz -= CFG.GRAVITY * dt;
  let nz = player.z + player.vz * dt;
  const support = supportHeight(room, player.x, player.y, player.z);
  // Solo se aterriza BAJANDO (vz<=0). Si subiendo se roza el borde de un bloque,
  // no se "engancha": completa el arco por encima y cae encima, ya adelantado.
  if (nz <= support && player.vz <= 0) {
    nz = support;
    player.vz = 0; player.vx = 0; player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }
  player.z = nz;

  // --- Recoger / colocar circuito ---
  if (pressed("use")) interact(room);
};

/* player.addDraws() — inserta la caja de profundidad del jugador en la lista de
   pintado. La caja de ORDEN usa su HUELLA DE COLISIÓN (±PRAD), no el ancho visual
   de los hombros: así nunca solapa con un bloque adyacente (la colisión lo garantiza)
   y la separación por ejes es limpia → orden correcto. Dibuja sombra + robot + carga.
   Usa ctx/P de view (presentación) en tiempo de pintado. */
player.addDraws = function (draws, room) {
  const pr = CFG.PRAD, ink = room.ink;
  // El circuito cargado se dibuja en z+1.6 (por encima de ROBOT.H=1.5): si la caja
  // de orden no lo cubre, queda fuera del painter y puede ocluirse mal. Extendemos
  // el techo de la caja para envolver también la carga.
  const top = player.z + (game.carried ? 2.2 : AP.ROBOT.H);
  draws.push({
    x0: player.x - pr, y0: player.y - pr, z0: player.z,
    x1: player.x + pr, y1: player.y + pr, z1: top,
    draw: () => {
      const gz = supportHeight(room, player.x, player.y, player.z);
      AP.shadow(ctx, P, player.x, player.y, gz);
      AP.robot(ctx, P, player.x, player.y, player.z, player.facing, ink,
               { moving: player.moving, walkPhase: player.walkPhase });
      if (game.carried) AP.circuit(ctx, P, player.x, player.y, player.z + 1.6, game.carried, room.ink2 || ink);
    }
  });
};

/* Lista de ENTIDADES vivas (se actualizan y se dibujan en bloque). De momento solo
   el jugador; en la Fase 6 se añaden pinchos/enemigos implementando update/addDraws. */
export const entities = [player];
