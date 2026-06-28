# Idea — Juice / feedback (partículas monocromas, flash de zócalo, screen-shake)

> **Estado: PENDIENTE — Prioridad BAJA-MEDIA (pulido de feel).** Origen: IA, procesado 2026-06-28.

## Qué es
Un paquete de micro-feedback visual, todo en la tinta de la sala (sin romper el monocromo):
- **Partículas:** chispas al encajar un circuito en su zócalo, polvo al caer un bloque.
- **Flash/glow del zócalo** al rellenarse **correctamente** (feedback de "acierto" que hoy falta).
- **Screen-shake sutil** (un par de píxeles, decae rápido) al caer un bloque pesado.

## Viabilidad técnica
- **Encaje:** un módulo hoja `fx.js` con un pool de partículas/efectos que [render.js](../../src/render.js)
  pinta como pasada extra. Los **eventos ya existen**: colocar circuito y victoria en [game.js](../../src/game.js),
  caída de móviles en `updateObjects` ([physics.js](../../src/physics.js)). Solo hay que emitir efectos ahí.
- **Flash de zócalo:** el `socket` ya tiene estado lleno/vacío ([data/assets.js](../../src/data/assets.js)); falta
  animar la **transición** (destello al pasar a lleno) — un temporizador en la instancia + el drawer.
- **Coste:** bajo por efecto. **Riesgo:** muy bajo (todo es dibujo encima; no toca física ni orden).

## Conveniencia
Media: de los pulidos que más se "sienten". Mantenerlo **discreto** (pocas partículas, shake mínimo) para no
ensuciar la estética Spectrum. Combina con [[idea-audio]] (mismo evento dispara sonido + partícula).

## Sugerencia
Empezar por el **flash de zócalo al acertar** (el feedback más útil para el puzzle) y crecer desde ahí.
Compartir el disparo de efectos con audio y con [[idea-transicion-flip-screen]] para un feel coherente.
