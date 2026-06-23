/* =============================================================================
   ALIEN POCHO — REGISTRO DE ASSETS (data/assets.js)  ·  FUENTE ÚNICA
   -----------------------------------------------------------------------------
   El "carné de identidad" de CADA asset, en UN solo sitio (igual que data/rooms.js
   es el único hogar del mapa). Módulo HOJA y PURO: sin DOM, sin canvas, sin imports
   → corre en Node/tests y lo importan todos (config, motor, física y la tool).

   ⛔ REGLA: ningún número de tamaño / posición / anclaje de un asset puede vivir
   fuera de aquí. Si otro fichero necesita una medida, la IMPORTA; no la re-deriva.
   (Ver docs/AUDITORIA-ASSETS.md.)

   --- Geometría primitiva (la comparten dibujo y física; antes en config.js) ---
   Se definen aquí y config.js las RE-EXPORTA para no romper a sus consumidores.

   --- Esquema de un asset en ASSETS ---
     draw    : clave de la función de dibujo procedural (AP.*), o "fn:variante".
     files   : { svg, png }  ficheros (silueta neutra); null = no migrado.
     sprite  : { w, h, minX, minY }  encuadre del raster en px de juego, o null.
               · El PÍXEL-ANCLA del PNG/SVG (dónde cae el punto de mundo) es DERIVADO
                 = (−minX, −minY); NO se almacena (sería un dato redundante).
     anchor  : "corner" (punto 0 en la esquina (0,0,0)) | "center" (centro-base (0.5,0.5,0)).
     foot    : { w, l, h, z? }  HUELLA en celdas (ancho×largo×alto) + z base (def. 0).
               · La AABB de mundo y el punto de anclaje se DERIVAN de foot+anchor
                 (assetBox / assetRef). Nada de cajas escritas a mano.
     variants: huella/posición que cambia con la ORIENTACIÓN (robot: ejes; puerta: ejes).
               Cada variante puede traer { foot } (override) o { box, ref } explícitos.
   ============================================================================= */
"use strict";

/* ---------- Geometría primitiva compartida (hogar canónico) ---------- */
// Objeto físico transportable (circuito): semilado en planta y alto (medio bloque).
export const PROP = { HALF: 0.28, H: 0.5 };
// Robot Pocho: semianchos del cuerpo (ancho/profundidad) y alto total.
export const ROBOT = { WID: 0.50, DEP: 0.33, H: 1.50 };
// Puerta: grosor del marco (T), ancho de poste (POST_W), alto del dintel (LINTEL_H)
// y semiancho del VANO visual (SPAN_HALF). El hueco físico se deriva: SPAN_HALF − POST_W.
export const DOOR = { T: 0.34, POST_W: 0.40, LINTEL_H: 0.46, SPAN_HALF: 1.12 };
// Zócalo: alto de la peana + semilado de la huella (la peana ocupa 0.68×0.68 en planta).
export const SOCKET = { BASE_H: 0.2, HALF: 0.34 };
// Altura (en celdas) de las paredes de TODAS las salas (global y fija).
export const WALL_H = 3;

/* ---------- Atajos locales (solo para construir ASSETS legible) ---------- */
const P2 = PROP.HALF * 2, R = ROBOT, D = DOOR, SH2 = SOCKET.HALF * 2;

/* Orden en que la tool MUESTRA los grupos (los assets se agrupan por su campo `group`). */
export const GROUP_ORDER = [
  "Terreno y estructura", "Circuitos (transportables)", "Zócalos (destino, por forma)",
  "Peligros y decoración", "Personaje",
];

/* ===================== EL REGISTRO =====================
   Cada asset se describe A SÍ MISMO por completo (ver docs/AUDITORIA-MODULARIDAD.md):
     group     : grupo de catálogo (la tool agrupa por esto; orden en GROUP_ORDER).
     behavior  : comportamiento/tipo por defecto que consume el juego —
                 "structure" (cáscara de sala: suelo/pared/puerta · capa aparte en render)
                 "block"     (obstáculo sólido estático)
                 "carriable" (circuito: se empuja / se coge / cae / encaja)
                 "target"    (zócalo: casilla-destino de un carriable, con estado activo)
                 "hazard"    (peligro pisable)  ·  "decor" (decorativo no sólido)
                 "player"    (el robot; su colisión es CFG.PRAD, no su huella visual).
     physics   : { solid } — lo lee la física genérica (roomSolids). La huella es `foot`.
   (draw/files/sprite/anchor/foot/variants: ver cabecera.) */
