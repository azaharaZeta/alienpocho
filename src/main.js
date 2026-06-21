/* =============================================================================
   ALIEN POCHO — ARRANQUE + BUCLE (main.js)
   -----------------------------------------------------------------------------
   Punto de entrada (el único <script type="module"> de index.html). Orquesta:
     - máquina de estados mínima (título ↔ juego) y BUCLE (rAF + delta-time);
     - arranque: conecta canvas/teclado/táctil (init*) y lanza el bucle;
     - botón de pantalla completa + API de pruebas (window.__pocho).
   El DIBUJO vive en render.js (escena+HUD) y screens.js (título); la SIMULACIÓN en
   game.js/player.js/physics.js; los datos del mapa en data/rooms.js (vía world.js).
   ============================================================================= */
"use strict";

import { INKS, INK2 } from "./palette.js";
import { initView, applyRoomTheme } from "./view.js";
import { pressed, snapshotKeys, initInput, initTouch } from "./input.js";
// `room` es un binding VIVO: game.js lo reasigna al cambiar de sala y aquí se ve el cambio.
import { game, world, room, checkExits, resetGame } from "./game.js";
import { player, entities } from "./player.js";
import { updateObjects } from "./physics.js";
import { render } from "./render.js";
import { drawTitleScreen } from "./screens.js";

/* PALETA DEL MENÚ: aleatoria en cada carga (una de las parejas primario/secundario de
   las salas). Todo el juego usa SOLO colores de la paleta activa (+ negro y sus sombras). */
const menuPalette = (() => {
  const k = Math.floor(Math.random() * INKS.length);
  return { ink: INKS[k], ink2: INK2[k] };
})();

/* Link discreto del título → catálogo de assets (solo visible en el menú; ver bucle). */
const assetsLink = document.getElementById("assetslink");

/* =========================================================================
   BUCLE de juego con requestAnimationFrame + delta-time
   ========================================================================= */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  assetsLink.hidden = game.state !== "title";   // el link al catálogo solo aparece en el menú
  if (game.state === "title") {
    applyRoomTheme(menuPalette);   // botones + borde de pantalla con la paleta (aleatoria) del menú
    // Cualquier acción (incluye botones táctiles) arranca la partida.
    if (pressed("jump") || pressed("use") || pressed("forward")) {
      resetGame(); game.state = "playing";
    }
    drawTitleScreen(now, menuPalette);
  } else {
    for (const e of entities) e.update(room, dt);
    updateObjects(room, dt);   // gravedad de los objetos (caen si quedan en el aire)
    checkExits();
    if (!game.won) game.lightYears = Math.max(0, game.lightYears - dt * 6); // cuenta atrás (cosmética por ahora)
    render(room);
  }
  // Snapshot de teclas para los flancos del próximo frame: UNA sola vez por frame,
  // tras actualizar todas las entidades (en título y en juego).
  snapshotKeys();
  requestAnimationFrame(loop);
}

/* API mínima para pruebas automáticas */
window.__pocho = { player, entities, game, get room() { return room; }, world };

/* =========================================================================
   ARRANQUE — conectar canvas/teclado/táctil y lanzar el bucle.
   (Con <script type="module"> el DOM ya está parseado al ejecutarse.)
   ========================================================================= */
initView();                       // contexto 2D del canvas
initInput();                      // teclado físico
initTouch();                      // botones táctiles → reusan el teclado
applyRoomTheme(menuPalette);      // tema inicial = paleta (aleatoria) del menú
requestAnimationFrame(loop);

/* Botón de PANTALLA COMPLETA (Fullscreen API). En iPhone/Safari no existe esta API:
   ahí se oculta el botón y la vía es "Compartir → Añadir a pantalla de inicio", que
   con las meta tags lanza el juego sin barra. Si ya está en modo app, también se oculta. */
(function () {
  const fsbtn = document.getElementById("fsbtn");
  const root = document.documentElement;
  const enter = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit  = document.exitFullscreen || document.webkitExitFullscreen;
  const isFs  = () => document.fullscreenElement || document.webkitFullscreenElement;
  const isStandalone = matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (!enter || isStandalone) { fsbtn.style.display = "none"; return; }
  fsbtn.addEventListener("click", () => {
    if (isFs()) exit.call(document); else enter.call(root);
  });
  document.addEventListener("fullscreenchange", () => { fsbtn.textContent = isFs() ? "🗗" : "⛶"; });
})();
