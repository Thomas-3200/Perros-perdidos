# Guía Interna de Admin/Moderación — Perros Perdidos (Piloto MVP)

**Uso interno. No compartir públicamente.**

---

## 1. Acceso al panel de administración

- URL: `http://localhost:3002/admin`
- Requiere una cuenta con `role = 'admin'` o `role = 'moderator'` en la base de datos.
- La única cuenta admin inicial es `admin@perrosperdidos.app`. Solicita la contraseña al responsable técnico.
- Si tu cuenta no tiene el rol correcto, la app redirige al inicio sin mensaje de error. Confirmar el rol en psql si hay dudas.

**Agregar un moderador (por ahora manual):**
```sql
UPDATE users SET role = 'moderator' WHERE email = 'email_del_moderador@ejemplo.com';
```

---

## 2. Qué ves en el panel

El panel tiene tres secciones principales:

| Sección | Qué muestra |
|---|---|
| **Matches pendientes** | Matches con confianza MEDIUM (65–84%) esperando revisión humana |
| **Lista de casos** | Todos los reportes de perros perdidos activos, encontrados o cerrados |
| **Lista de usuarios** | Cuentas registradas con email, fecha de registro y rol |

Los matches HIGH (≥85%) se notifican automáticamente al dueño sin intervención del admin.
Los matches LOW (<65%) se descartan en silencio y no aparecen.

---

## 3. Cómo revisar un match MEDIUM

Al abrir un match pendiente verás:

- **Score general** y desglose por componentes (visual, ubicación, tiempo, atributos)
- **Mapa/geo**: distancia entre el avistamiento y la última ubicación conocida del perro
- **Tiempo**: diferencia entre la fecha del avistamiento y la fecha de pérdida
- **Atributos**: raza, color, tamaño, descripción libre — comparación lado a lado en texto
- **Foto del avistamiento** (si fue subida por quien reportó)
- **Foto del perro perdido** (la que subió el dueño al crear el caso)

Las fotos se abren por separado en el detalle del caso y del avistamiento — ver sección de limitaciones.

---

## 4. Cuándo aprobar un match MEDIUM

Aprueba si se cumplen la mayoría de estos criterios:

- Las fotos muestran un perro visualmente similar (pelaje, tamaño, marcas distintivas)
- La ubicación del avistamiento es geográficamente razonable dado dónde se perdió el perro
- El tiempo entre pérdida y avistamiento es coherente (días/semanas, no meses sin contexto)
- La descripción del avistamiento coincide con los atributos del perro perdido
- No hay señales de que sea un envío de prueba o spam

Al aprobar, el sistema notifica al dueño del caso con los datos del avistamiento.

---

## 5. Cuándo rechazar un match MEDIUM

Rechaza si cualquiera de estos aplica:

- El perro en la foto es claramente diferente (otra raza, color o tamaño muy distinto)
- La ubicación es geográficamente imposible o no tiene sentido para el tiempo transcurrido
- El avistamiento fue reportado con datos obviamente falsos (coordenadas en el mar, descripción sin sentido)
- El reporte parece spam o es una entrada de prueba (nombres como "test", "asdf", etc.)
- No hay foto y los atributos de texto son vagos o contradictorios

Rechazar un match no elimina el avistamiento ni el caso — solo descarta ese match específico.

---

## 6. Reportes falsos o spam

**Cómo identificarlos:**
- Múltiples avistamientos del mismo usuario en poco tiempo con datos inconsistentes
- Fotos irrelevantes (fotos de objetos, memes, imágenes genéricas de internet)
- Textos en descripción claramente de prueba o sin sentido
- Coordenadas que no corresponden a ninguna área realista

**Qué hacer en el MVP:**
1. Rechazar el match o los matches generados por ese avistamiento.
2. Anotar el email del usuario y la descripción del problema en un registro interno (hoja de cálculo o canal interno) para seguimiento.
3. Si el mismo usuario acumula múltiples envíos problemáticos, escalar al responsable técnico para evaluar bloqueo manual en BD.

**Limitación actual:** no hay función de bloqueo de usuario en el panel MVP. El bloqueo manual requiere intervención en base de datos.

---

## 7. Gestión de casos

Desde la lista de casos puedes cambiar el estado de cada caso:

| Estado | Cuándo usarlo |
|---|---|
| `active` | El perro sigue perdido y el caso está vigente |
| `found` | El dueño confirmó que encontró a su perro (por cualquier vía) |
| `closed` | El caso se cierra por inactividad, solicitud del dueño, o por ser inválido |

Si un dueño te contacta por otro canal para informar que encontró a su perro, puedes actualizar el estado manualmente desde el panel. Esto detiene nuevas notificaciones de matches para ese caso.

---

## 8. Escalación — posible estafa o situación de riesgo

Si detectas un patrón que sugiere que alguien está intentando explotar a un dueño vulnerable (por ejemplo: avistamientos falsos para luego pedir dinero por "información", contacto fuera de la app sospechoso, presión sobre el dueño):

1. Rechaza inmediatamente todos los matches relacionados con ese avistamiento.
2. No contactes al usuario sospechoso.
3. Documenta: email del usuario, ID del avistamiento, ID del caso afectado, descripción del patrón.
4. Escala de inmediato al responsable del piloto:

> **Contacto de escalación:** `[COMPLETAR — nombre y medio de contacto del responsable del piloto]`

En casos graves, considera cerrar el caso temporalmente para proteger al dueño de más notificaciones mientras se investiga.

---

## 9. Qué NO puede hacer el panel MVP todavía

Estas limitaciones son conocidas. No son errores — son funcionalidades pendientes para versiones futuras.

- **No hay comparación de fotos lado a lado en el panel.** Hay que abrir el detalle del caso y el detalle del avistamiento en pestañas separadas para comparar visualmente.
- **No hay acciones en bloque.** Cada match se aprueba o rechaza de a uno.
- **No hay bloqueo de usuarios desde el panel.** Requiere intervención manual en base de datos.
- **No hay detección automática de spam.** La revisión es completamente manual.
- **No hay historial de acciones del moderador.** No queda registro de quién aprobó o rechazó cada match.
- **No hay filtros avanzados** en la lista de casos o usuarios.
- **No hay notificaciones push al admin** cuando llegan nuevos matches pendientes — hay que revisar el panel activamente.

---

*Guía interna — Piloto MVP — Perros Perdidos — 2026*
