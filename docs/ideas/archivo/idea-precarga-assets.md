# Idea — Precargar los assets (PNG/SVG) al arrancar

> **Estado: ✅ IMPLEMENTADA (2026-06-28).** Origen: IA. Ver "Resultado" al final.

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

## Resultado (implementación 2026-06-28)
- **`AP.preload()`** ([draw.js](../../src/draw.js)): recorre el registro y arranca la carga de TODOS los
  neutros con fichero (sprites + tile de pared + puerta) por `Promise.all`. Se extrajo `_startLoad(file,def,
  done)` (carga PNG→SVG + cachea en `_raster`) que comparten la carga PEREZOSA (`_neutral`) y la precarga →
  un solo camino de carga. Los tintes por color siguen calculándose al dibujar (síncronos).
- **`main.js`**: lanza `AP.preload()` al arrancar (la pantalla de TÍTULO es procedural y no necesita assets,
  así que se ve al instante mientras carga). No se entra a `"playing"` hasta `assetsReady`; `wantStart`
  recuerda la pulsación si el jugador arranca antes de terminar. Tope de seguridad de 3s
  (`Promise.race`) para no bloquear el arranque si una imagen ni carga ni falla.
- **Resultado:** al entrar a una sala ya están todas las imágenes → sin el parpadeo del primer frame.
  Verificado: `assetsReady` llega a `true` tras el reload y la escena entra completa. `npm test` verde.
- *Nota:* el arranque por tecla no se pudo accionar desde el preview headless (el `requestAnimationFrame`
  se ralentiza con la pestaña en segundo plano); la precarga y el gate se verificaron por estado/áreas.
