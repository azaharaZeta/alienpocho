/* =============================================================================
   ALIEN POCHO — DATOS DEL MAPA (data/rooms.js)
   -----------------------------------------------------------------------------
   EL MAPA como DATOS PUROS, separados del motor que los interpreta (world.js).
   Editar/añadir salas o reubicar objetos se hace AQUÍ, sin tocar lógica.

   ESTACIÓN ESPACIAL por ZONAS (3×3 de salas): ESCLUSA (inicio) → CRUCE (hub) → PUENTE;
   CAMAROTES, COCINA, LABORATORIO; INVERNADERO, ALMACÉN, TALLER. Cada zona amueblada con
   su mobiliario (mesas, sillas, camas, cocinas, taquillas, estanterías, consolas, lámparas)
   y objetos (papeleras, papeles, bidones, cajas, contenedores) + plantas/flores. El PUZZLE
   (6 circuitos → 6 zócalos) está tejido por las zonas; todo es accesible A PIE (resoluble
   sin saltos): coge un circuito, llévalo a su zócalo.

   Cada sala:
     name         nombre mostrado en el HUD.
     paletteIndex índice en INKS/INK2 (palette.js) → color primario/secundario (diferencia zonas).
     w, h         tamaño de la rejilla: SOLO {4, 6, 8} (makeRoom acota a [4,8] y fuerza par, redondeo ↑).
     exits        { xm, xp, ym, yp } → clave de la sala vecina al cruzar ese borde. Cada salida debe
                  tener su RECÍPROCA en la sala destino.
     objects      CUBETA ÚNICA de lo colocable: mobiliario + objetos + circuitos. { asset | shape, x, y,
                  z?, h?, traits? }. El COMPORTAMIENTO lo deciden los TRAITS del asset (mobiliario/objetos
                  son solid+movable+carriable+falls; circuitos = prop_<shape>).
     sockets      zócalos-destino { x, y, z?, id, filled }. Qué circuito PIDE lo decide la MISIÓN
                  (data/mission.js → MISSION.requires[id]); `filled` = circuito puesto (estado de partida).
     hazards      pinchos { x, y } (decorativos; cubeta propia).

   COORDENADAS — UNA sola convención para TODOS los assets (objects, sockets, hazards):
     Posición CONTINUA `x, y` = ancla en el mundo (centro para los assets `center`, que son todos los
     `object`). Centrar en la celda (n,m) = `x: n+0.5, y: m+0.5`. NO existen `cx,cy`.
     `z` opcional → ausente = suelo (z=0; lo normaliza makeRoom). `h` = nº de copias apiladas.

   ⚠️ NO poner objetos en el VANO de una puerta (2 celdas centradas en el borde): las FRONTALES (xp/yp)
   tapan lo de detrás en su columna iso, y el robot reaparece en el centro del borde. Dejar libres los
   carriles centrales y las esquinas-puerta. El mobiliario va por bordes/esquinas.
   ============================================================================= */
"use strict";

