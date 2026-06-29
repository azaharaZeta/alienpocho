# Idea — Assets DIRECCIONALES (vista delantera/trasera + 4 orientaciones)

> **Estado: FASES 1-3 HECHAS.** Origen: usuaria (sillas hacia atrás), 2026-06-29.
> Conclusión: viable y barato — confirmado. Implementado: `dir` en placement, `spriteBack` + fichero
> `<id>_back.svg`, flag `mirror` en `drawSprite`, drawer `sprite` direccional.
> - **Fase 1** — silla con vista frontal+trasera (4 orientaciones: front/back × espejo).
> - **Fase 2/3** — `dir` para muebles SIMÉTRICOS no-cuadrados (**mesa**, **cama**): el drawer espeja por eje
>   (`dir 1/3`) y la **huella gira** vía `variants` `axisX`/`axisY` (intercambian w↔l). `world.js` elige la
>   variante por `dir` (`dirVariant`); física/painter/oclusión solo ven la huella, sin cambios. El anti-#2 solo
>   valida la huella base (axisX); `axisY` es el espejo iso EXACTO → garantizado por matemática (sin riesgo de
>   test). Demos en el mapa: cama de CAMAROTES y mesa de TALLER con `dir:1`.
>
> La **regla de espejo** se ramifica en el drawer: asimétrico (con `spriteBack`, silla) → front/back + espejo
> `dir 1/2`; simétrico (mesa/cama) → mismo dibujo + espejo `dir 1/3`.
>
> Tests del oráculo/anti-#2/manifest/ficheros extendidos a la trasera; test de variantes extendido a mesa/cama.
> Pendiente: Fase 4 (unificar la puerta en el sistema genérico). Detalle del modelo abajo.

## Qué se pide
Que un asset pueda orientarse en las 4 direcciones iso, con vista DELANTERA y TRASERA. Caso motor: la
**silla** (necesita dibujo frontal y trasero). Otros (mesa, cama, puerta) tienen dirección pero comparten un
solo dibujo, espejado en 2 de las 4. Y muchos (circuitos, papelera) NO tienen dirección. La dirección debe
ser OPCIONAL.

## Lo que YA tenemos (media implementación hecha)
1. **Mirror horizontal sobre el ancla**: `draw.js` ya voltea sprites con `translate(2*ref.x,0); scale(-1,1)`
   para la pared eje `y` (`flatWall`) y la puerta (`door`). La técnica de espejado iso ESTÁ probada.
2. **`variants` por eje** (`assetFoot/assetBox/assetRef` aceptan `variant`): robot y puerta ya tienen
   `axisX`/`axisY` que **intercambian la huella** (w↔l) y llevan un `state` (p.ej. `{facing:0}`).
3. **Plumbing de estado**: `assetViews` vuelca el `state` de la variante en el placement, y el drawer lo lee
   (el robot dibuja según `t.facing`). Es decir, ya hay un camino "variante → estado en placement → drawer".
4. **Oráculo de píxel + anti-#2** (`test/assets.mjs`) ya validan el blit por asset; habrá que extenderlos a
   "por dirección".

→ Falta poco: un flag de **mirror** en `drawSprite`, un **sprite trasero** opcional, y un **estado `dir`** en
los placements.

## Tu propuesta y sus PUNTOS DÉBILES
Tu modelo: "1 dibujo compartido en 4 direcciones, espejado en 2; las sillas además con dibujo frontal+trasero".
Correcto en lo esencial, pero tiene **dos huecos**:

1. **Falta el intercambio de HUELLA (w↔l).** Espejar el sprite cambia el aspecto, pero NO la huella. Una mesa
   larga en x, al "girar 90°", pasa a ser larga en y → su huella debe intercambiar w↔l (colisión y painter),
   no solo espejarse el dibujo. Si solo espejas, el dibujo y la huella se contradicen. **Ya lo resuelve el
   sistema `variants` (axisX/axisY)** → hay que USARLO, no solo espejar.
2. **"Frontal vs trasero" y "espejado" son DOS ejes independientes**, no uno. En iso, las 4 direcciones son:
   - 0 (+x): FRONTAL, sin espejar.  · 1 (+y): FRONTAL, espejada.
   - 3 (−y): TRASERA, sin espejar.  · 2 (−x): TRASERA, espejada.
   O sea: **frontal/trasera** lo decide si la dirección mira hacia/contra la cámara; **espejar** lo decide si
   mira a izquierda o derecha. Para la silla hacen falta los 2 dibujos; para la mesa (frontal==trasera) basta
   el frontal usado también de "trasera" → coincide con tu "espejado en 2 de las 4".

## Propuesta MEJORADA
Separar limpiamente lo que afecta a CADA subsistema:

- **Huella / orientación** (afecta física, painter, oclusión): vía el sistema `variants` que YA existe
  (`axisX`/`axisY`, intercambian w↔l). Una dirección `dir` ∈ {0,1,2,3} elige la variante de eje
  (0,2→axisX · 1,3→axisY). Para huellas cuadradas (silla, la mayoría) las dos variantes son iguales → no
  hace falta declararlas.
