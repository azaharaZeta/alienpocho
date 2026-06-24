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

### 🅿️ Enemigos, peligros y vidas — APARCADO (quizá en el futuro)
- **Pinchos letales**: hoy decorativos (`room.hazards` + `AP.spikes`). Tocarlos = perder vida.
- **Enemigos**: patrulla simple (ida/vuelta o ciclo de celdas); contacto = perder vida.
- **Vidas**: `game.lives` baja al recibir daño; reaparición con breve invulnerabilidad; Game Over a 0.


### Técnica
- **Precargar los assets (PNG/SVG) al arrancar**: ahora que los migrados solo se dibujan desde fichero (sin fallback procedural), mientras cargan no se dibujan → parpadeo en cada recarga. Cargar todas las imágenes antes de iniciar el bucle (o pantalla de carga breve) para que no falte nada en el primer frame.

### Presentación y pulido
- **Pantallas** de victoria y game over con entidad propia (hoy solo banner); reutilizar el
  estilo del menú de inicio (estado `title`).
- **Audio** WebAudio (saltar, coger, soltar, colocar) + toggle de silencio persistente.
- **Más salas / retos** que exploten las mecánicas nuevas (apilar/empujar objetos para
  alcanzar zócalos altos); plataformas móviles; dron (el asset `drone` ya existe).




## IDEAS USUARIA
- En la tool de assets: Permitir filtrar por trait. En la vista de asset, listar los traits. Usar un código de colores para los traits (solo en esta tool). NO hardcodear los traits en la tool, traerlos, y meterles colores distintos de una lista de colores variados, sin más.

- Refactor: Limitar el ancho y largo de las habitaciones a enter 3 y 8 solo. Centrar siempre la sala dentro del mismo marco 8x8.
- Mejorar el mini mapa: zonas un poco más claras, bordes ok.
- Esta es gorda: convertir el juego en un roguelike. Cada run, mapa random, ubicaciones random.
- Todos los objetos deberían usar la misma lógica de posicionamento, tanto si son movibles como si no. Ahora mismo creo que  los objetos se posicionan en el centro del tile, pero los bloques  van en un extremo del tile, con dibujado distinto. Implementar que algunos bloques sí sean movibles, empujándolos.
## 🐞 BUGS CONOCIDOS

- `floor` declara `files.svg: "example.svg"` pero se dibuja procedural (`draw:"floor"`) → es un SVG declarado que no se usa. Decidir: quitar la declaración, o dibujar el suelo desde fichero como el resto de sprites.
