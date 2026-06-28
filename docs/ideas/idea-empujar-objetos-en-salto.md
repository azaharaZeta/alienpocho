# Idea — Empujar objetos en mitad de un salto

> **Estado: PENDIENTE — Prioridad MEDIA.** Origen: usuaria, procesado 2026-06-27.

## Qué pide
Que el robot pueda **empujar** los objetos movables con los que se encuentra **mientras salta**, no solo
cuando avanza en el suelo.

## Estado actual (código)
- En el **suelo** ([player.js:117-124](../../src/player.js)): si avanzar choca, se intenta `tryPush` →
  empuja el objeto `movable` que tiene delante.
- En el **aire** ([player.js:133-137](../../src/player.js)): solo se comprueba `blocksHoriz`; si choca, el
  robot simplemente **no avanza** en ese eje. **No** se llama a `tryPush` → el objeto bloquea pero no se
  empuja.

## Viabilidad técnica
- **Encaje:** acotado. En la rama aérea, cuando `blocksHoriz` frene, intentar `tryPush` igual que en suelo
  (mismo helper). Decisión de diseño: ¿empuja igual de fuerte en el aire?, ¿solo si el objeto está a la
  altura del pie? `tryPush` ya recibe `feetZ`, así que respeta la altura.
- **Riesgo:** medio. **Toca física/movimiento** → **`npm test`** (oráculo painter + empuje/caída). Cuidado
  con casos raros: empujar un objeto al que luego caes encima, o empujar contra una pared en el aire.
- **Coste:** bajo (pocas líneas), el coste real es probar los casos límite en preview.

## Conveniencia
Media. Coherencia de mecánica (si empujo andando, ¿por qué no rozando en salto?) y abre puzzles
(empujar al vuelo). No es imprescindible, pero es barato y "se siente bien". Encaja con la esencia
(mecánica de empuje ya es mejora deliberada, ver [[alien-pocho-physical-objects]]).

## Sugerencia
**Mantener.** Implementar reusando `tryPush` en la rama aérea, y **afinar jugando** si el empuje en salto
debe ser más débil o condicionado. Verificar en preview los casos límite.

> **Relacionado:** [[bug-empuje-revalida-robot]] — `tryPush` no revalida la posición destino del robot contra
> otros sólidos. Si se aborda este empuje en el aire, conviene revalidar también ahí (mismo helper).
