# Deployment — Perros Perdidos

Guía completa para deployar el MVP a producción pública.

**Stack de producción:**
| Servicio | Plataforma | Costo estimado |
|----------|-----------|----------------|
| Frontend (Next.js) | Vercel | Gratis |
| Backend (Fastify API) | Railway | ~$5/mes |
| Base de datos (PostgreSQL) | Railway | incluido |
| Cola de trabajos (Redis) | Upstash | Gratis (pilot) |
| Imágenes | Cloudinary | Gratis (25 GB) |

---

## Prerequisitos

- Cuenta en [Vercel](https://vercel.com) (gratis)
- Cuenta en [Railway](https://railway.app) (~$5/mes)
- Cuenta en [Upstash](https://upstash.com) (gratis)
- Cuenta en [Cloudinary](https://cloudinary.com) (gratis)
- Repositorio en GitHub con el código

---

## Paso 1 — Cloudinary (imágenes)

Las fotos de los perros necesitan almacenamiento persistente. El disco de Railway
se reinicia con cada deploy y pierde las imágenes locales.

1. Crear cuenta en https://cloudinary.com
2. Dashboard → API Keys → copiar:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. Guardar los tres valores — los necesitarás en el Paso 3 (Railway)

---

## Paso 2 — Upstash Redis (cola de matching)

El motor de matching usa BullMQ sobre Redis. Upstash tiene un tier gratuito
suficiente para el pilot.

1. Crear cuenta en https://upstash.com
2. Crear una base de datos Redis → elegir región más cercana (ej. `us-east-1`)
3. Copiar la **REST URL** en formato: `redis://default:TOKEN@host.upstash.io:PORT`
   (está en la sección "Connect" → "ioredis")
4. Guardar como `REDIS_URL`

---

## Paso 3 — Railway (backend + base de datos)

### 3a. Crear proyecto Railway

1. Ir a https://railway.app → New Project
2. Elegir **"Deploy from GitHub repo"** → seleccionar tu repositorio
3. Railway detectará el `railway.toml` en la raíz y configurará el servicio API

### 3b. Agregar PostgreSQL

1. Dentro del proyecto Railway → **New** → **Database** → **PostgreSQL**
2. Railway crea la DB y setea `DATABASE_URL` automáticamente en el servicio API
3. Conectar al servicio API: en el servicio, ir a Variables → agregar `${{Postgres.DATABASE_URL}}`
   (Railway permite referencias entre servicios)

### 3c. Habilitar pgvector

La app usa pgvector para embeddings visuales (futuro). Es necesario habilitarlo:

1. Railway → PostgreSQL → Data → **Query**
2. Ejecutar:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 3d. Configurar variables de entorno del backend

En Railway → servicio API → **Variables**, agregar:

```
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# JWT — generar con: openssl rand -hex 64
JWT_SECRET=<string-largo-y-aleatorio-minimo-64-chars>

# Redis (Upstash)
REDIS_URL=redis://default:TOKEN@host.upstash.io:PORT

# CORS — agregar la URL de Vercel cuando la tengas (Paso 4)
# Formato: https://perros-perdidos.vercel.app  (sin barra final)
CORS_ORIGIN=https://TU-APP.vercel.app

# URL pública de esta API (la que asigna Railway)
# Encontrarla en: Railway → servicio → Settings → Domains
API_BASE_URL=https://TU-API.up.railway.app

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret

# IA (opcional — sin estas keys el sistema funciona en modo básico)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
REPLICATE_API_TOKEN=
```

### 3e. Correr migraciones

Una vez que el servicio esté deployado y la DB esté lista:

1. Railway → servicio API → **Shell** (o usar la CLI de Railway)
2. Ejecutar:
   ```bash
   pnpm --filter @perros/db db:migrate:prod
   ```
   Esto corre `prisma migrate deploy` con el `DATABASE_URL` inyectado.

### 3f. Crear usuario admin inicial

En el mismo shell de Railway:

```bash
# Opción A: usando el endpoint de registro y luego actualizando el rol
curl -X POST $API_BASE_URL/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tudominio.com","name":"Admin"}'

# Luego en Railway → PostgreSQL → Query:
UPDATE users SET role = 'admin' WHERE email = 'admin@tudominio.com';
```

### 3g. Verificar que el API responde

```bash
curl https://TU-API.up.railway.app/health
# Esperado: {"status":"ok","service":"perros-perdidos-api",...}
```

---

## Paso 4 — Vercel (frontend)

### 4a. Crear proyecto

1. Ir a https://vercel.com → **New Project**
2. Importar desde GitHub → seleccionar el repositorio
3. Vercel detecta automáticamente que es un monorepo pnpm

### 4b. Configurar el proyecto

En la pantalla de configuración:

| Campo | Valor |
|-------|-------|
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/web` |
| **Build Command** | `next build` (dejar el default) |
| **Install Command** | `pnpm install` (Vercel lo detecta solo) |
| **Output Directory** | `.next` (dejar el default) |

> **Importante:** Vercel detecta el `pnpm-workspace.yaml` en la raíz y ejecuta
> `pnpm install` desde el root aunque el "Root Directory" sea `apps/web`.
> Los paquetes workspace (`@perros/shared`) se resuelven correctamente.

### 4c. Variables de entorno en Vercel

En **Settings → Environment Variables**, agregar:

```
NEXT_PUBLIC_API_URL=https://TU-API.up.railway.app
NEXT_PUBLIC_MAPBOX_TOKEN=   (dejar vacío si no tenés Mapbox)
```

> `NEXT_PUBLIC_*` se exponen al browser. No poner secrets aquí.

### 4d. Deploy

1. Hacer clic en **Deploy**
2. Vercel construye y publica la app
3. Copiar la URL del frontend (ej. `https://perros-perdidos.vercel.app`)

### 4e. Actualizar CORS en Railway

Con la URL de Vercel, volver a Railway → Variables del API:

```
CORS_ORIGIN=https://perros-perdidos.vercel.app
```

Redeploy del servicio Railway para que tome el nuevo CORS.

---

## Paso 5 — Verificar el deploy completo

### Smoke test rápido

```bash
# 1. Health del backend
curl https://TU-API.up.railway.app/health

# 2. Registrar usuario de prueba
curl -X POST https://TU-API.up.railway.app/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","name":"Test"}'

# 3. Verificar soporte de /apoyo
curl https://TU-API.up.railway.app/api/v1/support/status
# { "data": { "available": false } } si no hay ANTHROPIC_API_KEY — correcto

# 4. Lista de casos (debe estar vacía inicialmente)
curl https://TU-API.up.railway.app/api/v1/cases
```

### Checklist de UI

Abrir `https://TU-APP.vercel.app` y verificar:

- [ ] Home carga sin errores de consola
- [ ] Registro de usuario funciona (ingresar email)
- [ ] Login funciona
- [ ] Reportar perro perdido — formulario completo con foto
- [ ] Foto del perro se sube y se muestra (Cloudinary)
- [ ] Reportar avistamiento funciona
- [ ] El motor de matching genera coincidencias (esperar 5-10 segundos)
- [ ] Panel admin accesible en /admin con usuario admin
- [ ] Admin puede aprobar/rechazar matches
- [ ] Perfil muestra mis casos
- [ ] Búsqueda por ciudad funciona
- [ ] /apoyo muestra "Próximamente" sin errores

---

## Seguridad checklist

- [ ] `JWT_SECRET` es un string aleatorio de ≥64 caracteres (no el default de dev)
- [ ] `CORS_ORIGIN` apunta solo al dominio de Vercel (no `*`)
- [ ] Cloudinary keys NO están en el frontend (solo en Railway)
- [ ] `NODE_ENV=production` seteado en Railway
- [ ] El endpoint `/admin` solo es accesible a usuarios con rol `admin` o `moderator`
- [ ] Rate limiting activo (200 req/min por defecto en el servidor)
- [ ] No hay `.env` con secrets commiteados al repo

---

## Dominio personalizado (opcional, post-pilot)

### Frontend (Vercel)
Vercel → Settings → Domains → agregar tu dominio.

### Backend (Railway)
Railway → Settings → Domains → agregar subdominio del API.
Actualizar `CORS_ORIGIN` y `NEXT_PUBLIC_API_URL` correspondientemente.

---

## Comandos de mantenimiento

```bash
# Ver logs del API en Railway
railway logs --service api

# Correr migraciones en producción
railway run pnpm --filter @perros/db db:migrate:prod

# Acceder a la DB en producción
railway connect postgresql

# Crear moderador (en Railway PostgreSQL → Query)
UPDATE users SET role = 'moderator' WHERE email = 'rescatista@ejemplo.com';

# Ver estado de la DB
railway run pnpm --filter @perros/db db:studio  # (solo en dev, abre en localhost)
```

---

## Troubleshooting

### Error: "Cannot find module '@perros/shared'"
El API usa `tsx` para ejecutar TypeScript directamente.
Verificar que `railway.toml` tenga `startCommand = "pnpm --filter @perros/api start"`.

### Imágenes no cargan en producción
- Verificar que `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` estén seteados en Railway.
- Verificar que `NEXT_PUBLIC_API_URL` apunte a la URL correcta de Railway en Vercel.

### Error de CORS en el browser
- Verificar que `CORS_ORIGIN` en Railway contenga exactamente la URL de Vercel (sin barra final).
- Hacer redeploy del servicio API después de cambiar variables.

### Migrations fallan con error de "pgvector"
Conectar a la DB de Railway y ejecutar: `CREATE EXTENSION IF NOT EXISTS vector;`
Luego volver a correr las migraciones.

### El worker de matching no procesa jobs
Verificar que `REDIS_URL` esté correctamente seteado en Railway.
El worker corre en el mismo proceso que el API — no necesita servicio separado.

---

## Arquitectura de producción

```
Browser
  │
  ▼
Vercel (Next.js — apps/web)
  │  NEXT_PUBLIC_API_URL
  ▼
Railway — API (Fastify + BullMQ workers)
  │         │
  │         ├── Railway PostgreSQL (DATABASE_URL)
  │         └── Upstash Redis (REDIS_URL)
  │
  └── Cloudinary (imágenes de perros y avistamientos)
```
