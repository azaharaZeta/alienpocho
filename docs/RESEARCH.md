# RESEARCH.md — Investigación de *Alien 8*

> Documento de referencia para *Alien Pocho* (homenaje a *Alien 8*): qué era *Alien 8*
> (jugabilidad + motor gráfico Filmation), para recrearlo con fidelidad. Diseño en [GDD.md](GDD.md).

---

## 1. Ficha del juego original

| Campo | Dato |
|---|---|
| Título | **Alien 8** |
| Desarrolladora / Editora | **Ultimate Play the Game** |
| Año | **1985** |
| Plataformas | ZX Spectrum, BBC Micro, Amstrad CPC, MSX |
| Género | Acción-aventura / puzzle isométrico ("isometric maze") |
| Motor | **Filmation** (mismo motor que *Knight Lore*, 1984) |
| Recepción | 95% en *Crash*, 9/10 en *Your Sinclair*. Sucesor espiritual de *Knight Lore*. |

---

## 2. Argumento y objetivo

- El jugador controla a un **robot llamado Alien 8**, encargado de mantener con vida a
  la tripulación **criogenizada** de una nave estelar durante un largo viaje.
- Los **circuitos / válvulas termoeléctricas** ("thermolec valves") que mantienen los
  sistemas de soporte vital han sido **retirados y dispersados** por la nave (por los aliens invasores).
- **Misión:** recorrer la nave, **recoger cada circuito y colocarlo en su zócalo/conector correcto**
  para reactivar las cápsulas criogénicas, **antes de que la nave llegue a su destino**.
- Los circuitos tienen **formas distintas**: cubos, pirámides, domos (cúpulas) y cilindros.
  Cada forma encaja en su receptáculo correspondiente.

### Presión temporal
- El HUD muestra la **distancia al destino en años luz**, que va decreciendo: es el "reloj".
  Si llega a destino antes de colocar todos los circuitos → fin de partida.

---

## 3. Mecánicas de juego

### Movimiento (CONFIRMADO en manuales originales)
- Mundo en **proyección isométrica** ("3D" falso).
- **Movimiento suave (píxel a píxel)** pero con **control tipo "tanque"**, NO libre:
  - Teclas para **girar 90°** a izquierda/derecha → **4 direcciones de mirada** alineadas a los
    ejes del suelo. La review de *Alien 8* lo resume: *"thinks in 8 directions but moves in four."*
  - Tecla para **avanzar** en línea recta hacia donde se mira.
  - *Alien 8* añade una opción de "Directional Control" que gira automáticamente.
- **Salto** (eje Z) en la dirección que se mira. El usuario indica **dos tipos** (corto/bajo y
  largo/alto); las distancias/alturas exactas **no están documentadas** → parametrizar y afinar.
- Mapa de teclas del original (Knight Lore/Alien 8): fila inferior = girar izq/der;
  segunda fila (A–L) = avanzar; tercera fila (Q–P) = saltar; teclas 1–0 = coger/soltar.
- Animaciones con **sprites isométricos intermedios** para girar y caminar.

