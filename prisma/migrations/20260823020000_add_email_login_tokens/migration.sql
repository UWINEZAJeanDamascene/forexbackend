CREATE TABLE "EmailLoginToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailLoginToken_tokenHash_key" ON "EmailLoginToken"("tokenHash");
CREATE INDEX "EmailLoginToken_userId_expiresAt_idx" ON "EmailLoginToken"("userId", "expiresAt");
ALTER TABLE "EmailLoginToken" ADD CONSTRAINT "EmailLoginToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;