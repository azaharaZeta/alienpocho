# GDD.md — *Alien Pocho* (Game Design Document)

> Homenaje jugable a *Alien 8* (Ultimate, 1985). Investigación: [RESEARCH.md](RESEARCH.md) · arquitectura
> de código: [ARQUITECTURA.md](ARQUITECTURA.md).
> Decisiones de diseño: **mapa laberíntico de varias salas (~17 hoy, ampliable) · paleta monocromo Spectrum ·
> controles tipo tanque · sistema de vidas · drones/enemigos aparcados** (ver [ideas/ideas.md](ideas/ideas.md)).

---

## 1. Visión

*Alien Pocho* es un **puzzle-acción isométrico** de una sola pantalla por sala (flip-screen),
que recrea la sensación del motor **Filmation**: explorar habitaciones de una nave, esquivar
peligros y enemigos, y **recoger circuitos para colocarlos en su zócalo correcto**. Estética
**monocroma estilo ZX Spectrum** (trazos claros sobre negro). **Sin límite de tiempo** (cero presión
temporal: decisión de diseño — no hay reloj de cuenta atrás).

**Bucle de juego:** entrar en sala → leer el puzzle → mover/saltar esquivando peligros →
recoger un circuito → llevarlo a su zócalo correcto (puede estar en otra sala) → repetir hasta
colocar todos → victoria. Sin reloj: el jugador explora a su ritmo.

---

## 2. Alcance (qué replicamos / adaptamos / omitimos)

| Mecánica del original | En *Alien Pocho* | Notas |
|---|---|---|
| Proyección isométrica (Filmation) | ✅ Replicar 1:1 | Núcleo del homenaje |
| Depth-sort (pasar tras los bloques) | ✅ Replicar 1:1 | Núcleo del homenaje |
| Movimiento 4 diagonales | ✅ Replicar | |
| Salto (eje Z) | ✅ Replicar | |
| Recoger/colocar circuitos por forma | ✅ Replicar | Formas: cubo, pirámide, domo, cilindro |
| Flip-screen entre salas | ✅ Replicar | estación espacial por zonas (9 salas hoy) |
| Peligros estáticos (pinchos) | ✅ Replicar | |
| Enemigos móviles | ✅ Adaptar | Patrullas simples |
| Reloj "años luz" | ❌ Descartado | **Sin límite de tiempo** (decisión de diseño: cero presión) |
| Sistema de vidas | ✅ Adaptar | En vez de energía: nº de vidas |
| Drones teledirigidos | ⏸️ Pospuesto | Posible ampliación futura |
| Empujar bloques | ✅ Implementado | Por trait `movable` de instancia; usado en puzzles (p. ej. REACTOR) |
| 129 salas | ❌ Reducido a un subconjunto laberíntico (~17) | |

---

## 3. Mundo y coordenadas

- Cada **sala** = rejilla 3D de celdas `(x, y, z)`:
  - Suelo: plano base `z = 0`.
  - Bloques/plataformas: celdas con altura.
  - Tamaño de sala: **PAR ∈ {4, 6, 8}** (lo fuerza `makeRoom`), para que la puerta (2 celdas) caiga centrada
    en celda entera y la pared se dibuje como módulos SVG sin recorte. Cada sala se **centra en un marco fijo
    8×8** (el pico frontal del suelo se ancla al centro-base; ver `view.projectorFor`). La sala de arranque la
    decide `data/mission.js` (`MISSION.start`).
- **Proyección a pantalla** (de RESEARCH §4):
  ```
  sx = origenX + (wx - wy) * (TILE_W / 2)
  sy = origenY + (wx + wy) * (TILE_H / 2) - wz * BLOCK_H
  ```
- **Orden de dibujado:** painter por profundidad (`depthSort` en engine.js; ver [ARQUITECTURA.md](ARQUITECTURA.md)).
  El jugador y entidades entran en ese orden → desaparecen tras los bloques.

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
- Lleva **un objeto a la vez** encima (un circuito, o cualquier asset recogible —p. ej. el ordenador). Acción
  de **soltar/colocar**. (El "carried" es un asset id genérico; solo los circuitos encajan en zócalos.)
