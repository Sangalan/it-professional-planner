# Plan Maestro

Aplicación local para seguimiento operativo del Plan Maestro de Posicionamiento en LinkedIn (Abril–Junio 2026).

---

## Instalación

### Requisitos
- Node.js 18+ (`node --version`)
- npm 9+

### 1. Instalar dependencias

```bash
cd linkedin-planner
npm run install:all
```

Esto instala las dependencias del proyecto raíz, el backend y el frontend.

### 2. Ejecutar

```bash
npm run dev
```

Esto arranca simultáneamente:
- **API** en `http://localhost:3002`
- **UI**  en `http://localhost:5173`

Abre `http://localhost:5173` en el navegador.

> La base de datos SQLite se crea automáticamente en `backend/data/planner.db` y se pre-carga con todos los datos del plan en el primer arranque.

---

## Estructura del proyecto

```
linkedin-planner/
├── package.json          ← arranque raíz (concurrently)
├── backend/
│   ├── server.js         ← API Express (puerto 3002)
│   ├── db.js             ← SQLite + esquema
│   ├── seed.js           ← datos iniciales del plan
│   └── data/
│       └── planner.db    ← generado automáticamente
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx           ← rutas y layout
        ├── api.js            ← cliente HTTP
        ├── views/
        │   ├── Dashboard.jsx         ← cuadro de mandos
        │   ├── NowView.jsx           ← "qué hago ahora"
        │   ├── DailyList.jsx         ← lista del día
        │   ├── WeeklyCalendar.jsx    ← calendario semanal
        │   ├── MonthlyCalendar.jsx   ← calendario mensual
        │   ├── ObjectivesView.jsx    ← objetivos e hitos
        │   └── Reports.jsx           ← gráficas y reportes
        └── utils/
            ├── dateUtils.js
            └── categoryUtils.js
```

---

## Vistas disponibles

| Ruta | Vista | Descripción |
|------|-------|-------------|
| `/` | Dashboard | KPIs globales, tareas de hoy, hitos próximos, gráficas |
| `/now` | Ahora mismo | Timer en tiempo real, tarea actual y siguiente |
| `/today` | Hoy | Lista completa del día con checkboxes |
| `/week` | Semana | Calendario semanal por franjas horarias |
| `/month` | Mes | Calendario mensual con eventos y tareas |
| `/objectives` | Objetivos | Progreso por objetivo, hitos, PRs, certs, publicaciones |
| `/reports` | Reportes | Gráficas burnup, completado por mes/semana/categoría |

---

## Cómo marcar tareas como completadas

1. **Vista Hoy (`/today`)**: checkbox en cada tarea o desliza el slider de progreso.
2. **Vista Ahora mismo (`/now`)**: botón "✓ Marcar como completada".
3. **Vista Objetivos (`/objectives`)**: checkbox en cada tarea expandida.

---

## Cómo añadir nuevas tareas

### Opción A — Editar `seed.js` y resetear
1. Abre `backend/seed.js`
2. Añade una entrada al array `tasks` siguiendo el patrón:
```js
tasks.push(t(
  'id-unico',           // ID
  'Título de la tarea', // título
  '2026-04-15',         // fecha (YYYY-MM-DD)
  '09:00',              // hora inicio
  '13:00',              // hora fin
  'github',             // categoría
  1,                    // prioridad (1=alta, 2=normal)
  'obj-oss',            // objetivo_id (o null)
  null,                 // milestone_id (o null)
  true,                 // es fija (true/false)
  'PR3',                // etiqueta visual
  'Descripción'         // descripción opcional
));
```
3. Haz click en **"Resetear datos"** en la vista Reportes, o ejecuta `npm run seed`.

### Opción B — Editar la base de datos directamente
```bash
sqlite3 backend/data/planner.db
INSERT INTO tasks (id, title, date, start_time, end_time, category_id, status, priority, is_fixed)
  VALUES ('mi-tarea', 'Mi tarea', '2026-05-01', '09:00', '11:00', 'github', 'pending', 1, 1);
```

---

## Cómo cambiar el sonido de alerta

El sonido se genera por Web Audio API (no requiere archivos externos). Para modificarlo:

1. Abre `frontend/src/views/NowView.jsx`
2. Busca la función `playBeep(frequency, duration, type)`
3. Parámetros ajustables:
   - `frequency`: Hz, por defecto `880` (La agudo). Prueba `440`, `660`, `1200`.
   - `duration`: segundos, por defecto `0.6`
   - `type`: `'sine'` | `'square'` | `'sawtooth'` | `'triangle'`

Para probar el sonido sin esperar, usa el botón **"test"** junto al icono de campana en la vista `/now`.

---

## Resetear todos los datos

En la vista **Reportes** (`/reports`), usa el botón **"Resetear datos"** (requiere doble click como confirmación).

O desde terminal:
```bash
cd backend && node seed.js
```

---

## Exportar datos

```bash
# Exportar todas las tareas a CSV
sqlite3 -separator ',' backend/data/planner.db \
  "SELECT id,title,date,start_time,end_time,category_id,status,percentage_completed FROM tasks ORDER BY date,start_time" > tareas.csv

# Exportar progreso de objetivos
sqlite3 -separator ',' backend/data/planner.db \
  "SELECT title,percentage_completed,status FROM objectives" > objetivos.csv
```

---

## Arquitectura

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | React 18 + Vite 5 | Ligero, rápido en dev, sin configuración compleja |
| Backend | Express 4 | Mínimo, 1 fichero, sin dependencias cloud |
| Base de datos | SQLite (better-sqlite3) | Fichero único, sin servidor, editable manualmente |
| Gráficas | Recharts 2 | Ligero, bien integrado con React |
| Fechas | date-fns 3 | Tree-shakeable, sin moment.js |
| Sonido | Web Audio API | Sin ficheros externos, funciona offline |
| Arranque | concurrently | 1 comando para todo |

No se usa Docker, no hay servicios cloud, todo corre en local.
