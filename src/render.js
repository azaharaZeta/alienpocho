/* =============================================================================
   ALIEN POCHO — RENDER de escena + HUD (render.js)
   -----------------------------------------------------------------------------
   Pinta la SALA en juego: suelo, paredes/puertas, y objetos+entidades ordenados por
   profundidad (painter de engine.js), más el HUD (marcador estilo Alien 8), el
   minimapa cenital y el banner de victoria. Lee el estado de la simulación (game.js)
   y dibuja con las primitivas de assets.js usando el contexto/proyector de view.js.
   Expone render(room); lo llama el bucle (main.js) cada frame de juego.
   ============================================================================= */
"use strict";

import { CFG } from "./config.js";
import { ENGINE } from "./engine.js";
import { AP } from "./assets.js";
import { ctx, P, setProjector, applyRoomTheme } from "./view.js";
import { entities } from "./player.js";
import { game, world, room } from "./game.js";

let _themeRoom = null;

export function render(room) {
  if (room !== _themeRoom) { applyRoomTheme(room); _themeRoom = room; }
  setProjector(room);                     // proyector centrado para el tamaño de esta sala
  ctx.fillStyle = CFG.COL.bg;
  ctx.fillRect(0, 0, CFG.W, CFG.H);

  const ink = room.ink, ink2 = room.ink2 || ink, WH = 3.6, D = AP.DOOR;   // pared alta: ~3 filas de hexágonos
  const doorSpan = (n) => [n / 2 - AP.DOOR.SPAN_HALF, n / 2 + AP.DOOR.SPAN_HALF]; // vano (semiancho SPAN_HALF)

  // 1) Suelo (plano en z=0, nunca ocluye → pre-pase al fondo)
  for (let y = 0; y < room.h; y++)
    for (let x = 0; x < room.w; x++)
      AP.floor(ctx, P, x, y, ink);

  // 1b) Paredes/puertas del FONDO (siempre detrás de todo → pre-pase)
  AP.flatWall(ctx, P, "x", 0, 0, room.w, WH, ink);                       // borde y=0 (atrás-dcha)
  if (room.exits.ym) { const [s0, s1] = doorSpan(room.w); AP.door(ctx, P, "x", 0, s0, s1, WH, ink, true); }
  AP.flatWall(ctx, P, "y", 0, 0, room.h, WH, ink);                       // borde x=0 (atrás-izq)
  if (room.exits.xm) { const [s0, s1] = doorSpan(room.h); AP.door(ctx, P, "y", 0, s0, s1, WH, ink, true); }

  // 2) Objetos como CAJAS para el pintor topológico
  const draws = [];
  const box3 = (x0, y0, z0, x1, y1, z1, draw) => draws.push({ x0, y0, z0, x1, y1, z1, draw });

  // bloques (un cubo por capa)
  for (const bl of room.blocks)
    for (let k = 0; k < bl.h; k++) {
      const z = bl.z + k;
      box3(bl.x, bl.y, z, bl.x + 1, bl.y + 1, z + 1, () => AP.cube(ctx, P, bl.x, bl.y, z, ink));
    }
  // pinchos / zócalos / circuitos sueltos (a su altura oz)
  for (const hz of room.hazards)
    box3(hz.cx + 0.2, hz.cy + 0.2, 0, hz.cx + 0.8, hz.cy + 0.8, 0.5,
         () => AP.spikes(ctx, P, hz.cx + 0.5, hz.cy + 0.5, 0, ink));
  for (const s of room.sockets) { const oz = s.z || 0;
    box3(s.cx + 0.16, s.cy + 0.16, oz, s.cx + 0.84, s.cy + 0.84, oz + 0.4,
         () => AP.socket(ctx, P, s.cx + 0.5, s.cy + 0.5, oz, s.shape, s.active, ink2)); }
  // objetos físicos (circuitos transportables): se dibujan en el SECUNDARIO de la sala.
  for (const o of room.objects) { const m = AP.PROP.HALF;
    box3(o.x - m, o.y - m, o.z, o.x + m, o.y + m, o.z + AP.PROP.H,
         () => AP.prop(ctx, P, o.x, o.y, o.z, o.shape, ink2)); }

  // entidades (jugador y, en Fase 6, pinchos/enemigos): cada una añade su caja al orden.
  for (const e of entities) e.addDraws(draws, room);

  // puertas del FRENTE descompuestas en piezas (2 postes + dintel) → entran en el orden
  // como cualquier objeto, así el robot se intercala solo al cruzar (postes con z hasta
  // el dintel para que el dintel siempre quede por encima).
  if (room.exits.yp) {
    const [s0, s1] = doorSpan(room.w), h = room.h, zL = WH - D.LINTEL_H;
    box3(s0, h, 0, s0 + D.POST_W, h + D.T, zL, () => AP.doorPost(ctx, P, "x", h, s0, s0 + D.POST_W, WH, ink));
    box3(s1 - D.POST_W, h, 0, s1, h + D.T, zL, () => AP.doorPost(ctx, P, "x", h, s1 - D.POST_W, s1, WH, ink));
    box3(s0, h, zL, s1, h + D.T, WH, () => AP.doorLintel(ctx, P, "x", h, s0, s1, WH, ink));
  }
  if (room.exits.xp) {
    const [s0, s1] = doorSpan(room.h), w = room.w, zL = WH - D.LINTEL_H;
    box3(w, s0, 0, w + D.T, s0 + D.POST_W, zL, () => AP.doorPost(ctx, P, "y", w, s0, s0 + D.POST_W, WH, ink));
    box3(w, s1 - D.POST_W, 0, w + D.T, s1, zL, () => AP.doorPost(ctx, P, "y", w, s1 - D.POST_W, s1, WH, ink));
    box3(w, s0, zL, w + D.T, s1, WH, () => AP.doorLintel(ctx, P, "y", w, s0, s1, WH, ink));
  }

  // 3) Ordenar topológicamente y pintar
  for (const it of ENGINE.depthSort(draws, P)) it.draw();

  drawHUD();
  drawMinimap();
  if (game.won) drawWinBanner();
}

