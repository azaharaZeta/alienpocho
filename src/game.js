/* =============================================================================
   ALIEN POCHO — SIMULACIÓN (game.js)
   -----------------------------------------------------------------------------
   El "qué pasa": entidades (jugador), física tipo tanque, estado de partida,
   interacción de circuitos y transiciones entre salas (flip-screen).
   Los DATOS del mapa viven en data/rooms.js y los arma world.js (buildWorld).
   La PRESENTACIÓN (render, HUD, pantallas, bucle) vive en main.js.

   Ya NO lee globales del shell: importa lo que necesita —CFG (config), AP (assets),
   pressed/held (input), ctx/P (view), buildWorld (world)— rompiendo el antiguo ciclo.
   Expone (para main.js y tests): game, player, entities, world, room, checkExits,
   resetGame, updateObjects (+ interact y algunos helpers de física para los tests).
   ============================================================================= */
"use strict";

import { CFG } from "./config.js";
import { AP } from "./assets.js";
import { pressed, held } from "./input.js";
import { ctx, P } from "./view.js";
import { buildWorld } from "./world.js";

/* Estado de partida (placeholders hasta las fases 5-7) */
export const game = { state: "title", lives: 3, circuits: 0, circuitsTotal: 4, carried: null, lightYears: 9999, won: false };

/* =========================================================================
   ENTITIES — el jugador (robot Pocho)
   ========================================================================= */
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

/* =========================================================================
   PHYSICS — movimiento con colisiones (eje separado para deslizar)
   ========================================================================= */
/* ¿Está la coord. dentro del HUECO de la puerta? Vano estrecho: el robot (semiancho
   ~0.5) pasa con un poco de margen. Coincide con el hueco visual entre postes. */
const DOOR_HALF = 0.72;
function inDoor(coord, n) { return Math.abs(coord - n / 2) <= DOOR_HALF; }

/* ¿Cae fuera del suelo? Solo se puede cruzar un borde si tiene salida Y por el
   HUECO de su puerta; el resto del borde es pared sólida (no se atraviesa). */
function outOfBounds(room, fx, fy) {
  if (fx < 0)        return !(room.exits.xm && inDoor(fy, room.h));
  if (fx >= room.w)  return !(room.exits.xp && inDoor(fy, room.h));
  if (fy < 0)        return !(room.exits.ym && inDoor(fx, room.w));
  if (fy >= room.h)  return !(room.exits.yp && inDoor(fx, room.w));
  return false;
}

/* Caja física de un OBJETO transportable, centrada en su celda. Misma geometría
   para colisión, apoyo, empuje y dibujo (AP.prop) → nunca se solapa con el robot. */
function objBox(o) {
  const m = AP.PROP.HALF;   // o.x,o.y = CENTRO continuo (igual convención que el jugador)
  return { x0: o.x - m, y0: o.y - m, x1: o.x + m, y1: o.y + m, z0: o.z, top: o.z + AP.PROP.H, obj: o };
}

/* CAJAS SÓLIDAS de la sala — fuente ÚNICA para colisión y apoyo. Cada sólido es
   una huella en planta [x0,y0]-[x1,y1] con base `z0` y cima `top`:
     - bloques: cubo completo (una caja por bloque, aunque tenga varias capas);
     - objetos: cajas transportables (se empujan, se sube uno encima y se apilan).
   Los ZÓCALOS NO son sólidos: son la casilla-DESTINO sobre la que el robot se planta
   para soltar el circuito y activarlos (ver interact). Los PINCHOS tampoco (se saltan;
   el daño llega en Fase 6). */
const SOCKET_BASE_H = 0.2;   // alto de la peana del zócalo (ver AP.socket)
/* Cima de un zócalo ACTIVADO (peana + circuito encajado encima). */
function activeSocketTop(s) { return (s.z || 0) + SOCKET_BASE_H + AP.PROP.H; }

function roomSolids(room) {
  const s = [];
  for (const bl of room.blocks)
    s.push({ x0: bl.x, y0: bl.y, z0: bl.z, x1: bl.x + 1, y1: bl.y + 1, top: bl.z + bl.h });
  for (const o of room.objects) s.push(objBox(o));
  // Un zócalo ACTIVADO (con su circuito dentro) vuelve a ser SÓLIDO: ocupa espacio y
  // es pisable. El inactivo no (es la baldosa-destino sobre la que te plantas).
  for (const k of room.sockets) if (k.active) {
    const oz = k.z || 0;
    s.push({ x0: k.cx + 0.16, y0: k.cy + 0.16, z0: oz, x1: k.cx + 0.84, y1: k.cy + 0.84, top: activeSocketTop(k) });
  }
  return s;
}

