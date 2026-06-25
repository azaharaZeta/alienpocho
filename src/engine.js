/* =============================================================================
   ALIEN POCHO — MOTOR ISO genérico (engine.js)
   -----------------------------------------------------------------------------
   Primitivas reutilizables: proyección isométrica 2:1, dibujo de polígonos y
   cajas, y el ORDEN DE PINTADO por cajas (painter topológico). Genérico: no
   sabe de salas, robot ni circuitos. Módulo HOJA. Expone el objeto `ENGINE`.
   ============================================================================= */
"use strict";

export const ENGINE = (() => {

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

  // Caja iso con sombreado plano: techo en el tono base, caras más oscuras,
  // contornos negros.
  function box(ctx, p, x0, y0, x1, y1, z0, z1, col) {
    const A = p(x0, y0, z1), B = p(x1, y0, z1), C = p(x1, y1, z1), D = p(x0, y1, z1);
    const Bb = p(x1, y0, z0), Cb = p(x1, y1, z0), Db = p(x0, y1, z0);
    poly(ctx, [A, B, C, D], col, BLACK);                  // techo (iluminado)
    poly(ctx, [B, C, Cb, Bb], darken(col, 0.62), BLACK);  // cara derecha (+x): sombra
    poly(ctx, [D, C, Cb, Db], darken(col, 0.82), BLACK);  // cara izquierda (+y): media
  }


  /* ---- ORDEN DE PINTADO: painter por cajas (escena isométrica correcta) ----
     Cada objeto es una caja 3D [x0,y0,z0]–[x1,y1,z1]. Con la cámara en la esquina (+,+,+),
     una caja está DETRÁS de otra cuando un plano perpendicular a un eje las separa y ella
     queda del lado lejano (menor x, o menor y, o menor z). Esa relación (`order`) es un orden
     PARCIAL: solo opina cuando la oclusión es inequívoca. Un orden topológico determinista
     (Kahn + clave canónica) lo extiende a la secuencia completa. Devuelve las cajas ordenadas.
        -1: A va antes (detrás)   +1: B va antes   0: ambiguo (lo zanja la clave canónica).
     Solo se ordenan pares que SE SOLAPAN EN PANTALLA (por SILUETA hexagonal exacta, no por AABB):
     aristas entre cajas que no se tapan serían espurias y podrían crear ciclos. El gateo necesita
     el proyector `p` (usa TH/BH).
     Detalle del algoritmo: docs/ARQUITECTURA.md. */
  function depthSort(boxes, p) {
    const n = boxes.length, E = 1e-6;
    // Oclusión inequívoca por separación de ejes (mismo epsilon en los tres → tolera caras
    // coplanares simétricamente). A está DETRÁS si cae al lado lejano de B por algún eje; B
    // detrás si cae al lado lejano de A. Solo decide cuando se cumple una sola dirección; si
    // ambas (contradictorio) o ninguna (interpenetración) → 0 (ambiguo), lo zanja la clave.
    const order = (A, B) => {
      const aBehind = A.x1 <= B.x0 + E || A.y1 <= B.y0 + E || A.z1 <= B.z0 + E;
      const bBehind = B.x1 <= A.x0 + E || B.y1 <= A.y0 + E || B.z1 <= A.z0 + E;
      if (aBehind && !bBehind) return -1;    // A detrás (inequívoco) → A se pinta antes
      if (bBehind && !aBehind) return  1;    // B detrás (inequívoco) → B se pinta antes
      return 0;                              // ambiguo (contradictorio o interpenetrado)
    };
    // SILUETA iso (hexágono) de cada caja: sus extensiones en los TRES ejes del hexágono (normales a
    // sus aristas: la vertical de pantalla + las dos diagonales). Dos cajas se solapan EN PANTALLA sii
    // sus siluetas se solapan en los TRES ejes (SAT: con la misma proyección, 3 ejes bastan → exacto).
    // El AABB de pantalla, en cambio, mete un 4º eje espurio (la extensión vertical, que NO es arista del
    // hexágono) y deja pasar pares que no se tocan → aristas de precedencia falsas → ciclos falsos. Solo
    // dependen de TH/BH (el TW se cancela como factor común de los tres ejes).
    let sil = null;
    if (p) {
      const TH = p.TH, BH = p.BH;
      sil = boxes.map(b => ({
        a0: b.x0 - b.y1,            a1: b.x1 - b.y0,            // eje vertical de pantalla:  x − y
        b0: BH * b.z0 - TH * b.y1,  b1: BH * b.z1 - TH * b.y0,  // diagonal:                  z·BH − y·TH
        c0: TH * b.x0 - BH * b.z1,  c1: TH * b.x1 - BH * b.z0,  // diagonal:                  x·TH − z·BH
      }));
    }
    const overlapScr = (i, j) => !sil || (
      sil[i].a0 < sil[j].a1 && sil[i].a1 > sil[j].a0 &&
      sil[i].b0 < sil[j].b1 && sil[i].b1 > sil[j].b0 &&
      sil[i].c0 < sil[j].c1 && sil[i].c1 > sil[j].c0);
    // Grafo de precedencia: adj[i] = cajas que van DESPUÉS de i (i se pinta antes = detrás).
    const adj = Array.from({ length: n }, () => []);
    const indeg = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!overlapScr(i, j)) continue;       // no se tapan en pantalla → orden irrelevante
      const o = order(boxes[i], boxes[j]);
      if (o < 0) { adj[i].push(j); indeg[j]++; }       // i antes que j
      else if (o > 0) { adj[j].push(i); indeg[i]++; }  // j antes que i
    }
    // Clave canónica de desempate (orden total por geometría) que usa Kahn entre las cajas
    // listas. cmp(a,b)<0 ⇒ a va antes (más al fondo). Manda primero el CENTRO-Z: la caja más
    // baja se pinta antes y la más alta queda delante (el robot tapa al zócalo/objeto bajo de
    // su misma celda). Tras el centro-z, profundidad de suelo y demás coords solo para que el
    // orden sea TOTAL y determinista.
    const cmp = (a, b) => {
      const A = boxes[a], B = boxes[b];
      return (A.z0 + A.z1) - (B.z0 + B.z1) || (A.x0 + A.y0) - (B.x0 + B.y0)
           || A.z0 - B.z0 || A.x0 - B.x0 || A.y0 - B.y0 || A.x1 - B.x1 || A.y1 - B.y1;
    };
    // Orden topológico determinista (Kahn): cada paso emite la caja de grado 0 (sin nadie
    // detrás) más al fondo según la clave. Si ninguna tiene grado 0 hay un ciclo de oclusión
    // real → se rompe forzando la de MENOR grado de entrada, luego la clave.
    const done = new Array(n).fill(false), out = [];
    for (let k = 0; k < n; k++) {
      let best = -1;
      for (let i = 0; i < n; i++)
        if (!done[i] && indeg[i] === 0 && (best < 0 || cmp(i, best) < 0)) best = i;
      if (best < 0)                          // ciclo: forzar la menos restringida (determinista)
        for (let i = 0; i < n; i++)
          if (!done[i] && (best < 0 || indeg[i] < indeg[best] || (indeg[i] === indeg[best] && cmp(i, best) < 0))) best = i;
      done[best] = true; out.push(best);
      for (const j of adj[best]) if (!done[j]) indeg[j]--;
    }
    return out.map(i => boxes[i]);
  }

  return { BLACK, darken, lighten, projector, poly, facePt, edgeLine, box, depthSort };
})();
