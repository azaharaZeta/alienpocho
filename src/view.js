/* =============================================================================
   ALIEN POCHO — VIEW (view.js)
   -----------------------------------------------------------------------------
   Recursos de presentación compartidos: el contexto 2D del canvas y el PROYECTOR
   isométrico (se recalcula por sala). Los usan render (main.js) y el dibujo del
   jugador (game.js).
   El DOM se toca solo en init*() (no al importar) → el módulo corre en tests Node.
   ============================================================================= */
"use strict";

import { ENGINE } from "./engine.js";
import { CFG, ORIGIN, POPT, SCENE } from "./config.js";

/* Contexto 2D del canvas. `null` hasta initView() (en Node se queda null). */
export let ctx = null;
export function initView() {
  ctx = document.getElementById("game").getContext("2d");
}

/* Proyector iso actual (se recalcula por sala con setProjector). Binding vivo:
   las closures de dibujo leen siempre el proyector vigente. */
export let P = ENGINE.projector(ORIGIN.x, ORIGIN.y, POPT);

/* Proyector centrado para una sala w×h: centra la huella del rombo y fija su centro
   vertical, para que las salas rectangulares (pasillos) encajen igual. */
export function projectorFor(r) {
  const TW = CFG.TILE_W, TH = CFG.TILE_H;
  const ox = CFG.W / 2 - (r.w - r.h) * TW / 4;   // centra el ancho del rombo
  const oy = SCENE.PROJECTOR_OY - (r.w + r.h) * TH / 4 + SCENE.PROJECTOR_DROP;
  return ENGINE.projector(ox, oy, POPT);
}

/* Recalcula y fija el proyector para la sala dada (lo llama render cada frame). */
export function setProjector(r) {
  P = projectorFor(r);
  return P;
}

/* TEMA DE UI POR SALA: vuelca el primario/secundario a variables CSS, así los botones
   táctiles y el borde de pantalla adoptan los colores de la sala actual. */
export function applyRoomTheme(r) {
  const ink = r.ink, ink2 = r.ink2 || ink, s = document.documentElement.style;
  s.setProperty("--ui",      ink);
  s.setProperty("--ui-dim",  ENGINE.darken(ink, 0.5));
  s.setProperty("--ui2",     ink2);
  s.setProperty("--ui2-dim", ENGINE.darken(ink2, 0.5));
}
