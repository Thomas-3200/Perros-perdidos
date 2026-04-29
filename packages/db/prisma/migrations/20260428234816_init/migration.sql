-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'helper', 'finder', 'partner', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "DogSize" AS ENUM ('small', 'medium', 'large', 'extra_large');

-- CreateEnum
CREATE TYPE "DogSex" AS ENUM ('male', 'female', 'unknown');

-- CreateEnum
CREATE TYPE "LostCaseStatus" AS ENUM ('active', 'found', 'closed');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('phone', 'whatsapp', 'email', 'in_app');

-- CreateEnum
CREATE TYPE "DogSightingStatus" AS ENUM ('still_there', 'gone', 'retained', 'injured', 'unknown');

-- CreateEnum
CREATE TYPE "SightingSource" AS ENUM ('app', 'social_import');

-- CreateEnum
CREATE TYPE "ImportedCaseSourceType" AS ENUM ('link', 'screenshot', 'photo', 'text');

-- CreateEnum
CREATE TYPE "ImportedCaseStatus" AS ENUM ('pending', 'processed', 'rejected');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('match_high', 'match_medium', 'sighting_nearby', 'case_update', 'reunion', 'helper_alert', 'support_checkin');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('sighting', 'social_import', 'helper_mode', 'reunion_share');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('shelter', 'vet', 'rescuer', 'ngo');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "locationAddress" TEXT,
    "locationCity" TEXT,
    "locationCountry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dogs" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "color" TEXT[],
    "size" "DogSize" NOT NULL,
    "age" DOUBLE PRECISION,
    "sex" "DogSex" NOT NULL DEFAULT 'unknown',
    "neutered" BOOLEAN,
    "microchipId" TEXT,
    "photos" TEXT[],
    "description" TEXT,
    "qrCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_cases" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "LostCaseStatus" NOT NULL DEFAULT 'active',
    "lastSeenLat" DOUBLE PRECISION NOT NULL,
    "lastSeenLng" DOUBLE PRECISION NOT NULL,
    "lastSeenAddress" TEXT,
    "lastSeenCity" TEXT,
    "lastSeenCountry" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "reward" DOUBLE PRECISION,
    "rewardCurrency" TEXT DEFAULT 'ARS',
    "behaviorNotes" TEXT,
    "contactMethod" "ContactMethod" NOT NULL,
    "contactValue" TEXT NOT NULL,
    "searchRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "lost_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sightings" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "locationLat" DOUBLE PRECISION NOT NULL,
    "locationLng" DOUBLE PRECISION NOT NULL,
    "locationAddress" TEXT,
    "locationCity" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "photos" TEXT[],
    "dogStatus" "DogSightingStatus" NOT NULL DEFAULT 'unknown',
    "description" TEXT,
    "source" "SightingSource" NOT NULL DEFAULT 'app',
    "importedCaseId" TEXT,
    "photoEmbedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sightings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_social_cases" (
    "id" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "sourceType" "ImportedCaseSourceType" NOT NULL,
    "rawInput" TEXT NOT NULL,
    "extractedData" JSONB,
    "status" "ImportedCaseStatus" NOT NULL DEFAULT 'pending',
    "createdCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_social_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "lostCaseId" TEXT NOT NULL,
    "sightingId" TEXT NOT NULL,
    "visualScore" DOUBLE PRECISION NOT NULL,
    "geoScore" DOUBLE PRECISION NOT NULL,
    "timeScore" DOUBLE PRECISION NOT NULL,
    "attributeScore" DOUBLE PRECISION NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" "ConfidenceLevel" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "ownerConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ContributionType" NOT NULL,
    "caseId" TEXT,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reunion_stories" (
    "id" TEXT NOT NULL,
    "lostCaseId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "photos" TEXT[],
    "videoUrl" TEXT,
    "storyText" TEXT,
    "aiGeneratedStory" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reunion_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lostCaseId" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lostCaseId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_profiles" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "contactInfo" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "locationLat" DOUBLE PRECISION NOT NULL,
    "locationLng" DOUBLE PRECISION NOT NULL,
    "locationAddress" TEXT,
    "contact" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "dogsCurrentlyHolding" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "matches_lostCaseId_sightingId_key" ON "matches"("lostCaseId", "sightingId");

-- CreateIndex
CREATE UNIQUE INDEX "reunion_stories_lostCaseId_key" ON "reunion_stories"("lostCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "qr_profiles_dogId_key" ON "qr_profiles"("dogId");

-- CreateIndex
CREATE UNIQUE INDEX "qr_profiles_slug_key" ON "qr_profiles"("slug");

-- AddForeignKey
ALTER TABLE "dogs" ADD CONSTRAINT "dogs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_cases" ADD CONSTRAINT "lost_cases_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "dogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_cases" ADD CONSTRAINT "lost_cases_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_importedCaseId_fkey" FOREIGN KEY ("importedCaseId") REFERENCES "imported_social_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_social_cases" ADD CONSTRAINT "imported_social_cases_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_lostCaseId_fkey" FOREIGN KEY ("lostCaseId") REFERENCES "lost_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_sightingId_fkey" FOREIGN KEY ("sightingId") REFERENCES "sightings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunion_stories" ADD CONSTRAINT "reunion_stories_lostCaseId_fkey" FOREIGN KEY ("lostCaseId") REFERENCES "lost_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_lostCaseId_fkey" FOREIGN KEY ("lostCaseId") REFERENCES "lost_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lostCaseId_fkey" FOREIGN KEY ("lostCaseId") REFERENCES "lost_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_profiles" ADD CONSTRAINT "qr_profiles_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "dogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
