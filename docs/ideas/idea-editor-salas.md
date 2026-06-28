# Idea — Editor de salas in-browser (genera `rooms.js`)

> **Estado: PENDIENTE — Prioridad BAJA (alto coste, alto retorno si hay mucho contenido).** Origen: IA, procesado 2026-06-28.

## Qué es
Una herramienta de desarrollo (como [tools/tool-assets.html](../../tools/tool-assets.html)) para **colocar
salas, objetos, circuitos y zócalos visualmente** y exportar `data/rooms.js` (y/o el bloque de
`data/mission.js`). Multiplica la velocidad de creación de contenido.

## Viabilidad técnica
- **Encaje:** muy favorable por tu SSOT. `rooms.js`/`mission.js`/`assets.js` son **datos puros**; un editor solo
  necesita leer el registro de assets (geometría, traits) y escupir las mismas estructuras de datos. Reusa
  [engine.js](../../src/engine.js)/[draw.js](../../src/draw.js) para previsualizar en iso real.
- **Es tooling, NO juego** (ver memoria [[alien-pocho-tools-not-game]]): vive en `tools/`, no toca el runtime.
- **Debe respetar invariantes del mapa al exportar:** dims PARES y vanos de puerta libres
  ([[alien-pocho-modular-walls-doors]], [[alien-pocho-map-door-clearance]]) — idealmente validándolos en la UI.
- **Coste:** alto (UI de edición + serialización + validación). **Riesgo:** bajo para el juego (aislado), medio
  en esfuerzo.

## Conveniencia
Baja si vas a hacer pocas salas; **alta** si [[idea-mas-salas-retos]] crece mucho. Es una inversión.

## Sugerencia
No abordar hasta confirmar que vas a producir bastante contenido. Si se hace, integrar el
[[idea-validador-solubilidad]] en el propio editor (aviso en vivo de "puzzle irresoluble"). Empezar por
**editor de colocación** sobre salas existentes antes que crear salas de cero.
