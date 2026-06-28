# Idea — Terminales con lore (activar los `computer` ya colocados)

> **Estado: PENDIENTE — Prioridad MEDIA (contenido barato, reusa assets puestos).** Origen: IA, procesado 2026-06-28.

## Qué es
Dar a los `computer` una interacción de **"leer"** que muestre un panel de texto breve (lore, pista o aviso),
con estética Spectrum. Hoy hay **5 ordenadores ya colocados** (NUDO, CRUCE, POZO, VERTEDERO, CISTERNA, ver
[[idea-mas-salas-retos]]) que solo se cogen: esto les da propósito casi gratis.

## Viabilidad técnica
- **Encaje:** un trait `readable` (o reusar la interacción de [game.js](../../src/game.js) sobre `computer`)
  que, en vez de/además de coger, abra un overlay de texto. El texto vive en **datos** (campo en la instancia
  de `rooms.js` o un mapa en una capa de datos nueva), no en lógica.
- **El overlay** reusa el estilo de pantallas: `screens.drawSciFiFrame`/`neonText` ([screens.js](../../src/screens.js)).
  Comparte render con [[idea-pantalla-pausa]] (mismo patrón "congelar + overlay").
- **Coste:** bajo-medio. **Riesgo:** bajo (no toca física ni painter; es estado + dibujo de texto).

## Conveniencia
Alta para el coste: convierte contenido ya presente en narrativa/pistas, refuerza la ambientación *Alien 8*
sin reloj ni combate. Sinergia con [[idea-minimapa-pistas-puzzle]] (las pistas podrían venir de terminales).

## Sugerencia
Decidir si el `computer` es **recogible O legible** (no ambas a la vez puede confundir) o si la "lectura" es
una segunda acción. Empezar con 1-2 terminales con texto y validar el tono antes de escribir todo el lore.
