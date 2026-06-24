-- CreateTable
CREATE TABLE "HipatiaMemory" (
    "id" TEXT NOT NULL,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "HipatiaMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HipatiaMemory_userId_idx" ON "HipatiaMemory"("userId");

-- CreateIndex
CREATE INDEX "HipatiaMemory_createdAt_idx" ON "HipatiaMemory"("createdAt");

-- AddForeignKey
ALTER TABLE "HipatiaMemory" ADD CONSTRAINT "HipatiaMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
