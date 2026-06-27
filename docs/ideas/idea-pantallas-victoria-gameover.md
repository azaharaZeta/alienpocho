# Idea — Pantallas de victoria y game over con entidad propia

> **Estado: PENDIENTE — Prioridad MEDIA.** Origen: IA, procesado 2026-06-27.

## Qué es
Hoy victoria/game-over son solo un **banner** (overlay + texto en `render.js`). Darles **pantalla propia**,
reutilizando el estilo del menú de inicio (estado `title`, `screens.js`).

## Viabilidad técnica
- **Encaje:** limpio. Ya existe la máquina de estados `TÍTULO → JUGANDO → (VICTORIA | GAME OVER) → TÍTULO`
  (GDD §8) y `screens.js` para el título. Sería añadir estados/pantallas análogos.
- **Coste:** bajo-medio (sobre todo presentación). **Riesgo:** bajo.
- **Dependencia:** el Game Over necesita un disparador real — las **vidas** (aparcadas, ver
  [[idea-enemigos-peligros-vidas]]). No hay reloj (tiempo ilimitado, decisión de diseño en el GDD). La
  pantalla de **victoria** ya tiene disparador (puzzle completo, `data/mission.js`).

## Conveniencia
Media. Pulido de presentación que redondea el bucle. La de **victoria** se puede hacer ya; la de **game
over** gana sentido cuando se reactiven las vidas.

## Sugerencia
**Mantener.** Hacer primero la de **victoria** (disparador ya existe); la de game over, junto a las
vidas. Reaprovechar `screens.js`/estado `title`.
