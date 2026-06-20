# GDD.md — *Alien Pocho* (Game Design Document, Fase 1)

> Homenaje jugable a *Alien 8* (Ultimate, 1985). Ver investigación en [RESEARCH.md](RESEARCH.md).
> Decisiones validadas con el usuario: **4-6 salas · paleta monocromo Spectrum · drones pospuestos · sistema de vidas**.

---

## 1. Visión

*Alien Pocho* es un **puzzle-acción isométrico** de una sola pantalla por sala (flip-screen),
que recrea la sensación del motor **Filmation**: explorar habitaciones de una nave, esquivar
peligros y enemigos, y **recoger circuitos para colocarlos en su zócalo correcto** antes de que
se acabe el tiempo. Estética **monocroma estilo ZX Spectrum** (trazos claros sobre negro).

**Bucle de juego:** entrar en sala → leer el puzzle → mover/saltar esquivando peligros →
recoger un circuito → llevarlo a su zócalo correcto (puede estar en otra sala) → repetir hasta
colocar todos → victoria antes de que el reloj de años luz llegue a 0.

---

## 2. Alcance (qué replicamos / adaptamos / omitimos)

| Mecánica del original | En *Alien Pocho* | Notas |
|---|---|---|
| Proyección isométrica (Filmation) | ✅ Replicar 1:1 | Núcleo del homenaje |
| Depth-sort (pasar tras los bloques) | ✅ Replicar 1:1 | Núcleo del homenaje |
| Movimiento 4 diagonales | ✅ Replicar | |
| Salto (eje Z) | ✅ Replicar | |
| Recoger/colocar circuitos por forma | ✅ Replicar | Formas: cubo, pirámide, domo, cilindro |
| Flip-screen entre salas | ✅ Replicar | 4-6 salas |
| Peligros estáticos (pinchos) | ✅ Replicar | |
| Enemigos móviles | ✅ Adaptar | Patrullas simples |
| Reloj "años luz" | ✅ Adaptar | Límite global de partida |
| Sistema de vidas | ✅ Adaptar | En vez de energía: nº de vidas |
| Drones teledirigidos | ⏸️ Pospuesto | Posible ampliación futura |
| Empujar bloques | 🔸 Opcional | Solo si un puzzle lo requiere |
| 129 salas | ❌ Reducido a 4-6 | |

---

## 3. Mundo y coordenadas

- Cada **sala** = rejilla 3D de celdas `(x, y, z)`:
  - Suelo: plano base `z = 0`.
  - Bloques/plataformas: celdas con altura.
  - Tamaño de sala objetivo: **8×8** celdas de suelo (ajustable).
- **Proyección a pantalla** (de RESEARCH §4):
  ```
  sx = origenX + (wx - wy) * (TILE_W / 2)
  sy = origenY + (wx + wy) * (TILE_H / 2) - wz * BLOCK_H
  ```
- **Orden de dibujado:** ascendente por `wx + wy + wz` (atrás→delante, abajo→arriba).
  El jugador y entidades se insertan en ese orden → desaparecen tras los bloques.

---

## 4. Personaje (Pocho, el robot)

**Control tipo "tanque"** (fiel a *Alien 8* / *Knight Lore*, confirmado en los manuales
originales; ver [RESEARCH.md](RESEARCH.md)). El movimiento es **suave (píxel a píxel)** pero
NO libre en cualquier dirección:

- **Girar 90°** a izquierda/derecha. Hay **4 direcciones de mirada** alineadas a los ejes del
  suelo (la review lo resume: *"thinks in 8 directions but moves in four"*). El giro tiene una
  breve animación/cooldown (`TURN_TIME`).
- **Avanzar** en línea recta en la dirección que se mira (siempre alineado a los ejes → caminos
  rectilíneos). Animación de caminar (balanceo + paso).
- **Salto de un solo botón**, en la dirección que se mira:
  - pulsación **corta** → salto **bajo/corto** (`JUMP_LOW`).
  - pulsación **larga** (mantener) → salto **alto/largo** (`JUMP_HIGH`).
  - El umbral entre corto/largo es `JUMP_TAP_TIME`. Distancias/alturas **parametrizadas**
    (no documentadas en el original) en `CFG`: a afinar jugando.
- **Teclas parametrizables** en código fuente (objeto `CONTROLS` en `index.html`).
- **Colisiones** conscientes de la altura: no se *anda* hacia un bloque más alto que los pies
  (hay que saltar); sí se camina sobre cimas a tu nivel o por debajo.
- Lleva **un circuito a la vez** (lo carga encima). Acción de **soltar/colocar**.
- **Vidas:** empieza con 3. Tocar enemigo o peligro → pierde una vida y reaparece en la entrada
  de la sala (con breve invulnerabilidad). 0 vidas → Game Over.

> Pendiente de pulido visual: sprites isométricos intermedios reales para giro y caminar
> (ahora hay animación simplificada: balanceo + cooldown de giro).

---

## 5. Puzzle de circuitos

- Cada circuito tiene una **forma** (cubo / pirámide / domo / cilindro).
- Cada **zócalo** acepta **solo** la forma correspondiente.
- Colocar la forma correcta → el zócalo se "activa" (feedback visual + sonido).
- **Victoria:** todos los zócalos activados antes de que el reloj llegue a 0.

---

## 6. Enemigos y peligros

