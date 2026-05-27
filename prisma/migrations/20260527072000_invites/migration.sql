CREATE TABLE "Invite" (
  "id" TEXT NOT NULL,
  "email" CITEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "usedByUserId" TEXT,

  CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");
CREATE INDEX "Invite_email_idx" ON "Invite"("email");
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

ALTER TABLE "Invite"
  ADD CONSTRAINT "Invite_usedByUserId_fkey"
  FOREIGN KEY ("usedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