- **Dibujo** (solo render): el asset declara `sprite` (frontal) y, opcional, `spriteBack` (trasera). El drawer
  elige cara y espejo según `dir`:
  | dir | mira a | cara | espejo |
  |----|--------|------|--------|
  | 0 (+x) | abajo-dcha | frontal | no |
  | 1 (+y) | abajo-izq | frontal | sí |
  | 2 (−x) | arriba-izq | trasera* | sí |
  | 3 (−y) | arriba-dcha | trasera* | no |

  *si no hay `spriteBack`, usa el frontal (mesa/cama: frontal==trasera).
- **Estado opcional**: el placement lleva `dir` (def. ausente = 0, no-direccional). Los assets sin dirección
  (circuitos, papelera, bidón, planta) **ignoran todo esto** — cero cambios para ellos.

Así: un asset **no-direccional** = como ahora. Un asset **direccional simétrico** (mesa, cama) = `sprite` +
mirror automático + variante de eje (si no es cuadrado). Una **silla** = `sprite` + `spriteBack` + mirror.

## La matemática (ya validada por puerta/pared)
- Espejo: `ctx.save(); ctx.translate(2*round(ref.x),0); ctx.scale(-1,1); blit(ref.x+minX, ref.y+minY); restore()`.
  El ancla de los `object` cae en la vertical central (offset 0.5,0.5) → espejar mantiene el centrado.
- Huella espejada: para huella cuadrada o tras intercambiar w↔l, la caja-pantalla es simétrica → colisión y
  orden del painter **no cambian** con el espejo (solo cambia el dibujo). Punto clave que mantiene el motor
  intacto.

## Impacto por subsistema
- **draw.js**: `drawSprite(name, ctx, ref, col, mirror=false)` (+1 rama, idéntica a la de la puerta). El drawer
  `sprite` lee `t.dir` → elige `sprite`/`spriteBack` y mirror. Coste: bajo.
- **data/assets.js**: campo `spriteBack` opcional + (reusar `variants` para huella). Coste: bajo.
- **world.js / placements**: propagar `o.dir` al placement (como `shape`/`facing`). Elegir variante de huella
  por `dir`. Coste: bajo.
- **physics / painter / occlusion**: **NINGÚN cambio** — solo ven la huella (vía variante). La dirección del
  dibujo les es transparente. (Gran ventaja: la direccionalidad es casi 100% capa de RENDER + selección de
  variante de huella.)
- **test/assets.mjs**: el oráculo de píxel y anti-#2 deben iterar **por vista** (dir/variante), no por asset.
  Coste: medio (es el grueso del trabajo y donde está el riesgo de regresión).
- **tools/tool-assets.html**: ya muestra una vista por variante (`assetViews`); añadir las vistas frontal/
  trasera/espejada es natural. Coste: bajo.
- **datos del mapa**: `{ asset:"chair", x, y, dir:2 }`. Opt-in, retrocompatible (sin `dir` = como hoy).

## Clasificación de los assets actuales
- **Sin dirección** (1 sprite, sin `dir`): circuitos `prop_*`, papelera, bidón, papeles, planta, flor, caja
  herramientas, contenedor, cubo, pinchos, dron.
- **Direccional simétrico** (1 sprite + mirror + variante de eje si no es cuadrado): mesa, cama, cocina,
  taquilla, estantería, consola, monitor, ordenador, lámpara. (Comparten frontal/trasera.)
- **Direccional con trasera distinta** (`sprite`+`spriteBack`+mirror): **silla** (+ futuros: butaca, cualquier
  asiento/criatura). Cuadrada → sin variante de huella.
- **Puerta**: ya tiene su propio front/back en `render.js`; el sistema genérico podría absorberla a futuro,
  pero **dejarla como está** de momento (es cáscara, no `object`).

## Riesgos
1. **Tests de píxel por vista**: el mayor trabajo y riesgo. Mitigación: derivar el blit espejado del frontal
   (mirror es determinista) y congelar solo el frontal + verificar la fórmula del espejo.
2. **Huellas no cuadradas + espejo + variante**: verificar que (sprite espejado) ⟷ (huella con w↔l) cuadran
   en anti-#2. Mitigación: empezar SOLO por la silla (cuadrada, sin variante) → riesgo casi nulo; añadir
   mesas/camas direccionales después.
3. **Generador**: el `gen_assets.mjs` tendría que emitir `spriteBack` (y, para el roguelike, decidir `dir`).

## Recomendación / plan incremental
**Sí, merece la pena** y encaja con la arquitectura (la dirección es capa de render + variante de huella; el
motor no se toca). Plan por fases, de menor a mayor riesgo:

1. **Silla direccional** (cuadrada, front/back, mirror) — el caso pedido. `drawSprite` con `mirror`,
   `spriteBack` en el registro, `dir` en el placement, SVG `chair_back`. Tests de píxel para las 4 vistas de
   la silla. Sin tocar huellas (cuadrada).
2. **Mirror para direccionales simétricos cuadrados** (sin coste de huella).
3. **Variante de huella por `dir`** para los no-cuadrados (mesa, cama…) — reusando `variants` axisX/axisY.
4. (Opcional) Unificar la puerta en el sistema genérico.

> **Para la silla hacia atrás concreta:** está lista para hacerse en la Fase 1. Dame el OK y lo implemento
> (drawSprite+mirror, `spriteBack`, `dir`, `chair_back.svg`, tests) — es un cambio acotado y de bajo riesgo.