export const ROOMS = {
  // ===== ESCLUSA (inicio) 8×8 — tutorial: coge el CUBO y ponlo en su zócalo (aquí mismo) =====
  "0,0": { name: "ESCLUSA", paletteIndex: 0, w: 8, h: 8,
    exits: { xp: "1,0" },
    objects: [{ asset: "locker", x: 1.5, y: 1.5 }, { asset: "locker", x: 3.5, y: 1.5 },
              { asset: "crate", x: 1.5, y: 6.5 }, { asset: "canister", x: 6.5, y: 6.5 },
              { x: 2.5, y: 5.5, shape: "cube" }],                      // circuito CUBO #1
    sockets: [{ x: 5.5, y: 5.5, id: "esc", filled: null }] },         // pide CUBO

  // ===== CRUCE (hub) 6×6 — repartidor entre zonas. Mesa+silla+planta (muebles grandes en esquinas) =====
  "1,0": { name: "CRUCE", paletteIndex: 2, w: 6, h: 6,
    exits: { xm: "0,0", xp: "2,0", yp: "1,1" },
    objects: [{ asset: "desk", x: 1.5, y: 1.5 }, { asset: "chair", x: 2.5, y: 2.5 },
              { asset: "plant", x: 2.5, y: 3.5 }, { asset: "bin", x: 4.5, y: 4.5 }] },

  // ===== PUENTE (control) 8×6 — consolas/monitores. Circuito DOMO; zócalo del CILINDRO =====
  "2,0": { name: "PUENTE", paletteIndex: 4, w: 8, h: 6,
    exits: { xm: "1,0", yp: "2,1" },
    objects: [{ asset: "console", x: 1.5, y: 1.5 }, { asset: "console", x: 3.5, y: 1.5 },
              { asset: "monitor", x: 6.5, y: 3.5 }, { asset: "chair", x: 5.5, y: 4.5 },
              { x: 6.5, y: 1.5, shape: "dome" }],                     // circuito DOMO
    sockets: [{ x: 6.5, y: 4.5, id: "pue", filled: null }] },         // pide CILINDRO

  // ===== CAMAROTES (dormitorio) 8×6 — camas/taquilla/lámpara. Circuito PIRÁMIDE #1 =====
  "1,1": { name: "CAMAROTES", paletteIndex: 1, w: 8, h: 6,
    exits: { ym: "1,0", xm: "0,1", xp: "2,1", yp: "1,2" },
    objects: [{ asset: "bed", x: 1.5, y: 1.5 }, { asset: "locker", x: 4.5, y: 2.5 },
              { asset: "desk_lamp", x: 0.5, y: 4.5 },
              { x: 5.5, y: 4.5, shape: "pyramid" }] },                // circuito PIRÁMIDE #1

  // ===== COCINA (comedor) 8×6 — cocinas/mesa/silla/papeles. Zócalo de la PIRÁMIDE =====
  "0,1": { name: "COCINA", paletteIndex: 5, w: 8, h: 6,
    exits: { xp: "1,1", yp: "0,2" },
    objects: [{ asset: "kitchen", x: 1.5, y: 1.5 }, { asset: "kitchen", x: 3.5, y: 1.5 },
              { asset: "desk", x: 5.5, y: 3.5 }, { asset: "chair", x: 5.5, y: 5.5 },
              { asset: "papers", x: 6.5, y: 4.5 }],
    sockets: [{ x: 3.5, y: 3.5, id: "coc", filled: null }] },         // pide PIRÁMIDE

  // ===== LABORATORIO 8×6 — mesa/ordenador/monitor/consola/contenedor. Circuito CILINDRO; zócalo del CUBO =====
  "2,1": { name: "LABORATORIO", paletteIndex: 3, w: 8, h: 6,
    exits: { xm: "1,1", ym: "2,0", yp: "2,2" },
    objects: [{ asset: "desk", x: 1.5, y: 1.5 }, { asset: "console", x: 6.5, y: 1.5 },
              { asset: "monitor", x: 6.5, y: 3.5 }, { asset: "computer", x: 0.5, y: 4.5 },
              { asset: "crate", x: 1.5, y: 5.5 },
              { x: 6.5, y: 2.5, shape: "cylinder" }],                 // circuito CILINDRO
    sockets: [{ x: 5.5, y: 5.5, id: "lab", filled: null }] },         // pide CUBO

  // ===== INVERNADERO 8×8 — plantas y flores. Zócalo de la PIRÁMIDE (#2) =====
  "1,2": { name: "INVERNADERO", paletteIndex: 2, w: 8, h: 8,
    exits: { ym: "1,1", xm: "0,2", xp: "2,2" },
    objects: [{ asset: "flower", x: 1.5, y: 1.5 }, { asset: "flower", x: 4.5, y: 1.5 },
              { asset: "plant", x: 1.5, y: 6.5 }, { asset: "plant", x: 6.5, y: 6.5 },
              { asset: "flower", x: 4.5, y: 6.5 }],
    sockets: [{ x: 4.5, y: 4.5, id: "inv", filled: null }] },         // pide PIRÁMIDE

  // ===== ALMACÉN 6×6 — estanterías/cajas/contenedores. Circuito CUBO #2; zócalo del DOMO =====
  "0,2": { name: "ALMACEN", paletteIndex: 0, w: 6, h: 6,
    exits: { ym: "0,1", xp: "1,2" },
    objects: [{ asset: "shelf", x: 1.5, y: 1.5 }, { asset: "shelf", x: 1.5, y: 3.5 },
              { asset: "crate", x: 1.5, y: 5.5 }, { asset: "canister", x: 4.5, y: 4.5 },
              { x: 3.5, y: 2.5, shape: "cube" }],                     // circuito CUBO #2
    sockets: [{ x: 2.5, y: 2.5, id: "alm", filled: null }] },         // pide DOMO

  // ===== TALLER 6×6 — estantería/mesa/herramientas/contenedor. Circuito PIRÁMIDE #2 =====
  "2,2": { name: "TALLER", paletteIndex: 4, w: 6, h: 6,
    exits: { ym: "2,1", xm: "1,2" },
    objects: [{ asset: "desk", x: 1.5, y: 1.5 }, { asset: "shelf", x: 4.5, y: 1.5 },
              { asset: "toolbox", x: 4.5, y: 4.5 }, { asset: "crate", x: 1.5, y: 4.5 },
              { x: 2.5, y: 4.5, shape: "pyramid" }] },                // circuito PIRÁMIDE #2
};
