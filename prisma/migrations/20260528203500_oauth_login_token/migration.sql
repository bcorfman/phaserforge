-- Add optional fields to persist GitHub login + OAuth access token for publish workflows.
ALTER TABLE "OAuthAccount" ADD COLUMN IF NOT EXISTS "providerLogin" TEXT;
ALTER TABLE "OAuthAccount" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;

