CREATE TABLE "CloudAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "mimeType" TEXT,
  "originalName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CloudAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CloudAsset_userId_idx" ON "CloudAsset"("userId");

ALTER TABLE "CloudAsset"
ADD CONSTRAINT "CloudAsset_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