/* Banner de victoria (provisional; la pantalla final llega en la Fase 8) */
function drawWinBanner() {
  const ink = room.ink, ink2 = room.ink2 || ink;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, CFG.H / 2 - 22, CFG.W, 44);
  ctx.fillStyle = ink2;   // título en secundario (de la sala)
  ctx.font = "14px 'Courier New', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("¡MISION COMPLETA!", CFG.W / 2, CFG.H / 2 - 4);
  ctx.fillStyle = ink; ctx.font = "8px 'Courier New', monospace";   // subtítulo en primario
  ctx.fillText("pulsa un boton para volver a jugar", CFG.W / 2, CFG.H / 2 + 12);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
}

/* --- Helpers de HUD --- */
// Barra vertical segmentada (las "esquineras" del marco original Alien 8)
function drawSegBar(cx, y0, y1, col) {
  ctx.fillStyle = col || CFG.COL.hud;
  for (let y = y0; y < y1; y += 6) ctx.fillRect(cx - 3, y, 6, 4);
}
// Casilla del objeto que llevas: marco cuadrado centrado en (cx,cy); si hay objeto,
// se dibuja centrado y RECORTADO dentro del marco (sea cual sea su forma).
function drawCarrySlot(cx, cy, shape, frameCol, circuitCol) {
  const s = 11;                                   // semilado del marco
  ctx.strokeStyle = frameCol; ctx.lineWidth = 1;
  ctx.strokeRect(cx - s + 0.5, cy - s + 0.5, s * 2 - 1, s * 2 - 1);
  if (!shape) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - s + 1, cy - s + 1, s * 2 - 2, s * 2 - 2); ctx.clip();
  AP.circuit(ctx, AP.projector(cx, cy + 4), 0, 0, 0, shape, circuitCol);   // circuito en SECUNDARIO
  ctx.restore();
}
// Mini robot (icono de vidas) — estilo LÍNEA, CENTRADO en (cx,cy) para alinearlo con
// el número. Más grande, a juego con la tipografía del marcador.
function drawMiniRobot(cx, cy, col) {
  col = col || CFG.COL.hud;
  const w = 14, h = 11, x = cx - w / 2, yTop = cy - h / 2;
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = 1.2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  // antena + bolita
  ctx.beginPath(); ctx.moveTo(cx, yTop); ctx.lineTo(cx, yTop - 3.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, yTop - 4.4, 1.2, 0, Math.PI * 2); ctx.fill();
  // cabeza (contorno redondeado)
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, yTop, w, h, 3); else ctx.rect(x, yTop, w, h);
  ctx.stroke();
  // ojos
  ctx.beginPath(); ctx.arc(cx - 3.5, cy + 0.5, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3.5, cy + 0.5, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/* MINIMAPA (arriba-izquierda): VISIÓN CENITAL real. Cada sala se dibuja como su
   rectángulo w×h en las coords de mundo (wx,wy) del plano coherente, a escala fija,
   centrado SIEMPRE en la sala actual. Se recorta al viewport: lo que se sale, no se ve. */
// La sala ANCHA (w>h) deja libre la zona superior derecha → mapa a la DERECHA.
// La ALTA o cuadrada deja libre la izquierda → mapa a la IZQUIERDA (por defecto).
function minimapOnRight() { return room.w > room.h; }

function drawMinimap() {
  if (room.wx === undefined) return;
  const ink = room.ink, ink2 = room.ink2 || ink;
  const MM = 45, oy = 6;                    // viewport cuadrado (75% del anterior 60)
  const ox = minimapOnRight() ? (CFG.W - MM - 8) : 8;
  const WS = 26, sc = MM / WS, INS = 0.6;   // INS: medio hueco entre salas (= pared, sin doblar)
  const ccx = room.wx + room.w / 2, ccy = room.wy + room.h / 2;   // centro de la sala actual
  const toX = wx => ox + MM / 2 + (wx - ccx) * sc, toY = wy => oy + MM / 2 + (wy - ccy) * sc;
  // fondo + marco
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(ox - 4, oy - 4, MM + 8, MM + 8);
  ctx.strokeStyle = ENGINE.darken(ink, 0.5); ctx.lineWidth = 1;
  ctx.strokeRect(ox - 3.5, oy - 3.5, MM + 7, MM + 7);
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, MM, MM); ctx.clip();
  // salas como rectángulos reales; el INSET deja un hueco negro entre vecinas = pared única
  for (const k of Object.keys(world.rooms)) {
    const Rm = world.rooms[k]; if (Rm.wx === undefined) continue;
    ctx.fillStyle = (Rm === room) ? ink2 : ENGINE.darken(ink, 0.32);
    ctx.fillRect(toX(Rm.wx) + INS, toY(Rm.wy) + INS, Rm.w * sc - 2 * INS, Rm.h * sc - 2 * INS);
  }
  // PUERTAS en secundario (una marca por conexión: lados xp/yp para no duplicar)
  ctx.fillStyle = ink2;
  for (const k of Object.keys(world.rooms)) {
    const Rm = world.rooms[k]; if (Rm.wx === undefined) continue;
    for (const [dir, t] of Object.entries(Rm.exits)) {
      const T = world.rooms[t]; if (!T || T.wx === undefined) continue;
      if (dir === "xp") {
        const len = Math.min(Rm.h, T.h, 2.24) * sc;
        ctx.fillRect(toX(Rm.wx + Rm.w) - 0.9, toY(Rm.wy + Rm.h / 2) - len / 2, 1.8, len);
      } else if (dir === "yp") {
        const len = Math.min(Rm.w, T.w, 2.24) * sc;
        ctx.fillRect(toX(Rm.wx + Rm.w / 2) - len / 2, toY(Rm.wy + Rm.h) - 0.9, len, 1.8);
      }
    }
  }
  ctx.restore();
}

