/* =============================================================================
   ALIEN POCHO — DATOS DEL MAPA (data/rooms.js)
   -----------------------------------------------------------------------------
   EL MAPA como DATOS PUROS, separados del motor que los interpreta (world.js).
   Editar/añadir salas o reubicar objetos se hace AQUÍ, sin tocar lógica.

   Cada sala:
     name         nombre mostrado en el HUD.
     paletteIndex índice en INKS/INK2 (palette.js) → color primario/secundario.
     w, h         tamaño de la rejilla. Límites (los aplica makeRoom): w,h ∈ [3,13]
                  y w+h ≤ 16, para que el rombo y el HUD quepan en pantalla.
     exits        { xm, xp, ym, yp } → clave de la sala vecina al cruzar ese borde:
                    xm: x<0 (atrás-izq)   xp: x≥w (frente-dcha)
                    ym: y<0 (atrás-dcha)  yp: y≥h (frente-izq)
                  Cada salida debe tener su RECÍPROCA en la sala destino.
     blocks       cubos sólidos { x, y, z, h } (h = nº de capas). Suelo z:0 = andable.
     objects      circuitos físicos { x, y, z, shape } (empujables/llevables/caen).
     sockets      zócalos-destino { cx, cy, z, shape, active }.
     hazards      pinchos { cx, cy } (decorativos).

   COORDENADAS — DOS convenciones (el nombre del campo la delata):
     · ÍNDICE DE CELDA (entero) → blocks (x,y), sockets/hazards (cx,cy): la celda de
       la rejilla. {x:2,y:2} LLENA la celda [2,3]×[2,3]; el código suma 0.5 a los
       zócalos para centrarlos.
     · CENTRO CONTINUO (decimal) → objects (x,y), igual que el jugador: un punto
       exacto, porque los objetos se MUEVEN. `2.5` = centro de la celda (2,2);
       centrar en (n,m) = x:n+0.5, y:m+0.5.
     z = altura de la base (continua; los objetos caen y se apilan). z:0 = suelo.

   Formas (objects/sockets): "cube" | "pyramid" | "dome" | "cylinder".
   ============================================================================= */
"use strict";

export const START = "0,0";

export const ROOMS = {
  // ENTRADA — cuadrada 8×8 (inicio).
  "0,0": { name: "ENTRADA", paletteIndex: 0, w: 8, h: 8,
    exits: { xp: "1,0" },
    blocks:  [{ x: 2, y: 2, z: 0, h: 1 }],
    objects: [{ x: 3.5, y: 5.5, z: 0, shape: "cube" }],
    sockets: [{ cx: 6, cy: 5, z: 0, shape: "cube", active: false }] },

  // GALERÍA — pasillo ANCHO máximo 13×3.
  "1,0": { name: "GALERIA", paletteIndex: 2, w: 13, h: 3,
    exits: { xm: "0,0", xp: "2,0", yp: "1,1" },
    blocks: [{ x: 4, y: 1, z: 0, h: 1 }, { x: 9, y: 1, z: 0, h: 2 }],
    objects: [{ asset: "computer", x: 1.5, y: 1.5, z: 0 }, { asset: "computer", x: 6.5, y: 1.5, z: 0 }, { asset: "computer", x: 11.5, y: 1.5, z: 0 }] },

  // CELDA — mini sala 3×3.
  "2,0": { name: "CELDA", paletteIndex: 3, w: 4, h: 4,
    exits: { xm: "1,0", xp: "3,0", ym: "2,-1" },
    objects: [{ x: 2.5, y: 2.5, z: 0, shape: "pyramid" }],
    sockets: [{ cx: 1, cy: 1, z: 0, shape: "pyramid", active: false }] },

  // TORRE — pasillo LARGO máximo 3×13.
  "3,0": { name: "TORRE", paletteIndex: 4, w: 3, h: 13,
    exits: { xm: "2,0", yp: "3,1" },
    blocks: [{ x: 1, y: 4, z: 0, h: 1 }, { x: 1, y: 8, z: 0, h: 2 }] },

  // NAVE — rectangular ancha 10×6.
  "3,1": { name: "NAVE", paletteIndex: 5, w: 10, h: 6,
    exits: { ym: "3,0", xp: "4,1" },
    blocks:  [{ x: 5, y: 2, z: 0, h: 1 }, { x: 7, y: 4, z: 0, h: 2 }],
    objects: [{ x: 2.5, y: 2.5, z: 0, shape: "dome" },
              { asset: "computer", x: 1.5, y: 4.5, z: 0 }, { asset: "computer", x: 8.5, y: 1.5, z: 0 }],
    sockets: [{ cx: 8, cy: 4, z: 0, shape: "dome", active: false }] },

  // CONDUCTO — pasillo LARGO 4×12.
  "1,1": { name: "CONDUCTO", paletteIndex: 1, w: 4, h: 12,
    exits: { ym: "1,0" },
    blocks: [{ x: 1, y: 3, z: 0, h: 1 }, { x: 2, y: 7, z: 0, h: 1 }, { x: 1, y: 9, z: 0, h: 2 }] },

  // NICHO — mini sala 3×3 (rama trasera).
  "2,-1": { name: "NICHO", paletteIndex: 1, w: 3, h: 3,
    exits: { yp: "2,0" },
    blocks: [{ x: 1, y: 1, z: 0, h: 1 }] },

  // BODEGA — rectangular alta 6×10 (final).
  "4,1": { name: "BODEGA", paletteIndex: 0, w: 6, h: 10,
    exits: { xm: "3,1" },
    blocks:  [{ x: 3, y: 4, z: 0, h: 1 }, { x: 2, y: 6, z: 0, h: 2 }],
    objects: [{ x: 2.5, y: 2.5, z: 0, shape: "cylinder" },
              { asset: "computer", x: 4.5, y: 1.5, z: 0 }, { asset: "computer", x: 1.5, y: 8.5, z: 0 }],
    sockets: [{ cx: 3, cy: 7, z: 0, shape: "cylinder", active: false }] },
};
