/* =============================================================================
   ALIEN POCHO — Dibujo de ASSETS (draw.js)
   -----------------------------------------------------------------------------
   Líneas y caras sobre negro. Cada sala tiene DOS tintas (ver palette.js): una
   PRIMARIA (suelo, paredes, bloques, robot) y una SECUNDARIA (circuitos, zócalos,
   HUD). Formas con contornos negros; el color cambia por sala y las caras en sombra
   se oscurecen (sombreado plano, darken).
   - Paredes: PLANAS y teseladas (panal), no cubos.
   - Puertas: marco 3D (postes + dintel con ranuras) que sobresale del borde.
   - El robot se pinta en la tinta que se le pasa; ROBOT_INK solo si no se indica ninguna.
   Uso:  AP.<asset>(ctx, p, ..., col)   con p = AP.projector(ox, oy)
   Catálogo visual interactivo (tool de dev): tools/tool-assets.html
   ============================================================================= */
"use strict";

import { ENGINE } from "./engine.js";
import { ROBOT_INK } from "./palette.js";
import { DOOR, ROBOT, SOCKET, ASSET_USE_PNG, WALL_TILE } from "./config.js";
import { ASSETS, WALL_H, propAsset } from "./data/assets.js";   // FUENTE ÚNICA: encuadre de sprites + altura de pared

