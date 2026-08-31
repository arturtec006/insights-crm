-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProspectJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "radiusMeters" INTEGER NOT NULL DEFAULT 15000,
    "limit" INTEGER NOT NULL DEFAULT 100,
    "scoringProfile" TEXT NOT NULL DEFAULT 'completeness',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "candidates" TEXT,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProspectJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProspectJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProspectJob" ("city", "createdAt", "createdById", "createdCount", "duplicateCount", "error", "finishedAt", "foundCount", "id", "limit", "organizationId", "provider", "query", "radiusMeters", "scoringProfile", "startedAt", "state", "status") SELECT "city", "createdAt", "createdById", "createdCount", "duplicateCount", "error", "finishedAt", "foundCount", "id", "limit", "organizationId", "provider", "query", "radiusMeters", "scoringProfile", "startedAt", "state", "status" FROM "ProspectJob";
DROP TABLE "ProspectJob";
ALTER TABLE "new_ProspectJob" RENAME TO "ProspectJob";
CREATE INDEX "ProspectJob_organizationId_status_idx" ON "ProspectJob"("organizationId", "status");
CREATE INDEX "ProspectJob_organizationId_createdAt_idx" ON "ProspectJob"("organizationId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