- **Vidas:** empieza con 3. Tocar enemigo o peligro → pierde una vida y reaparece en la entrada
  de la sala (con breve invulnerabilidad). 0 vidas → Game Over.

> Pendiente de pulido visual: sprites isométricos intermedios reales para giro y caminar
> (ahora hay animación simplificada: balanceo + cooldown de giro).

---

## 5. Puzzle de circuitos

- Cada circuito tiene una **forma** (cubo / pirámide / domo / cilindro).
- El **zócalo** es **genérico** (un solo asset): qué circuito **pide** (`requires`) es config de cada
  zócalo, no del asset → diseñado para aceptar circuitos nuevos sin tocarlo.
- **Zócalo vacío:** muestra un **fantasma** (silueta atenuada) del circuito que pide.
- **Colocar el circuito correcto** → se **encaja** en la indentación del zócalo y la **base se ilumina**
  (el circuito se conserva ahí; no desaparece).
- **Victoria:** todos los zócalos llenos (sin límite de tiempo). El total se **deriva del mapa**
  (capa de misión, `data/mission.js`), no se fija a mano.

---

## 6. Enemigos y peligros

- **Pinchos (estáticos):** ocupan una celda; contacto = perder vida.
- **Enemigos (móviles):** patrulla simple (ida y vuelta o ciclo por celdas). Contacto = perder vida.
- Reaparición del jugador en la entrada de la sala tras perder vida.

---

## 7. HUD

Marco inferior en "V" estilo retro (referencia: capturas reales de *Alien 8*), con margen uniforme
(`UI_MARGIN`). Reparto actual (posición fija, ya no depende del hueco):
- **Arriba-izquierda:** título "ALIEN POCHO" (el overlay de debug, si está activo, va debajo).
- **Arriba-derecha:** nombre de sala + minimapa.
- **Abajo-izquierda:** objeto que llevas (visor con el sprite escalado) + su **nombre**.
- **Abajo-derecha:** vidas (mini-robot + ×N) y, abajo del todo, "CIRCUITOS ACTIVADOS x/total".
- Sin reloj (descartado el "AÑOS LUZ").

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
- **Game Over:** 0 vidas. (No hay derrota por tiempo: el juego no tiene reloj.)

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
| Recoger / Soltar circuito | E o Intro |
| Empezar / Reiniciar | Intro |

---

## 10. Contrato técnico

- **HTML5 + JavaScript vanilla**, render en `<canvas>` 2D. Sin frameworks, **sin build** (ES modules nativos).
- **Sprites neutros teñidos por sala** (PNG→SVG; suelo, paredes y puertas son sprites — solo el **robot** sigue procedural; ver [ASSETS.md](ASSETS.md)),
  paleta monocroma estilo Spectrum. **Sin assets con copyright.**
- Resolución lógica fija (320×240, escalada con `image-rendering: pixelated`) para look retro.
- Bucle con `requestAnimationFrame` y delta-time.
- Audio (pendiente): efectos sencillos con WebAudio, opcional.

> **Estructura de código** (motor / datos / simulación / presentación, módulos bajo `src/`): ver
> [ARQUITECTURA.md](ARQUITECTURA.md).

---

## 11. Estado

Implementadas las mecánicas núcleo: render iso + painter, movimiento tipo tanque, salto (con empuje de
objetos también en el aire), alturas, recoger/llevar objetos (genéricos) y colocar circuitos, empujar
objetos, flip-screen entre salas, HUD reorganizado, minimapa, **pantalla de victoria propia** (estilo menú,
vuelve al título) y precarga de assets. **Aparcado** (ver [ideas/ideas.md](ideas/ideas.md) y `docs/ideas/`):
enemigos, pinchos letales, audio, y la **pantalla de game over** (depende de las vidas, aparcadas).