/* Solape de la caja del jugador (en planta) con la huella de un sólido */
function overlapsBox(b, x, y) {
  const r = CFG.PRAD;
  return (x - r) < b.x1 && (x + r) > b.x0 &&
         (y - r) < b.y1 && (y + r) > b.y0;
}

/* ¿El movimiento horizontal a (nx,ny) choca, con los pies a feetZ?
   Un sólido solo bloquea si su cima queda POR ENCIMA del pie (no se sube
   andando: hay que SALTAR). Sólidos al nivel del pie o por debajo son
   pisables/transitables. */
function blocksHoriz(room, nx, ny, feetZ) {
  const r = CFG.PRAD;
  if (outOfBounds(room, nx - r, ny - r) || outOfBounds(room, nx + r, ny - r) ||
      outOfBounds(room, nx - r, ny + r) || outOfBounds(room, nx + r, ny + r)) return true;
  for (const b of roomSolids(room))
    if (b.top > feetZ + CFG.STEP && overlapsBox(b, nx, ny)) return true;
  return false;
}

/* Altura de la superficie de apoyo bajo el jugador: el suelo (0) o la cima
   del sólido más alto que esté a la altura del pie o por debajo. */
function supportHeight(room, x, y, feetZ) {
  let h = 0;
  for (const b of roomSolids(room))
    if (b.top <= feetZ + CFG.STEP && b.top > h && overlapsBox(b, x, y)) h = b.top;
  return h;
}

/* ¿Cabe el robot DE PIE con los pies a feetZ en (x,y)? (límites + que ningún sólido
   invada el volumen del cuerpo por encima de los pies). Se usa para decidir si se
   puede soltar un objeto bajo el robot y subirse encima. */
function canStandOn(room, x, y, feetZ) {
  const m = CFG.PRAD, headZ = feetZ + AP.ROBOT.H;
  if (outOfBounds(room, x - m, y - m) || outOfBounds(room, x + m, y - m) ||
      outOfBounds(room, x - m, y + m) || outOfBounds(room, x + m, y + m)) return false;
  for (const b of roomSolids(room)) {
    const ov = (x - m) < b.x1 && (x + m) > b.x0 && (y - m) < b.y1 && (y + m) > b.y0;
    if (ov && b.top > feetZ + 0.05 && b.z0 < headZ - 0.05) return false;  // algo estorba arriba
  }
  return true;
}

/* ¿Puede el objeto `obj` ocupar el centro (nx,ny) a su altura actual? No si se
   sale de la sala o si pisa otro sólido (bloque/objeto/zócalo) cuya cima quede por
   encima de su base. Empuje en PLANO: no se empuja un objeto hacia arriba. */
function objBlocked(room, obj, nx, ny) {
  const m = AP.PROP.HALF;
  // Los objetos NO cruzan puertas (solo el robot): chocan con TODO el borde de la sala.
  if (nx - m < 0 || nx + m > room.w || ny - m < 0 || ny + m > room.h) return true;
  for (const b of roomSolids(room)) {
    if (b.obj === obj) continue;
    const ov = (nx - m) < b.x1 && (nx + m) > b.x0 && (ny - m) < b.y1 && (ny + m) > b.y0;
    if (ov && b.top > obj.z + 0.01) return true;
  }
  return false;
}

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

/* Superficie de apoyo bajo un objeto (cima del sólido más alto que pisa, sin contarse a
   sí mismo); el suelo (0) si no hay nada. Sirve para que los objetos CAIGAN. */
function objSupport(room, o) {
  const m = AP.PROP.HALF; let h = 0;
  for (const b of roomSolids(room)) {
    if (b.obj === o) continue;
    const ov = (o.x - m) < b.x1 && (o.x + m) > b.x0 && (o.y - m) < b.y1 && (o.y + m) > b.y0;
    if (ov && b.top <= o.z + 0.02 && b.top > h) h = b.top;
  }
  return h;
}

/* Gravedad de los OBJETOS: si quedan en el aire (p. ej. tras empujarlos fuera de una
   plataforma), caen hasta su superficie de apoyo. Se llama una vez por frame. */
