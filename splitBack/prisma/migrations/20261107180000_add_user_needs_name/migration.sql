-- Registrazione aperta (2026-11-07): chi si registra da solo ha un nickname
-- provvisorio finche' non ne sceglie uno su /welcome. Gli utenti esistenti
-- l'hanno gia' scelto (seed.ts, add-users.mts): default false.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "needsName" BOOLEAN NOT NULL DEFAULT false;
