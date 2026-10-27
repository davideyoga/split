-- Amici e richieste in attesa (2026-10-25). Nessuna amicizia iniziale
-- (decisione dell'utente): le spese e i gruppi esistenti restano accettati
-- (pending = false), ma la prima spesa nuova con chiunque andra' accettata.

-- AlterTable
ALTER TABLE "ExpenseContribution" ADD COLUMN     "invitedById" INTEGER,
ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserOnGroup" ADD COLUMN     "invitedById" INTEGER,
ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Friendship" (
    "id" SERIAL NOT NULL,
    "userAId" INTEGER NOT NULL,
    "userBId" INTEGER NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Friendship_userBId_idx" ON "Friendship"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");

-- AddForeignKey
ALTER TABLE "ExpenseContribution" ADD CONSTRAINT "ExpenseContribution_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnGroup" ADD CONSTRAINT "UserOnGroup_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aggiunto a mano: ogni coppia si salva una volta sola, col numero piu' basso
-- in userAId (FriendService ordina gli id prima di scrivere).
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_ordered_pair" CHECK ("userAId" < "userBId");
