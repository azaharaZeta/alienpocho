/* =============================================================================
   ALIEN POCHO — ARRANQUE + BUCLE (main.js)
   -----------------------------------------------------------------------------
   Punto de entrada (único <script type="module"> de index.html): máquina de
   estados título↔juego, bucle (rAF + delta-time), arranque (init*) y botón de
   pantalla completa. Dibujo en render.js/screens.js; simulación en
   game.js/player.js/physics.js. Ver docs/ARQUITECTURA.md.
   ============================================================================= */
"use strict";

import { INKS, INK2 } from "./palette.js";
import { initView, applyRoomTheme } from "./view.js";
import { pressed, snapshotKeys, initInput, initTouch } from "./input.js";
// `room` es un binding VIVO: game.js lo reasigna al cambiar de sala.
import { game, world, room, checkExits, resetGame } from "./game.js";
import { player, entities } from "./player.js";
import { updateObjects } from "./physics.js";
import { render } from "./render.js";
import { drawTitleScreen } from "./screens.js";
import { AP } from "./draw.js";   // para precargar las imágenes al arrancar

/* PALETA DEL MENÚ: aleatoria en cada carga (una de las parejas primario/secundario). */
const menuPalette = (() => {
  const k = Math.floor(Math.random() * INKS.length);
  return { ink: INKS[k], ink2: INK2[k] };
})();

/* Precarga de imágenes: arranca al cargar (durante el título, que es procedural y no necesita assets).
   No se entra a "playing" hasta que está lista → el primer frame de juego ya tiene todas las imágenes
   (sin parpadeo). `wantStart` recuerda la pulsación si el jugador arranca antes de terminar la carga. */
let assetsReady = false, wantStart = false;
// La precarga corre durante el título; tope de seguridad de 3s para no dejar el arranque bloqueado
// si alguna imagen no carga ni falla (caso raro de red).
Promise.race([AP.preload(), new Promise(r => setTimeout(r, 3000))]).then(() => { assetsReady = true; });

/* BUCLE de juego (requestAnimationFrame + delta-time) */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state === "title") {
    applyRoomTheme(menuPalette);   // UI con la paleta del menú
    // Cualquier acción (incluye botones táctiles) arranca la partida; espera a que las imágenes estén listas.
    if (pressed("jump") || pressed("use") || pressed("forward")) wantStart = true;
    if (wantStart && assetsReady) { resetGame(); game.state = "playing"; wantStart = false; }
    drawTitleScreen(now, menuPalette);
  } else {
    for (const e of entities) e.update(room, dt);
    updateObjects(room, dt);   // gravedad de los objetos
    checkExits();
    render(room);
  }
  // Snapshot de teclas para los flancos del próximo frame (una vez por frame).
  snapshotKeys();
  requestAnimationFrame(loop);
}

/* API mínima para pruebas automáticas */
window.__pocho = { player, entities, game, get room() { return room; }, world };

/* ARRANQUE — conectar canvas/teclado/táctil y lanzar el bucle.
   (Con <script type="module"> el DOM ya está parseado al ejecutarse.) */
initView();                       // contexto 2D del canvas
initInput();                      // teclado físico
initTouch();                      // botones táctiles → reusan el teclado
applyRoomTheme(menuPalette);      // tema inicial = paleta del menú
requestAnimationFrame(loop);

/* Botón de PANTALLA COMPLETA (Fullscreen API). Se oculta donde la API no existe
   (iPhone/Safari) o si ya se ejecuta en modo app (display-mode: standalone). */
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
