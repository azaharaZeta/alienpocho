/* =============================================================================
   ALIEN POCHO — Biblioteca de ASSETS (estilo Alien 8 fiel)
   -----------------------------------------------------------------------------
   MONOCROMO de verdad: cada sala usa UN solo color de tinta sobre negro, y las
   formas se definen con CONTORNOS NEGROS (teselado limpio). El color cambia por
   pantalla. Las caras en sombra se "oscurecen" con sombreado plano (darken).
   - Paredes: PLANAS y teseladas (panal), no cubos.
   - Puertas/arcos: GRANDES y abiertos.
   - Bloques: figuras con bordes "mordidos" (chaflanes), no cubos exactos.
   - El robot mantiene su propio color (azul), visible en cualquier sala.
   Uso:  AP.<asset>(ctx, p, ..., col)   con p = AP.projector(ox, oy)
   ============================================================================= */
const AP = (() => {

  // Primitivas genéricas del motor (proyección, cajas, panal, painter…).
  // En navegador `ENGINE` es un global léxico (engine.js se carga antes); en Node se requiere.
  const ENG = (typeof ENGINE !== "undefined") ? ENGINE : require("./engine.js");
  const { BLACK, darken, lighten, projector, poly, facePt, edgeLine, box, honeycomb } = ENG;

  // Colores de tinta por pantalla (como las distintas salas del original)
  const INKS = ["#36c8ff", "#d7d98a", "#e070c5", "#79e6a6", "#ff9d5c", "#b9a6ff"];
  const ROBOT_INK = "#6fd0ff";   // el robot siempre azul claro

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
  const DOOR = { T: 0.34, POST_W: 0.40, LINTEL_H: 0.46 };
  const doorInset = (fixed) => (fixed < 0.5) ? [fixed, fixed + DOOR.T] : [fixed - DOOR.T, fixed];
  // Ranura de panel: línea NEGRA (recodo iso) + filo claro encima = bisel.
  function _groove(ctx, p, x0, y0, x1, y1, z, col) {
    edgeLine(ctx, p, x0, y0, x1, y1, z + 0.03, lighten(col, 0.4), 1);  // filo claro = bisel
    edgeLine(ctx, p, x0, y0, x1, y1, z, BLACK, 1);                     // ranura negra
  }
  // Hueco negro de la puerta (solo puertas de FONDO)
  function doorHole(ctx, p, axis, fixed, a0, a1, H, col) {
    const w = DOOR.POST_W, l = H - DOOR.LINTEL_H;
    if (axis === "x") poly(ctx, [p(a0 + w, fixed, l), p(a1 - w, fixed, l), p(a1 - w, fixed, 0), p(a0 + w, fixed, 0)], BLACK, null);
    else              poly(ctx, [p(fixed, a0 + w, l), p(fixed, a1 - w, l), p(fixed, a1 - w, 0), p(fixed, a0 + w, 0)], BLACK, null);
  }
  // Un POSTE (huella a lo largo del eje del vano: [s0,s1]); con ranuras sci-fi.
  function doorPost(ctx, p, axis, fixed, s0, s1, H, col) {
    const [d0, d1] = doorInset(fixed), zG = [H * 0.26, H * 0.5, H * 0.74];
    if (axis === "x") { box(ctx, p, s0, d0, s1, d1, 0, H, col); for (const z of zG) _groove(ctx, p, s0, d0, s1, d1, z, col); }
    else              { box(ctx, p, d0, s0, d1, s1, 0, H, col); for (const z of zG) _groove(ctx, p, d0, s0, d1, s1, z, col); }
  }
  // El DINTEL (viga superior) con su ranura.
  function doorLintel(ctx, p, axis, fixed, a0, a1, H, col) {
    const [d0, d1] = doorInset(fixed), z0 = H - DOOR.LINTEL_H;
    if (axis === "x") { box(ctx, p, a0, d0, a1, d1, z0, H, col); _groove(ctx, p, a0, d0, a1, d1, z0 + 0.10, col); }
    else              { box(ctx, p, d0, a0, d1, a1, z0, H, col); _groove(ctx, p, d0, a0, d1, a1, z0 + 0.10, col); }
  }
  // Puerta completa (las de FONDO se dibujan como unidad: hueco + postes + dintel).
  function door(ctx, p, axis, fixed, a0, a1, H, col, hole) {
    if (hole) doorHole(ctx, p, axis, fixed, a0, a1, H, col);
    doorPost(ctx, p, axis, fixed, a0, a0 + DOOR.POST_W, H, col);
    doorPost(ctx, p, axis, fixed, a1 - DOOR.POST_W, a1, H, col);
    doorLintel(ctx, p, axis, fixed, a0, a1, H, col);
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
      const ap = p(x, y, z + 0.5);   // medio bloque, como el resto de objetos
      const b1 = p(x - r, y - r, z), b2 = p(x + r, y - r, z), b3 = p(x + r, y + r, z), b4 = p(x - r, y + r, z);
      // Orden de pintado atrás→delante: las dos caras TRASERAS (-x,-y) primero y
      // las dos FRONTALES (+x,+y, que comparten la arista delantera b3) encima.
      poly(ctx, [b1, b2, ap], darken(col, 0.45), BLACK);   // trasera (-y)
      poly(ctx, [b1, b4, ap], darken(col, 0.45), BLACK);   // trasera (-x)
      poly(ctx, [b4, b3, ap], col, BLACK);                 // frontal izquierda (+y), iluminada
      poly(ctx, [b2, b3, ap], darken(col, 0.62), BLACK);   // frontal derecha (+x)
    } else if (shape === "dome") {
      // Semiesfera de CRISTAL transparente: relleno muy tenue (se ve a través), aro de
      // base completo (trasera visible), contorno del casquete y brillo especular.
      const rr = 0.34, c = p(x, y, z), rx = rr * p.TW / 2, ry = rr * p.TH / 2, dh = 0.5 * p.BH;   // alto = medio bloque
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
      const ch = 0.5, topC = p(x, y, z + ch), botC = p(x, y, z), rx = r * p.TW / 2, ry = r * p.TH / 2;
      ctx.beginPath(); ctx.moveTo(topC.x - rx, topC.y); ctx.lineTo(botC.x - rx, botC.y);
      ctx.ellipse(botC.x, botC.y, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(topC.x + rx, topC.y); ctx.closePath();
      ctx.fillStyle = darken(col, 0.7); ctx.fill();
      ctx.strokeStyle = BLACK; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(topC.x, topC.y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = BLACK; ctx.stroke();
    }
  }

  // OBJETO FÍSICO transportable: SE DIBUJA COMO LA FIGURA DEL CIRCUITO (sin base ni
  // pedestal). Es SÓLIDO en el juego (se empuja, se sube uno encima, se apila); su
  // caja física —HALF/H— se ajusta al tamaño visible de la figura.
  const PROP = { HALF: 0.28, H: 0.5 };   // todos los objetos miden MEDIO bloque de alto
  function prop(ctx, p, x, y, z, shape, col) {
    circuit(ctx, p, x, y, z, shape, col);
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
    INKS, ROBOT_INK, DIRS, ROBOT, BLACK, DOOR, darken, lighten,
    projector, poly, box, honeycomb, facePt, edgeLine,
    floor, cube, flatWall, door, doorHole, doorPost, doorLintel,
    pillar, circuit, prop, PROP, socket, spikes, plant, drone, robot, shadow
  };
})();

if (typeof module !== "undefined") module.exports = AP;
