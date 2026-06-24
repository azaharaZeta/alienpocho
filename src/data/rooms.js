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
     objects      CUBETA ÚNICA de lo colocable no-estructural: bloques, circuitos, ordenadores…
                  { asset | shape, cx,cy (celda) | x,y (continuo), z?, h? (pila), traits? }.
                  El COMPORTAMIENTO lo deciden los TRAITS (del asset, o de la instancia vía `traits`),
                  NO la cubeta: `cube` = solo `solid` (fijo); prop_* y computer = movable+falls (simulados).
                  Bloque empujable = `{ asset:"cube", x, y, traits:{ movable:true, falls:true } }`.
     sockets      zócalos-destino { cx, cy, z, requires, filled } (cubeta propia: lógica de puzzle).
     hazards      pinchos { cx, cy } (decorativos; cubeta propia).

   COORDENADAS — DOS convenciones (el nombre del campo la delata), AMBAS centradas en la celda:
     · ÍNDICE DE CELDA (entero) → `cx,cy` (objects fijos como los bloques; sockets/hazards): el
       código suma 0.5 para centrar. `cx:2` = centro de la celda 2.
     · CENTRO CONTINUO (decimal) → `x,y` (objects que se mueven, igual que el jugador): punto exacto.
       `2.5` = centro de la celda 2; centrar en (n,m) = x:n+0.5, y:m+0.5.
     z = altura de la base (continua; lo que cae se apila). z:0 = suelo. h = nº de copias apiladas.

   Formas (objects/sockets): "cube" | "pyramid" | "dome" | "cylinder".
   ============================================================================= */
"use strict";

export const START = "0,0";

export const ROOMS = {
  // ENTRADA — cuadrada 8×8 (inicio).
  "0,0": { name: "ENTRADA", paletteIndex: 0, w: 8, h: 8,
    exits: { xp: "1,0" },
    objects: [{ asset: "cube", cx: 2, cy: 2 },
              { x: 3.5, y: 5.5, z: 0, shape: "cube" }],
    sockets: [{ cx: 6, cy: 5, z: 0, requires: "cube", filled: null }] },

  // GALERÍA — pasillo ANCHO máximo 13×3.
  "1,0": { name: "GALERIA", paletteIndex: 2, w: 13, h: 3,
    exits: { xm: "0,0", xp: "2,0", yp: "1,1" },
    objects: [{ asset: "cube", cx: 4, cy: 1 }, { asset: "cube", cx: 9, cy: 1, h: 2 },
              { asset: "computer", x: 1.5, y: 1.5, z: 0 }, { asset: "computer", x: 6.5, y: 1.5, z: 0 }, { asset: "computer", x: 11.5, y: 1.5, z: 0 }] },

  // CELDA — mini sala 3×3.
  "2,0": { name: "CELDA", paletteIndex: 3, w: 4, h: 4,
    exits: { xm: "1,0", xp: "3,0", ym: "2,-1" },
    objects: [{ x: 2.5, y: 2.5, z: 0, shape: "pyramid" }],
    sockets: [{ cx: 1, cy: 1, z: 0, requires: "pyramid", filled: null }] },

  // TORRE — pasillo LARGO máximo 3×13.
  "3,0": { name: "TORRE", paletteIndex: 4, w: 3, h: 13,
    exits: { xm: "2,0", yp: "3,1" },
    objects: [{ asset: "cube", cx: 1, cy: 4 }, { asset: "cube", cx: 1, cy: 8, h: 2 }] },

  // NAVE — rectangular ancha 10×6.
  "3,1": { name: "NAVE", paletteIndex: 5, w: 10, h: 6,
    exits: { ym: "3,0", xp: "4,1" },
    objects: [{ asset: "cube", cx: 5, cy: 2 }, { asset: "cube", cx: 7, cy: 4, h: 2 },
              { x: 2.5, y: 2.5, z: 0, shape: "dome" },
              { asset: "computer", x: 1.5, y: 4.5, z: 0 }, { asset: "computer", x: 8.5, y: 1.5, z: 0 }],
    sockets: [{ cx: 8, cy: 4, z: 0, requires: "dome", filled: null }] },

  // CONDUCTO — pasillo LARGO 4×12.
  "1,1": { name: "CONDUCTO", paletteIndex: 1, w: 4, h: 12,
    exits: { ym: "1,0" },
    objects: [{ asset: "cube", cx: 1, cy: 3 }, { asset: "cube", cx: 2, cy: 7 }, { asset: "cube", cx: 1, cy: 9, h: 2 }] },

  // NICHO — mini sala 3×3 (rama trasera).
  "2,-1": { name: "NICHO", paletteIndex: 1, w: 3, h: 3,
    exits: { yp: "2,0" },
    objects: [{ asset: "cube", cx: 1, cy: 1 }] },

  // BODEGA — rectangular alta 6×10 (final).
  "4,1": { name: "BODEGA", paletteIndex: 0, w: 6, h: 10,
    exits: { xm: "3,1" },
    objects: [{ asset: "cube", cx: 3, cy: 4 }, { asset: "cube", cx: 2, cy: 6, h: 2 },
              { x: 2.5, y: 2.5, z: 0, shape: "cylinder" },
              { asset: "computer", x: 4.5, y: 1.5, z: 0 }, { asset: "computer", x: 1.5, y: 8.5, z: 0 }],
    sockets: [{ cx: 3, cy: 7, z: 0, requires: "cylinder", filled: null }] },
};
