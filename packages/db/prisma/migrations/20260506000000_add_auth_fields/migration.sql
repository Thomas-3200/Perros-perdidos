-- AlterTable: agregar campos de autenticación (passwordHash, googleId, facebookId)
-- Todos nullable para no romper usuarios existentes

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "facebookId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key"   ON "users"("googleId")   WHERE "googleId"   IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_facebookId_key" ON "users"("facebookId") WHERE "facebookId" IS NOT NULL;
