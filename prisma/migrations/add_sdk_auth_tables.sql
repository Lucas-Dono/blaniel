-- Migration: Add SDK Authentication tables
-- Adds tables for OAuth2 PKCE flow and SDK tokens

-- Authorization codes (for OAuth2 flow)
CREATE TABLE IF NOT EXISTS "AuthorizationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthorizationCode_code_key" ON "AuthorizationCode"("code");
CREATE INDEX "AuthorizationCode_userId_idx" ON "AuthorizationCode"("userId");
CREATE INDEX "AuthorizationCode_expiresAt_idx" ON "AuthorizationCode"("expiresAt");

-- SDK Tokens (access tokens for SDK)
CREATE TABLE IF NOT EXISTS "SDKToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "SDKToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SDKToken_token_key" ON "SDKToken"("token");
CREATE INDEX "SDKToken_userId_idx" ON "SDKToken"("userId");
CREATE INDEX "SDKToken_expiresAt_idx" ON "SDKToken"("expiresAt");

-- Foreign keys (assuming User table exists)
-- ALTER TABLE "AuthorizationCode" ADD CONSTRAINT "AuthorizationCode_userId_fkey"
--     FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ALTER TABLE "SDKToken" ADD CONSTRAINT "SDKToken_userId_fkey"
--     FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
