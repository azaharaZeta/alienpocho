/* =============================================================================
   ALIEN POCHO — CONFIG (config.js)
   -----------------------------------------------------------------------------
   Parámetros del juego (estética + geometría iso + física + controles).
   Casi hoja: solo lee la geometría de assets.js (la SSOT) — que la re-exporta más abajo.
   ============================================================================= */
"use strict";

import { ROBOT } from "./data/assets.js";   // geometría del robot (la huella = el ancho dibujado)

/* Constantes globales (estética + geometría isométrica + física). */
export const CFG = {
  W: 320, H: 240,
  TILE_W: 34,               // ancho de tesela (iso 2:1)
  TILE_H: 17,               // alto de tesela
  BLOCK_H: 17,
  WALK: 3.0,                // velocidad de avance (celdas/seg)
  PRAD: ROBOT.WID,          // semihuella del robot = SU ANCHO DIBUJADO (colisión Y orden del painter usan la
                            //   MISMA caja, = la silueta): así no sobresale del cuerpo → el painter lo ordena
                            //   como a cualquier objeto, sin overhang ni casos especiales. Ver refactor-motor-iso.md
  STEP: 0.25,               // altura máx. (en bloques) que el robot salva andando sin saltar;
                            //   se sube solo a superficies bajas (peana del zócalo), no a un bloque entero
  TURN_TIME: 0.12,          // duración del giro de 90° (anim/cooldown)
  GRAVITY: 22,              // gravedad (celdas/seg^2)
  // Salto de un botón: pulsación < JUMP_TAP_TIME => bajo/corto; si se mantiene => alto/largo.
  JUMP_TAP_TIME: 0.14,              // umbral (seg) entre pulsación corta y larga
  JUMP_LOW:  { vz: 5.0, vh: 2.2 },  // corto y bajo  (apex ~0.57 celdas)
  JUMP_HIGH: { vz: 7.6, vh: 3.4 },  // largo y alto  (apex ~1.31, sube 1 bloque)
  COL: {
    bg:        "#000000",
    floorLine: "#0c4747",
    floorFill: "#04181b",
    floorFill2:"#020f12",   // tablero sutil del suelo
    top:       "#22cccc",   // cara superior (luz desde arriba)
    left:      "#168f8f",
    right:     "#0c6363",
    edge:      "#6fdede",   // arista
    shadow:    "#010a0a",
    botTop:    "#8ffcff",
    botLeft:   "#3ad0d0",
    botRight:  "#1f9c9c",
    botDark:   "#063636",
    botEdge:   "#eaffff",
    hud:       "#00e0e0",
    hudDim:    "#066",
    hudBright: "#dfffff",
    roomName:  "#b9a6ff",   // morado del nombre de la sala
    accent:    "#b9a6ff",   // morado de esquinas del marco y textos
    accentDim: "#352a55"
  }
};

/* CONTROLS — asignación de teclas (cada acción admite varias).
   Códigos: https://developer.mozilla.org/docs/Web/API/KeyboardEvent/code */
export const CONTROLS = {
  turnLeft:  ["ArrowLeft", "KeyA"],
  turnRight: ["ArrowRight", "KeyD"],
  forward:   ["ArrowUp", "KeyW"],
  jump:      ["Space"],           // corto = salto bajo, largo = salto alto
  use:       ["KeyE", "Enter"],   // recoger / soltar circuito
  // DEBUG — overlays de desarrollo (los pinta render.js sobre la escena): conmutan por flanco
  dbgBox:    ["KeyJ"],            // cubo de referencia (AABB de cada asset)
  dbgRegion: ["KeyK"],            // región estándar (AABB redondeada a celdas)
  dbgAnchor: ["KeyL"]             // punto de anclaje (ancla = esquina + offset)
};

// Origen iso en pantalla: deja una banda arriba para el título y abajo el marco.
export const ORIGIN = { x: CFG.W / 2, y: 66 };

// Opciones del proyector iso, derivadas del tamaño de tesela (compartidas dibujo/lógica).
export const POPT = { TILE_W: CFG.TILE_W, TILE_H: CFG.TILE_H, BLOCK_H: CFG.BLOCK_H };

// Si true, los assets migrados usan el PNG de assets/png/ si existe; si no, su SVG.
// Si false, siempre el SVG. (Los no migrados siguen en vector procedural.) Ver docs/ASSETS.md.
export const ASSET_USE_PNG = true;

/* =========================================================================
   GEOMETRÍA COMPARTIDA (dibujo + física). Su hogar único es el registro de
   assets src/data/assets.js; aquí solo se RE-EXPORTA por comodidad.
   ========================================================================= */
export { PROP, ROBOT, DOOR, SOCKET, WALL_H } from "./data/assets.js";

// Variante de tile de pared: "wall1" (hexágono pequeño) | "wall2" (hexágono doble).
// En consola: window.__wall para comparar.
export const WALL_TILE = "wall1";

// Encuadre de escena (ver view.projectorFor): define la BASE del suelo del marco fijo 8×8 a la que se
// ancla la esquina frontal de toda sala. PROJECTOR_DROP baja la escena unos px.
export const SCENE = { PROJECTOR_OY: 134, PROJECTOR_DROP: 20 };
