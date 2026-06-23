-- CreateEnum
CREATE TYPE "HipatiaMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateTable
CREATE TABLE "HipatiaConversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "HipatiaConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HipatiaMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "HipatiaMessageRole" NOT NULL,
    "toolCallsJson" TEXT,

    CONSTRAINT "HipatiaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HipatiaConversation_userId_idx" ON "HipatiaConversation"("userId");

-- CreateIndex
CREATE INDEX "HipatiaConversation_createdAt_idx" ON "HipatiaConversation"("createdAt");

-- CreateIndex
CREATE INDEX "HipatiaMessage_conversationId_idx" ON "HipatiaMessage"("conversationId");

-- CreateIndex
CREATE INDEX "HipatiaMessage_createdAt_idx" ON "HipatiaMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "HipatiaConversation" ADD CONSTRAINT "HipatiaConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HipatiaMessage" ADD CONSTRAINT "HipatiaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "HipatiaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
