# Perros Perdidos — Release Notes

## MVP v1.0 — 2026-04-29

### Estado: Listo para pilot con usuarios reales

---

## Qué funciona

### Flujos core (validados end-to-end)

| Flujo | Estado |
|-------|--------|
| Registro de usuario (email, sin contraseña) | ✅ |
| Login | ✅ |
| Reportar perro perdido (formulario 4 pasos, GPS, foto) | ✅ |
| Reportar avistamiento (formulario 3 pasos, GPS, auth gate) | ✅ |
| Motor de matching automático (geo + tiempo + atributos) | ✅ |
| Panel de admin — aprobar / rechazar matches | ✅ |
| Detalle de caso con matches + estado vacío | ✅ |
| Búsqueda por ciudad (/buscar) | ✅ |
| Perfil del usuario con mis casos y contador de matches | ✅ |
| Banner de éxito al crear caso (`?nuevo=true`) | ✅ |
| Mensaje de agradecimiento al reportar avistamiento | ✅ |

### Infraestructura

- API: Fastify en puerto 3001
- Web: Next.js en puerto 3002
- Base de datos: PostgreSQL 16 con pgvector
- Cola de jobs: BullMQ sobre Redis
- Imágenes: almacenamiento local (`/uploads`) sin Cloudinary
- Matching worker: activo en el mismo proceso que la API

---

## Mejoras del motor de matching (esta release)

### Problema resuelto: falsos positivos por color

Un perro negro y uno blanco no pueden ser el mismo perro. Se agregó una regla
de penalización explícita: cuando el color es conocido y NO coincide, el score
de atributos se limita a un máximo de 0.25 en lugar de contribuir positivamente.

### Problema resuelto: falsos negativos por atributos no mencionados

Un reporte que dice "vi un perro en el parque" (sin mencionar raza, color o tamaño)
no significa que el perro no sea un labrador dorado grande. Los atributos ahora
son `null` (neutro) cuando no aparecen en la descripción, no `false` (penalización).

Solo se asigna `false` cuando la descripción menciona explícitamente un valor
diferente al del perro registrado.

### Logging explainable

Cada evaluación de match genera un log en consola con breakdown completo:

```
[match:eval] sighting=X case=Y dog="Firulais" | geo:99% time:100% attr:100%
             (breed:null color:true size:true) | total:99% -> HIGH
```

Si aplica el cap de color: `[CAP:color-mismatch]` aparece en el log.

---

## Umbrales de confianza del matching

| Nivel | Score | Acción |
|-------|-------|--------|
| HIGH | ≥ 85% | Notificación directa al dueño |
| MEDIUM | 65–84% | Aparece en panel admin para revisión |
| LOW | < 65% | Descartado silenciosamente (no guardado) |

**Pesos sin IA (modo actual):** geo 40% | tiempo 20% | atributos 40%

**Pesos con IA (cuando estén las API keys):** visual 50% | geo 25% | tiempo 15% | atributos 10%

---

## Limitaciones conocidas

### /apoyo — Asistente emocional

Requiere `ANTHROPIC_API_KEY` para funcionar. Sin la key:

- La página muestra una pantalla "Próximamente" amigable
- No hay crash ni error visible al usuario
- El endpoint `GET /api/v1/support/status` retorna `{ available: false }`

### Imágenes

Sin `CLOUDINARY_*` configurado, las fotos se guardan en `packages/api/uploads/`.
Esto es funcional para el pilot pero no es persistente entre reinicios del servidor
ni escalable. Configurar Cloudinary antes de producción real.

### Mapa

`/mapa` muestra un placeholder "próximamente". Requiere `NEXT_PUBLIC_MAPBOX_TOKEN`.

### Matching visual con IA

Sin `OPENAI_API_KEY` + `REPLICATE_API_TOKEN`, el matching usa solo texto, geo y tiempo.
El sistema funciona correctamente en este modo (modo básico es el default actual).

### JWT y roles

Si se cambia el rol de un usuario en la base de datos, el cambio se refleja
en el próximo login. El token JWT no se actualiza automáticamente, pero `/me`
siempre retorna el rol fresco desde la base de datos.

---

## Variables de entorno

### Requeridas

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<string largo y aleatorio>
CORS_ORIGIN=http://localhost:3000,http://localhost:3002
PORT=3001
NODE_ENV=development
```

### Opcionales (degradan con gracia si faltan)

```env
ANTHROPIC_API_KEY=   # /apoyo deshabilitado si vacío
OPENAI_API_KEY=      # matching básico si vacío
REPLICATE_API_TOKEN= # matching básico si vacío
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_MAPBOX_TOKEN=  # mapa placeholder si vacío
```

---

## Puertos por defecto

| Servicio | Puerto |
|----------|--------|
| API (Fastify) | 3001 |
| Web (Next.js dev) | 3002 |
| PostgreSQL (Docker) | 5433 |
| Redis (Docker) | 6379 |

---

## Datos de acceso inicial

Solo existe el usuario admin del sistema:

- **Email:** `admin@perrosperdidos.app`
- **Rol:** admin
- **Acceso:** `/admin`

Todos los demás usuarios se crean a través del flujo de registro.

---

## Smoke test pre-lanzamiento (12/12 ✅)

Validado el 2026-04-29:

1. Register new user
2. Login existing user
3. GET /me returns user
4. POST /cases — lost dog
5. GET /cases/:id loads
6. Case has matches array
7. POST /sightings
8. Match created automatically
9. Admin login
10. Admin approve match
11. GET /support/status
12. GET /cases/mine (profile data)

---

## Próximos pasos recomendados (post-pilot)

1. **Configurar Cloudinary** para persistencia de imágenes en producción
2. **Agregar ANTHROPIC_API_KEY** para habilitar el asistente de apoyo emocional
3. **Configurar Mapbox** para la página de mapa
4. **Dominio + SSL** para el deploy público
5. **Notificaciones push** — la infraestructura (BullMQ worker) está lista, falta integrar FCM/OneSignal
6. **Página /reuniones** — index de reunificaciones exitosas (solo existe /reuniones/:id)
7. **Rate limiting** en endpoints de creación (anti-spam para el pilot)
8. **Monitoreo básico** — logs de errores, uptime check

---

## Comandos de desarrollo

```bash
# Levantar todo
docker start perros-postgres autosflow-redis
pnpm dev                    # API en :3001 + worker BullMQ
cd apps/web && pnpm dev     # Web en :3002

# Reset de base de datos (solo dev)
pnpm db:reset && pnpm db:seed

# Build de producción
pnpm build
```