export const AP = (() => {

  // Primitivas genéricas del motor (proyección, cajas, painter…).
  const ENG = ENGINE;
  const { BLACK, darken, lighten, projector, poly, facePt, box } = ENG;

  // Paletas (palette.js) y geometría compartida (config.js): se usan aquí; AP solo reexporta lo que se consume fuera.

  /* ===================== SPRITES EXTERNOS (flujo PNG/SVG, ver docs/ASSETS.md) =====================
     Cada asset-sprite se dibuja desde un fichero (PNG editado si ASSET_USE_PNG y existe; si no, su
     SVG) teñido por sala. drawSprite devuelve false (y no dibuja) si no hay DOM, el asset no tiene
     sprite o la imagen aún no cargó. minX/minY = offset del bbox respecto al punto de referencia
     P(coords); w/h = tamaño nativo. Se derivan del registro `src/data/assets.js`. */
  const SPRITES = Object.fromEntries(
    Object.entries(ASSETS).filter(([, a]) => a.sprite).map(([id, a]) => [id, a.sprite])
  );
  /* REGISTRO ÚNICO de rasters teñidos. Cubre los TRES tipos de imagen externa (sprite de objeto, tile de
     pared y sprite de puerta): el flujo es EL MISMO — lazy-load PNG→SVG, rasterizar a w×h, teñir por color
     y cachear. Clave = fichero base (sin extensión): { neutral, tints }. null = imagen aún cargando. */
  const _raster = {};
  function _rasterTo(def, img) {
    const c = document.createElement("canvas"); c.width = def.w; c.height = def.h;
    c.getContext("2d").drawImage(img, 0, 0, def.w, def.h); return c;
  }
  // Arranca la carga del neutro (gris) de `file` (= id del asset) a def.w×def.h. El FICHERO se deriva del id:
  // assets/svg/<id>.svg, o assets/png/<id>.png si el asset trae `png:true` y ASSET_USE_PNG (entonces cae al SVG
  // si fallara). Sin flag PNG no se prueba el .png → sin 404 en consola. Crea _raster[file] de inmediato (para no
  // relanzar) y llama `done` al terminar (cargado o fallo). Lo comparten la carga PEREZOSA (_neutral) y la PRECARGA.
  function _startLoad(file, def, done) {
    const s = _raster[file] || (_raster[file] = { neutral: null, tints: {} });
    if (s.neutral) { if (done) done(); return; }
    const load = (url, onfail) => {
      const img = new Image();
      img.onload = () => { s.neutral = _rasterTo(def, img); if (done) done(); };
      img.onerror = onfail || done || null;
      img.src = url;
    };
    const a = ASSETS[file], svg = "/assets/svg/" + file + ".svg";
    if (ASSET_USE_PNG && a && a.png) load("/assets/png/" + file + ".png", () => load(svg, done));
    else load(svg, done);
  }
  // Neutro (gris) de `file` rasterizado a def.w×def.h; lazy-carga (PNG→SVG) en el primer uso. null = aún cargando.
  function _neutral(file, def) {
    let s = _raster[file];
    if (!s) { _startLoad(file, def); s = _raster[file]; }
    return s.neutral;
  }
  function _tintSprite(neutral, col) {   // tiñe el gris por multiply y remáscara al alfa original
    const c = document.createElement("canvas"); c.width = neutral.width; c.height = neutral.height;
    const x = c.getContext("2d");
    x.drawImage(neutral, 0, 0);
    x.globalCompositeOperation = "multiply"; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "destination-in"; x.drawImage(neutral, 0, 0);
    x.globalCompositeOperation = "source-over";
    return c;
  }
  // Raster de `file` teñido a `col` (cacheado por color), o null si aún no cargó.
  function _tinted(file, def, col) {
    const n = _neutral(file, def); if (!n) return null;
    const s = _raster[file];
    return s.tints[col] || (s.tints[col] = _tintSprite(n, col));
  }
  // Dibuja el sprite externo de `name` teñido a `col`, anclado en ref+(minX,minY). false = no dibuja.
  function drawSprite(name, ctx, ref, col) {
    if (typeof document === "undefined") return false;        // sin DOM (Node/tests)
    const def = SPRITES[name]; if (!def) return false;        // asset sin sprite
    const t = _tinted(name, def, col); if (!t) return false;  // imagen aún cargando
    ctx.drawImage(t, Math.round(ref.x + def.minX), Math.round(ref.y + def.minY));
    return true;
  }

  /* PRECARGA: arranca la carga de TODOS los neutros con fichero del registro (sprites, tile de pared, puerta)
     y resuelve cuando están listos → el bucle entra a "playing" con todas las imágenes ya cargadas (sin el
     parpadeo del primer frame de cada sala). Los tintes por color se calculan luego al dibujar (síncronos).
     Sin DOM (Node) es no-op. Lo llama main.js al arrancar, durante la pantalla de título. */
  function preload() {
    if (typeof document === "undefined") return Promise.resolve();
    const jobs = [];
    for (const [id, a] of Object.entries(ASSETS)) {
      const def = a.sprite || a.tile || (a.tiles && a.tiles.front);   // dimensiones del raster del neutro
      if (!def) continue;                                             // procedurales (robot…) no tienen fichero
      jobs.push(new Promise(res => _startLoad(id, def, res)));
    }
    return Promise.all(jobs);
  }

  /* ── PARED por TILE (panal SVG/PNG): tira de N tiles de ancho × 3 de alto, ya dibujada EN
     PERSPECTIVA en assets/svg/<variant>.svg. El juego blitea la tira teselada a lo largo del muro
     (sin transform); el muro del eje y se voltea en horizontal. N = ancho del hexágono = ancho de celda.
     El encuadre {N,w,h,minX,minY} (bbox + offset respecto a la esquina inf-izq BL=P(a,fixed,0)) lo declara
     el REGISTRO: `ASSETS[variant].tile` (fuente única, sin copia aquí). ── */
  function _wallTexture(variant, col) {
    const a = ASSETS[variant];
    if (typeof document === "undefined" || !(a && a.tile)) return null;
    return _tinted(variant, a.tile, col);   // mismo registro que los sprites; clave = nombre de variante (= fichero)
  }
  /* ── PUERTA por SPRITE (marco SVG/PNG ya en perspectiva, altura fija): assets/svg/door.svg (UN solo dibujo).
     "front" = marco del frente (vano transparente → se ve al robot al cruzar); "back" = marco del muro
     de fondo (con hueco negro detrás). El eje y se voltea en horizontal. El encuadre {w,h,minX,minY} (bbox +
     offset respecto a la esquina del vano P(a0,fixed,0)) lo declara el REGISTRO: `ASSETS.door.tiles[variant]`
     (front/back; autogenerado por tools/gen-doors.mjs, SPAN_HALF=1). ── */
  // UN solo sprite "door": front/back comparten imagen y w×h (solo difiere el offset del ancla → ver drawDoorSprite).
  function _doorTexture(col) {
    if (typeof document === "undefined") return null;
    return _tinted("door", ASSETS.door.tiles.front, col);
  }
  // Dibuja el marco de puerta (un solo sprite) anclado en P(a0,fixed,0). `hole` solo elige el OFFSET del ancla
  // (front protruye / back retrocede; mismo dibujo). false = aún no cargó. El vano del sprite es transparente
  // (deja ver el fondo); no hay pieza negra propia (ver world.roomShell).
  function drawDoorSprite(ctx, p, axis, fixed, a0, a1, H, hole, col, half, box) {
    const def = ASSETS.door.tiles[hole ? "back" : "front"];
    const tex = _doorTexture(col); if (!tex) return false;
    const ref = (axis === "x") ? p(a0, fixed, 0) : p(fixed, a0, 0);
    const dx = Math.round(ref.x + def.minX), dy = Math.round(ref.y + def.minY);
    ctx.save();
    if (half && box) {
      // Cada PIEZA de la puerta (poste L/R o dintel) recorta el sprite a la SILUETA de SU PROPIA caja — el
      // hexágono iso [A,B,Bb,Cb,Db,D], el mismo que dibuja ENGINE.box. Así cada pieza pinta EXACTAMENTE su
      // trozo y queda ordenada por esa misma caja (draw ⊆ caja de orden). Es uniforme y NO depende del centro
      // del vano ni del espejo del eje y → cada poste se dibuja siempre con el orden de SU propia caja.
      const b = box, A = p(b.x0, b.y0, b.z1), B = p(b.x1, b.y0, b.z1), D = p(b.x0, b.y1, b.z1),
            Bb = p(b.x1, b.y0, b.z0), Cb = p(b.x1, b.y1, b.z0), Db = p(b.x0, b.y1, b.z0);
      ctx.beginPath(); ctx.moveTo(A.x, A.y);
      for (const q of [B, Bb, Cb, Db, D]) ctx.lineTo(q.x, q.y);
      ctx.closePath(); ctx.clip();
    }
    if (axis === "x") ctx.drawImage(tex, dx, dy);
    else { ctx.translate(2 * ref.x, 0); ctx.scale(-1, 1); ctx.drawImage(tex, dx, dy); }
    ctx.restore();
    return true;
  }

  /* =====================  ASSETS  ===================== */

  // Suelo: tesela rómbica desde fichero (floor.svg), teñida por la sala. El gris del SVG está calibrado para que
  // el multiply dé relleno ink×0.10 + rejilla ink×0.30.
  function floor(ctx, p, cx, cy, col) {
    drawSprite("floor", ctx, p(cx, cy, 0), col);
  }

  // Bloque: desde fichero (PNG si existe, si no SVG).
  function cube(ctx, p, cx, cy, cz, col) {
    drawSprite("cube", ctx, p(cx, cy, cz), col);
  }

  // Pared MODULAR: pega las tiras SVG del panal (cada tira = N celdas) celda a celda en el rango
  // [c0,c1] del muro (axis "x": plano y=fixed recorriendo x; "y": plano x=fixed, espejado). SIN recorte:
  // cada tira es un rectángulo cuyo SVG ya se recorta a su paralelogramo, así casan canto con canto. La
  // puerta deja un hueco de 2 celdas que el render simplemente NO incluye en ningún tramo (ver render.js).
  // `tile` = variante de panal (por sala); si no, override de consola o el global WALL_TILE. El negro lo
  // aportan el canvas (bg) y el propio tile (cada SVG trae su fondo): aquí NO se pinta nada a mano.
  function flatWall(ctx, p, axis, fixed, c0, c1, col, tile) {
    const variant = tile || (typeof window !== "undefined" && window.__wall) || WALL_TILE;
    const def = ASSETS[variant] && ASSETS[variant].tile; const tex = _wallTexture(variant, col);
    if (!def || !tex) return;                        // aún cargando → nada (el muro queda negro: canvas bg)
    ctx.imageSmoothingEnabled = false;
    const flip = (axis === "y");
    for (let i = c0; i + def.N <= c1 + 1e-6; i += def.N) {    // una tira por cada N celdas del tramo
      const b = (axis === "x") ? p(i, fixed, 0) : p(fixed, i, 0);   // esquina inf-izq de la tira
      const dx = Math.round(b.x + def.minX), dy = Math.round(b.y + def.minY);
      if (!flip) ctx.drawImage(tex, dx, dy);
      else { ctx.save(); ctx.translate(2 * b.x, 0); ctx.scale(-1, 1); ctx.drawImage(tex, dx, dy); ctx.restore(); }
    }
  }

  // PUERTA: desde fichero (PNG si existe, si no SVG). El vano es transparente; en las de FONDO se ve a través
  // el negro del fondo (sin pieza negra propia; ver world.roomShell).
  function door(ctx, p, axis, fixed, a0, a1, H, col, hole, half, box) {
    drawDoorSprite(ctx, p, axis, fixed, a0, a1, H, hole, col, half, box);
  }

  // Zócalo: peana con indentación cuadrada desde SVG (socket.svg), teñida por ESTADO (vacío =
  // atenuada, lleno = ILUMINADA). El circuito incrustado / fantasma se componen encima con su propio
  // sprite. SIN dibujo programático: solo composición de sprites (drawSprite) + tinte/alpha por estado.
  function socket(ctx, p, x, y, z, requires, filled, col) {
    const base = filled ? lighten(col, 0.30) : darken(col, 0.5);    // la peana se ILUMINA al recibir circuito
    drawSprite("socket", ctx, p(x, y, z), base);                    // peana + indentación (SVG)
    const which = filled || requires;
    if (which) {
      const ref = p(x, y, z + SOCKET.BASE_H - SOCKET.RECESS_DEPTH); // circuito hundido en la cavidad
      if (filled) drawSprite(propAsset(filled), ctx, ref, col);
      else { ctx.save(); ctx.globalAlpha = 0.20; drawSprite(propAsset(requires), ctx, ref, col); ctx.restore(); }  // fantasma del que pide
    }
  }

  // Pinchos (peligro): desde fichero (PNG→SVG).
  function spikes(ctx, p, x, y, z, col) {
    drawSprite("spikes", ctx, p(x, y, z), col);
  }

  // Planta decorativa: desde fichero (PNG→SVG).
  function plant(ctx, p, x, y, z, col) {
    drawSprite("plant", ctx, p(x, y, z), col);
  }

  /* ---- Robot Pocho (color propio fijo; 4 vistas, traseras = espejo) ---- */
  const DIRS = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];

  function robot(ctx, p, x, y, z, facing, col, opts = {}) {
    col = col || ROBOT_INK;
    const moving = !!opts.moving, walkPhase = opts.walkPhase || 0;
    const bob = moving ? Math.abs(Math.sin(walkPhase)) * 2.5 : 0;
    ctx.save(); ctx.translate(0, -bob);
    const dir = DIRS[facing], perp = { x: dir.dy, y: -dir.dx };
    const alongX = (facing === 0 || facing === 2);
    const bX = alongX ? ROBOT.DEP : ROBOT.WID, bY = alongX ? ROBOT.WID : ROBOT.DEP;
    const hX = alongX ? ROBOT.DEP * 0.94 : ROBOT.WID * 0.76, hY = alongX ? ROBOT.WID * 0.76 : ROBOT.DEP * 0.94;
    const swing = moving ? Math.sin(walkPhase) * 0.22 : 0, sep = ROBOT.WID * 0.5, fw = 0.13;
    const fA = { x: x + perp.x * sep + dir.dx * swing, y: y + perp.y * sep + dir.dy * swing };
    const fB = { x: x - perp.x * sep - dir.dx * swing, y: y - perp.y * sep - dir.dy * swing };
    const feet = [fA, fB].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const q of feet) box(ctx, p, q.x - fw, q.y - fw, q.x + fw, q.y + fw, z, z + 0.22, col);

    // --- BRAZOS: cuelgan a los lados del torso y balancean opuestos a los pies ---
    const armW = 0.075, sh = ROBOT.WID * 0.92;                 // semigrosor del brazo · separación al hombro
    const az0 = z + 0.30, az1 = z + 0.90, armSwing = -swing;   // cadera → hombro · balanceo opuesto a piernas
    const drawArm = (s) => {
      const ax = x + perp.x * sh * s + dir.dx * armSwing * s;
      const ay = y + perp.y * sh * s + dir.dy * armSwing * s;
      box(ctx, p, ax - armW, ay - armW, ax + armW, ay + armW, az0, az1, col);
    };
    const backS = (perp.x + perp.y < 0) ? 1 : -1;   // lado que queda DETRÁS del torso (orden de pintado)
    drawArm(backS);                                  // brazo trasero (lo tapa el torso)

    box(ctx, p, x - bX, y - bY, x + bX, y + bY, z + 0.22, z + 0.98, col);
    const hz0 = z + 0.98, hz1 = z + ROBOT.H;
    box(ctx, p, x - hX, y - hY, x + hX, y + hY, hz0, hz1, col);
    // cara (delante): visor + ojos negros
    const rF = [p(x + hX, y - hY, hz1), p(x + hX, y + hY, hz1), p(x + hX, y + hY, hz0), p(x + hX, y - hY, hz0)];
    const lF = [p(x - hX, y + hY, hz1), p(x + hX, y + hY, hz1), p(x + hX, y + hY, hz0), p(x - hX, y + hY, hz0)];
    const faceOn = (Q) => {
      poly(ctx, [facePt(Q, 0.16, 0.30), facePt(Q, 0.84, 0.30), facePt(Q, 0.84, 0.58), facePt(Q, 0.16, 0.58)], BLACK, null);
      poly(ctx, [facePt(Q, 0.28, 0.37), facePt(Q, 0.44, 0.37), facePt(Q, 0.44, 0.50), facePt(Q, 0.28, 0.50)], col, null);
      poly(ctx, [facePt(Q, 0.56, 0.37), facePt(Q, 0.72, 0.37), facePt(Q, 0.72, 0.50), facePt(Q, 0.56, 0.50)], col, null);
    };
    if (facing === 0) faceOn(rF); else if (facing === 1) faceOn(lF);
    // detallito de PECHO (vistas frontales): panelito negro con un núcleo que "brilla"
    const bz0 = z + 0.22, bz1 = z + 0.98;
    const bRF = [p(x + bX, y - bY, bz1), p(x + bX, y + bY, bz1), p(x + bX, y + bY, bz0), p(x + bX, y - bY, bz0)];
    const bLF = [p(x - bX, y + bY, bz1), p(x + bX, y + bY, bz1), p(x + bX, y + bY, bz0), p(x - bX, y + bY, bz0)];
    const chestOn = (Q) => {
      poly(ctx, [facePt(Q, 0.34, 0.40), facePt(Q, 0.66, 0.40), facePt(Q, 0.66, 0.72), facePt(Q, 0.34, 0.72)], BLACK, null);
      poly(ctx, [facePt(Q, 0.45, 0.49), facePt(Q, 0.55, 0.49), facePt(Q, 0.55, 0.63), facePt(Q, 0.45, 0.63)], col, null);
    };
    if (facing === 0) chestOn(bRF); else if (facing === 1) chestOn(bLF);
    drawArm(-backS);                                 // brazo delantero (por delante del torso)
    const aTop = p(x, y, hz1);
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(aTop.x) + 0.5, Math.round(aTop.y)); ctx.lineTo(Math.round(aTop.x) + 0.5, Math.round(aTop.y) - 5); ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(Math.round(aTop.x) - 1, Math.round(aTop.y) - 7, 2, 2);
    ctx.restore();
  }

  // Sombra/marcador de suelo bajo una entidad. (x,y,z) = punto de la SUPERFICIE de apoyo (no la entidad):
  // así al saltar la sombra se queda en el suelo y la entidad se separa → percepción de altura.
  //   col  = tinta de la sala → aro + disco TENUE en monocromo (visible sobre suelo oscuro, donde el negro
  //          puro se perdía). Sin col (screens): cae al disco negro de antes (mascota sobre fondo del menú).
  //   lift = altura de la entidad SOBRE la superficie → a más alto, sombra más pequeña y tenue (refuerza el salto).
  function shadow(ctx, p, x, y, z, col = null, lift = 0) {
    const c = p(x, y, z), k = 1 / (1 + lift * 0.6);   // 1 en el suelo → menor al subir
    ctx.save();
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 12 * k, 6 * k, 0, 0, Math.PI * 2);
    if (col) {
      ctx.globalAlpha = 0.16 * k; ctx.fillStyle = col; ctx.fill();                              // disco tenue
      ctx.globalAlpha = 0.55 * k; ctx.lineWidth = 1; ctx.strokeStyle = col; ctx.stroke();       // aro (lo que se ve)
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fill();
    }
    ctx.restore();
  }

  /* ===================== DRAWERS — DIBUJO NORMALIZADO POR CLAVE `draw` =====================
     Firma única `(ctx, P, t, col)` con `t` = placement { asset, x, y, z, ...estado } (x,y,z =
     punto de ANCLAJE en mundo, igual que assetRef). Cada drawer traduce el placement a su
     primitiva (forma desde la clave `draw`, estado desde `t`), de modo que `drawAsset` dibuja
     cualquier asset sin saber cuál es (ver docs/ARQUITECTURA.md). */
  const DRAWERS = {
    // GENÉRICO: cualquier asset de sprite (PNG→SVG). Uno nuevo se dibuja por aquí sin tocar este
    // fichero: basta su entrada en ASSETS con `draw:"sprite"` + su .svg.
    sprite:   (c, P, t, col) => drawSprite(t.asset, c, P(t.x, t.y, t.z), col),
    // Procedurales / paramétricos (bespoke):
    floor:    (c, P, t, col) => floor(c, P, t.x, t.y, col),
    cube:     (c, P, t, col) => cube(c, P, t.x, t.y, t.z, col),
    robot:    (c, P, t, col) => robot(c, P, t.x, t.y, t.z, t.facing || 0, col),
    socket:   (c, P, t, col) => socket(c, P, t.x, t.y, t.z, t.requires, t.filled, col),
    // Estructura (paramétrica): la sala la dibuja en su capa propia; estos drawers son para
    // PREVIEWS sueltos de la tool, dibujando una instancia de muestra a partir de la huella.
    flatWall: (c, P, t, col) => { const a = ASSETS[t.asset];   // sala: tramo [a0,a1]; preview de la tool (sin a1): un tile (foot.w)
                                  flatWall(c, P, t.axis || "x", t.fixed || 0, t.a0 || 0, t.a1 != null ? t.a1 : (t.a0 || 0) + a.foot.w, col, t.tile || t.asset); },
    door:     (c, P, t, col) => { const a0 = t.a0 != null ? t.a0 : 1.5 - DOOR.SPAN_HALF, a1 = t.a1 != null ? t.a1 : 1.5 + DOOR.SPAN_HALF;
                                  door(c, P, t.axis || "x", t.fixed || 0, a0, a1, WALL_H, col, t.hole != null ? t.hole : true, t.half, t.aabb); },
  };
  // Punto de entrada genérico: resuelve la clave base (antes de ":") y delega en su drawer.
  function drawAsset(ctx, P, t, col) { return DRAWERS[ASSETS[t.asset].draw.split(":")[0]](ctx, P, t, col); }

  /* SUPERFICIE PÚBLICA (mínima: solo lo que se consume FUERA de este módulo). Lo COLOCABLE y la CÁSCARA
     se dibujan por `drawAsset`/`DRAWERS` (no por nombre); todo sprite (sala, zócalo, brazos o HUD) pasa por
     la MISMA `drawSprite(name, ctx, ref, col)` (ref = punto de pantalla). Lo único expuesto POR NOMBRE es
     `floor` (pre-pase z=0 de render) y `robot`/`shadow` (player/screens). */
  return {
    DOOR, darken, lighten,            // helpers usados fuera (DOOR en render; darken/lighten en la tool)
    projector,                        // primitiva de motor (screens/tool)
    drawAsset, drawSprite, SPRITES,   // API de dibujo genérica (SPRITES lo verifica el test)
    preload,                          // precarga de imágenes al arrancar (main.js)
    floor, robot, shadow,             // primitivas usadas POR NOMBRE fuera (floor en render; robot/shadow en player/screens)
  };
})();
