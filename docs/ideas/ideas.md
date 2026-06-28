# ideas-pendientes.md

En este documento solo se incluirán listados breves de ideas pendientes de procesar.
No incluir análisis ni estados: solo una línea por idea.

- Las ideas creadas por la IA se incluyen en la sección `## IDEAS IA`.
- Las ideas creadas por la usuaria las incluirá solo la usuaria en `## IDEAS USUARIA`.
- Los bugs detectados, tanto por la IA como por la usuaria, se documentarán en `## BUGS CONOCIDOS`.

## Procesado del fichero

Cuando se pida a la IA procesar este fichero, para cada idea listada:

1. Crear un fichero `docs/ideas/idea-<titulo-idea>.md` con el análisis detallado y el estado de la idea.
2. Borrar la idea de este listado.
3. Mantener el fichero `docs/ideas/idea-<titulo-idea>.md` actualizado a medida que se vaya trabajando o implementando esa idea.

Cuando una idea ya documentada en `docs/ideas/idea-<titulo-idea>.md` haya terminado de implementarse o se haya descartado:

1. Documentar el resultado en su propio documento.
2. Archivarla moviéndola a `docs/ideas/archivo/`.

### Bugs conocidos

- Si son directos de resolver, no es necesario crear ningún fichero: se resuelven y se eliminan de este listado.
- Si son complejos y requieren análisis, proceder igual que con las ideas, creando el fichero `docs/ideas/bug-<titulo-bug>.md`.
Convenio de nombres: usar minúsculas y guiones en lugar de espacios para `<titulo-idea>` y `<titulo-bug>`.


## IDEAS IA
<!-- vacío: las ideas IA se procesaron a docs/ideas/idea-*.md (2026-06-28: minimapa-pistas-puzzle, pantalla-pausa). -->




## IDEAS USUARIA
<!-- Esta sección la rellena solo la usuaria. -->
- Distintos assets de suelo
- Coordenadas UNIFICADAS para TODOS los assets: UNA sola forma de definir y manejar la posición, sin convenciones distintas por tipo de asset (hoy conviven `cx,cy` de celda para fijos y `x,y`+`z` continuos para móviles/recogibles; `physics.objBox` solo entiende las continuas → fuente de bugs como computer/REACTOR sin `z`). [PEDIDA VARIAS VECES — pendiente]


## 🐞 BUGS CONOCIDOS
<!-- vacío. (2026-06-28) Resuelto el del `floor`: opción B — el suelo se dibuja desde assets/svg/floor.svg
     como el resto (sprite teñido por sala); borrado el example.svg fantasma. -->
- ~~Hay valores numéricos reutilizados repetidos por el código. Revisarlo para llevarlos a constantes o a parámetros.~~ ✅ RESUELTO (2026-06-28): consolidados los repetidos con significado común → `UI_MARGIN` (margen del contenido del HUD), `CFG.COL.scrim` (panel negro semitransparente: menú/victoria/minimapa), `FRAME_MARGIN` (marco sci-fi de título/victoria) y `FE`/`BOT` (borde del marco del HUD). El resto son literales de un solo uso o de estilo contextual (tamaños de fuente), que se dejan a propósito.
- ~~Hueco puertas "pegote": el rectángulo negro del vano (en 2d) salía más grande que el hueco del sprite y mordía el marco.~~ ✅ RESUELTO (2026-06-28): el cuadro negro `doorHole` se dibujaba en el plano y=0 mientras el sprite de la puerta de fondo retrocede −T → desalineado ~3px. Eliminado: el vano del sprite es transparente y deja ver el fondo negro del canvas (forma exacta del hueco); el robot cruza siempre por y>0, delante. Tocó painter/cáscara (`world.roomShell`, `draw.door`) + smoke test; verificado por píxeles y al cruzar.
