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
<!-- vacío: todas las ideas listadas se procesaron a docs/ideas/idea-*.md (2026-06-27). -->




## IDEAS USUARIA
<!-- vacío: las ideas listadas se procesaron a docs/ideas/idea-*.md (2026-06-27). Esta sección la rellena solo la usuaria. -->
- Ya no permitimos salas con largo o ancho >8. Y todas se centran con el pico más cercano al usuario en el centro de la pantalla. Ya no es necesario que la UI se adapte, siempre será fija en su sitio. Revisar si hay código obsoleto de resize de la UI. Y:
  - Colocar el texto "Alien Pocho" arriba a la izda de la pantalla. Ojo que no colisione con la info de debug, mira si se puede poner la info de debug debajo del título, o donde no moleste.
  - Las vidas: colocalas en la zona derecha
  - Ojo, no solo se podrán recoger circuitos, también eventualmente otros objetos. Marca el actual objeto computer como recogible.
  - Ahora que se pueden recoger otros objetos además de circuitos, desliga el contador de circuitos colocados del visor del objeto colocado. Llévalo a otra zona del UI y ponle un label tipo "Circuitos activados" o algo así.
  - El objeto recogido: a la izqiuerda.  Y añádele un label con el nombre de ese objeto. Todos los objetos recogibles tienen que tener un nombre :)

- En menú principal, listar los controles de teclado.


## 🐞 BUGS CONOCIDOS
- `floor` declara `files.svg: "example.svg"` pero se dibuja procedural (`draw:"floor"`) → es un SVG declarado que no se usa. Decidir: quitar la declaración, o dibujar el suelo desde fichero como el resto de sprites. (Directo de resolver; pendiente de decisión.)
- La representación del objeto recogido en la UI no cabe en su cuadro