export const ASSETS = {
  // --- Terreno y estructura ---
  floor:  { label: "Suelo", group: "Terreno y estructura", behavior: "structure", physics: { solid: false },
            draw: "floor", anchor: "corner", foot: { w: 1, l: 1, h: 0 },
            files: { svg: "example.svg", png: null } },
  cube:   { label: "Bloque", group: "Terreno y estructura", behavior: "block", physics: { solid: true },
            draw: "cube", anchor: "corner", foot: { w: 1, l: 1, h: 1 },
            files: { svg: "cube.svg", png: "cube.png" }, sprite: { w: 34, h: 34, minX: -17, minY: -17 } },
  // Paredes: NO son sprites anclados por minX/minY (se dibujan con el mecanismo de TILE de pared,
  // no por drawSprite). Por eso no llevan `sprite`. tile = tamaño del .svg del tile.
  wall1:  { label: "Pared (wall1)", group: "Terreno y estructura", behavior: "structure", physics: { solid: true },
            draw: "flatWall", anchor: "corner", foot: { w: 1, l: 0, h: WALL_H },
            files: { svg: "wall1.svg", png: null }, tile: { w: 17, h: 60 } },
  wall2:  { label: "Pared (wall2)", group: "Terreno y estructura", behavior: "structure", physics: { solid: true },
            draw: "flatWall", anchor: "corner", foot: { w: 2, l: 0, h: WALL_H },
            files: { svg: "wall2.svg", png: null }, tile: { w: 34, h: 68 } },
  // Columna: la huella va CENTRADA en la celda (0.2..0.8), pero el anclaje es la ESQUINA (0,0,0),
  // porque AP.pillar se invoca en (cx,cy)=(0,0) e insetea. anchor (ref) y footAnchor (huella) difieren.
  pillar: { label: "Columna", group: "Terreno y estructura", behavior: "block", physics: { solid: true },
            draw: "pillar", anchor: "corner", footAnchor: "center", foot: { w: 0.6, l: 0.6, h: 2.2 } },

  // --- Puerta (arco): NO es centro/esquina simple; huella por EJE (eje x / eje y) ---
  door: { label: "Puerta (arco)", group: "Terreno y estructura", behavior: "structure", physics: { solid: false },
          draw: "door", files: { svg: "door_front.svg", png: null }, extraFiles: ["door_back.svg"],
          variants: {
            axisX: { label: "eje x", state: { axis: "x" },
                     box: { x: 1.5 - D.SPAN_HALF, y: -D.T, z: 0, w: 2 * D.SPAN_HALF, l: D.T, h: WALL_H },
                     ref: { x: 1.5 - D.SPAN_HALF, y: 0, z: 0 } },
            axisY: { label: "eje y", state: { axis: "y" },
                     box: { x: -D.T, y: 1.5 - D.SPAN_HALF, z: 0, w: D.T, l: 2 * D.SPAN_HALF, h: WALL_H },
                     ref: { x: 0, y: 1.5 - D.SPAN_HALF, z: 0 } },
          } },

  // --- Circuitos transportables (props). cube/pyramid migrados (sprite); dome/cylinder no ---
  prop_cube:     { label: "Cubo", group: "Circuitos (transportables)", behavior: "carriable", physics: { solid: true },
                   draw: "circuit:cube",     anchor: "center", foot: { w: P2, l: P2, h: PROP.H },
                   files: { svg: "prop_cube.svg", png: null }, sprite: { w: 18, h: 18, minX: -9, minY: -13 } },
  prop_pyramid:  { label: "Pirámide", group: "Circuitos (transportables)", behavior: "carriable", physics: { solid: true },
                   draw: "circuit:pyramid",  anchor: "center", foot: { w: P2, l: P2, h: PROP.H },
                   files: { svg: "prop_pyramid.svg", png: null }, sprite: { w: 18, h: 14, minX: -9, minY: -9 } },
  prop_dome:     { label: "Domo", group: "Circuitos (transportables)", behavior: "carriable", physics: { solid: true },
                   draw: "circuit:dome",     anchor: "center", foot: { w: P2, l: P2, h: PROP.H } },
  prop_cylinder: { label: "Cilindro", group: "Circuitos (transportables)", behavior: "carriable", physics: { solid: true },
                   draw: "circuit:cylinder", anchor: "center", foot: { w: P2, l: P2, h: PROP.H } },

  // --- Zócalos (destino, por forma): peana 0.68×0.68×BASE_H. SÓLIDO; al activar suma PROP.H encima. ---
  socket_cube:     { label: "Zócalo cubo", group: "Zócalos (destino, por forma)", behavior: "target", physics: { solid: true },
                     draw: "socket:cube",     anchor: "center", foot: { w: SH2, l: SH2, h: SOCKET.BASE_H } },
  socket_pyramid:  { label: "Zócalo pirámide", group: "Zócalos (destino, por forma)", behavior: "target", physics: { solid: true },
                     draw: "socket:pyramid",  anchor: "center", foot: { w: SH2, l: SH2, h: SOCKET.BASE_H } },
  socket_dome:     { label: "Zócalo domo", group: "Zócalos (destino, por forma)", behavior: "target", physics: { solid: true },
                     draw: "socket:dome",     anchor: "center", foot: { w: SH2, l: SH2, h: SOCKET.BASE_H } },
  socket_cylinder: { label: "Zócalo cilindro", group: "Zócalos (destino, por forma)", behavior: "target", physics: { solid: true },
                     draw: "socket:cylinder", anchor: "center", foot: { w: SH2, l: SH2, h: SOCKET.BASE_H } },

  // --- Peligros y decoración ---
  spikes: { label: "Pinchos", group: "Peligros y decoración", behavior: "hazard", physics: { solid: false },
            draw: "spikes", anchor: "center", foot: { w: 0.54, l: 0.54, h: 0.5 },
            files: { svg: "spikes.svg", png: null }, sprite: { w: 14, h: 11, minX: -7, minY: -10 } },
  plant:  { label: "Planta", group: "Peligros y decoración", behavior: "decor", physics: { solid: false },
            draw: "plant",  anchor: "center", foot: { w: 0.32, l: 0.32, h: 0.5 },
            files: { svg: "plant.svg", png: null }, sprite: { w: 8, h: 13, minX: -4, minY: -11 } },
  drone:  { label: "Dron", group: "Peligros y decoración", behavior: "decor", physics: { solid: false },
            draw: "drone",  anchor: "center", foot: { w: 0.32, l: 0.32, h: 0.28, z: 0.6 } },

  // --- Personaje: huella VISUAL que rota con la orientación (eje x ↔ eje y). ---
  // (La huella de COLISIÓN es otra cosa: cuadrado simétrico CFG.PRAD; NO se modela aquí.)
  robot: { label: "Robot Pocho", group: "Personaje", behavior: "player", physics: { solid: false },
           draw: "robot", anchor: "center", foot: { w: 2 * R.WID, l: 2 * R.DEP, h: R.H },
           variants: {
             axisX: { label: "+x", state: { facing: 0 }, foot: { w: 2 * R.DEP, l: 2 * R.WID, h: R.H } },
             axisY: { label: "+y", state: { facing: 1 }, foot: { w: 2 * R.WID, l: 2 * R.DEP, h: R.H } },
           } },
};

