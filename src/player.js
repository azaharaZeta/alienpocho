/* =============================================================================
   ALIEN POCHO — ENTIDAD JUGADOR (player.js)
   -----------------------------------------------------------------------------
   El robot Pocho: estado, control tipo tanque (girar 90° + avanzar + saltar), empuje
   de objetos y su dibujo. Es una ENTIDAD: implementa update()/addDraws(), que el bucle
   (main.js) llama.

   Usa physics.js (colisión/apoyo), input.js y, en call-time, game.js (game, interact,
   resetGame). La dependencia con game.js es cíclica pero solo se usa dentro de funciones.
   ============================================================================= */
"use strict";

import { CFG, ROBOT } from "./config.js";
import { AP } from "./draw.js";
import { pressed, held } from "./input.js";
import { ctx, P } from "./view.js";
import { blocksHoriz, supportHeight, ceilingHeight, objBox, overlapsBox, objBlocked, objAsset, thingHas } from "./physics.js";
import { assetFoot, assetTint } from "./data/assets.js";   // huella del robot por orientación + tinte del objeto en brazos
import { MISSION } from "./data/mission.js";    // posición inicial del robot (MISSION.start)
import { game, interact } from "./game.js";

export const player = {
  x: MISSION.start.x, y: MISSION.start.y, z: 0,   // posición inicial: la define data/mission.js (MISSION.start)
  vz: 0, vx: 0, vy: 0,         // velocidades (vx,vy solo durante el salto)
  onGround: true,
  facing: MISSION.start.facing,   // 0:+x  1:+y  2:-x  3:-y  (mira a -y = NE)
  turnTimer: 0,                // tiempo restante de la animación de giro
  walkPhase: 0,                // fase de la animación de caminar
  moving: false,
  jumpPending: false,          // salto cargándose (decidiendo corto/largo)
  jumpPendTime: 0,
  jdx: 0, jdy: 0               // dirección fijada al iniciar el salto
};

/* Las 4 direcciones de mirada, alineadas a los ejes del suelo. */
const DIRS = [
  { dx: 1, dy: 0 },   // 0: +x  (abajo-derecha)
  { dx: 0, dy: 1 },   // 1: +y  (abajo-izquierda)
  { dx: -1, dy: 0 },  // 2: -x  (arriba-izquierda)
  { dx: 0, dy: -1 }   // 3: -y  (arriba-derecha)
];

/* Empuje: si justo delante (a la altura del pie) hay un objeto movable, intenta
   deslizarlo `step` en la dirección de avance. Si el destino está libre, mueve objeto
   y robot juntos. Devuelve true si empujó. */
function tryPush(room, dir, step, feetZ) {
  const probeX = player.x + dir.dx * (CFG.PRAD + 0.04);
  const probeY = player.y + dir.dy * (CFG.PRAD + 0.04);
  let target = null;
  for (const o of room.objects) {
    if (!thingHas(o, "movable")) continue;   // solo se empuja lo `movable` (trait de asset o de instancia)
    const b = objBox(o);
    // Empujable solo si está a tu nivel: base en/bajo tus pies (b.z0 ≤ feetZ+STEP) y cima
    // por encima (es obstáculo). Así no empujas un objeto en alto al pasar por debajo.
    if (b.z0 <= feetZ + CFG.STEP && b.top > feetZ + CFG.STEP && overlapsBox(b, probeX, probeY)) { target = o; break; }
  }
  if (!target) return false;
  const nx = target.x + dir.dx * step, ny = target.y + dir.dy * step;
  if (objBlocked(room, target, nx, ny)) return false;
  target.x = nx; target.y = ny;
  player.x += dir.dx * step; player.y += dir.dy * step;
  return true;
}

/* player.update() — control tipo tanque:
   - girar 90° izquierda/derecha (alineado a los ejes del suelo)
   - avanzar recto en la dirección que se mira
   - saltar en la dirección que se mira; dos tipos: corto/bajo y largo/alto */
