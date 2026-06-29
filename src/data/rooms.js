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
  // Muebles grandes ARRIMADOS a la pared de fondo y=0, lado LARGO contra la pared, mirando dentro (dir 0 = orientación por defecto).
  "0,0": { name: "ESCLUSA", paletteIndex: 0, w: 8, h: 8,
    exits: { xp: "1,0" },
    objects: [{ asset: "locker", x: 1.5, y: 0.42, dir: 0 }, { asset: "locker", x: 3.5, y: 0.42, dir: 0 },
              { asset: "crate", x: 1.5, y: 6.5 }, { asset: "canister", x: 6.5, y: 6.5 },
              { x: 2.5, y: 5.5, shape: "cube" }],                      // circuito CUBO #1
    sockets: [{ x: 5.5, y: 5.5, id: "esc", filled: null }] },         // pide CUBO

  // ===== CRUCE (hub) 6×6 — mesa con el lado LARGO contra la pared de fondo (y=0), mirando dentro =====
  "1,0": { name: "CRUCE", paletteIndex: 2, w: 6, h: 6,
    exits: { xm: "0,0", xp: "2,0", yp: "1,1" },
    objects: [{ asset: "desk", x: 1.5, y: 0.6, dir: 0 }, { asset: "desk_lamp", x: 1.5, y: 0.4, z: 1 },  // mesa a lo largo de y=0; lámpara ENCIMA
              { asset: "chair", x: 1.5, y: 2.0, dir: 3 },   // delante de la mesa, MIRÁNDOLA (−y)
              { asset: "plant", x: 2.5, y: 3.5 }, { asset: "bin", x: 4.5, y: 4.5 }] },

  // ===== PUENTE (control) 8×6 — consolas y mesa con el lado LARGO contra la pared de fondo (y=0). Circuito DOMO; zócalo CILINDRO =====
  "2,0": { name: "PUENTE", paletteIndex: 4, w: 8, h: 6,
    exits: { xm: "1,0", yp: "2,1" },
    objects: [{ asset: "console", x: 1.5, y: 0.44, dir: 0 }, { asset: "console", x: 3.0, y: 0.44, dir: 0 },
              { asset: "desk", x: 5.5, y: 0.6, dir: 0 }, { asset: "monitor", x: 5.5, y: 0.4, z: 1 },  // monitor ENCIMA de la mesa
              { asset: "chair", x: 5.5, y: 2.0, dir: 3 },   // delante de la mesa, MIRÁNDOLA (−y)
              { x: 6.5, y: 2.5, shape: "dome" }],                     // circuito DOMO
    sockets: [{ x: 6.5, y: 4.5, id: "pue", filled: null }] },         // pide CILINDRO

  // ===== CAMAROTES (dormitorio) 8×6 — 4 puertas: cama y taquilla contra y=0 (zonas libres de su vano) =====
  "1,1": { name: "CAMAROTES", paletteIndex: 1, w: 8, h: 6,
    exits: { ym: "1,0", xm: "0,1", xp: "2,1", yp: "1,2" },
    objects: [{ asset: "bed", x: 0.5, y: 1.0, dir: 1 }, { asset: "locker", x: 0.42, y: 5.5, dir: 1 },   // lado LARGO contra x=0 (arriba/abajo), mirando +x; libres del vano xm y de la oclusión frontal
              { x: 5.5, y: 4.5, shape: "pyramid" }] },                // circuito PIRÁMIDE #1

  // ===== COCINA (comedor) 8×6 — cocinas a lo largo de y=0 (izq; la dcha la ocluye xp); mesa con el lado LARGO contra x=0. Zócalo PIRÁMIDE =====
  "0,1": { name: "COCINA", paletteIndex: 5, w: 8, h: 6,
    exits: { xp: "1,1", yp: "0,2" },
    objects: [{ asset: "kitchen", x: 1.5, y: 0.56, dir: 0 }, { asset: "kitchen", x: 3.3, y: 0.56, dir: 0 },
              { asset: "desk", x: 0.6, y: 4.0, dir: 1 }, { asset: "papers", x: 0.55, y: 4.0, z: 1 },  // mesa a lo largo de x=0; papeles ENCIMA
              { asset: "chair", x: 0.6, y: 5.5, dir: 1 }],   // al extremo de la mesa, MIRÁNDOLA (−y); su frente +x lo ocluye la puerta yp
    sockets: [{ x: 3.5, y: 3.5, id: "coc", filled: null }] },         // pide PIRÁMIDE

  // ===== LABORATORIO 8×6 — 2 puertas de fondo: mesa+consola contra y=0 (zonas libres), ordenador contra x=0. Circuito CILINDRO; zócalo CUBO =====
  "2,1": { name: "LABORATORIO", paletteIndex: 3, w: 8, h: 6,
    exits: { xm: "1,1", ym: "2,0", yp: "2,2" },
    objects: [{ asset: "desk", x: 1.5, y: 0.6, dir: 0 }, { asset: "monitor", x: 1.5, y: 0.4, z: 1 },  // mesa a lo largo de y=0 (x∈[0,3] libre); monitor ENCIMA
              { asset: "console", x: 6.5, y: 0.44, dir: 0 },   // a lo largo de y=0 (x∈[5,8] libre)
              { asset: "computer", x: 0.45, y: 4.5, dir: 1 },   // contra x=0 (y∈[4,6] libre del vano xm), mirando +x
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

  // ===== ALMACÉN 6×6 — estantería contra la pared de fondo x=0 (libre; ym tiene su vano). Circuito CUBO #2; zócalo DOMO =====
  "0,2": { name: "ALMACEN", paletteIndex: 0, w: 6, h: 6,
    exits: { ym: "0,1", xp: "1,2" },
    objects: [{ asset: "shelf", x: 0.36, y: 1.5, dir: 1 }, { asset: "canister", x: 4.5, y: 4.5 },   // estantería con el lado LARGO contra x=0, mirando +x
              { asset: "crate", x: 4.5, y: 5.5 },
              { x: 3.5, y: 4.5, shape: "cube" }],                     // circuito CUBO #2
    sockets: [{ x: 2.5, y: 2.5, id: "alm", filled: null }] },         // pide DOMO

  // ===== TALLER 6×6 — 2 puertas de fondo: mesa y estantería contra y=0 (zonas libres del vano ym). Circuito PIRÁMIDE #2 =====
  "2,2": { name: "TALLER", paletteIndex: 4, w: 6, h: 6,
    exits: { ym: "2,1", xm: "1,2" },
    objects: [{ asset: "desk", x: 1.0, y: 0.6, dir: 0 }, { asset: "shelf", x: 5.0, y: 0.36, dir: 0 },   // lado LARGO contra y=0 (x<2 y x>4 libres del vano ym)
              { asset: "toolbox", x: 4.5, y: 4.5 }, { asset: "crate", x: 1.5, y: 4.5 },
              { x: 2.5, y: 4.5, shape: "pyramid" }] },                // circuito PIRÁMIDE #2
};
