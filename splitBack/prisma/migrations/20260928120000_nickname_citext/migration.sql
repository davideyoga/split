-- Nickname unico senza distinzione fra maiuscole e minuscole ("Pippo" e
-- "PIPPO" non possono coesistere). citext e' un'estensione "trusted": la puo'
-- creare il proprietario del DB, non serve un superuser (vale anche su Neon).
CREATE EXTENSION IF NOT EXISTS citext;

-- L'indice unico "User_nickName_key" viene ricostruito sul nuovo tipo. Se nel
-- DB ci sono gia' due nickname che differiscono solo per le maiuscole, questa
-- riga fallisce e la migrazione non viene applicata (su Render: build fallita,
-- resta online la versione precedente). Si trovano con
-- splitBack/prisma/check-nicknames.mts.
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "nickName" SET DATA TYPE CITEXT;
