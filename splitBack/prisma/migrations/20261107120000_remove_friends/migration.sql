-- Via gli amici (2026-11-07, decisione dell'utente): niente piu' richieste da
-- accettare, come in Splitwise. Vedi doc/InvitiGruppo.md.

-- Gli inviti ai gruppi mai accettati spariscono: quelle persone non sono mai
-- entrate (e dalla fase B nei gruppi si entra solo con il link).
DELETE FROM "UserOnGroup" WHERE "pending";

-- Le quote in attesa diventano quote normali (per tutti gli altri contavano
-- gia'): basta togliere la colonna. La loro notifica diventa quella di chi e'
-- stato aggiunto a una spesa; i tipi legati alle richieste spariscono.
UPDATE "Notification" SET "type" = 'EXPENSE_ADDED' WHERE "type" = 'EXPENSE_PENDING';
DELETE FROM "Notification"
WHERE "type" IN ('EXPENSE_REJECTED', 'FRIEND_ACCEPTED', 'GROUP_INVITED', 'GROUP_JOINED', 'GROUP_DECLINED');
-- DropForeignKey
ALTER TABLE "ExpenseContribution" DROP CONSTRAINT "ExpenseContribution_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "UserOnGroup" DROP CONSTRAINT "UserOnGroup_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_userAId_fkey";

-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_userBId_fkey";

-- AlterTable
ALTER TABLE "ExpenseContribution" DROP COLUMN "invitedById",
DROP COLUMN "pending";

-- AlterTable
ALTER TABLE "UserOnGroup" DROP COLUMN "invitedById",
DROP COLUMN "pending";

-- DropTable
DROP TABLE "Friendship";

