-- CreateTable
CREATE TABLE "TalentPoolEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "portfolioUrl" TEXT,
    "message" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentPoolEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TalentPoolEntry_email_key" ON "TalentPoolEntry"("email");

-- CreateIndex
CREATE INDEX "TalentPoolEntry_area_idx" ON "TalentPoolEntry"("area");

-- CreateIndex
CREATE INDEX "TalentPoolEntry_createdAt_idx" ON "TalentPoolEntry"("createdAt");
