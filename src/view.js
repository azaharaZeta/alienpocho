/* =============================================================================
   ALIEN POCHO — VIEW (view.js)
   -----------------------------------------------------------------------------
   Recursos de presentación compartidos: el contexto 2D del canvas y el PROYECTOR
   isométrico (que se recalcula por sala). Tanto el render (main.js) como el dibujo
   de la entidad jugador (game.js) los necesitan → viven aquí, en un módulo común,
   en vez de en globales del shell (eso era el ciclo de dependencias).

   El contexto se obtiene en initView() (DOM); el proyector `P` es matemática pura,
   así que importar este módulo no toca el DOM (sirve para tests en Node).
   ============================================================================= */
"use strict";

import { ENGINE } from "./engine.js";
import { CFG, ORIGIN, POPT } from "./config.js";

/* Contexto 2D del canvas. `null` hasta initView() (en Node se queda null y no se
   dibuja). Es `let` exportado → quien lo importa ve el valor real tras initView(). */
export let ctx = null;
export function initView() {
  ctx = document.getElementById("game").getContext("2d");
}

/* Proyector iso actual (se recalcula por sala con setProjector). Export `let` =
   binding vivo: las closures de dibujo leen siempre el proyector vigente. */
export let P = ENGINE.projector(ORIGIN.x, ORIGIN.y, POPT);

/* Proyector centrado para una sala w×h: centra la HUELLA del rombo en pantalla y deja
   su centro vertical fijo, para que salas rectangulares (pasillos) encajen igual. */
export function projectorFor(r) {
  const TW = CFG.TILE_W, TH = CFG.TILE_H;
  const ox = CFG.W / 2 - (r.w - r.h) * TW / 4;   // centra el ancho del rombo
  // Centro vertical fijo (≈ el de 8×8), BAJADO 20px: la escena ocupa 20px más abajo,
  // comiéndose la banda negra inferior (= "ui inferior" 20px más baja/corta).
  const oy = 134 - (r.w + r.h) * TH / 4 + 20;
  return ENGINE.projector(ox, oy, POPT);
}

/* Recalcula y fija el proyector para la sala dada (lo llama render cada frame). */
export function setProjector(r) {
  P = projectorFor(r);
  return P;
}
