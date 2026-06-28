# Idea — Transición animada al cambiar de sala (flip-screen)

> **Estado: PENDIENTE — Prioridad BAJA-MEDIA (juice + legibilidad de mapa).** Origen: IA, procesado 2026-06-28.

## Qué es
Al cruzar una puerta, en vez de corte seco, un **deslizamiento corto** de la cámara en la dirección de la
puerta (o un fundido breve). Refuerza la topología del mapa (entiendes hacia dónde te moviste) y da empaque
sin traicionar el flip-screen (sigue siendo una sala por pantalla, solo se anima el relevo).

## Viabilidad técnica
- **Encaje:** el cambio de sala vive en `checkExits` ([game.js](../../src/game.js)) y el proyector se
  recalcula por sala (`view.projectorFor`, [view.js](../../src/view.js)). El bucle ya es **delta-time**
  ([main.js](../../src/main.js)), así que cabe un estado transitorio "transicionando" que interpole el offset
  de cámara (o mezcle dos renders) durante ~0.2 s.
- **Coste:** medio (un estado más en la máquina + interpolación; cuidar que el input se ignore durante la
  transición). **Riesgo:** bajo-medio (no toca física; sí el flujo de estados — probar entradas/salidas).

## Conveniencia
Media: es pulido, pero de los que más se notan. Encaja con la esencia (no es scroll libre, sigue siendo
pantalla a pantalla).

## Sugerencia
Empezar por la opción más simple y segura: **fundido corto** (más fácil que interpolar dos proyecciones). Si
convence, evolucionar a slide direccional. Pulido tardío, junto a [[idea-juice-feedback]].
