/* =============================================================================
   ALIEN POCHO — MOTOR ISO genérico (sin nada específico del juego)
   -----------------------------------------------------------------------------
   Primitivas reutilizables: proyección isométrica 2:1, dibujo de polígonos y
   cajas, teselado de paredes y el ORDEN DE PINTADO por cajas (painter topológico).
   No sabe nada de salas, robot ni circuitos: eso vive en assets.js / game.js.
   Uso en navegador: se carga ANTES que assets.js; expone el global `ENGINE`.
   ============================================================================= */
const ENGINE = (() => {

  const BLACK = "#000000";

  /* ---- utilidades de color ---- */
  // Oscurece multiplicando cada canal por f (0 = negro, 1 = igual).
  function darken(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  }
  // Aclara hacia el blanco una fracción f (0 = igual, 1 = blanco).
  function lighten(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(c + (255 - c) * f);
    return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
  }

  /* ---- proyección iso: p(x,y,z) -> {x,y} ---- */
  function projector(ox, oy, opt = {}) {
    const TW = opt.TILE_W ?? 32, TH = opt.TILE_H ?? 16, BH = opt.BLOCK_H ?? 16;
    const p = (x, y, z = 0) => ({ x: ox + (x - y) * (TW / 2), y: oy + (x + y) * (TH / 2) - z * BH });
    p.TW = TW; p.TH = TH; p.BH = BH; return p;
  }

  /* ---- helpers de dibujo ---- */
  function poly(ctx, pts, fill, stroke, lw = 1) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  // Punto bilineal dentro de una cara [TL,TR,BR,BL] en coords (u,v) ∈ [0,1].
  function facePt(L, u, v) {
    return {
      x: (L[0].x * (1 - u) + L[1].x * u) * (1 - v) + (L[3].x * (1 - u) + L[2].x * u) * v,
      y: (L[0].y * (1 - u) + L[1].y * u) * (1 - v) + (L[3].y * (1 - u) + L[2].y * u) * v
    };
  }
  // Línea horizontal que recorre las DOS caras frontales (+x y +y) de una caja de
  // huella [x0,y0]-[x1,y1] a la altura z. Sigue la perspectiva iso (recodo en la
  // arista delantera). Útil para ranuras de panel sobre postes/dinteles.
  function edgeLine(ctx, p, x0, y0, x1, y1, z, col, lw) {
    const a = p(x1, y0, z), b = p(x1, y1, z), c = p(x0, y1, z);
    ctx.strokeStyle = col; ctx.lineWidth = lw || 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }

  // Caja iso: tinta con SOMBREADO PLANO suave (caras un poco más oscuras, mismo
  // tono) y contornos negros. Limpio, sin puntos.
  function box(ctx, p, x0, y0, x1, y1, z0, z1, col) {
    const A = p(x0, y0, z1), B = p(x1, y0, z1), C = p(x1, y1, z1), D = p(x0, y1, z1);
    const Bb = p(x1, y0, z0), Cb = p(x1, y1, z0), Db = p(x0, y1, z0);
    poly(ctx, [A, B, C, D], col, BLACK);                  // techo (iluminado)
    poly(ctx, [B, C, Cb, Bb], darken(col, 0.62), BLACK);  // cara derecha (+x): sombra
    poly(ctx, [D, C, Cb, Db], darken(col, 0.82), BLACK);  // cara izquierda (+y): media
  }

  // Panal HEXAGONAL sobre una cara plana [TL,TR,BR,BL]. Dibuja SOLO hexágonos
  // COMPLETOS (relleno `col` + borde negro de junta); donde un hexágono no cabe entero
  // se deja NEGRO (el fondo de la pared). Así nunca hay medias celdas ni picos sueltos.
  // R = radio del hexágono en píxeles.
  function honeycomb(ctx, L, R, col) {
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
    ctx.fillStyle = col; ctx.strokeStyle = BLACK; ctx.lineWidth = 1;
    // "FLAT-TOP": el hexágono se asienta en su BASE (lado plano arriba/abajo), no en un
    // pico. Tesela en COLUMNAS desplazadas media celda en vertical.
    const colS = 1.5 * R, rowS = Math.sqrt(3) * R, ht = rowS / 2, eps = 0.5, botCut = 3;
    // ARRIBA: cada columna empieza con su lado plano en/bajo el borde superior → no se corta
    // arriba (el hueco queda negro). ABAJO y LATERALES: sí se cortan (el clip recorta), pero
    // si de un hexágono solo asomara una tira < botCut px contra el suelo, no se dibuja
    // (evita la línea fina de 1-2px del "siguiente" hexágono al pie de la pared).
    for (let i = 0, a = -colS; a - R < wPx + eps; a += colS, i++) {
      if (a + R < -eps) continue;            // columna totalmente fuera por la izquierda
      const voff = (i & 1) ? ht : 0;         // columnas alternas, bajadas media celda
      for (let b = ht + voff; b - ht < hPx - botCut; b += rowS) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = Math.PI / 180 * (60 * k);
          const s = toS(a + Math.cos(ang) * R, b + Math.sin(ang) * R);
          if (k === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---- ORDEN DE PINTADO: painter por cajas (escena isométrica correcta) ----
     Cada objeto es una caja 3D [x0,y0,z0]–[x1,y1,z1]. Con la cámara mirando desde
     la esquina (+,+,+), la PROFUNDIDAD de oclusión la fija la distancia en el SUELO:
     más x o más y = más cerca (delante). La altura Z solo sube el sprite en pantalla;
     NO acerca a la cámara, así que solo desempata cuando dos cajas comparten columna.
     Por eso el orden es JERÁRQUICO x → y → z, no un OR simétrico de los tres ejes
     (que se contradice en escaleras que ascienden hacia el espectador y deja pares
     sin ordenar). `order` es decisivo y antisimétrico:
        -1: A va antes (detrás)   +1: B va antes   0: misma columna y altura (empate).
     Esto define un orden parcial; un orden topológico (DFS post-orden invertido) da
     la secuencia de pintado. Devuelve las cajas ya ordenadas.

     CLAVE anti-CICLOS: solo se ordenan los pares que SE SOLAPAN EN PANTALLA. El orden
     de dos cajas que no se solapan en pantalla es irrelevante; crear aristas entre
     ellas (p. ej. el robot asomado a un borde y un cubo lejano que no tapa) mete
     aristas espurias que forman ciclos y hacen que el pintor viole un "detrás" real.
     Para gatear necesitamos el proyector `p` (TW/TH/BH); sin él, no se gatea. */
  function depthSort(boxes, p) {
    const n = boxes.length, E = 1e-6;
    // Mismo epsilon en los tres ejes: tolera caras coplanares por float de forma simétrica.
    const order = (A, B) => {
      if (A.x1 <= B.x0 + E) return -1;       // A estrictamente detrás en x
      if (B.x1 <= A.x0 + E) return  1;       // B detrás en x
      if (A.y1 <= B.y0 + E) return -1;       // A detrás en y
      if (B.y1 <= A.y0 + E) return  1;       // B detrás en y
      if (A.z1 <= B.z0 + E) return -1;       // misma huella: A más bajo → detrás
      if (B.z1 <= A.z0 + E) return  1;       // misma huella: B más bajo → detrás
      // Solape total (misma celda y altura): el pintor no puede ser perfecto, pero
      // un DESEMPATE determinista evita orden indefinido (objeto saltando sobre el
      // robot). Va último (delante) el de mayor centro Z, luego el de más profundidad.
      const za = A.z0 + A.z1, zb = B.z0 + B.z1;
      if (za !== zb) return za < zb ? -1 : 1;
      const da = A.x0 + A.x1 + A.y0 + A.y1, db = B.x0 + B.x1 + B.y0 + B.y1;
      if (da !== db) return da < db ? -1 : 1;
      return 0;
    };
    // AABB de cada caja proyectada a pantalla (los extremos caen en esquinas opuestas).
    let scr = null;
    if (p) {
      const TW = p.TW, TH = p.TH, BH = p.BH;
      scr = boxes.map(b => ({
        x0: (b.x0 - b.y1) * TW / 2, x1: (b.x1 - b.y0) * TW / 2,
        y0: (b.x0 + b.y0) * TH / 2 - b.z1 * BH, y1: (b.x1 + b.y1) * TH / 2 - b.z0 * BH
      }));
    }
    const overlapScr = (i, j) => !scr ||
      (scr[i].x0 < scr[j].x1 && scr[i].x1 > scr[j].x0 && scr[i].y0 < scr[j].y1 && scr[i].y1 > scr[j].y0);
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!overlapScr(i, j)) continue;       // no se tapan en pantalla → orden irrelevante
      const o = order(boxes[i], boxes[j]);
      if (o < 0) adj[i].push(j);             // i antes que j
      else if (o > 0) adj[j].push(i);        // j antes que i
    }
    const state = new Array(n).fill(0), out = [];
    const visit = (i) => { state[i] = 1; for (const j of adj[i]) if (state[j] === 0) visit(j); state[i] = 2; out.push(i); };
    for (let i = 0; i < n; i++) if (state[i] === 0) visit(i);
    out.reverse();
    return out.map(i => boxes[i]);
  }

  return { BLACK, darken, lighten, projector, poly, facePt, edgeLine, box, honeycomb, depthSort };
})();

if (typeof module !== "undefined") module.exports = ENGINE;
