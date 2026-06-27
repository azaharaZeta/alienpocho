# Idea — Precargar los assets (PNG/SVG) al arrancar

> **Estado: PENDIENTE — Prioridad MEDIA.** Origen: IA, procesado 2026-06-27.

## Qué es
Ahora que los assets migrados se dibujan **solo** desde fichero (sin fallback procedural), mientras cargan
no se dibujan → **parpadeo** en cada recarga. Cargar todas las imágenes **antes** de iniciar el bucle (o una
breve pantalla de carga) para que no falte nada en el primer frame.

## Viabilidad técnica
- **Encaje:** limpio. `AP.drawSprite` ya cachea PNG→SVG; bastaría un paso de **precarga** que recorra el
  registro (`data/assets.js`), dispare la carga de cada `files`, y espere a `Promise.all` antes de arrancar
  `main.js`. El catálogo de qué cargar ya existe (SSOT).
- **Coste:** bajo. **Riesgo:** bajo (no toca física ni painter; sí el arranque/bucle).
- Posible mejora ligada: una **pantalla de carga** breve reutilizando el estado `title`/`screens.js`.

## Conveniencia
Media-alta como **pulido percibido**: el parpadeo se nota en cada recarga (dev) y en el primer arranque
(jugador). Barato y visible.

## Sugerencia
**Mantener.** Implementar precarga por `Promise.all` sobre el registro antes del primer frame; opcional
indicador de carga si tarda.
