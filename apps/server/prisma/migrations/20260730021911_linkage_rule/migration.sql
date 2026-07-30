-- CreateTable
CREATE TABLE "LinkageRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "targetActionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'passthrough',
    "targetInput" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "LinkageRule_sourceEventId_idx" ON "LinkageRule"("sourceEventId");