/* ===================== HELPERS PUROS (derivan AABB / anclaje de foot+anchor) =====================
   Nadie debe construir una caja de asset a mano: se pide aquí. */

// Variante "representativa" cuando se pide sin variante y el asset NO tiene foot/box base
// (p. ej. la puerta, definida solo por ejes): se usa la primera variante.
function pickVariant(a, variant) {
  if (variant && a.variants && a.variants[variant]) return a.variants[variant];
  if (!a.foot && a.variants) return a.variants[Object.keys(a.variants)[0]];
  return null;
}

// Huella efectiva de un asset (aplicando variante de orientación si la hay). Si la variante define
// caja explícita (puerta) y no foot, se deriva de la caja {w,l,h}.
export function assetFoot(id, variant) {
  const a = ASSETS[id]; if (!a) return null;
  const v = pickVariant(a, variant);
  if (v && v.foot) return v.foot;
  if (v && v.box) return { w: v.box.w, l: v.box.l, h: v.box.h };
  return a.foot || null;
}

// AABB de mundo {x,y,z,w,l,h} en celdas. Derivada de foot + footAnchor (o box explícita de la variante).
export function assetBox(id, variant) {
  const a = ASSETS[id]; if (!a) return null;
  const v = pickVariant(a, variant);
  if (v && v.box) return { ...v.box };                      // puerta: caja explícita por eje
  const f = (v && v.foot) || a.foot; if (!f) return null;
  const z = f.z || 0, place = a.footAnchor || a.anchor;     // dónde se sitúa la HUELLA en la celda
  if (place === "center") return { x: 0.5 - f.w / 2, y: 0.5 - f.l / 2, z, w: f.w, l: f.l, h: f.h };
  return { x: 0, y: 0, z, w: f.w, l: f.l, h: f.h };          // "corner"
}

