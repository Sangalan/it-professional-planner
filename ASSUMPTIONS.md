# ASSUMPTIONS.md — Inferencias y supuestos del plan

## Tareas derivadas generadas automáticamente

### Publicaciones LinkedIn
- Cada publicación tiene una tarea fija en su fecha de publicación (bloque 20:00–22:00, categoría `contenido`).
- Se infiere una tarea de preparación 2–3 días antes para publicaciones de tipo `video` o `article` (no siempre explicitada, se añade como flexible en bloque `repos/web` o `contenido`).

### Certificaciones
- Se generan tareas de estudio diarias en el bloque 14:00–16:00 durante las 2–3 semanas previas a cada examen.
- La tarea del examen en sí es fija con hora 14:00–16:00 (bloque de certificaciones).
- Neo4j GDS se asigna a la misma semana que el examen Neo4j Prof (ambos en abril S4).

### PRs OpenRAG
- Las PRs tienen fecha de inicio y fecha de fin definidas en el plan.
- Se generan tareas diarias de trabajo (09:00–13:00, bloque profundo) para los días de inicio y fin.
- Los días intermedios se marcan como continuación y son flexibles.
- PR1 (`Pipeline Langflow`) comienza el 30 de marzo, fuera del periodo Q2. Se incluye en el seed como tarea del 1 de abril para alinearlo con el inicio del plan.

### Repositorios GitHub
- La tarea de publicación del repo se coloca en el bloque `repos/web` (16:30–18:30) en la fecha objetivo.
- Si la fecha cae en fin de semana, se mantiene (el plan prevé trabajo en sábados con carga reducida).

### Eventos multi-día
- Cada día de un evento multi-día genera una tarea individual (ej: "AI Engineer Europe día 1", "día 2", "día 3").
- Los días de evento se marcan con hora 09:00–19:00 y bloquean el resto de la jornada.
- Los días de evento no tienen tareas de PRs ni certificaciones (se asume desplazamiento y asistencia full-time).

### Diseño web
- El plan menciona "Diseño: Mayo semana 4, Desarrollo: Junio semanas 1–2, Go-live: 16 junio".
- Se generan tareas de diseño/wireframes en mayo S4 y tareas de desarrollo en junio S1–S2.
- El go-live (16 jun) es tarea fija de alta prioridad.

---

## Supuestos sobre horarios

- **Domingos**: carga reducida — no se generan tareas explícitas de trabajo profundo.
- **Días de evento presencial**: se genera 1 sola tarea de asistencia todo el día.
- **Solapamiento potencial**: el 21 de abril hay examen Neo4j (14:00–16:00) y PRs por la mañana — ambas son viables en el mismo día con el horario tipo.
- **19 mayo**: coinciden examen NVIDIA (14:00–16:00) y inicio PR5 (09:00–13:00) — viable.

---

## Fechas fuera de Q2

- **PR1** comienza el 30 de marzo (pre-Q2). Se incluye como tarea del 1 de abril para contexto.
- **PR8** termina el 15 de julio (post-Q2). Se incluye el inicio (26 jun) porque cae dentro del trimestre.

---

## Progreso inicial

- Todas las tareas, objetivos, hitos, PRs, repos y certificaciones arrancan con estado `not_started` o `pending`.
- El porcentaje completado es 0% en todos los elementos al hacer un reset.
- Los porcentajes de objetivos se recalculan automáticamente cada vez que se actualiza una tarea (modo `task_based`).

---

## Categorías

- El plan menciona `opensearchcon` como categoría separada de `eventos`. Se mantiene así para distinción visual en el calendario.
- El post bonus del 18 de abril sobre OpenSearchCon se categoriza como `opensearchcon`, no `contenido`.

---

## Bloques diarios tipo

Los bloques del día tipo se aplican como referencia, no como tareas fijas automáticas:
- 09:00–13:00 → PRs / código (`github`)
- 14:00–16:00 → Certificaciones (`certificaciones`)
- 16:00–16:30 → LinkedIn engagement (`linkedin`)
- 16:30–18:30 → Repos / Web (`web`)
- 18:30–19:00 → Admin (`admin`)
- 20:00–22:00 → Contenido (`contenido`)

Las tareas sin hora exacta asignada en el plan se han colocado en el bloque que corresponde a su categoría según esta distribución.
