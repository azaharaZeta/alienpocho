# Bug — `tryPush` no revalida la nueva posición del robot contra otros sólidos

> **Estado: ABIERTO — teórico, NO reproducido. Prioridad BAJA (verificar antes de abordar).**
> Origen: IA, procesado 2026-06-28.

## Síntoma (teórico)
Al empujar un objeto `movable`, `tryPush` ([player.js](../../src/player.js)) mueve al robot pegado al objeto
**sin revalidar su nueva posición (±`PRAD`) contra OTROS sólidos**: solo valida que el **destino del objeto**
esté libre (`objBlocked`). Riesgo de borde: empujar un objeto estando pegado a una esquina con otro sólido al
costado → el robot podría acabar solapando ese sólido lateral.

## Estado actual (código)
- Empuje en suelo: `player.js` → `tryPush` (valida el destino del objeto con `objBlocked`, mueve robot+objeto).
- **No** comprueba que la celda destino del **robot** (su huella ±`PRAD`) quede libre de otros sólidos.
- **No reproducido** en juego; es un hueco lógico, no un fallo observado.

## Viabilidad / coste de la corrección
- **Encaje:** acotado — tras decidir el empuje, revalidar la posición destino del robot con el mismo predicado
  de colisión que usa el avance normal (huella ±`PRAD` vs `roomSolids`), y abortar el empuje si chocaría.
- **Riesgo:** **toca física/empuje** → **`npm test`** (smoke + painter) obligatorio. Cuidado de no bloquear
  empujes legítimos (el propio objeto empujado no debe contar como sólido que bloquea al robot).
- **Coste:** bajo (pocas líneas), el grueso es **construir un caso límite reproducible** en preview antes de
  tocar nada.

## Sugerencia
**Verificar primero** que el caso es alcanzable (montar una sala con un movable pegado a una esquina y otro
sólido al costado, e intentar el empuje). Si no se reproduce, mantener como nota de robustez de baja
prioridad; si se reproduce, corregir con la revalidación y `npm test`. Relacionado con
[[idea-empujar-objetos-en-salto]] (que añade empuje en el aire → revalidar también ahí).
