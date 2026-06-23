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
import { INKS, INK2, ROBOT_INK } from "./palette.js";
import { DOOR, PROP, ROBOT, SOCKET, ASSET_USE_PNG, WALL_TILE } from "./config.js";
import { ASSETS, WALL_H } from "./data/assets.js";   // FUENTE ÚNICA: encuadre de sprites + altura de pared

export const AP = (() => {

  // Primitivas genéricas del motor (proyección, cajas, painter…).
  const ENG = ENGINE;
  const { BLACK, darken, lighten, projector, poly, facePt, edgeLine, box } = ENG;

  // Paletas (palette.js) y geometría compartida (config.js): se usan aquí y se reexportan en AP.

  /* ===================== SPRITES EXTERNOS (flujo PNG/SVG, ver docs/ASSETS.md) =====================
     Los assets migrados se dibujan desde un fichero (PNG editado si ASSET_USE_PNG y existe; si no,
     su SVG) teñido por sala. Si no está migrado o aún no cargó, drawSprite devuelve false y el
     llamador pinta el vector (también para Node/tests). minX/minY = offset del bbox respecto al
     punto de referencia P(coords); w/h = tamaño nativo. Se derivan del registro `src/data/assets.js`. */
  const SPRITES = Object.fromEntries(
    Object.entries(ASSETS).filter(([, a]) => a.sprite).map(([id, a]) => [id, a.sprite])
  );
  const _spr = {};   // name → { neutral: canvas|null, tints: { col: canvas } }
  function _rasterTo(def, img) {
    const c = document.createElement("canvas"); c.width = def.w; c.height = def.h;
    c.getContext("2d").drawImage(img, 0, 0, def.w, def.h); return c;
  }
  function _loadSprite(name, def, s) {
    const load = (url, onfail) => { const img = new Image(); img.onload = () => { s.neutral = _rasterTo(def, img); }; img.onerror = onfail || null; img.src = url; };
    if (ASSET_USE_PNG) load("/assets/png/" + name + ".png", () => load("/assets/svg/" + name + ".svg"));
    else load("/assets/svg/" + name + ".svg");
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
  // Dibuja el sprite externo de `name` teñido a `col`, anclado en ref+(minX,minY). false → usa vector.
  function drawSprite(name, ctx, ref, col) {
    if (typeof document === "undefined") return false;        // Node (tests/generador): vector
    const def = SPRITES[name]; if (!def) return false;        // no migrado: vector
    let s = _spr[name]; if (!s) { s = _spr[name] = { neutral: null, tints: {} }; _loadSprite(name, def, s); }
    if (!s.neutral) return false;                             // aún cargando: vector
    let t = s.tints[col]; if (!t) t = s.tints[col] = _tintSprite(s.neutral, col);
    ctx.drawImage(t, Math.round(ref.x + def.minX), Math.round(ref.y + def.minY));
    return true;
  }

  /* ── PARED por TILE (panal SVG/PNG): tira de N tiles de ancho × 3 de alto, ya dibujada EN
     PERSPECTIVA en assets/svg/<variant>.svg. El juego blitea la tira teselada a lo largo del muro
     (sin transform); el muro del eje y se voltea en horizontal. N = ancho del hexágono = ancho de
     celda. {N,w,h,minX,minY}: bbox y su offset respecto a la esquina inf-izq (BL=P(a,fixed,0)). ── */
  const WALL_TILES = {
    wall1: { N: 1, w: 17, h: 60, minX: 0, minY: -51 },
    wall2: { N: 2, w: 34, h: 68, minX: 0, minY: -51 },
  };
  const _wallTex = {};   // variant → { neutral: canvas|null, tints: { col: canvas } }
  function _loadWall(variant) {
    const def = WALL_TILES[variant], s = _wallTex[variant] = { neutral: null, tints: {} };
    const load = (url, onfail) => { const img = new Image();
      img.onload = () => { const c = document.createElement("canvas"); c.width = def.w; c.height = def.h;
        c.getContext("2d").drawImage(img, 0, 0, def.w, def.h); s.neutral = c; };
      img.onerror = onfail || null; img.src = url; };
    if (ASSET_USE_PNG) load("/assets/png/" + variant + ".png", () => load("/assets/svg/" + variant + ".svg"));
    else load("/assets/svg/" + variant + ".svg");
  }
  function _wallTexture(variant, col) {
    if (typeof document === "undefined" || !WALL_TILES[variant]) return null;
    let s = _wallTex[variant]; if (!s) { _loadWall(variant); s = _wallTex[variant]; }
    if (!s.neutral) return null;
    return s.tints[col] || (s.tints[col] = _tintSprite(s.neutral, col));
  }
  // Tesela la tira (ya en perspectiva) a lo largo de la cara. A=abajo-izq, B=abajo-dcha (z=0);
  // Bt/At = arriba. nW = ancho del muro en tiles. eje "y" → se voltea en horizontal (muro espejo).
  function fillWall(ctx, axis, A, B, Bt, At, nW, variant, col) {
    const def = WALL_TILES[variant]; if (!def) return false;
    const tex = _wallTexture(variant, col); if (!tex) return false;
    const ux = (B.x - A.x) / nW, uy = (B.y - A.y) / nW;     // vector por tile a lo largo del eje
    const flip = (axis === "y");
    ctx.save();
    ctx.beginPath(); ctx.moveTo(At.x, At.y); ctx.lineTo(Bt.x, Bt.y); ctx.lineTo(B.x, B.y); ctx.lineTo(A.x, A.y);
    ctx.closePath(); ctx.clip();                            // recorta a la cara (tiras parciales del borde)
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i * def.N < nW + 1e-3; i++) {           // tiras de N tiles a lo largo del muro
      const bx = A.x + i * def.N * ux, by = A.y + i * def.N * uy;   // esquina inf-izq de la tira i
      if (!flip) ctx.drawImage(tex, Math.round(bx + def.minX), Math.round(by + def.minY));
      else { ctx.save(); ctx.translate(2 * bx, 0); ctx.scale(-1, 1);
        ctx.drawImage(tex, Math.round(bx + def.minX), Math.round(by + def.minY)); ctx.restore(); }
    }
    ctx.restore();
    return true;
  }

  /* ── PUERTA por SPRITE (marco SVG/PNG ya en perspectiva, altura fija): assets/svg/door_front|back.svg.
     "front" = marco del frente (vano transparente → se ve al robot al cruzar); "back" = marco del muro
     de fondo (con hueco negro detrás). El eje y se voltea en horizontal.
     {w,h,minX,minY}: bbox del sprite y offset respecto a la esquina del vano P(a0,fixed,0). ── */
  const DOOR_TILES = {
    front: { w: 45, h: 74, minX: -6, minY: -51 },
    back:  { w: 44, h: 74, minX:  0, minY: -54 },
  };
  const _doorTex = {};
  function _loadDoor(variant) {
    const def = DOOR_TILES[variant], s = _doorTex[variant] = { neutral: null, tints: {} }, file = "door_" + variant;
    const load = (url, onfail) => { const img = new Image();
      img.onload = () => { const c = document.createElement("canvas"); c.width = def.w; c.height = def.h;
        c.getContext("2d").drawImage(img, 0, 0, def.w, def.h); s.neutral = c; };
      img.onerror = onfail || null; img.src = url; };
    if (ASSET_USE_PNG) load("/assets/png/" + file + ".png", () => load("/assets/svg/" + file + ".svg"));
    else load("/assets/svg/" + file + ".svg");
  }
  function _doorTexture(variant, col) {
    if (typeof document === "undefined") return null;
    let s = _doorTex[variant]; if (!s) { _loadDoor(variant); s = _doorTex[variant]; }
    if (!s.neutral) return null;
    return s.tints[col] || (s.tints[col] = _tintSprite(s.neutral, col));
  }
  // Dibuja el marco de puerta desde el sprite (front/back) anclado en P(a0,fixed,0). false → vector.
  function drawDoorSprite(ctx, p, axis, fixed, a0, a1, H, hole, col) {
    const variant = hole ? "back" : "front", def = DOOR_TILES[variant];
    const tex = _doorTexture(variant, col); if (!tex) return false;
    if (hole) doorHole(ctx, p, axis, fixed, a0, a1, H, col);    // hueco negro detrás del marco
    const ref = (axis === "x") ? p(a0, fixed, 0) : p(fixed, a0, 0);
    const dx = Math.round(ref.x + def.minX), dy = Math.round(ref.y + def.minY);
    if (axis === "x") ctx.drawImage(tex, dx, dy);
    else { ctx.save(); ctx.translate(2 * ref.x, 0); ctx.scale(-1, 1); ctx.drawImage(tex, dx, dy); ctx.restore(); }
    return true;
  }

  /* =====================  ASSETS  ===================== */

  // Suelo: negro con rejilla tenue de la tinta de la sala
  function floor(ctx, p, cx, cy, col) {
    const a = p(cx, cy, 0), b = p(cx + 1, cy, 0), c = p(cx + 1, cy + 1, 0), d = p(cx, cy + 1, 0);
    poly(ctx, [a, b, c, d], ((cx + cy) & 1) ? darken(col, 0.10) : "#020303", darken(col, 0.30));
  }

  // Bloque: desde fichero (PNG si existe, si no SVG).
  function cube(ctx, p, cx, cy, cz, col) {
    drawSprite("cube", ctx, p(cx, cy, cz), col);
  }

  // Pared PLANA y teselada (panal). axis "x": plano en y=fixed recorriendo x. `tile` = variante de
  // panal (por sala); si no se pasa, override de consola o el global WALL_TILE.
  function flatWall(ctx, p, axis, fixed, a0, a1, H, col, tile) {
    let At, Bt, B, A;
    if (axis === "x") { A = p(a0, fixed, 0); B = p(a1, fixed, 0); Bt = p(a1, fixed, H); At = p(a0, fixed, H); }
    else { A = p(fixed, a0, 0); B = p(fixed, a1, 0); Bt = p(fixed, a1, H); At = p(fixed, a0, H); }
    const L = [At, Bt, B, A];
    poly(ctx, L, BLACK, BLACK);          // fondo NEGRO mientras carga la imagen
    // PANAL: tira PNG/SVG (ya en perspectiva) teselada a lo largo del muro.
    const variant = tile || (typeof window !== "undefined" && window.__wall) || WALL_TILE;
    fillWall(ctx, axis, A, B, Bt, At, a1 - a0, variant, col);
    poly(ctx, L, null, BLACK);           // recontorno limpio
  }

  // Hueco negro de la puerta de FONDO. Lo usa drawDoorSprite: lo pinta detrás del marco "back".
  function doorHole(ctx, p, axis, fixed, a0, a1, H, col) {
    const w = DOOR.POST_W, l = H - DOOR.LINTEL_H;
    if (axis === "x") poly(ctx, [p(a0 + w, fixed, l), p(a1 - w, fixed, l), p(a1 - w, fixed, 0), p(a0 + w, fixed, 0)], BLACK, null);
    else              poly(ctx, [p(fixed, a0 + w, l), p(fixed, a1 - w, l), p(fixed, a1 - w, 0), p(fixed, a0 + w, 0)], BLACK, null);
  }
  // PUERTA: desde fichero (PNG si existe, si no SVG). "front" = marco con vano transparente;
  // "back" = marco del fondo + hueco negro detrás (lo añade drawDoorSprite).
  function door(ctx, p, axis, fixed, a0, a1, H, col, hole) {
    drawDoorSprite(ctx, p, axis, fixed, a0, a1, H, hole, col);
  }

  // Columna delgada. La huella (centrada en la celda) la dicta el registro: margen = (1 − ancho)/2.
  function pillar(ctx, p, cx, cy, h, col) {
    const m = (1 - ASSETS.pillar.foot.w) / 2;
    box(ctx, p, cx + m, cy + m, cx + 1 - m, cy + 1 - m, 0, h, col);
  }

  // ---- Circuitos (4 formas geométricas monocromas) ----
  // Huella y alto los dicta el registro (PROP.HALF / PROP.H): el dibujo LLENA su huella física.
  function circuit(ctx, p, x, y, z, shape, col) {
    const r = PROP.HALF, hh = PROP.H;
    if (shape === "cube") {
      box(ctx, p, x - r, y - r, x + r, y + r, z, z + hh, col);
    } else if (shape === "pyramid") {
      const ap = p(x, y, z + hh);
      const b1 = p(x - r, y - r, z), b2 = p(x + r, y - r, z), b3 = p(x + r, y + r, z), b4 = p(x - r, y + r, z);
      // Pintado atrás→delante: caras TRASERAS (-x,-y) primero, FRONTALES (+x,+y) encima.
      poly(ctx, [b1, b2, ap], darken(col, 0.45), BLACK);   // trasera (-y)
      poly(ctx, [b1, b4, ap], darken(col, 0.45), BLACK);   // trasera (-x)
      poly(ctx, [b4, b3, ap], col, BLACK);                 // frontal izquierda (+y), iluminada
      poly(ctx, [b2, b3, ap], darken(col, 0.62), BLACK);   // frontal derecha (+x)
    } else if (shape === "dome") {
      // Semiesfera de cristal: relleno muy tenue, aro de base, contorno del casquete y brillo.
      const rr = 0.34, c = p(x, y, z), rx = rr * p.TW / 2, ry = rr * p.TH / 2, dh = hh * p.BH;   // radio propio rr; alto = PROP.H
      const cap = () => {
        ctx.beginPath(); ctx.moveTo(c.x - rx, c.y);
        ctx.bezierCurveTo(c.x - rx, c.y - dh, c.x + rx, c.y - dh, c.x + rx, c.y);
        ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI, true); ctx.closePath();
      };
      ctx.save(); cap(); ctx.globalAlpha = 0.2; ctx.fillStyle = col; ctx.fill(); ctx.restore();   // cristal
      ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);                          // aro de base
      ctx.strokeStyle = darken(col, 0.55); ctx.lineWidth = 1; ctx.stroke();
      cap(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();                              // contorno
      ctx.beginPath(); ctx.ellipse(c.x - rx * 0.34, c.y - dh * 0.5, rx * 0.2, dh * 0.26, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fill();                                        // brillo
    } else if (shape === "cylinder") {
      const ch = hh, topC = p(x, y, z + ch), botC = p(x, y, z), rx = r * p.TW / 2, ry = r * p.TH / 2;
      ctx.beginPath(); ctx.moveTo(topC.x - rx, topC.y); ctx.lineTo(botC.x - rx, botC.y);
      ctx.ellipse(botC.x, botC.y, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(topC.x + rx, topC.y); ctx.closePath();
      ctx.fillStyle = darken(col, 0.7); ctx.fill();
      ctx.strokeStyle = BLACK; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(topC.x, topC.y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = BLACK; ctx.stroke();
    }
  }

  // OBJETO FÍSICO transportable: se dibuja como la figura del circuito (sin base). Su caja
  // física (HALF/H) se ajusta al tamaño visible de la figura.
  function prop(ctx, p, x, y, z, shape, col) {
    const name = "prop_" + shape;
    if (SPRITES[name]) { drawSprite(name, ctx, p(x, y, z), col); return; }  // cube/pyramid: sprite PNG→SVG
    circuit(ctx, p, x, y, z, shape, col);   // domo/cilindro: procedurales
  }

  // Zócalo / pedestal
  function socket(ctx, p, x, y, z, shape, active, col) {
    const c = active ? col : darken(col, 0.4);
    box(ctx, p, x - 0.34, y - 0.34, x + 0.34, y + 0.34, z, z + SOCKET.BASE_H, c);
    const top = p(x, y, z + SOCKET.BASE_H), s = 5;
    ctx.strokeStyle = active ? col : darken(col, 0.7); ctx.lineWidth = 1;
    if (shape === "cube") ctx.strokeRect(top.x - s, top.y - s / 2, s * 2, s);
    else if (shape === "pyramid") poly(ctx, [{ x: top.x, y: top.y - s }, { x: top.x + s, y: top.y + s / 2 }, { x: top.x - s, y: top.y + s / 2 }], null, ctx.strokeStyle);
    else if (shape === "dome") { ctx.beginPath(); ctx.arc(top.x, top.y, s, Math.PI, 0); ctx.stroke(); }
    else { ctx.beginPath(); ctx.ellipse(top.x, top.y, s, s / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (active) circuit(ctx, p, x, y, z + SOCKET.BASE_H, shape, col);
  }

  // Pinchos (peligro): desde fichero (PNG→SVG).
  function spikes(ctx, p, x, y, z, col) {
    drawSprite("spikes", ctx, p(x, y, z), col);
  }

  // Planta decorativa: desde fichero (PNG→SVG).
  function plant(ctx, p, x, y, z, col) {
    drawSprite("plant", ctx, p(x, y, z), col);
  }

  // Dron flotante. Huella, altura de vuelo y alto los dicta el registro (foot {w,h,z}).
  function drone(ctx, p, x, y, z, col) {
    const f = ASSETS.drone.foot, r = f.w / 2, hv = z + f.z, top = hv + f.h;
    box(ctx, p, x - r, y - r, x + r, y + r, hv, top, col);
    const c = p(x, y, top);
    ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 5); ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(c.x - 1, c.y - 7, 2, 2);
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

  function shadow(ctx, p, x, y, z) {
    const c = p(x, y, z);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* ===================== DRAWERS — DIBUJO NORMALIZADO POR CLAVE `draw` =====================
     Firma única `(ctx, P, t, col)` con `t` = placement { asset, x, y, z, ...estado } (x,y,z =
     punto de ANCLAJE en mundo, igual que assetRef). Cada drawer traduce el placement a su
     primitiva (forma desde la clave `draw`, estado desde `t`), de modo que `drawAsset` dibuja
     cualquier asset sin saber cuál es (ver docs/ARQUITECTURA.md). */
  const _shapeOf = t => { const d = ASSETS[t.asset].draw, i = d.indexOf(":"); return i < 0 ? null : d.slice(i + 1); };
  const DRAWERS = {
    // GENÉRICO: cualquier asset de sprite (PNG→SVG). Uno nuevo se dibuja por aquí sin tocar este
    // fichero: basta su entrada en ASSETS con `draw:"sprite"` + su .svg.
    sprite:   (c, P, t, col) => drawSprite(t.asset, c, P(t.x, t.y, t.z), col),
    // Procedurales / paramétricos (bespoke):
    floor:    (c, P, t, col) => floor(c, P, t.x, t.y, col),
    cube:     (c, P, t, col) => cube(c, P, t.x, t.y, t.z, col),
    pillar:   (c, P, t, col) => pillar(c, P, t.x, t.y, ASSETS[t.asset].foot.h, col),
    drone:    (c, P, t, col) => drone(c, P, t.x, t.y, t.z, col),
    robot:    (c, P, t, col) => robot(c, P, t.x, t.y, t.z, t.facing || 0, col),
    circuit:  (c, P, t, col) => prop(c, P, t.x, t.y, t.z, _shapeOf(t), col),          // PNG→SVG→procedural
    socket:   (c, P, t, col) => socket(c, P, t.x, t.y, t.z, _shapeOf(t), !!t.active, col),
    // Estructura (paramétrica): la sala la dibuja en su capa propia; estos drawers son para
    // PREVIEWS sueltos de la tool, dibujando una instancia de muestra a partir de la huella.
    flatWall: (c, P, t, col) => { const a = ASSETS[t.asset]; flatWall(c, P, t.axis || "x", t.fixed || 0, t.a0 || 0, (t.a0 || 0) + a.foot.w, a.foot.h, col, t.asset); },
    door:     (c, P, t, col) => { const a0 = t.a0 != null ? t.a0 : 1.5 - DOOR.SPAN_HALF, a1 = t.a1 != null ? t.a1 : 1.5 + DOOR.SPAN_HALF;
                                  door(c, P, t.axis || "x", t.fixed || 0, a0, a1, WALL_H, col, t.hole != null ? t.hole : true); },
  };
  // Punto de entrada genérico: resuelve la clave base (antes de ":") y delega en su drawer.
  function drawAsset(ctx, P, t, col) { return DRAWERS[ASSETS[t.asset].draw.split(":")[0]](ctx, P, t, col); }

  /* SUPERFICIE PÚBLICA. Lo COLOCABLE se dibuja por `drawAsset`/`DRAWERS`, no por una función por
     asset. Aquí van: constantes/helpers, la API genérica, y las primitivas referenciadas POR NOMBRE
     desde fuera (cáscara estructural en render, robot/sombra en player/screens, generadores tools/gen-*). */
  return {
    INKS, INK2, ROBOT_INK, DIRS, ROBOT, BLACK, DOOR, PROP, darken, lighten,   // constantes + helpers
    projector, poly, box, facePt, edgeLine,                                   // primitivas de motor
    DRAWERS, drawAsset, SPRITES,                                              // API de dibujo genérica
    floor, flatWall, door, cube, prop, circuit, spikes, plant, robot, shadow, // primitivas usadas por nombre
  };
})();
