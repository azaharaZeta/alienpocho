/* =============================================================================
   ALIEN POCHO — RENDER de escena + HUD (render.js)
   -----------------------------------------------------------------------------
   Pinta la sala: suelo, paredes/puertas, y objetos+entidades ordenados por
   profundidad (painter de engine.js), más el HUD, el minimapa cenital y el banner
   de victoria. Lee el estado de game.js y dibuja con las primitivas de draw.js.
   Expone render(room); lo llama el bucle (main.js) cada frame.
   ============================================================================= */
"use strict";

import { CFG } from "./config.js";
import { ENGINE } from "./engine.js";
import { AP } from "./draw.js";
import { roomThings, roomShell } from "./world.js";   // listas uniformes de la escena (objetos + cáscara)
import { doorBlockedCells } from "./occlusion.js";   // MISMA función que el cálculo: zonas detrás de puertas (sin duplicar lógica)
import { assetTint, assetName } from "./data/assets.js";   // tinte por asset (primario/secundario) + nombre legible (HUD)
import { ctx, P, setProjector, applyRoomTheme } from "./view.js";
import { entities } from "./player.js";
import { game, world, room } from "./game.js";
import { pressed } from "./input.js";   // conmutadores (flanco) de los overlays de depuración j/k/l

let _themeRoom = null;

/* Inset uniforme (px) del contenido del HUD respecto al borde — fuente ÚNICA: lo usan el marcador
   (izda/dcha), el texto de debug y el marco del minimapa, para que todo comparta el mismo margen. */
const UI_MARGIN = 14;

/* ── OVERLAYS DE DEPURACIÓN (teclas j/k/l): cubo de referencia / región estándar / punto de anclaje,
   sobre los objetos colocables y las entidades (no el suelo ni la cáscara). Mismos overlays que
   tools/tool-assets.html. Conmutables e independientes; se pintan SOBRE la escena. ── */
const DBG = { box: false, region: false, anchor: false, doors: false };
const DBG_COL = { box: "#ff5a5a", region: "#ffd23d", anchor: "#5affd2", order: "#8aff5a", doors: "#ff3df0" };   // colores de debug; order = caja de colisión/orden (entidades); doors = zona prohibida
const aabbBox = (a) => ({ x: a.x0, y: a.y0, z: a.z0, w: a.x1 - a.x0, l: a.y1 - a.y0, h: a.z1 - a.z0 });
// Región estándar: AABB redondeada a celdas (ceil, mín. 1 en cada eje) — igual que assetRegion / la tool.
const regionOf = (b) => { const x0 = Math.floor(b.x), y0 = Math.floor(b.y), z0 = Math.floor(b.z);
  return { x: x0, y: y0, z: z0, w: Math.max(1, Math.ceil(b.x + b.w) - x0), l: Math.max(1, Math.ceil(b.y + b.l) - y0), h: Math.max(1, Math.ceil(b.z + b.h) - z0) }; };
