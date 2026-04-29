# Perros Perdidos — Documentación de Planificación

Este archivo documenta las decisiones de diseño y arquitectura del proyecto.
Para el documento de planificación completo ver: `.claude/plans/sparkling-crafting-engelbart.md`

---

## Estructura del proyecto

```
perros-perdidos-app/
├── apps/
│   └── web/              ← Next.js (web + admin futuro)
├── packages/
│   ├── api/              ← Fastify backend
│   ├── db/               ← Prisma schema + migrations
│   ├── ai/               ← Pipeline: embeddings, matching, parsing, apoyo
│   └── shared/           ← Tipos y utils TypeScript compartidos
├── docs/
│   └── planning.md       ← Este archivo
├── .env.example          ← Variables de entorno requeridas
├── package.json          ← pnpm workspaces root
└── pnpm-workspace.yaml
```

## Setup inicial

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus claves

# 3. Generar cliente Prisma
pnpm db:generate

# 4. Aplicar migraciones (requiere PostgreSQL corriendo)
pnpm db:migrate

# 5. Seed de desarrollo
pnpm db:seed

# 6. Arrancar todo
pnpm dev
```

## Servicios requeridos (desarrollo)

- PostgreSQL 15+ con extensiones `pgvector` y `postgis`
- Redis 7+

### Con Docker:
```bash
docker run -d --name postgres-perros \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=perros_perdidos \
  -p 5432:5432 \
  pgvector/pgvector:pg16

docker run -d --name redis-perros \
  -p 6379:6379 \
  redis:7-alpine
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Mobile | React Native + Expo (próxima fase) |
| Web | Next.js 14 |
| API | Fastify 4 + TypeScript |
| DB | PostgreSQL + pgvector |
| Cache/Queues | Redis + BullMQ |
| Auth | JWT (→ Supabase Auth en producción) |
| Storage | Cloudinary |
| IA Vision | OpenAI GPT-4o |
| IA Chat | Claude (Anthropic) |
| Embeddings | CLIP via Replicate |
| Mapas | Mapbox |
| Hosting | Railway + Vercel |

## Variables de entorno requeridas

Ver `.env.example` para la lista completa.

Las más críticas para el MVP:
- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `CLOUDINARY_*` (para subida de imágenes)

Las opcionales para empezar:
- `REPLICATE_API_TOKEN` (embeddings CLIP — se puede omitir en dev)
- `NEXT_PUBLIC_MAPBOX_TOKEN` (mapa — el mapa no cargará sin él)
