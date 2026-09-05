CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'REVOKED', 'DELETED');
CREATE TYPE "AltanaSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKING', 'REVOKED', 'FAILED');
CREATE TYPE "SessionPermissionKind" AS ENUM ('CALL', 'TOKEN_SPEND', 'NATIVE_SPEND');
CREATE TYPE "EncryptedSecretType" AS ENUM ('ALTANA_SESSION_SIGNER');
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Wallet" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "chainId" INTEGER NOT NULL,
  "address" VARCHAR(42) NOT NULL,
  "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiweChallenge" (
  "id" UUID NOT NULL,
  "nonceHash" VARCHAR(64) NOT NULL,
  "attemptHash" VARCHAR(64) NOT NULL,
  "address" VARCHAR(42) NOT NULL,
  "chainId" INTEGER NOT NULL,
  "domain" VARCHAR(255) NOT NULL,
  "uri" TEXT NOT NULL,
  "messageDigest" VARCHAR(64) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiweChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "walletId" UUID NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "csrfTokenHash" VARCHAR(64) NOT NULL,
  "chainId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AltanaSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "walletId" UUID NOT NULL,
  "sessionIdentifier" VARCHAR(128) NOT NULL,
  "chainId" INTEGER NOT NULL,
  "agentId" BIGINT,
  "walletAddress" VARCHAR(42) NOT NULL,
  "publicKey" VARCHAR(132) NOT NULL,
  "keyId" VARCHAR(66) NOT NULL,
  "status" "AltanaSessionStatus" NOT NULL DEFAULT 'PENDING',
  "keyStoreActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "grantCallsId" VARCHAR(66),
  "registrationCallsId" VARCHAR(66),
  "registrationTxHash" VARCHAR(66),
  "revokeCallsId" VARCHAR(66),
  "revokeTxHash" VARCHAR(66),
  "publicMetadata" JSONB,
  CONSTRAINT "AltanaSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionPermission" (
  "id" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "kind" "SessionPermissionKind" NOT NULL,
  "targetAddress" VARCHAR(42),
  "functionSelector" VARCHAR(10),
  "functionSignature" VARCHAR(256),
  "tokenAddress" VARCHAR(42),
  "spendCapRaw" DECIMAL(78,0),
  "spendPeriod" VARCHAR(16),
  "expiresAt" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EncryptedSecret" (
  "id" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "secretType" "EncryptedSecretType" NOT NULL,
  "ciphertext" BYTEA NOT NULL,
  "nonce" BYTEA NOT NULL,
  "authenticationTag" BYTEA NOT NULL,
  "wrappedDataKey" BYTEA NOT NULL,
  "kmsKeyId" VARCHAR(512) NOT NULL,
  "kmsKeyVersion" VARCHAR(128) NOT NULL,
  "algorithm" VARCHAR(64) NOT NULL,
  "aadMetadata" JSONB NOT NULL,
  "aadVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "destroyedAt" TIMESTAMP(3),
  CONSTRAINT "EncryptedSecret_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL,
  "userId" UUID,
  "walletId" UUID,
  "sessionId" UUID,
  "eventType" VARCHAR(64) NOT NULL,
  "result" "AuditResult" NOT NULL,
  "actorType" VARCHAR(32) NOT NULL,
  "actorIdentifier" VARCHAR(128),
  "resourceType" VARCHAR(64),
  "resourceId" VARCHAR(128),
  "requestId" VARCHAR(128),
  "chainId" INTEGER,
  "callsId" VARCHAR(66),
  "transactionHash" VARCHAR(66),
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE UNIQUE INDEX "Wallet_chainId_address_key" ON "Wallet"("chainId", "address");
CREATE INDEX "Wallet_userId_status_idx" ON "Wallet"("userId", "status");
CREATE INDEX "Wallet_address_idx" ON "Wallet"("address");
CREATE UNIQUE INDEX "SiweChallenge_nonceHash_key" ON "SiweChallenge"("nonceHash");
CREATE UNIQUE INDEX "SiweChallenge_attemptHash_key" ON "SiweChallenge"("attemptHash");
CREATE INDEX "SiweChallenge_expiresAt_idx" ON "SiweChallenge"("expiresAt");
CREATE INDEX "SiweChallenge_consumedAt_expiresAt_idx" ON "SiweChallenge"("consumedAt", "expiresAt");
CREATE INDEX "SiweChallenge_address_createdAt_idx" ON "SiweChallenge"("address", "createdAt");
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_userId_revokedAt_expiresAt_idx" ON "AuthSession"("userId", "revokedAt", "expiresAt");
CREATE INDEX "AuthSession_walletId_revokedAt_idx" ON "AuthSession"("walletId", "revokedAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE INDEX "AuthSession_absoluteExpiresAt_idx" ON "AuthSession"("absoluteExpiresAt");
CREATE UNIQUE INDEX "AltanaSession_sessionIdentifier_key" ON "AltanaSession"("sessionIdentifier");
CREATE UNIQUE INDEX "AltanaSession_chainId_keyId_key" ON "AltanaSession"("chainId", "keyId");
CREATE UNIQUE INDEX "AltanaSession_chainId_publicKey_key" ON "AltanaSession"("chainId", "publicKey");
CREATE INDEX "AltanaSession_userId_status_idx" ON "AltanaSession"("userId", "status");
CREATE INDEX "AltanaSession_walletId_status_idx" ON "AltanaSession"("walletId", "status");
CREATE INDEX "AltanaSession_status_expiresAt_idx" ON "AltanaSession"("status", "expiresAt");
CREATE INDEX "AltanaSession_expiresAt_idx" ON "AltanaSession"("expiresAt");
CREATE UNIQUE INDEX "EncryptedSecret_sessionId_key" ON "EncryptedSecret"("sessionId");
CREATE INDEX "SessionPermission_sessionId_kind_enabled_idx" ON "SessionPermission"("sessionId", "kind", "enabled");
CREATE INDEX "SessionPermission_sessionId_revokedAt_idx" ON "SessionPermission"("sessionId", "revokedAt");
CREATE INDEX "SessionPermission_expiresAt_idx" ON "SessionPermission"("expiresAt");
CREATE INDEX "EncryptedSecret_kmsKeyId_kmsKeyVersion_idx" ON "EncryptedSecret"("kmsKeyId", "kmsKeyVersion");
CREATE INDEX "EncryptedSecret_destroyedAt_idx" ON "EncryptedSecret"("destroyedAt");
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");
CREATE INDEX "AuditEvent_walletId_createdAt_idx" ON "AuditEvent"("walletId", "createdAt");
CREATE INDEX "AuditEvent_sessionId_createdAt_idx" ON "AuditEvent"("sessionId", "createdAt");
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");
CREATE INDEX "AuditEvent_result_createdAt_idx" ON "AuditEvent"("result", "createdAt");
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

CREATE UNIQUE INDEX "AltanaSession_one_live_per_wallet_idx"
  ON "AltanaSession"("walletId")
  WHERE "status" IN ('PENDING', 'ACTIVE', 'REVOKING');

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AltanaSession" ADD CONSTRAINT "AltanaSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AltanaSession" ADD CONSTRAINT "AltanaSession_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SessionPermission" ADD CONSTRAINT "SessionPermission_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AltanaSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EncryptedSecret" ADD CONSTRAINT "EncryptedSecret_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AltanaSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AltanaSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_chainId_check" CHECK ("chainId" = 97);
ALTER TABLE "SiweChallenge" ADD CONSTRAINT "SiweChallenge_chainId_check" CHECK ("chainId" = 97);
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_chainId_check" CHECK ("chainId" = 97);
ALTER TABLE "AltanaSession" ADD CONSTRAINT "AltanaSession_chainId_check" CHECK ("chainId" = 97);
ALTER TABLE "SessionPermission" ADD CONSTRAINT "SessionPermission_spendCapRaw_check" CHECK ("spendCapRaw" IS NULL OR "spendCapRaw" >= 0);
ALTER TABLE "AltanaSession" ADD CONSTRAINT "AltanaSession_revokedAt_check" CHECK (
  ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL)
  OR "status" <> 'REVOKED'
);
