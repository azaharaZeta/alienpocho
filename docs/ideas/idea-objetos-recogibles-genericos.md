# Idea — Recogibles genéricos (no solo circuitos) + `name` por asset

> **Estado: PENDIENTE — Prioridad ALTA (enabler).** Origen: usuaria, procesado 2026-06-28.
> Desbloquea el label de objeto recogido de [[idea-rediseno-hud]].

## Qué pide
- Que **no solo se puedan recoger circuitos**, también otros objetos. En concreto: **marcar `computer`
  como recogible**.
- Que **todos los objetos recogibles tengan un nombre** (para mostrarlo en el HUD junto al objeto que llevas).

## Estado actual (código) — el punto fino
El sistema de "llevar" está hoy **atado a la FORMA del circuito**, no a un asset genérico:
- `game.carried` guarda un **`shape`** (string: `"cube"`/`"pyramid"`/…), no un asset id
  ([game.js:21](../../src/game.js), [game.js:47-66](../../src/game.js)).
- Al coger: `game.carried = o.shape` ([game.js:66](../../src/game.js)) — un objeto **sin `shape`** (como
  `computer`) no encaja.
- El HUD dibuja el objeto recogido con `propAsset(shape)` → `"prop_"+shape`
  ([render.js:139](../../src/render.js), [assets.js:226](../../src/data/assets.js)) → solo sabe pintar
  circuitos.
- El zócalo compara `t.requires === game.carried` (un shape) ([game.js:36](../../src/game.js)) y el soltar
  empuja `{…, shape: game.carried}` ([game.js:48](../../src/game.js)).
- `computer` ya es `solid+movable+falls` pero **NO `carriable`** ([assets.js:139-141](../../src/data/assets.js)).
- **No existe** un campo `name` en el registro (hay `label`, pensado para el catálogo de la tool).

## Viabilidad técnica
- **Encaje:** medio. Lo correcto es **generalizar `carried` de `shape` → asset id** (o un objeto
  `{asset, …}`), de modo que llevar un `computer` o un `prop_cube` sea lo mismo. Eso toca:
  - `game.interact` (coger/soltar/encajar) — cambiar la moneda de `shape` a asset id; el zócalo seguiría
    pidiendo por la **forma/id del circuito** (`MISSION.requires`/`requires` se expresan por shape hoy → o
    se migran a asset id, o se mapea shape↔asset en un solo punto, que ya existe: `propAsset`).
  - `render.drawCarrySlot` — pintar el sprite del **asset llevado** (no `propAsset(shape)`), con su `name`.
  - `data/assets.js` — añadir `carriable` a `computer`; añadir un campo **`name`** (nombre visible) a todos
    los `carriable` (los `prop_*` y `computer`). Posible reutilizar `label`, pero `label` es de catálogo:
    mejor un `name` explícito para no acoplar HUD y tool.
- **Riesgo:** **medio** — toca **interacción de objetos** (coger/soltar/encajar) → **`npm test`**
  obligatorio (smoke + mission: el encaje circuito↔zócalo no debe romperse). Cuidado con que el zócalo siga
  validando la forma correcta del circuito tras el cambio de moneda.
- **Coste:** medio. La mayor parte es el refactor del modelo `carried`; añadir `name` y marcar `computer`
  es trivial pero **debe ir junto** (un `computer` recogible sin modelo genérico se rompe en el HUD).
- **Guardarraíl:** si se añade un campo nuevo al registro (`name`), revisar si `test/assets.mjs` debe
  exigirlo para todo `carriable`.

## Conveniencia
**Alta** como **enabler**: alinea con [[alien-pocho-physical-objects]] (objetos físicos como mejora
deliberada) y desbloquea el label del HUD ([[idea-rediseno-hud]]). Abre puzzles nuevos (llevar un
`computer` a un sitio, no solo circuitos a zócalos). No rompe la esencia.

## Decisión de diseño (asumida, no bloqueante)
La usuaria ya marca la dirección: **generalizar** ("no solo circuitos… marca computer como recogible…
todos los recogibles con nombre"). Por eso se propone el refactor `shape → asset id`, no un parche
shape-específico para `computer`. Si la usuaria prefiriera lo mínimo (computer como caso especial), decir.

## Sugerencia
**Mantener; hacerla ANTES o junto al rediseño del HUD.** Pasos:
1. `carried`: de `shape` a asset id (un solo punto de verdad; reusar `propAsset` para el puente
   shape↔asset del circuito/zócalo).
2. `data/assets.js`: `computer` → `carriable`; `name` en todos los `carriable`.
3. `drawCarrySlot`: pintar el asset llevado + su `name`.
4. **`npm test`** (interacción) + recorrer en preview: coger circuito, encajarlo, coger/soltar `computer`.
