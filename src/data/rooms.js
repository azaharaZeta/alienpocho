/* =============================================================================
   ALIEN POCHO — DATOS DEL MAPA (data/rooms.js)
   -----------------------------------------------------------------------------
   EL MAPA como DATOS PUROS, separados del motor que los interpreta (world.js).
   Editar/añadir salas o reubicar objetos se hace AQUÍ, sin tocar lógica.

   Cada sala:
     name         nombre mostrado en el HUD.
     paletteIndex índice en INKS/INK2 (palette.js) → color primario/secundario.
     w, h         tamaño de la rejilla: SOLO {4, 6, 8} (makeRoom acota a [4,8] y fuerza par, redondeo ↑).
                  Así la puerta (2 de ancho) cae centrada en celda entera y la pared se dibuja como
                  módulos SVG sin recorte. Valores impares o fuera de rango se ajustan al {4,6,8} más cercano ↑.
     exits        { xm, xp, ym, yp } → clave de la sala vecina al cruzar ese borde:
                    xm: x<0 (atrás-izq)   xp: x≥w (frente-dcha)
                    ym: y<0 (atrás-dcha)  yp: y≥h (frente-izq)
                  Cada salida debe tener su RECÍPROCA en la sala destino.
     objects      CUBETA ÚNICA de lo colocable no-estructural: bloques, circuitos, ordenadores…
                  { asset | shape, cx,cy (celda) | x,y (continuo), z?, h? (pila), traits? }.
                  El COMPORTAMIENTO lo deciden los TRAITS (del asset, o de la instancia vía `traits`),
                  NO la cubeta: `cube` = solo `solid` (fijo); prop_* y computer = movable+falls (simulados).
                  Bloque empujable = `{ asset:"cube", x, y, traits:{ movable:true, falls:true } }`.
     sockets      zócalos-destino { cx, cy, z, id, filled }. Qué circuito PIDE cada uno lo decide la MISIÓN
                  (data/mission.js → MISSION.requires[id]); `filled` = circuito puesto (estado de partida).
     hazards      pinchos { cx, cy } (decorativos; cubeta propia).

   COORDENADAS — DOS convenciones (el nombre del campo la delata), AMBAS centradas en la celda:
     · ÍNDICE DE CELDA (entero) → `cx,cy` (objects fijos como los bloques; sockets/hazards): el
       código suma 0.5 para centrar. `cx:2` = centro de la celda 2.
     · CENTRO CONTINUO (decimal) → `x,y` (objects que se mueven, igual que el jugador): punto exacto.
       `2.5` = centro de la celda 2; centrar en (n,m) = x:n+0.5, y:m+0.5.
     z = altura de la base (continua; lo que cae se apila). z:0 = suelo. h = nº de copias apiladas.

   Formas (circuitos): "cube" | "pyramid" | "dome" | "cylinder".

   ⚠️ NO poner objetos en el VANO de una puerta: las FRONTALES (xp/yp) tapan lo de detrás en su columna iso
   (diagonal x−y). Mantener los objetos con `x−y` fuera de la franja del marco (ver memoria/iso-occlusion).
   ============================================================================= */
"use strict";

/* MAPA LABERÍNTICO (árbol de 17 salas, ramas y callejones). Espina hacia +x (ENTRADA→GALERIA→NUDO→CRUCE→
   ARCHIVO) con ramas arriba (ALTILLO/DESVAN) y abajo (VERTEDERO→REACTOR→SILO), más una rama larga hacia
   abajo-izq (CONDUCTO→CISTERNA→TUBO→BODEGA→ESCLUSA→FOSA). 6 circuitos/zócalos (2 cube, 2 pyramid, 1 dome,
   1 cylinder); cada circuito en sala DISTINTA de su zócalo, salvo el CUBO de ENTRADA. */
