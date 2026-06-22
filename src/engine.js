/* =============================================================================
   ALIEN POCHO — MOTOR ISO genérico (engine.js)
   -----------------------------------------------------------------------------
   Primitivas reutilizables: proyección isométrica 2:1, dibujo de polígonos y
   cajas, teselado de paredes y el ORDEN DE PINTADO por cajas (painter topológico).
   No sabe nada de salas, robot ni circuitos: eso vive en assets.js / game.js.
   Módulo HOJA (no importa nada). Expone el objeto `ENGINE`.
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
     Cada objeto es una caja 3D [x0,y0,z0]–[x1,y1,z1]. Con la cámara en la esquina (+,+,+),
     una caja está DETRÁS de otra cuando un PLANO perpendicular a un eje las separa y ella
     queda del lado lejano (menor x, o menor y, o menor z). Esa relación de separación
     (`order`, abajo) es un orden PARCIAL: solo opina cuando la oclusión es inequívoca.
     Un orden topológico DETERMINISTA (Kahn, eligiendo por una clave canónica) lo extiende
     a la secuencia completa de pintado. Devuelve las cajas ya ordenadas. `order`:
        -1: A va antes (detrás)   +1: B va antes   0: ambiguo (lo zanja la clave canónica).

     DETERMINISMO: el orden es función del CONJUNTO de cajas, no del orden en que llegan
     (antes, un DFS dependía de la inserción → el mismo escenario podía pintarse distinto y
     causar parpadeo). Aquí Kahn emite primero las cajas SIN nadie detrás (las más al fondo)
     eligiendo por la clave canónica → resultado estable.

     CICLOS: el gating por pantalla (abajo) elimina los ciclos ESPURIOS, pero la oclusión
     cíclica REAL (3+ cajas que se tapan en anillo) existe y NINGÚN orden la resuelve. Antes
     el DFS la rompía de forma muda y según la inserción; ahora, si Kahn se queda sin cajas de
     grado 0, se ROMPE el ciclo forzando la de MENOR grado de entrada (menos aristas "detrás"
     violadas), desempatando por la clave → degradación acotada y determinista.

     CLAVE anti-CICLOS espurios: solo se ordenan los pares que SE SOLAPAN EN PANTALLA. El orden
     de dos cajas que no se solapan en pantalla es irrelevante; crear aristas entre
     ellas (p. ej. el robot asomado a un borde y un cubo lejano que no tapa) mete
     aristas espurias que forman ciclos y hacen que el pintor viole un "detrás" real.
     Para gatear necesitamos el proyector `p` (TW/TH/BH); sin él, no se gatea. */
  function depthSort(boxes, p) {
    const n = boxes.length, E = 1e-6;
    // Relación de oclusión INEQUÍVOCA por SEPARACIÓN de ejes (mismo epsilon en los tres:
    // tolera caras coplanares de forma simétrica). A está DETRÁS si cae al lado lejano de B
    // por algún eje (x/y/z); B detrás si cae al lado lejano de A. Solo es decisiva cuando una
    // sola dirección se cumple: si AMBAS (separación contradictoria: delante por un eje, detrás
    // por otro) o NINGUNA (se interpenetran) el orden es AMBIGUO → 0 (sin arista) y lo zanja la
    // clave canónica del topo-sort. Antes esto se forzaba jerárquico (x→y→z) y un desempate por
    // centro-Z; pero decidir un par ambiguo metía aristas que falseaban un "detrás" REAL de otro
    // par. Mejor no opinar de lo ambiguo y dejar que el orden global (Kahn + clave) lo resuelva.
    const order = (A, B) => {
      const aBehind = A.x1 <= B.x0 + E || A.y1 <= B.y0 + E || A.z1 <= B.z0 + E;
      const bBehind = B.x1 <= A.x0 + E || B.y1 <= A.y0 + E || B.z1 <= A.z0 + E;
      if (aBehind && !bBehind) return -1;    // A detrás (inequívoco) → A se pinta antes
      if (bBehind && !aBehind) return  1;    // B detrás (inequívoco) → B se pinta antes
      return 0;                              // ambiguo (contradictorio o interpenetrado)
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
    // Grafo de precedencia: adj[i] = cajas que van DESPUÉS de i (i se pinta antes = detrás).
    const adj = Array.from({ length: n }, () => []);
    const indeg = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!overlapScr(i, j)) continue;       // no se tapan en pantalla → orden irrelevante
      const o = order(boxes[i], boxes[j]);
      if (o < 0) { adj[i].push(j); indeg[j]++; }       // i antes que j
      else if (o > 0) { adj[j].push(i); indeg[i]++; }  // j antes que i
    }
    // Clave canónica de DESEMPATE (orden total por geometría) que usa Kahn entre las cajas listas
    // (las que no tienen ninguna relación de oclusión entre sí: o no se solapan en pantalla, o se
    // INTERPENETRAN). cmp(a,b)<0 ⇒ a va antes (más al fondo). Para el caso que importa —dos cajas en
    // el MISMO espacio, p. ej. el robot pisando la celda de un zócalo/objeto— manda primero el CENTRO-Z:
    // la caja más BAJA (menor centro-z) se pinta antes y la más ALTA queda DELANTE (el robot, alto, tapa
    // al zócalo/objeto bajo). Sin esto, ordenar por suelo (x0+y0) volteaba el orden según la posición
    // sub-celda del robot (zócalo dibujándose sobre el robot al entrar por detrás de la celda). Después
    // del centro-z, profundidad de suelo y el resto de coords solo para que el orden sea TOTAL (determinista).
    const cmp = (a, b) => {
      const A = boxes[a], B = boxes[b];
      return (A.z0 + A.z1) - (B.z0 + B.z1) || (A.x0 + A.y0) - (B.x0 + B.y0)
           || A.z0 - B.z0 || A.x0 - B.x0 || A.y0 - B.y0 || A.x1 - B.x1 || A.y1 - B.y1;
    };
    // Orden topológico DETERMINISTA (Kahn): cada paso emite la caja de grado 0 (sin nadie
    // detrás) más al fondo según la clave. Si NINGUNA tiene grado 0 hay un ciclo de oclusión
    // REAL → se rompe forzando la de MENOR grado (menos "detrás" violados), luego la clave.
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

  return { BLACK, darken, lighten, projector, poly, facePt, edgeLine, box, honeycomb, depthSort };
})();
