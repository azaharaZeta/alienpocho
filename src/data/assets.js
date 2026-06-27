/* =============================================================================
   ALIEN POCHO — REGISTRO DE ASSETS (data/assets.js)  ·  FUENTE ÚNICA
   -----------------------------------------------------------------------------
   El "carné de identidad" de cada asset, en un solo sitio. Módulo HOJA y PURO: sin
   DOM, sin canvas, sin imports; corre en Node/tests y lo importan todos (config,
   motor, física y la tool).

   Regla: ningún número de tamaño/posición/anclaje de un asset vive fuera de aquí; quien
   lo necesite, lo importa. Ver docs/ARQUITECTURA.md.

   --- Esquema de un asset en ASSETS ---
     draw    : clave de la función de dibujo procedural (AP.*), o "fn:variante".
     files   : { svg, png }  ficheros (silueta neutra); null = no migrado.
     sprite  : { w, h, minX, minY }  encuadre del raster en px de juego, o null.
               El píxel-ancla del PNG/SVG es derivado = (−minX, −minY); no se almacena.
     offset  : { x, y, z? }  desplazamiento del ANCLA respecto a la esquina (0,0,0) de la celda (en celdas).
     footMode: "center" (huella centrada en el ancla) | "corner" (huella desde el ancla).
     foot    : { w, l, h, z? }  huella en celdas (ancho×largo×alto) + z base (def. 0).
               AABB y ancla se derivan de foot+offset+footMode (assetBox / assetRef).
     variants: huella/posición según la ORIENTACIÓN. Cada variante trae { foot } (override)
               o { box, offset } explícitos (puerta).
   ============================================================================= */
"use strict";

/* ---------- Geometría primitiva compartida (hogar canónico) ---------- */
// Circuito transportable: semilado en planta y alto. Cubo de bounding box 0.66³.
export const PROP = { HALF: 0.33, H: 0.66 };
// Robot Pocho: semianchos del cuerpo (ancho/profundidad) y alto total.
export const ROBOT = { WID: 0.50, DEP: 0.33, H: 1.50 };
// Puerta: grosor del marco (T), ancho de poste (POST_W), alto del dintel (LINTEL_H) y
// semiancho del vano visual (SPAN_HALF). El hueco físico se deriva: SPAN_HALF − POST_W.
// SPAN_HALF = 1 → la puerta ocupa EXACTAMENTE 2 celdas: la pared se dibuja como módulos SVG
// (pared·pared·PUERTA·pared·pared) sin recortes. Requiere salas de dimensión PAR (ver makeRoom).
export const DOOR = { T: 0.34, POST_W: 0.40, LINTEL_H: 0.46, SPAN_HALF: 1.0 };
// Zócalo (receptáculo): peana de 0.90×0.90 en planta (HALF) con una INDENTACIÓN cuadrada
// (RECESS_HALF, hundida RECESS_DEPTH) que aloja el circuito. La peana es mayor que el circuito
// (PROP.HALF) → queda un reborde alrededor. BASE_H = alto de la peana; se mantiene ≤ CFG.STEP
// para que el robot se suba andando a la peana vacía y pueda colocar el circuito (lo fija smoke.mjs).
export const SOCKET = { BASE_H: 0.24, HALF: 0.45, RECESS_HALF: 0.35, RECESS_DEPTH: 0.14 };
// Altura (en celdas) de las paredes de todas las salas.
export const WALL_H = 3;

/* ---------- Atajos locales (para construir ASSETS) ---------- */
const P2 = PROP.HALF * 2, R = ROBOT, D = DOOR, SH2 = SOCKET.HALF * 2;

/* Orden en que la tool muestra los grupos (los assets se agrupan por su campo `group`). */
export const GROUP_ORDER = [
  "Estructura", "Bloques", "Transportables", "Receptáculos", "Peligros", "Decoración", "Personajes",
];

/* ===================== EL REGISTRO =====================
   Cada asset se describe a sí mismo por completo:
     kind   : qué es (cerrado):
              "structure"  (cáscara de sala: suelo/pared/puerta · capa aparte en render)
              "individual" (personaje: robot, enemigos · entidad, no `things`)
              "object"     (todo lo colocable: bloques, circuitos, zócalos, peligros, decoración).
     traits : propiedades componibles (ausente = false); cada subsistema lee la suya:
              solid      ocupa espacio físico                            → física (colisión/apoyo)
              movable    empujable por el robot                          → empuje (player/physics)
              carriable  recogible (item en la mano)                     → game.interact
              falls      cae con gravedad si no tiene apoyo              → physics.updateObjects
              hazard     hace daño al tocarlo                            → combate (futuro)
              receptacle destino que se activa al recibir item compatible → game.interact
              stateful   estado on/off que cambia forma/altura           → render/física
              controlled (individual) lo lleva el jugador.
     group  : grupo de catálogo (la tool agrupa por esto, orden en GROUP_ORDER).
   (draw/files/sprite/anchor/foot/variants: ver cabecera.) */