export const ROOMS = {
  // ENTRADA 8×8 (inicio + tutorial): salta a la plataforma, coge el CUBO y ponlo en su zócalo (aquí mismo).
  "0,0": { name: "ENTRADA", paletteIndex: 0, w: 8, h: 8,
    exits: { xp: "1,0", yp: "0,1" },
    objects: [{ asset: "cube", cx: 2, cy: 4 }, { asset: "cube", cx: 3, cy: 4 },
              { x: 3.5, y: 4.5, z: 1, shape: "cube" }],
    sockets: [{ cx: 5, cy: 5, z: 0, id: "e1", filled: null }] },

  // GALERIA — pasillo ANCHO 8×4 (zigzag). Zócalo del CILINDRO.
  "1,0": { name: "GALERIA", paletteIndex: 2, w: 8, h: 4,
    exits: { xm: "0,0", xp: "2,0", yp: "1,1" },
    objects: [{ asset: "cube", cx: 3, cy: 0 }, { asset: "cube", cx: 5, cy: 2 }],   // cx5cy2: fuera del vano de xp
    sockets: [{ cx: 5, cy: 0, z: 0, id: "gal", filled: null }] },

  // NUDO — hub 6×6 (3 salidas). Zócalo del DOMO.
  "2,0": { name: "NUDO", paletteIndex: 4, w: 6, h: 6,
    exits: { xm: "1,0", xp: "3,0", ym: "2,-1" },
    sockets: [{ cx: 3, cy: 2, z: 0, id: "nudo", filled: null }] },

  // CRUCE — 6×6 (bifurca). Laberinto.
  "3,0": { name: "CRUCE", paletteIndex: 1, w: 6, h: 6,
    exits: { xm: "2,0", xp: "4,0", yp: "3,1" },
    objects: [{ asset: "cube", cx: 2, cy: 1 }, { asset: "cube", cx: 4, cy: 3 }] },

  // ARCHIVO — 4×6 (callejón). Zócalo del CUBO (#2).
  "4,0": { name: "ARCHIVO", paletteIndex: 3, w: 4, h: 6,
    exits: { xm: "3,0" },
    objects: [{ asset: "cube", cx: 1, cy: 3 }],
    sockets: [{ cx: 2, cy: 2, z: 0, id: "a4", filled: null }] },

  // POZO — 6×6 (callejón). Laberinto.
  "1,1": { name: "POZO", paletteIndex: 5, w: 6, h: 6,
    exits: { ym: "1,0" },
    objects: [{ asset: "cube", cx: 1, cy: 2 }, { asset: "cube", cx: 3, cy: 4, h: 2 }] },

  // ALTILLO — 6×4 (callejón arriba). Circuito PIRÁMIDE en plataforma → SALTO.
  "2,-1": { name: "ALTILLO", paletteIndex: 1, w: 6, h: 4,
    exits: { yp: "2,0", xm: "1,-1" },
    objects: [{ asset: "cube", cx: 2, cy: 1 }, { asset: "cube", cx: 3, cy: 1 },
              { x: 3.5, y: 1.5, z: 1, shape: "pyramid" }] },

  // DESVAN — 6×4 (callejón). Circuito PIRÁMIDE (#2) en plataforma → SALTO.
  "1,-1": { name: "DESVAN", paletteIndex: 4, w: 6, h: 4,
    exits: { xp: "2,-1" },
    objects: [{ asset: "cube", cx: 1, cy: 1 }, { asset: "cube", cx: 2, cy: 1 },
              { x: 2.5, y: 1.5, z: 1, shape: "pyramid" }] },

  // VERTEDERO — pasillo 8×6 (laberinto + pinchos deco).
  "3,1": { name: "VERTEDERO", paletteIndex: 5, w: 8, h: 6,
    exits: { ym: "3,0", xp: "4,1" },
    objects: [{ asset: "cube", cx: 1, cy: 2 }, { asset: "cube", cx: 3, cy: 4 }, { asset: "cube", cx: 2, cy: 1 }],
    hazards: [{ cx: 1, cy: 3 }] },

  // REACTOR — 8×6 (callejón). Circuito DOMO en plataforma 2-alto → EMPUJA el bloque y SALTA.
  "4,1": { name: "REACTOR", paletteIndex: 3, w: 8, h: 6,
    exits: { xm: "3,1", yp: "4,2" },
    objects: [{ asset: "cube", cx: 4, cy: 1, h: 2 }, { asset: "cube", cx: 5, cy: 1, h: 2 },   // plataforma 2-alto
              { x: 4.5, y: 1.5, z: 2, shape: "dome" },                                          // circuito DOMO arriba
              { asset: "cube", x: 5.5, y: 3.5, traits: { movable: true, falls: true } }] },     // bloque EMPUJABLE

  // SILO — 6×6 (callejón). Zócalo de la PIRÁMIDE (#2).
  "4,2": { name: "SILO", paletteIndex: 0, w: 6, h: 6,
    exits: { ym: "4,1" },
    objects: [{ asset: "cube", cx: 4, cy: 3 }],
    sockets: [{ cx: 1, cy: 2, z: 0, id: "d3", filled: null }] },

  // CONDUCTO — pasillo alto 4×8. Zócalo de la PIRÁMIDE.
  "0,1": { name: "CONDUCTO", paletteIndex: 1, w: 4, h: 8,
    exits: { ym: "0,0", yp: "0,2" },
    objects: [{ asset: "cube", cx: 1, cy: 2 }, { asset: "cube", cx: 2, cy: 5 }],
    sockets: [{ cx: 1, cy: 4, z: 0, id: "cond", filled: null }] },

  // CISTERNA — 8×6 (laberinto + pinchos deco).
  "0,2": { name: "CISTERNA", paletteIndex: 0, w: 8, h: 6,
    exits: { ym: "0,1", xp: "1,2" },
    objects: [{ asset: "cube", cx: 2, cy: 2 }, { asset: "cube", cx: 4, cy: 3, h: 2 }, { asset: "cube", cx: 1, cy: 3 }],
    hazards: [{ cx: 5, cy: 4 }] },

  // TUBO — 6×6 (laberinto).
  "1,2": { name: "TUBO", paletteIndex: 2, w: 6, h: 6,
    exits: { xm: "0,2", xp: "2,2" },
    objects: [{ asset: "cube", cx: 1, cy: 2 }, { asset: "cube", cx: 2, cy: 4, h: 2 }] },

  // BODEGA — 6×6. Circuito CILINDRO en plataforma 2-alto → SALTO DOBLE (peldaño fijo + plataforma).
  "2,2": { name: "BODEGA", paletteIndex: 5, w: 6, h: 6,
    exits: { xm: "1,2", xp: "3,2" },
    objects: [{ asset: "cube", cx: 1, cy: 1 },                                                 // peldaño 1-alto
              { asset: "cube", cx: 2, cy: 1, h: 2 }, { asset: "cube", cx: 3, cy: 1, h: 2 },   // plataforma 2-alto
              { x: 3.5, y: 1.5, z: 2, shape: "cylinder" }] },                                   // circuito CILINDRO arriba

  // ESCLUSA — 6×6. Circuito CUBO (#2) en plataforma → SALTO.
  "3,2": { name: "ESCLUSA", paletteIndex: 2, w: 6, h: 6,
    exits: { xm: "2,2", yp: "3,3" },
    objects: [{ asset: "cube", cx: 2, cy: 1 }, { asset: "cube", cx: 3, cy: 1 },
              { x: 3.5, y: 1.5, z: 1, shape: "cube" }] },

  // FOSA — 6×6 (callejón final). Laberinto.
  "3,3": { name: "FOSA", paletteIndex: 5, w: 6, h: 6,
    exits: { ym: "3,2" },
    objects: [{ asset: "cube", cx: 1, cy: 2 }, { asset: "cube", cx: 3, cy: 3, h: 2 }] },
};
