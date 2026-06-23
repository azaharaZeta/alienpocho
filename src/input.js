/* =============================================================================
   ALIEN POCHO — INPUT (input.js)
   -----------------------------------------------------------------------------
   Estado de teclado + detección de flancos + helpers held/pressed según CONTROLS.
   El acceso al DOM (addEventListener, botones táctiles) se difiere a init*() → el
   módulo se importa en tests Node sin tocar `window`/`document`.
   ============================================================================= */
"use strict";

import { CONTROLS } from "./config.js";

/* Estado de teclado (vivo) + snapshot del frame anterior para flancos. */
export const keys = Object.create(null);
const prevKeys = Object.create(null);
const BOUND_CODES = new Set(Object.values(CONTROLS).flat());

/* Flanco de teclado: pulsación nueva este frame. */
function edge(code) { return keys[code] && !prevKeys[code]; }

/* Helpers de acciones según CONTROLS: held = mantenida, pressed = flanco. */
export const held    = (action) => CONTROLS[action].some(c => keys[c]);
export const pressed = (action) => CONTROLS[action].some(c => edge(c));

/* Snapshot de teclas para los flancos del próximo frame (lo llama el bucle). */
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

/* Controles táctiles → reusan el teclado (mismos códigos, así el salto corto/largo
   también depende de cuánto se mantenga pulsado). */
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
