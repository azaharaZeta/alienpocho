# Idea — Sombra del robot proyectada al suelo

> **Estado: PENDIENTE — Prioridad ALTA (mejor relación impacto/coste).** Origen: IA, procesado 2026-06-28.

## Qué es
Dibujar una **sombra tenue** (rombo/elipse) bajo el robot, sobre la superficie que tiene debajo. En proyección
isométrica es muy difícil juzgar sobre qué celda estás y **dónde aterrizará un salto**; la sombra lo resuelve:
al saltar se separa de los pies → percepción de altura inmediata.

## Viabilidad técnica
- **Encaje:** muy limpio. La altura del suelo bajo el robot ya se calcula (`supportHeight`,
  [physics.js](../../src/physics.js)) y la proyección/huella están en [engine.js](../../src/engine.js) +
  la `aabb` del robot. Dibujar un rombo plano en `(x, y, supportHeight)` con la tinta de la sala oscurecida.
- **Orden:** la sombra es un decal de suelo; se pinta junto al suelo o justo antes que el objeto sobre el que
  cae. No necesita entrar al painter como sólido. **Riesgo:** muy bajo (no toca colisión).
- **Coste:** bajo.

## Conveniencia
**La más alta de la lista por coste.** Mejora la legibilidad de TODO el juego (saltos, bordes, posición) y es
prerequisito de justicia para [[idea-suelo-fragil]] y para cualquier puzzle de plataformeo.

## Sugerencia
**Hacerla pronto.** Empezar con sombra simple (opacidad fija). Posible v2: tamaño/opacidad según altura del
salto para reforzar aún más la sensación de elevación.
