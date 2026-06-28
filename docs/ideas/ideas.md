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
<!-- vacío: las ideas IA se procesaron a docs/ideas/idea-*.md.
     2026-06-28 (1ª tanda): minimapa-pistas-puzzle, pantalla-pausa.
     2026-06-28 (2ª tanda, brainstorm): placas-de-presion, estacion-transmutacion, bloques-deslizantes,
       suelo-fragil, cintas-ascensores, terminales-lore, sombra-robot, silueta-xray, transicion-flip-screen,
       postproceso-crt, validador-solubilidad, persistencia-localstorage, replay-determinista, editor-salas,
       juice-feedback. -->




## IDEAS USUARIA
<!-- Esta sección la rellena solo la usuaria. -->
<!-- "Coordenadas UNIFICADAS para TODOS los assets" → HECHA 2026-06-28: docs/ideas/archivo/idea-coordenadas-unificadas.md
     (convención continua única x,y + z normalizado en makeRoom; resolvió de paso bug-reactor-bloque-sin-z). -->
- Distintos assets de suelo


## 🐞 BUGS CONOCIDOS
<!-- vacío de bugs SIN procesar. Bug abierto con análisis propio: docs/ideas/bug-empuje-revalida-robot.md.
     (Resueltos en 2026-06-28 y retirados de aquí: floor fantasma, números mágicos del HUD, "pegote" del vano
     de puertas, y bug-reactor-bloque-sin-z → absorbido por coordenadas unificadas, archivado.) -->