player.update = function (room, dt) {
  // (La victoria la gestiona main.js: al ganar muestra la pantalla de victoria y no llama a player.update.)
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
      // chocó con un objeto y lo empujó: el robot avanza pegado a él.
      player.moving = true; player.walkPhase += dt * 12;
    }
  }

  // --- Desplazamiento horizontal en el aire (impulso del salto) ---
  // Al chocar con un bloque no anulamos la velocidad: solo no avanzamos ese eje este frame (el arco te sube
  // por encima de la cima y aterrizas encima). Si el choque es contra un MOVABLE a la altura del pie, se
  // EMPUJA igual que en el suelo (reusa tryPush) → también se empujan objetos en mitad de un salto.
  if (!player.onGround && (player.vx !== 0 || player.vy !== 0)) {
    const nx = player.x + player.vx * dt, ny = player.y + player.vy * dt;
    const blockedX = player.vx !== 0 && blocksHoriz(room, nx, player.y, player.z);
    const blockedY = player.vy !== 0 && blocksHoriz(room, player.x, ny, player.z);
    if (player.vx !== 0 && !blockedX) player.x = nx;
    if (player.vy !== 0 && !blockedY) player.y = ny;
    if (blockedX || blockedY)   // bloqueado en el eje del salto → empuja el movable de delante (a su altura)
      tryPush(room, { dx: player.jdx, dy: player.jdy }, Math.hypot(player.vx, player.vy) * dt, player.z);
  }

  // --- Gravedad / eje Z ---
  player.vz -= CFG.GRAVITY * dt;
  let nz = player.z + player.vz * dt;
  // Techo: subiendo, si la cabeza fuese a entrar en un sólido por encima (p. ej. el dintel de una
  // puerta), corta el ascenso a ras de su base y anula la velocidad → la gravedad lo hace caer (topetazo).
  if (player.vz > 0) {
    const maxZ = ceilingHeight(room, player.x, player.y, player.z) - ROBOT.H;
    if (nz > maxZ) { nz = maxZ; player.vz = 0; }
  }
  const support = supportHeight(room, player.x, player.y, player.z);
  // Solo se aterriza bajando (vz<=0): subiendo no se engancha al borde de un bloque.
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

/* player.addDraws() — inserta la caja de profundidad del jugador en la lista de pintado. La caja de
   ORDEN es la huella de colisión (±PRAD = ROBOT.WID = el ancho dibujado del robot): colisión, orden y dibujo
   coinciden, así el sprite no sobresale de su caja y el painter ordena al robot como a un objeto más, sin
   overhang ni caso especial. Dibuja sombra + robot + carga. */
player.addDraws = function (draws, room) {
  const pr = CFG.PRAD, ink = room.ink;
  // El circuito cargado se dibuja en z+1.6 (por encima de ROBOT.H); extendemos el techo
  // de la caja de orden para envolverlo y que el painter lo ordene bien.
  const top = player.z + (game.carried ? 2.2 : ROBOT.H);
  draws.push({
    x0: player.x - pr, y0: player.y - pr, z0: player.z,
    x1: player.x + pr, y1: player.y + pr, z1: top,
    draw: () => {
      const gz = supportHeight(room, player.x, player.y, player.z);
      AP.shadow(ctx, P, player.x, player.y, gz);
      AP.robot(ctx, P, player.x, player.y, player.z, player.facing, ink,
               { moving: player.moving, walkPhase: player.walkPhase });
      if (game.carried) {   // carried = asset id; se tiñe con SU tinta (igual que en la escena), no siempre secundaria
        const ccol = assetTint(game.carried) === "secondary" ? (room.ink2 || ink) : ink;
        AP.drawSprite(game.carried, ctx, P(player.x, player.y, player.z + 1.6), ccol);
      }
    }
  });
};

/* player.debugInfo() — para los overlays de depuración (j/k/l) de render.js. Devuelve DOS cajas:
   - `box`   : huella del REGISTRO, ORIENTADA con el facing (axisX/axisY); solo debug/tool.
   - `solid` : caja real de COLISIÓN/ORDEN/dibujo (cuadrado ±PRAD = ROBOT.WID) que usan física y painter.
   Difieren porque la del registro rota e intercambia ancho/largo (WID≠DEP) y la real es un cuadrado
   simétrico; verlas juntas explica por qué la huella roja "invade" celdas que el robot no pisa. Cada
   entidad expone el suyo. */
player.debugInfo = function () {
  // Huella del REGISTRO según la orientación (variantes axisX/axisY: intercambian ancho/largo, robot más ANCHO
  // que profundo). facing 0/2 = mira en x → axisX; 1/3 = mira en y → axisY. Centrada en el jugador (footMode center).
  const f = assetFoot("robot", (player.facing & 1) ? "axisY" : "axisX"), pr = CFG.PRAD;
  return { box:   { x: player.x - f.w / 2, y: player.y - f.l / 2, z: player.z, w: f.w, l: f.l, h: f.h },
           solid: { x: player.x - pr, y: player.y - pr, z: player.z, w: 2 * pr, l: 2 * pr, h: ROBOT.H },
           ref:   { x: player.x, y: player.y, z: player.z } };
};

/* Lista de ENTIDADES vivas (se actualizan y se dibujan en bloque). De momento solo
   el jugador; enemigos futuros se añaden implementando update/addDraws. */
export const entities = [player];