// 12 aristas de una caja-mundo {x,y,z,w,l,h} en alambre, proyectadas por P (igual que drawRefCube de la tool).
function wireBox(b, col) {
  const X1 = b.x + b.w, Y1 = b.y + b.l, Z1 = b.z + b.h;
  const v = [[b.x,b.y,b.z],[X1,b.y,b.z],[X1,Y1,b.z],[b.x,Y1,b.z],[b.x,b.y,Z1],[X1,b.y,Z1],[X1,Y1,Z1],[b.x,Y1,Z1]].map(c => P(c[0], c[1], c[2]));
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.globalAlpha = 0.9;
  for (const [a, z] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) {
    ctx.beginPath(); ctx.moveTo(v[a].x, v[a].y); ctx.lineTo(v[z].x, v[z].y); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
// Los overlays ACTIVOS para un asset: su caja (box), su región y su punto de anclaje (ref).
function dbgOne(box, ref) {
  if (DBG.region) wireBox(regionOf(box), DBG_COL.region);
  if (DBG.box) wireBox(box, DBG_COL.box);
  if (DBG.anchor) { const p = P(ref.x, ref.y, ref.z); ctx.fillStyle = DBG_COL.anchor;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
}
// Zonas PROHIBIDAS por oclusión de puertas: pinta cada celda que devuelve occlusion.doorBlockedCells
// (la MISMA función que usan el guardarraíl/auditoría → un solo cálculo, sin paralelos). Rombo del suelo.
function drawForbiddenZones(room) {
  ctx.save();
  ctx.strokeStyle = DBG_COL.doors; ctx.fillStyle = DBG_COL.doors; ctx.lineWidth = 1;
  for (const { cx, cy } of doorBlockedCells(room)) {                      // ← misma fn que el cálculo
    const v = [P(cx, cy, 0), P(cx + 1, cy, 0), P(cx + 1, cy + 1, 0), P(cx, cy + 1, 0)];
    ctx.beginPath(); ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
    ctx.globalAlpha = 0.3; ctx.fill();
    ctx.globalAlpha = 0.85; ctx.stroke();
  }
  ctx.restore();
}

// Pasada de depuración: recorre los objetos colocables y las entidades con su caja/ancla.
function drawDebug(room) {
  if (!(DBG.box || DBG.region || DBG.anchor || DBG.doors)) return;
  if (DBG.doors) drawForbiddenZones(room);             // zonas detrás de puertas (occlusion.doorBlockedCells)
  // El SUELO y la cáscara (paredes/puertas) se excepciona a propósito (es la rejilla de referencia; ensucia y tapa lo demás).
  for (const t of roomThings(room))                    // objetos colocables (suelo y cáscara omitidos)
    dbgOne(aabbBox(t.aabb), { x: t.x, y: t.y, z: t.z });
  for (const e of entities) {                                              // entidades: huella visual (J/K/L) + su caja de COLISIÓN/ORDEN
    const d = e.debugInfo && e.debugInfo(); if (!d) continue;
    dbgOne(d.box, d.ref);                                                   // huella VISUAL (lo que se dibuja)
    if (d.solid && DBG.box) wireBox(d.solid, DBG_COL.order);                // caja de colisión/orden = la que usan física y painter (±PRAD = ROBOT.WID = ancho dibujado)
  }
  // indicador de qué overlays están activos: DEBAJO del bloque título+objetivo de arriba-izq (no lo pisa)
  const on = [DBG.box && "J:caja", DBG.region && "K:región", DBG.anchor && "L:ancla", DBG.doors && "O:puertas"].filter(Boolean).join("  ");
  ctx.fillStyle = "#ffffff"; ctx.font = "8px 'Courier New', monospace"; ctx.textBaseline = "top"; ctx.textAlign = "left";
  ctx.fillText("DEBUG  " + on, UI_MARGIN, 26);
  if (DBG.box) ctx.fillText("caja  rojo=dibujo  verde=colision/orden", UI_MARGIN, 36);   // entidades: las dos cajas (difieren a propósito)
}

export function render(room) {
  if (room !== _themeRoom) { applyRoomTheme(room); _themeRoom = room; }
  setProjector(room);                     // proyector centrado para esta sala
  if (pressed("dbgBox")) DBG.box = !DBG.box;            // overlays de depuración: conmutar por flanco (j/k/l/o)
  if (pressed("dbgRegion")) DBG.region = !DBG.region;
  if (pressed("dbgAnchor")) DBG.anchor = !DBG.anchor;
  if (pressed("dbgDoors")) DBG.doors = !DBG.doors;     // zonas prohibidas por oclusión de puertas
  ctx.fillStyle = CFG.COL.bg;
  ctx.fillRect(0, 0, CFG.W, CFG.H);

  const ink = room.ink, ink2 = room.ink2 || ink;

  // 1) Suelo (plano en z=0; nunca ocluye, se pinta al fondo). ÚNICO pre-pase: el resto (incl. el vacío negro
  //    del vano de las puertas de fondo) entra al painter como una pieza más de la cáscara (roomShell).
  for (let y = 0; y < room.h; y++)
    for (let x = 0; x < room.w; x++)
      AP.floor(ctx, P, x, y, ink);

  // 2) Lo que tiene altura va como CAJAS al painter; depthSort decide el orden atrás→adelante.
  const draws = [];
  const box3 = (x0, y0, z0, x1, y1, z1, draw) => draws.push({ x0, y0, z0, x1, y1, z1, draw });

  // 2a) UNA sola vía para CÁSCARA (paredes/puertas, roomShell) y COLOCABLE (objetos, roomThings): cada
  //     placement con su caja (aabb) + drawer genérico (AP.drawAsset); la cáscara sale del registro igual que
  //     los objetos. El inset (puerta de fondo) / protrusión (frontal) va en su aabb. depthSort es determinista
  //     (independiente del orden de inserción) → el robot se intercala solo al cruzar una puerta.
  for (const list of [roomShell(room), roomThings(room)])
    for (const t of list) {
      const col = assetTint(t.asset) === "secondary" ? ink2 : ink;
      const a = t.aabb;   // el painter ordena por la MISMA huella que la colisión (una caja por asset) → "tocar" = orden limpio
      box3(a.x0, a.y0, a.z0, a.x1, a.y1, a.z1, () => AP.drawAsset(ctx, P, t, col));
    }

  // 2b) entidades (jugador, etc.): cada una añade su caja al orden.
  for (const e of entities) e.addDraws(draws, room);

  // 3) Ordenar topológicamente y pintar
  for (const it of ENGINE.depthSort(draws, P)) it.draw();

  drawDebug(room);   // overlays de depuración (j/k/l) SOBRE la escena (bajo el HUD)
  drawHUD();
  drawMinimap();
  // (La victoria tiene pantalla propia, screens.drawVictoryScreen, que muestra main.js cuando game.won.)
}

/* --- Helpers de HUD --- */
// Barra vertical segmentada (las "esquineras" del marco original Alien 8)
function drawSegBar(cx, y0, y1, col) {
  ctx.fillStyle = col || CFG.COL.hud;
  for (let y = y0; y < y1; y += 6) ctx.fillRect(cx - 3, y, 6, 4);
}
// Casilla del objeto que llevas: marco cuadrado centrado en (cx,cy). El sprite del asset (sea cual sea su
// tamaño: circuito, ordenador…) se ESCALA para caber y se centra en el marco → ya no se sale ni se recorta.
function drawCarrySlot(cx, cy, asset, frameCol, spriteCol) {
  const s = 11;                                   // semilado del marco (22px)
  ctx.strokeStyle = frameCol; ctx.lineWidth = 1;
  ctx.strokeRect(cx - s + 0.5, cy - s + 0.5, s * 2 - 1, s * 2 - 1);
  const def = asset && AP.SPRITES[asset]; if (!def) return;
  const inner = s * 2 - 6;                         // lado útil (con margen interior)
  const k = Math.min(1, inner / def.w, inner / def.h);   // encoge si no cabe; nunca agranda
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - s + 1, cy - s + 1, s * 2 - 2, s * 2 - 2); ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy); ctx.scale(k, k);
  AP.drawSprite(asset, ctx, { x: -def.minX - def.w / 2, y: -def.minY - def.h / 2 }, spriteCol);   // centrado en (0,0)
  ctx.restore();
}
// Mini robot (icono de vidas) en estilo línea, centrado en (cx,cy).
function drawMiniRobot(cx, cy, col) {
  col = col || CFG.COL.hud;
  const w = 12, h = 9.5, x = cx - w / 2, yTop = cy - h / 2;
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = 1.1; ctx.lineJoin = "round"; ctx.lineCap = "round";
  // antena + bolita
  ctx.beginPath(); ctx.moveTo(cx, yTop); ctx.lineTo(cx, yTop - 3); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, yTop - 3.8, 1.05, 0, Math.PI * 2); ctx.fill();
  // cabeza (contorno redondeado)
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, yTop, w, h, 2.6); else ctx.rect(x, yTop, w, h);
  ctx.stroke();
  // ojos
  ctx.beginPath(); ctx.arc(cx - 3, cy + 0.5, 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3, cy + 0.5, 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/* MINIMAPA: visión cenital. Cada sala es su rectángulo w×h en coords de mundo (wx,wy),
   a escala fija, centrado en la sala actual; se recorta al viewport.
   POSICIÓN FIJA: el minimapa va SIEMPRE a la DERECHA y la UI/marcador a la IZQUIERDA. Como las salas
   se encajan en un marco fijo (mismo pico central), los huecos de las esquinas quedan estables. */
function drawMinimap() {
  if (room.wx === undefined) return;
  const ink = room.ink, ink2 = room.ink2 || ink;
  const MM = 45, oy = 18;                   // viewport cuadrado (oy deja hueco al nombre encima)
  const ox = CFG.W - MM - 4 - UI_MARGIN;    // SIEMPRE a la derecha; su marco (bg, ox+MM+4) cae en W-UI_MARGIN (margen uniforme)
  const WS = 26, sc = MM / WS, INS = 0.6;   // INS: medio hueco entre salas (= pared)
  const ccx = room.wx + room.w / 2, ccy = room.wy + room.h / 2;   // centro de la sala actual
  const toX = wx => ox + MM / 2 + (wx - ccx) * sc, toY = wy => oy + MM / 2 + (wy - ccy) * sc;
  // fondo + marco
  ctx.fillStyle = CFG.COL.scrim; ctx.fillRect(ox - 4, oy - 4, MM + 8, MM + 8);
  ctx.strokeStyle = ENGINE.darken(ink, 0.5); ctx.lineWidth = 1;
  ctx.strokeRect(ox - 3.5, oy - 3.5, MM + 7, MM + 7);
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, MM, MM); ctx.clip();
  // salas como rectángulos; el INSET deja un hueco negro entre vecinas = pared única
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

  // Nombre de la sala encima del minimapa (a la derecha), alineado a su borde derecho, en secundario.
  if (room.name) {
    ctx.fillStyle = ink2; ctx.font = "10px 'Courier New', monospace"; ctx.textBaseline = "top";
    ctx.textAlign = "right"; ctx.fillText(room.name, ox + MM + 4, oy - 16);
    ctx.textAlign = "left";
  }
}