**Fuentes de control:** [Knight Lore — manual (gamesdatabase)](https://www.gamesdatabase.org/Media/SYSTEM/Sinclair_ZX_Spectrum/Manual/formated/Knight_Lore_-_1984_-_Ultimate_-_Play_the_Game.htm) · [Knight Lore — instrucciones (nvg)](http://rk.nvg.ntnu.no/sinclair/instructions/kghtlore.html) · [Alien 8 — review CRASH 15](https://www.crashonline.org.uk/15/alien8.htm)

### Estructura del mundo
- **129 habitaciones** ("rooms") con scroll de tipo **flip-screen**
  (al salir por un borde, cambia de pantalla completa, no hay scroll suave).
- El conjunto de habitaciones **dibuja la silueta de una gran nave estelar**.
- No hay punto de inicio aleatorio; la **exploración está supeditada a resolver los puzzles** de cada sala.

### Elementos de las salas
- **Plataformas móviles / bloques apilables** para crear caminos.
- **Peligros estáticos**: pinchos (spikes) y trampas.
- **Enemigos / aliens hostiles** que se mueven por la sala.
- **Drones teledirigidos**: Alien 8 puede dirigir drones a zonas peligrosas o inaccesibles
  (mecánica distintiva del original).

### Daño / energía
- El contacto con enemigos o peligros penaliza al jugador (pérdida de energía/vida y/o tiempo).
- Documentación pública no detalla con precisión el sistema exacto de energía/puntuación;
  **decisión de diseño para *Alien Pocho*:** definiremos un sistema simple (p. ej. energía que baja
  al recibir golpes + el reloj de años luz como límite global). Ver `GDD` (Fase 1).

---

## 4. El motor **Filmation** (cómo se ve y cómo se dibuja)

Lo que necesitamos replicar técnicamente:

- **Proyección isométrica** sobre rejilla 3D: cada celda tiene coordenadas `(x, y, z)`
  (suelo X/Y + altura Z).
- **Image masking / sprite stacking**: las estructuras se componen **apilando sprites**
  (cubos, bloques, objetos) sin que se solapen mal visualmente. La clave es el **orden de dibujado**.
- **Depth sorting (orden de pintado):** se dibuja de **atrás hacia delante**. Regla práctica:
  - Para celdas en rejilla, la "lejanía" es proporcional a `x + y` (las celdas con menor `x+y`
    se pintan primero, al fondo).
  - Dentro de una misma celda, se pinta de **abajo hacia arriba** (por capa de altura `z`).
  - Las entidades móviles (jugador, enemigos, objetos) se insertan en ese orden según su `(x, y, z)`,
    de modo que el personaje "desaparece" tras los bloques cuando pasa por detrás.
- En *Filmation II* (juegos posteriores) los objetos se volvían **contorno (wireframe)** cuando el
  personaje pasaba por detrás, para no perderlo de vista. *Alien 8* usa el masking clásico.

### Fórmula de proyección (la que usaremos)
Conversión de coordenada de mundo `(wx, wy, wz)` a pantalla `(sx, sy)`:

```
sx = origenX + (wx - wy) * (anchoTile / 2)
sy = origenY + (wx + wy) * (altoTile / 2) - wz * alturaBloque
```

Orden de render: ordenar entidades/bloques por la clave `(wx + wy + wz)` ascendente
(o iterar la rejilla en diagonales `d = x + y` y, dentro de cada diagonal, por `z`).

---

## 5. Estética visual (paleta y estilo)

- **Spectrum: monocromo.** La mayoría de versiones se hicieron en **monocromo** (sprites en un solo
  color sobre fondo negro) **para evitar el *attribute clash*** del Spectrum.
  - El *attribute clash* era la limitación del Spectrum: solo 2 colores (tinta + papel) por bloque
    de 8×8 píxeles. Trabajar en monocromo evitaba mezclas de color feas en los bordes de los sprites.
- La versión **Amstrad CPC** mostraba **dos colores**.
- Estilo: **líneas blancas/claras sobre fondo negro**, look "alámbrico/sólido" muy reconocible,
  con sombreado por tramas (dithering) para dar volumen a los bloques.
- **HUD / marcador**: panel con la información de partida (distancia en años luz al destino,
  estado de la misión). Layout sobrio, tipografía de bloque retro.

> Nota: no se pudieron extraer descripciones de color detalladas de ZX-Art (la página requiere
> render JS). Para *Alien Pocho* trabajaremos con una **paleta retro tipo Spectrum**: fondo negro,
> trazos en blanco/cian, y acentos puntuales — a validar en Fase 1 con mockups.

---

## 6. Implicaciones de diseño para *Alien Pocho* (resumen accionable)

1. **Render**: canvas 2D + proyección isométrica con la fórmula del §4 y depth-sort por `x+y+z`.
2. **Rejilla 3D por sala**: cada habitación = matriz de celdas con suelo, bloques (altura) y peligros.
3. **Personaje**: 4 direcciones diagonales + salto (eje Z) + colisiones con bloques.
4. **Objetos-puzzle**: piezas con forma (cubo/pirámide/domo/cilindro) + zócalos que solo aceptan su forma.
5. **Enemigos y peligros**: patrullas simples + pinchos estáticos; daño a energía.
6. **Flip-screen**: transición de sala completa al cruzar un borde.
7. **Reloj global**: cuenta atrás en "años luz" como límite de la partida.
8. **Estética**: monocromo/2 colores sobre negro, tramas para volumen, HUD retro.

---

## 7. Decisiones abiertas (para validar en Fase 1)

- ¿Cuántas salas en *Alien Pocho*? (el original tiene 129; nosotros haremos un subconjunto jugable, p. ej. 6–12).
- ¿Cuántas piezas/circuitos para "ganar"?
- ¿Incluimos drones teledirigidos o lo dejamos como mecánica opcional posterior?
- Paleta final (monocromo puro vs. 2 colores estilo Amstrad).
- Sistema de energía/vidas concreto.

---

## 8. Fuentes

- [Alien 8 — Wikipedia](https://en.wikipedia.org/wiki/Alien_8)
- [Alien 8 — Spectrum Computing](https://spectrumcomputing.co.uk/entry/9302/ZX-Spectrum/Alien_8)
- [Alien 8 — ZX-Art](https://zxart.ee/eng/software/games/arcade/maze/isometric-maze-games/alien-8/)
- [Alien 8 — Super Chart Island](https://superchartisland.com/alien-8/)
- [Filmation (game engine) — HandWiki](https://handwiki.org/wiki/Software:Filmation_(game_engine))
- [Knight Lore / Filmation context — Wikipedia: Nightshade](https://en.wikipedia.org/wiki/Nightshade_(1985_video_game))
- [Isometric depth sorting / render order — GameDev.net](https://gamedev.net/forums/topic/719280-isometric-tile-render-order/5471970/)
- [Drawing isometric boxes in the correct order — IsometricBlocks](https://shaunlebron.github.io/IsometricBlocks/)
