/* =============================================================================
   ALIEN POCHO — Biblioteca de ASSETS (estilo Alien 8 fiel)
   -----------------------------------------------------------------------------
   MONOCROMO de verdad: cada sala usa UN solo color de tinta sobre negro, y las
   formas se definen con CONTORNOS NEGROS (teselado limpio). El color cambia por
   pantalla. Las caras en sombra se "oscurecen" con tramado (dither) negro.
   - Paredes: PLANAS y teseladas (panal), no cubos.
   - Puertas/arcos: GRANDES y abiertos.
   - Bloques: figuras con bordes "mordidos" (chaflanes), no cubos exactos.
   - El robot mantiene su propio color (azul), visible en cualquier sala.
   Uso:  AP.<asset>(ctx, p, ..., col)   con p = AP.projector(ox, oy)
   ============================================================================= */
const AP = (() => {

  const BLACK = "#000000";
  // Colores de tinta por pantalla (como las distintas salas del original)
  const INKS = ["#36c8ff", "#d7d98a", "#e070c5", "#79e6a6", "#ff9d5c", "#b9a6ff"];
  const ROBOT_INK = "#6fd0ff";   // el robot siempre azul claro

  /* ---- utilidades de color ---- */
  function darken(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  }

  /* ---- proyección iso: p(x,y,z) -> {x,y} ---- */
  function projector(ox, oy, opt = {}) {
    const TW = opt.TILE_W ?? 32, TH = opt.TILE_H ?? 16, BH = opt.BLOCK_H ?? 16;
    const p = (x, y, z = 0) => ({ x: ox + (x - y) * (TW / 2), y: oy + (x + y) * (TH / 2) - z * BH });
    p.TW = TW; p.TH = TH; p.BH = BH; return p;
  }

  /* ---- patrones de tramado (dither) en caché ---- */
  const _pat = {};
  function dither(ctx, kind) {
    if (_pat[kind]) return _pat[kind];
    const c = document.createElement("canvas"); c.width = c.height = 2;
    const x = c.getContext("2d"); x.fillStyle = BLACK;
    if (kind === "half") { x.fillRect(0, 0, 1, 1); x.fillRect(1, 1, 1, 1); }
    else { x.fillRect(0, 0, 1, 1); }   // "quarter"
    return (_pat[kind] = ctx.createPattern(c, "repeat"));
  }

  /* ---- helpers de dibujo ---- */
  function poly(ctx, pts, fill, stroke, lw = 1) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function ditherPoly(ctx, pts, kind) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.clip();
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys));
    ctx.fillStyle = dither(ctx, kind);
    ctx.fillRect(x0, y0, Math.ceil(Math.max(...xs)) - x0, Math.ceil(Math.max(...ys)) - y0);
    ctx.restore();
  }
  function facePt(L, u, v) {
    return {
      x: (L[0].x * (1 - u) + L[1].x * u) * (1 - v) + (L[3].x * (1 - u) + L[2].x * u) * v,
      y: (L[0].y * (1 - u) + L[1].y * u) * (1 - v) + (L[3].y * (1 - u) + L[2].y * u) * v
    };
  }

  // Caja iso: tinta de la sala con SOMBREADO PLANO suave (caras un poco más
  // oscuras, mismo tono) y contornos negros. Limpio, sin puntos.
  function box(ctx, p, x0, y0, x1, y1, z0, z1, col) {
    const A = p(x0, y0, z1), B = p(x1, y0, z1), C = p(x1, y1, z1), D = p(x0, y1, z1);
    const Bb = p(x1, y0, z0), Cb = p(x1, y1, z0), Db = p(x0, y1, z0);
    poly(ctx, [A, B, C, D], col, BLACK);                  // techo (iluminado)
    poly(ctx, [B, C, Cb, Bb], darken(col, 0.62), BLACK);  // cara derecha (+x): sombra
    poly(ctx, [D, C, Cb, Db], darken(col, 0.82), BLACK);  // cara izquierda (+y): media
  }

  // Panal HEXAGONAL sobre una cara plana [TL,TR,BR,BL]: hexágonos que teselan
  // perfectos (separados por líneas negras), proyectados sobre el plano de la
  // pared. R = radio del hexágono en píxeles. Se recorta a la cara.
  function honeycomb(ctx, L, R) {
    const o = L[0];
    const uxx = L[1].x - o.x, uxy = L[1].y - o.y;   // vector ancho
    const vxx = L[3].x - o.x, vxy = L[3].y - o.y;   // vector alto
    const wPx = Math.hypot(uxx, uxy), hPx = Math.hypot(vxx, vxy);
    const eux = uxx / wPx, euy = uxy / wPx;          // unitarios en coord. de cara
    const evx = vxx / hPx, evy = vxy / hPx;
    const toS = (a, b) => ({ x: o.x + eux * a + evx * b, y: o.y + euy * a + evy * b });
    ctx.save();
    ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(L[i].x, L[i].y);
    ctx.closePath(); ctx.clip();
    ctx.strokeStyle = BLACK; ctx.lineWidth = 1;
    const colS = Math.sqrt(3) * R, rowS = 1.5 * R;   // hexágonos "pointy-top"
    for (let b = 0, j = 0; b <= hPx + R; b += rowS, j++) {
      const off = (j & 1) ? colS / 2 : 0;
      for (let a = -colS; a <= wPx + colS; a += colS) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = Math.PI / 180 * (60 * k + 90);
          const s = toS(a + off + Math.cos(ang) * R, b + Math.sin(ang) * R);
          if (k === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        }
        ctx.closePath(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* =====================  ASSETS  ===================== */

  // Suelo: negro con rejilla tenue de la tinta de la sala
  function floor(ctx, p, cx, cy, col) {
    const a = p(cx, cy, 0), b = p(cx + 1, cy, 0), c = p(cx + 1, cy + 1, 0), d = p(cx, cy + 1, 0);
    poly(ctx, [a, b, c, d], ((cx + cy) & 1) ? darken(col, 0.10) : "#020303", darken(col, 0.30));
  }

  // Bloque: caja con BORDES MORDIDOS (pequeños chaflanes negros en las esquinas)
  function cube(ctx, p, cx, cy, cz, col) {
    box(ctx, p, cx, cy, cx + 1, cy + 1, cz, cz + 1, col);
    const t = cz + 1;
    const corners = [p(cx, cy, t), p(cx + 1, cy, t), p(cx + 1, cy + 1, t), p(cx, cy + 1, t)];
    const ctr = p(cx + 0.5, cy + 0.5, t);
    ctx.fillStyle = BLACK;
    for (const k of corners) {  // "muerde" cada esquina del techo
      const dx = (ctr.x - k.x), dy = (ctr.y - k.y), m = Math.hypot(dx, dy);
      const ux = dx / m, uy = dy / m, s = 3;
      poly(ctx, [k, { x: k.x + ux * s - uy * s, y: k.y + uy * s + ux * s },
                    { x: k.x + ux * s + uy * s, y: k.y + uy * s - ux * s }], BLACK, null);
    }
  }

  // Pared PLANA y teselada (panal). axis "x": plano en y=fixed recorriendo x.
  function flatWall(ctx, p, axis, fixed, a0, a1, H, col) {
    let At, Bt, B, A;
    if (axis === "x") { A = p(a0, fixed, 0); B = p(a1, fixed, 0); Bt = p(a1, fixed, H); At = p(a0, fixed, H); }
    else { A = p(fixed, a0, 0); B = p(fixed, a1, 0); Bt = p(fixed, a1, H); At = p(fixed, a0, H); }
    const L = [At, Bt, B, A];
    poly(ctx, L, col, BLACK);
    honeycomb(ctx, L, p.TW * 0.32);
    poly(ctx, L, null, BLACK);     // recontorno limpio
  }

  // PUERTA 3D con MARCO (postes + dintel) y un POCO de grosor. Mismo asset
  // para el fondo y el frente:
  //   hole=true  → abre un hueco negro en la pared (puertas del fondo).
  //   hole=false → solo el marco 3D, dejando ver la sala (puertas del frente).
  // `fixed` es el borde (0 o n); el marco se mete un poco HACIA DENTRO.
  const DOOR_T = 0.26, POST_W = 0.34, LINTEL_H = 0.42;
  function door(ctx, p, axis, fixed, a0, a1, H, col, hole) {
    const inset = (fixed < 0.5) ? [fixed, fixed + DOOR_T] : [fixed - DOOR_T, fixed];
    const d0 = inset[0], d1 = inset[1];
    const Bx = (x0, y0, x1, y1, z0, z1) => box(ctx, p, x0, y0, x1, y1, z0, z1, col);
    if (axis === "x") {
      if (hole) poly(ctx, [p(a0 + POST_W, fixed, H - LINTEL_H), p(a1 - POST_W, fixed, H - LINTEL_H),
                           p(a1 - POST_W, fixed, 0), p(a0 + POST_W, fixed, 0)], BLACK, null);
      Bx(a0, d0, a0 + POST_W, d1, 0, H);          // poste izquierdo
      Bx(a1 - POST_W, d0, a1, d1, 0, H);          // poste derecho
      Bx(a0, d0, a1, d1, H - LINTEL_H, H);        // dintel
    } else {
      if (hole) poly(ctx, [p(fixed, a0 + POST_W, H - LINTEL_H), p(fixed, a1 - POST_W, H - LINTEL_H),
                           p(fixed, a1 - POST_W, 0), p(fixed, a0 + POST_W, 0)], BLACK, null);
      Bx(d0, a0, d1, a0 + POST_W, 0, H);
      Bx(d0, a1 - POST_W, d1, a1, 0, H);
      Bx(d0, a0, d1, a1, H - LINTEL_H, H);
    }
  }

  // Columna delgada
  function pillar(ctx, p, cx, cy, h, col) {
    const m = 0.2; box(ctx, p, cx + m, cy + m, cx + 1 - m, cy + 1 - m, 0, h, col);
  }

  // ---- Circuitos (4 formas) — figuras geométricas vistosas, monocromas ----
  function circuit(ctx, p, x, y, z, shape, col) {
    const r = 0.26;
    if (shape === "cube") {
      box(ctx, p, x - r, y - r, x + r, y + r, z, z + 0.5, col);
    } else if (shape === "pyramid") {
      const ap = p(x, y, z + 0.62);
      const b1 = p(x - r, y - r, z), b2 = p(x + r, y - r, z), b3 = p(x + r, y + r, z), b4 = p(x - r, y + r, z);
      poly(ctx, [b4, b3, ap], darken(col, 0.82), BLACK);   // cara izquierda
      poly(ctx, [b2, b3, ap], darken(col, 0.62), BLACK);   // cara derecha
      poly(ctx, [b1, b2, ap], col, BLACK);                 // cara frontal
    } else if (shape === "dome") {
      const c = p(x, y, z), rx = r * p.TW / 2, ry = r * p.TH / 2, dh = rx * 0.95;
      ctx.beginPath(); ctx.moveTo(c.x - rx, c.y);
      ctx.bezierCurveTo(c.x - rx, c.y - dh, c.x + rx, c.y - dh, c.x + rx, c.y);
      ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI, true); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = BLACK; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(c.x, c.y - dh * 0.35, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
      ctx.strokeStyle = BLACK; ctx.stroke();
    } else if (shape === "cylinder") {
      const ch = 0.5, topC = p(x, y, z + ch), botC = p(x, y, z), rx = r * p.TW / 2, ry = r * p.TH / 2;
      ctx.beginPath(); ctx.moveTo(topC.x - rx, topC.y); ctx.lineTo(botC.x - rx, botC.y);
      ctx.ellipse(botC.x, botC.y, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(topC.x + rx, topC.y); ctx.closePath();
      ctx.fillStyle = darken(col, 0.7); ctx.fill();
      ctx.strokeStyle = BLACK; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(topC.x, topC.y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = BLACK; ctx.stroke();
    }
  }

  // Zócalo / pedestal
  function socket(ctx, p, x, y, z, shape, active, col) {
    const c = active ? col : darken(col, 0.4);
    box(ctx, p, x - 0.34, y - 0.34, x + 0.34, y + 0.34, z, z + 0.2, c);
    const top = p(x, y, z + 0.2), s = 5;
    ctx.strokeStyle = active ? col : darken(col, 0.7); ctx.lineWidth = 1;
    if (shape === "cube") ctx.strokeRect(top.x - s, top.y - s / 2, s * 2, s);
    else if (shape === "pyramid") poly(ctx, [{ x: top.x, y: top.y - s }, { x: top.x + s, y: top.y + s / 2 }, { x: top.x - s, y: top.y + s / 2 }], null, ctx.strokeStyle);
    else if (shape === "dome") { ctx.beginPath(); ctx.arc(top.x, top.y, s, Math.PI, 0); ctx.stroke(); }
    else { ctx.beginPath(); ctx.ellipse(top.x, top.y, s, s / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (active) circuit(ctx, p, x, y, z + 0.2, shape, col);
  }

  // Pinchos (peligro): roseta de púas
  function spikes(ctx, p, x, y, z, col) {
    const n = 8, rin = 0.07, rout = 0.27, w = 0.1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const bl = p(x + Math.cos(a - w) * rin, y + Math.sin(a - w) * rin, z);
      const br = p(x + Math.cos(a + w) * rin, y + Math.sin(a + w) * rin, z);
      const tip = p(x + Math.cos(a) * rout, y + Math.sin(a) * rout, z + 0.34);
      poly(ctx, [bl, br, tip], col, BLACK);
    }
    poly(ctx, [p(x - 0.06, y, z), p(x + 0.06, y, z), p(x, y, z + 0.5)], col, BLACK);
  }

  // Planta decorativa (abanico de hojas)
  function plant(ctx, p, x, y, z, col) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lx = x + Math.cos(a) * 0.16, ly = y + Math.sin(a) * 0.16;
      poly(ctx, [p(x, y, z), p(lx + 0.05, ly + 0.05, z + 0.1), p(lx, ly, z + 0.5)], col, BLACK);
    }
  }

  // Dron flotante
  function drone(ctx, p, x, y, z, col) {
    const hv = z + 0.6;
    box(ctx, p, x - 0.16, y - 0.16, x + 0.16, y + 0.16, hv, hv + 0.28, col);
    const c = p(x, y, hv + 0.28);
    ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 5); ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(c.x - 1, c.y - 7, 2, 2);
  }

  /* ---- Robot Pocho (color propio fijo; 4 vistas, traseras = espejo) ---- */
  const DIRS = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];
  const ROBOT = { WID: 0.50, DEP: 0.33, H: 1.50 };

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

  return {
    INKS, ROBOT_INK, DIRS, ROBOT, BLACK, darken,
    projector, poly, box, honeycomb, facePt,
    floor, cube, flatWall, door, pillar, circuit, socket, spikes, plant, drone, robot, shadow
  };
})();

if (typeof module !== "undefined") module.exports = AP;