/* HUD (posición FIJA, margen uniforme UI_MARGIN): marco inferior en "V" + cuatro zonas —
   ARRIBA-IZQ título "ALIEN POCHO"; ABAJO-IZQ objeto recogido (visor + su nombre); ABAJO-DCHA vidas y, abajo
   del todo, el OBJETIVO "circuitos activados x/total". El minimapa va aparte (arriba-dcha). */
function drawHUD() {
  const C = CFG.COL, W = CFG.W;
  const ink = room.ink, ink2 = room.ink2 || C.roomName;
  ctx.textBaseline = "top"; ctx.textAlign = "left";

  // ── Marco inferior: barras segmentadas a los lados + aristas en "V" paralelas a los bordes del rombo.
  const fc = P(room.w, room.h, 0);                    // pico frontal del rombo (proyectado)
  const GAP = Math.round(AP.DOOR.T * CFG.TILE_W);     // hueco bajo el pico (= ancho iso de puerta)
  const FE = 6, BOT = 236;                            // inset del borde del marco · base (y) de las barras
  const vx = Math.round(fc.x), vy = Math.round(fc.y) + GAP;
  const leftTopY = vy - 0.5 * (vx - FE), rightTopY = vy - 0.5 * ((W - FE) - vx);
  drawSegBar(FE, Math.round(leftTopY), BOT, ink);
  drawSegBar(W - FE, Math.round(rightTopY), BOT, ink);
  ctx.strokeStyle = ink; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(FE, leftTopY);      ctx.lineTo(vx, vy);
  ctx.moveTo(W - FE, rightTopY); ctx.lineTo(vx, vy);
  ctx.stroke();

  // ── ARRIBA-IZQUIERDA: solo el título (el objetivo de circuitos va abajo-dcha, junto a las vidas).
  const LM = UI_MARGIN;                                           // margen izquierdo uniforme de la UI
  drawTitle(LM, 4);                                               // "ALIEN POCHO"

  // ── ABAJO-IZQUIERDA: objeto recogido (visor + su nombre). El visor se tiñe con la tinta del asset.
  const oy = 224;
  const carryCol = (game.carried && assetTint(game.carried) === "secondary") ? ink2 : ink;
  ctx.fillStyle = ink2; ctx.font = "7px 'Courier New', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("LLEVAS", LM, oy - 19);
  drawCarrySlot(LM + 11, oy, game.carried, ink, carryCol);       // marco (semilado 11) con su borde izq. en LM
  if (game.carried) {
    ctx.fillStyle = ink; ctx.font = "bold 9px 'Courier New', monospace"; ctx.textBaseline = "middle";
    ctx.fillText(assetName(game.carried), LM + 26, oy);
  }

  // ── ABAJO-DERECHA: vidas (mini-robot + ×N) arriba y, ABAJO DEL TODO, "circuitos activados" en UNA línea.
  const RM = W - UI_MARGIN;                                       // margen derecho uniforme de la UI
  drawMiniRobot(RM - 30, 202, ink2);
  ctx.fillStyle = ink2; ctx.font = "bold 14px 'Courier New', monospace";
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText("×" + game.lives, RM, 202);
  // circuitos: una sola línea (label + cifra en cuerpo pequeño), pegada al borde inferior
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 9px 'Courier New', monospace";
  const count = game.circuits + " / " + game.circuitsTotal;
  const cw = ctx.measureText(count).width;
  ctx.fillText(count, RM, 232);                                   // cifra (cuerpo reducido vs. antes)
  ctx.font = "7px 'Courier New', monospace";
  ctx.fillText("CIRCUITOS ACTIVADOS", RM - cw - 5, 232);          // label, a la izquierda de la cifra (misma línea)
  ctx.textAlign = "left"; ctx.textBaseline = "top";
}

/* Título "ALIEN POCHO" con look neón: glow en el color de la sala + núcleo brillante. Anclado a la izquierda. */
function drawTitle(ax, vy) {
  const ink = room.ink, y = vy + 2;
  ctx.save();
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.letterSpacing = "1.5px";
  ctx.textBaseline = "top"; ctx.textAlign = "left";
  ctx.lineJoin = "round";
  const draw = () => { ctx.strokeText("ALIEN POCHO", ax, y); ctx.fillText("ALIEN POCHO", ax, y); };
  ctx.shadowColor = ink; ctx.shadowBlur = 6;          // resplandor (color de la sala)
  ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.fillStyle = ink;
  draw();
  ctx.shadowBlur = 0;                                  // núcleo nítido y brillante
  ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.fillStyle = ENGINE.lighten(ink, 0.6);
  draw();
  ctx.letterSpacing = "0px"; ctx.textAlign = "left";
  ctx.restore();
}
