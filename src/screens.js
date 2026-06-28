/* =============================================================================
   ALIEN POCHO — PANTALLAS (screens.js)
   -----------------------------------------------------------------------------
   Pantallas de no-juego: por ahora la PANTALLA DE TÍTULO (marco sci-fi pixel-art +
   logo neón + mascota + créditos + prompt parpadeante). Recibe la paleta como
   parámetro (no lee estado global).
   ============================================================================= */
"use strict";

import { CFG, CONTROLS } from "./config.js";
import { ENGINE } from "./engine.js";
import { AP } from "./draw.js";
import { ctx } from "./view.js";

/* Código de tecla (KeyboardEvent.code) → glifo legible para el menú de controles. */
const KEYNAME = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Space: "ESPACIO", Enter: "INTRO" };
const keyGlyph = (code) => KEYNAME[code] || (code.startsWith("Key") ? code.slice(3) : code);
const keysOf = (action) => CONTROLS[action].map(keyGlyph).join(" / ");   // "↑ / W", "E / INTRO"…

// Marco grande estilo panel de nave: doble borde, línea segmentada, corchetes de
// esquina y remaches. Todo a base de rectángulos → look pixel-art al escalar.
function drawSciFiFrame(x, y, w, h, pal) {
  const ink = pal.ink, ink2 = pal.ink2, dim = ENGINE.darken(ink, 0.45);
  const R = (xx, yy, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(xx, yy, ww, hh); };
  // borde exterior grueso (PRIMARIO)
  R(x, y, w, 3, ink); R(x, y + h - 3, w, 3, ink);
  R(x, y, 3, h, ink); R(x + w - 3, y, 3, h, ink);
  // línea interior segmentada (primario tenue)
  const ix = x + 7, iy = y + 7, iw = w - 14, ih = h - 14;
  for (let i = 0; i <= iw; i += 7) { R(ix + i, iy, 4, 1, dim); R(ix + i, iy + ih, 4, 1, dim); }
  for (let j = 0; j <= ih; j += 7) { R(ix, iy + j, 1, 4, dim); R(ix + iw, iy + j, 1, 4, dim); }
  // corchetes de esquina + remaches (SECUNDARIO)
  const L = 18, t = 3;
  R(x, y, L, t, ink2);                 R(x, y, t, L, ink2);                  // sup-izq
  R(x + w - L, y, L, t, ink2);         R(x + w - t, y, t, L, ink2);          // sup-der
  R(x, y + h - t, L, t, ink2);         R(x, y + h - L, t, L, ink2);          // inf-izq
  R(x + w - L, y + h - t, L, t, ink2); R(x + w - t, y + h - L, t, L, ink2);  // inf-der
  R(x + w / 2 - 2, y, 4, 3, ink2); R(x + w / 2 - 2, y + h - 3, 4, 3, ink2);
  R(x, y + h / 2 - 2, 3, 4, ink2); R(x + w - 3, y + h / 2 - 2, 3, 4, ink2);
}

export function drawTitleScreen(now, pal) {
  const W = CFG.W, H = CFG.H, ink = pal.ink, ink2 = pal.ink2;
  const core = ENGINE.lighten(ink, 0.6);   // núcleo neón = primario muy aclarado (de la paleta)
  ctx.fillStyle = CFG.COL.bg; ctx.fillRect(0, 0, W, H);

  const m = 12;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(m, m, W - 2 * m, H - 2 * m);
  drawSciFiFrame(m, m, W - 2 * m, H - 2 * m, pal);

  // Logo "ALIEN POCHO" en dos líneas, estilo neón (glow primario + núcleo aclarado)
  const neon = (txt, cy, size) => {
    ctx.save();
    ctx.font = "bold " + size + "px 'Courier New', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.letterSpacing = "3px"; ctx.lineJoin = "round";
    ctx.shadowColor = ink; ctx.shadowBlur = 8;
    ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.fillStyle = ink;
    ctx.strokeText(txt, W / 2, cy); ctx.fillText(txt, W / 2, cy);
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.fillStyle = core;
    ctx.strokeText(txt, W / 2, cy); ctx.fillText(txt, W / 2, cy);
    ctx.letterSpacing = "0px"; ctx.restore();
  };
  neon("ALIEN", 50, 32);
  neon("POCHO", 84, 32);

  // Mascota robot (abajo-izquierda; deja sitio a la lista de controles a la derecha)
  const pm = AP.projector(80, 178);
  AP.shadow(ctx, pm, 0, 0, 0);
  AP.robot(ctx, pm, 0, 0, 0, 0, ink, {});

  // CONTROLES (derivados de CONTROLS → si se reasignan teclas, el menú se actualiza solo)
  const rows = [
    ["Girar izq.",     "turnLeft"],
    ["Girar der.",     "turnRight"],
    ["Avanzar",        "forward"],
    ["Saltar",         "jump"],
    ["Coger / Soltar", "use"],
  ];
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
  ctx.fillStyle = ink2; ctx.font = "bold 9px 'Courier New', monospace";
  ctx.fillText("CONTROLES", 220, 116);
  ctx.font = "8px 'Courier New', monospace";
  rows.forEach(([label, action], i) => {
    const y = 132 + i * 13;
    ctx.textAlign = "left";
    ctx.fillStyle = core; ctx.fillText(keysOf(action), 152, y);   // teclas (brillante)
    ctx.fillStyle = ink2; ctx.fillText(label, 224, y);            // acción (secundario)
  });

  // Créditos + prompt parpadeante (centrados, abajo)
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = core; ctx.font = "9px 'Courier New', monospace";
  ctx.fillText("Hecho por Azahara con Claude Code 4.8", W / 2, 200);
  if (Math.floor(now / 500) % 2 === 0) {
    ctx.fillStyle = ink2; ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText("PULSA UN BOTON PARA EMPEZAR", W / 2, 214);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "top";
}