/* HUD — homenaje al marcador de Alien 8: marco inferior con barras segmentadas a los
   lados y líneas en "V" hacia el centro, que enmarcan las dos zonas triangulares.
   Izquierda = CIRCUITOS (icono = forma que llevas) · Derecha = VIDAS. Sin años luz. */
function drawHUD() {
  const C = CFG.COL, W = CFG.W;
  ctx.textBaseline = "top";

  const ink2 = room.ink2 || C.roomName;   // secundario de la sala para los TEXTOS del HUD

  // ── Nombre de la sala: al lado OPUESTO al minimapa (si el mapa va a la derecha, el
  //    nombre a la izquierda, y viceversa) ──
  if (room && room.name) {
    ctx.fillStyle = ink2; ctx.font = "11px 'Courier New', monospace";
    if (minimapOnRight()) { ctx.textAlign = "left"; ctx.fillText(room.name, 8, 4); }
    else { ctx.textAlign = "right"; ctx.fillText(room.name, W - 8, 4); }
    ctx.textAlign = "left";
  }

  // ── Marco inferior: barras segmentadas + aristas PARALELAS a los bordes inferiores
  //    de la sala (pendiente ±0.5 = TILE_H/TILE_W), del color de la sala. Aprovecha el
  //    hueco que deja el rombo isométrico, prolongando su silueta. Vértice de la "V"
  //    bajo el pico de la sala (160). El contenido va DENTRO de las zonas delimitadas.
  const ink = room.ink, fc = P(room.w, room.h, 0);   // pico frontal del rombo (proyectado)
  // SEPARACIÓN grid↔HUD = 2× el saliente de las puertas (que ahora sobresalen del borde):
  // así, aún con las puertas por fuera, queda un hueco negro entre la rejilla y el marcador.
  const GAP = Math.round(AP.DOOR.T * CFG.TILE_W);   // hueco = ancho iso de la puerta
  // Vértice de la "V" bajo el PICO del rombo (mismo x), desplazado GAP hacia abajo: así los
  // raíles quedan PARALELOS a los bordes frontales de la sala (pendiente ±0.5) pero offset
  // GAP por debajo → nunca pisan el suelo y prolongan su silueta. (La escena se bajó 20px en
  // projectorFor, por eso todo el marco cae más abajo, sin tocar nombre/mapa ni iconos.)
  const vx = Math.round(fc.x);
  const vy = Math.round(fc.y) + GAP;
  const leftTopY = vy - 0.5 * (vx - 6), rightTopY = vy - 0.5 * ((W - 6) - vx);   // aristas a ±0.5
  drawSegBar(6, Math.round(leftTopY), 236, ink);
  drawSegBar(W - 6, Math.round(rightTopY), 236, ink);
  ctx.strokeStyle = ink; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, leftTopY);      ctx.lineTo(vx, vy);     // arista izquierda  (∥ borde sala)
  ctx.moveTo(W - 6, rightTopY); ctx.lineTo(vx, vy);     // arista derecha
  ctx.stroke();

  // Iconos del marcador en la franja INFERIOR, por DEBAJO del vértice de la "V": así
  // ninguna arista los cruza, aunque el pico se vaya a una esquina (salas rectangulares).
  const hudY = 224, slotCy = 229;   // bajados para ALINEARSE con el título "ALIEN POCHO" (y≈224)
  // ── Zona izquierda: CIRCUITOS — marco cuadrado + objeto dentro ──
  drawCarrySlot(34, slotCy, game.carried, ink, ink2);
  ctx.fillStyle = ink2; ctx.font = "bold 16px 'Courier New', monospace";
  ctx.fillText(game.circuits + "/" + game.circuitsTotal, 52, hudY);

  // ── Zona derecha: VIDAS — carita + número ──
  ctx.fillStyle = ink2; ctx.font = "bold 16px 'Courier New', monospace";
  ctx.textAlign = "right"; ctx.fillText("×" + game.lives, W - 24, hudY); ctx.textAlign = "left";
  drawMiniRobot(W - 56, slotCy, ink2);

  // ── Título "ALIEN POCHO" SIEMPRE centrado y abajo (desacoplado del pico, que puede irse
  //    a un lado en salas rectangulares) → nunca pisa los iconos de las esquinas. ──
  drawTitle(W / 2, 222);
}

/* Título con look "neón futurista": glow en el color de la sala + núcleo blanco con
   contorno; las dos palabras flanquean el pico (vx) del marco inferior. */
function drawTitle(vx, vy) {
  const C = CFG.COL, ink = room.ink, y = vy + 2, gap = 12;
  ctx.save();
  ctx.font = "bold 15px 'Courier New', monospace";
  ctx.letterSpacing = "2px";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  const draw = () => {
    ctx.textAlign = "right"; ctx.strokeText("ALIEN", vx - gap, y); ctx.fillText("ALIEN", vx - gap, y);
    ctx.textAlign = "left";  ctx.strokeText("POCHO", vx + gap, y); ctx.fillText("POCHO", vx + gap, y);
  };
  ctx.shadowColor = ink; ctx.shadowBlur = 6;          // resplandor (color de la sala)
  ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.fillStyle = ink;
  draw();
  ctx.shadowBlur = 0;                                  // núcleo nítido y brillante
  ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.fillStyle = ENGINE.lighten(ink, 0.6);
  draw();
  ctx.letterSpacing = "0px";
  ctx.restore();
}
