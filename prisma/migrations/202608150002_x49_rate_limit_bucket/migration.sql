-- X.49: authoritative fixed-window rate-limit buckets.
-- Atomic counter updates are issued by the Prisma provider with
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING count.
CREATE TABLE "RateLimitBucket" (
  "key" VARCHAR(192) NOT NULL,
  "windowKey" VARCHAR(16) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key", "windowKey")
);

CREATE INDEX "RateLimitBucket_windowKey_idx" ON "RateLimitBucket"("windowKey");
