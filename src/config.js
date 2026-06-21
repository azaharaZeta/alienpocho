/* =============================================================================
   ALIEN POCHO — CONFIG (config.js)
   -----------------------------------------------------------------------------
   Parámetros del juego en UN solo sitio (estética + geometría iso + física +
   controles). Módulo HOJA: no importa nada → lo importan todos los demás. Sacar
   estas constantes aquí es lo que rompe el acoplamiento por globales del shell.
   ============================================================================= */
"use strict";

/* Constantes globales (estética + geometría isométrica + física). */
export const CFG = {
  W: 320, H: 240,
  TILE_W: 34,               // sala grande dejando una banda inferior para el marcador
  TILE_H: 17,               // (se mantiene el iso 2:1 clásico)
  BLOCK_H: 17,
  WALK: 3.0,                // velocidad de avance (celdas/seg)
  PRAD: 0.32,               // radio de colisión del jugador
  STEP: 0.08,               // altura máx. salvable andando (sin saltar)
  TURN_TIME: 0.12,          // duración del giro de 90° (anim/cooldown)
  GRAVITY: 22,              // gravedad (celdas/seg^2)
  // Salto de UN botón: pulsación < JUMP_TAP_TIME => bajo/corto; si se mantiene => alto/largo.
  JUMP_TAP_TIME: 0.14,              // umbral (seg) entre pulsación corta y larga
  JUMP_LOW:  { vz: 5.0, vh: 2.2 },  // corto y bajo  (apex ~0.57 celdas)
  JUMP_HIGH: { vz: 7.6, vh: 3.4 },  // largo y alto  (apex ~1.31, sube 1 bloque)
  COL: {
    bg:        "#000000",
    floorLine: "#0c4747",
    floorFill: "#04181b",
    floorFill2:"#020f12",   // tablero sutil del suelo
    top:       "#22cccc",   // rampa cian coherente (luz desde arriba)
    left:      "#168f8f",
    right:     "#0c6363",
    edge:      "#6fdede",   // arista suave (antes casi blanca = ruido)
    shadow:    "#010a0a",
    botTop:    "#8ffcff",
    botLeft:   "#3ad0d0",
    botRight:  "#1f9c9c",
    botDark:   "#063636",
    botEdge:   "#eaffff",
    hud:       "#00e0e0",
    hudDim:    "#066",
    hudBright: "#dfffff",
    roomName:  "#b9a6ff",   // morado sutil para el nombre de la sala (a juego con el botón saltar)
    accent:    "#b9a6ff",   // acento morado sutil (antes rojo): esquinas del marco y textos
    accentDim: "#352a55"
  }
};

/* CONTROLS — asignación de teclas (PARAMETRIZABLE). Cada acción admite varias teclas.
   Códigos: https://developer.mozilla.org/docs/Web/API/KeyboardEvent/code */
export const CONTROLS = {
  turnLeft:  ["ArrowLeft", "KeyA"],
  turnRight: ["ArrowRight", "KeyD"],
  forward:   ["ArrowUp", "KeyW"],
  jump:      ["Space"],           // botón único: corto = salto bajo, largo = salto alto
  use:       ["KeyE", "Enter"]    // recoger / soltar circuito
};

// El pico (vértice frontal) de la sala baja hasta la cima del marcador inferior;
// arriba queda una banda fina para el título y abajo el marco estilo Alien 8.
export const ORIGIN = { x: CFG.W / 2, y: 66 };

// Opciones del proyector iso, derivadas del tamaño de tesela (compartidas dibujo/lógica).
export const POPT = { TILE_W: CFG.TILE_W, TILE_H: CFG.TILE_H, BLOCK_H: CFG.BLOCK_H };
