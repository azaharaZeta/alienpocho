/* =============================================================================
   ALIEN POCHO — INPUT (input.js)
   -----------------------------------------------------------------------------
   Estado de teclado + detección de flancos + helpers held/pressed según CONTROLS.
   El acceso al DOM (addEventListener, botones táctiles) está DIFERIDO a init():
   así el módulo se puede importar en Node (tests) sin tocar `window`/`document`.
   ============================================================================= */
"use strict";

import { CONTROLS } from "./config.js";

/* Estado de teclado (vivo) + snapshot del frame anterior para flancos. */
export const keys = Object.create(null);
const prevKeys = Object.create(null);
const BOUND_CODES = new Set(Object.values(CONTROLS).flat());

/* Detección de flancos de teclado (pulsación nueva este frame) */
function edge(code) { return keys[code] && !prevKeys[code]; }

/* Helpers de acciones según CONTROLS (parametrizable) */
export const held    = (action) => CONTROLS[action].some(c => keys[c]);
export const pressed = (action) => CONTROLS[action].some(c => edge(c));

/* Snapshot de teclas para los flancos del próximo frame: lo llama el bucle UNA
   vez por frame, tras actualizar todas las entidades. */
export function snapshotKeys() {
  for (const k in keys) prevKeys[k] = keys[k];
}

/* Conecta el teclado físico. Llamar una vez al arrancar (en el navegador). */
export function initInput() {
  addEventListener("keydown", e => {
    keys[e.code] = true;
    if (BOUND_CODES.has(e.code)) e.preventDefault();
  });
  addEventListener("keyup", e => { keys[e.code] = false; });
}

/* Controles táctiles en pantalla → reusan el teclado del juego (mismos códigos,
   así el salto corto/largo depende también de cuánto mantengas pulsado). */
export function initTouch() {
  const send = (code, down) =>
    window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }));
  document.querySelectorAll(".btn").forEach(function (b) {
    const code = b.dataset.code;
    const down = (e) => { e.preventDefault(); b.classList.add("on"); send(code, true); };
    const up   = (e) => { e.preventDefault(); b.classList.remove("on"); send(code, false); };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointerleave", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  });
}