- **Pinchos (estáticos):** ocupan una celda; contacto = perder vida.
- **Enemigos (móviles):** patrulla simple (ida y vuelta o ciclo por celdas). Contacto = perder vida.
- Reaparición del jugador en la entrada de la sala tras perder vida.

---

## 7. HUD

Panel inferior estilo retro (referencia: capturas reales de *Alien 8*):
- **Objeto que llevas** (icono grande) + contador, a la izquierda.
- **Icono del robot** + número (vidas / sala), centrado-abajo.
- **AÑOS LUZ** restantes en un recuadro destacado (cuenta atrás), a la derecha.
- *Alien Pocho* (provisional): **VIDAS · CIRCUITOS x/total · AÑOS LUZ**.

### Referencias visuales (de las capturas del original aportadas)
Para las fases de arte/salas, imitar:
- **Muros con textura hexagonal** (panel de "celdas" / nido de abeja).
- **Arcos / puertas** como salidas de sala (umbrales con marco).
- **Peligros tipo planta/pinchos** (formas dentadas en el suelo).
- **Circuito** = cubo con patrón/cara, "flotando" en el centro de la sala.
- Paleta monocroma sobre negro (en el original variaba por versión: cian, verde…).

---

## 8. Estados del juego

`TÍTULO → JUGANDO → (VICTORIA | GAME OVER) → TÍTULO`

- Pantalla de **título** con estética Spectrum.
- **Victoria:** todos los circuitos colocados.
- **Game Over:** 0 vidas o reloj a 0.

---

## 9. Controles

Modelo tipo tanque (ver §4):

| Acción | Tecla |
|---|---|
| Girar a la izquierda (−90°) | ← / A |
| Girar a la derecha (+90°) | → / D |
| Avanzar (recto, hacia donde mira) | ↑ / W |
| Saltar (en su dirección) — **un solo botón** | ESPACIO |
| → pulsación **corta** = salto bajo/corto · pulsación **larga** = salto alto/largo | (mismo botón) |
| Recoger / Soltar circuito | E o Intro *(pend. Fase 5)* |
| Pausa | P *(pend.)* |
| Empezar / Reiniciar | Intro *(pend.)* |

---

## 10. Contrato técnico

- **HTML5 + JavaScript vanilla**, render en `<canvas>` 2D. Sin frameworks.
- **Dos archivos** que funcionan abriendo `index.html` en el navegador (sin build):
  `index.html` (HTML + CSS + motor/físicas/salas/HUD) y `assets.js` (biblioteca de dibujo `AP.*`).
  *(El plan inicial era un solo archivo; el dibujo se extrajo a `assets.js` por claridad.)*
- **Gráficos por código** (formas/sprites dibujados con primitivas o sprites generados),
  paleta monocroma estilo Spectrum. **Sin assets con copyright.**
- Resolución lógica fija (p. ej. 320×240 escalada con `image-rendering: pixelated`) para look retro.
- Bucle de juego con `requestAnimationFrame` y delta-time.
- Audio: efectos sencillos con **WebAudio** (beeps tipo Spectrum), opcional/desactivable.

---

## 11. Arquitectura de código (módulos lógicos dentro del archivo)

```
- config        constantes (TILE_W, TILE_H, BLOCK_H, paleta, controles)
- iso           proyección mundo→pantalla + helpers de depth sort
- input         estado de teclado
- rooms         definición de las salas (datos: rejilla, bloques, peligros, circuitos, zócalos, salidas)
- entities      jugador, enemigos, circuitos (estado + update)
- physics       movimiento, colisiones, salto
- render        dibujo de rejilla, bloques, entidades en orden correcto + HUD
- game          máquina de estados, reloj, vidas, condición victoria/derrota
- main          bucle requestAnimationFrame
```

---

## 12. Plan de fases (con puertas de validación)

Cada fase termina con algo **ejecutable y revisable**. Espero tu OK antes de seguir.

- **Fase 2 — Render isométrico + 1 sala estática.**
  Validar: se ve una habitación isométrica (suelo + paredes + algún bloque) con la estética correcta.
- **Fase 3 — Movimiento + colisiones.**
  Validar: el robot se mueve en 4 diagonales, choca con bloques y respeta el depth-sort (pasa por detrás).
- **Fase 4 — Salto + alturas (eje Z).**
  Validar: el robot salta y puede subirse a plataformas de 1 nivel.
- **Fase 5 — Circuitos: recoger, llevar y colocar en zócalos.**
  Validar: recoges una pieza, la llevas, y solo encaja en el zócalo de su forma.
- **Fase 6 — Peligros + enemigos + vidas.**
  Validar: pinchos y enemigos quitan vida; reaparición; Game Over a 0 vidas.
- **Fase 7 — Flip-screen entre salas (4-6 salas) + reloj años luz.**
  Validar: cruzas bordes y cambias de sala; el reloj corre; victoria al colocar todos los circuitos.
- **Fase 8 — HUD, pantallas (título/victoria/game over), audio y pulido.**
  Validar: juego completo de principio a fin con look & feel retro.

---

## 13. Decisiones cerradas (Fase 1)

- Salas: **4-6**.
- Paleta: **monocromo Spectrum** (trazos claros sobre negro).
- Drones: **pospuestos**.
- Daño/derrota: **sistema de vidas** (3 vidas) + reloj global como límite.
