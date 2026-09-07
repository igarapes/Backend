-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dataConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isActivate" BOOLEAN NOT NULL DEFAULT true;