// Punto de anclaje iso {x,y,z}: donde el juego ancla el sprite (= P(coords)). Derivado de anchor.
export function assetRef(id, variant) {
  const a = ASSETS[id]; if (!a) return null;
  const v = pickVariant(a, variant);
  if (v && v.ref) return { ...v.ref };                      // puerta: anclaje explícito por eje
  return a.anchor === "center" ? { x: 0.5, y: 0.5, z: 0 } : { x: 0, y: 0, z: 0 };
}

// Región estándar contenedora: ceil de cada dimensión (mín. 1; 0→1), alineada a celdas.
export function assetRegion(id, variant) {
  const b = assetBox(id, variant); if (!b) return null;
  const x0 = Math.floor(b.x), x1 = Math.max(x0 + 1, Math.ceil(b.x + b.w));
  const y0 = Math.floor(b.y), y1 = Math.max(y0 + 1, Math.ceil(b.y + b.l));
  const z0 = Math.floor(b.z), z1 = Math.max(z0 + 1, Math.ceil(b.z + b.h));
  return { x: x0, y: y0, z: z0, w: x1 - x0, l: y1 - y0, h: z1 - z0 };
}

// Cima SÓLIDA de un zócalo (target) según su estado: la peana (BASE_H) y, si está ACTIVO, el circuito
// encajado encima (PROP.H). Fuente única (la usan física, render y el armado de things).
export function socketTop(s) { return (s.z || 0) + SOCKET.BASE_H + (s.active ? PROP.H : 0); }

// Tinte con el que se dibuja el asset: "secondary" para circuitos/zócalos (como hoy), "primary" el resto.
// El asset puede forzarlo con un campo `tint`; si no, se deriva del comportamiento. Lo usa render/tool
// para elegir room.ink (primario) o room.ink2 (secundario) sin enumerar tipos.
export function assetTint(id) {
  const a = ASSETS[id]; if (!a) return "primary";
  if (a.tint) return a.tint;
  return (a.behavior === "carriable" || a.behavior === "target") ? "secondary" : "primary";
}

// Nombre mostrable del asset (cae al id si no declara label).
export function assetLabel(id) { const a = ASSETS[id]; return (a && a.label) || id; }

// Vistas de PREVIEW de un asset: una por variante de orientación (puerta/robot) o una sola.
// Cada vista: { key (variante|null), label, state } — state se vuelca en el placement del drawer.
export function assetViews(id) {
  const a = ASSETS[id]; if (!a) return [];
  if (a.variants) return Object.entries(a.variants).map(([key, v]) => ({ key, label: v.label || key, state: v.state || {} }));
  return [{ key: null, label: a.label || id, state: {} }];
}

// Catálogo agrupado por `group` (en el orden de GROUP_ORDER; grupos desconocidos al final).
// Lo usa la tool para construir su catálogo SIN listas hardcodeadas.
export function assetsByGroup() {
  const buckets = new Map(GROUP_ORDER.map(g => [g, []]));
  for (const [id, a] of Object.entries(ASSETS)) {
    const g = a.group || "Otros";
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g).push(id);
  }
  return [...buckets].filter(([, ids]) => ids.length).map(([title, ids]) => ({ title, ids }));
}