export const ASSETS = {
  // --- Estructura (cáscara paramétrica de sala) ---
  floor:  { label: "Suelo", kind: "structure", group: "Estructura", traits: {},
            draw: "floor", offset: { x: 0, y: 0 }, footMode: "corner", foot: { w: 1, l: 1, h: 0 },
            files: { svg: "example.svg", png: null } },
  // Paredes: se dibujan por TILE (no por drawSprite), por eso no llevan `sprite`.
  // tile = tamaño del .svg del tile.
  wall1:  { label: "Pared (wall1)", kind: "structure", group: "Estructura", traits: { solid: true },
            draw: "flatWall", offset: { x: 0, y: 0 }, footMode: "corner", foot: { w: 1, l: 0, h: WALL_H },
            files: { svg: "wall1.svg", png: null }, tile: { N: 1, w: 17, h: 60, minX: 0, minY: -51 } },
  wall2:  { label: "Pared (wall2)", kind: "structure", group: "Estructura", traits: { solid: true },
            draw: "flatWall", offset: { x: 0, y: 0 }, footMode: "corner", foot: { w: 2, l: 0, h: WALL_H },
            files: { svg: "wall2.svg", png: null }, tile: { N: 2, w: 34, h: 68, minX: 0, minY: -51 } },
  // Puerta (arco): cáscara con hueco de paso. Huella por EJE (x / y), no centro/esquina.
  door: { label: "Puerta (arco)", kind: "structure", group: "Estructura", traits: {},
          draw: "door", files: { svg: "door.svg", png: null },
          // UN solo sprite (door): front y back son el MISMO dibujo; solo cambia el ANCLA (front protruye +y del
          // plano, back retrocede −y) → offset desplazado por la proyección del grosor T. Por eso 2 offsets, 1 imagen.
          tiles: { front: { w: 40, h: 71, minX: -6, minY: -51 }, back: { w: 40, h: 71, minX: 0, minY: -54 } },
          variants: {
            axisX: { label: "eje x", state: { axis: "x" },
                     box: { x: 1.5 - D.SPAN_HALF, y: -D.T, z: 0, w: 2 * D.SPAN_HALF, l: D.T, h: WALL_H },
                     offset: { x: 1.5 - D.SPAN_HALF, y: 0, z: 0 } },
            axisY: { label: "eje y", state: { axis: "y" },
                     box: { x: -D.T, y: 1.5 - D.SPAN_HALF, z: 0, w: D.T, l: 2 * D.SPAN_HALF, h: WALL_H },
                     offset: { x: 0, y: 1.5 - D.SPAN_HALF, z: 0 } },
          } },

  // --- Bloques (piezas sólidas fijas con las que se "construye") ---
  cube:   { label: "Bloque", kind: "object", group: "Bloques", traits: { solid: true },
            draw: "cube", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: 1, l: 1, h: 1 },
            files: { svg: "cube.svg", png: "cube.png" }, sprite: { w: 34, h: 34, minX: -17, minY: -25.5 } },

  // --- Transportables (circuitos): sólidos, empujables, recogibles y caen ---
  prop_cube:     { label: "Cubo", kind: "object", group: "Transportables", traits: { solid: true, movable: true, carriable: true, falls: true },
                   draw: "sprite", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: P2, l: P2, h: PROP.H },
                   files: { svg: "prop_cube.svg", png: null }, sprite: { w: 22, h: 22, minX: -11, minY: -16 } },
  prop_pyramid:  { label: "Pirámide", kind: "object", group: "Transportables", traits: { solid: true, movable: true, carriable: true, falls: true },
                   draw: "sprite", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: P2, l: P2, h: PROP.H },
                   files: { svg: "prop_pyramid.svg", png: null }, sprite: { w: 22, h: 17, minX: -11, minY: -11 } },
  prop_dome:     { label: "Domo", kind: "object", group: "Transportables", traits: { solid: true, movable: true, carriable: true, falls: true },
                   draw: "sprite", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: P2, l: P2, h: PROP.H },
                   files: { svg: "prop_dome.svg", png: null }, sprite: { w: 17, h: 13, minX: -9, minY: -9 } },
  prop_cylinder: { label: "Cilindro", kind: "object", group: "Transportables", traits: { solid: true, movable: true, carriable: true, falls: true },
                   draw: "sprite", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: P2, l: P2, h: PROP.H },
                   files: { svg: "prop_cylinder.svg", png: null }, sprite: { w: 15, h: 18, minX: -8, minY: -15 } },

  // --- Receptáculo (zócalo): UN asset genérico, sólido, que recibe un circuito compatible y se
  //     ilumina. Qué circuito PIDE (requires) y cuál tiene PUESTO (filled) son datos de INSTANCIA
  //     (data/rooms.js + estado de partida), no del asset → acepta circuitos nuevos sin tocarlo. ---
  socket: { label: "Zócalo", kind: "object", group: "Receptáculos", traits: { solid: true, receptacle: true, stateful: true },
            draw: "socket", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: SH2, l: SH2, h: SOCKET.BASE_H },
            files: { svg: "socket.svg", png: null }, sprite: { w: 32, h: 20, minX: -16, minY: -12 } },

  // --- Peligros ---
  spikes: { label: "Pinchos", kind: "object", group: "Peligros", traits: { hazard: true },
            draw: "sprite", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: 0.54, l: 0.54, h: 0.5 },
            files: { svg: "spikes.svg", png: null }, sprite: { w: 14, h: 11, minX: -7, minY: -10 } },

  // --- Decoración (objetos sin más rol; la "decoración" es un object SIN traits especiales) ---
  plant:  { label: "Planta", kind: "object", group: "Decoración", traits: {},
            draw: "sprite", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: 0.32, l: 0.32, h: 0.5 },
            files: { svg: "plant.svg", png: null }, sprite: { w: 8, h: 13, minX: -4, minY: -11 } },
  drone:  { label: "Dron", kind: "object", group: "Decoración", traits: {},
            // huella ELEVADA que ENVUELVE el sprite flotante: el painter ordena por esta caja, así que debe
            // acotar los píxeles dibujados (lo fija el guardarraíl anti-#2 de test/assets.mjs). No es sólido.
            draw: "sprite", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: 0.4, l: 0.4, h: 0.7, z: 0.45 },
            files: { svg: "drone.svg", png: null }, sprite: { w: 12, h: 16, minX: -6, minY: -22 } },
  // Ordenador: sólido + empujable + cae.
  computer: { label: "Ordenador", kind: "object", group: "Decoración", traits: { solid: true, movable: true, falls: true },
            draw: "sprite", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: 0.5, l: 0.5, h: 0.7 },
            files: { svg: "computer.svg", png: null }, sprite: { w: 18, h: 22, minX: -9, minY: -17 } },

  // --- Personajes (individuos): huella VISUAL que rota con la orientación (eje x ↔ eje y). ---
  // (La colisión del robot es otra cosa: cuadrado simétrico CFG.PRAD; no se modela aquí.)
  robot: { label: "Robot Pocho", kind: "individual", group: "Personajes", traits: { controlled: true },
           draw: "robot", offset: { x: 0.5, y: 0.5 }, footMode: "center", foot: { w: 2 * R.WID, l: 2 * R.DEP, h: R.H },
           variants: {
             axisX: { label: "+x", state: { facing: 0 }, foot: { w: 2 * R.DEP, l: 2 * R.WID, h: R.H } },
             axisY: { label: "+y", state: { facing: 1 }, foot: { w: 2 * R.WID, l: 2 * R.DEP, h: R.H } },
           } },
};