export function updateObjects(room, dt) {
  for (const o of room.objects) {
    const s = objSupport(room, o);
    if (o.z > s + 1e-3 || o.vz) {
      o.vz = (o.vz || 0) - CFG.GRAVITY * dt;
      o.z += o.vz * dt;
      if (o.z <= s) { o.z = s; o.vz = 0; }
    }
  }
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

/* interact() — interacción VERTICAL con los objetos:
   - LLEVANDO algo: si estás en la casilla-destino de un zócalo compatible → lo
     COLOCAS y se ACTIVA. Si no, SUELTAS el objeto justo bajo tus pies y te subes
     encima al instante — pero SOLO si hay hueco para estar encima; si no, no sueltas.
   - MANOS LIBRES: solo puedes COGER el objeto sobre el que estás subido; al cogerlo
     caes a su sitio (caída visible por gravedad). */
export function interact(room) {
  if (game.won) return;

  if (game.carried) {
    // 1) ¿estoy plantado en la casilla-destino de un zócalo compatible? → activar
    for (const s of room.sockets) {
      if (!s.active && s.shape === game.carried &&
          Math.abs(player.x - (s.cx + 0.5)) < 0.5 && Math.abs(player.y - (s.cy + 0.5)) < 0.5 &&
          Math.abs(player.z - (s.z || 0)) < 0.4) {
        s.active = true; game.carried = null; game.circuits++;
        if (game.circuits >= game.circuitsTotal) game.won = true;
        // el zócalo ya es sólido bajo los pies → subir encima del circuito encajado
        player.z = activeSocketTop(s); player.vz = 0; player.onGround = true;
        return;
      }
    }
    // 2) soltar bajo los pies y subirse encima — solo si hay sitio para estar arriba
    if (player.onGround && canStandOn(room, player.x, player.y, player.z + AP.PROP.H)) {
      room.objects.push({ x: player.x, y: player.y, z: player.z, shape: game.carried });
      game.carried = null;
      player.z += AP.PROP.H;                 // subir encima, inmediato
      player.vz = 0; player.onGround = true;
    }
    return;                                  // sin hueco → no suelta
  }

  // Manos libres: coger el objeto si estás SUBIDO encima (tu huella lo pisa y los
  // pies a su cima) o PEGADO a él (a su misma altura base y las huellas casi
  // tocándose). Subido → al cogerlo caes al hueco; pegado → te quedas donde estás.
  const REACH = 0.2;   // margen de alcance lateral para "pegado"
  for (let i = 0; i < room.objects.length; i++) {
    const o = room.objects[i], b = objBox(o);
    const encima = overlapsBox(b, player.x, player.y) && Math.abs((o.z + AP.PROP.H) - player.z) < 0.25;
    const pegado = Math.abs(player.z - o.z) < 0.4 &&
      (player.x - CFG.PRAD - REACH) < b.x1 && (player.x + CFG.PRAD + REACH) > b.x0 &&
      (player.y - CFG.PRAD - REACH) < b.y1 && (player.y + CFG.PRAD + REACH) > b.y0;
    if (encima || pegado) {
      game.carried = o.shape;
      room.objects.splice(i, 1);
      if (encima) { player.onGround = false; player.vz = 0; }  // que se vea caer hasta o.z
      return;
    }
  }
}

/* =========================================================================
   WORLD INSTANCE + transiciones entre salas
   ========================================================================= */
export const world = buildWorld();
export let room = world.rooms[world.start];

/* Transición flip-screen: al cruzar un borde con salida, cambia de sala y reaparece
   por el borde opuesto, RECENTRANDO la coordenada perpendicular en la PUERTA de la sala
   destino (su centro). Así funciona aunque las salas tengan tamaños distintos. */
export function checkExits() {
  const e = room.exits;
  let key = null, R = null;
  if (player.x >= room.w && e.xp)      { key = e.xp; R = world.rooms[key]; player.x = 0.2;        player.y = R.h / 2; }
  else if (player.x < 0 && e.xm)       { key = e.xm; R = world.rooms[key]; player.x = R.w - 0.2;  player.y = R.h / 2; }
  else if (player.y >= room.h && e.yp) { key = e.yp; R = world.rooms[key]; player.y = 0.2;        player.x = R.w / 2; }
  else if (player.y < 0 && e.ym)       { key = e.ym; R = world.rooms[key]; player.y = R.h - 0.2;  player.x = R.w / 2; }
  if (key) {
    room = world.rooms[key];
    player.z = 0; player.vz = 0; player.vx = 0; player.vy = 0;
    player.onGround = true; player.jumpPending = false;
  }
}

/* Reinicia la partida desde cero (tras victoria; servirá también para game over). */
export function resetGame() {
  const fresh = buildWorld();
  world.rooms = fresh.rooms;                 // salas nuevas (circuitos/zócalos sin tocar)
  room = world.rooms[world.start];
  Object.assign(player, {
    x: 1.5, y: 6.5, z: 0, vz: 0, vx: 0, vy: 0, onGround: true,
    facing: 3, turnTimer: 0, walkPhase: 0, moving: false,
    jumpPending: false, jumpPendTime: 0, jdx: 0, jdy: 0
  });
  game.lives = 3; game.circuits = 0; game.carried = null;
  game.lightYears = 9999; game.won = false;
}

/* Helpers de física expuestos para los smoke tests (oráculo de no-regresión). */
export { blocksHoriz, supportHeight, roomSolids };
