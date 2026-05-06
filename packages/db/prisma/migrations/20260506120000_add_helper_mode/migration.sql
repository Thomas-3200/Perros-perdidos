-- AlterTable: add helperMode and alertCity to users
ALTER TABLE "users" ADD COLUMN "helperMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "alertCity" TEXT;