/* ===================== HELPERS PUROS (derivan AABB / anclaje de foot+anchor) =====================
   Nadie construye una caja de asset a mano: se pide aquí. */

// Variante a usar: la pedida, o la primera si se pide sin variante y el asset no tiene
// foot/box base (p. ej. la puerta, definida solo por ejes).
function pickVariant(a, variant) {
  if (variant && a.variants && a.variants[variant]) return a.variants[variant];
  if (!a.foot && a.variants) return a.variants[Object.keys(a.variants)[0]];
  return null;
}

// Huella efectiva (aplicando variante de orientación si la hay). Si la variante define
// caja explícita (puerta) y no foot, se deriva de la caja.
export function assetFoot(id, variant) {
  const a = ASSETS[id]; if (!a) return null;
  const v = pickVariant(a, variant);
  if (v && v.foot) return v.foot;
  if (v && v.box) return { w: v.box.w, l: v.box.l, h: v.box.h };
  return a.foot || null;
}

// AABB de mundo {x,y,z,w,l,h} en celdas. Derivada de foot + offset/footMode (o box explícita de la variante).
export function assetBox(id, variant) {
  const a = ASSETS[id]; if (!a) return null;
  const v = pickVariant(a, variant);
  if (v && v.box) return { ...v.box };                      // puerta: caja explícita por eje
  const f = (v && v.foot) || a.foot; if (!f) return null;
  const z = f.z || 0, o = a.offset || { x: 0, y: 0 };       // ancla = esquina (0,0) + offset
  if (a.footMode === "center") return { x: o.x - f.w / 2, y: o.y - f.l / 2, z, w: f.w, l: f.l, h: f.h };
  return { x: o.x, y: o.y, z, w: f.w, l: f.l, h: f.h };      // "corner": huella desde el ancla
}

