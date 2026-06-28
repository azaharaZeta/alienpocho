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
                  { asset | shape, x, y, z?, h? (pila), traits? }.
                  El COMPORTAMIENTO lo deciden los TRAITS (del asset, o de la instancia vía `traits`),
                  NO la cubeta: `cube` = solo `solid` (fijo); prop_* y computer = movable+falls (simulados).
                  Bloque empujable = `{ asset:"cube", x, y, traits:{ movable:true, falls:true } }`.
     sockets      zócalos-destino { x, y, z?, id, filled }. Qué circuito PIDE cada uno lo decide la MISIÓN
                  (data/mission.js → MISSION.requires[id]); `filled` = circuito puesto (estado de partida).
     hazards      pinchos { x, y } (decorativos; cubeta propia).

   COORDENADAS — UNA sola convención para TODOS los assets (objects, sockets, hazards):
     Posición CONTINUA `x, y` = punto de ancla en el mundo (igual que el jugador). Para los assets
     centrados (todos los `object`: footMode "center"), `x,y` es el CENTRO. Centrar en la celda (n,m) =
     `x: n+0.5, y: m+0.5`. No hay índices de celda: `cx,cy` ya NO existen.
     `z` = altura de la base (continua; lo que cae se apila). OPCIONAL → ausente = suelo (z=0; lo
     normaliza makeRoom). `h` = nº de copias apiladas (terreno fijo).

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
    objects: [{ asset: "cube", x: 2.5, y: 4.5 }, { asset: "cube", x: 3.5, y: 4.5 },
              { x: 3.5, y: 4.5, z: 1, shape: "cube" }],
    sockets: [{ x: 5.5, y: 5.5, id: "e1", filled: null }] },

  // GALERIA — pasillo ANCHO 8×4 (zigzag). Zócalo del CILINDRO.
  "1,0": { name: "GALERIA", paletteIndex: 2, w: 8, h: 4,
    exits: { xm: "0,0", xp: "2,0", yp: "1,1" },
    objects: [{ asset: "cube", x: 3.5, y: 0.5 }, { asset: "cube", x: 5.5, y: 2.5 }],   // (5.5,2.5): fuera del vano de xp
    sockets: [{ x: 5.5, y: 0.5, id: "gal", filled: null }] },

  // NUDO — hub 6×6 (3 salidas). Zócalo del DOMO + un ORDENADOR recogible.
  "2,0": { name: "NUDO", paletteIndex: 4, w: 6, h: 6,
    exits: { xm: "1,0", xp: "3,0", ym: "2,-1" },
    objects: [{ asset: "computer", x: 1.5, y: 1.5 }],   // esquina trasera, fuera del vano/columna iso de xp
    sockets: [{ x: 3.5, y: 2.5, id: "nudo", filled: null }] },

  // CRUCE — 6×6 (bifurca). Laberinto + un ORDENADOR recogible.
  "3,0": { name: "CRUCE", paletteIndex: 1, w: 6, h: 6,
    exits: { xm: "2,0", xp: "4,0", yp: "3,1" },
    objects: [{ asset: "cube", x: 2.5, y: 1.5 }, { asset: "cube", x: 4.5, y: 3.5 },
              { asset: "computer", x: 1.5, y: 1.5 }] },   // esquina trasera (x−y=0), fuera de las columnas iso de xp/yp

  // ARCHIVO — 4×6 (callejón). Zócalo del CUBO (#2).
  "4,0": { name: "ARCHIVO", paletteIndex: 3, w: 4, h: 6,
    exits: { xm: "3,0" },
    objects: [{ asset: "cube", x: 1.5, y: 3.5 }],
    sockets: [{ x: 2.5, y: 2.5, id: "a4", filled: null }] },

  // POZO — 6×6 (callejón). Laberinto + un ORDENADOR recogible.
  "1,1": { name: "POZO", paletteIndex: 5, w: 6, h: 6,
    exits: { ym: "1,0" },
    objects: [{ asset: "cube", x: 1.5, y: 2.5 }, { asset: "cube", x: 3.5, y: 4.5, h: 2 },
              { asset: "computer", x: 4.5, y: 1.5 }] },   // sin puerta frontal aquí, solo evito el vano de ym (x∈{2,3})

  // ALTILLO — 6×4 (callejón arriba). Circuito PIRÁMIDE en plataforma → SALTO.
  "2,-1": { name: "ALTILLO", paletteIndex: 1, w: 6, h: 4,
    exits: { yp: "2,0", xm: "1,-1" },
    objects: [{ asset: "cube", x: 2.5, y: 1.5 }, { asset: "cube", x: 3.5, y: 1.5 },
              { x: 3.5, y: 1.5, z: 1, shape: "pyramid" }] },

  // DESVAN — 6×4 (callejón). Circuito PIRÁMIDE (#2) en plataforma → SALTO.
  "1,-1": { name: "DESVAN", paletteIndex: 4, w: 6, h: 4,
    exits: { xp: "2,-1" },
    objects: [{ asset: "cube", x: 1.5, y: 1.5 }, { asset: "cube", x: 2.5, y: 1.5 },
              { x: 2.5, y: 1.5, z: 1, shape: "pyramid" }] },

  // VERTEDERO — pasillo 8×6 (laberinto + pinchos deco + un ORDENADOR recogible).
  "3,1": { name: "VERTEDERO", paletteIndex: 5, w: 8, h: 6,
    exits: { ym: "3,0", xp: "4,1" },
    objects: [{ asset: "cube", x: 1.5, y: 2.5 }, { asset: "cube", x: 3.5, y: 4.5 }, { asset: "cube", x: 2.5, y: 1.5 },
              { asset: "computer", x: 6.5, y: 4.5 }],   // x−y=2, fuera de la columna iso de xp (banda [3,5]) y del vano de ym
    hazards: [{ x: 1.5, y: 3.5 }] },

  // REACTOR — 8×6 (callejón). Circuito DOMO en plataforma 2-alto → EMPUJA el bloque y SALTA.
  "4,1": { name: "REACTOR", paletteIndex: 3, w: 8, h: 6,
    exits: { xm: "3,1", yp: "4,2" },
    objects: [{ asset: "cube", x: 4.5, y: 1.5, h: 2 }, { asset: "cube", x: 5.5, y: 1.5, h: 2 },   // plataforma 2-alto
              { x: 4.5, y: 1.5, z: 2, shape: "dome" },                                            // circuito DOMO arriba
              { asset: "cube", x: 5.5, y: 3.5, traits: { movable: true, falls: true } }] },        // bloque EMPUJABLE (z=0 por defecto)

  // SILO — 6×6 (callejón). Zócalo de la PIRÁMIDE (#2).
  "4,2": { name: "SILO", paletteIndex: 0, w: 6, h: 6,
    exits: { ym: "4,1" },
    objects: [{ asset: "cube", x: 4.5, y: 3.5 }],
    sockets: [{ x: 1.5, y: 2.5, id: "d3", filled: null }] },

  // CONDUCTO — pasillo alto 4×8. Zócalo de la PIRÁMIDE.
  "0,1": { name: "CONDUCTO", paletteIndex: 1, w: 4, h: 8,
    exits: { ym: "0,0", yp: "0,2" },
    objects: [{ asset: "cube", x: 1.5, y: 2.5 },
              { asset: "cube", x: 3.5, y: 5.5 }],
    sockets: [{ x: 1.5, y: 4.5, id: "cond", filled: null }] },

  // CISTERNA — 8×6 (laberinto + pinchos deco + un ORDENADOR recogible).
  "0,2": { name: "CISTERNA", paletteIndex: 0, w: 8, h: 6,
    exits: { ym: "0,1", xp: "1,2" },
    objects: [{ asset: "cube", x: 2.5, y: 2.5 }, { asset: "cube", x: 4.5, y: 3.5, h: 2 }, { asset: "cube", x: 1.5, y: 3.5 },
              { asset: "computer", x: 6.5, y: 4.5 }],   // x−y=2, fuera de la columna iso de xp (banda [3,5]); ≠ hazard (5.5,4.5)
    hazards: [{ x: 5.5, y: 4.5 }] },

  // TUBO — 6×6 (laberinto).
  "1,2": { name: "TUBO", paletteIndex: 2, w: 6, h: 6,
    exits: { xm: "0,2", xp: "2,2" },
    objects: [{ asset: "cube", x: 1.5, y: 2.5 }, { asset: "cube", x: 2.5, y: 4.5, h: 2 }] },

  // BODEGA — 6×6. Circuito CILINDRO en plataforma 2-alto → SALTO DOBLE (peldaño fijo + plataforma).
  "2,2": { name: "BODEGA", paletteIndex: 5, w: 6, h: 6,
    exits: { xm: "1,2", xp: "3,2" },
    objects: [{ asset: "cube", x: 1.5, y: 1.5 },                                               // peldaño 1-alto
              { asset: "cube", x: 2.5, y: 1.5, h: 2 }, { asset: "cube", x: 3.5, y: 1.5, h: 2 },   // plataforma 2-alto
              { x: 3.5, y: 1.5, z: 2, shape: "cylinder" }] },                                  // circuito CILINDRO arriba

  // ESCLUSA — 6×6. Circuito CUBO (#2) en plataforma → SALTO.
  "3,2": { name: "ESCLUSA", paletteIndex: 2, w: 6, h: 6,
    exits: { xm: "2,2", yp: "3,3" },
    objects: [{ asset: "cube", x: 2.5, y: 1.5 }, { asset: "cube", x: 3.5, y: 1.5 },
              { x: 3.5, y: 1.5, z: 1, shape: "cube" }] },

  // FOSA — 6×6 (callejón final). Laberinto.
  "3,3": { name: "FOSA", paletteIndex: 5, w: 6, h: 6,
    exits: { ym: "3,2" },
    objects: [{ asset: "cube", x: 1.5, y: 2.5 }, { asset: "cube", x: 3.5, y: 3.5, h: 2 }] },
};
