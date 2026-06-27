# idea — Robot con huella CUADRADA (quitar la orientación de su huella)

> Estado: **DIFERIDA / sin implementar.** Origen: sesión 2026-06-25, al arreglar el bug de oclusión
> robot↔circuito. La usuaria propuso hacer el robot "mismo ancho que largo"; se aparcó porque NO era la
> causa del bug (lo era la `vbox` de los objetos, resuelta con "painter = huella"). Esto es limpieza de
> registro/debug, no un cambio de jugabilidad. Relacionado: [[alien-pocho-assets-modularity]].
>
> **Actualización 2026-06-27:** la confusión volvió a surgir (la región del robot "invade" celdas vecinas).
> El debug ahora pinta DOS cajas del robot —**roja** = huella del registro (orientable, ≈ lo que se dibuja),
> **verde** = colisión/orden (±`PRAD`)— para verlo de un vistazo (`player.debugInfo` / `render.drawDebug`). La
> doble definición SIGUE sin unificar. **Matiz importante:** el análisis del motor iso
> ([idea-motor-bounds-visuales.md](idea-motor-bounds-visuales.md)) sugiere que la huella orientable NO es solo
> cosmética: es la base natural de la caja de **ORDEN** del painter, que hoy usa `PRAD` —demasiado estrecha
> para el dibujo (los hombros se salen ~0.18 celdas)—. O sea, antes de ELIMINAR las variantes, decidir si más
> bien el painter debería **ORDENAR por esa huella** (≈ dibujo) dejando `PRAD` solo para colisión. Reconsiderar
> las dos ideas juntas.

## El problema

El robot tiene HOY **dos definiciones de huella distintas**:

- **Colisión + painter (lo que el juego usa):** un **cuadrado simétrico ±`CFG.PRAD`** (0.32), independiente
  del giro. Lo usan `physics` (colisión/apoyo) y `player.addDraws` (caja de orden del painter).
- **Registro (`ASSETS.robot.foot` + variantes `axisX`/`axisY`):** **asimétrica** (más ANCHA que profunda:
  `WID=0.5 > DEP=0.33`), que rota con el `facing`. Pero esto **solo lo leen la tool y el overlay de debug
  (`player.debugInfo`)**, NO el juego.

O sea: la huella orientable del registro es **cosmética** (preview/debug). En el juego el robot ya colisiona
y se ordena como un cuadrado simétrico. De ahí la confusión que vio la usuaria: el **cubo de debug rota**
(huella del registro) e "invade" celdas vecinas, aunque la colisión real (PRAD) no llega ahí.

## La idea

Unificar el robot a **UNA sola huella cuadrada** (≈ su colisión `PRAD`), eliminando las variantes
`axisX`/`axisY` del registro. Así registro = tool = debug = realidad del juego (colisión simétrica), y se
quita el dato de orientación (el motor ya no tiene "huella que rota").

## Viabilidad / impacto

- **Bajo riesgo:** el juego ya usa `PRAD` simétrico → la jugabilidad NO cambia. Solo cambian el preview de la
  tool y el cubo de debug (dejarían de rotar/invadir).
- Hay un **acoplamiento de fondo**: la huella del robot está definida por `CFG.PRAD` (colisión) Y por
  `ROBOT.WID/DEP` (registro/visual), dos fuentes. Lo limpio sería una sola (derivar la huella del registro de
  `PRAD`, o viceversa) — decisión a tomar.
- **Coste visual:** se pierde el dato "hombros más anchos" en tool/debug. Es aceptable (el dibujo del robot
  sigue teniendo hombros; solo la CAJA pasa a ser el cuadrado de colisión, que ya es lo que importa).

## Decisión pendiente

¿Merece la pena la limpieza, o se deja la huella orientable como "dato visual" del registro? Si se hace:
quitar `robot.variants.axisX/axisY`, dejar `foot` cuadrado, y actualizar `player.debugInfo` (que hoy lee
`assetFoot("robot", variant)`) + el test de anclaje + la tool. Correr `npm test`.