// Punto de ANCLA iso {x,y,z} = esquina (0,0,0) de la celda + offset. Donde el juego ancla el sprite.
export function assetRef(id, variant) {
  const a = ASSETS[id]; if (!a) return null;
  const v = pickVariant(a, variant);
  if (v && v.offset) return { x: v.offset.x, y: v.offset.y, z: v.offset.z || 0 };   // puerta: offset explícito por eje
  const o = a.offset || { x: 0, y: 0 };
  return { x: o.x, y: o.y, z: o.z || 0 };
}

// Región contenedora alineada a celdas: ceil de cada dimensión (mín. 1).
export function assetRegion(id, variant) {
  const b = assetBox(id, variant); if (!b) return null;
  const x0 = Math.floor(b.x), x1 = Math.max(x0 + 1, Math.ceil(b.x + b.w));
  const y0 = Math.floor(b.y), y1 = Math.max(y0 + 1, Math.ceil(b.y + b.l));
  const z0 = Math.floor(b.z), z1 = Math.max(z0 + 1, Math.ceil(b.z + b.h));
  return { x: x0, y: y0, z: z0, w: x1 - x0, l: y1 - y0, h: z1 - z0 };
}

// Cima sólida de un zócalo según su estado: la peana (BASE_H) y, si tiene circuito puesto
// (filled), el circuito hundido en la indentación (sube PROP.H − RECESS_DEPTH sobre la peana).
// Fuente única (física, render y armado de things).
export function socketTop(s) {
  const base = (s.z || 0) + SOCKET.BASE_H;
  return s.filled ? base - SOCKET.RECESS_DEPTH + PROP.H : base;
}

// --- Acceso a clase y propiedades ---
export function assetKind(id) { const a = ASSETS[id]; return a ? a.kind : null; }
export function assetTraits(id) { const a = ASSETS[id]; return (a && a.traits) || {}; }
export function assetHas(id, trait) { return !!assetTraits(id)[trait]; }

// Tinte de dibujo: "secondary" para transportables/receptáculos, "primary" el resto. El
// asset puede forzarlo con `tint`. Render/tool eligen room.ink (primario) o room.ink2.
export function assetTint(id) {
  const a = ASSETS[id]; if (!a) return "primary";
  if (a.tint) return a.tint;
  return (assetHas(id, "carriable") || assetHas(id, "receptacle")) ? "secondary" : "primary";
}

// Nombre mostrable del asset (cae al id si no declara label).
export function assetLabel(id) { const a = ASSETS[id]; return (a && a.label) || id; }

// Asset id del transportable de una forma ("cube" → "prop_cube"). Mapeo ÚNICO forma→asset que
// comparten: objeto de sala (world.objAsset), cima de zócalo activo, objeto en brazos e icono del HUD.
export function propAsset(shape) { return "prop_" + shape; }

// Vistas de preview: una por variante de orientación (puerta/robot) o una sola. Cada
// vista { key (variante|null), label, state }; state se vuelca en el placement del drawer.
export function assetViews(id) {
  const a = ASSETS[id]; if (!a) return [];
  if (a.variants) return Object.entries(a.variants).map(([key, v]) => ({ key, label: v.label || key, state: v.state || {} }));
  return [{ key: null, label: a.label || id, state: {} }];
}

// Catálogo agrupado por `group` (orden de GROUP_ORDER; grupos desconocidos al final).
export function assetsByGroup() {
  const buckets = new Map(GROUP_ORDER.map(g => [g, []]));
  for (const [id, a] of Object.entries(ASSETS)) {
    const g = a.group || "Otros";
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g).push(id);
  }
  return [...buckets].filter(([, ids]) => ids.length).map(([title, ids]) => ({ title, ids }));
}
