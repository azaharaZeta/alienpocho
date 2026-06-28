# Idea — Pantallas de victoria y game over con entidad propia

> **Estado: PARCIAL — VICTORIA ✅ implementada (2026-06-28); GAME OVER pendiente** (depende de las vidas,
> [[idea-enemigos-peligros-vidas]], aparcadas). Origen: IA. Ver "Resultado" al final.

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

## Resultado (VICTORIA, 2026-06-28)
- **Pantalla de victoria propia** (`screens.drawVictoryScreen`): mismo estilo que el menú (marco sci-fi +
  rótulo neón "MISION/COMPLETA" + mascota + "Todos los circuitos activados" + prompt parpadeante), con la
  **paleta de la sala** donde se ganó. Se extrajo `neonText()` a nivel de módulo, compartido con el título.
- **Flujo:** `game.won` (lo pone `interact` al completar la misión) ya NO pinta un banner; `main.js` muestra
  la pantalla de victoria en su lugar y **al pulsar vuelve al MENÚ principal** (`game.won=false; state="title"`).
  Desde el menú, pulsar arranca una partida nueva (`resetGame`). Se borró el `drawWinBanner` de `render.js` y
  la rama de victoria muerta de `player.update`.
- Verificado en preview (pantalla de victoria con paleta de NUDO → menú). `npm test` verde (21/7/16/7).
- **GAME OVER pendiente:** la misma `screens.js` lo soportaría, pero necesita disparador real = las **vidas**
  ([[idea-enemigos-peligros-vidas]], aparcadas). No hay reloj (sin derrota por tiempo). Esta idea queda ACTIVA
  solo por esa parte.
