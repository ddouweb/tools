-- CreateTable
CREATE TABLE "HttpCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'bearer',
    "secret" TEXT NOT NULL,
    "headerName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "HttpCredential_name_key" ON "HttpCredential"("name");
